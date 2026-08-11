(()=>{
'use strict';
const VERSION='1.0.0-validation-cloud-optin-v1';
if(globalThis.CivweaveValidationCloudOptInV1?.version===VERSION)return;
const VALIDATION_KEY='civweave.validation-ledger.v1.1';
const IGNORE_KEY='civweave.validation-cloud-optin.ignored.v1';
const AUTO_LIFETIME_KEY='civweave.validation-cloud-optin.lifetime-budget.v1';
const STYLE_ID='civweave-validation-cloud-optin-style';
const ROOT_ID='civweave-validation-cloud-optin';
const DEFAULT_BOUNTY=2;
const seen=new Set();
let current=null;
const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const clone=value=>value==null?value:structuredClone(value);
function identity(){
  try{const vault=parse(localStorage.getItem('civweave-identity-vault'),{});return{identityId:clean(vault?.identity?.identityId,180),deviceId:clean(vault?.deviceId,180)}}catch{return{identityId:'',deviceId:''}}
}
function ignored(){try{return new Set(parse(localStorage.getItem(IGNORE_KEY),[]))}catch{return new Set()}}
function rememberIgnored(id){const all=ignored();all.add(id);try{localStorage.setItem(IGNORE_KEY,JSON.stringify([...all].slice(-400)))}catch{}}
function localCanValidate(packet){
  const broker=globalThis.CivweaveAICapabilityBrokerV268;
  const request={purpose:'validation',task:'Evaluate submitted evidence against a rubric and return a structured validation verdict.',responseFormat:'structured',capabilityRequirements:{profile:'interactive',structuredOutput:true},context:{packet}};
  if(broker?.activeLocalSpec&&broker?.supportsLocalRequest){
    try{return Boolean(broker.supportsLocalRequest(broker.activeLocalSpec(),request)?.ok)}catch{}
  }
  try{
    const selection=globalThis.CivweaveLocalModelDownloadV266?.selection?.();
    if(!selection?.active||!selection.id)return false;
    return Boolean(globalThis.CivweaveLocalModelRegistryV266?.byId?.(selection.id));
  }catch{return false}
}
function estimateNeurons(packet){
  const rubric=Array.isArray(packet?.rubric)?packet.rubric.join('\n'):'';
  const evidence=Array.isArray(packet?.evidenceArtifacts)?packet.evidenceArtifacts.map(item=>`${item?.name||''} ${item?.inlineText||''} ${item?.sourceRef||''}`).join('\n'):'';
  const summary=clean(packet?.evidenceSummary,12000);
  const chars=(rubric.length+evidence.length+summary.length);
  return Math.max(18,Math.min(120,Math.ceil(18+chars/700)));
}
function bounty(packet){return Math.max(0,Number(packet?.validatorBounty??packet?.coinReward??DEFAULT_BOUNTY)||DEFAULT_BOUNTY)}
function eligible(packet){
  if(!packet||packet.status!=='open'||!packet.id)return false;
  if(ignored().has(packet.id)||seen.has(packet.id))return false;
  const self=identity();
  if(self.identityId&&packet.contributorIdentityId===self.identityId)return false;
  if(self.deviceId&&packet.contributorDeviceId===self.deviceId)return false;
  return true;
}
function style(){
  if(document.getElementById(STYLE_ID))return;
  const node=document.createElement('style');node.id=STYLE_ID;node.textContent=`#${ROOT_ID}{position:fixed;right:max(12px,env(safe-area-inset-right));bottom:calc(76px + env(safe-area-inset-bottom));z-index:2147483000;width:min(330px,calc(100vw - 24px));padding:12px;border-radius:16px;border:1px solid #ffffff2b;background:color-mix(in srgb,#07162f 94%,transparent);box-shadow:0 18px 55px #0008;backdrop-filter:blur(16px);font:13px/1.35 system-ui;color:#f4f7f7}#${ROOT_ID} strong{display:block;font-size:14px}#${ROOT_ID} small{display:block;margin-top:4px;color:#b8c8ce}#${ROOT_ID} .cw-validation-actions{display:flex;gap:8px;margin-top:10px}#${ROOT_ID} button{appearance:none;border:1px solid #ffffff30;border-radius:999px;padding:8px 12px;background:#ffffff0e;color:inherit;font:inherit;font-weight:700;cursor:pointer}#${ROOT_ID} button[data-action="validate"]{background:#ffffff20}#${ROOT_ID}[data-busy="true"] button{opacity:.55;pointer-events:none}`;document.head.append(node);
}
function remove(){document.getElementById(ROOT_ID)?.remove();current=null}
function emit(name,detail){try{dispatchEvent(new CustomEvent(name,{detail}))}catch{}}
async function approve(offer){
  const root=document.getElementById(ROOT_ID);if(root)root.dataset.busy='true';
  const detail={schema:'civweave.validation-cloud-optin.v1',packet:clone(offer.packet),packetId:offer.packet.id,estimatedNeurons:offer.estimatedNeurons,coinReward:offer.coinReward,allowLifetimeCredits:false,lifetimeCreditBudgetNeurons:Math.max(0,Number(parse(localStorage.getItem(AUTO_LIFETIME_KEY),0))||0),requestedAt:new Date().toISOString()};
  emit('civweave:validation-cloud-approved',detail);
  try{
    const executor=globalThis.CivweaveCloudValidationExecutorV1;
    if(executor?.validate){
      const result=await executor.validate(detail);
      emit('civweave:validation-cloud-complete',{...detail,result});
    }
  }catch(error){
    emit('civweave:validation-cloud-error',{...detail,error:clean(error?.message||error,1000)});
  }finally{seen.add(offer.packet.id);remove();queueMicrotask(scan)}
}
function ignore(offer){rememberIgnored(offer.packet.id);emit('civweave:validation-cloud-ignored',{packetId:offer.packet.id,ignoredAt:new Date().toISOString()});remove();queueMicrotask(scan)}
function render(offer){
  if(!globalThis.document)return false;
  style();remove();
  const node=document.createElement('aside');node.id=ROOT_ID;node.setAttribute('role','status');node.setAttribute('aria-live','polite');
  const title=document.createElement('strong');title.textContent=`Validate +${offer.coinReward} coins`;
  const meta=document.createElement('small');meta.textContent=`~${offer.estimatedNeurons} compute · uses today's included AI allowance`;
  const subject=document.createElement('small');subject.textContent=clean(offer.packet.subjectTitle||offer.packet.title||'Community validation',160);
  const actions=document.createElement('div');actions.className='cw-validation-actions';
  const validate=document.createElement('button');validate.type='button';validate.dataset.action='validate';validate.textContent='Validate';validate.addEventListener('click',()=>approve(offer));
  const dismiss=document.createElement('button');dismiss.type='button';dismiss.dataset.action='ignore';dismiss.textContent='Ignore';dismiss.addEventListener('click',()=>ignore(offer));
  actions.append(validate,dismiss);node.append(title,meta,subject,actions);document.body.append(node);current=offer;
  emit('civweave:validation-cloud-offered',{packetId:offer.packet.id,estimatedNeurons:offer.estimatedNeurons,coinReward:offer.coinReward});
  return true;
}
function offer(packet){
  if(!eligible(packet))return{offered:false,reason:'ineligible'};
  if(localCanValidate(packet)){
    seen.add(packet.id);
    emit('civweave:validation-local-available',{packet:clone(packet),packetId:packet.id,coinReward:bounty(packet)});
    return{offered:false,reason:'local-model-available'};
  }
  const next={packet,estimatedNeurons:estimateNeurons(packet),coinReward:bounty(packet)};
  return{offered:render(next),reason:'cloud-opt-in-required',...next};
}
function packetsFromState(state){
  const rows=state?.validation?.packets||state?.packets;
  return Array.isArray(rows)?rows:[];
}
function readPackets(){try{return packetsFromState(parse(localStorage.getItem(VALIDATION_KEY),{}))}catch{return[]}}
function scan(state=null){
  if(current)return current;
  const packets=packetsFromState(state).length?packetsFromState(state):readPackets();
  const candidate=packets.find(eligible);
  if(candidate)return offer(candidate);
  return null;
}
function setLifetimeValidationBudget(neurons=0){const value=Math.max(0,Math.floor(Number(neurons)||0));try{localStorage.setItem(AUTO_LIFETIME_KEY,JSON.stringify(value))}catch{}return value}
function status(){return{version:VERSION,current:current?{packetId:current.packet.id,estimatedNeurons:current.estimatedNeurons,coinReward:current.coinReward}:null,ignored:[...ignored()],lifetimeValidationBudgetNeurons:Math.max(0,Number(parse(localStorage.getItem(AUTO_LIFETIME_KEY),0))||0)}}
addEventListener('civweave:reward-state-changed',event=>scan(event.detail));
addEventListener('storage',event=>{if(event.key===VALIDATION_KEY)scan()});
document.readyState==='loading'?addEventListener('DOMContentLoaded',()=>scan(),{once:true}):queueMicrotask(scan);
const api=Object.freeze({version:VERSION,offer,scan,status,estimateNeurons,localCanValidate,setLifetimeValidationBudget,get current(){return current}});
globalThis.CivweaveValidationCloudOptInV1=api;
emit('civweave:validation-cloud-optin-ready',status());
})();
