import { Game } from '../core/runtime.js';
import { clamp, hypot } from '../core/math.js';
import { PhysicsWorld, forecast } from '../core/physics2d.js';
import { WRECK_NAMES } from '../levels.js';
function wreckLevel(index){
 const items=[{id:'floor',x:0,y:-.27,w:14.2,h:.50,static:true,color:'#e5d7bd'}];let serial=0;
 const put=(x,y,w,h,extra={})=>{const q={id:'r'+serial++,x,y,w,h,color:'#e4a58e',...extra};items.push(q);return q;};
 const tower=(x,{floors=2,protect=false,scale=1}={})=>{
   put(x,.52,.48*scale,1.04,{mass:.55,support:true,protected:protect,color:protect?'#86b9a7':'#ebc570'});
   let y=1.18;
   for(let k=0;k<floors;k++){
     put(x,y,2.25*scale,.25,{target:!protect,protected:protect,mass:1.15,color:protect?'#aacbb8':'#e7b4a1',beam:true});
     for(const s of [-1,1])put(x+s*.78*scale,y+.66,.28*scale,1.07,{mass:.65,target:!protect,protected:protect,color:protect?'#8dbba8':'#d58f86',window:true});
     y+=1.31;
   }
   put(x,y,2.5*scale,.28,{mass:1.2,target:!protect,protected:protect,color:protect?'#b4ceb1':'#edd0a7',roof:true});
 };
 if(index===0)tower(1.25,{floors:2});
 if(index===1){tower(2.35,{floors:2});put(-1.65,1.36,.40,2.72,{static:true,color:'#93acbb',barrier:true});put(-2.15,6.25,4.0,.25,{static:true,reflector:true,angle:.08,color:'#e6c56d'});}
 if(index===2){for(let j=0;j<7;j++)put(-1.4+j*.91,1.22,.25,2.44,{mass:1.0,domino:true,target:j===2||j===6,color:j===2||j===6?'#d89289':'#a9bba8'});}
 if(index===3){tower(.45,{floors:2});tower(4.6,{floors:1,protect:true,scale:.65});put(3.35,1.0,.4,2.0,{static:true,color:'#acb7b3',barrier:true});}
 if(index===4){tower(.40,{floors:2,scale:.80});tower(3.6,{floors:2,scale:.80});put(-1.6,1.20,.36,2.4,{static:true,color:'#9fb5c1',barrier:true});put(-2.2,6.55,4.0,.25,{static:true,reflector:true,angle:.08,color:'#edce77'});put(2.0,1.50,.23,3.0,{mass:1.1,domino:true,color:'#e5c99b'});}
 return {id:'R'+(index+1),name:WRECK_NAMES[index],goal:[
 'Попади в золотую опору. Пусть вес конструкции сделает остальное.',
 'Стена закрывает низ. Используй верхний отражатель и разрушь башню.',
 'Запусти домино: две отмеченные цели должны упасть.',
 'Разрушь розовую башню. Соседи со щитом должны уцелеть.',
 'Две башни, отражатель, цепная реакция. Найди свой идеальный развал.'][index],items,shots:3,origin:[-4.9,.85],stars:[1,2],targetCount:items.filter(b=>b.target).length};
}
class Wreck extends Game {
 constructor(ctx,index){super(ctx,wreckLevel(index));this.index=index;this.world=new PhysicsWorld(this.level.items);this.ammo=this.level.shots;this.used=0;this.drag=null;this.aim=[17,3.1];this.sinceShot=0;this.afterWin=0;this.hitEvents=0;this.reflectorHits=0;this.r.hole=[0,0,0];this.r.setCamera({eye:[0,7.5,24],at:[0,3.7,0],width:12.7,height:10.2});}
 input(type,p){if(this.result)return;
 if(type==='down'){this.start();const q=this.r.unproject(p.x,p.y,'front',0);this.drag={x:q.x,y:q.y,moved:false};}
 if(type==='move'&&this.drag){const q=this.r.unproject(p.x,p.y,'front',0);let vx=(this.drag.x-q.x)*5.5,vy=(this.drag.y-q.y)*5.5;const n=hypot(vx,vy);if(n>24){vx*=24/n;vy*=24/n;}this.aim=[vx,vy];this.drag.moved=n>.5;}
 if(type==='up'&&this.drag){const moved=this.drag.moved;this.drag=null;if(moved&&hypot(...this.aim)>=4)this.fire(this.aim);}
 if(type==='cancel')this.drag=null;
 }
 fire(velocity){if(this.result||this.ammo<=0)return false;this.start();let [vx,vy]=velocity;const n=hypot(vx,vy);if(n<4||!Number.isFinite(n))return false;if(n>24){vx*=24/n;vy*=24/n;}const ball=this.world.addBall(...this.level.origin,vx,vy);ball.born=this.world.time;this.ammo--;this.used++;this.sinceShot=0;this.ctx.sound.play('shot');return true;}
 update(dt){super.update(dt);if(!this.started||this.result)return;this.sinceShot+=dt;
 for(let j=0;j<4;j++){this.world.step(dt/4);for(const e of this.world.events){if(this.world.items.some(b=>b.reflector&&(b.id===e.a||b.id===e.b)))this.reflectorHits++;if(e.impulse>3){this.hitEvents++;this.ctx.sound.play('impact',Math.min(1,e.impulse/15));if(this.hitEvents%3===0)this.particles.burst([e.x,e.y,.25],'#dccc9f',4,1.2);}}}
 const targets=this.world.items.filter(b=>b.target),damaged=targets.filter(b=>b.damaged).length;
 const bad=this.world.items.filter(b=>b.protected&&b.damaged).length;
 if(bad>0){this.finish(false,'Обломки задели соседей со щитом. Уменьши силу или измени угол.','Защищённая конструкция');return;}
 if(damaged===this.level.targetCount){this.afterWin+=dt;if(this.afterWin>.85)this.finish(true,this.index===4?'Отражение, опоры, обломки — идеальный каскад!':'Один точный удар. Большое красивое падение.',`${this.used} ${this.used===1?'шар':'шара'} · ${damaged} деталей`,this.used<=this.level.stars[0]?3:this.used<=this.level.stars[1]?2:1);}
 else if(this.ammo===0&&this.sinceShot>9)this.finish(false,'Шары закончились. Целься в опоры или запускай цепную реакцию.',`${damaged}/${this.level.targetCount} деталей`);
 }
 hud(){const n=this.world.items.filter(b=>b.target&&b.damaged).length;return {value:String(this.ammo),label:'шара',secondary:`Упало ${n}/${this.level.targetCount} · выстрелов ${this.used}`,progress:n/this.level.targetCount};}
 render(t){const r=this.r;r.bg=[.76,.81,.83];r.box([0,4.25,-1.0],[14.65,11.6,.65],'#a5bac0');r.box([0,4.25,-.55],[14.3,11.25,.3],'#c9d1d0');r.box([0,-.55,.3],[14.55,.35,1.6],'#acbabc');
 for(const side of [-1,1])r.box([side*7.08,4.3,-.19],[.16,10.9,.5],'#e2d9c4');
 // Cannon faces along the physical launch direction.
 const [ox,oy]=this.level.origin,angle=Math.atan2(this.aim[1],this.aim[0]);r.cyl([ox,.16,.65],[1.15,.22,.75],'#477b8c');r.sphere([ox,.49,.65],[.77,.63,.7],'#709caf');r.cyl([ox+Math.cos(angle)*.27,.59+Math.sin(angle)*.27,.65],[.53,1.0,.53],'#608e9f',[0,0,angle-Math.PI/2]);r.cyl([ox+Math.cos(angle)*.73,.59+Math.sin(angle)*.73,.65],[.47,.08,.47],'#e6d2a2',[0,0,angle-Math.PI/2]);
 for(const b of this.world.items){if(b.ball){r.sphere([b.x,b.y,.43],[b.radius*2,b.radius*2,b.radius*2],'#41778d', [b.angle,0,0],1);r.ring([b.x,b.y,.46],[b.radius*2.05,.08,b.radius*2.05],'#e9d398',[Math.PI/2,0,b.angle],1);continue;}
   const z=b.reflector?.14:.18,depth=b.reflector?.65:b.static?.8:.72;
   r.box([b.x,b.y,z],[b.w,b.h,depth],b.color,[0,0,b.angle],b.reflector?1:0);
   const decoration=(dx,dy,w,h,c,zz=.56)=>{let x=b.x+dx*Math.cos(b.angle)-dy*Math.sin(b.angle),y=b.y+dx*Math.sin(b.angle)+dy*Math.cos(b.angle);r.box([x,y,zz],[w,h,.045],c,[0,0,b.angle]);};
   if(b.window){decoration(0,0,b.w*.51,b.h*.64,b.protected?'#487c77':'#a96570');decoration(0,-b.h*.39,b.w*.8,.065,'#f4dfb8');}
   if(b.beam)decoration(0,0,b.w*.96,.075,'#f3d4b3');
   if(b.roof)for(let j=0;j<4;j++)decoration((j-1.5)*b.w/4,b.h/2+.10,b.w/5,.23,'#f4dfb9');
   if(b.support&&!b.damaged){decoration(0,0,.12,.64,'#f9e4b3');r.label('support'+b.id,b.protected?'⛨ СОСЕДИ':'ОПОРА',[b.x,b.y-.72,.6],b.protected?'protect':'small');}
   if(b.reflector){r.label('reflect'+b.id,'ОТРАЖАТЕЛЬ',[b.x,b.y+.55,.5],'small');decoration(0,0,b.w*.94,.07,'#fff0b4');}
   if(b.domino){for(let j=-1;j<=1;j++)decoration(0,j*.54,b.w*.46,.11,b.target?'#fae4b6':'#e6dcca');if(b.target&&!b.damaged)r.label('domino'+b.id,'ЦЕЛЬ',[b.x,b.y+b.h/2+.45,.65],'small');}
 }
 if(!this.result&&this.ammo>0){const points=forecast(this.level.origin,this.aim,this.world.items);for(let i=1;i<points.length;i++){if(!this.drag&&i>18)break;const p=points[i];r.sphere([p[0],p[1],.5],[.065,.065,.065],this.drag?'#64858a':'#a7b7b3');}}
 this.particles.render(r);
 }
 snapshot(){return {...super.snapshot(),ammo:this.ammo,used:this.used,aim:[...this.aim],origin:[...this.level.origin],contacts:this.world.contacts,reflectorHits:this.reflectorHits,targets:this.level.targetCount,damaged:this.world.items.filter(b=>b.target&&b.damaged).length,protectedDamage:this.world.items.filter(b=>b.protected&&b.damaged).length,bodies:this.world.items.map(b=>({id:b.id,x:b.x,y:b.y,angle:b.angle,vx:b.vx,vy:b.vy,omega:b.omega,damaged:b.damaged,target:!!b.target,protected:!!b.protected,static:!!b.static,ball:!!b.ball,radius:b.radius||0,w:b.w,h:b.h}))};}
}
export { Wreck, wreckLevel };
