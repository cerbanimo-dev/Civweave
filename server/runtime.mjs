import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {AiWalletService} from '../lib/ai-wallet-service-v1.mjs';
import {createAiWalletHttpHandler} from '../lib/ai-wallet-http-v1.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const PUBLIC_DIR=path.join(ROOT,'public');
const DATA_DIR=path.resolve(ROOT,process.env.DATA_DIR||'data');
const STATE_FILE=path.join(DATA_DIR,'host-node-state.json');
const PORT=Number(process.env.PORT||8787);
const HOST=process.env.HOST||'0.0.0.0';
const HUB_NAME=String(process.env.HUB_NAME||'Civweave Host Node').slice(0,120);
const HUB_TOKEN=String(process.env.HUB_TOKEN||'').trim();
const SOURCE_URL='https://github.com/cerbanimo-dev/Civweave';
const STARTED_AT=new Date().toISOString();
const MAX_ENVELOPES=Math.max(100,Number(process.env.MAX_ENVELOPES||5000));
const clients=new Set();
const MIME=new Map([['.html','text/html; charset=utf-8'],['.js','text/javascript; charset=utf-8'],['.mjs','text/javascript; charset=utf-8'],['.css','text/css; charset=utf-8'],['.json','application/json; charset=utf-8'],['.webmanifest','application/manifest+json'],['.png','image/png'],['.jpg','image/jpeg'],['.jpeg','image/jpeg'],['.webp','image/webp'],['.svg','image/svg+xml'],['.wasm','application/wasm'],['.onnx','application/octet-stream'],['.txt','text/plain; charset=utf-8']]);

const state={version:1,nodes:{},envelopes:[],presence:{},createdAt:STARTED_AT,updatedAt:STARTED_AT};
let persistTimer=null;
await fsp.mkdir(DATA_DIR,{recursive:true});
try{const saved=JSON.parse(await fsp.readFile(STATE_FILE,'utf8'));if(saved&&typeof saved==='object')Object.assign(state,saved)}catch(error){if(error.code!=='ENOENT')console.warn('[Civweave] Host state restore skipped:',error.message)}

const marketplaceRequested=process.env.NODE_AI_MARKETPLACE_ENABLED==='1'||process.env.AI_WALLET_ENABLED==='1';
let walletService=null;
if(marketplaceRequested){try{walletService=await new AiWalletService({databasePath:process.env.NODE_AI_LEDGER_PATH||path.join(DATA_DIR,'node-ai-ledger-v1.sqlite'),nodeId:process.env.NODE_AI_NODE_ID,operatorId:process.env.NODE_AI_OPERATOR_ID,platformFeeBps:process.env.NODE_AI_PLATFORM_FEE_BPS}).load()}catch(error){console.error('[Civweave] Node AI marketplace stayed disabled:',error.message)}}
const walletHttp=createAiWalletHttpHandler({walletService,requested:marketplaceRequested,authSecret:String(process.env.NODE_AI_AUTH_SECRET||process.env.AI_WALLET_AUTH_SECRET||''),paymentSecret:String(process.env.NODE_AI_PAYMENT_WEBHOOK_SECRET||process.env.AI_WALLET_PAYMENT_SECRET||''),internalSecret:String(process.env.NODE_AI_INTERNAL_SECRET||process.env.AI_WALLET_INTERNAL_SECRET||''),capabilitySecret:String(process.env.NODE_AI_CAPABILITY_SECRET||process.env.AI_WALLET_CAPABILITY_SECRET||'')});

