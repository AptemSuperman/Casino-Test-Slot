import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..',process.argv.includes('--dist')?'dist':'.');
const port=Number(process.env.PORT||4173);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.webm':'video/webm'};
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost'),name=decodeURIComponent(url.pathname),file=path.resolve(root,'.'+(name.endsWith('/')?name+'index.html':name));if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end('Forbidden');return;}const info=await stat(file);if(!info.isFile()){res.writeHead(404).end('Not found');return;}const content=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(content);}catch{res.writeHead(404).end('Not found');}});
server.listen(port,'127.0.0.1',()=>console.log(`PLAY THE AD: http://localhost:${port} (${root})`));
