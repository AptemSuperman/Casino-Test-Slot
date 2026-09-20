"""Real WebGL + mouse/touch integration tests. No direct game actions or win hooks.
Playwright Clock supplies 100 ms display frames; the product still executes its
unchanged 1/60 s simulation. This is not an FPS benchmark or a physical-phone test.
"""
from pathlib import Path
import argparse,datetime,json,math,time,traceback,os,shutil,sys,hashlib
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts'/'browser';OUT.mkdir(parents=True,exist_ok=True)
RECIPES=json.loads((ROOT/'artifacts/recipes.json').read_text())

def segment_distance(p,a,b):
 dx=b[0]-a[0];dy=b[1]-a[1];t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy or 1)))
 return math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t)

class Player:
 def __init__(self,page,context,mode):
  self.page=page;self.mode=mode;self.cdp=context.new_cdp_session(page) if mode=='touch' else None;self.events=[];self.touch_active=False
 def state(self):return self.page.evaluate('__PLAY_AD__.snapshot()')
 def frame(self):self.page.clock.fast_forward(100)
 def step(self,seconds):
  for _ in range(math.ceil(seconds*10)):self.frame()
 def click_selector(self,selector):
  loc=self.page.locator(selector).first
  loc.evaluate("el=>el.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'})")
  box=loc.bounding_box();assert box,selector
  x=box['x']+box['width']/2;y=box['y']+box['height']/2
  if self.cdp:self.page.touchscreen.tap(x,y)
  else:self.page.mouse.click(x,y)
  self.events.append({'button':selector})
 def field_point(self,p):
  b=self.page.locator('#game').bounding_box();return b['x']+p['x'],b['y']+p['y']
 def world(self,p):return self.field_point(self.page.evaluate('(p)=>__PLAY_AD__.project(p)',p))
 def pointer(self,type,x=None,y=None):
  if self.cdp:
   if type in ('up','cancel','move') and not self.touch_active:return
   self.cdp.send('Input.dispatchTouchEvent',{'type':{'down':'touchStart','move':'touchMove','up':'touchEnd','cancel':'touchCancel'}[type], 'touchPoints':[] if type in ['up','cancel'] else [{'x':x,'y':y,'radiusX':1,'radiusY':1,'force':1}]})
   self.touch_active=type not in ('up','cancel')
  else:
   if type in ['move','down']:self.page.mouse.move(x,y)
   if type=='down':self.page.mouse.down()
   elif type in ['up','cancel']:self.page.mouse.up()
 def tap_point(self,p):
  x,y=self.field_point(p);self.pointer('down',x,y);self.pointer('up')
 def choose(self,game,index):
  self.pointer('up')
  self.click_selector('#library');self.step(.2)
  self.click_selector(f'#library-content [data-game="{game}"][data-index="{index}"]');self.step(.2)
  s=self.state();assert s['route']=={'game':game,'index':index},s['route'];assert not s['errors'],s['errors']
 def capture(self,name):
  self.page.screenshot(path=str(OUT/f'{self.mode}-{name}.png'),animations='allow')
  return f'browser/{self.mode}-{name}.png'
 def play(self,game,index):
  s=self.state()['game'];id=s['level'];action=None
  if game=='crowd':
   for x,d in RECIPES[game][index]:
    point=self.world([x,0,5]);self.pointer('down',*point);self.events.append({'hold_world_x':x,'seconds':d})
    for k in range(math.ceil(d*10)):
     self.frame()
     if not action and self.state()['game']['time']>4.4:action=self.capture(id+'-action')
    self.pointer('up')
   for _ in range(150):
    if self.state()['game']['result']:break
    self.frame()
  elif game=='hole':
   b=self.page.locator('#game').bounding_box();anchor=(b['x']+b['width']*.5,b['y']+b['height']*.66);self.pointer('down',*anchor)
   for _ in range(1400):
    s=self.state()['game']
    if s['result']:break
    choices=sorted([o for o in s['objects'] if o['state']=='live' and not o['protected'] and o['need']<=s['radius']],key=lambda o:math.hypot(o['x']-s['x'],o['z']-s['z']))
    target=next((o for o in choices if not any(p['protected'] and segment_distance([p['x'],p['z']],[s['x'],s['z']],[o['x'],o['z']])<s['radius']+.2 for p in s['objects'])),None)
    dx=target['x']-s['x'] if target else 0;dz=target['z']-s['z'] if target else 0;n=max(.7,math.hypot(dx,dz))
    self.pointer('move',anchor[0]+dx/n*55,anchor[1]+dz/n*55);self.frame()
    if not action and s['radius']>.9:action=self.capture(id+'-action')
   self.pointer('up');self.events.append({'relative_joystick':'nearest fitting object; avoid shields; no position setters'})
  elif game=='pins':
   for n,idpin in enumerate(RECIPES[game][index]):
    e=next(e for e in self.state()['game']['edges'] if e['id']==idpin);assert not e['open'];self.tap_point(e['point']);self.events.append({'pin':idpin});self.step(.6)
    if not action and n==min(1,len(RECIPES[game][index])-1):action=self.capture(id+'-action')
    self.step(3.0);assert next(e for e in self.state()['game']['edges'] if e['id']==idpin)['open'],idpin
   self.step(3)
  elif game=='screws':
   sequence=RECIPES[game][index]
   for n,idbolt in enumerate(sequence):
    bolt=next(b for b in self.state()['game']['bolts'] if b['id']==idbolt);assert bolt['available'],f'{idbolt} hidden';self.tap_point(bolt['point']);self.events.append({'bolt':idbolt});self.step(.3)
    assert idbolt in self.state()['game']['removed'],f'{idbolt} not removed'
    if not action and n==len(sequence)//2:action=self.capture(id+'-action')
    self.step(.7)
   self.step(2)
  elif game=='wreck':
   vx,vy=RECIPES[game][index];a=self.world([0,4.5,0]);b=self.world([-vx/5.5,4.5-vy/5.5,0]);self.pointer('down',*a);self.pointer('move',*b);self.step(.2);self.capture(id+'-aim');self.pointer('up');self.events.append({'drag_velocity':[vx,vy]});self.step(.8);action=self.capture(id+'-action')
   for _ in range(100):
    if self.state()['game']['result']:break
    self.frame()
  self.step(1.3)
  return action or self.capture(id+'-action')

