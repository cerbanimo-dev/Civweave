/**
 * Local-only, read-only bridge for an OpenSimulator region-module exporter.
 *
 * The OpenSim operator or region module writes an authorized, filtered
 * civweave.opensim-region-geometry.v1 JSON file. This process serves exactly
 * that file to Civweave over 127.0.0.1, without RemoteAdmin credentials.
 *
 * Usage: node tools/worldweaver/opensim-region-bridge.mjs /path/region.json 8769
 */
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {validateOpenSimRegion} from '../../public/app/shared/worldweaver-opensim-geometry-v1.mjs';

const MAX_BYTES=2_000_000;
const allowedOrigin=o=>o==='https://civweave.cc'||
 o==='https://civweave-staging.pages.dev'||
 o==='https://staging.civweave.cc'||
 /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(o);
export function createOpenSimRegionBridge({file,port=8769}={}){
 if(typeof file!=='string'||!file.trim())throw new TypeError('An explicit OpenSim region-module JSON export path is required.');
 if(!Number.isSafeInteger(Number(port))||Number(port)<0||Number(port)>65535)throw new TypeError('Invalid listen port.');
 const path=resolve(file);
 return createServer(async(req,res)=>{
  const origin=req.headers.origin;
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(origin&&!allowedOrigin(origin)){res.writeHead(403);res.end('Origin not allowed');return}
  if(origin){
   res.setHeader('Access-Control-Allow-Origin',origin);
   res.setHeader('Vary','Origin');
   res.setHeader('Access-Control-Allow-Methods','GET, OPTIONS');
   res.setHeader('Access-Control-Allow-Headers','Accept');
   res.setHeader('Access-Control-Allow-Private-Network','true');
  }
  if(req.url!=='/region'){res.writeHead(404);res.end('Not found');return}
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return}
  if(req.method!=='GET'){res.writeHead(405);res.end('Method not allowed');return}
  try{
   const info=await stat(path);
   if(!info.isFile()||info.size>MAX_BYTES)throw new TypeError('Export missing or too large');
   const bytes=await readFile(path,'utf8');
   if(bytes.length>MAX_BYTES)throw new TypeError('Export too large');
   const json=JSON.parse(bytes);
   if(json?.source!=='opensim-region-module')throw new TypeError('OpenSim exporter provenance required');
   validateOpenSimRegion(json);
   res.setHeader('Content-Type','application/json; charset=utf-8');
   res.writeHead(200);res.end(bytes);
  }catch{
   res.writeHead(503,{'Content-Type':'text/plain; charset=utf-8'});
   res.end('No valid, permission-filtered OpenSim region export is available.');
  }
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const file=process.argv[2],port=Number(process.argv[3]||8769);
 if(!file){process.stderr.write('Usage: node tools/worldweaver/opensim-region-bridge.mjs /path/region.json [port]\n');process.exitCode=2}
 else{
  const server=createOpenSimRegionBridge({file,port});
  server.listen(port,'127.0.0.1',()=>process.stdout.write('OpenSim read-only region export at http://127.0.0.1:'+server.address().port+'/region\n'));
 }
}
