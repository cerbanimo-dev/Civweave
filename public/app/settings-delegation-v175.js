(()=>{
'use strict';
const VERSION='269.0-ai-settings-canonical-entry';
if(globalThis.CivweaveSettingsDelegationV188?.version===VERSION)return;
const SELECTOR='[data-open-unified-ai-settings],#aiSettings,#modelSettings,#btnAISettings,[data-ai-settings]';
const DIAGNOSTIC_ID='cw-ai-routing-diagnostic-v269';
function controller(){return globalThis.CivweaveAISettingsCleanroomV188||globalThis.CivweaveModelSettingsControllerV173||globalThis.CivweaveUnifiedAISettingsV175||null;}
function routingSnapshot(){
  const broker=globalThis.CivweaveAICapabilityBrokerV268;
  const spine=globalThis.CivweaveFastInteractiveV192;
  const brokerState=broker?.diagnostics?.()||null;
  const spineState=spine?.diagnostics?.()||spine?.status?.()||null;
  return{broker:brokerState,spine:spineState};
}
function patchRoutingDiagnostic(){
  const form=document.querySelector?.('[data-cw-cleanroom-form]');
  if(!form)return false;
  let node=form.querySelector(`#${DIAGNOSTIC_ID}`);
  if(!node){
    node=document.createElement('div');
    node.id=DIAGNOSTIC_ID;
    node.className='cw-clean-note';
    node.setAttribute('role','status');
    const footer=form.querySelector('footer');
    if(footer)form.insertBefore(node,footer);else form.append(node);
  }
  const {broker,spine}=routingSnapshot();
  const decision=broker?.lastDecision||null;
  const middleware=Array.isArray(spine?.middleware)?spine.middleware.join(', '):'';
  if(decision){
    const requirements=Object.entries(decision.requirements||{}).filter(([,value])=>value===true||value==='agentic').map(([key,value])=>value===true?key:`${key}:${value}`).join(', ')||'interactive';
    node.textContent=`AI routing · ${decision.route} · ${decision.reason}. Requirements: ${requirements}. Authority: ${decision.authority||'deterministic-contracts'}.${middleware?` Runtime spine: ${middleware}.`:''}`;
  }else{
    node.textContent=`AI routing is capability-aware. Models may interpret and draft; deterministic contracts still own approvals, rewards, ledger settlement, and consequential actions.${middleware?` Runtime spine: ${middleware}.`:''}`;
  }
  return true;
}
function open(launcher){
  const active=controller();
  if(!active?.open)return null;
  const layer=active.open(launcher);
  queueMicrotask(patchRoutingDiagnostic);
  try{dispatchEvent(new CustomEvent('civweave:ai-settings-entry-opened',{detail:{version:VERSION,launcherId:launcher?.id||'',controller:active.version||'cleanroom'}}))}catch{}
  return layer;
}
function onClick(event){
  const launcher=event.target instanceof Element?event.target.closest(SELECTOR):null;
  if(!launcher)return;
  event.preventDefault();
  event.stopPropagation();
  open(launcher);
}
document.addEventListener('click',onClick);
addEventListener('civweave:model-settings-opened',()=>queueMicrotask(patchRoutingDiagnostic));
addEventListener('civweave:ai-capability-decision',()=>queueMicrotask(patchRoutingDiagnostic));
addEventListener('civweave:runtime-spine-ready',()=>queueMicrotask(patchRoutingDiagnostic));
const inertLog=Object.freeze({
  version:'retired-by-ai-settings-cleanroom-v188',
  setLevel(){return'off';},
  getLevel(){return'off';},
  enabled(){return false;},
  write(){return null;},
  error(){return null;},
  warn(){return null;},
  info(){return null;},
  debug(){return null;},
  trace(){return null;},
  snapshot(){return[];},
  exportText(){return'';},
  copy(){return Promise.resolve(false);},
  download(){return false;},
  clear(){return true;},
  renderDock(){return null;},
});
globalThis.CivweaveLogV183=inertLog;
globalThis.CivweaveSettingsDelegationV188=Object.freeze({
  version:VERSION,
  selector:SELECTOR,
  listenerPhase:'bubble',
  listenerCount:1,
  mutationObserver:false,
  polling:false,
  timers:false,
  diagnosticsRuntime:false,
  providerRuntimeOnOpen:false,
  open,
  patchRoutingDiagnostic,
  routingSnapshot,
});
document.documentElement.dataset.settingsDelegation='canonical-v269';
})();
