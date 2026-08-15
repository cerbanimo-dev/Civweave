import baseWorker,{CivweaveCloudNode,CivweaveAccountDirectory} from './server-ai-entry-v5.mjs';
import {CivweaveCapacityAccount} from './capacity-guildkeeper-v1.mjs';

export {CivweaveCloudNode,CivweaveCapacityAccount,CivweaveAccountDirectory};
export const GUILDKEEPER_ADMIN_ROUTE='/api/fabric/capacity/guildkeepers';
const enc=new TextEncoder();
const json=(value,status=200)=>Response.json(value,{status,headers:{'cache-control':'no-store'}});
async function secretEqual(left,right){const a=String(left||''),b=String(right||'');if(!a||!b)return false;const [da,db]=await Promise.all([crypto.subtle.digest('SHA-256',enc.encode(a)),crypto.subtle.digest('SHA-256',enc.encode(b))]);const aa=new Uint8Array(da),bb=new Uint8Array(db);let diff=aa.length^bb.length;for(let i=0;i<Math.min(aa.length,bb.length);i++)diff|=aa[i]^bb[i];return diff===0}
function capacityStub(env){if(!env.CAPACITY)throw Object.assign(new Error('Capacity Durable Object binding is unavailable.'),{status:503});return env.CAPACITY.get(env.CAPACITY.idFromName('civweave-account'))}
async function guildkeeperAdmin(request,env,action){
  const token=String(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');if(!await secretEqual(token,env.NODE_FABRIC_OPERATOR_TOKEN))return json({ok:false,error:'forbidden'},403);
  const response=await capacityStub(env).fetch(`https://capacity.internal/guildkeepers/${action}`,{method:'POST',headers:{'content-type':'application/json'},body:await request.text()});return new Response(response.body,{status:response.status,headers:response.headers});
}
export default{
  async fetch(request,env,ctx){const url=new URL(request.url),prefix=`${GUILDKEEPER_ADMIN_ROUTE}/`,action=url.pathname.startsWith(prefix)?url.pathname.slice(prefix.length):'';if(['appoint','remove','status'].includes(action)){if(request.method!=='POST')return json({ok:false,error:'Method not allowed.'},405);return guildkeeperAdmin(request,env,action)}return baseWorker.fetch(request,env,ctx)},
  async scheduled(controller,env,ctx){if(typeof baseWorker.scheduled==='function')return baseWorker.scheduled(controller,env,ctx)}
};
