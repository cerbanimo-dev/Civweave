import baseWorker,{CivweaveCloudNode,CivweaveAccountDirectory} from './server-ai-entry-v5.mjs';
import {CivweaveCapacityAccount} from './capacity-guildkeeper-v1.mjs';

export {CivweaveCloudNode,CivweaveCapacityAccount,CivweaveAccountDirectory};
export const GUILDKEEPER_ADMIN_ROUTE='/api/fabric/capacity/guildkeepers';
const enc=new TextEncoder();
const json=(value,status=200,headers={})=>Response.json(value,{status,headers:{'cache-control':'no-store',...headers}});
const clean=(value,max=180)=>String(value??'').trim().slice(0,max);
async function secretEqual(left,right){const a=String(left||''),b=String(right||'');if(!a||!b)return false;const [da,db]=await Promise.all([crypto.subtle.digest('SHA-256',enc.encode(a)),crypto.subtle.digest('SHA-256',enc.encode(b))]);const aa=new Uint8Array(da),bb=new Uint8Array(db);let diff=aa.length^bb.length;for(let i=0;i<Math.min(aa.length,bb.length);i++)diff|=aa[i]^bb[i];return diff===0}
function capacityStub(env){if(!env.CAPACITY)throw Object.assign(new Error('Capacity Durable Object binding is unavailable.'),{status:503});return env.CAPACITY.get(env.CAPACITY.idFromName('civweave-account'))}
async function guildkeeperAdmin(request,env,action){
  const token=String(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');if(!await secretEqual(token,env.NODE_FABRIC_OPERATOR_TOKEN))return json({ok:false,error:'forbidden'},403);
  const response=await capacityStub(env).fetch(`https://capacity.internal/guildkeepers/${action}`,{method:'POST',headers:{'content-type':'application/json'},body:await request.text()});return new Response(response.body,{status:response.status,headers:response.headers});
}
function apiRequest(url){return url.pathname.includes('/api/')}
function expensiveRequest(request,url){
  if(request.method!=='POST')return false;
  return ['/api/ai/node/generate','/api/ai/node/validation','/api/browser/tool'].some(path=>url.pathname.endsWith(path));
}
async function digestKey(value){
  const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(String(value||''))));
  return [...bytes].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
async function rateActor(request,url){
  const nodeId=clean(request.headers.get('x-civweave-node-id')||url.searchParams.get('nodeId')||'guild',180);
  const authorization=String(request.headers.get('authorization')||'').trim();
  if(authorization)return`${nodeId}:auth:${await digestKey(authorization)}`;
  if(request.method==='POST'&&url.pathname.endsWith('/api/ai/node/session')){
    const input=await request.clone().json().catch(()=>({})),userId=clean(input?.userId,180);
    if(userId)return`${nodeId}:resident:${await digestKey(userId)}`;
  }
  const ip=clean(request.headers.get('cf-connecting-ip')||'anonymous',80);
  return`${nodeId}:public:${await digestKey(`${ip}\n${url.pathname}`)}`;
}
function limited(kind,retryAfter=60){
  return json({ok:false,error:'Guild request rate limit exceeded.',code:'CIVWEAVE_GUILD_RATE_LIMIT',kind,retryAfter},429,{
    'content-type':'application/json; charset=utf-8',
    'retry-after':String(retryAfter),
    'access-control-allow-origin':'*',
    'access-control-allow-headers':'authorization, content-type, x-civweave-node-id',
    'access-control-expose-headers':'retry-after',
  });
}
async function enforceRateLimits(request,env,url){
  if(request.method==='OPTIONS'||!apiRequest(url))return null;
  const actor=await rateActor(request,url);
  if(env.GUILD_API_RATE_LIMITER?.limit){
    const result=await env.GUILD_API_RATE_LIMITER.limit({key:`api:${actor}`});
    if(!result?.success)return limited('api');
  }
  if(expensiveRequest(request,url)&&env.GUILD_AI_RATE_LIMITER?.limit){
    const result=await env.GUILD_AI_RATE_LIMITER.limit({key:`ai:${actor}`});
    if(!result?.success)return limited('ai');
  }
  return null;
}
export default{
  async fetch(request,env,ctx){
    const url=new URL(request.url),rateLimited=await enforceRateLimits(request,env,url);if(rateLimited)return rateLimited;
    const prefix=`${GUILDKEEPER_ADMIN_ROUTE}/`,action=url.pathname.startsWith(prefix)?url.pathname.slice(prefix.length):'';if(['appoint','remove','status'].includes(action)){if(request.method!=='POST')return json({ok:false,error:'Method not allowed.'},405);return guildkeeperAdmin(request,env,action)}return baseWorker.fetch(request,env,ctx)
  },
  async scheduled(controller,env,ctx){if(typeof baseWorker.scheduled==='function')return baseWorker.scheduled(controller,env,ctx)}
};
