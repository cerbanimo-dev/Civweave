(()=>{
'use strict';
if(globalThis.CivweaveSystemsMeshV251)return;
const VERSION='1.0.0';
const REVISION='five-system-mesh-contract-v251';
const DRAFT_SCHEMA='civweave.system-event-draft/v1';
const PROJECTION_SCHEMA='civweave.system-projection/v1';
const CHANNEL='civweave.systems-mesh.v1';
const OUTBOX_KEY='civweave.systems-mesh.outbox.v1';
const INBOX_KEY='civweave.systems-mesh.projection-inbox.v1';
const DECISIONS_KEY='civweave.systems-mesh.projection-decisions.v1';
const OUTBOX_LIMIT=256,INBOX_LIMIT=512,DECISION_LIMIT=1024,MAX_BYTES=32768;
const SYSTEMS=Object.freeze({
  civweave:Object.freeze({id:'civweave',label:'Civweave'}),
  'living-school':Object.freeze({id:'living-school',label:'Living School'}),
  cerbanimo:Object.freeze({id:'cerbanimo',label:'Cerbanimo'}),
  fellowfare:Object.freeze({id:'fellowfare',label:'FellowFare'}),
  anarchadia:Object.freeze({id:'anarchadia',label:'Anarchadia'})
});
const SYSTEM_IDS=Object.freeze(Object.keys(SYSTEMS));
const EVENT_POLICIES=Object.freeze({
  'civweave.intention.created':Object.freeze({source:'civweave',targets:['living-school','cerbanimo','fellowfare']}),
  'living-school.learning.verified':Object.freeze({source:'living-school',targets:['anarchadia']}),
  'living-school.validation.completed':Object.freeze({source:'living-school',targets:['anarchadia','fellowfare']}),
  'cerbanimo.labor.completed':Object.freeze({source:'cerbanimo',targets:['anarchadia','fellowfare']}),
  'cerbanimo.task.available':Object.freeze({source:'cerbanimo',targets:['civweave']}),
  'fellowfare.exchange.completed':Object.freeze({source:'fellowfare',targets:['civweave','anarchadia']}),
  'fellowfare.resource.available':Object.freeze({source:'fellowfare',targets:['civweave']}),
  'anarchadia.policy.published':Object.freeze({source:'anarchadia',targets:['civweave','living-school','cerbanimo','fellowfare']}),
  'anarchadia.passport.updated':Object.freeze({source:'anarchadia',targets:['civweave']})
});
const PATHS=Object.freeze({
  '/app/working-campus-v156.html':'civweave',
  '/app/cabinets/living-school/index.html':'living-school',
  '/app/realm-console-v140.html':'cerbanimo',
  '/app/fellowfare-cabinet-v144.html':'fellowfare',
  '/app/anarchadia-console-v139.html':'anarchadia'
});
const clean=(value,max=1000)=>String(value??'').trim().slice(0,max);
const clone=value=>typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value));
const parse=(raw,fallback)=>{try{return JSON.parse(raw)??fallback}catch{return fallback}};
const uid=prefix=>`${prefix}:${globalThis.crypto?.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
function normalizeSystemId(value){const raw=clean(value,80).toLowerCase();const aliases={commons:'civweave','civweave-commons':'civweave',living_school:'living-school','living school':'living-school'};const id=aliases[raw]||raw;return SYSTEMS[id]?id:''}
function identifySystem(){const route=globalThis.CivweaveSystemRoutesV227?.identify?.(globalThis.location?.pathname||'');return normalizeSystemId(route||document?.documentElement?.dataset?.civweaveSystem||document?.documentElement?.dataset?.civweaveSystemRoute||PATHS[globalThis.location?.pathname||'']||'')}
function read(key){const value=parse(globalThis.localStorage?.getItem?.(key)||'[]',[]);return Array.isArray(value)?value:[]}
function write(key,rows,limit){try{globalThis.localStorage?.setItem?.(key,JSON.stringify(rows.slice(-limit)))}catch{}return rows.slice(-limit)}
function byteSize(value){return new TextEncoder().encode(JSON.stringify(value)).byteLength}
function cleanSystems(values){return [...new Set((Array.isArray(values)?values:[]).map(normalizeSystemId).filter(Boolean))].slice(0,SYSTEM_IDS.length)}
function eventPolicy(type){return EVENT_POLICIES[clean(type,160)]||null}
function validateDraft(draft){
  if(!draft||draft.schema!==DRAFT_SCHEMA)return {ok:false,reason:'schema'};
  const policy=eventPolicy(draft.eventType);if(!policy)return {ok:false,reason:'event-type'};
  if(normalizeSystemId(draft.sourceSystem)!==policy.source)return {ok:false,reason:'source-system'};
  const targets=cleanSystems(draft.targetSystems);if(!targets.length||targets.length!==draft.targetSystems.length||targets.includes(policy.source))return {ok:false,reason:'target-systems'};
  if(targets.some(id=>!policy.targets.includes(id)))return {ok:false,reason:'target-policy'};
  if(!draft.draftId||!draft.createdAt||!draft.payload||typeof draft.payload!=='object'||Array.isArray(draft.payload))return {ok:false,reason:'shape'};
  if(byteSize(draft)>MAX_BYTES)return {ok:false,reason:'too-large'};
  return {ok:true,sourceSystem:policy.source,targetSystems:targets};
}
function createDraft(eventType,payload={},options={}){
  const policy=eventPolicy(eventType);if(!policy)throw new Error('Unsupported Civweave system event type.');
  const active=identifySystem();const source=normalizeSystemId(options.sourceSystem||active||policy.source);
  if(source!==policy.source)throw new Error(`Event ${eventType} belongs to ${policy.source}, not ${source||'this surface'}.`);
  if(active&&active!==source)throw new Error(`Current Civweave surface ${active} cannot publish as ${source}.`);
  const targets=cleanSystems(options.targetSystems?.length?options.targetSystems:policy.targets).filter(id=>id!==source);
  if(!targets.length||targets.some(id=>!policy.targets.includes(id)))throw new Error('Target system is outside this event policy.');
  const draft={schema:DRAFT_SCHEMA,draftId:clean(options.draftId,180)||uid('sysDraft'),eventType,sourceSystem:source,targetSystems:targets,subjectId:clean(options.subjectId,180),createdAt:new Date().toISOString(),visibility:['federation','public'].includes(options.visibility)?options.visibility:'federation',causalParents:[...new Set((options.causalParents||[]).map(x=>clean(x,180)).filter(Boolean))].slice(0,16),evidenceRefs:[...new Set((options.evidenceRefs||[]).map(x=>clean(x,400)).filter(Boolean))].slice(0,32),payload:clone(payload||{})};
  const check=validateDraft(draft);if(!check.ok)throw new Error(`Invalid Civweave system draft: ${check.reason}`);return draft;
}
let channel=null;try{channel=typeof BroadcastChannel==='function'?new BroadcastChannel(CHANNEL):null}catch{}
function announce(type,detail){const safe=clone(detail);try{globalThis.dispatchEvent?.(new CustomEvent(type,{detail:safe}))}catch{}try{channel?.postMessage?.({type,detail:safe,at:new Date().toISOString()})}catch{}}
function publish(eventType,payload={},options={}){const draft=createDraft(eventType,payload,options);const rows=read(OUTBOX_KEY);if(!rows.some(row=>row.draftId===draft.draftId))rows.push(draft);write(OUTBOX_KEY,rows,OUTBOX_LIMIT);announce('civweave:systems-mesh:outbox',{draft});return clone(draft)}
function outbox(){return clone(read(OUTBOX_KEY))}
function acknowledgeDrafts(ids=[]){const set=new Set((Array.isArray(ids)?ids:[ids]).map(String));const before=read(OUTBOX_KEY),after=before.filter(row=>!set.has(String(row.draftId)));write(OUTBOX_KEY,after,OUTBOX_LIMIT);return before.length-after.length}
function validateProjection(value){const target=normalizeSystemId(value?.targetSystem);if(!value||value.schema!==PROJECTION_SCHEMA||!value.projectionId||!value.sourceEventId||!normalizeSystemId(value.sourceSystem)||!target||value.status!=='candidate'||!value.projectionType||!value.policy||!value.payload||typeof value.payload!=='object'||Array.isArray(value.payload))return {ok:false,reason:'shape'};if(byteSize(value)>MAX_BYTES)return {ok:false,reason:'too-large'};return {ok:true,targetSystem:target}}
function receiveProjection(value){const projection=clone(value),check=validateProjection(projection);if(!check.ok)throw new Error(`Invalid Civweave system projection: ${check.reason}`);const active=identifySystem();if(active&&check.targetSystem!==active)throw new Error(`Projection targets ${check.targetSystem}, not current system ${active}.`);const decisions=read(DECISIONS_KEY);if(decisions.some(row=>row.projectionId===projection.projectionId))return {added:false,reason:'already-decided',projection};const rows=read(INBOX_KEY);if(rows.some(row=>row.projectionId===projection.projectionId))return {added:false,reason:'duplicate',projection};rows.push(projection);write(INBOX_KEY,rows,INBOX_LIMIT);announce('civweave:systems-mesh:projection-candidate',{projection});return {added:true,projection}}
function projectionInbox(system=identifySystem()){const id=normalizeSystemId(system);return clone(read(INBOX_KEY).filter(row=>!id||normalizeSystemId(row.targetSystem)===id))}
function decideProjection(projectionId,decision='rejected',metadata={}){const id=clean(projectionId,240);const allowed=['accepted','rejected','deferred'];if(!id||!allowed.includes(decision))throw new Error('Projection decision must be accepted, rejected, or deferred.');const inbox=read(INBOX_KEY),projection=inbox.find(row=>row.projectionId===id);if(!projection)throw new Error('Projection is not present in this local inbox.');const active=identifySystem();if(active&&normalizeSystemId(projection.targetSystem)!==active)throw new Error('Current surface does not own this projection.');const row={schema:'civweave.system-projection-decision/v1',decisionId:uid('sysDecision'),projectionId:id,targetSystem:normalizeSystemId(projection.targetSystem),decision,at:new Date().toISOString(),metadata:clone(metadata&&typeof metadata==='object'?metadata:{})};const decisions=read(DECISIONS_KEY).filter(x=>x.projectionId!==id);decisions.push(row);write(DECISIONS_KEY,decisions,DECISION_LIMIT);write(INBOX_KEY,inbox.filter(x=>x.projectionId!==id),INBOX_LIMIT);announce('civweave:systems-mesh:projection-decision',{projection,decision:row});return clone(row)}
function decisions(){return clone(read(DECISIONS_KEY))}
function exportOutboxBundle(){return {schema:'civweave.system-draft-bundle/v1',bundleId:uid('sysDraftBundle'),exportedAt:new Date().toISOString(),sourceSystem:identifySystem(),drafts:outbox().slice(0,OUTBOX_LIMIT)}}
function importProjectionBundle(bundle){if(!bundle||bundle.schema!=='civweave.system-projection-bundle/v1'||!Array.isArray(bundle.projections))throw new Error('Invalid Civweave projection bundle.');const active=identifySystem(),declared=normalizeSystemId(bundle.targetSystem||active);if(active&&declared&&declared!==active)throw new Error(`Projection bundle targets ${declared}, not current system ${active}.`);let added=0,duplicates=0,rejected=0;for(const row of bundle.projections.slice(0,INBOX_LIMIT)){try{const result=receiveProjection(row);if(result.added)added++;else duplicates++}catch{rejected++}}return {added,duplicates,rejected,targetSystem:active||declared||''}}
function status(){return {version:VERSION,revision:REVISION,system:identifySystem(),systems:SYSTEM_IDS.slice(),outboxCount:read(OUTBOX_KEY).length,inboxCount:projectionInbox().length,decisionCount:read(DECISIONS_KEY).length,privileged:false,signing:false,transport:false}}
function bindExplicitPublish(){addEventListener('civweave:systems-mesh:publish',event=>{try{const d=event.detail||{};publish(d.eventType,d.payload||{},d)}catch(error){console.warn('[Civweave Systems Mesh]',error)}})}
function bindProjectionImport(){addEventListener('civweave:systems-mesh:receive-projection',event=>{try{receiveProjection(event.detail?.projection||event.detail)}catch(error){console.warn('[Civweave Systems Mesh]',error)}})}
function boot(){bindExplicitPublish();bindProjectionImport();document?.documentElement?.setAttribute?.('data-civweave-systems-mesh',REVISION);queueMicrotask(()=>announce('civweave:systems-mesh:ready',status()))}
const api=Object.freeze({version:VERSION,revision:REVISION,draftSchema:DRAFT_SCHEMA,projectionSchema:PROJECTION_SCHEMA,systems:Object.freeze(SYSTEM_IDS.slice()),eventTypes:Object.freeze(Object.keys(EVENT_POLICIES)),normalizeSystemId,identifySystem,eventPolicy,createDraft,validateDraft,publish,outbox,acknowledgeDrafts,validateProjection,receiveProjection,projectionInbox,decideProjection,decisions,exportOutboxBundle,importProjectionBundle,status});
globalThis.CivweaveSystemsMeshV251=api;
document?.readyState==='loading'?addEventListener('DOMContentLoaded',boot,{once:true}):boot();
})();
