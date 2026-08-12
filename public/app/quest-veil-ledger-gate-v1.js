(()=>{
'use strict';
if(globalThis.CivweaveQuestVeilLedgerGateV1)return;

const VERSION='1.0.1-quest-veil-ledger-gate-v1';
const PROMPT_VERSION='weaveling-task-veil-writer-v1';
const ENTRY_SCHEMA='civweave.chronicle-entry.task-veil.v1';
const STATE_SCHEMA='civweave.task-veil-state.v1';
const KEYS=Object.freeze({
  validation:'civweave.validation-ledger.v1.1',
  chronicle:'civweave.chronicle-ledger.v1.1',
  campus:'civweave.working-campus.v1',
  intentions:'civweave.intentions.v127',
  settings:'civweave.quest-veil.settings.v1'
});
const THEMES=Object.freeze([
  {id:'fantasy',setting:'a sprawling fantasy realm of old roads, strange towers, wandering guilds, and inconvenient sorcery'},
  {id:'revolution',setting:'a surreal office-state where departments become provinces, meetings become councils, and bureaucracy has weather'},
  {id:'starship',setting:'a patched-together starship crossing an unexplored sector with a stubborn crew and temperamental systems'},
  {id:'garden',setting:'a living garden-city where paths, bridges, creatures, and neighborhoods change as the work advances'},
  {id:'mystery',setting:'a dreamlike detective city where clues appear as landmarks and false leads bend the streets'},
  {id:'expedition',setting:'an impossible expedition across ruins, rivers, archives, mountains, and half-finished maps'}
]);
const PHASE_LABEL=Object.freeze({
  submitted:'The route has begun, but the next verdict is still hidden.',
  'under-review':'The traveler has reached a checkpoint and the lanterns are being read.',
  'provisional-pass':'The road appears to be opening, though the gate has not fully agreed.',
  'provisional-fail':'The route is resisting progress and may need another approach.',
  'verified-pass':'The checkpoint has opened and the route can advance.',
  'verified-fail':'The path has closed here; a different move or revision is needed.',
  'awaiting-cross-device':'The checkpoint is convinced, but the reward bridge still waits for an independent witness.'
});
const LOCAL_PROVIDERS=new Set(['bundled','browser','ollama','local-api','local-reflex','smollm2','packaged','reflex','minilm']);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const list=value=>Array.isArray(value)?value:[];
const clean=(value,max=12000)=>String(value??'').trim().replace(/\s+/g,' ').slice(0,max);
const now=()=>new Date().toISOString();
const clone=value=>{try{return typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value))}catch{return null}};
const canonical=value=>JSON.stringify(normalize(value));
const normalize=value=>Array.isArray(value)?value.map(normalize):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,normalize(value[key])])):value;
let syncPromise=null;
let rewardWeaveValue=globalThis.CivweaveRewardWeave;
let rewardSummaryPatched=false;

