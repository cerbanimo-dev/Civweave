import baseWorker,{CivweaveAccountDirectory} from './server-ai-entry-v5.mjs';
import {CivweaveCloudNode} from './cloud-node-guild-sync-v1.mjs';
import {CivweaveCapacityAccount} from './capacity-guildkeeper-v1.mjs';
import {normalizeNodeId} from './index.mjs';

export {CivweaveCloudNode,CivweaveCapacityAccount,CivweaveAccountDirectory};
export const GUILDKEEPER_ADMIN_ROUTE='/api/fabric/capacity/guildkeepers';
export const GUILD_BOOTSTRAP_ROUTE='/api/fabric/guilds/bootstrap';
const enc=new TextEncoder();
const json=(value,status=200,extraHeaders={})=>Response.json(value,{status,headers:{'cache-control':'no-store',...extraHeaders}});
const bootstrapCors=Object.freeze({'access-control-allow-origin':'*','access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'content-type','access-control-max-age':'86400'});
const clean=(value,max=4000)=>String(value??'').trim().slice(0,max);
async function secretEqual(left,right){const a=String(left||''),b=String(right||'');if(!a||!b)return false;const [da,db]=await Promise.all([crypto.subtle.digest('SHA-256',enc.encode(a)),crypto.subtle.digest('SHA-256',enc.encode(b))]);const aa=new Uint8Array(da),bb=new Uint8Array(db);let diff=aa.length^bb.length;for(let i=0;i<Math.min(aa.length,bb.length);i++)diff|=aa[i]^bb[i];return diff===0}
function capacityStub(env){if(!env.CAPACITY)throw Object.assign(new Error('Capacity Durable Object binding is unavailable.'),{status:503});return env.CAPACITY.get(env.CAPACITY.idFromName('civweave-account'))}
async function guildkeeperAdmin(request,env,action){
  const token=String(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');if(!await secretEqual(token,env.NODE_FABRIC_OPERATOR_TOKEN))return json({ok:false,error:'forbidden'},403);
  const response=await capacityStub(env).fetch(`https://capacity.internal/guildkeepers/${action}`,{method:'POST',headers:{'content-type':'application/json'},body:await request.text()});return new Response(response.body,{status:response.status,headers:response.headers});
}
function publicFabricOrigin(request,env){
  const source=clean(env.PUBLIC_FABRIC_ORIGIN,2000)||new URL(request.url).origin;
  const url=new URL(source);if(url.protocol!=='https:')throw Object.assign(new Error('Public Guild fabric origin must use HTTPS.'),{status:503});return url.origin;
}
async function bootstrapGuild(request,env){
  if(!env.NODES||!env.NODE_FABRIC_BINDING_TOKEN)return json({ok:false,error:'Guild cloud fabric is unavailable.'},503,bootstrapCors);
  const input=await request.json().catch(()=>({})),guildId=normalizeNodeId(input.guildId),displayName=clean(input.displayName,180),syncKey=clean(input.syncKey,220),foundingDeviceId=clean(input.foundingDeviceId,500);
  if(!guildId||guildId!==clean(input.guildId,180).toLowerCase())return json({ok:false,error:'A normalized Guild id is required.'},400,bootstrapCors);
  if(!displayName)return json({ok:false,error:'Guild display name is required.'},400,bootstrapCors);
  if(!/^[A-Za-z0-9_-]{40,200}$/.test(syncKey))return json({ok:false,error:'A high-entropy Guild sync key is required.'},400,bootstrapCors);
  if(!foundingDeviceId)return json({ok:false,error:'Founding Pocket Guild Node identity is required.'},400,bootstrapCors);
  const stub=env.NODES.get(env.NODES.idFromName(guildId));
  const response=await stub.fetch(`https://node.internal/internal/guild-bootstrap?nodeId=${encodeURIComponent(guildId)}`,{method:'POST',headers:{'content-type':'application/json','x-civweave-node-id':guildId,'x-civweave-fabric-token':env.NODE_FABRIC_BINDING_TOKEN},body:JSON.stringify({guildId,displayName,syncKey,foundingDeviceId})});
  const payload=await response.json().catch(()=>({}));if(!response.ok)return json({ok:false,error:payload.error||`Guild cloud bootstrap returned HTTP ${response.status}.`},response.status,bootstrapCors);
  const primaryOrigin=publicFabricOrigin(request,env),primaryGateway=new URL(`/n/${encodeURIComponent(guildId)}/`,`${primaryOrigin}/`).href;
  return json({ok:true,schema:'civweave.mobile-guild-cloud-bootstrap.v1',guildId,displayName,primaryOrigin,primaryGateway,cloudAttached:true,cloudRuntime:'cloudflare-durable-object',capacityGranted:false,bootstrap:payload},payload.idempotent?200:201,bootstrapCors);
}
export default{
  async fetch(request,env,ctx){
    const url=new URL(request.url),prefix=`${GUILDKEEPER_ADMIN_ROUTE}/`,action=url.pathname.startsWith(prefix)?url.pathname.slice(prefix.length):'';
    if(url.pathname===GUILD_BOOTSTRAP_ROUTE){if(request.method==='OPTIONS')return new Response(null,{status:204,headers:bootstrapCors});if(request.method!=='POST')return json({ok:false,error:'Method not allowed.'},405,bootstrapCors);try{return await bootstrapGuild(request,env)}catch(error){return json({ok:false,error:String(error?.message||error)},Number.isSafeInteger(error?.status)?error.status:500,bootstrapCors)}}
    if(['appoint','remove','status'].includes(action)){if(request.method!=='POST')return json({ok:false,error:'Method not allowed.'},405);return guildkeeperAdmin(request,env,action)}return baseWorker.fetch(request,env,ctx)},
  async scheduled(controller,env,ctx){if(typeof baseWorker.scheduled==='function')return baseWorker.scheduled(controller,env,ctx)}
};
