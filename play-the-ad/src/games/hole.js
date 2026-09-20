import { Game } from '../core/runtime.js';
import { clamp, lerp, hypot, smooth } from '../core/math.js';
import { board, prop, tree } from '../core/models.js';
import { HOLE_NAMES } from '../levels.js';

const NEED = { fruit:.23, crate:.63, cart:.90, bench:.91, lamp:.78, car:1.10, kiosk:1.27, house:1.43, tower:1.72, safe:.65 };
const MASS = { fruit:1.5, crate:4, cart:13, bench:10, lamp:7, car:18, kiosk:30, house:35, tower:80, safe:0 };
const RAD = { fruit:.18, crate:.35, cart:.64, bench:.65, lamp:.35, car:.88, kiosk:1.0, house:1.12, tower:1.65, safe:.40 };
const holeRadius = mass => .38 + .095*Math.sqrt(mass);
function holeLevel(index) {
  const objects=[]; let id=0;
  const put=(kind,x,z,extra={})=>{const o={id:'o'+id++,kind,x,z,baseX:x,baseZ:z,y:0,need:NEED[kind],mass:MASS[kind],radius:RAD[kind],state:'live',color:kind==='car'?'#e6a279':kind==='cart'?'#8bb7ad':'#e8c797',...extra};objects.push(o);return o;};
  if(index===0){
    for(const z of [4.7,3.65])for(const x of [-2.6,-1.75,-.9,0,.9,1.75,2.6])put('fruit',x,z,{variant:x>0?'lemon':'apple'});
    for(const x of [-2.7,2.7])for(const z of [2,.65,-.7,-2.1])put('crate',x,z);
    for(const x of [-2.4,0,2.4])put('cart',x,-3.55);
    put('kiosk',0,-5.25,{target:true});
  } else if(index===1){
    for(const side of [-1,1]){
      for(let j=0;j<10;j++){const a=j/10*Math.PI*2;put('fruit',side*2.3+Math.cos(a)*1.15,2.3+Math.sin(a)*1.25,{variant:side<0?'apple':'lemon'});}
      for(let j=0;j<4;j++)put('crate',side*(1.35+(j%2)*1.7),-.2-Math.floor(j/2)*1.6);
      put('cart',side*2.8,-3.8);put('bench',side*1.25,-2.95);
    }
    put('kiosk',0,-5.1,{target:true});
  } else if(index===2){
    for(const side of [-1,1]){
      for(let j=0;j<8;j++)put('fruit',side*(2.9+(j%2)*.6),4.9-Math.floor(j/2)*1.05);
      for(const z of [.6,-.8,-2.1])put('crate',side*3.35,z);
      put('cart',side*3,-3.6);put('safe',side*.95,.7,{protected:true});
    }
    put('fruit',0,4.8);put('fruit',-.6,4.3);put('fruit',.6,4.3);
    put('bench',0,-3);put('kiosk',0,-5,{target:true});
  } else if(index===3){
    for(let j=0;j<16;j++)put('fruit',(j%8-3.5)*.78,3.6+Math.floor(j/8)*1.3,{motion:'conveyor',phase:j*.4});
    for(const side of [-1,1])for(let j=0;j<4;j++)put('crate',side*2.6,1.9-j*1.1,{motion:j%2?'cart':null,phase:j});
    put('cart',-2.6,-3.3,{motion:'car',phase:0});put('cart',2.6,-3.3,{motion:'car',phase:Math.PI});
    put('car',0,-2.9,{motion:'car',phase:Math.PI/2});put('kiosk',0,-5.2,{target:true});
  } else {
    for(let j=0;j<24;j++)put('fruit',(j%8-3.5)*.8,5.35-Math.floor(j/8)*.85,{variant:j%2?'apple':'lemon'});
    for(const side of [-1,1]){
      for(let j=0;j<5;j++)put('crate',side*3.45,2.65-j*1.05);
      put('cart',side*2.2,.85);put('bench',side*2.25,-.6);put('car',side*3,-3.5);put('house',side*2.5,-5.6);
    }
    put('kiosk',0,-2.4);put('tower',0,-5.4,{target:true,color:'#ebc386'});
  }
  return {id:'H'+(index+1),name:HOLE_NAMES[index],objects,limit:[95,105,115,110,115][index],stars:[48,78],goal:[
    'Яблоки → тележки → киоск. Расти и поглоти большую цель.',
    'Собери квартал. Выбери удобную петлю и доберись до киоска.',
    'Съешь киоск. Статуи со щитом должны остаться целыми.',
    'Перехватывай движущиеся предметы и вырасти до киоска.',
    'От фруктовой улицы до центрального дома. Съешь весь масштаб!'][index]};
}
class Hole extends Game {
  constructor(ctx,index){super(ctx,holeLevel(index));this.index=index;this.objects=this.level.objects;this.x=0;this.z=6.25;this.mass=0;this.radius=holeRadius(0);this.drawRadius=this.radius;this.keys=new Set();this.drag=null;this.stick={x:0,z:0};this.eaten=0;this.travel=0;this.growths=0;this.lastSize=this.radius;this.r.hole=[this.x,this.z,this.radius];this.r.setCamera({eye:[0,20,20],at:[0,.0,-.5],width:11.3,height:15.6});}
  input(type,p){
    if(this.result)return;
    if(type==='down'){this.start();this.drag={x:p.x,y:p.y};this.stick={x:0,z:0};}
    if(type==='move'&&this.drag){let x=(p.x-this.drag.x)/55,z=(p.y-this.drag.y)/55;let n=Math.max(1,hypot(x,z));this.stick={x:x/n,z:z/n};}
    if(type==='up'||type==='cancel'){this.drag=null;this.stick={x:0,z:0};if(type==='cancel')this.keys.clear();}
    if(type==='key'){p.down?this.keys.add(p.key):this.keys.delete(p.key);if(p.down)this.start();}
  }
  update(dt){
    super.update(dt);this.drawRadius=lerp(this.drawRadius,this.radius,Math.min(1,dt*8));
    if(!this.started||this.result)return;
    let dx=this.stick.x,dz=this.stick.z;
    if(this.keys.has('a')||this.keys.has('arrowleft'))dx--;
    if(this.keys.has('d')||this.keys.has('arrowright'))dx++;
    if(this.keys.has('w')||this.keys.has('arrowup'))dz--;
    if(this.keys.has('s')||this.keys.has('arrowdown'))dz++;
    const n=Math.max(1,hypot(dx,dz)), speed=3.7;
    const ox=this.x,oz=this.z;this.x=clamp(this.x+dx/n*speed*dt,-4.6,4.6);this.z=clamp(this.z+dz/n*speed*dt,-6.3,6.5);this.travel+=hypot(ox-this.x,oz-this.z);
    for(const o of this.objects){
      if(o.state==='gone')continue;
      if(o.state==='live'&&o.motion){
        if(o.motion==='conveyor')o.x=o.baseX+Math.sin(this.time*.75+o.phase)*.48;
        if(o.motion==='cart')o.x=o.baseX+Math.sin(this.time*.7+o.phase)*.45;
        if(o.motion==='car'){o.x=o.baseX+Math.sin(this.time*.8+o.phase)*.55;o.ry=Math.cos(this.time*.8+o.phase)*.12;}
      }
      if(o.state==='sinking'){
        o.fall+=dt;let k=clamp(o.fall/o.duration,0,1);o.x=lerp(o.x,this.x,dt*3);o.z=lerp(o.z,this.z,dt*3);o.y=-smooth(k)*(o.kind==='tower'?5:3.2);o.rx=Math.sin(k*Math.PI)*.35;o.rz=Math.sin(k*Math.PI)*.18;o.scale=1-k*.45;
        if(k>=1){o.state='gone';this.mass+=o.mass;this.eaten++;this.radius=holeRadius(this.mass);this.ctx.sound.play('eat',.7);if(this.radius-this.lastSize>.16){this.lastSize=this.radius;this.growths++;this.ctx.sound.play('grow');this.particles.burst([this.x,.2,this.z],'#f2dd96',12,2);}if(o.target)this.finish(true,'Вот это аппетит. Большая цель поглощена!',`${Math.round(this.time)} с · ${this.eaten} предметов`,this.time<=this.level.stars[0]?3:this.time<=this.level.stars[1]?2:1);}
      } else if(this.radius+1e-8>=o.need&&hypot(o.x-this.x,o.z-this.z)<Math.max(.17,this.radius-o.radius*.3)){
        if(o.protected){this.finish(false,'Статуя со щитом попала в дыру. Пройди по внешней стороне квартала.','Защищённый объект');return;}
        o.state='sinking';o.fall=0;o.duration=o.target?1.1:.48;this.ctx.sound.play('eat',.3);
      }
    }
    if(this.time>=this.level.limit&&!this.result)this.finish(false,'Время закончилось. Начни с мелочей и выбирай более плотный маршрут.',`${this.eaten} предметов`);
  }
  hud(){const target=this.objects.find(o=>o.target);return {value:String(Math.max(0,Math.ceil(this.level.limit-this.time))),label:'секунд',secondary:`Размер ${this.radius.toFixed(2)} · нужно ${target.need.toFixed(2)}${this.index===2?' · береги щиты':''}`,progress:Math.min(1,this.radius/target.need)};}
  render(t){const r=this.r;r.hole=[this.x,this.z,this.drawRadius];board(r,{w:11,d:15,color:'#e8dfc1',edge:'#a0b79b',ground:'#c4cbbb'});
    // All surface pieces use the same depth cut-out as the board.
    r.box([0,.016,0],[8.75,.028,14.45],'#d1c6a8',[0,0,0],3);
    for(const x of [-4.9,4.9]){r.box([x,.06,0],[.6,.12,14.4],'#eee6d0',[0,0,0],3);for(const z of [-6,-3,0,3,6])tree(r,x,z,.43,'#7b9f79');}
    for(let z=-6;z<6.6;z+=1.15)r.box([0,.036,z],[.055,.025,.38],'#e7dcbd',[0,0,0],3);
    r.draw('well',[this.x,.013,this.z],[this.drawRadius*2,1.65,this.drawRadius*2],'#223743',[0,0,0],4);
    r.cyl([this.x,-1.45,this.z],[this.drawRadius*2,.06,this.drawRadius*2],'#0c1422',[0,0,0],4);
    r.ring([this.x,.033,this.z],[this.drawRadius*2,.40,this.drawRadius*2],'#496878');
    r.ring([this.x,.035,this.z],[this.drawRadius*2.06,.25,this.drawRadius*2.06],'#edd699');
    for(const o of this.objects){if(o.state==='gone')continue;prop(r,o);if(o.protected)r.label('protected'+o.id,'⛨ НЕ ТРОГАТЬ',[o.x,2.1,o.z],'protect');if(o.target&&o.state==='live')r.label('big-target',this.radius>=o.need?'ТЕПЕРЬ МОЖНО ↓':'БОЛЬШАЯ ЦЕЛЬ',[o.x,o.kind==='tower'?4.2:3,o.z],'small');}
    if(this.drag){r.ring([this.x,.06,this.z],[.48,.25,.48],'#f3ead1');}
    this.particles.render(r);
  }
  snapshot(){return {...super.snapshot(),x:this.x,z:this.z,radius:this.radius,mass:this.mass,eaten:this.eaten,travel:this.travel,growths:this.growths,objects:this.objects.map(o=>({id:o.id,kind:o.kind,x:o.x,z:o.z,need:o.need,mass:o.mass,radius:o.radius,state:o.state,protected:!!o.protected,target:!!o.target,motion:o.motion||null}))};}
}
export { Hole, holeLevel, holeRadius, NEED, MASS, RAD };