function read(key,fallback){return parse(localStorage.getItem(key),fallback)}
function validationLedger(){const value=read(KEYS.validation,{});return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}
function chronicle(){const value=read(KEYS.chronicle,{});return value&&typeof value==='object'&&!Array.isArray(value)?{schema:'civweave.chronicle-ledger.v1.1',entries:list(value.entries),updatedAt:value.updatedAt||now()}:{schema:'civweave.chronicle-ledger.v1.1',entries:[],updatedAt:now()}}
function writeChronicle(state){const next={schema:'civweave.chronicle-ledger.v1.1',entries:list(state?.entries).slice(0,800),updatedAt:now()};localStorage.setItem(KEYS.chronicle,JSON.stringify(next));dispatchEvent(new CustomEvent('civweave:quest-veil-ledger-changed',{detail:{at:next.updatedAt}}));return next}
function latestThreshold(ledger,submissionId){return list(ledger?.thresholdReceipts).filter(row=>row?.submissionId===submissionId).sort((a,b)=>Date.parse(b.createdAt||0)-Date.parse(a.createdAt||0))[0]||null}
function latestPacket(ledger,submissionId){return list(ledger?.packets).filter(row=>row?.submissionId===submissionId).sort((a,b)=>Date.parse(b.createdAt||0)-Date.parse(a.createdAt||0))[0]||null}
function phaseFor(submission,ledger=validationLedger()){
  const threshold=latestThreshold(ledger,submission?.id),packet=latestPacket(ledger,submission?.id);
  if(threshold?.decision==='verified-pass'||threshold?.verifiedPass===true){if(packet?.status==='verified-awaiting-cross-device'||threshold?.crossDeviceSatisfied===false)return'awaiting-cross-device';return'verified-pass'}
  if(threshold?.decision==='verified-fail'||threshold?.verifiedFail===true)return'verified-fail';
  if(threshold?.decision==='provisional-pass')return'provisional-pass';
  if(threshold?.decision==='provisional-fail')return'provisional-fail';
  if(packet?.status==='open'||packet?.status==='pending')return'under-review';
  return'submitted';
}
function planForSubmission(submission){
  const campus=read(KEYS.campus,{}),rows=list(read(KEYS.intentions,[]));
  const ids=[submission?.journeyId,submission?.questId,submission?.weaveId].filter(Boolean).map(String);
  if(campus?.plan&&(ids.includes(String(campus.plan.id))||!ids.length))return campus.plan;
  const row=rows.find(item=>item?.plan&&ids.some(id=>[item.id,item.plan.id,...list(item.plan.paths).map(path=>path.id)].map(String).includes(id)));
  return row?.plan||null;
}
function themeFor(submission){
  const plan=planForSubmission(submission),settings=read(KEYS.settings,{}),chosen=clean(settings?.[plan?.id]?.setting||plan?.questVeil?.setting||plan?.veil?.setting,800);
  if(chosen)return{id:'custom',setting:chosen};
  const basis=String(plan?.id||submission?.journeyId||submission?.questId||submission?.id||'task');let hash=0;for(const char of basis)hash=(Math.imul(hash,31)+char.charCodeAt(0))>>>0;
  return THEMES[hash%THEMES.length];
}
function realmStage(submission){
  const kind=clean(submission?.kind,80).toLowerCase(),source=clean(submission?.source,80).toLowerCase();
  if(source==='living'||kind==='lesson'||kind==='learning'||kind==='module')return'learning';
  if(['material','materials','material-request','materials-request','request'].includes(kind))return'material';
  if(source==='fellowfare'||kind==='exchange'||kind==='trade')return'exchange';
  return'labor';
}
function taskVeilState(submission,ledger=validationLedger()){
  const phase=phaseFor(submission,ledger),theme=themeFor(submission),threshold=latestThreshold(ledger,submission?.id),packet=latestPacket(ledger,submission?.id);
  return Object.freeze({
    schema:STATE_SCHEMA,
    phase,
    statusMeaning:PHASE_LABEL[phase]||PHASE_LABEL.submitted,
    journey:{stage:realmStage(submission),attempt:Math.max(1,Number(submission?.attempt||1))},
    evidence:{artifactCount:list(submission?.evidenceArtifacts).length,referenceCount:list(submission?.evidenceRefs).length,skillClaimCount:list(submission?.skills).length},
    validation:{decision:clean(threshold?.decision||packet?.status||phase,80),confidence:Number.isFinite(Number(threshold?.confidence??threshold?.passConfidence))?Number(threshold.confidence??threshold.passConfidence):null,diversityFamilies:Number(threshold?.diversity?.familyCount||0),crossDeviceSatisfied:Boolean(threshold?.crossDeviceSatisfied)},
    theme:{id:theme.id,setting:theme.setting},
    privacy:{contextStripped:true,sourceTextIncluded:false,sourceTitleIncluded:false,evidenceContentIncluded:false,identityIncluded:false,receiptIdsIncluded:false}
  });
}
async function sourceHash(submission){const bytes=new TextEncoder().encode(canonical(submission||{}));const digest=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('')}
async function stateHash(state){const bytes=new TextEncoder().encode(canonical(state||{}));const digest=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('')}
function privateFragments(submission){
  const values=[submission?.subjectTitle,submission?.evidenceSummary,submission?.contributorName];
  for(const artifact of list(submission?.evidenceArtifacts))values.push(artifact?.name,artifact?.inlineText,artifact?.sourceRef);
  for(const skill of list(submission?.skills))values.push(skill?.name,skill?.rationale);
  const fragments=new Set();
  for(const raw of values){const value=clean(raw,3000).toLowerCase();if(value.length>=12)fragments.add(value);const words=value.split(/\s+/).filter(Boolean);for(let size=6;size>=3;size--)for(let i=0;i+size<=words.length;i++){const phrase=words.slice(i,i+size).join(' ');if(phrase.length>=18)fragments.add(phrase)}}
  return [...fragments];
}
function forbiddenKey(value){
  if(Array.isArray(value))return value.some(forbiddenKey);
  if(value&&typeof value==='object')return Object.entries(value).some(([key,child])=>/^(?:proofIds?|evidenceArtifacts?|receiptRefs?|validatorIds?|identityIds?|deviceIds?|sourceRef|inlineText|subjectTitle|contributorName)$/i.test(key)||forbiddenKey(child));
  return false;
}
function safePublicPayload(payload,submission){const text=JSON.stringify(payload||{}).toLowerCase();return !forbiddenKey(payload)&&!privateFragments(submission).some(fragment=>text.includes(fragment))}
function writerMessages(state){return[
  {role:'system',content:`You are Weaveling in mandatory task-veil writer mode. Write a fictional public ledger episode from ONLY the supplied context-stripped Task Veil State. Do not infer or reconstruct the real task, person, employer, subject, location, artifact, file, proof, skill, or organization. The user's chosen setting is public and may be used freely. Convert the abstract success, struggle, revision, waiting, or completion state into concrete events inside that setting. If progress is weak, looping, provisional, or failed, make the story visibly reflect that rather than flattering it. Return JSON only with title, story, mapNode, imageScene, and closingLine. title <= 70 chars; story 70-150 words; mapNode has symbol, label, description; imageScene <= 100 words; closingLine <= 100 chars. Never mention privacy machinery, validation receipts, hashes, models, ledgers, or the original work. Prompt version: ${PROMPT_VERSION}.`},
  {role:'user',content:`Context-stripped Task Veil State:\n${JSON.stringify(state)}`}
]}
function normalizeWriter(value){const raw=value&&typeof value==='object'?value:{};return{title:clean(raw.title,90),story:clean(raw.story,1500),mapNode:{symbol:clean(raw.mapNode?.symbol,8)||'✦',label:clean(raw.mapNode?.label,90)||'Waymark',description:clean(raw.mapNode?.description,320)||'The route changed here.'},imageScene:clean(raw.imageScene,1200),closingLine:clean(raw.closingLine,140)}}
async function ensureHarness(){try{await globalThis.CivweaveFamilyAILoaderV105?.ensure?.()}catch{}return globalThis.CivweaveModelRuntime||null}
async function invokeWriter(state){
  const runtime=await ensureHarness();if(!runtime?.generate)throw new Error('Weaveling model runtime is unavailable.');let config=null;try{config=runtime.readSharedConfig?.('interactive')||null}catch{}
  const request={purpose:'civweave-mandatory-task-veil-v1',executionProfile:'interactive',context:state,messages:writerMessages(state)};if(config)request.config=config;
  const result=await runtime.generate(request);if(!['success','fallback'].includes(result?.status))throw new Error(result?.error?.message||`Task veil writer ended with ${result?.status||'an error'}.`);
  let value=result?.outputJson;if(!value&&typeof result?.outputText==='string'){const text=result.outputText.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');value=parse(text,{story:text})}
  return{payload:normalizeWriter(value),provider:clean(result?.actual?.provider||config?.provider||config?.route||'weaveling',80),model:clean(result?.actual?.model||config?.model||'',160),status:result?.status||'success'};
}
function entryId(submissionId){return`quest-veil-task:${clean(submissionId,220)}`}
function veilEntry(submissionId,state=chronicle()){return list(state?.entries).find(entry=>entry?.id===entryId(submissionId)&&entry?.kind==='quest-veil-task')||null}
function putEntry(entry){const state=chronicle(),prior=state.entries.find(row=>row?.id===entry.id);state.entries=[{...entry,createdAt:prior?.createdAt||entry.createdAt||now(),updatedAt:now()},...state.entries.filter(row=>row?.id!==entry.id)];return writeChronicle(state).entries[0]}
function buildEntry(submission,sourceDigest,veilDigest,state,payload,generation={}){return{schema:ENTRY_SCHEMA,kind:'quest-veil-task',id:entryId(submission.id),submissionId:submission.id,sourceHash:sourceDigest,stateHash:veilDigest,title:payload.title,story:payload.story,public:{mapNode:payload.mapNode,imageScene:payload.imageScene,closingLine:payload.closingLine,theme:state.theme,phase:state.phase},derived:{veilState:state,promptVersion:PROMPT_VERSION,source:'context-stripped-submission-state',rawEvidenceIncluded:false,sourceDetailsIncluded:false},generation:{harness:'weaveling',provider:clean(generation.provider,80)||'unknown',model:clean(generation.model,160)||null,status:clean(generation.status,40)||'success'},createdAt:now(),updatedAt:now()}}
function pendingHumanEntry(){return{schema:'civweave.chronicle-entry.veil-pending.v1',kind:'quest-veil-pending',id:`quest-veil-pending:${Math.random().toString(36).slice(2)}`,title:'A chapter is still behind the veil',story:'A submitted task exists, but its human-readable chapter has not passed the mandatory veil yet. The underlying record remains available to authorized validation and model processes; human ledger views reveal nothing about its subject while the veil is pending.',public:{phase:'pending'},createdAt:now()}}
function humanChronicle(){
  const state=chronicle(),bySubmission=new Map(state.entries.filter(entry=>entry?.kind==='quest-veil-task'&&entry?.submissionId).map(entry=>[entry.submissionId,entry])),out=[],seen=new Set();
  for(const entry of state.entries){
    if(entry?.kind==='quest-veil-task'){if(entry.submissionId&&!seen.has(entry.submissionId)){out.push(entry);seen.add(entry.submissionId)}continue}
    if(entry?.submissionId){if(seen.has(entry.submissionId))continue;out.push(bySubmission.get(entry.submissionId)||pendingHumanEntry());seen.add(entry.submissionId);continue}
    if(entry?.kind==='quest-veil'||entry?.kind==='quest-veil-finale')out.push(entry);
  }
  return{schema:'civweave.human-chronicle-projection.v1',entries:out,updatedAt:state.updatedAt};
}
function patchRewardSummary(api){
  if(!api?.summary||api.__questVeilHumanLedgerGate)return api;
  const original=api.summary.bind(api);api.summary=accountId=>{const result=original(accountId);return{...result,stories:humanChronicle().entries}};
  try{Object.defineProperty(api,'__questVeilHumanLedgerGate',{value:true})}catch{api.__questVeilHumanLedgerGate=true}
  rewardSummaryPatched=true;return api;
}
function installRewardGate(){
  rewardWeaveValue=patchRewardSummary(globalThis.CivweaveRewardWeave||rewardWeaveValue);
  try{
    const descriptor=Object.getOwnPropertyDescriptor(globalThis,'CivweaveRewardWeave');
    if(!descriptor||descriptor.configurable){Object.defineProperty(globalThis,'CivweaveRewardWeave',{configurable:true,enumerable:true,get:()=>rewardWeaveValue,set:value=>{rewardWeaveValue=patchRewardSummary(value)}})}
  }catch{}
  return rewardSummaryPatched;
}
function queueMesh(jobs){const mesh=globalThis.CivweaveQuestVeilMeshV1;return mesh?.queueStates?mesh.queueStates(jobs):Promise.resolve({queued:0,reason:'mesh-runtime-unavailable'})}
async function createOrQueue(submission,ledger){
  const state=taskVeilState(submission,ledger),sourceDigest=await sourceHash(submission),veilDigest=await stateHash(state),existing=veilEntry(submission.id);
  if(existing?.stateHash===veilDigest&&existing?.sourceHash===sourceDigest)return{status:'ready',entry:existing};
  try{
    const generated=await invokeWriter(state);if(!safePublicPayload(generated.payload,submission))throw new Error('Generated task veil failed the disclosure guard.');
    return{status:'created',entry:putEntry(buildEntry(submission,sourceDigest,veilDigest,state,generated.payload,generated))};
  }catch(error){await queueMesh([{submissionId:submission.id,sourceHash:sourceDigest,stateHash:veilDigest,veilState:state}]);return{status:'queued',sourceHash:sourceDigest,stateHash:veilDigest,error:clean(error?.message||error,300)}}
}
async function sync(){
  if(syncPromise)return syncPromise;
  syncPromise=(async()=>{
    installRewardGate();const ledger=validationLedger(),submissions=list(ledger?.submissions).slice(0,120),results=[];
    for(const submission of submissions)try{results.push(await createOrQueue(submission,ledger))}catch(error){results.push({status:'error',submissionId:submission?.id,error:clean(error?.message||error,300)})}
    dispatchEvent(new CustomEvent('civweave:quest-veil-ledger-synced',{detail:{submissionCount:submissions.length,ready:results.filter(row=>row.status==='ready'||row.status==='created').length,queued:results.filter(row=>row.status==='queued').length,at:now()}}));
    return results;
  })().finally(()=>{syncPromise=null});
  return syncPromise;
}
async function acceptMeshItem(item,generation={}){
  const ledger=validationLedger(),submission=list(ledger?.submissions).find(row=>row?.id===item?.submissionId);if(!submission)return{accepted:false,reason:'submission-not-found'};
  const expectedSource=await sourceHash(submission),state=taskVeilState(submission,ledger),expectedState=await stateHash(state);
  if(item?.sourceHash!==expectedSource||item?.stateHash!==expectedState)return{accepted:false,reason:'stale-or-mismatched-hash'};
  const payload=normalizeWriter(item?.payload||item);if(!safePublicPayload(payload,submission))return{accepted:false,reason:'disclosure-guard'};
  const entry=putEntry(buildEntry(submission,expectedSource,expectedState,state,payload,{provider:generation.provider||'mesh',model:generation.model||null,status:'mesh-accepted'}));return{accepted:true,entry};
}
function setSetting(planId,setting){const id=clean(planId,220),value=clean(setting,800);if(!id||!value)throw new TypeError('planId and setting are required.');const settings=read(KEYS.settings,{});settings[id]={setting:value,updatedAt:now()};localStorage.setItem(KEYS.settings,JSON.stringify(settings));dispatchEvent(new CustomEvent('civweave:quest-veil-setting-changed',{detail:{planId:id,at:settings[id].updatedAt}}));sync();return clone(settings[id])}
function localProviderAvailable(){try{const config=globalThis.CivweaveModelRuntime?.readSharedConfig?.('interactive');return LOCAL_PROVIDERS.has(clean(config?.provider||config?.route,80).toLowerCase())}catch{return false}}
function boot(){installRewardGate();sync().catch(error=>console.warn('[Civweave] mandatory Quest Veil ledger sync failed.',error?.message||error))}

if(document.readyState==='loading')addEventListener('DOMContentLoaded',boot,{once:true});else boot();
for(const name of ['civweave:reward-state-changed','civweave:proof-progress-synced','civweave:peer-review-recorded','civweave:validation-receipt-recorded','civweave:quest-veil-mesh-result'])addEventListener(name,()=>sync());
addEventListener('storage',event=>{if(Object.values(KEYS).includes(event.key)){installRewardGate();sync()}});
addEventListener('focus',()=>{installRewardGate();sync()});

globalThis.CivweaveQuestVeilLedgerGateV1=Object.freeze({VERSION,PROMPT_VERSION,ENTRY_SCHEMA,STATE_SCHEMA,KEYS,validationLedger,chronicle,taskVeilState,sourceHash,stateHash,safePublicPayload,writerMessages,humanChronicle,veilEntry,sync,acceptMeshItem,setSetting,localProviderAvailable,installRewardGate});
dispatchEvent(new CustomEvent('civweave:quest-veil-ledger-gate-ready',{detail:{version:VERSION,mandatory:true,chronicle:KEYS.chronicle}}));
})();