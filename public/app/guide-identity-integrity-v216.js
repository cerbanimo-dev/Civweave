(()=>{
'use strict';

const VERSION='1.0.3-guide-identity-integrity-v216-v242-routing-owner';
const SYSTEMS=['civweave','living-school','cerbanimo','fellowfare','anarchadia'];
const GUIDE={
  civweave:{name:'Weaveling',role:'central mirror and orchestrator'},
  'living-school':{name:'Moss',role:'learning guide'},
  cerbanimo:{name:'Kamiya',role:'Questwright and skilled-work guide'},
  fellowfare:{name:'Rook',role:'quartermaster and exchange guide'},
  anarchadia:{name:'Merlin',role:'civic, feature-request, and automation guide'}
};

if(globalThis.CivweaveGuideIdentityIntegrityV216?.version===VERSION)return;

const clean=value=>String(value??'').trim();
const cleanSystem=value=>SYSTEMS.includes(clean(value).toLowerCase())?clean(value).toLowerCase():'';
const now=()=>new Date().toISOString();
let assistantValue;

function detectPageSystem(){
  const route=cleanSystem(globalThis.CivweaveSystemRoutesV227?.identify?.(location.pathname));
  if(route)return route;
  const query=cleanSystem(new URLSearchParams(location.search).get('system'));
  if(query)return query;
  const declared=cleanSystem(document.documentElement?.dataset?.civweaveSystemRoute||document.documentElement?.dataset?.civweaveSystem||document.body?.dataset?.civweaveSystem||document.body?.dataset?.system);
  if(declared)return declared;
  const path=location.pathname.toLowerCase(),host=location.hostname.toLowerCase();
  if(document.documentElement?.hasAttribute?.('data-living-school-cabinet')||path.includes('/cabinets/living-school/')||path.includes('living-school'))return'living-school';
  if(path.includes('realm-console-v140')||path.includes('cerbanimo')||host==='cerbanimo.com'||host.startsWith('cerbanimo.'))return'cerbanimo';
  if(path.includes('fellowfare'))return'fellowfare';
  if(path.includes('anarchadia'))return'anarchadia';
  return'civweave';
}
function identityBoundary(system){
  const guide=GUIDE[system]||GUIDE.civweave;
  return`Identity boundary: ${guide.name}, the ${guide.role}, is the only guide answering this turn. Never speak in another guide's first-person voice, use another guide's name as your own, or imitate another guide's signature role. A handoff changes the responding guide before generation; the receiving guide then answers in their own voice.`;
}
function explicitActionSystem(text,contextSystem='civweave'){
  const value=clean(text).slice(0,4000).toLowerCase();
  if(!value)return'';
  if(/\b(dark mode|light mode|appearance|theme|feature request|bug report|report a bug|platform feature)\b/.test(value))return'anarchadia';
  if(/\b(need|looking for|find|get|buy|borrow|pay|purchase|food|meal|materials|supplies|trade request|offer)\b/.test(value)&&!/\bneed to (learn|study|practice)\b/.test(value))return'fellowfare';
  if(/\b(learn|teach|curriculum|lesson|study|practice a skill|learning path)\b/.test(value))return'living-school';
  if(/\b(build|implement|prototype|repair|develop|make a project|create a project|skilled work)\b/.test(value))return'cerbanimo';
  return contextSystem!=='civweave'&&/\b(request|draft|plan|create|make|start)\b/.test(value)?cleanSystem(contextSystem):'';
}
function effectiveResponder(options={}){
  const requested=cleanSystem(options.systemId)||detectPageSystem();
  const explicit=cleanSystem(options.handoffSystem);
  const page=detectPageSystem();
  const routed=!explicit&&requested==='civweave'?explicitActionSystem(options.text,cleanSystem(options.contextSystem)||page):'';
  const responding=explicit||routed||(requested==='civweave'&&page!=='civweave'?page:requested);
  return{requested,responding,handedOff:responding!==requested,actionRouted:Boolean(routed),reason:explicit?'explicit-handoff':routed?'explicit-action-route':responding!==requested?'current-realm-handoff':'selected-guide'};
}
function addIdentityHistory(history,system){const rows=Array.isArray(history)?history.slice():[];rows.push({role:'system',text:identityBoundary(system)});return rows}
function wrapAssistant(assistant){
  if(!assistant||typeof assistant.respond!=='function')return assistant;
  if(assistant.respond.__guideIdentityIntegrityV216)return assistant;
  const original=assistant.respond.bind(assistant);
  async function respond(options={}){
    const identity=effectiveResponder(options);
    const result=await original({...options,systemId:identity.responding,history:addIdentityHistory(options.history,identity.responding)});
    const actual=cleanSystem(result?.context?.guide?.system)||identity.responding;
    if(actual!==identity.responding)throw new Error(`Guide identity mismatch: ${GUIDE[identity.responding].name} received the handoff, but ${GUIDE[actual].name} received the model turn.`);
    if(identity.actionRouted&&result?.action&&result?.response?.answer)result.response.answer=`Weaveling routed this to ${actual==='anarchadia'?'Anarchadia':actual==='fellowfare'?'FellowFare':actual==='living-school'?'Living School':'Cerbanimo'}. ${result.response.answer}`;
    const enriched={...result,requestedSystem:identity.requested,respondingSystem:actual,respondingGuide:GUIDE[actual].name,handedOff:identity.handedOff,handoffReason:identity.reason,identityIntegrity:VERSION};
    try{dispatchEvent(new CustomEvent('civweave:guide-response-identity',{detail:{requestedSystem:identity.requested,respondingSystem:actual,guide:GUIDE[actual].name,handedOff:identity.handedOff,reason:identity.reason,at:now()}}))}catch{}
    return enriched;
  }
  respond.__guideIdentityIntegrityV216=true;
  if(original.__deterministicModeV175)respond.__deterministicModeV175=true;
  return{...assistant,respond,identityIntegrityVersion:VERSION,identityPolicy:'selected-guide-or-receiving-guide-after-handoff'};
}
function installAssistantBoundary(){
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'CivweaveAssistantV141');
  if(descriptor&&!descriptor.configurable){
    assistantValue=wrapAssistant(globalThis.CivweaveAssistantV141);
    try{globalThis.CivweaveAssistantV141=assistantValue}catch{}
    return false;
  }
  assistantValue=wrapAssistant(globalThis.CivweaveAssistantV141);
  Object.defineProperty(globalThis,'CivweaveAssistantV141',{
    configurable:true,
    enumerable:true,
    get:()=>assistantValue,
    set:value=>{
      assistantValue=wrapAssistant(value);
      try{dispatchEvent(new CustomEvent('civweave:guide-identity-boundary-installed',{detail:{version:VERSION,at:now()}}))}catch{}
    }
  });
  return true;
}
function onResponseIdentity(event){
  const detail=event?.detail||{},system=cleanSystem(detail.respondingSystem);
  if(!detail.handedOff||!system)return;
  queueMicrotask(()=>globalThis.CivweaveGuideWorkspaceV242?.switchWindow?.(system,{open:false}));
}

const trapped=installAssistantBoundary();
addEventListener('civweave:guide-response-identity',onResponseIdentity);

globalThis.CivweaveGuideIdentityIntegrityV216=Object.freeze({
  version:VERSION,
  systems:[...SYSTEMS],
  trapped,
  identityBoundary,
  explicitActionSystem,
  effectiveResponder,
  wrapAssistant,
  identityPolicy:'selected-guide-or-receiving-guide-after-handoff',
  routingPolicy:'explicit-actions-route-before-generation',
  canonicalChatOwner:'guide-workspace-v242',
  destroy(){removeEventListener('civweave:guide-response-identity',onResponseIdentity)}
});
})();