const now=()=>new Date().toISOString();
const id=prefix=>`${prefix}:${crypto.randomUUID()}`;
const clean=(value,max=500)=>String(value??'').trim().slice(0,max);
function origin(req,url){const proto=clean(req.headers['x-forwarded-proto'],20).split(',')[0]||url.protocol.replace(':',''),host=clean(req.headers['x-forwarded-host']||req.headers.host||url.host,300).split(',')[0];return `${proto==='https'?'https':'http'}://${host}`}
function json(res,status,payload,headers={}){const body=Buffer.from(JSON.stringify(payload));res.writeHead(status,{'content-type':'application/json; charset=utf-8','content-length':body.length,'cache-control':'no-store','x-content-type-options':'nosniff',...headers});res.end(body)}
function authorized(req){if(!HUB_TOKEN)return true;const auth=String(req.headers.authorization||'');return(auth.startsWith('Bearer ')&&auth.slice(7).trim()===HUB_TOKEN)||req.headers['x-civweave-hub-token']===HUB_TOKEN}
async function readBody(req,limit=4*1024*1024){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>limit)throw Object.assign(new Error('Request body too large'),{status:413});chunks.push(chunk)}if(!chunks.length)return{};try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{throw Object.assign(new Error('Invalid JSON body'),{status:400})}}
function publicNode(node){return{nodeId:node.nodeId,label:node.label,system:node.system,capabilities:node.capabilities,metadata:node.metadata||{},firstSeenAt:node.firstSeenAt,lastSeenAt:node.lastSeenAt,online:Date.now()-Date.parse(node.lastSeenAt||0)<120000}}
function persist(){state.updatedAt=now();clearTimeout(persistTimer);persistTimer=setTimeout(async()=>{try{const temp=`${STATE_FILE}.tmp`;await fsp.writeFile(temp,JSON.stringify(state,null,2));await fsp.rename(temp,STATE_FILE)}catch(error){console.error('[Civweave] Host state persistence failed:',error.message)}},150)}
function prune(){if(state.envelopes.length>MAX_ENVELOPES)state.envelopes.splice(0,state.envelopes.length-MAX_ENVELOPES);const cutoff=Date.now()-86400000;for(const[key,value]of Object.entries(state.presence))if(Date.parse(value.updatedAt||0)<cutoff)delete state.presence[key]}
function emit(type,data){const packet=`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;for(const client of clients)client.write(packet)}

async function proxyGemini(req,res,pathname){const key=clean(req.headers['x-goog-api-key'],1000);if(!key)return json(res,400,{error:'A session-only Gemini API key is required.'});const suffix=pathname.slice('/api/ai/gemini/interactions'.length);if(suffix&&!/^\/[A-Za-z0-9_:.~-]+$/.test(suffix))return json(res,400,{error:'Invalid interaction ID.'});if(!['GET','POST','DELETE'].includes(req.method||''))return json(res,405,{error:'Method not allowed.'});const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),300000);try{const init={method:req.method,headers:{'x-goog-api-key':key,accept:'application/json'},signal:controller.signal};if(req.method==='POST'){init.headers['content-type']='application/json';init.body=JSON.stringify(await readBody(req))}const upstream=await fetch(`https://generativelanguage.googleapis.com/v1beta/interactions${suffix}`,init),bytes=Buffer.from(await upstream.arrayBuffer());res.writeHead(upstream.status,{'content-type':upstream.headers.get('content-type')||'application/json; charset=utf-8','content-length':bytes.length,'cache-control':'no-store','x-content-type-options':'nosniff'});res.end(bytes)}catch(error){json(res,error?.name==='AbortError'?504:502,{error:error?.name==='AbortError'?'Gemini request timed out.':`Gemini proxy failed: ${error.message}`})}finally{clearTimeout(timer)}}

async function serveFile(req,res,pathname){let decoded;try{decoded=decodeURIComponent(pathname==='/'?'/index.html':pathname)}catch{return false}const safe=path.normalize(decoded).replace(/^(\.\.[/\\])+/,''),target=path.join(PUBLIC_DIR,safe);if(!target.startsWith(PUBLIC_DIR))return false;let file=target;try{let info=await fsp.stat(file);if(info.isDirectory())file=path.join(file,'index.html');info=await fsp.stat(file);const ext=path.extname(file).toLowerCase(),headers={'content-type':MIME.get(ext)||'application/octet-stream','accept-ranges':'bytes','x-content-type-options':'nosniff','referrer-policy':'same-origin','cross-origin-resource-policy':'same-origin','cache-control':['.html','.js','.mjs','.css','.webmanifest'].includes(ext)?'no-cache, must-revalidate':'public, max-age=86400'};const range=req.headers.range;if(range){const match=/^bytes=(\d*)-(\d*)$/.exec(range);if(!match)return json(res,416,{error:'Invalid range'});const start=match[1]?Number(match[1]):0,end=match[2]?Number(match[2]):info.size-1;if(start>end||end>=info.size)return json(res,416,{error:'Range not satisfiable'});res.writeHead(206,{...headers,'content-range':`bytes ${start}-${end}/${info.size}`,'content-length':end-start+1});if(req.method==='HEAD')return res.end();fs.createReadStream(file,{start,end}).pipe(res);return true}res.writeHead(200,{...headers,'content-length':info.size});if(req.method==='HEAD')return res.end();fs.createReadStream(file).pipe(res);return true}catch{return false}}

const server=http.createServer(async(req,res)=>{const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`),pathname=url.pathname;try{
  if(pathname.startsWith('/api/')){
    if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-origin':'*','access-control-allow-headers':'content-type, authorization, x-civweave-hub-token, x-goog-api-key, x-civweave-ai-capability, x-civweave-internal-secret, x-civweave-payment-signature','access-control-allow-methods':'GET,POST,DELETE,OPTIONS'});return res.end()}
    res.setHeader('access-control-allow-origin','*');
    if(await walletHttp.handle(req,res,url))return;
    if(pathname==='/api/health'&&req.method==='GET')return json(res,200,{ok:true,name:HUB_NAME,startedAt:STARTED_AT,now:now(),nodes:Object.keys(state.nodes).length,envelopes:state.envelopes.length,runtime:'single-current-tree',sourceHotSwap:false,historicalSourceSelection:false,aiWallet:walletHttp.status()});
    if(pathname==='/api/config'&&req.method==='GET'){const base=origin(req,url);return json(res,200,{schema:'civweave.host-config.v1',name:HUB_NAME,baseUrl:base,apiBase:`${base}/api`,appUrl:`${base}/app/campus.html`,installUrl:`${base}/`,sourceUrl:SOURCE_URL,tokenRequired:Boolean(HUB_TOKEN),features:['current-pwa','node-registration','heartbeat','relay-envelopes','presence','sse-events','gemini-agent-proxy','node-ai-marketplace-v1'],aiWallet:walletHttp.status()})}
    if(!authorized(req)&&!['/api/health','/api/config','/api/events'].includes(pathname))return json(res,401,{error:'Host node token required'});
    if(pathname==='/api/ai/gemini/interactions'||pathname.startsWith('/api/ai/gemini/interactions/'))return proxyGemini(req,res,pathname);
    if(pathname==='/api/events'&&req.method==='GET'){res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache',connection:'keep-alive','access-control-allow-origin':'*'});res.write(`event: ready\ndata: ${JSON.stringify({now:now(),name:HUB_NAME})}\n\n`);clients.add(res);req.on('close',()=>clients.delete(res));return}
    if(pathname==='/api/nodes/register'&&req.method==='POST'){const input=await readBody(req),nodeId=clean(input.nodeId,160)||id('node'),existing=state.nodes[nodeId];const node=state.nodes[nodeId]={nodeId,label:clean(input.label||input.displayName||'Civweave node',120),system:clean(input.system||'civweave',80),capabilities:Array.isArray(input.capabilities)?input.capabilities.map(value=>clean(value,80)).filter(Boolean).slice(0,64):[],metadata:input.metadata&&typeof input.metadata==='object'?input.metadata:{},firstSeenAt:existing?.firstSeenAt||now(),lastSeenAt:now()};persist();emit('node',publicNode(node));return json(res,200,{ok:true,node:publicNode(node),hub:HUB_NAME})}
    if(pathname==='/api/nodes/heartbeat'&&req.method==='POST'){const input=await readBody(req),nodeId=clean(input.nodeId,160);if(!nodeId||!state.nodes[nodeId])return json(res,404,{error:'Node is not registered'});state.nodes[nodeId].lastSeenAt=now();persist();return json(res,200,{ok:true,now:now()})}
    if(pathname==='/api/nodes'&&req.method==='GET')return json(res,200,{nodes:Object.values(state.nodes).map(publicNode)});
    if(pathname==='/api/envelopes'&&req.method==='POST'){const input=await readBody(req),envelope={id:id('env'),schema:clean(input.schema||'civweave.relay-envelope.v1',100),from:clean(input.from,160),to:clean(input.to||'*',160),kind:clean(input.kind||'message',100),subject:clean(input.subject,240),payload:input.payload??null,correlationId:clean(input.correlationId,160),createdAt:now(),acknowledgements:[]};if(!envelope.from)return json(res,400,{error:'Envelope requires from node ID'});state.envelopes.push(envelope);prune();persist();emit('envelope',{...envelope,payload:undefined});return json(res,201,{ok:true,envelope})}
    if(pathname==='/api/envelopes'&&req.method==='GET'){const nodeId=clean(url.searchParams.get('nodeId'),160),cursor=clean(url.searchParams.get('cursor'),160),limit=Math.min(200,Math.max(1,Number(url.searchParams.get('limit')||50)));let rows=state.envelopes.filter(item=>!nodeId||item.to==='*'||item.to===nodeId||item.from===nodeId);if(cursor){const index=rows.findIndex(item=>item.id===cursor);if(index>=0)rows=rows.slice(index+1)}rows=rows.slice(-limit);return json(res,200,{envelopes:rows,cursor:rows.at(-1)?.id||cursor||null})}
    const ack=/^\/api\/envelopes\/([^/]+)\/ack$/.exec(pathname);if(ack&&req.method==='POST'){const input=await readBody(req),envelope=state.envelopes.find(item=>item.id===ack[1]);if(!envelope)return json(res,404,{error:'Envelope not found'});const nodeId=clean(input.nodeId,160);if(!nodeId)return json(res,400,{error:'nodeId required'});if(!envelope.acknowledgements.includes(nodeId))envelope.acknowledgements.push(nodeId);persist();return json(res,200,{ok:true,envelopeId:envelope.id})}
    if(pathname==='/api/presence'&&req.method==='POST'){const input=await readBody(req),nodeId=clean(input.nodeId,160);if(!nodeId)return json(res,400,{error:'nodeId required'});state.presence[nodeId]={nodeId,scene:clean(input.scene,120),system:clean(input.system||'civweave',80),activity:clean(input.activity,240),visibility:clean(input.visibility||'node',40),updatedAt:now()};prune();persist();emit('presence',state.presence[nodeId]);return json(res,200,{ok:true,presence:state.presence[nodeId]})}
    if(pathname==='/api/presence'&&req.method==='GET')return json(res,200,{presence:Object.values(state.presence)});
    return json(res,404,{error:'API route not found'});
  }
  if(pathname==='/favicon.ico'){res.writeHead(302,{location:'/app/logos/icon-192.png','cache-control':'public, max-age=86400'});return res.end()}
  if(await serveFile(req,res,pathname))return;
  json(res,404,{error:'Not found'});
}catch(error){console.error(error);json(res,error.status||500,{error:error.message||'Server error'})}});

server.listen(PORT,HOST,()=>console.log(`[Civweave] ${HUB_NAME} listening on http://${HOST}:${PORT} with one direct runtime.`));
async function shutdown(signal){console.log(`[Civweave] ${signal}: closing host node`);server.close();clearTimeout(persistTimer);try{await fsp.writeFile(STATE_FILE,JSON.stringify(state,null,2))}catch{}try{await walletService?.flush?.()}catch{}process.exit(0)}
process.on('SIGTERM',()=>shutdown('SIGTERM'));
process.on('SIGINT',()=>shutdown('SIGINT'));
