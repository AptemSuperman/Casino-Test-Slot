import { Game } from '../core/runtime.js';
import { clamp, lerp, hypot } from '../core/math.js';
import { PIN_NAMES } from '../levels.js';

const FLUIDS=['water','lava','gold'];
const COLORS={water:'#67bdd8',lava:'#eb7652',gold:'#edbd58',rock:'#9daaa6'};
const room=(id,x,y,contents={},extra={})=>({id,x,y,w:2.1,h:1.5,contents:{water:0,lava:0,gold:0,rock:0,...contents},...extra});
function pinLevel(index){
  let rooms,links,recipe,negative;
  if(index===0){
    rooms=[room('gold',-2,7.9,{gold:24}),room('lava',2,7.9,{lava:1}),room('hero',0,2.05,{}, {hero:true,w:3.2})];
    links=[['treasure','gold','hero','ЗОЛОТО'],['danger','lava','hero','ЛАВА']];recipe=['treasure'];negative=['danger'];
  } else if(index===1){
    rooms=[room('water',-2.1,8.7,{water:1}),room('gold',2.1,8.7,{gold:24}),room('hot',0,5.3,{lava:1}),room('hero',0,1.7,{}, {hero:true,w:3.1})];
    links=[['cool','water','hot','ВОДА'],['gold','gold','hot','ЗОЛОТО'],['out','hot','hero','ВЫХОД']];recipe=['cool','gold','out'];negative=['out'];
  } else if(index===2){
    rooms=[room('gold',-2.4,8.9,{gold:27}),room('hot',0,5.8,{lava:1}),room('waste',3.25,2.8,{}, {waste:true,w:1.8}),room('hero',-1.4,1.65,{}, {hero:true,w:2.8})];
    links=[['drain','hot','waste','СЛИВ'],['gold','gold','hot','ЗОЛОТО'],['out','hot','hero','К ГЕРОЮ']];recipe=['drain','out','gold'];negative=['out'];
  } else if(index===3){
    rooms=[room('water',-2.45,9,{water:2}),room('gold',2.3,9,{gold:30}),room('a',.4,6.35,{lava:1}),room('b',.4,3.75,{lava:1}),room('waste',-3,4.9,{}, {waste:true,w:1.55}),room('hero',.4,1.25,{}, {hero:true,w:2.8})];
    links=[['cool','water','a','ВОДА'],['waste','water','waste','СЛИВ'],['gold','gold','a','ЗОЛОТО'],['down','a','b','НИЖЕ'],['out','b','hero','ВЫХОД']];recipe=['cool','down','gold','out'];negative=['out'];
  } else {
    rooms=[room('water',-2.6,9.2,{water:2}),room('gold',2.45,9.2,{gold:30}),room('a',-2,6.35,{lava:1}),room('vault',2.25,6.35,{}),room('b',.1,3.75,{lava:1}),room('waste',-3.3,1.4,{}, {waste:true,w:1.55}),room('hero',.1,1.25,{}, {hero:true,w:2.8})];
    links=[['water','water','a','ВОДА'],['gold','gold','vault','ЗОЛОТО'],['bridge','vault','a','МОСТ'],['down','a','b','НИЖЕ'],['out','b','hero','К ГЕРОЮ'],['waste','water','waste','СЛИВ'],['side','a','waste','БОКОВОЙ']];
    recipe=['water','down','gold','bridge','out'];negative=['out'];
  }
  const get=id=>rooms.find(r=>r.id===id);
  const edges=links.map(([id,from,to,label],i)=>{
    const a=get(from),b=get(to);let path=[[a.x,a.y-a.h/2],[a.x,a.y-a.h/2-.28],[b.x,b.y+b.h/2+.28],[b.x,b.y+b.h/2]];
    if(index===2&&id==='drain')path=[[a.x+a.w/2,a.y-.35],[3.25,a.y-.35],[b.x,b.y+b.h/2]];
    if(index>=3&&id==='waste')path=[[a.x-a.w/2,a.y-.15],[-4.35,a.y-.15],[-4.35,b.y+.85],[b.x,b.y+.75]];
    if(index===4&&id==='bridge')path=[[a.x-a.w/2,a.y-.35],[b.x+b.w/2,a.y-.35]];
    if(index===4&&id==='side')path=[[a.x-a.w/2,a.y-.25],[-3.35,a.y-.25],[b.x,b.y+.75]];
    // Pins close the exact first outlet of the corresponding trough.
    const p=path[0],n=path[1],ang=Math.atan2(n[1]-p[1],n[0]-p[0]);
    const normal=[-Math.sin(ang),Math.cos(ang)];
    return {id,from,to,label,path,open:false,age:0,order:i,handle:[p[0]+normal[0]*.57,p[1]+normal[1]*.57,.76],normal,exit:p};
  });
  // Separate the two outlets from the hot chamber: lower outlet goes to the hero.
  return {id:'P'+(index+1),name:PIN_NAMES[index],goal:[
    'Доставь золото герою. Опасный штифт можно оставить на месте.',
    'Одна вода охлаждает одну лаву. Сначала сделай путь безопасным.',
    'Уведи лаву в боковой слив. Сокровище должно попасть к герою.',
    'Две лавы, две воды. Не трать запас в пустой слив.',
    'Остуди оба участка, проведи золото через сокровищницу.'][index],rooms,edges,recipe,negative,target:rooms.reduce((a,r)=>a+r.contents.gold,0),stars:[6+index*2,11+index*2]};
}
const sumFlow=c=>FLUIDS.reduce((a,k)=>a+(c[k]||0),0);
function pointOnPath(path,t){const lengths=path.slice(1).map((p,i)=>hypot(p[0]-path[i][0],p[1]-path[i][1]));const total=lengths.reduce((a,b)=>a+b,0)||1;let d=clamp(t,0,1)*total;for(let i=0;i<lengths.length;i++){if(d<=lengths[i]||i===lengths.length-1){const f=lengths[i]?d/lengths[i]:0;return [lerp(path[i][0],path[i+1][0],f),lerp(path[i][1],path[i+1][1],f)];}d-=lengths[i];}return path.at(-1);}
class Pins extends Game {
  constructor(ctx,index){super(ctx,pinLevel(index));this.index=index;this.rooms=this.level.rooms;this.edges=this.level.edges;this.flows=[];this.pulls=0;this.cooled=0;this.burned=0;this.drainGold=0;this.flowSerial=0;this.message='';this.r.hole=[0,0,0];this.r.setCamera({eye:[0,8.2,24],at:[0,5.25,0],width:10.5,height:12.75});}
  room(id){return this.rooms.find(r=>r.id===id);}
  input(type,p){if(type!=='down'||this.result)return;let near=null,dist=Infinity;for(const e of this.edges){if(e.open)continue;const q=this.r.project(e.handle),d=hypot(q.x-p.x,q.y-p.y);if(d<Math.max(19,this.r.width/28)&&d<dist){dist=d;near=e;}}if(near)this.pull(near.id);}
  pull(id){const e=this.edges.find(e=>e.id===id);if(!e||e.open||this.result)return false;this.start();e.open=true;e.age=0;e.order=++this.pulls;this.ctx.sound.play('pin');return true;}
  mix(room){const c=room.contents,k=Math.min(c.water,c.lava);if(k>0){c.water-=k;c.lava-=k;c.rock+=k*2;this.cooled+=k;room.steam=1;this.ctx.sound.play('water');this.particles.burst([room.x,room.y,.3],'#dbe4d8',12,1.6);}
    if(c.lava>0&&c.gold>0){this.burned+=c.gold;c.gold=0;this.finish(false,'Золото попало в лаву. Сначала обезвредь или отведи опасность.','Сокровище потеряно');}
    if(room.hero&&c.lava>0)this.finish(false,'Лава добралась до героя. Сделай путь безопасным до открытия выхода.','Опасный поток');
    if(room.waste&&c.gold>0){this.drainGold+=c.gold;c.gold=0;this.finish(false,'Сокровище ушло в слив. Сначала отдели золото от опасного маршрута.','Неверное направление');}
  }
  update(dt){super.update(dt);for(const e of this.edges)if(e.open)e.age+=dt;for(const r of this.rooms)r.steam=Math.max(0,(r.steam||0)-dt);if(!this.started||this.result)return;
    for(const f of [...this.flows]){f.t+=dt;if(f.t>=f.duration){const dest=this.room(f.to);for(const k of FLUIDS)dest.contents[k]+=f.contents[k];this.flows.splice(this.flows.indexOf(f),1);this.mix(dest);if(dest.contents.gold)this.ctx.sound.play('gold',.6);}}
    if(this.result)return;
    for(const room of this.rooms){if(room.hero||room.waste||sumFlow(room.contents)===0||this.flows.some(f=>f.from===room.id))continue;const outgoing=this.edges.filter(e=>e.from===room.id&&e.open);
      if(!outgoing.length)continue;
      // The lowest physical outlet has precedence; equal-height outlets use first-opened order.
      outgoing.sort((a,b)=>a.exit[1]-b.exit[1]||a.order-b.order);
      const e=outgoing[0],contents={};for(const k of FLUIDS){contents[k]=room.contents[k];room.contents[k]=0;}
      const duration=.65+Math.min(1.1,e.path.slice(1).reduce((s,p,i)=>s+hypot(p[0]-e.path[i][0],p[1]-e.path[i][1]),0)*.13);
      this.flows.push({id:++this.flowSerial,from:e.from,to:e.to,edge:e.id,contents,t:0,duration});this.ctx.sound.play(contents.gold?'gold':'water',.45);
    }
    const hero=this.rooms.find(r=>r.hero);if(hero.contents.gold>=this.level.target&&this.flows.length===0){this.particles.burst([hero.x,hero.y,.5],'#f5ce69',30,2.5);this.finish(true,'Каждый поток на своём месте. Сокровище у героя!',`${this.pulls} ${this.pulls===1?'штифт':this.pulls<5?'штифта':'штифтов'} · ${Math.round(this.time)} с`,this.pulls<=this.level.recipe.length?3:this.pulls<=this.level.recipe.length+1?2:1);}
  }
  visibleContents(room){const c={...room.contents};for(const f of this.flows)if(f.from===room.id)for(const k of FLUIDS)c[k]+=f.contents[k]*Math.max(0,1-f.t/f.duration);return c;}
  hud(){const g=this.rooms.find(r=>r.hero).contents.gold;return {value:String(this.pulls),label:'штифтов',secondary:`Золото ${Math.round(g)}/${this.level.target} · охлаждено ${this.cooled}`,progress:g/this.level.target};}
  render(t){const r=this.r;r.bg=[.77,.78,.70];r.box([0,5.5,-.7],[10.05,11.85,.7],'#a5ac9e');r.box([0,5.5,-.27],[9.7,11.5,.22],'#c4c4aa');
    for(const x of [-4.72,4.72]){r.box([x,5.5,-.05],[.22,11.2,.35],'#efe0bb');r.cyl([x,.15,.06],[.35,.25,.35],'#d9bb84');}
    const line=(a,b,w,d,color,z=.15)=>{let dx=b[0]-a[0],dy=b[1]-a[1],len=hypot(dx,dy);r.box([(a[0]+b[0])/2,(a[1]+b[1])/2,z],[len,w,d],color,[0,0,Math.atan2(dy,dx)]);};
    for(const e of this.edges){for(let i=1;i<e.path.length;i++){line(e.path[i-1],e.path[i],.61,.25,'#b7a984',.05);line(e.path[i-1],e.path[i],.32,.15,'#e9d6ad',.20);}
      if(!e.open||e.age<.45){let lift=e.open?clamp(e.age/.45,0,1)*1.4:0;const n=e.normal,px=e.exit[0]+n[0]*lift,py=e.exit[1]+n[1]*lift;const a=[px-n[0]*.42,py-n[1]*.42],b=[px+n[0]*.42,py+n[1]*.42];line(a,b,.13,.18,'#eec36b',.64);r.ring([e.handle[0]+n[0]*lift,e.handle[1]+n[1]*lift,.76],[.39,.35,.39],'#f5d483',[Math.PI/2,0,0],1);if(!e.open)r.label('pin'+e.id,e.label,[e.handle[0],e.handle[1]-.28,.95],'pin-name');}
    }
    for(const room of this.rooms){const c=this.visibleContents(room),bottom=room.y-room.h/2;
      r.box([room.x,room.y,-.04],[room.w,room.h,.27],room.hero?'#a0b9a3':room.waste?'#879993':'#d3c6a5');
      r.box([room.x,bottom-.07,.2],[room.w+.16,.18,.6],'#f1ddb0');
      for(const x of [-1,1])r.box([room.x+x*room.w/2,room.y,.2],[.16,room.h,.6],'#ecd9b3');
      if(c.rock>0)for(let j=0;j<Math.min(8,c.rock*3);j++)r.box([room.x+(j%4-1.5)*.35,bottom+.14+Math.floor(j/4)*.12,.3],[.32,.23,.4],'#899b99',[0,.08*j,j*.06]);
      for(const k of ['water','lava'])if(c[k]>.001){let h=clamp(c[k]*.38,.06,1.16);r.box([room.x,bottom+h/2+.09,.34],[room.w-.18,h,.38],COLORS[k],[0,0,0],k==='lava'?2:1);for(let j=0;j<5;j++)r.sphere([room.x+(j-2)*.32,bottom+h+.11+Math.sin(t*2+j)*.016,.35],[.27,.037,.21],k==='lava'?'#ffb665':'#c0e7ea');r.label(room.id+'-amount',`${Math.ceil(c[k])} ${k==='water'?'ВОДА':'ЛАВА'}`,[room.x,room.y+.37,.7],k==='lava'?'warning':'small');}
      for(let j=0;j<Math.floor(c.gold);j++)r.cyl([room.x+(j%6-2.5)*.26,bottom+.15+Math.floor(j/6)*.10,.30+(j%2)*.14],[.25,.085,.25],j%3?'#efc363':'#ffe1a2',[0,j,0],1);
      if(room.hero){r.draw('figure',[room.x,room.y-.15,.67],[1.7,1.7,1.7],'#70a795',[0,Math.PI,0]);r.draw('cone',[room.x,room.y+1.0,.67],[.75,.40,.65],'#f0c86d');r.label('hero','СОКРОВИЩЕ СЮДА',[room.x,bottom-.4,.6],'small');}
      if(room.waste)r.label('waste'+room.id,'ПУСТОЙ СЛИВ',[room.x,bottom-.35,.6],'small');
      if(room.steam>0)for(let j=0;j<4;j++)r.sphere([room.x+(j-1.5)*.25,room.y+room.steam*.7+j*.15,.6],[.16,.28,.16],'#dde3d6');
    }
    for(const f of this.flows){const e=this.edges.find(e=>e.id===f.edge),a=clamp(f.t/f.duration,0,1),color=f.contents.lava?'#ee8654':f.contents.water?'#80ccdf':'#f4c756';
      const lo=Math.max(0,a-.32),hi=a;
      for(let j=0;j<14;j++){const aa=lo+(hi-lo)*j/14,bb=lo+(hi-lo)*(j+1)/14,p=pointOnPath(e.path,aa),q=pointOnPath(e.path,bb);line(p,q,.20,.17,color,.43);}
      if(f.contents.gold)for(let j=0;j<Math.min(f.contents.gold,18);j++){const k=clamp(a-j*.014,0,1),p=pointOnPath(e.path,k);r.cyl([p[0]+Math.sin(j*2)*.09,p[1],.59],[.22,.06,.22],'#f7cf70',[t*5+j,0,0],1);}
    }
    this.particles.render(r);
  }
  snapshot(){return {...super.snapshot(),pulls:this.pulls,cooled:this.cooled,burned:this.burned,drainGold:this.drainGold,rooms:this.rooms.map(q=>({id:q.id,hero:!!q.hero,waste:!!q.waste,contents:{...q.contents}})),edges:this.edges.map(e=>({id:e.id,from:e.from,to:e.to,open:e.open,point:this.r.project(e.handle)})),flows:this.flows.map(f=>({from:f.from,to:f.to,contents:{...f.contents},progress:f.t/f.duration}))};}
}
export { Pins, pinLevel, pointOnPath, FLUIDS };
