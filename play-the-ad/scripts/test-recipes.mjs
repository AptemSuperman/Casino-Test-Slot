import fs from 'node:fs';
import assert from 'node:assert/strict';
import { Crowd } from '../src/games/crowd.js';
import { Hole } from '../src/games/hole.js';
import { Pins } from '../src/games/pins.js';
import { Screws,solveScrews } from '../src/games/screws.js';
import { Wreck } from '../src/games/wreck.js';
import { distanceSegment } from '../src/core/geometry.js';
import { context,tick } from '../tests/harness.mjs';
const constructors={crowd:Crowd,hole:Hole,pins:Pins,screws:Screws,wreck:Wreck};
const recipes={crowd:[[[ -2.2,5]],[[ -2.2,5.4],[2.2,5.4]],[[2,8.0]],[[-2.2,6.7]],[[-2.7,5],[2.7,4.5],[0,6]]],wreck:[[17,3.1],[10,18],[17,3.1],[5,2],[10,18]],pins:[],screws:[]};
function holeTarget(g){const choices=g.objects.filter(o=>o.state==='live'&&!o.protected&&o.need<=g.radius).map(o=>({o,d:Math.hypot(o.x-g.x,o.z-g.z)})).sort((a,b)=>a.d-b.d);return choices.find(({o})=>!g.objects.some(p=>p.protected&&distanceSegment([p.x,p.z],[g.x,g.z],[o.x,o.z])<g.radius+.20))?.o;}
function holePlay(g,jitter=0){g.input('down',{x:0,y:0});let stuck=0;for(let j=0;j<7200&&!g.result;j++){const t=holeTarget(g);if(t){let dx=t.x-g.x+jitter*Math.sin(j/21),dz=t.z-g.z+jitter*Math.cos(j/19),n=Math.hypot(dx,dz);g.input('move',{x:dx/Math.max(n,.7)*55,y:dz/Math.max(n,.7)*55});stuck=0;}else{g.input('move',{x:0,y:0});if(++stuck>180)break;}g.update(1/60);}g.input('up',{});}
const results=[];
for(const [name,Constructor] of Object.entries(constructors))for(let index=0;index<5;index++){
 const g=new Constructor(context(),index);const idle=new Constructor(context(),index);tick(idle,60);assert.equal(idle.result,null);assert.equal(idle.time,0);assert.equal(idle.started,false);
 let scenario;
 if(name==='crowd'){scenario=recipes.crowd[index];for(const [x,duration] of scenario){g.input('down',{x,y:5});tick(g,duration);g.input('up',{});}tick(g,15);}
 if(name==='hole'){scenario='Nearest fitting item, safe straight segments around shields, bounded relative joystick';holePlay(g);}
 if(name==='pins'){scenario=[...g.level.recipe];recipes.pins.push(scenario);for(const id of scenario){const e=g.level.edges.find(e=>e.id===id),q=g.r.project(e.handle);g.input('down',q);g.input('up',q);tick(g,3.6);}tick(g,10);}
 if(name==='screws'){scenario=solveScrews(g.level).solution;assert.ok(scenario);recipes.screws.push(scenario);for(const id of scenario){const b=g.level.bolts.find(b=>b.id===id);g.input('down',g.r.project([b.x,b.y,1.18+b.layer*.31]));g.input('up',{});tick(g,1);}tick(g,3);}
 if(name==='wreck'){scenario=recipes.wreck[index];g.input('down',{x:0,y:4.5});g.input('move',{x:-scenario[0]/5.5,y:4.5-scenario[1]/5.5});g.input('up',{});tick(g,10);}
 assert.equal(g.result?.win,true,`${g.level.id}: ${JSON.stringify(g.snapshot())}`);
 assert.equal(g.result.stars,3,`${g.level.id} best rating must have an actually tested route`);
 let negative=new Constructor(context(),index),negativeScenario='60 s idle: no automatic victory';let negativePassed=true;
 if(name==='crowd'){negativeScenario='Fire all source charges outside multiplier lanes';negative.input('down',{x:index===2?-.7:index===4?3.85:0,y:5});tick(negative,70);negative.input('up',{});tick(negative,15);negativePassed=negative.result?.win===false;}
 if(name==='hole'){negativeScenario='Start without moving; time limit expires';negative.input('down',{x:0,y:0});tick(negative,negative.level.limit+1);negativePassed=negative.result?.win===false;}
 if(name==='pins'){negativeScenario='Open dangerous outlet '+negative.level.negative[0];for(const id of negative.level.negative){const e=negative.edges.find(e=>e.id===id);negative.input('down',negative.r.project(e.handle));tick(negative,4);}negativePassed=negative.result?.win===false;}
 if(name==='screws'&&index===3){negativeScenario='Take gold/violet before matching boxes: b0,b1,b2,b3';for(const id of ['b0','b1','b2','b3']){const b=negative.level.bolts.find(b=>b.id===id);negative.input('down',negative.r.project([b.x,b.y,1.18+b.layer*.31]));tick(negative,1);}negativePassed=negative.result?.win===false;}
 if(name==='wreck'){negativeScenario='Spend three shots pointing away from all targets';for(let k=0;k<3;k++){negative.input('down',{x:0,y:4.5});negative.input('move',{x:8/5.5,y:4.5-4/5.5});negative.input('up',{});tick(negative,2);}tick(negative,12);negativePassed=negative.result?.win===false;}
 assert.equal(negativePassed,true,`${g.level.id} negative scenario`);
 let tolerance=[];
 if(name==='crowd')for(const dx of [-.15,.15]){const q=new Constructor(context(),index);for(const [x,d] of scenario){q.input('down',{x:x+dx,y:5});tick(q,d+.1);q.input('up',{});}tick(q,15);assert.equal(q.result?.win,true);tolerance.push({horizontalOffset:dx,holdOffset:.1,win:q.result.win});}
 if(name==='hole')for(const jitter of [-.1,.1]){const q=new Constructor(context(),index);holePlay(q,jitter);assert.equal(q.result?.win,true);tolerance.push({steeringNoise:jitter,win:q.result.win,time:q.result.time});}
 if(name==='wreck')for(const dx of [-.3,0,.3])for(const dy of [-.3,0,.3]){const q=new Constructor(context(),index);q.fire([scenario[0]+dx,scenario[1]+dy]);tick(q,10);assert.equal(q.result?.win,true);tolerance.push({velocityOffset:[dx,dy],win:q.result.win,reflectorHits:q.reflectorHits});}
 const record={id:g.level.id,game:name,index,scenario,expected:'win; three attainable stars',actual:g.result,negative:{scenario:negativeScenario,passed:negativePassed,actual:negative.result||'No spontaneous win'},idle:{seconds:60,passed:true},tolerance};
 if(name==='wreck')record.reflectorHits=g.reflectorHits;
 results.push(record);console.log(`${g.level.id}: WIN ${g.result.stars} stars | negative OK | ${g.result.metric}`);
 g.dispose();idle.dispose();negative.dispose();
}
fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync('artifacts/recipes.json',JSON.stringify(recipes,null,2)+'\n');fs.writeFileSync('artifacts/logic-results.json',JSON.stringify({simulation:'1/60 s, original rules and public input; no win or resource setters',results},null,2)+'\n');console.log('PASS: all 25 level solutions, negative scenarios, attainable stars and tolerance checks.');
export {recipes,holeTarget,holePlay};
