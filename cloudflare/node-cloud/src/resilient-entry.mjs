import base,{CivweaveCloudNode,CivweaveCapacityAccount} from './entry.mjs';
import {nodeIdFromHostname} from './index.mjs';
import {CivweaveAnchorRegistry} from './anchor-registry.mjs';

export {CivweaveCloudNode,CivweaveCapacityAccount,CivweaveAnchorRegistry};

const enc=new TextEncoder();
const clean=(value,max=4000)=>String(value??'').trim().slice(0,max);
const json=(value,status=200,headers={})=>Response.json(value,{status,headers:{'cache-control':'no-store',...headers}});

async function sha256Hex(value){const digest=await crypto.subtle.digest('SHA-256',enc.encode(String(value)));return[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('')}
async function secretEqual(left,right){if(!left||!right)return false;const[a,b]=await Promise.all([sha256Hex(left),sha256Hex(right)]);let diff=a.length^b.length;for(let i=0;i<Math.min(a.length,b.length);i+=1)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0}
function bearer(request){const header=clean(request.headers.get('authorization'),12000);return/^Bearer\s+/i.test(header)?header.replace(/^Bearer\s+/i,''):''}
async function operatorAuthorized(request,env){return secretEqual(bearer(request),env.NODE_FABRIC_OPERATOR_TOKEN)}
function anchorStub(env){if(!env.ANCHORS)throw Object.assign(new Error('Anchor registry binding is unavailable.'),{status:503});return env.ANCHORS.get(env.ANCHORS.idFromName('civweave-anchor-registry'))}
async function anchorJson(env,pathname,init={}){const response=await anchorStub(env).fetch(new Request(`https://anchors.internal${pathname}`,init));const payload=await response.json().catch(()=>({}));if(!response.ok)throw Object.assign(new Error(payload.error||`Anchor registry returned HTTP ${response.status}.`),{status:response.status});return payload}
async function baseJson(request,env,ctx){const response=await base.fetch(request,env,ctx),payload=await response.clone().json().catch(()=>({}));if(!response.ok)throw Object.assign(new Error(payload.error||`Base node returned HTTP ${response.status}.`),{status:response.status});return payload}
function cors(){return{'access-control-allow-origin':'*','access-control-allow-methods':'GET, POST, OPTIONS','access-control-allow-headers':'content-type, authorization'}}

async function automaticCheckpoint(env,ctx,nodeId,domain){
  const origin=`https://${nodeId}.${domain}`;
  const[manifestEnvelope,capacityEnvelope,health]=await Promise.all([
    baseJson(new Request(`${origin}/api/ai/node/manifest`),env,ctx),
    baseJson(new Request(`${origin}/api/ai/node/capacity`),env,ctx),
    baseJson(new Request(`${origin}/api/node/health`),env,ctx)
  ]);
  const manifest=manifestEnvelope.manifest||manifestEnvelope;
  return anchorJson(env,'/checkpoint',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
    nodeId,source:'cloudflare-node-daily-snapshot',nodeManifest:manifest,capacitySnapshot:capacityEnvelope,
    ledgerFrontier:{mode:'peer-reconstructable',note:'Shared signed ledger history is recovered from surviving Civweave peers and local devices rather than treated as Cloudflare-owned state.'},
    softwareManifest:{runtime:manifest.runtime||'cloudflare-durable-object-v2',nodeSchema:manifest.schema||'civweave.node.v1',healthSchema:health.schema||'civweave.node-health.v1',runtimeUpdatedAt:manifest.updatedAt||health.updatedAt||new Date().toISOString()},
    recoveryCoverageBps:10000
  })});
}
async function refreshKnownNodes(env,ctx,domain){const{nodes=[]}=await anchorJson(env,'/nodes');const results=[];for(const nodeId of nodes.slice(0,1000)){try{results.push({nodeId,ok:true,...await automaticCheckpoint(env,ctx,nodeId,domain)})}catch(error){results.push({nodeId,ok:false,error:String(error?.message||error)})}}return results}

async function publicAnchorRoute(request,env,nodeId){
  const url=new URL(request.url),headers=cors();
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method==='GET'&&url.pathname==='/api/node/anchor/trust')return json(await anchorJson(env,'/trust'),200,headers);
  if(request.method==='GET'&&url.pathname==='/api/node/anchor/status')return json(await anchorJson(env,`/status?nodeId=${encodeURIComponent(nodeId)}`),200,headers);
  if(request.method==='GET'&&url.pathname==='/api/node/anchor/stipends'){
    const recipientId=clean(url.searchParams.get('recipientId'),240);
    if(!recipientId)return json({ok:false,error:'recipientId-required'},400,headers);
    return json(await anchorJson(env,`/stipends?recipientId=${encodeURIComponent(recipientId)}`),200,headers);
  }
  const mapping=new Map([['/api/node/anchor/pair','/pair'],['/api/node/anchor/sync','/sync'],['/api/node/anchor/proof','/proof']]);
  const target=mapping.get(url.pathname);
  if(target&&request.method==='POST'){
    const input=await request.json().catch(()=>null);
    if(!input)return json({ok:false,error:'invalid-json'},400,headers);
    input.nodeId=nodeId;
    return json(await anchorJson(env,target,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)}),target==='/pair'?201:200,headers);
  }
  return null;
}

