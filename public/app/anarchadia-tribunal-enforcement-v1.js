import {createSanctionEvents} from './anarchadia-tribunal-v1.js';
import {normalizeTribunalPolicy} from './anarchadia-tribunal-policy-v1.js';

export const TRIBUNAL_ENFORCEMENT_SCHEMA='civweave.anarchadia.tribunal-enforcement.v1';
export const PUBLIC_CHAT_RESTRICTION_KEY='civweave.anarchadia.public-chat-restrictions.v1';
const now=()=>new Date().toISOString();
const parse=(v,f)=>{try{return JSON.parse(v)??f}catch{return f}};
const clean=(v,n=500)=>String(v??'').trim().slice(0,n);
function readRestrictions(storage=globalThis.localStorage){const rows=parse(storage?.getItem?.(PUBLIC_CHAT_RESTRICTION_KEY)||'[]',[]);return Array.isArray(rows)?rows:[]}
function writeRestrictions(rows,storage=globalThis.localStorage){const next=(rows||[]).filter(x=>x?.actorId&&x?.until).slice(-2000);storage?.setItem?.(PUBLIC_CHAT_RESTRICTION_KEY,JSON.stringify(next));return next}
export function publicChatAccess(actorId,{storage=globalThis.localStorage,at=Date.now()}={}){const id=String(actorId||'');const active=readRestrictions(storage).filter(x=>x.actorId===id&&Date.parse(x.until)>Number(at));return {allowed:active.length===0,actorId:id,restrictions:active};}
export function applyPublicChatRestriction(event,{storage=globalThis.localStorage}={}){if(event?.kind!=='public-chat-restriction')return null;const rows=readRestrictions(storage).filter(x=>!(x.actorId===event.actorId&&x.caseId===event.caseId));const row={schema:TRIBUNAL_ENFORCEMENT_SCHEMA,kind:event.kind,actorId:String(event.actorId),caseId:clean(event.caseId,180),outcomeHash:clean(event.outcomeHash,180),until:event.until,createdAt:now()};rows.push(row);writeRestrictions(rows,storage);return row}
export function sanctionEventsUnderPolicy(caseRecord,policy){
  const p=normalizeTribunalPolicy(policy||{regionId:caseRecord?.regionId||'local'});if(caseRecord?.outcome?.outcome!=='guilty')return [];
  const severity=Math.max(1,Math.min(4,Number(caseRecord.outcome.severity||1))),band=p.sanctions[severity]||p.sanctions[1];
  const original=caseRecord.outcome.sanctions;caseRecord.outcome.sanctions={...band};const events=createSanctionEvents(caseRecord).map(event=>({...event,caseId:caseRecord.id,outcomeHash:caseRecord.outcome.hash,regionId:caseRecord.regionId,policyId:p.id,policyRevision:p.revision}));caseRecord.outcome.sanctions=original;return events;
}
export async function settleTribunalSanctions(caseRecord,policy,{ledger=globalThis.CivweaveCanonicalRewardsV2||null,storage=globalThis.localStorage,accountForActor=id=>`passport:${id}`}={}){
  const events=sanctionEventsUnderPolicy(caseRecord,policy),settled=[];
  for(const event of events){
    if(event.kind==='button-fine'){
      if(ledger?.appendEntry)await ledger.appendEntry({accountId:accountForActor(event.actorId),assetType:'button',amount:-Math.abs(event.amount),sourceSystem:'anarchadia',sourceKind:'correction',sourceId:caseRecord.id,sourceKey:`tribunal:${caseRecord.id}:button-fine:${event.actorId}`,evidenceHash:caseRecord.outcome.hash,metadata:{operation:'fine',reason:'tribunal_hate_speech_sanction',policyId:event.policyId,policyRevision:event.policyRevision}});
      settled.push({...event,ledgerSettled:Boolean(ledger?.appendEntry)});
    }else if(event.kind==='acorn-restitution'){
      for(const actorId of event.toActorIds||[]){if(ledger?.appendEntry)await ledger.appendEntry({accountId:accountForActor(actorId),assetType:'acorn',amount:Math.abs(event.amount),sourceSystem:'anarchadia',sourceKind:'correction',sourceId:caseRecord.id,sourceKey:`tribunal:${caseRecord.id}:acorn-restitution:${actorId}`,evidenceHash:caseRecord.outcome.hash,metadata:{operation:'mint',reason:'tribunal_hate_speech_restitution',policyId:event.policyId,policyRevision:event.policyRevision}});settled.push({...event,toActorId:actorId,ledgerSettled:Boolean(ledger?.appendEntry)})}
    }else if(event.kind==='public-chat-restriction')settled.push({...event,restriction:applyPublicChatRestriction(event,{storage})});
  }
  return settled;
}