def run(mode,only=None):
 reports=[];started=time.monotonic()
 with sync_playwright() as p:
  launch={'headless':os.getenv('HEADLESS','0')=='1','args':['--disable-dev-shm-usage']}
  executable=os.getenv('BROWSER_EXECUTABLE') or shutil.which('chromium') or shutil.which('chromium-browser')
  if executable:launch['executable_path']=executable
  if sys.platform.startswith('linux'):launch['args'].append('--no-sandbox')
  if os.getenv('SOFTWARE_WEBGL','1' if sys.platform.startswith('linux') else '0')=='1':launch['args']+=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']
  browser=p.chromium.launch(**launch)
  context=browser.new_context(viewport={'width':1120,'height':820} if mode=='desktop' else {'width':390,'height':844},device_scale_factor=1,is_mobile=mode=='touch',has_touch=mode=='touch')
  page=context.new_page();page_errors=[];page.on('pageerror',lambda e:page_errors.append(str(e)))
  page.clock.install(time=datetime.datetime(2026,9,20,0,0));page.set_content((ROOT/'dist/index.html').read_text(),wait_until='load');page.clock.pause_at(datetime.datetime(2026,9,20,0,0,3))
  player=Player(page,context,mode);player.frame()
  gpu=page.evaluate('(()=>{const g=document.querySelector("canvas").getContext("webgl2"),e=g.getExtension("WEBGL_debug_renderer_info");return e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER)})()')
  environment={'build_sha256':hashlib.sha256((ROOT/'dist/index.html').read_bytes()).hexdigest(),'browser':browser.version,'mode':mode,'viewport':page.viewport_size,'gpu':gpu,'clock':'100 ms synthetic display frames; unchanged 1/60 s game steps','delivery':'Exact production HTML through page.set_content; file and loopback navigation blocked by environment policy','audio':'not listened','physical_mobile':False}
  for game,prefix in [('crowd','C'),('hole','H'),('pins','P'),('screws','S'),('wreck','R')]:
   for i in range(5):
    id=prefix+str(i+1)
    if only and id not in only:continue
    record={'id':id,'mode':mode,'expected':'win from ordinary pointer actions'};player.events=[]
    try:
     player.choose(game,i);player.step(5);s=player.state();assert not s['game']['started'] and s['game']['time']==0 and not s['game']['result'];record['negative_idle']={'seconds':5,'passed':True}
     record['start']=player.capture(id+'-start');record['action']=player.play(game,i);s=player.state();record['actual']=s['game']['result'];record['render']=s['render'];record['errors']=s['errors'];assert s['game']['result'] and s['game']['result']['win'],s['game'];assert not s['errors'];assert not page_errors,page_errors
     if game=='wreck' and i in [1,4]:assert s['game']['reflectorHits']>=1;record['reflectorHits']=s['game']['reflectorHits']
     record['end']=player.capture(id+'-result');record['passed']=True
     player.click_selector('#restart');player.frame();reset=player.state()['game'];assert reset['time']==0 and not reset['started'] and not reset['result'];record['restart']=True
     print(mode,id,'PASS',record['actual'],flush=True)
    except Exception as e:
     record['passed']=False;record['error']=str(e);record['failure_screenshot']=player.capture(id+'-failure');print(mode,id,'FAIL',str(e)[:400],flush=True)
    record['events']=player.events;reports.append(record)
    (OUT/f'{mode}-results.json').write_text(json.dumps({'environment':environment,'elapsed_wall_seconds':round(time.monotonic()-started,2),'results':reports},ensure_ascii=False,indent=2))
  context.close();browser.close()
 return all(r['passed'] for r in reports)
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--mode',choices=['desktop','touch','both'],default='both');parser.add_argument('--only',default='');args=parser.parse_args();ok=True
 for mode in ['desktop','touch'] if args.mode=='both' else [args.mode]:ok=run(mode,args.only.split(',') if args.only else None) and ok
 raise SystemExit(0 if ok else 1)
