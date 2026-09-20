export const TAU=Math.PI*2;
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const lerp=(a,b,t)=>a+(b-a)*t;
export const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
export const hypot=Math.hypot;
export const v3=(x=0,y=0,z=0)=>[x,y,z];
export const sub=(a,b)=>a.map((v,i)=>v-b[i]);
export const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const norm=a=>{const l=hypot(...a)||1;return a.map(v=>v/l)};
export const add=(a,b)=>a.map((v,i)=>v+b[i]);
export function identity(){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);}
export function mul(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;}
export function transform(p=[0,0,0],s=[1,1,1],r=[0,0,0]){
 const [x,y,z]=r,[a,b,c]=[Math.cos(x),Math.cos(y),Math.cos(z)],[d,e,f]=[Math.sin(x),Math.sin(y),Math.sin(z)];
 return new Float32Array([b*c*s[0],(a*f+d*e*c)*s[0],(d*f-a*e*c)*s[0],0,-b*f*s[1],(a*c-d*e*f)*s[1],(d*c+a*e*f)*s[1],0,e*s[2],-d*b*s[2],a*b*s[2],0,...p,1]);
}
export function lookAt(eye,at,up=[0,1,0]){let z=norm(sub(eye,at)),x=norm(cross(up,z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);}
export function ortho(l,r,b,t,n,f){return new Float32Array([2/(r-l),0,0,0,0,2/(t-b),0,0,0,0,-2/(f-n),0,-(r+l)/(r-l),-(t+b)/(t-b),-(f+n)/(f-n),1]);}
export function invert(a){let o=new Float32Array(16),m=Array.from({length:4},(_,r)=>[...Array.from({length:4},(_,c)=>a[c*4+r]),...Array.from({length:4},(_,c)=>+(r===c))]);for(let i=0;i<4;i++){let k=i;for(let j=i+1;j<4;j++)if(Math.abs(m[j][i])>Math.abs(m[k][i]))k=j;[m[k],m[i]]=[m[i],m[k]];let d=m[i][i];if(Math.abs(d)<1e-12)return identity();for(let c=0;c<8;c++)m[i][c]/=d;for(let r=0;r<4;r++)if(r!==i){let v=m[r][i];for(let c=0;c<8;c++)m[r][c]-=v*m[i][c];}}for(let r=0;r<4;r++)for(let c=0;c<4;c++)o[c*4+r]=m[r][c+4];return o;}
export function point(m,p){let v=[...p,1],o=[0,0,0,0];for(let r=0;r<4;r++)for(let c=0;c<4;c++)o[r]+=m[c*4+r]*v[c];return o.slice(0,3).map(n=>n/o[3]);}
export function seedRandom(seed=1){let a=seed>>>0;return ()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
export function hex(c){if(Array.isArray(c))return c;let s=c.replace('#','');if(s.length===3)s=s.split('').map(x=>x+x).join('');return [parseInt(s.slice(0,2),16)/255,parseInt(s.slice(2,4),16)/255,parseInt(s.slice(4,6),16)/255];}
export const distance2=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
