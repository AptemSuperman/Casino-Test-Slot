import { Game } from '../core/runtime.js';
import { clamp, smooth, hypot } from '../core/math.js';
import { capsulePlateGeometry, distanceSegment } from '../core/geometry.js';
import { SCREW_NAMES } from '../levels.js';
const SCREW_COLORS={mint:'#65b8aa',coral:'#e88c84',gold:'#e5b559',violet:'#a596cc'};
const COLOR_NAMES={mint:'МЯТА',coral:'КОРАЛЛ',gold:'МЁД',violet:'СИРЕНЬ'};
function screwLevel(index){
 let data,queue;
 if(index===0){data=[[[0,2.6],[0,5.6],0,'mint','coral'],[[-2,6.6],[2,6.6],1,'mint','coral'],[[-1.2,5.05],[1.2,8.15],2,'coral','mint']];queue=['mint','coral'];}
 else if(index===1){data=[[[ -2.5,4],[2.5,4],0,'gold','gold'],[[-2.5,7],[2.5,7],0,'violet','violet'],[[-2.5,4],[-2.5,7],1,'mint','mint'],[[2.5,4],[2.5,7],1,'coral','coral'],[[-2.5,7],[0,8.4],2,'mint','gold'],[[2.5,7],[0,8.4],3,'coral','violet']];queue=['mint','coral','gold','violet'];}
 else if(index===2){data=[[[ -2.4,5],[0,5],0,'mint','coral'],[[0,2.2],[0,5],1,'mint','coral'],[[-2.4,5],[2.4,5],2,'coral','mint']];queue=['mint','coral'];}
 else if(index===3){data=[[[ -3,8],[-1,8],2,'gold','violet'],[[1,8],[3,8],2,'gold','violet'],[[-3,6],[-1,6],1,'gold','violet'],[[1,6],[3,6],1,'mint','mint'],[[-3,4],[-1,4],0,'mint','coral'],[[1,4],[3,4],0,'coral','coral'],[[-2,2.2],[0,2.2],0,'mint','mint'],[[0,2.2],[2,2.2],1,'mint','coral'],[[-.7,5],[.7,5],3,'coral','coral']];queue=['mint','coral','gold','violet','mint','coral'];}
 else {data=[[[ -.7,6.55],[-3,8.4],0,'gold','mint'],[[.7,6.55],[3,8.4],0,'violet','coral'],[[-.7,4.95],[-3,3.6],0,'gold','coral'],[[.7,4.95],[3,3.6],0,'violet','mint'],[[-3,8.4],[-3.2,5.8],1,'gold','mint'],[[3,8.4],[3.2,5.8],1,'violet','coral'],[[-3,3.6],[0,2.8],2,'mint','coral'],[[3,3.6],[0,2.8],3,'mint','coral'],[[0,4.6],[0,8.1],4,'mint','coral']];queue=['mint','coral','gold','violet','mint','coral'];}
 let bolts=[];
 const plates=data.map(([a,b,layer,c1,c2],i)=>{const id='plate'+i,ids=['b'+(i*2),'b'+(i*2+1)];bolts.push({id:ids[0],x:a[0],y:a[1],plate:id,layer,color:c1},{id:ids[1],x:b[0],y:b[1],plate:id,layer,color:c2});return {id,a,b,layer,bolts:ids,color:['#dfa17f','#96bcb6','#b7a0cf','#e5bb6c'][i%4],length:hypot(a[0]-b[0],a[1]-b[1]),radius:.59,wing:index===4&&i<4};});
 return {id:'S'+(index+1),name:SCREW_NAMES[index],goal:[
 'Собирай цветные тройки и освободи леденец.',
 'Верхние детали скрывают нижние болты. Освободи всю конструкцию.',
 'Последняя опора — шарнир. Поверни пластину и открой скрытые болты.',
 'В лотке только три места. Сначала посмотри на цвета коробок.',
 'Освободи крылья механической бабочки. Коробки собирают по три.'][index],plates,bolts,queue,bufferCapacity:3,stars:index===1||index===4?[2,3]:[0,2]};
}
function platePose(plate,removed,amount=1){
 const live=plate.bolts.filter(id=>!removed.has(id));let a=[...plate.a],b=[...plate.b],angle=0;
 if(live.length===1){const fixed=live[0]===plate.bolts[0]?plate.a:plate.b;const other=live[0]===plate.bolts[0]?plate.b:plate.a;const sign=other[0]>=fixed[0]?-1:1;angle=sign*.90*amount;const turn=p=>{let x=p[0]-fixed[0],y=p[1]-fixed[1];return [fixed[0]+x*Math.cos(angle)-y*Math.sin(angle),fixed[1]+x*Math.sin(angle)+y*Math.cos(angle)];};a=turn(a);b=turn(b);}
 return {a,b,live:live.length,angle};
}
function boltAccessible(bolt,level,removed,poses=null){if(removed.has(bolt.id))return false;for(const p of level.plates){if(p.id===bolt.plate||p.layer<=bolt.layer)continue;const pose=poses?.get(p.id)||platePose(p,removed);if(pose.live&&distanceSegment([bolt.x,bolt.y],pose.a,pose.b)<p.radius+.12)return false;}return true;}
function newSortState(queue){return {queue:[...queue],next:2,boxes:queue.slice(0,2).map(color=>({color,count:0})),buffer:[],completed:0,peak:0};}
function sortBolt(state,color,capacity=3){
 let found=state.boxes.find(b=>b.color===color);if(found)found.count++;else state.buffer.push(color);
 let changes=true,guard=0;
 while(changes&&guard++<80){changes=false;
  for(const box of state.boxes)if(box.count===3){state.completed++;box.color=state.queue[state.next++]||null;box.count=0;changes=true;}
  for(let i=0;i<state.buffer.length;i++){let b=state.boxes.find(b=>b.color===state.buffer[i]&&b.count<3);if(b){b.count++;state.buffer.splice(i--,1);changes=true;}}
 }
 state.peak=Math.max(state.peak,state.buffer.length);return state.buffer.length<=capacity;
}
function solveScrews(level,maxNodes=500000){
 const seen=new Set();let count=0;
 function visit(removed,sort,path){if(++count>maxNodes)return null;if(removed.size===level.bolts.length)return path;
   const key=[...removed].sort().join(',')+'|'+sort.next+'|'+sort.boxes.map(b=>b.color+':'+b.count).join(',')+'|'+sort.buffer.slice().sort().join(',');if(seen.has(key))return null;seen.add(key);
   const candidates=level.bolts.filter(b=>boltAccessible(b,level,removed)).sort((a,b)=>(+!sort.boxes.some(x=>x.color===a.color))-(+!sort.boxes.some(x=>x.color===b.color))||b.layer-a.layer);
   for(const b of candidates){const next=structuredClone(sort);if(!sortBolt(next,b.color,level.bufferCapacity))continue;const rem=new Set(removed);rem.add(b.id);const answer=visit(rem,next,[...path,b.id]);if(answer)return answer;}return null;
 }
 const solution=visit(new Set(),newSortState(level.queue),[]);return {solution,nodes:count};
}
class Screws extends Game {
 constructor(ctx,index){super(ctx,screwLevel(index));this.index=index;this.removed=new Set();this.sort=newSortState(this.level.queue);this.animations=[];this.plateTimes=new Map();this.poses=new Map();this.meshNames=[];this.lastMove=0;this.waitWin=0;
 this.r.hole=[0,0,0];this.r.setCamera({eye:[0,9,24],at:[0,5.8,0],width:10.6,height:13.25});
 for(const p of this.level.plates){let name='plate-'+p.id+'-'+this.level.id;this.r.addMesh(name,capsulePlateGeometry(p.length,p.radius,.24,.205,p.wing?.48:0));p.mesh=name;this.meshNames.push(name);}this.refreshPoses();}
 refreshPoses(){for(const p of this.level.plates){const age=this.time-(this.plateTimes.get(p.id)??-100);this.poses.set(p.id,platePose(p,this.removed,smooth(age/.65)));}}
 accessible(b){return boltAccessible(b,this.level,this.removed,this.poses);}
 input(type,p){if(type!=='down'||this.result)return;let found=null,best=Infinity;for(const b of this.level.bolts){if(!this.accessible(b))continue;const q=this.r.project([b.x,b.y,1.18+b.layer*.31]),d=hypot(q.x-p.x,q.y-p.y);if(d<Math.max(17,this.r.width/30)&&d<best){found=b;best=d;}}if(found)this.remove(found.id);}
 remove(id){const b=this.level.bolts.find(b=>b.id===id);if(!b||!this.accessible(b)||this.result)return false;this.start();this.removed.add(id);this.lastMove=this.time;this.plateTimes.set(b.plate,this.time);const good=sortBolt(this.sort,b.color,this.level.bufferCapacity);this.animations.push({bolt:b,t:0,from:[b.x,b.y,1.2+b.layer*.31]});this.ctx.sound.play('screw');this.refreshPoses();if(!good)this.finish(false,'Лоток переполнен. Сначала освободи цвета действующих коробок.','Четвёртый болт в лотке');return true;}
 update(dt){super.update(dt);this.refreshPoses();for(const a of this.animations)a.t+=dt;this.animations=this.animations.filter(a=>a.t<.85);if(!this.started||this.result)return;
 if(this.removed.size===this.level.bolts.length&&this.sort.buffer.length===0){this.waitWin+=dt;if(this.waitWin>.85){this.ctx.sound.play('metal');this.particles.burst([0,4,1],'#f1cf86',28,3);this.finish(true,this.index===4?'Крылья свободны. Бабочка разобрана красиво!':'Последняя деталь свободна. Идеальная разборка!',`Пик лотка ${this.sort.peak}/3 · ${this.removed.size} болтов`,this.sort.peak<=this.level.stars[0]?3:this.sort.peak<=this.level.stars[1]?2:1);}}
 }
 hud(){return {value:String(this.level.bolts.length-this.removed.size),label:'болтов',secondary:`Коробки ${this.sort.completed}/${this.level.queue.length} · лоток ${this.sort.buffer.length}/3`,progress:this.removed.size/this.level.bolts.length};}
 renderBolt(r,b,p,scale=1,angle=0){const c=SCREW_COLORS[b.color];r.cyl([p[0],p[1],p[2]-.10],[.20*scale,.38*scale,.20*scale],'#c5cbd0',[Math.PI/2,0,0],1);r.cyl(p,[.49*scale,.15*scale,.49*scale],c,[Math.PI/2,0,angle],1);r.ring([p[0],p[1],p[2]+.08],[.36*scale,.1*scale,.36*scale],'#f1e4cf',[Math.PI/2,0,angle],1);
 r.box([p[0],p[1],p[2]+.091],[.28*scale,.061*scale,.012],'#53616b',[0,0,angle]);r.box([p[0],p[1],p[2]+.092],[.061*scale,.22*scale,.012],'#53616b',[0,0,angle]);}
 render(t){const r=this.r;r.bg=[.76,.76,.82];r.box([0,5.25,-.65],[9.8,10.5,.7],'#aaa6b8');r.box([0,5.25,-.19],[9.45,10.16,.27],'#e7d9c1');
 for(const x of [-4.4,4.4])for(const y of [.65,9.8]){r.cyl([x,y,.0],[.2,.07,.2],'#bba782',[Math.PI/2,0,0],1);r.box([x,y,.047],[.13,.03,.01],'#89765e');}
 if(this.index===0){r.ring([0,6.4,-.0],[5.4,.08,5.4],'#d8c3d3',[Math.PI/2,0,0]);}
 if(this.index===4){for(const s of [-1,1])r.sphere([s*.5,8.4,.15],[.42,.65,.3],'#ba9d76',[0,0,s*.5]);}
 // Actual three-slot boxes and bounded overflow tray, outside the mechanical figure.
 for(let i=0;i<2;i++){const b=this.sort.boxes[i],x=i?2.1:-2.1,c=SCREW_COLORS[b.color]||'#a9adba';r.box([x,10.55,.25],[3.4,1.05,.5],c);r.box([x,10.55,.55],[3.0,.7,.1],'#e5ded5');for(let j=0;j<3;j++){r.cyl([x+(j-1)*.80,10.50,.66],[.57,.08,.57],'#afb6b6',[Math.PI/2,0,0]);if(j<b.count)this.renderBolt(r,{color:b.color},[x+(j-1)*.80,10.5,.74],.8);}r.label('box'+i,b.color?COLOR_NAMES[b.color]:'СОБРАНО',[x,11.0,.7],'box-label');}
 r.box([0,.0,.35],[3.25,.60,.35],'#a1a2b1');for(let j=0;j<3;j++){r.cyl([(j-1)*.88,.0,.60],[.57,.10,.57],'#7e8698',[Math.PI/2,0,0]);if(this.sort.buffer[j])this.renderBolt(r,{color:this.sort.buffer[j]},[(j-1)*.88,.0,.71],.85);}r.label('tray','ЛОТОК · 3 МЕСТА',[0,-.52,.5],'small');
 const sorted=[...this.level.plates].sort((a,b)=>a.layer-b.layer);
 for(const p of sorted){const pose=this.poses.get(p.id),age=this.time-(this.plateTimes.get(p.id)??-100);let a=pose.a,b=pose.b,x=(a[0]+b[0])/2,y=(a[1]+b[1])/2,z=.64+p.layer*.31,ang=Math.atan2(b[1]-a[1],b[0]-a[0]);if(!pose.live){if(age>2.4)continue;y-=4.5*age*age;ang+=age*(p.layer%2?1:-1);z+=age*.3;}r.draw(p.mesh,[x,y,z],[1,1,1],p.color,[0,0,ang],1);
 // Fine engraved stripe follows the actual moving plate, not a static sprite.
 if(p.length>2)r.box([x,y,z+.13],[Math.max(.1,p.length-1.0),.055,.01],'#f2e2cb',[0,0,ang]);
 }
 for(const b of this.level.bolts){if(this.removed.has(b.id))continue;this.renderBolt(r,b,[b.x,b.y,1.0+b.layer*.31]);}
 for(const a of this.animations){let k=clamp(a.t/.85,0,1),bx=this.sort.boxes.findIndex(b=>b.color===a.bolt.color),dest=[bx===0?-2.1:bx===1?2.1:0,bx<0?0:10.5,1.25],q=k<.35?0:smooth((k-.35)/.65),p=a.from.map((x,i)=>x+(dest[i]-x)*q);p[2]+=Math.sin(k*Math.PI)*1.2;this.renderBolt(r,a.bolt,p,1-k*.2,k*16);}
 this.particles.render(r);
 }
 snapshot(){return {...super.snapshot(),removed:[...this.removed],sort:structuredClone(this.sort),bolts:this.level.bolts.map(b=>({...b,removed:this.removed.has(b.id),available:this.accessible(b),point:this.r.project([b.x,b.y,1.15+b.layer*.31])})),plates:this.level.plates.map(p=>({id:p.id,...this.poses.get(p.id)}))};}
 dispose(){for(const name of this.meshNames)this.r.removeMesh(name);super.dispose();}
}
export { Screws, screwLevel, solveScrews, boltAccessible, platePose, newSortState, sortBolt, SCREW_COLORS };
