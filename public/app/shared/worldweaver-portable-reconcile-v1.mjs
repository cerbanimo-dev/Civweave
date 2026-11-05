/**
 * Portable Worldweaver → existing Civweave authority boundaries.
 * This module does not authenticate, persist, publish, or send network requests.
 * Guild verification is delegated to CivweaveHostNodeSessionV1;
 * reviewed personal actions are delegated to the canonical Action Board owner;
 * private journal material is delegated to CivweaveLocalMeshV146.
 */
import {normalizeAction,normalizeStore} from './action-board-core-v1.mjs';

export const PORTABLE_HANDOFF_SCHEMA='civweave.portable-local-drafts.v1';
const ID=/^[A-Za-z0-9:_-]{1,96}$/;
const DRAFT_ID=/^[A-Za-z0-9:_-]{1,80}$/;
const clean=(x,n)=>String(x??'').trim().slice(0,n);
const list=x=>Array.isArray(x)?x:[];
function hash(text){
  // Two deterministic 32-bit labels; NOT a signature or an authority credential.
  let a=2166136261,b=0x811c9dc7;
  for(let i=0;i<text.length;i++){a=Math.imul(a^text.charCodeAt(i),16777619);b=Math.imul(b^text.charCodeAt(i),2246822519);}
  return (a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');
}
function strictKeys(value,keys,label){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k)))throw new TypeError(label+' has unsupported fields');
}
const fingerprint=q=>JSON.stringify([q.title,q.done]); // exact equality, not a collision-prone digest

