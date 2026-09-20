"""Create full silent 5-fps gameplay recordings via ordinary input, fixed game clock.
The captured clock advances at 10 display frames/s; simulation stays at 60 Hz.
These files document state transitions and are not a real-time FPS measurement.
"""
from pathlib import Path
import datetime,json,subprocess,shutil,os,hashlib
from playwright.sync_api import sync_playwright
from browser import Player,ROOT

class RecordingPlayer(Player):
 def capture(self,name):
  path=OUT/f'moment-{name}.png'
  self.page.screenshot(path=str(path),animations='allow')
  return f'videos/moment-{name}.png'

OUT=ROOT/'artifacts'/'videos';OUT.mkdir(parents=True,exist_ok=True)
def run():
 results=[]
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.getenv('BROWSER_EXECUTABLE') or shutil.which('chromium'),headless=False,args=['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  ctx=browser.new_context(viewport={'width':960,'height':720});page=ctx.new_page();page.clock.install(time=datetime.datetime(2026,9,20));page.set_content((ROOT/'dist/index.html').read_text());page.clock.pause_at(datetime.datetime(2026,9,20,0,0,3));a=RecordingPlayer(page,ctx,'desktop');a.frame()
  for game,index,id in [('crowd',0,'C1'),('hole',4,'H5'),('pins',4,'P5'),('screws',4,'S5'),('wreck',4,'R5')]:
   a.choose(game,index);a.step(.2)
   out=OUT/f'{id}.mp4';log=open(OUT/f'{id}-encode.log','w');proc=subprocess.Popen(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate','5','-vcodec','png','-i','-','-an','-c:v','libx264','-preset','veryfast','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart',str(out)],stdin=subprocess.PIPE,stderr=log)
   rawframe=a.frame;frames=[0,0]
   def frame():
    rawframe();frames[0]+=1
    if frames[0]%2==0:proc.stdin.write(page.screenshot(type='png'));frames[1]+=1
   a.frame=frame
   try:
    a.step(1);a.play(game,index);a.step(1.5);result=a.state()['game']['result'];assert result and result['win'];entry={'level':id,'game':game,'win':True,'result':result,'frames':frames[1],'fps':5,'duration_seconds':frames[1]/5,'file':f'videos/{id}.mp4','silent':True,'clock':'controlled; not a performance benchmark'}
   finally:
    a.frame=rawframe;proc.stdin.close();proc.wait(timeout=30);log.close()
   assert proc.returncode==0
   entry['sha256']=hashlib.sha256(out.read_bytes()).hexdigest();results.append(entry);(OUT/'recordings.json').write_text(json.dumps(results,ensure_ascii=False,indent=2));print('RECORDED',id,frames[1],result,flush=True)
  ctx.close();browser.close()
if __name__=='__main__':run()
