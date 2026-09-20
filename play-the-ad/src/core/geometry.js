/** Closed extruded capsule with two genuine drilled holes. Local XY face, Z thickness. */
function capsulePlateGeometry(length, radius=.59, thick=.20, hole=.205, bulge=0){
 const out=[];const v=(p,n)=>out.push(...p,...n,1,1,1);
 const tri=(a,b,c,n)=>{v(a,n);v(b,n);v(c,n);};
 const quad=(a,b,c,d,n)=>{tri(a,b,c,n);tri(a,c,d,n);};
 const half=length/2;
 const xvals=[-half-radius,half+radius,-half-hole,-half+hole,half-hole,half+hole,-half,half];
 for(let i=0;i<=120;i++)xvals.push(-half-radius+(length+radius*2)*i/120);
 xvals.sort((a,b)=>a-b);const xs=xvals.filter((x,i)=>!i||Math.abs(x-xvals[i-1])>1e-7);
 const outer=x=>Math.sqrt(Math.max(0,radius*radius-Math.max(0,Math.abs(x)-half)**2))+(Math.abs(x)<half?bulge*Math.sin(Math.PI*(x+half)/length)**2:0);
 const inner=x=>{let d=Math.min(Math.abs(x-half),Math.abs(x+half));return d<hole?Math.sqrt(hole*hole-d*d):0;};
 for(let i=1;i<xs.length;i++){
   const a=xs[i-1],b=xs[i],oa=outer(a),ob=outer(b),ia=inner(a),ib=inner(b),z=thick/2;
   quad([a,ia,z],[b,ib,z],[b,ob,z],[a,oa,z],[0,0,1]);
   quad([a,-oa,z],[b,-ob,z],[b,-ib,z],[a,-ia,z],[0,0,1]);
   quad([a,oa,-z],[b,ob,-z],[b,ib,-z],[a,ia,-z],[0,0,-1]);
   quad([a,-ia,-z],[b,-ib,-z],[b,-ob,-z],[a,-oa,-z],[0,0,-1]);
   const slope=(ob-oa)/(b-a), norm=Math.hypot(slope,1);
   const nx=-slope/norm,ny=1/norm;
   quad([a,oa,z],[b,ob,z],[b,ob,-z],[a,oa,-z],[nx,ny,0]);
   quad([a,-oa,-z],[b,-ob,-z],[b,-ob,z],[a,-oa,z],[nx,-ny,0]);
 }
 // Smooth walls inside the holes.
 for(const cx of [-half,half])for(let i=0;i<40;i++){
   const a=i/40*Math.PI*2,b=(i+1)/40*Math.PI*2,z=thick/2;
   const p=[cx+hole*Math.cos(a),hole*Math.sin(a)],q=[cx+hole*Math.cos(b),hole*Math.sin(b)];
   quad([...p,z],[...p,-z],[...q,-z],[...q,z],[-Math.cos((a+b)/2),-Math.sin((a+b)/2),0]);
 }
 return out;
}
function distanceSegment(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1];const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t);}
export {capsulePlateGeometry,distanceSegment};
