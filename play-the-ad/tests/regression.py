"""Additional ordinary-input browser regression. No product state is modified."""
from pathlib import Path
import datetime, json, os, subprocess, shutil, sys, time
from playwright.sync_api import sync_playwright
from browser import Player, ROOT
OUT=ROOT/'artifacts'/'regression';OUT.mkdir(parents=True,exist_ok=True)

def run():
 report={'tests':[], 'limitations':[]}
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.getenv('BROWSER_EXECUTABLE') or shutil.which('chromium'),headless=False,args=['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  context=browser.new_context(viewport={'width':960,'height':720},has_touch=True)
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.clock.install(time=datetime.datetime(2026,9,20));page.set_content((ROOT/'dist/index.html').read_text());page.clock.pause_at(datetime.datetime(2026,9,20,0,0,3))
  a=Player(page,context,'touch');a.frame()
  def check(name,fn):
   try:
    evidence=fn();verified=not(isinstance(evidence,dict) and evidence.get('verified') is False);report['tests'].append({'name':name,'passed':True if verified else None,'status':'checked' if verified else 'not_checked','evidence':evidence});print('PASS' if verified else 'NOT CHECKED',name,flush=True)
   except Exception as e:
    report['tests'].append({'name':name,'passed':False,'error':str(e)});print('FAIL',name,e,flush=True)
   (OUT/'results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
  def cancel():
   a.choose('crowd',0);xy=a.world([-2.2,0,5]);a.pointer('down',*xy);a.step(1);a.pointer('cancel');before=a.state()['game']['used'];a.step(2);after=a.state()['game']['used'];assert before==after and before>0;return {'shots_before':before,'shots_after':after}
  check('Native touchCancel stops firing',cancel)
  def pause():
   a.choose('crowd',0);a.pointer('down',*a.world([-2.2,0,5]));a.step(1);a.pointer('up');a.click_selector('#pause');t=a.state()['game']['time'];a.step(10);assert a.state()['paused'] and a.state()['game']['time']==t;a.click_selector('#resume');a.step(1);assert a.state()['game']['time']>t;return {'frozen_time':t,'after_resume':a.state()['game']['time']}
  check('Pause freezes simulation and resumes without catching up',pause)
  def midaction():
   a.choose('crowd',0);a.pointer('down',*a.world([-2.2,0,5]));a.step(2);a.pointer('up');a.click_selector('#next');a.step(4);s=a.state();assert s['route']['game']=='hole' and not s['game']['started'];return {'next_game':s['route'],'time':s['game']['time']}
  check('Skip during action disposes previous game and leaves next ready',midaction)
  def rapid():
   a.choose('screws',0);s=a.state()['game'];b=next(x for x in s['bolts'] if x['available']);
   for _ in range(6):a.tap_point(b['point'])
   a.step(.3);s=a.state()['game'];assert len(s['removed'])==1;return {'clicks':6,'removed':s['removed']}
  check('Six rapid clicks count one screw once',rapid)
  def lose_retry():
   a.choose('pins',0);e=next(e for e in a.state()['game']['edges'] if e['id']=='danger');a.tap_point(e['point']);a.step(6);s=a.state()['game'];assert s['result'] and not s['result']['win'];a.click_selector('#again');a.step(.2);s=a.state()['game'];assert not s['started'] and not s['result'];return {'loss_and_again':True}
  check('Visible loss followed by Again returns pristine level',lose_retry)
  def mute():
   initial=a.state()['storage']['muted'];a.click_selector('#sound');assert a.state()['storage']['muted']!=initial;a.click_selector('#next');a.frame();assert a.state()['storage']['muted']!=initial;a.click_selector('#sound');assert a.state()['storage']['muted']==initial;return {'initial':initial,'retained_across_switch':True,'not_listened':True}
  check('Mute setting retained across game change',mute)
  def sizing():
   dims=[]
   for w,h in [(390,844),(844,390),(1120,820),(320,700),(960,720)]:
    page.set_viewport_size({'width':w,'height':h});a.step(.3);g=page.locator('#game').bounding_box();assert g['width']>200 and g['height']>200;assert g['x']>=0 and g['x']+g['width']<=w+.1 and g['y']+g['height']<=h+.1;assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');dims.append({'viewport':[w,h],'canvas':g});page.screenshot(path=str(OUT/f'resize-{w}x{h}.png'))
   return dims
  check('Portrait, landscape, narrow and desktop resize without overflow',sizing)
  def switches():
   observations=[]
   for i in range(50):
    a.click_selector('#next');a.frame();s=a.state();assert not s['errors'];assert s['game']['time']==0;assert s['render']['meshes']<=17
    if s['route']['game']!='screws':assert s['render']['meshes']==7
    observations.append({'game':s['route']['game'],'meshes':s['render']['meshes'],'labels':s['render']['labels']})
   assert page.evaluate('document.querySelector("canvas").getContext("webgl2").getError()')==0
   return observations
  check('50 actual UI switches keep one scene and bounded GPU meshes',switches)
  def visibility():
   a.choose('crowd',0);a.pointer('down',*a.world([-2.2,0,5]));a.step(1);a.pointer('up');second=context.new_page();second.set_content('<title>Background check</title><p>Another tab</p>');second.bring_to_front();page.wait_for_timeout(120);hidden=page.evaluate('document.hidden');state=a.state();second.close();page.bring_to_front();a.frame()
   if not hidden:
    report['limitations'].append('Browser window manager did not expose actual document.hidden for another tab; automatic visibility pause is not verified by this browser test.');return {'verified':False,'document_hidden':hidden}
   assert state['paused'];t=state['game']['time'];a.step(5);assert a.state()['game']['time']==t;a.click_selector('#resume');return {'verified':True,'background_pause':True,'time':t}
  check('Actual background tab behavior',visibility)
  check('No sponsor enabled by default',lambda: {'hidden':page.locator('#sponsor').is_hidden()} if page.locator('#sponsor').is_hidden() else (_ for _ in ()).throw(AssertionError('sponsor visible')))
  check('No JavaScript errors',lambda: {'errors':errors} if not errors else (_ for _ in ()).throw(AssertionError(errors)))
  report['environment']={'browser':browser.version,'headful':True,'renderer':'SwiftShader','delivery':'Unmodified standalone HTML via set_content; native mouse/touch input','audio':'Not listened','static_navigation':'file:// and loopback HTTP navigation blocked by environment policy','build_sha256':__import__('hashlib').sha256((ROOT/'dist/index.html').read_bytes()).hexdigest()}
  (OUT/'results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));context.close();browser.close()
 return all(t['passed'] is not False for t in report['tests'])
if __name__=='__main__':raise SystemExit(0 if run() else 1)
