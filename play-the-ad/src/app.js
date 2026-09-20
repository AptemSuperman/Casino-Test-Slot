import { Renderer } from './core/render.js';
import { Sound, Input, readSave, writeSave } from './core/runtime.js';
import { GAMES, gameMeta, levelTitle, validRoute } from './levels.js';
import { Crowd } from './games/crowd.js';
import { Hole } from './games/hole.js';
import { Pins } from './games/pins.js';
import { Screws } from './games/screws.js';
import { Wreck } from './games/wreck.js';

const $=id=>document.getElementById(id), factories={crowd:Crowd,hole:Hole,pins:Pins,screws:Screws,wreck:Wreck};
const canvas=$('game'),save=readSave(),sound=new Sound(save.muted),reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let renderer=null,current=null,route=validRoute(location.search),paused=false,hiddenPause=false,acc=0,last=0,frame=0,resultAt=0,toastTimer=null,storageWarned=false,fatal=false,input=null;
const measurements=[],errors=[];
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3400);}
function persist(){if(!writeSave(save)&&!storageWarned){storageWarned=true;toast('Браузер не разрешил сохранение. В этой вкладке прогресс останется.');}}
function placeHint(){const side=document.querySelector('.story-panel'),hint=$('start-hint'),host=getComputedStyle(side).display==='none'?document.querySelector('.stage-shell'):side;if(hint.parentElement!==host)host.append(hint);}
function setSound(){sound.setMuted(save.muted);$('sound').innerHTML=save.muted?'♩':'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M10 5L5 9H2v6h3l5 4V5Z"/><path d="M14 8c2 2 2 6 0 8m3-11c4 4 4 10 0 14"/></svg>';$('sound').setAttribute('aria-label',save.muted?'Включить звук':'Выключить звук');$('mute-check').checked=!save.muted;}
function toggleSound(){sound.unlock();save.muted=!save.muted;setSound();persist();}
function setPaused(value,automatic=false){paused=!!value;input?.cancel();sound.pause(paused);acc=0;last=performance.now();$('pause-overlay').hidden=!paused||!!current?.result;$('pause-icon').textContent=paused?'▶':'Ⅱ';$('pause').setAttribute('aria-label',paused?'Продолжить':'Пауза');if(!automatic)hiddenPause=false;}
function routeUrl(){const url=new URL(location.href);url.searchParams.set('game',route.game);url.searchParams.set('level',String(route.index+1));return url;}
function refreshMenus(){const meta=gameMeta(route.game);
 $('progress').innerHTML=`${Object.keys(save.records).length} / 25 <span>эпизодов</span>`;
 $('level-nav').innerHTML=Array.from({length:5},(_,i)=>{const rec=save.records[meta.prefix+(i+1)];return `<button class="level-button ${route.index===i?'active':''}" data-level="${i}" aria-label="Уровень ${i+1}: ${levelTitle(route.game,i)}"><span class="level-number">0${i+1}</span><span class="level-text">${levelTitle(route.game,i)}${rec?`<small>${'★'.repeat(rec.stars)}</small>`:''}</span></button>`;}).join('');
 $('game-rail').innerHTML=GAMES.map(g=>`<button class="game-tab ${route.game===g.id?'active':''}" data-game="${g.id}" style="--tab:${g.color}" aria-label="${g.name}"><span class="tab-icon" style="color:${g.color}">${g.icon}</span><span><strong>${g.name}</strong><small>${g.tag}</small></span></button>`).join('');
 $('library-content').innerHTML=GAMES.map(g=>`<section class="library-game" style="--tab:${g.color}"><h3><span style="color:${g.color}">${g.icon}</span> ${g.name}</h3><div class="library-levels">${Array.from({length:5},(_,i)=>{const rec=save.records[g.prefix+(i+1)];return `<button class="library-level ${route.game===g.id&&route.index===i?'current':''}" data-game="${g.id}" data-index="${i}"><span class="num">${g.prefix}${i+1}</span><span class="name">${levelTitle(g.id,i)}</span><span class="stars">${rec?'★'.repeat(rec.stars):'↗'}</span></button>`;}).join('')}</div></section>`).join('');
}
function load(game,index,updateUrl=true){
 if(fatal)return;game=factories[game]?game:'crowd';index=Math.max(0,Math.min(4,Number.isInteger(index)?index:0));
 input?.cancel();sound.stopAll();current?.dispose();renderer.clearLabels();route={game,index};resultAt=0;$('result-overlay').hidden=true;$('pause-overlay').hidden=true;paused=false;sound.pause(false);acc=0;last=performance.now();
 const meta=gameMeta(game);document.documentElement.style.setProperty('--accent',meta.color);$('series-label').textContent=`0${GAMES.findIndex(g=>g.id===game)+1} / 05 · ORIGINALS`;$('game-title').innerHTML=meta.name.split(' ').join('<br>');$('game-tag').textContent=meta.tag;$('episode-id').textContent=meta.prefix+(index+1);$('episode-name').textContent=levelTitle(game,index);$('control-hint').textContent=meta.hint;$('start-hint').hidden=false;$('mode-badge').textContent=`0${index+1} / 05`;$('pause-icon').textContent='Ⅱ';
 try{
 current=new factories[game]({renderer,sound,reduced,started:()=>{$('start-hint').hidden=true;const id=meta.prefix+(index+1);if(!save.played.includes(id)){save.played.push(id);persist();}},finished:res=>{resultAt=performance.now()+1050;if(res.win){const id=meta.prefix+(index+1),old=save.records[id];if(!old||res.stars>old.stars||res.stars===old.stars&&res.time<old.time)save.records[id]={stars:res.stars,time:res.time,metric:res.metric};persist();refreshMenus();}}},index);
 $('mission').textContent=current.level.goal;$('loading').hidden=true;refreshMenus();updateHud();placeHint();
 if(updateUrl){try{history.replaceState(null,'',routeUrl());}catch{}}
 }catch(error){fail(error);}
}
function updateHud(){if(!current)return;const hud=current.hud();$('metric-value').textContent=hud.value;$('metric-label').textContent=hud.label;$('secondary').textContent=hud.secondary||'';$('mission-progress').style.width=`${Math.max(0,Math.min(1,hud.progress||0))*100}%`;}
function nextGame(){const i=GAMES.findIndex(g=>g.id===route.game),next=GAMES[(i+1)%5];let index=Array.from({length:5},(_,j)=>j).find(j=>!save.played.includes(next.prefix+(j+1)));if(index===undefined)index=(route.index+1)%5;load(next.id,index);}
function showResult(){const res=current.result;if(!res)return;$('result-kicker').textContent=res.win?'МОМЕНТ УДАЛСЯ':'ЕЩЁ ОДНА ПОПЫТКА';$('result-stars').textContent=res.win?'★'.repeat(res.stars)+'☆'.repeat(3-res.stars):'↻';$('result-title').textContent=res.win?(Object.keys(save.records).length===25?'Все 25. Красиво!':'Вот это момент.'):'Попробуем иначе.';$('result-reason').textContent=res.reason;$('result-metric').textContent=res.metric;$('result-overlay').hidden=false;
 const config=window.PLAY_THE_AD_CONFIG?.sponsor;const enabled=config?.enabled&&typeof config.name==='string';$('sponsor').hidden=!enabled;if(enabled){$('sponsor').textContent='Спонсор · '+config.name.slice(0,80);}
 $('more').textContent=route.index===4?'Первый эпизод ↻':'Ещё такое →';resultAt=0;
}
async function share(){const url=routeUrl().toString(),text=`PLAY THE AD · ${levelTitle(route.game,route.index)}`;if(location.protocol==='file:'){toast('Для ссылки другу размести index.html на статическом хостинге.');return;}try{if(navigator.share){await navigator.share({title:'PLAY THE AD',text,url});return;}if(navigator.clipboard){await navigator.clipboard.writeText(url);toast('Ссылка на этот эпизод скопирована.');return;}toast('Ссылка находится в адресной строке браузера.');}catch(e){if(e.name!=='AbortError')toast('Ссылка находится в адресной строке браузера.');}}
function openDialog(id){setPaused(true);$(id).showModal();}
function fail(error){fatal=true;errors.push(String(error));$('loading').hidden=false;$('loading').innerHTML='';let text=document.createElement('p');text.textContent=String(error.message||error);$('loading').append(text);console.error(error);}
function tick(now){requestAnimationFrame(tick);if(fatal||!current)return;const rawElapsed=last?Math.max(0,(now-last)/1000):0,elapsed=Math.min(.1,rawElapsed);last=now;
 try{if(!paused){acc+=elapsed;while(acc>=1/60){current.update(1/60);acc-=1/60;}}
 renderer.begin(current.started?current.time:now/1000*.6);current.render(current.started?current.time:now/1000*.6);renderer.flush();frame++;if(frame%8===0)updateHud();if(resultAt&&now>=resultAt)showResult();
 if(elapsed>0&&!paused&&current.started&&!current.result){measurements.push(rawElapsed*1000);if(measurements.length>600)measurements.shift();}
 }catch(error){fail(error);}
}
try{renderer=new Renderer(canvas,$('world-labels'));renderer.quality=save.quality;renderer.resize();input=new Input(canvas,(type,data)=>{if(!paused&&!fatal)current?.input(type,data);},()=>sound.unlock());setSound();$('quality').value=save.quality;load(route.game,route.index,false);requestAnimationFrame(tick);}catch(error){fail(error);}
$('level-nav').addEventListener('click',e=>{const b=e.target.closest('[data-level]');if(b)load(route.game,Number(b.dataset.level));});
$('game-rail').addEventListener('click',e=>{const b=e.target.closest('[data-game]');if(b)load(b.dataset.game,0);});
$('library-content').addEventListener('click',e=>{const b=e.target.closest('[data-game]');if(b){$('library-dialog').close();load(b.dataset.game,Number(b.dataset.index));}});
for(const id of ['library','brand','progress'])$(id).onclick=()=>openDialog('library-dialog');
$('settings').onclick=()=>openDialog('settings-dialog');
for(const b of document.querySelectorAll('.close-dialog'))b.onclick=()=>b.closest('dialog').close();
for(const d of document.querySelectorAll('dialog')){d.addEventListener('close',()=>{if(!document.hidden)setPaused(false);});d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});}
$('next').onclick=nextGame;$('result-next').onclick=nextGame;$('restart').onclick=()=>load(route.game,route.index);$('again').onclick=()=>load(route.game,route.index);$('more').onclick=()=>load(route.game,(route.index+1)%5);
$('pause').onclick=()=>setPaused(!paused);$('resume').onclick=()=>setPaused(false);$('sound').onclick=toggleSound;$('mute-check').onchange=()=>{save.muted=!$('mute-check').checked;setSound();persist();};$('quality').onchange=()=>{save.quality=$('quality').value;renderer.quality=save.quality;renderer.resize();persist();};
$('share').onclick=share;$('share-result').onclick=share;
window.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.target?.closest('input,select,dialog'))return;const key=e.key.toLowerCase();if(key==='r')load(route.game,route.index);if(key==='n')nextGame();if(key==='p'||key==='escape'){e.preventDefault();setPaused(!paused);}if(key==='m')toggleSound();});
window.addEventListener('popstate',()=>{const q=validRoute(location.search);load(q.game,q.index,false);});
window.addEventListener('resize',()=>{placeHint();input?.cancel();renderer?.resize();last=performance.now();acc=0;});
new ResizeObserver(()=>renderer?.resize()).observe(canvas);
document.addEventListener('visibilitychange',()=>{if(document.hidden){hiddenPause=!paused;setPaused(true,true);}last=performance.now();acc=0;});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();setPaused(true);toast('Графика временно недоступна. Игра остановлена.');});
canvas.addEventListener('webglcontextrestored',()=>{try{current?.dispose();renderer?.dispose();renderer=new Renderer(canvas,$('world-labels'));renderer.quality=save.quality;fatal=false;load(route.game,route.index);toast('Графика восстановлена. Эпизод начат заново.');}catch(e){fail(e);}});
// Observation only: no win setter, economy mutation, teleport, or hidden auto-play.
window.__PLAY_AD__=Object.freeze({snapshot:()=>({route:{...route},paused,frame,game:current?.snapshot(),render:{instances:renderer?.instanceCount,drawCalls:renderer?.drawCalls,meshes:renderer?.meshes.size,labels:renderer?.labelNodes.size,width:canvas.width,height:canvas.height,quality:renderer?.quality,renderer:renderer?.gl.getParameter(renderer.gl.RENDERER)},timings:[...measurements],errors:[...errors],storage:structuredClone(save)}),project:p=>renderer.project(p)});
