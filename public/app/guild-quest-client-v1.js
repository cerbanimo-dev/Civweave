(()=>{
'use strict';
if(globalThis.CivweaveGuildQuestsV1)return;
const VERSION='1.0.0';
const clean=(value,max=1800)=>String(value??'').trim().slice(0,max);
const field=(value,max=180)=>typeof value==='string'?value.trim().slice(0,max):'';
const list=value=>Array.isArray(value)?value:[];
function sessionOwner(){try{if(parent!==globalThis&&parent.location.origin===location.origin&&parent.CivweaveHostNodeSessionV1)return parent.CivweaveHostNodeSessionV1}catch{}return globalThis.CivweaveHostNodeSessionV1||null}
function sessionForGuild(guild){
  const id=clean(typeof guild==='string'?guild:guild?.id||guild?.nodeId,180);
  const session=id?sessionOwner()?.sessionFor?.(id):null;
  if(!session||session.nodeId!==id||!session.userId||!session.token||session.expiresAt&&Date.parse(session.expiresAt)<=Date.now())return null;
  try{const url=new URL(session.origin);if(url.protocol!=='https:'||url.username||url.password)return null;return session}catch{return null}
}
function preview(raw){
  if(raw?.kind!=='weave-plan'||raw?.plan?.schema!=='civweave.intention-weave.v1')throw new TypeError('Only a saved Weaveling Quest can be submitted to a Guild.');
  const source=raw.plan,id=field(raw.id||source.id),title=field(source.title||raw.text,240);
  if(!id||!/^[A-Za-z0-9:_-]+$/.test(id))throw new TypeError('A valid Quest identifier is required.');
  if(source.id&&source.id!==id)throw new TypeError('Quest and plan identifiers must match.');
  if(!title)throw new TypeError('A Quest title is required.');
  const state=field(raw.state||source.state,40)||'review',paths=list(source.paths||source.tracks);
  if(paths.length>12)throw new TypeError('A shared Quest may contain at most 12 paths.');
  const projectedPaths=paths.map(path=>{
    const sourceSteps=list(path?.steps||path?.tasks);if(sourceSteps.length>64)throw new TypeError('A shared Quest path may contain at most 64 steps.');
    const indexedSteps=sourceSteps.map((step,index)=>({index,step:typeof step==='string'?field(step,2000):{id:field(step?.id||step?.taskId),title:field(step?.title||step?.name||step?.label||step?.description,2000),description:field(step?.description,2000),status:field(step?.status,40)}})).filter(({step})=>typeof step==='string'?Boolean(step):Boolean(step.title));
    const steps=indexedSteps.map(({step})=>step),progressIndices=new Map(indexedSteps.map(({index},projectedIndex)=>[index,projectedIndex]));
    return{id:field(path?.id),type:field(path?.type,80),realm:field(path?.realm||path?.system,80),title:field(path?.title,240),purpose:field(path?.purpose,2000),status:field(path?.status,40),completionCriteria:field(path?.completionCriteria,2000),steps,progress:[...new Set(list(path?.progress).filter(index=>Number.isSafeInteger(index)&&progressIndices.has(index)).map(index=>progressIndices.get(index)))]};
  });
  const needs=list(raw.needs||source.needs);if(needs.length>32)throw new TypeError('A shared Quest may contain at most 32 open needs.');
  return{id,kind:'weave-plan',text:title,state,plan:{schema:'civweave.intention-weave.v1',id,title,outcome:field(source.outcome,4000),state,paths:projectedPaths},needs:needs.map(need=>typeof need==='string'?field(need,2000):{title:field(need?.title||need?.name||need?.description,2000),realm:field(need?.realm||need?.system,80),status:field(need?.status,40)}).filter(need=>typeof need==='string'?Boolean(need):Boolean(need.title))};
}
function validPublication(row,guildId=''){
  const identifier=value=>typeof value==='string'&&/^[A-Za-z0-9:_-]{1,180}$/.test(value);
  return row?.schema==='civweave.guild-quest-publication.v1'&&/^guild-quest:[a-f0-9]{64}$/.test(row.id)&&identifier(row.guildId)&&identifier(row.nodeId)&&identifier(row.authorUserId)&&(!guildId||row.guildId===guildId)&&Number.isSafeInteger(row.revision)&&row.revision>0&&['published','withdrawn'].includes(row.status)&&row.quest?.kind==='weave-plan'&&row.quest?.plan?.schema==='civweave.intention-weave.v1';
}
async function request(guild,path,{method='GET',body=null,cursor=''}={}){
  const session=sessionForGuild(guild);if(!session)throw new Error('Log in to this Guild to view or submit its Quests.');
  if(navigator.onLine===false)throw new Error('Reconnect to load or submit Guild Quests. Your local Quests remain on this device.');
  const url=new URL(path,session.origin);url.searchParams.set('nodeId',session.nodeId);if(cursor)url.searchParams.set('cursor',clean(cursor,2000));
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
  try{
    const response=await fetch(url,{method,cache:'no-store',credentials:'omit',signal:controller.signal,headers:{accept:'application/json',authorization:`Bearer ${session.token}`,'x-civweave-node-id':session.nodeId,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok||payload.ok!==true){const error=new Error(clean(payload.error||`Guild returned HTTP ${response.status}.`,1200));error.status=response.status;throw error}
    if(payload.nodeId&&payload.nodeId!==session.nodeId)throw new Error('The Guild returned a Quest for a different session.');
    if(path==='/api/node/quests'&&(payload.nodeId!==session.nodeId||!payload.guildId||!Array.isArray(payload.quests)||payload.quests.length>100||payload.quests.some(row=>!validPublication(row,payload.guildId)||row.status!=='published')))throw new Error('The Guild returned an invalid shared Quest board.');
    if(payload.publication&&!validPublication(payload.publication))throw new Error('The Guild returned an invalid Quest publication.');
    return payload;
  }catch(error){if(error.name==='AbortError')throw new Error('The Guild did not respond. Retry when it is available.');throw error}finally{clearTimeout(timeout)}
}
async function ownPublication(guild,quest,{guildId}={}){
  const session=sessionForGuild(guild);if(!session)throw new Error('Log in to this Guild before submitting a Quest.');
  if(!guildId)throw new Error('Refresh Guild Quests before preparing this submission.');
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${guildId}\n${session.userId}\n${quest.id}`)),id='guild-quest:'+Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('');
  try{const packet=await request(guild,`/api/node/quests/${encodeURIComponent(id)}`),row=packet.publication;if(!row||row.id!==id||row.guildId!==guildId||row.authorUserId!==session.userId)throw new Error('The Guild returned a different author’s Quest.');return row}catch(error){if(error.status===404)return null;throw error}
}
const api=Object.freeze({version:VERSION,preview,sessionForGuild,ownPublication,restoreSelected:()=>sessionOwner()?.ensureSelected?.()||Promise.resolve(null),list:(guild,{cursor=''}={})=>request(guild,'/api/node/quests',{cursor}),publish:(guild,quest,{expectedRevision=0}={})=>request(guild,'/api/node/quests/publish',{method:'POST',body:{quest:preview(quest),expectedRevision}}),withdraw:(guild,publication)=>request(guild,`/api/node/quests/${encodeURIComponent(publication.id)}/withdraw`,{method:'POST',body:{expectedRevision:publication.revision}})});
globalThis.CivweaveGuildQuestsV1=api;
})();
