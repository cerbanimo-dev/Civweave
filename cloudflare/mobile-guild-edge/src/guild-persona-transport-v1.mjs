import {GUILD_PERSONA_ROUTE,executeGuildPersonaAction} from './guild-persona-campaign-v1.mjs';
import {guildQuestJson,guildQuestError,readGuildQuestInput} from './guild-quest-publications-v1.mjs';

/** The public handler always delegates to the existing verified Guild session. */
export function guildPersonaAction(request){
 const url=new URL(request.url),tail=url.pathname.slice(GUILD_PERSONA_ROUTE.length);
 if(!tail&&request.method==='POST')return'create';
 if(tail==='/snapshot'&&request.method==='GET')return'snapshot';
 if(tail==='/dispatch'&&request.method==='POST')return'dispatch';
 if(tail==='/draft'&&request.method==='POST')return'draft';
 if(tail==='/approve'&&request.method==='POST')return'approve';
 if(tail==='/approve-both'&&request.method==='POST')return'approve-both';
 if(tail==='/move-draft'&&request.method==='POST')return'move-draft';
 if(tail==='/move-approve'&&request.method==='POST')return'move-approve';
 throw Object.assign(new Error('Private persona route or method is unsupported.'),{status:405});
}
async function internalSecret(env){
 const secret=String(env.NODE_FABRIC_SESSION_SECRET||env.NODE_FABRIC_OPERATOR_TOKEN||'');
 if(secret.length<24)throw Object.assign(new Error('Guild persona internal authority unavailable.'),{status:503});
 const raw=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('civweave.guild-persona-internal.v1\0'+secret));
 return [...new Uint8Array(raw)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function secureEqual(a,b){
 if(typeof a!=='string'||typeof b!=='string'||!a||a.length!==b.length)return false;
 const x=new TextEncoder().encode(a),y=new TextEncoder().encode(b);
 let n=0;for(let i=0;i<x.length;i++)n|=x[i]^y[i];return n===0;
}
export async function handleGuildPersonaRequest(request,env,authenticate,nodeStub){
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{
  'access-control-allow-origin':'*','access-control-allow-methods':'GET, POST, OPTIONS',
  'access-control-allow-headers':'authorization, content-type, x-civweave-node-id',
  'access-control-max-age':'86400','cache-control':'no-store'}});
 try{
  // The verified identity comes from the same member-session owner as Starling.
  const member=await authenticate(),action=guildPersonaAction(request);
  const input=action==='snapshot'?
    {campaignId:new URL(request.url).searchParams.get('campaignId')}:
    await readGuildQuestInput(request); // existing bounded 96 KiB reader
  if(!member?.nodeId||!member?.userId)throw Object.assign(new Error('Authenticated Guild member required.'),{status:401});
  const nodeId=member.nodeId,{stub}=nodeStub(env,nodeId),token=await internalSecret(env);
  const response=await stub.fetch('https://node.internal/internal/guild-persona?nodeId='+encodeURIComponent(nodeId),{
   method:'POST',headers:{'content-type':'application/json','x-civweave-node-id':nodeId,
    'x-civweave-internal-persona':token},
   body:JSON.stringify({member:{nodeId,userId:member.userId},action,input})
  });
  const headers=new Headers(response.headers);
  headers.set('access-control-allow-origin','*');
  headers.set('access-control-allow-methods','GET, POST, OPTIONS');
  headers.set('access-control-allow-headers','authorization, content-type, x-civweave-node-id');
  headers.set('cache-control','no-store');
  return new Response(response.body,{status:response.status,headers});
 }catch(error){return guildQuestError(error)}
}
/** Internal DO transport refuses direct external HTTP calls, even with forged IDs. */
export async function handleGuildPersonaInternal(request,node){
 try{
  if(request.method!=='POST')throw Object.assign(new Error('Method not allowed.'),{status:405});
  const token=request.headers.get('x-civweave-internal-persona');
  if(!await secureEqual(token,await internalSecret(node.env)))
    throw Object.assign(new Error('Guild persona internal authorization required.'),{status:403});
  const body=await readGuildQuestInput(request),nodeId=request.headers.get('x-civweave-node-id');
  if(!nodeId||body.member?.nodeId!==nodeId||new URL(request.url).searchParams.get('nodeId')!==nodeId)
    throw Object.assign(new Error('Private persona Guild scope mismatch.'),{status:403});
  const result=await executeGuildPersonaAction(node.state.storage,body.member,body.action,body.input,{nodeId});
  return guildQuestJson(result,body.action==='create'?201:200);
 }catch(error){return guildQuestError(error)}
}
