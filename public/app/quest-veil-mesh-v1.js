(()=>{
'use strict';
if(globalThis.CivweaveQuestVeilMeshV1)return;

const VERSION='1.0.1-quest-veil-mesh-v1';
const BATCH_SCHEMA='civweave.quest-veil.batch.v1';
const RESULT_SCHEMA='civweave.quest-veil.result-batch.v1';
const ACCEPT_SCHEMA='civweave.quest-veil.accepted-batch.v1';
const BATCH_KIND='civweave.quest-veil.batch.v1';
const RESULT_KIND='civweave.quest-veil.result-batch.v1';
const ACCEPT_KIND='civweave.quest-veil.accepted-batch.v1';
const PROMPT_VERSION='weaveling-mesh-veil-batch-writer-v1';
const REWARD_KEY='civweave.rewards.v156';
const IDENTITY_KEY='civweave-identity-vault';
const BATCH_SIZE=8;
const REWARD_POLICY=Object.freeze({schema:'civweave.quest-veil.reward-policy.v1',learning:{acorns:1,buttons:0},labor:{acorns:0,buttons:1},making:{acorns:0,buttons:1},material:{acorns:0,buttons:1},materials:{acorns:0,buttons:1},exchange:{acorns:0,buttons:1},currencyPolicy:'acorns-and-buttons-only',basis:'per-accepted-veiled-item'});
const LOCAL_PROVIDERS=new Set(['bundled','browser','ollama','local-api','local-reflex','smollm2','packaged','reflex','minilm']);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const list=value=>Array.isArray(value)?value:[];
const clean=(value,max=12000)=>String(value??'').trim().replace(/\s+/g,' ').slice(0,max);
const now=()=>new Date().toISOString();
const clone=value=>{try{return typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value))}catch{return null}};
let ticking=false;
let timer=null;
let rewardWeavePromise=null;

