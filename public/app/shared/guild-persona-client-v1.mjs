/**
 * Browser client for a deliberately shared Guild persona room.
 * The existing Guild Quest / Host Node session owners supply the bearer token.
 * Never stores credentials, packs or source text; never silently retries writes.
 */
import {importCampaignSnapshot} from './persona-campaign-v1.mjs';
export const GUILD_PERSONA_ROUTE='/api/node/persona-campaigns';
const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_:.\/-]{0,95}$/.test(value);
const small=(s,max=200)=>typeof s==='string'?s.trim().slice(0,max):'';
function realSession(x){
 if(!x||!id(x.nodeId)||!id(x.userId)||!/^https:\/\//.test(String(x.origin))||
   !/^[A-Za-z0-9._~+/-]{20,8000}$/.test(String(x.token||'')))
   throw new Error('An authenticated HTTPS Guild member session is required.');
 const u=new URL(x.origin);
 if(u.username||u.password||u.search||u.hash)throw new Error('Invalid Guild endpoint origin.');
 return {nodeId:x.nodeId,userId:x.userId,origin:u.origin,token:x.token};
}
export async function currentPersonaGuildSession(){
 const selected=await globalThis.CivweaveHostNodeSessionV1?.ensureSelected?.();
 if(!selected?.nodeId)throw new Error('Select and authenticate to a Guild before sharing a campaign.');
 const source=globalThis.CivweaveGuildQuestsV1?.sessionForGuild?.(selected.nodeId);
 if(!source)throw new Error('Selected Guild has no authenticated session; sign in first.');
 if(source.nodeId!==selected.nodeId||source.userId!==selected.userId||
   new URL(source.origin).origin!==new URL(selected.origin).origin)
   throw new Error('Guild account or server changed. Reconnect before sharing.');
 return realSession(source);
}
export function createGuildPersonaClient({getSession=currentPersonaGuildSession,send=fetch}={}){
 if(typeof getSession!=='function'||typeof send!=='function')throw new TypeError('Guild session and transport required.');
 const request=async(action,input=null)=>{
  const member=realSession(await getSession());
  const suffix={create:'',snapshot:'/snapshot',dispatch:'/dispatch',draft:'/draft',approve:'/approve','approve-both':'/approve-both','move-draft':'/move-draft','move-approve':'/move-approve'}[action];
  if(suffix===undefined)throw new TypeError('Unsupported Guild campaign action.');
  const url=new URL(GUILD_PERSONA_ROUTE+suffix,member.origin);
  url.searchParams.set('nodeId',member.nodeId);
  if(action==='snapshot'){
    if(!id(input?.campaignId))throw new TypeError('Campaign room ID required.');
    url.searchParams.set('campaignId',input.campaignId);
  }
  if(action==='create'&&!input?.confirmedShare)throw new Error('Explicit sharing consent required.');
  const sendInput=action==='create'?Object.fromEntries(Object.entries(input)
    .filter(([k])=>k!=='confirmedShare')):input;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  try{
   const response=await send(url,{method:action==='snapshot'?'GET':'POST',
    cache:'no-store',credentials:'omit',signal:controller.signal,
    headers:{authorization:'Bearer '+member.token,'x-civweave-node-id':member.nodeId,
     accept:'application/json',...(action==='snapshot'?{}:{'content-type':'application/json'})},
    ...(action==='snapshot'?{}:{body:JSON.stringify(sendInput)})});
   const packet=await response.json().catch(()=>({}));
   if(!response.ok||packet.ok!==true){
    const error=new Error(small(packet.error,500)||'Guild persona route failed ('+response.status+').');
    error.status=response.status;throw error;
   }
   if(packet.schema!=='civweave.guild-persona-room.v1'||packet.serverAuthoritative!==true||
      packet.room?.schema!=='civweave.persona-campaign.v1')throw new Error('Invalid authoritative Guild room packet.');
   if(packet.room.id!== (action==='create'?packet.room.id:input.campaignId))
    throw new Error('Server returned a different campaign room.');
   if(action==='create'&&packet.room.ownerId!=='member:'+member.userId)
    throw new Error('Campaign owner does not match the authenticated Guild member.');
   return {room:packet.room,
     ...(action==='snapshot'?{
       pendingDrafts:Array.isArray(packet.pendingDrafts)?packet.pendingDrafts:[],
       world:packet.world||null,
       motion:packet.motion||null,
       pendingMoves:Array.isArray(packet.pendingMoves)?packet.pendingMoves:[]
     }:{}),
     ...(action==='draft'?{draft:packet.draft}:{}),
     ...(action==='move-draft'?{motionDraft:packet.motionDraft}:{}),
     ...(action==='move-approve'?{movement:packet.movement,
       worldReceiptId:packet.worldReceiptId,motion:packet.motion}:{}),
     ...(action==='approve'?{worldReceiptId:packet.worldReceiptId,
       world:packet.world,speech:packet.speech}:{}),
     ...(action==='approve-both'?{worldReceiptIds:packet.worldReceiptIds,
       world:packet.world,speech:packet.speech,bothSpoke:packet.bothSpoke}:{}),
     scope:{origin:member.origin,nodeId:member.nodeId,userId:member.userId}};
  }catch(error){if(error.name==='AbortError')throw new Error('Guild campaign request timed out. Refresh before retrying a write.');throw error}
  finally{clearTimeout(timer)}
 };
 return Object.freeze({
   create:async({pack,cast,title,stage,scenario,confirmedShare=false})=>{
     if(!pack?.id||!Array.isArray(cast)||cast.length<1||cast.length>12)
       throw new TypeError('Select a bounded cast manifest first.');
     const characters=cast.map(characterId=>{
       const row=pack.characters?.find(c=>c.id===characterId);
       if(!row)throw new Error('An unknown character was selected.');
       // Deliberately project ONLY public names and IDs. No authored traits,
       // private memories, manuscript quotes, source events or 4B prompts.
       return {id:row.id,name:row.name};
     });
     return request('create',{packId:pack.id,packVersion:pack.version||1,
       characters,cast,title,stage,scenario,confirmedShare});
   },
   snapshot:campaignId=>request('snapshot',{campaignId}),
   dispatch:(campaignId,expectedRevision,command)=>request('dispatch',{campaignId,expectedRevision,command}),
   draft:(campaignId,expectedRevision,{characterId,speech,emote,actions})=>
     request('draft',{campaignId,expectedRevision,characterId,speech,emote,actions}),
   approve:(campaignId,expectedRevision,draftId)=>
     request('approve',{campaignId,expectedRevision,draftId}),
   approveBoth:(campaignId,expectedRevision,draftIds)=>
     request('approve-both',{campaignId,expectedRevision,draftIds}),
   draftMove:(campaignId,expectedRevision,characterId,to)=>
     request('move-draft',{campaignId,expectedRevision,characterId,to}),
   approveMove:(campaignId,expectedRevision,draftId)=>
     request('move-approve',{campaignId,expectedRevision,draftId}),
   validateRoom:(raw,{pack})=>importCampaignSnapshot(JSON.stringify(raw),{pack})
 });
}
