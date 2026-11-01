/**
 * Civweave <-> OpenSimulator loopback bridge.
 * Optional read-only region export, plus explicit operator-authorized NPC
 * movement and speech through an in-world OSSL controller. No RemoteAdmin API.
 * The CLI binds ONLY to 127.0.0.1; never expose this port over the network.
 */
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {validateOpenSimRegion} from '../../public/app/shared/worldweaver-opensim-geometry-v1.mjs';

const MAX_BYTES=2_000_000;
const PERSONAS=new Set(['aphra','jae','anthony','rosa','sana','kit','farah','kami']);
const allowedOrigin=o=>o==='https://civweave.cc'||
 o==='https://civweave-staging.pages.dev'||
 o==='https://staging.civweave.cc'||
 /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(o);
const sameSecret=(actual,secret)=>{
 if(!secret||typeof actual!=='string')return false;
 const a=Buffer.from(actual),b=Buffer.from(secret);
 return a.length===b.length&&timingSafeEqual(a,b);
};
const send=(res,status,value)=>{
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});
 res.end(JSON.stringify(value));
};
const bounded=(s,n=250)=>typeof s==='string'?s.trim().slice(0,n):'';
async function jsonBody(req){
 let text='';
 for await(const chunk of req){text+=chunk.toString('utf8');if(text.length>3500)throw new Error('Body too large')}
 try{return JSON.parse(text)}catch{throw new Error('Malformed JSON')}
}
function validAction(x,regionId){
 if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).some(k=>!['requestId','regionId','personaId','tool','args'].includes(k))||
 !/^[A-Za-z0-9_-]{2,90}$/.test(x.requestId||'')||x.regionId!==regionId||!PERSONAS.has(x.personaId)||
 !['move','speak'].includes(x.tool)||!x.args||typeof x.args!=='object'||Array.isArray(x.args))return false;
 if(x.tool==='move'){
  if(Object.keys(x.args).some(k=>!['x','y','z'].includes(k)))return false;
  const {x:a,y:b,z:c}=x.args;
  return [a,b,c].every(Number.isFinite)&&a>=0&&a<=256&&b>=0&&b<=256&&c>=0&&c<=4096;
 }
 return Object.keys(x.args).length===1&&typeof x.args.text==='string'&&
 x.args.text.trim().length>0&&x.args.text.length<=300;
}
export function createOpenSimRegionBridge({file,port=8769,regionId=null,browserToken=null,controllerToken=null,now=Date.now}={}){
 if(file!=null&&(typeof file!=='string'||!file.trim()))throw new TypeError('Invalid OpenSim region export path.');
 if(!file&&!(browserToken&&controllerToken))throw new TypeError('Supply an export file, or both local controller tokens.');
 if(!Number.isSafeInteger(Number(port))||Number(port)<0||Number(port)>65535)throw new TypeError('Invalid listen port.');
 if(Boolean(browserToken)!==Boolean(controllerToken))throw new TypeError('Both independent controller tokens are required.');
 if(browserToken&&(typeof browserToken!=='string'||browserToken.length<48||
   typeof controllerToken!=='string'||controllerToken.length<48||browserToken===controllerToken))
  throw new TypeError('Use different 48+ character browser and in-world controller tokens.');
 if(browserToken&&(!regionId||!/^[A-Za-z0-9_-]{2,90}$/.test(regionId)))
  throw new TypeError('An exact local OpenSim region identifier is required for control.');
 const path=file?resolve(file):null;
 const commands=new Map();let controllerLastSeen=0;
 const connected=()=>Boolean(controllerLastSeen&&now()-controllerLastSeen<15000);
 const reap=()=>{
  for(const cmd of commands.values())if(['queued','delivered'].includes(cmd.state)&&now()-cmd.createdAt>120000){
   cmd.state='expired';cmd.summary='Controller did not confirm an action within 120 seconds.';
  }
  if(commands.size>120)for(const [key,cmd] of commands){
   if(['completed','failed','expired'].includes(cmd.state))commands.delete(key);
   if(commands.size<=80)break;
  }
 };
 return createServer(async(req,res)=>{
  const origin=req.headers.origin;
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(origin&&!allowedOrigin(origin)){res.writeHead(403);res.end('Origin not allowed');return}
  if(origin){
   res.setHeader('Access-Control-Allow-Origin',origin);
   res.setHeader('Vary','Origin');
   res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
   res.setHeader('Access-Control-Allow-Headers','Accept,Content-Type,Authorization,X-Civweave-Controller');
   res.setHeader('Access-Control-Allow-Private-Network','true');
  }
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return}
  const u=new URL(req.url||'/', 'http://127.0.0.1');
  if(u.search||u.hash){send(res,400,{error:'URL query parameters are not accepted.'});return}
  if(u.pathname==='/region'&&req.method==='GET'){
   try{
    if(!path)throw new Error('No approved region export file configured.');
    const info=await stat(path);
    if(!info.isFile()||info.size>MAX_BYTES)throw new Error('Export missing or too large');
    const bytes=await readFile(path,'utf8');
    if(bytes.length>MAX_BYTES)throw new Error('Export too large');
    const json=JSON.parse(bytes);
    if(json?.source!=='opensim-region-module')throw new Error('OpenSim exporter provenance required');
    validateOpenSimRegion(json);
    res.setHeader('Content-Type','application/json; charset=utf-8');
    res.writeHead(200);res.end(bytes);
   }catch{send(res,503,{error:'No valid, permission-filtered OpenSim region export is available.'})}
   return;
  }
  if(u.pathname==='/status'&&req.method==='GET'){
   reap();
   send(res,200,{schema:'civweave.opensim-live-status.v1',
    regionId:regionId||null,controllerConnected:connected(),
    geometryConfigured:Boolean(path),commandsEnabled:Boolean(browserToken&&controllerToken),
    pending:[...commands.values()].filter(x=>['queued','delivered'].includes(x.state)).length,
    mode:'loopback-local-only'});return;
  }
  if(!browserToken||!controllerToken){send(res,404,{error:'Live OpenSim controls are not enabled.'});return}
  const browser=()=>sameSecret(req.headers.authorization,'Bearer '+browserToken);
  const world=()=>sameSecret(req.headers['x-civweave-controller'],controllerToken);
  reap();
  if(u.pathname==='/next'&&req.method==='GET'){
   if(!world()){send(res,401,{error:'Unauthorized controller'});return}
   controllerLastSeen=now();
   const cmd=[...commands.values()].find(x=>x.state==='queued');
   if(cmd)cmd.state='delivered';
   send(res,200,{schema:'civweave.opensim-controller-next.v1',command:cmd?
     {requestId:cmd.requestId,regionId:cmd.regionId,personaId:cmd.personaId,tool:cmd.tool,args:cmd.args}:null});
   return;
  }
  if(u.pathname==='/result'&&req.method==='POST'){
   if(!world()){send(res,401,{error:'Unauthorized controller'});return}
   try{
    const packet=await jsonBody(req),cmd=commands.get(packet?.requestId);
    if(!cmd||cmd.state!=='delivered'){send(res,409,{error:'Unknown or unissued command'});return}
    if(!['completed','failed'].includes(packet.outcome)||typeof packet.summary!=='string'||packet.summary.length>300){
      send(res,400,{error:'Invalid controller result'});return;
    }
    if(packet.outcome==='completed'&&cmd.tool==='move'){
     const pos=packet.position;
     if(!pos||![pos.x,pos.y,pos.z].every(Number.isFinite)){
      send(res,400,{error:'Reported movement requires measured NPC coordinates'});return;
     }
     cmd.position={x:pos.x,y:pos.y,z:pos.z};
    }
    cmd.state=packet.outcome;cmd.summary=bounded(packet.summary,300);cmd.resolvedAt=now();
    send(res,200,{schema:'civweave.opensim-action-receipt.v1',requestId:cmd.requestId,state:cmd.state});
   }catch(e){send(res,400,{error:bounded(e.message)})}
   return;
  }
  if(u.pathname==='/command'&&req.method==='POST'){
   if(!browser()){send(res,401,{error:'Browser control token required'});return}
   if(!connected()){send(res,503,{error:'OpenSim in-world controller has not checked in. Start the authorized script in your region.'});return}
   try{
    const input=await jsonBody(req);
    if(!validAction(input,regionId)){send(res,400,{error:'Invalid region, pilot, action or coordinates'});return}
    const previous=commands.get(input.requestId);
    if(previous){
     if(JSON.stringify(previous.args)!==JSON.stringify(input.args)||previous.personaId!==input.personaId||previous.tool!==input.tool)
      {send(res,409,{error:'Conflicting command ID'});return}
     send(res,200,{requestId:previous.requestId,state:previous.state});return;
    }
    if([...commands.values()].filter(x=>['queued','delivered'].includes(x.state)).length>=12){
      send(res,429,{error:'OpenSim command queue is full'});return;
    }
    const cmd={...input,state:'queued',createdAt:now(),summary:''};
    commands.set(cmd.requestId,cmd);
    send(res,202,{schema:'civweave.opensim-action-receipt.v1',requestId:cmd.requestId,state:cmd.state});
   }catch(e){send(res,400,{error:bounded(e.message)})}
   return;
  }
  const id=u.pathname.match(/^\/command\/([A-Za-z0-9_-]{2,90})$/)?.[1];
  if(id&&req.method==='GET'){
   if(!browser()){send(res,401,{error:'Browser control token required'});return}
   const cmd=commands.get(id);
   if(!cmd){send(res,404,{error:'Unknown or expired command'});return}
   send(res,200,{schema:'civweave.opensim-action-receipt.v1',
     requestId:cmd.requestId,regionId:cmd.regionId,personaId:cmd.personaId,tool:cmd.tool,
     state:cmd.state,summary:cmd.summary,position:cmd.position||null});
   return;
  }
  send(res,404,{error:'No such OpenSim bridge route'});
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const file=process.argv[2],port=Number(process.argv[3]||8769),live=process.argv.includes('--live');
 if(!file){process.stderr.write('Usage: node tools/worldweaver/opensim-region-bridge.mjs <region.json|- > [port] [--live] [--region=REGION_ID]\n');process.exitCode=2}
 else{
  const regionId=process.argv.find(x=>x.startsWith('--region='))?.slice(9)||'civweave-region';
  const browserToken=live?randomBytes(32).toString('hex'):null;
  const controllerToken=live?randomBytes(32).toString('hex'):null;
  const server=createOpenSimRegionBridge({file:file==='-'?null:file,port,regionId,browserToken,controllerToken});
  server.listen(port,'127.0.0.1',()=>{
   process.stdout.write('Civweave OpenSim local bridge: http://127.0.0.1:'+server.address().port+'\n');
   if(live){
    process.stdout.write('BROWSER CONTROL TOKEN (paste into Collective; keep private): '+browserToken+'\n');
    process.stdout.write('IN-WORLD SCRIPT TOKEN (paste into owner-only controller script; keep private): '+controllerToken+'\n');
    process.stdout.write('REGION ID: '+regionId+'\n');
   }else process.stdout.write('Read-only export /region (use --live for NPC action bridge).\n');
  });
 }
}
