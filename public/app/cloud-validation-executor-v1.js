(()=>{
'use strict';
const VERSION='1.0.2-cloud-validation-executor-v1-validation-battle';
if(globalThis.CivweaveCloudValidationExecutorV1?.version===VERSION)return;
const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const clone=value=>value==null?value:structuredClone(value);
const access=()=>globalThis.CivweaveHostNodeSessionV1||null;
let battlePromise=null;
function setSession(envelope){
  if(!access()?.setSession)throw new Error('The canonical Guild session owner is not ready.');
  return access().setSession(envelope,{quota:envelope?.quota||null});
}
function usableSession(nodeId=''){
  return access()?.sessionFor?.(nodeId)||null;
}
function identityVault(){
  const sync=globalThis.CivweaveIdentitySync;
  if(sync?.readVault){try{return sync.readVault()}catch{}}
  try{return parse(localStorage.getItem('civweave-identity-vault'),null)}catch{return null}
}
function evidenceChecks(packet){
  return(Array.isArray(packet?.evidenceArtifacts)?packet.evidenceArtifacts:[]).map(item=>({artifactId:clean(item?.id||item?.contentHash||item?.name,180),contentHash:clean(item?.contentHash,180),inspected:true,sourceRef:clean(item?.sourceRef,1000)}));
}
function normalizeRubricScores(packet,validation){
  const rows=Array.isArray(validation?.rubricScores)?validation.rubricScores:[];
  const map=new Map(rows.map(item=>[clean(item?.criterion,600),item]));
  return(Array.isArray(packet?.rubric)?packet.rubric:[]).map(criterion=>{
    const text=clean(criterion,600),row=map.get(text)||{};
    return{criterion:text,met:Boolean(row.met),score:Math.max(0,Math.min(1,Number(row.score)||0)),note:clean(row.note,600)};
  });
}
function ensureValidationBattle(){
  if(globalThis.CivweaveValidationBattleV1)return Promise.resolve(globalThis.CivweaveValidationBattleV1);
  if(battlePromise)return battlePromise;
  battlePromise=new Promise((resolve,reject)=>{
    if(!globalThis.document?.head){resolve(null);return}
    const existing=[...document.scripts].find(script=>script.src&&new URL(script.src,location.href).pathname==='/app/validation-battle-v1.js');
    const finish=()=>resolve(globalThis.CivweaveValidationBattleV1||null);
    if(existing){
      if(globalThis.CivweaveValidationBattleV1){finish();return}
      existing.addEventListener('load',finish,{once:true});
      existing.addEventListener('error',()=>reject(new Error('Validation battle runtime failed to load.')),{once:true});
      return;
    }
    const script=document.createElement('script');
    script.src='/app/validation-battle-v1.js?v=validation-battle-v1';
    script.async=true;
    script.onload=finish;
    script.onerror=()=>reject(new Error('Validation battle runtime failed to load.'));
    document.head.append(script);
  }).catch(error=>{battlePromise=null;throw error});
  return battlePromise;
}
async function rewardReceipt(detail,result){
  const packet=detail.packet||{},validation=result.validation||{};
  const reward=globalThis.CivweaveRewardWeave;
  const identity=globalThis.CivweaveIdentitySync;
  if(!reward?.record||!identity?.signValue)throw new Error('Reward identity runtime is unavailable for this validation receipt.');
  const vault=identityVault();
  if(!vault?.identityId||!vault?.deviceId)throw new Error('A portable Civweave identity is required to claim validation rewards.');
  const rubricScores=normalizeRubricScores(packet,validation);
  const unsigned={
    schema:'civweave.validation-receipt.v1.1',
    id:`validation-receipt:${crypto.randomUUID()}`,
    packetId:clean(packet.id,180),
    requestId:clean(packet.requestId,180),
    submissionId:clean(packet.submissionId,180),
    validatorId:clean(vault.identityId,180),
    validatorDeviceId:clean(vault.deviceId,180),
    validatorType:'cloud-model-assisted-human',
    relationship:'independent',
    provider:'cloudflare-workers-ai',
    model:clean(result.model,240),
    verdict:['pass','fail'].includes(validation.verdict)?validation.verdict:'fail',
    confidence:Math.max(0,Math.min(1,Number(validation.confidence)||0)),
    rubricScore:rubricScores.length?rubricScores.reduce((sum,row)=>sum+row.score,0)/rubricScores.length:0,
    rubricThreshold:0.6,
    rubricScores,
    evidenceChecks:evidenceChecks(packet),
    reason:clean(validation.reason,1800),
    integrity:'verified',
    provenance:'cloud-model-rubric-user-opt-in',
    compute:{chargedNeurons:Number(result?.usage?.chargedNeurons)||0,source:detail.allowLifetimeCredits?'included-or-explicit-lifetime':'included-only'},
    createdAt:new Date().toISOString()
  };
  const receipt={...unsigned,signature:await identity.signValue(vault,unsigned)};
  const recorded=await reward.record(receipt);
  return{receipt,recorded};
}
async function validate(detail={}){
  const preferredNode=clean(detail.nodeId,180),session=usableSession(preferredNode);
  if(!session)throw new Error('This device does not have an active Guild-capacity session. Reconnect or rejoin the Guild before using cloud validation.');
  const endpoint=new URL('/api/ai/node/validation',session.origin);
  endpoint.searchParams.set('nodeId',session.nodeId);
  const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${session.token}`,'x-civweave-node-id':session.nodeId},body:JSON.stringify({packet:detail.packet,estimatedNeurons:detail.estimatedNeurons,allowLifetimeCredits:detail.allowLifetimeCredits===true})});
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(clean(result.error||`Cloud validation failed with HTTP ${response.status}.`,1200));
  access()?.recordUsage?.({nodeId:session.nodeId,chargedNeurons:Number(result?.usage?.chargedNeurons)||0,quota:result.quota||null});
  const reward=await rewardReceipt(detail,result);
  const combined={...result,reward};
  const battleDetail={
    packetId:detail.packetId||detail.packet?.id,
    submissionId:reward.receipt.submissionId,
    requestId:reward.receipt.requestId,
    chargedNeurons:Number(result?.usage?.chargedNeurons)||0,
    receiptId:reward.receipt.id,
    verdict:reward.receipt.verdict,
    confidence:reward.receipt.confidence,
    relationship:reward.receipt.relationship,
    validatorType:reward.receipt.validatorType,
    provider:reward.receipt.provider,
    provenance:reward.receipt.provenance,
    external:true
  };
  dispatchEvent(new CustomEvent('civweave:validation-receipt-recorded',{detail:battleDetail}));
  ensureValidationBattle().then(api=>api?.playFromValidation?.(battleDetail)).catch(error=>console.warn('[Civweave validation battle]',error));
  return combined;
}
function clearSession(nodeId=''){return access()?.clearSession?.(nodeId)||false}
function status(){return{version:VERSION,owner:access()?.version||null,sessions:access()?.publicStatus?.().sessions||[]}}
addEventListener('civweave:capacity-session',event=>{try{setSession(event.detail)}catch(error){console.warn('Civweave capacity session rejected',error)}});
globalThis.CivweaveCloudValidationExecutorV1=Object.freeze({version:VERSION,validate,setSession,clearSession,status,sessionFor:usableSession,ensureValidationBattle});
})();
