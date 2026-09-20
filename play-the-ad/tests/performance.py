"""Short real-clock software-renderer diagnostics, not an end-user GPU benchmark."""
from pathlib import Path
import json, time, shutil, os, statistics, hashlib
from playwright.sync_api import sync_playwright
from browser import ROOT
OUT=ROOT/'artifacts'/'performance';OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.getenv('BROWSER_EXECUTABLE') or shutil.which('chromium'),headless=False,args=['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 ctx=browser.new_context(viewport={'width':1120,'height':820});rows=[]
 for quality in ['high','low']:
  page=ctx.new_page();page.set_content((ROOT/'dist/index.html').read_text());page.wait_for_timeout(500)
  if quality=='low':page.locator('#settings').click();page.locator('#quality').select_option('low');page.locator('#settings-dialog .close-dialog').click()
  page.locator('#level-nav [data-level="3"]').click();page.wait_for_timeout(300)
  point=page.evaluate('__PLAY_AD__.project([-2.2,0,5])');box=page.locator('#game').bounding_box();page.mouse.move(box['x']+point['x'],box['y']+point['y']);page.mouse.down();samples=[];start=time.monotonic()
  for _ in range(24):
   page.wait_for_timeout(250);s=page.evaluate('__PLAY_AD__.snapshot()');samples.append({'time':s['game']['time'],'agents':s['game']['agents'],'instances':s['render']['instances'],'drawCalls':s['render']['drawCalls']})
  page.mouse.up();s=page.evaluate('__PLAY_AD__.snapshot()');times=s['timings'];times=times[5:] if len(times)>5 else times
  r={'game':'C4','quality':quality,'wall_seconds':round(time.monotonic()-start,3),'sample_count':len(times),'frame_interval_median_ms':statistics.median(times) if times else None,'frame_interval_p95_ms':sorted(times)[int(.95*(len(times)-1))] if times else None,'approx_fps_from_mean_interval':1000/statistics.mean(times) if times else None,'peak_instances':max(v['instances'] for v in samples),'peak_draw_calls':max(v['drawCalls'] for v in samples),'canvas':s['render'],'errors':s['errors'],'samples':samples}
  rows.append(r);page.screenshot(path=str(OUT/f'C4-{quality}.png'),timeout=90000);page.close();print('MEASURED',quality,r['approx_fps_from_mean_interval'],r['peak_instances'],flush=True)
 report={'build_sha256':hashlib.sha256((ROOT/'dist/index.html').read_bytes()).hexdigest(),'browser':browser.version,'viewport':[1120,820],'real_clock':True,'renderer':'ANGLE SwiftShader, CPU software rendering, headful under Xvfb','limitations':'Container diagnostic only; no physical phone, no user GPU, not a controlled cross-device benchmark; no guarantee of 60 FPS. Browser tests and recordings use a separate controlled clock and are not this measurement.','results':rows}
 (OUT/'results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));ctx.close();browser.close()
