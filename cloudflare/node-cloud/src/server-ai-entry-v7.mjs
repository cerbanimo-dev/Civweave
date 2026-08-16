import baseWorker,{CivweaveCloudNode as BaseCloudNode,CivweaveCapacityAccount,CivweaveAccountDirectory} from './server-ai-entry-v6.mjs';

export {CivweaveCapacityAccount,CivweaveAccountDirectory};

const CHAT_CORS=Object.freeze({
  'cache-control':'no-store',
  'access-control-allow-origin':'*',
  'access-control-allow-methods':'GET, POST, OPTIONS',
  'access-control-allow-headers':'authorization, content-type, x-civweave-node-id',
  'access-control-max-age':'86400'
});
const CHAT_SCHEMA='civweave.human-group.transport-envelope.v1';
const MAX_ENVELOPES=1200;
const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const json=(value,status=200)=>Response.json(value,{status,headers:CHAT_CORS});
const now=()=>new Date().toISOString();
function randomKey(){const bytes=crypto.getRandomValues(new Uint8Array(32));let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary).replaceAll('+','-').replaceAll('/','_').replace(/=+$/g,'')}
function chatChannelId(value){const id=clean(value,300);if(!/^(guild|party):[A-Za-z0-9:_-]{3,280}$/.test(id))throw Object.assign(new TypeError('A valid Guild or Party chat channel id is required.'),{status:400});return id}
function normalizedTransportEnvelope(input,nodeId){
  const channelId=chatChannelId(input?.channelId),messageId=clean(input?.messageId,300),guildId=clean(input?.guildId,180);
  if(!messageId||guildId!==nodeId)throw Object.assign(new TypeError('Guild relay envelope must include its Guild id and message id.'),{status:400});
  return Object.freeze({schema:CHAT_SCHEMA,channelId,messageId,guildId,payload:input?.payload??null,createdAt:clean(input?.createdAt,80)||now()});
}

export class CivweaveCloudNode extends BaseCloudNode{
  async humanGroupKey(nodeId,channelId){
    const expected=`guild:${nodeId}`;if(channelId!==expected)throw Object.assign(new Error('Only the authenticated Guild Hall owns a server-held channel key.'),{status:403});
    const storageKey=`human-group-key:${channelId}`;let record=await this.state.storage.get(storageKey);
    if(!record?.key){record={schema:'civweave.human-group.guild-key.v1',channelId,key:randomKey(),createdAt:now()};await this.state.storage.put(storageKey,record)}
    return record
  }
  async humanGroupEnvelopes(nodeId){const rows=await this.state.storage.get('human-group-envelopes');return(Array.isArray(rows)?rows:[]).filter(row=>row?.guildId===nodeId)}
  async fetch(request){
    const url=new URL(request.url),nodeId=clean(request.headers.get('x-civweave-node-id')||url.searchParams.get('nodeId'),180);
    if(nodeId&&url.pathname==='/internal/human-group/channel-key'&&request.method==='GET'){
      try{return json({ok:true,key:await this.humanGroupKey(nodeId,chatChannelId(url.searchParams.get('channelId')))});}catch(error){return json({ok:false,error:String(error?.message||error)},Number.isSafeInteger(error?.status)?error.status:500)}
    }
    if(nodeId&&url.pathname==='/internal/human-group/envelopes'&&request.method==='POST'){
      try{const envelope=normalizedTransportEnvelope(await request.json().catch(()=>({})),nodeId),rows=await this.humanGroupEnvelopes(nodeId),existing=rows.find(row=>row.messageId===envelope.messageId);if(existing)return json({ok:true,envelope:existing,deduped:true});const stored={...envelope,id:`hge:${crypto.randomUUID()}`,receivedAt:now()};rows.push(stored);await this.state.storage.put('human-group-envelopes',rows.slice(-MAX_ENVELOPES));return json({ok:true,envelope:stored},201)}catch(error){return json({ok:false,error:String(error?.message||error)},Number.isSafeInteger(error?.status)?error.status:500)}
    }
    if(nodeId&&url.pathname==='/internal/human-group/envelopes'&&request.method==='GET'){
      const rows=await this.humanGroupEnvelopes(nodeId),cursor=clean(url.searchParams.get('cursor'),300),limit=Math.max(1,Math.min(300,Number(url.searchParams.get('limit'))||200));let selected=rows;if(cursor){const index=rows.findIndex(row=>row.id===cursor);if(index>=0)selected=rows.slice(index+1)}selected=selected.slice(-limit);return json({ok:true,envelopes:selected,cursor:selected.at(-1)?.id||cursor||null})
    }
    return super.fetch(request)
  }
}

