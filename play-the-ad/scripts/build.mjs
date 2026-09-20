import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname,posix} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'..'),modules=[],done=new Set();
async function bundle(name){
 if(done.has(name))return;done.add(name);
 let source=await readFile(resolve(root,name),'utf8');
 const imports=[...source.matchAll(/^import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?\s*$/gm)];
 for(const m of imports)await bundle(posix.normalize(posix.join(posix.dirname(name),m[2])));
 source=source.replace(/^import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?\s*$/gm,(_,exports,path)=>`const {${exports}}=__modules[${JSON.stringify(posix.normalize(posix.join(posix.dirname(name),path)))}];`);
 let exports='';source=source.replace(/^export\s*\{([^}]+)\};?\s*$/gm,(_,list)=>{exports=list;return '';});
 if(/^import\s/m.test(source)||/^export\s/m.test(source))throw Error('Unsupported module syntax: '+name);
 modules.push(`__modules[${JSON.stringify(name)}]=(()=>{\n${source}\nreturn {${exports}};\n})();`);
}
await bundle('src/app.js');
let html=await readFile(resolve(root,'index.html'),'utf8'),css=await readFile(resolve(root,'src/style.css'),'utf8');
html=html.replace('<link rel="stylesheet" href="./src/style.css">',`<style>${css}</style>`).replace('<script type="module" src="./src/app.js"></script>',`<script>(()=>{\n'use strict';\nconst __modules={};\n${modules.join('\n')}\n})();</script>`);
await mkdir(resolve(root,'dist'),{recursive:true});await writeFile(resolve(root,'dist/index.html'),html);
const sha256=createHash('sha256').update(html).digest('hex');await writeFile(resolve(root,'dist/build.json'),JSON.stringify({version:'1.0.0',bytes:Buffer.byteLength(html),sha256,modules:done.size},null,2)+'\n');
console.log(JSON.stringify({bytes:Buffer.byteLength(html),sha256,modules:done.size}));
