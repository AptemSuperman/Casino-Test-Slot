/** Compact deterministic 2D rigid-body solver, displayed as 3D toys.
 * Fixed substeps, oriented-box SAT, angular impulses, sphere/box contacts,
 * support wake-up and actual debris interactions. No hit-region win shortcuts.
 */
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const cross=(a,b)=>a.x*b.y-a.y*b.x;
const axes=b=>{const c=Math.cos(b.angle||0),s=Math.sin(b.angle||0);return [{x:c,y:s},{x:-s,y:c}];};
function closestPoint(box,p){const [u,v]=axes(box),d={x:p.x-box.x,y:p.y-box.y},a=Math.max(-box.w/2,Math.min(box.w/2,dot(d,u))),b=Math.max(-box.h/2,Math.min(box.h/2,dot(d,v)));return {x:box.x+u.x*a+v.x*b,y:box.y+u.y*a+v.y*b};}
function circleBox(ball,box){const p=closestPoint(box,ball),dx=p.x-ball.x,dy=p.y-ball.y,d=Math.hypot(dx,dy);if(d>=ball.radius)return null;if(d>1e-7)return {nx:dx/d,ny:dy/d,depth:ball.radius-d,x:p.x,y:p.y};const [u,v]=axes(box),q={x:ball.x-box.x,y:ball.y-box.y},lx=dot(q,u),ly=dot(q,v),ox=box.w/2-Math.abs(lx),oy=box.h/2-Math.abs(ly);const n=ox<oy?{x:u.x*Math.sign(lx||1),y:u.y*Math.sign(lx||1)}:{x:v.x*Math.sign(ly||1),y:v.y*Math.sign(ly||1)};return {nx:-n.x,ny:-n.y,depth:ball.radius+Math.min(ox,oy),x:ball.x+n.x*Math.min(ox,oy),y:ball.y+n.y*Math.min(ox,oy)};}
function boxBox(a,b){const aa=axes(a),bb=axes(b),d={x:b.x-a.x,y:b.y-a.y};let depth=Infinity,n=null;for(const axis of [...aa,...bb]){const ra=Math.abs(dot(aa[0],axis))*a.w/2+Math.abs(dot(aa[1],axis))*a.h/2,rb=Math.abs(dot(bb[0],axis))*b.w/2+Math.abs(dot(bb[1],axis))*b.h/2,over=ra+rb-Math.abs(dot(d,axis));if(over<=0)return null;if(over<depth){depth=over;let sign=dot(d,axis)<0?-1:1;n={x:axis.x*sign,y:axis.y*sign};}}const pa=closestPoint(a,b),pb=closestPoint(b,a);return {nx:n.x,ny:n.y,depth,x:(pa.x+pb.x)/2,y:(pa.y+pb.y)/2};}
function bounds(b){if(b.radius)return {x:b.radius,y:b.radius};let c=Math.abs(Math.cos(b.angle)),s=Math.abs(Math.sin(b.angle));return {x:c*b.w/2+s*b.h/2,y:s*b.w/2+c*b.h/2};}
function body(data){const mass=data.static?Infinity:(data.mass||data.w*data.h*1.2||3);return {angle:0,vx:0,vy:0,omega:0,awake:false,static:false,damaged:false,supports:[],...data,mass,invMass:data.static?0:1/mass,invI:data.static?0:1/(data.radius?mass*data.radius**2/2:mass*(data.w**2+data.h**2)/12),initial:{x:data.x,y:data.y,angle:data.angle||0}};}
function resolve(a,b,c){if(!a.static&&!a.awake&&b.awake&&Math.hypot(b.vx,b.vy)+Math.abs(b.omega)>.1)a.awake=true;if(!b.static&&!b.awake&&a.awake&&Math.hypot(a.vx,a.vy)+Math.abs(a.omega)>.1)b.awake=true;
 const ma=a.static||!a.awake?0:a.invMass,mb=b.static||!b.awake?0:b.invMass;if(!ma&&!mb)return 0;
 const ia=ma?a.invI:0,ib=mb?b.invI:0,ra={x:c.x-a.x,y:c.y-a.y},rb={x:c.x-b.x,y:c.y-b.y},n={x:c.nx,y:c.ny};
 const va={x:a.vx-a.omega*ra.y,y:a.vy+a.omega*ra.x},vb={x:b.vx-b.omega*rb.y,y:b.vy+b.omega*rb.x},rv={x:vb.x-va.x,y:vb.y-va.y},vel=dot(rv,n);
 let j=0;if(vel<0){const e=(a.reflector||b.reflector) ? .99 : (Math.abs(vel)<1 ? .02 : .18);const ca=cross(ra,n),cb=cross(rb,n);j=-(1+e)*vel/(ma+mb+ca*ca*ia+cb*cb*ib);a.vx-=j*n.x*ma;a.vy-=j*n.y*ma;a.omega-=ca*j*ia;b.vx+=j*n.x*mb;b.vy+=j*n.y*mb;b.omega+=cb*j*ib;
 const tangent={x:-n.y,y:n.x},ta=cross(ra,tangent),tb=cross(rb,tangent);let friction=-dot(rv,tangent)/(ma+mb+ta*ta*ia+tb*tb*ib);friction=(a.reflector||b.reflector)?0:Math.max(-Math.abs(j)*.38,Math.min(Math.abs(j)*.38,friction));a.vx-=friction*tangent.x*ma;a.vy-=friction*tangent.y*ma;a.omega-=ta*friction*ia;b.vx+=friction*tangent.x*mb;b.vy+=friction*tangent.y*mb;b.omega+=tb*friction*ib;}
 const correction=Math.max(0,c.depth-.003)*.55/(ma+mb);a.x-=c.nx*correction*ma;a.y-=c.ny*correction*ma;b.x+=c.nx*correction*mb;b.y+=c.ny*correction*mb;return j;
}
class PhysicsWorld {
 constructor(items,gravity=9.5){this.items=items.map(body);this.gravity=gravity;this.contacts=0;this.events=[];this.time=0;this.serial=1000;for(const a of this.items){if(a.static)continue;for(const b of this.items){if(a===b||b.radius)continue;if(Math.abs((a.y-a.h/2)-(b.y+b.h/2))<.08&&Math.abs(a.x-b.x)<(a.w+b.w)/2-.05)a.supports.push(b.id);}}}
 addBall(x,y,vx,vy,radius=.32){const b=body({id:'ball'+this.serial++,radius,x,y,vx,vy,mass:5.5,awake:true,ball:true});this.items.push(b);return b;}
 step(dt){this.time+=dt;this.events=[];
 for(const b of this.items){if(!b.static&&!b.awake&&b.supports.length){const supports=this.items.filter(p=>b.supports.includes(p.id));if(supports.every(p=>Math.abs(p.x-p.initial.x)>.20||Math.abs(p.y-p.initial.y)>.13||Math.abs(p.angle-p.initial.angle)>.14))b.awake=true;}
 if(!b.static&&b.awake){b.vy-=this.gravity*dt;b.vx*=Math.exp(-dt*.08);b.omega*=Math.exp(-dt*.13);b.vx=Math.max(-48,Math.min(48,b.vx));b.vy=Math.max(-48,Math.min(48,b.vy));b.omega=Math.max(-18,Math.min(18,b.omega));b.x+=b.vx*dt;b.y+=b.vy*dt;b.angle+=b.omega*dt;}}
 for(let pass=0;pass<5;pass++)for(let i=0;i<this.items.length;i++)for(let j=i+1;j<this.items.length;j++){const a=this.items[i],b=this.items[j];if((a.static||!a.awake)&&(b.static||!b.awake))continue;if(a.radius&&b.radius)continue;const aa=bounds(a),bb=bounds(b);if(Math.abs(a.x-b.x)>aa.x+bb.x||Math.abs(a.y-b.y)>aa.y+bb.y)continue;let c=a.radius?circleBox(a,b):b.radius?circleBox(b,a):boxBox(a,b);if(!c)continue;if(!a.radius&&b.radius)c={...c,nx:-c.nx,ny:-c.ny};const impulse=resolve(a,b,c);if(pass===0&&impulse>1){this.contacts++;this.events.push({x:c.x,y:c.y,impulse,a:a.id,b:b.id});}}
 for(const b of this.items)if(!b.static&&!b.radius&&!b.damaged&&(Math.hypot(b.x-b.initial.x,b.y-b.initial.y)>.52||Math.abs(b.angle-b.initial.angle)>.46))b.damaged=true;
 this.items=this.items.filter(b=>!b.ball||((b.x>-12&&b.x<13&&b.y>-4)&&this.time-(b.born||0)<16));
 }
}
function forecast(origin,velocity,obstacles,gravity=9.5){const ball={x:origin[0],y:origin[1],vx:velocity[0],vy:velocity[1],radius:.32};let points=[[ball.x,ball.y]],bounces=0;
 for(let i=0;i<660;i++){const dt=1/240;ball.vy-=gravity*dt;ball.vx*=Math.exp(-dt*.08);ball.x+=ball.vx*dt;ball.y+=ball.vy*dt;
   for(const o of obstacles){if(o.radius)continue;const c=circleBox(ball,o);if(!c)continue;if(!o.static||!o.reflector||bounces){points.push([ball.x,ball.y]);return points;}const dotn=ball.vx*c.nx+ball.vy*c.ny;if(dotn>0){ball.vx-=1.99*dotn*c.nx;ball.vy-=1.99*dotn*c.ny;ball.x-=c.nx*(c.depth+.002);ball.y-=c.ny*(c.depth+.002);bounces++;}}
   if(i%12===0)points.push([ball.x,ball.y]);if(ball.x>7||ball.x<-7||ball.y<0||ball.y>11)break;
 }
 return points;
}
export {PhysicsWorld,body,circleBox,boxBox,forecast,closestPoint};