function nodeStub(env,nodeId){if(!env.NODES)throw Object.assign(new Error('Guild Durable Object binding is unavailable.'),{status:503});return env.NODES.get(env.NODES.idFromName(nodeId))}
async function authenticatedMember(request,env,ctx){
  const source=new URL(request.url),sessionUrl=new URL('/api/ai/node/session',source.origin),explicitNode=clean(source.searchParams.get('nodeId')||request.headers.get('x-civweave-node-id'),180);
  if(explicitNode)sessionUrl.searchParams.set('nodeId',explicitNode);const headers=new Headers({accept:'application/json'}),authorization=clean(request.headers.get('authorization'),20000);if(authorization)headers.set('authorization',authorization);if(explicitNode)headers.set('x-civweave-node-id',explicitNode);
  const response=await baseWorker.fetch(new Request(sessionUrl,{method:'GET',headers}),env,ctx),payload=await response.json().catch(()=>({}));if(!response.ok)throw Object.assign(new Error(payload.error||'Guild member session is invalid.'),{status:response.status||401});
  const nodeId=clean(payload.nodeId||payload.member?.nodeId||explicitNode,180),userId=clean(payload.userId||payload.member?.userId,180);if(!nodeId||!userId)throw Object.assign(new Error('Guild member session did not resolve a resident.'),{status:401});return{nodeId,userId}
}
async function callNode(env,nodeId,request,pathname){const url=new URL(request.url);url.pathname=pathname;url.searchParams.set('nodeId',nodeId);const headers=new Headers(request.headers);headers.set('x-civweave-node-id',nodeId);headers.delete('authorization');return nodeStub(env,nodeId).fetch(new Request(url,{method:request.method,headers,body:['GET','HEAD'].includes(request.method)?undefined:request.body}))}
async function handleChat(request,env,ctx){
  try{
    const member=await authenticatedMember(request,env,ctx),url=new URL(request.url);
    if(url.pathname==='/api/chat/channel-key'){
      if(request.method!=='GET')return json({ok:false,error:'Method not allowed.'},405);const internal=new URL(request.url);internal.searchParams.set('channelId',chatChannelId(url.searchParams.get('channelId')));const response=await callNode(env,member.nodeId,new Request(internal,{method:'GET'}),'/internal/human-group/channel-key');return new Response(response.body,{status:response.status,headers:CHAT_CORS})
    }
    if(url.pathname==='/api/chat/envelopes'){
      if(request.method==='POST'){const body=await request.json().catch(()=>({}));const envelope=normalizedTransportEnvelope(body,member.nodeId);const response=await callNode(env,member.nodeId,new Request(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(envelope)}),'/internal/human-group/envelopes');return new Response(response.body,{status:response.status,headers:CHAT_CORS})}
      if(request.method==='GET'){const response=await callNode(env,member.nodeId,new Request(url,{method:'GET'}),'/internal/human-group/envelopes');return new Response(response.body,{status:response.status,headers:CHAT_CORS})}
      return json({ok:false,error:'Method not allowed.'},405)
    }
    return json({ok:false,error:'Not found.'},404)
  }catch(error){return json({ok:false,error:String(error?.message||error)},Number.isSafeInteger(error?.status)?error.status:500)}
}

export default{
  async fetch(request,env,ctx){const url=new URL(request.url);if(url.pathname.startsWith('/api/chat/')){if(request.method==='OPTIONS')return new Response(null,{status:204,headers:CHAT_CORS});return handleChat(request,env,ctx)}return baseWorker.fetch(request,env,ctx)},
  async scheduled(controller,env,ctx){if(typeof baseWorker.scheduled==='function')return baseWorker.scheduled(controller,env,ctx)}
};