async function adminAnchorRoute(request,env,ctx,nodeId,action,domain){
  if(!await operatorAuthorized(request,env))return json({ok:false,error:'forbidden'},403);
  if(action==='status'&&request.method==='GET')return json(await anchorJson(env,`/status?nodeId=${encodeURIComponent(nodeId)}&admin=1`));
  if(action==='pairing'&&request.method==='POST'){
    const input=await request.json().catch(()=>({}));
    const pairing=await anchorJson(env,'/pairing/start',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...input,nodeId})});
    await automaticCheckpoint(env,ctx,nodeId,domain).catch(()=>{});
    return json(pairing,201);
  }
  if(action==='checkpoint'&&request.method==='POST'){
    const input=await request.json().catch(()=>({}));
    const automatic=await automaticCheckpoint(env,ctx,nodeId,domain);
    if(!input.stateEnvelope&&!input.ledgerFrontier&&!input.softwareManifest)return json(automatic,201);
    return json(await anchorJson(env,'/checkpoint',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...input,nodeId,nodeManifest:input.nodeManifest||automatic.checkpoint?.nodeManifest||null,capacitySnapshot:input.capacitySnapshot||automatic.checkpoint?.capacitySnapshot||null,source:clean(input.source||'host-published-recovery-state',120)})}),201);
  }
  if(action==='stipends'&&request.method==='POST')return json(await anchorJson(env,'/stipends/run',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({nodeId})}));
  return null;
}

export default{
  async fetch(request,env,ctx){
    const url=new URL(request.url),domain=env.NODE_DOMAIN||'nodes.commonweave.earth',nodeId=nodeIdFromHostname(url.hostname,domain);
    try{
      if(nodeId&&url.pathname.startsWith('/api/node/anchor/')){const response=await publicAnchorRoute(request,env,nodeId);if(response)return response}
      if(nodeId&&request.method==='GET'&&(url.pathname==='/api/node/manifest'||url.pathname==='/api/ai/node/manifest')){
        const response=await base.fetch(request,env,ctx),payload=await response.json().catch(()=>({}));if(!response.ok)return json(payload,response.status);
        const resilience=await anchorJson(env,`/status?nodeId=${encodeURIComponent(nodeId)}`),manifest=payload.manifest||payload,capabilities=[...new Set([...(Array.isArray(manifest.capabilities)?manifest.capabilities:[]),'local-anchor-recovery'])];
        return json({...payload,manifest:{...manifest,capabilities,resilience},resilience});
      }
      if(nodeId&&request.method==='GET'&&url.pathname==='/api/node/health'){
        const response=await base.fetch(request,env,ctx),payload=await response.json().catch(()=>({}));if(!response.ok)return json(payload,response.status);
        return json({...payload,resilience:await anchorJson(env,`/status?nodeId=${encodeURIComponent(nodeId)}`)});
      }
      const admin=!nodeId&&url.pathname.match(/^\/api\/fabric\/nodes\/([a-zA-Z0-9-]+)\/anchors\/(status|pairing|checkpoint|stipends)$/);
      if(admin){const response=await adminAnchorRoute(request,env,ctx,admin[1].toLowerCase(),admin[2],domain);if(response)return response}
      if(!nodeId&&request.method==='GET'&&url.pathname==='/api/fabric/anchors/trust'){
        if(!await operatorAuthorized(request,env))return json({ok:false,error:'forbidden'},403);
        return json(await anchorJson(env,'/trust'));
      }
      return base.fetch(request,env,ctx);
    }catch(error){return json({ok:false,error:String(error?.message||error)},Number.isSafeInteger(error?.status)?error.status:500,nodeId?cors():{})}
  },
  async scheduled(controller,env,ctx){
    const domain=env.NODE_DOMAIN||'nodes.commonweave.earth';
    const payouts=anchorJson(env,'/stipends/run-all',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({now:controller.scheduledTime||Date.now()})});
    ctx.waitUntil(payouts.then(()=>refreshKnownNodes(env,ctx,domain)).catch(error=>console.error(JSON.stringify({event:'anchor-scheduled-failure',error:String(error?.message||error)}))));
    if(typeof base.scheduled==='function')ctx.waitUntil(Promise.resolve(base.scheduled(controller,env,ctx)));
  }
};