export function normalizePortableDraftBundle(value){
  strictKeys(value,['schema','universeId','roomId','quests','journal'],'Portable bundle');
  if(value.schema!==PORTABLE_HANDOFF_SCHEMA||!ID.test(value.universeId))throw new TypeError('Invalid portable universe identifier or bundle schema');
  if(typeof value.roomId!=='string'||value.roomId.length>96||value.roomId&& !ID.test(value.roomId))throw new TypeError('Invalid room');
  if(!Array.isArray(value.quests)||!Array.isArray(value.journal)||value.quests.length>150||value.journal.length>150)throw new TypeError('Portable bundle entry limit exceeded');
  const questIds=new Set(),journalIds=new Set();
  const quests=value.quests.map((q,i)=>{
    strictKeys(q,['id','title','done'],'Quest draft');
    if(typeof q.title!=='string'||!q.title.trim()||q.title.length>160||typeof q.done!=='boolean')throw new TypeError('Invalid Quest draft');
    const id=q.id==null?'legacy-q-'+i+'-'+hash(q.title):q.id;
    if(!DRAFT_ID.test(id)||questIds.has(id))throw new TypeError('Invalid or duplicate Quest draft ID');
    questIds.add(id);
    return {id,title:q.title.trim(),done:q.done};
  });
  const journal=value.journal.map((item,i)=>{
    if(typeof item==='string')item={text:item};
    strictKeys(item,['id','text'],'Journal note');
    if(typeof item.text!=='string'||!item.text.trim()||item.text.length>2000)throw new TypeError('Invalid journal note');
    const id=item.id==null?'legacy-j-'+i+'-'+hash(item.text):item.id;
    if(!DRAFT_ID.test(id)||journalIds.has(id))throw new TypeError('Invalid or duplicate journal ID');
    journalIds.add(id);
    return {id,text:item.text.trim()};
  });
  return {schema:PORTABLE_HANDOFF_SCHEMA,universeId:value.universeId,roomId:value.roomId,quests,journal};
}
function validOrigin(origin){
  try{const x=new URL(origin);return x.protocol==='https:'&&!x.username&&!x.password&&x.origin===origin?x.origin:''}catch{return''}
}
function publicScope(value){
  const origin=validOrigin(value?.origin),nodeId=clean(value?.nodeId,180),userId=clean(value?.userId,180);
  if(!origin||!/^[A-Za-z0-9:_-]{1,180}$/.test(nodeId)||!/^[A-Za-z0-9:_-]{1,180}$/.test(userId))throw new TypeError('Verified HTTPS Guild or node scope required');
  return {origin,nodeId,userId};
}
export async function verifyPortableGuildSession(sessionOwner){
  if(!sessionOwner?.ensureSelected||!sessionOwner?.status||!sessionOwner?.selectedOrigin)throw new Error('Existing Civweave Guild session owner is unavailable');
  const session=await sessionOwner.ensureSelected();
  if(!session?.token||!session?.nodeId||!session?.userId||!session?.origin)throw new Error('Log in to a Guild before attachment');
  if(session.authMode==='legacy-guildkeeper')throw new Error('Legacy Guildkeeper sessions cannot verify current membership for portable attachment');
  if(session.expiresAt&&Date.parse(session.expiresAt)<=Date.now())throw new Error('Guild session expired');
  const scope=publicScope(session);
  if(sessionOwner.selectedOrigin()!==scope.origin)throw new Error('Selected Guild origin mismatch');
  const proof=await sessionOwner.status(scope.nodeId);
  if(proof?.ok!==true||proof?.member?.nodeId!==scope.nodeId||proof.member?.userId!==scope.userId||proof.nodeId&&proof.nodeId!==scope.nodeId)
    throw new Error('Guild did not verify current membership for this session');
  return scope; // no token, credential, profile or private information
}
function sourceMatches(actual,expected){
  return actual?.universeId===expected.universeId&&actual?.draftId===expected.draftId&&
    (!expected.scope||actual.origin===expected.scope.origin&&actual.nodeId===expected.scope.nodeId&&actual.userId===expected.scope.userId);
}
export function planPortableReconciliation(bundle,actions=[],objects=[],scope=null){
  const data=normalizePortableDraftBundle(bundle);
  const verified=scope?publicScope(scope):null;
  const quests=data.quests.map(draft=>{
    const key={universeId:data.universeId,draftId:draft.id,scope:verified};
    const matches=list(actions).filter(x=>sourceMatches(x?.portableOrigin,key));
    const current=matches[0]?.portableOrigin?.fingerprint;
    return {id:draft.id,title:draft.title,originallyDone:draft.done,
      status:matches.length===0?'new':matches.length===1&&current===fingerprint(draft)?'unchanged':'conflict'};
  });
  const journal=data.journal.map(draft=>{
    const matches=list(objects).filter(x=>x?.kind==='civweave.portable-journal.v1'&&x?.consent==='private'&&
      x?.payload?.universeId===data.universeId&&x?.payload?.draftId===draft.id&&(!verified||x?.payload?.nodeId===verified.nodeId&&x?.payload?.userId===verified.userId));
    return {id:draft.id,text:draft.text,
      status:matches.length===0?'new':matches.length===1&&matches[0].payload.text===draft.text?'unchanged':'conflict'};
  });
  return {universeId:data.universeId,quests,journal};
}
export function stagePortableActions(store,bundle,approvedIds,verifiedScope){
  const data=normalizePortableDraftBundle(bundle),scope=publicScope(verifiedScope);
  if(!Array.isArray(approvedIds)||approvedIds.length>150||approvedIds.some(id=>!DRAFT_ID.test(id))||new Set(approvedIds).size!==approvedIds.length)
    throw new TypeError('Explicit bounded review selection required');
  const existing=normalizeStore(store),staged={...existing,actions:[...existing.actions]};
  const plan=planPortableReconciliation(data,existing.actions,[],scope);
  const approved=new Set(approvedIds),receipts=[];
  for(const draft of data.quests){
    if(!approved.has(draft.id))continue;
    const row=plan.quests.find(x=>x.id===draft.id);
    if(row.status!=='new'){receipts.push({draftId:draft.id,status:row.status});continue;}
    if(staged.actions.length>=1000){receipts.push({draftId:draft.id,status:'capacity-exceeded'});continue;}
    const key=[scope.origin,scope.nodeId,scope.userId,data.universeId,draft.id].join('\n');
    const id='portable:'+hash(key);
    if(staged.actions.some(x=>x.id===id)){
      receipts.push({draftId:draft.id,status:'conflict'});continue;
    }
    const now=new Date().toISOString();
    const action=normalizeAction({id,title:draft.title,status:'inbox',createdAt:now,updatedAt:now,
      notes:'Imported by explicit review from the portable universe '+data.universeId+
        '. Its previously checked state is unverified and was not accepted as completion.',
      context:'Portable universe '+data.universeId,
      portableOrigin:{universeId:data.universeId,draftId:draft.id,
        fingerprint:fingerprint(draft),originallyDone:draft.done,...scope,importedAt:now}});
    staged.actions.push(action);receipts.push({draftId:draft.id,status:'imported'});
  }
  return {store:staged,receipts};
}