function localConfig(){try{return globalThis.CivweaveModelRuntime?.readSharedConfig?.('interactive')||null}catch{return null}}
function localWriterAvailable(){const config=localConfig();return LOCAL_PROVIDERS.has(clean(config?.provider||config?.route,80).toLowerCase())&&Boolean(globalThis.CivweaveModelRuntime?.generate)}
async function ensureMesh(){if(globalThis.CivweaveNodeAIMeshV1?.ensureMesh)return globalThis.CivweaveNodeAIMeshV1.ensureMesh();if(globalThis.CivweaveLocalMeshV146)return globalThis.CivweaveLocalMeshV146;throw new Error('Civweave mesh runtime is unavailable.')}
function rewardForStage(stage){const key=clean(stage,40).toLowerCase();const reward=REWARD_POLICY[key]||{acorns:0,buttons:0};return{stage:key||'unknown',acorns:Number(reward.acorns||0),buttons:Number(reward.buttons||0)}}
function rewardSummary(jobs){let acorns=0,buttons=0,learning=0,labor=0,materials=0,exchange=0;for(const job of list(jobs)){const stage=clean(job?.veilState?.journey?.stage||job?.stage,40).toLowerCase(),reward=rewardForStage(stage);acorns+=reward.acorns;buttons+=reward.buttons;if(stage==='learning')learning++;else if(stage==='exchange')exchange++;else if(stage==='material'||stage==='materials')materials++;else if(['labor','making'].includes(stage))labor++}return{schema:'civweave.quest-veil.reward-summary.v1',acorns,buttons,items:list(jobs).length,learning,labor,materials,exchange,currencyPolicy:REWARD_POLICY.currencyPolicy,basis:REWARD_POLICY.basis}}
function safeJob(job){return Boolean(job&&/^[a-f0-9]{64}$/i.test(clean(job.sourceHash,80))&&/^[a-f0-9]{64}$/i.test(clean(job.stateHash,80))&&job.veilState?.privacy?.contextStripped===true&&job.veilState?.privacy?.sourceTextIncluded===false&&job.veilState?.privacy?.evidenceContentIncluded===false)}
function batchPrompt(batch){return[
  {role:'system',content:`You are Weaveling doing community Quest Veil batch work. Every item contains only a sealed source hash and a context-stripped Veil State. Write one fictional public ledger episode per item. Never infer the underlying task. Use each supplied public setting, status, and abstract stage. If progress is provisional, looping, failed, or awaiting review, show that honestly in the fiction. Return JSON only: {"items":[{"sourceHash":"...","stateHash":"...","title":"...","story":"...","mapNode":{"symbol":"...","label":"...","description":"..."},"imageScene":"...","closingLine":"..."}]}. Never mention hashes, privacy, models, ledgers, receipts, validators, evidence, or the original work inside the story fields. Prompt version: ${PROMPT_VERSION}.`},
  {role:'user',content:`Veil batch:\n${JSON.stringify({batchId:batch.batchId,jobs:batch.jobs})}`}
]}
function normalizeItem(item){return{sourceHash:clean(item?.sourceHash,80),stateHash:clean(item?.stateHash,80),title:clean(item?.title,90),story:clean(item?.story,1500),mapNode:{symbol:clean(item?.mapNode?.symbol,8)||'✦',label:clean(item?.mapNode?.label,90)||'Waymark',description:clean(item?.mapNode?.description,320)||'The route changed here.'},imageScene:clean(item?.imageScene,1200),closingLine:clean(item?.closingLine,140)}}
function safeOutput(item){if(!/^[a-f0-9]{64}$/i.test(item?.sourceHash||'')||!/^[a-f0-9]{64}$/i.test(item?.stateHash||''))return false;const payload=JSON.stringify({title:item.title,story:item.story,mapNode:item.mapNode,imageScene:item.imageScene,closingLine:item.closingLine});return !/\b(?:hash|privacy|model|ledger|receipt|validator|evidence|proof|original task|source task)\b/i.test(payload)}
async function writer(batch){
  if(!localWriterAvailable())throw new Error('No local generative model is available for community veiling.');
  const runtime=globalThis.CivweaveModelRuntime,config=localConfig(),request={purpose:'civweave-community-quest-veil-batch-v1',executionProfile:'interactive',context:{schema:BATCH_SCHEMA,batchId:batch.batchId,jobs:batch.jobs},messages:batchPrompt(batch)};if(config)request.config=config;
  const result=await runtime.generate(request);if(!['success','fallback'].includes(result?.status))throw new Error(result?.error?.message||`Mesh veil writer ended with ${result?.status||'an error'}.`);
  let value=result?.outputJson;if(!value&&typeof result?.outputText==='string'){const text=result.outputText.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');value=parse(text,{})}
  const items=list(value?.items).map(normalizeItem).filter(safeOutput);return{items,provider:clean(result?.actual?.provider||config?.provider||config?.route||'local',80),model:clean(result?.actual?.model||config?.model||'',160)};
}
async function objectsByKind(kind){const mesh=await ensureMesh();return (await mesh.listObjects()).filter(object=>object?.kind===kind)}
async function acceptanceForBatch(batchId){return (await objectsByKind(ACCEPT_KIND)).find(object=>object?.payload?.batchId===batchId)||null}
async function resultForBatch(batchId){return (await objectsByKind(RESULT_KIND)).find(object=>object?.payload?.batchId===batchId)||null}
async function queuedSourceHashes(){const accepted=new Set((await objectsByKind(ACCEPT_KIND)).flatMap(object=>list(object?.payload?.sourceHashes))),pending=new Set();for(const object of await objectsByKind(BATCH_KIND))for(const job of list(object?.payload?.jobs))if(job?.sourceHash&&!accepted.has(job.sourceHash))pending.add(job.sourceHash);return pending}
async function queueStates(jobs){
  const mesh=await ensureMesh(),requesterNodeId=await mesh.deviceId(),pending=await queuedSourceHashes(),cleanJobs=list(jobs).filter(safeJob).filter(job=>!pending.has(job.sourceHash));let queued=0;
  for(let offset=0;offset<cleanJobs.length;offset+=BATCH_SIZE){
    const chunk=cleanJobs.slice(offset,offset+BATCH_SIZE),batchId=`veil-batch:${crypto.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`,payload={schema:BATCH_SCHEMA,batchId,requesterNodeId,jobs:chunk.map(job=>({submissionId:clean(job.submissionId,240),sourceHash:clean(job.sourceHash,80),stateHash:clean(job.stateHash,80),veilState:clone(job.veilState)})),rewardPolicy:{schema:REWARD_POLICY.schema,basis:REWARD_POLICY.basis,currencyPolicy:REWARD_POLICY.currencyPolicy},expectedReward:rewardSummary(chunk),privacy:{rawSourceIncluded:false,sourceTitlesIncluded:false,evidenceContentIncluded:false},createdAt:now()};
    await mesh.createObject({id:`quest-veil-batch:${batchId}`,kind:BATCH_KIND,purpose:'Offer context-stripped Quest Veil work to the federated mesh. Accepted learning veils pay Acorns; accepted labor, material, and exchange veils pay Buttons.',consent:'federated',audience:[],payload,hopLimit:6,publish:true});queued+=chunk.length;
  }
  if(queued)dispatchEvent(new CustomEvent('civweave:quest-veil-mesh-queued',{detail:{queued,reward:rewardSummary(cleanJobs),at:now()}}));return{queued,reward:rewardSummary(cleanJobs)};
}
async function processBatchObject(object){
  const mesh=await ensureMesh(),localNodeId=await mesh.deviceId(),batch=object?.payload;if(batch?.schema!==BATCH_SCHEMA||batch.requesterNodeId===localNodeId||!list(batch.jobs).length||list(batch.jobs).some(job=>!safeJob(job)))return{status:'skip'};
  if(await acceptanceForBatch(batch.batchId)||await resultForBatch(batch.batchId))return{status:'already-handled'};
  const generated=await writer(batch);if(generated.items.length!==batch.jobs.length)return{status:'incomplete',count:generated.items.length};
  const expected=new Map(batch.jobs.map(job=>[job.sourceHash,job]));if(generated.items.some(item=>!expected.has(item.sourceHash)||expected.get(item.sourceHash).stateHash!==item.stateHash))return{status:'hash-mismatch'};
  const payload={schema:RESULT_SCHEMA,batchId:batch.batchId,requesterNodeId:batch.requesterNodeId,workerNodeId:localNodeId,items:generated.items,promptVersion:PROMPT_VERSION,generation:{provider:generated.provider,model:generated.model},createdAt:now()};
  const result=await mesh.createObject({id:`quest-veil-result:${batch.batchId}`,kind:RESULT_KIND,purpose:'Return a completed context-stripped Quest Veil batch to its requester.',consent:'federated',audience:[],payload,hopLimit:6,publish:true});dispatchEvent(new CustomEvent('civweave:quest-veil-mesh-work-complete',{detail:{batchId:batch.batchId,count:generated.items.length,resultId:result.id,at:now()}}));return{status:'published',result};
}
async function acceptResultObject(object){
  const mesh=await ensureMesh(),localNodeId=await mesh.deviceId(),result=object?.payload;if(result?.schema!==RESULT_SCHEMA||result.requesterNodeId!==localNodeId)return{status:'skip'};if(await acceptanceForBatch(result.batchId))return{status:'already-accepted'};
  const batch=(await objectsByKind(BATCH_KIND)).find(candidate=>candidate?.payload?.batchId===result.batchId);if(!batch||batch.origin?.nodeId!==localNodeId)return{status:'missing-request-batch'};
  const jobs=new Map(list(batch.payload.jobs).map(job=>[job.sourceHash,job]));const gate=globalThis.CivweaveQuestVeilLedgerGateV1;if(!gate?.acceptMeshItem)return{status:'gate-unavailable'};
  const accepted=[];
  for(const item of list(result.items)){const job=jobs.get(item?.sourceHash);if(!job||job.stateHash!==item.stateHash)continue;const outcome=await gate.acceptMeshItem({...item,submissionId:job.submissionId},{provider:`mesh:${result.workerNodeId}`,model:result.generation?.model||null});if(outcome.accepted)accepted.push(item.sourceHash)}
  if(accepted.length!==jobs.size)return{status:'partial',accepted:accepted.length,expected:jobs.size};
  const acceptedJobs=list(batch.payload.jobs).filter(job=>accepted.includes(job.sourceHash)),reward=rewardSummary(acceptedJobs);
  const payload={schema:ACCEPT_SCHEMA,batchId:result.batchId,requesterNodeId:localNodeId,workerNodeId:result.workerNodeId,resultObjectId:object.id,sourceHashes:accepted,reward,currencyPolicy:REWARD_POLICY.currencyPolicy,acceptedAt:now()};
  const acceptance=await mesh.createObject({id:`quest-veil-accept:${result.batchId}`,kind:ACCEPT_KIND,purpose:'Acknowledge accepted Quest Veil items and their Acorn/Button work bounty.',consent:'federated',audience:[],payload,hopLimit:6,publish:true});dispatchEvent(new CustomEvent('civweave:quest-veil-mesh-result',{detail:{batchId:result.batchId,accepted:accepted.length,workerNodeId:result.workerNodeId,reward,at:now()}}));return{status:'accepted',acceptance,reward};
}
function rewardAccountId(){try{const vault=parse(localStorage.getItem(IDENTITY_KEY),{});return clean(vault?.identity?.identityId||vault?.identityId||vault?.deviceId,180)}catch{return''}}
function appendLegacyReward({currency,amount,sourceId,reason}){
  if(!(amount>0))return false;const raw=parse(localStorage.getItem(REWARD_KEY),{}),events=Array.isArray(raw)?raw:list(raw?.events);if(events.some(row=>row?.sourceId===sourceId&&row?.currency===currency))return false;
  const event={id:`quest-veil-bounty:${currency}:${sourceId}`,system:'civweave',currency,amount,phase:'quest-veil-bounty',sourceId,reason:clean(reason,240)||'Accepted community Quest Veil work',createdAt:now()};const next=Array.isArray(raw)?[event,...events]:{...(raw&&typeof raw==='object'?raw:{}),events:[event,...events].slice(0,3000),updatedAt:now()};localStorage.setItem(REWARD_KEY,JSON.stringify(next));return true;
}
function loadScript(src,ready){if(ready?.())return Promise.resolve(ready());return new Promise((resolve,reject)=>{const existing=[...document.scripts].find(script=>script.src&&new URL(script.src,location.href).pathname===src);if(existing){let ticks=0;const timer=setInterval(()=>{const value=ready?.();if(value){clearInterval(timer);resolve(value)}else if(++ticks>120){clearInterval(timer);reject(new Error(`${src} did not become ready.`))}},50);return}const script=document.createElement('script');script.src=src;script.async=false;script.onload=()=>ready?.()?resolve(ready()):reject(new Error(`${src} loaded without becoming ready.`));script.onerror=()=>reject(new Error(`Could not load ${src}.`));document.head.append(script)})}
async function ensureRewardWeave(){if(globalThis.CivweaveRewardWeave)return globalThis.CivweaveRewardWeave;if(!rewardWeavePromise)rewardWeavePromise=loadScript('/app/shared/civweave-reward-weave.js',()=>globalThis.CivweaveRewardWeave).catch(()=>null);return rewardWeavePromise}
async function grantAcceptedBounty(object){
  const mesh=await ensureMesh(),localNodeId=await mesh.deviceId(),acceptance=object?.payload;if(acceptance?.schema!==ACCEPT_SCHEMA||acceptance.workerNodeId!==localNodeId||object.origin?.nodeId!==acceptance.requesterNodeId)return{status:'skip'};
  const batch=(await objectsByKind(BATCH_KIND)).find(candidate=>candidate?.payload?.batchId===acceptance.batchId&&candidate?.origin?.nodeId===acceptance.requesterNodeId);if(!batch)return{status:'missing-source-batch'};
  const acceptedSet=new Set(list(acceptance.sourceHashes)),acceptedJobs=list(batch.payload.jobs).filter(job=>acceptedSet.has(job?.sourceHash));if(acceptedJobs.length!==acceptedSet.size)return{status:'invalid-acceptance'};
  const reward=rewardSummary(acceptedJobs),sourceId=`quest-veil-accept:${acceptance.batchId}`,buttons=reward.buttons,acorns=reward.acorns;let changed=false;
  changed=appendLegacyReward({currency:'button',amount:buttons,sourceId,reason:`Veiled ${reward.labor+reward.materials+reward.exchange} labor/material/exchange item${reward.labor+reward.materials+reward.exchange===1?'':'s'}`})||changed;
  changed=appendLegacyReward({currency:'acorn',amount:acorns,sourceId,reason:`Veiled ${reward.learning} learning item${reward.learning===1?'':'s'}`})||changed;
  const accountId=rewardAccountId();if(buttons>0&&accountId){try{const rewards=await ensureRewardWeave();if(rewards?.read&&rewards?.write&&rewards?.core?.recordExternalCoinReward){const state=rewards.read(),already=state?.fellowfare?.receipts?.some?.(receipt=>receipt?.sourceReceiptId===sourceId||receipt?.sourceId===sourceId);if(!already)rewards.write(rewards.core.recordExternalCoinReward(state,{accountId,amount:buttons,kind:'quest-veil-bounty',sourceReceiptId:sourceId,reason:'Accepted community labor, material, or exchange Quest Veil work'}))}}catch{}}
  if(changed)dispatchEvent(new CustomEvent('civweave:rewards-changed',{detail:{kind:'quest-veil-bounty',buttons,acorns,sourceId,reward,at:now()}}));return{status:changed?'granted':'already-granted',buttons,acorns,reward};
}
async function tick(){
  if(ticking)return{status:'busy'};ticking=true;
  try{
    const batches=await objectsByKind(BATCH_KIND);if(localWriterAvailable())for(const batch of batches.slice(-20))try{await processBatchObject(batch)}catch{}
    const results=await objectsByKind(RESULT_KIND);for(const result of results.slice(-30))try{await acceptResultObject(result)}catch{}
    const accepts=await objectsByKind(ACCEPT_KIND);for(const acceptance of accepts.slice(-30))try{await grantAcceptedBounty(acceptance)}catch{}
    return{status:'ok',batches:batches.length,results:results.length,acceptances:accepts.length};
  }finally{ticking=false}
}
function schedule(){if(timer)clearTimeout(timer);timer=setTimeout(async()=>{await tick().catch(()=>{});schedule()},60_000)}
function boot(){tick().catch(()=>{});schedule()}

if(document.readyState==='loading')addEventListener('DOMContentLoaded',boot,{once:true});else boot();
for(const name of ['civweave:node-ai-mesh-sync','civweave:node-ai-discovery-changed','civweave:mesh','civweave:quest-veil-mesh-queued','online'])addEventListener(name,()=>tick());
addEventListener('pagehide',()=>{if(timer)clearTimeout(timer)},{once:true});

globalThis.CivweaveQuestVeilMeshV1=Object.freeze({VERSION,BATCH_SCHEMA,RESULT_SCHEMA,ACCEPT_SCHEMA,BATCH_KIND,RESULT_KIND,ACCEPT_KIND,PROMPT_VERSION,BATCH_SIZE,REWARD_POLICY,rewardForStage,rewardSummary,localWriterAvailable,queueStates,processBatchObject,acceptResultObject,grantAcceptedBounty,tick});
dispatchEvent(new CustomEvent('civweave:quest-veil-mesh-ready',{detail:{version:VERSION,batchSize:BATCH_SIZE,rewardPolicy:REWARD_POLICY}}));
})();