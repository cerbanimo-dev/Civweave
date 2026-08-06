(()=>{
'use strict';

const VERSION='1.0.1-guide-identity-integrity-v216';
const CHAT_KEY='commonweave.persistent-guide-chat.v214';
const ROOT_ID='cw-persistent-guide-chat-v215';
const SYSTEMS=['commonweave','living-school','cerbanimo','fellowfare','anarchadia'];
const GUIDE={
  commonweave:{name:'Weaveling',role:'central mirror and orchestrator',avatar:'/app/assets/ai/weaveling.png',palette:'#ebe7dd'},
  'living-school':{name:'Moss',role:'learning guide',avatar:'/app/assets/ai/moss.png',palette:'#59cf87'},
  cerbanimo:{name:'Kamiya',role:'Questwright and skilled-work guide',avatar:'/app/assets/ai/kamiya.png',palette:'#a66cff'},
  fellowfare:{name:'Rook',role:'quartermaster and exchange guide',avatar:'/app/assets/ai/rook.png',palette:'#f2a93b'},
  anarchadia:{name:'Merlin',role:'civic, feature-request, and automation guide',avatar:'/app/assets/ai/merlin.png',palette:'#ff4f9a'}
};

if(globalThis.CommonweaveGuideIdentityIntegrityV216?.version===VERSION)return;

const clean=value=>String(value??'').trim();
const cleanSystem=value=>SYSTEMS.includes(clean(value).toLowerCase())?clean(value).toLowerCase():'';
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const now=()=>new Date().toISOString();
let assistantValue;
let observer=null;
let stabilizationTimer=0;
let pendingIdentities=[];

function detectPageSystem(){
  const query=cleanSystem(new URLSearchParams(location.search).get('system'));
  if(query)return query;
  const declared=cleanSystem(document.documentElement?.dataset?.commonweaveSystem||document.body?.dataset?.commonweaveSystem||document.body?.dataset?.system);
  if(declared)return declared;
  const path=location.pathname.toLowerCase(),host=location.hostname.toLowerCase();
  if(document.documentElement?.hasAttribute?.('data-living-school-cabinet')||path.includes('/cabinets/living-school/')||path.includes('living-school'))return'living-school';
  if(path.includes('cerbanimo')||path.split('/').includes('loom')||host==='cerbanimo.com'||host.startsWith('cerbanimo.'))return'cerbanimo';
  if(path.includes('fellowfare'))return'fellowfare';
  if(path.includes('anarchadia'))return'anarchadia';
  return'commonweave';
}

function migratePersistentThread(){
  let raw='';
  try{raw=localStorage.getItem(CHAT_KEY)||''}catch{return{corrected:0}}
  if(!raw)return{corrected:0};
  const state=parse(raw,null);
  if(!state||!Array.isArray(state.messages))return{corrected:0};
  let corrected=0;
  for(const row of state.messages){
    if(!row||row.role!=='assistant')continue;
    const responder=cleanSystem(row.responderSystem||row.actionSnapshot?.system||row.handoff?.toSystem);
    if(!responder||row.guide===responder)continue;
    row.guide=responder;
    row.responderSystem=responder;
    row.identityCorrection='v216-action-owner';
    corrected++;
  }
  if(!corrected)return{corrected:0};
  state.identityIntegrityRevision='v216-explicit-responder-ownership';
  state.updatedAt=now();
  try{localStorage.setItem(CHAT_KEY,JSON.stringify(state))}catch{return{corrected:0}}
  try{dispatchEvent(new CustomEvent('commonweave:guide-identity-migrated',{detail:{corrected,key:CHAT_KEY,at:now()}}))}catch{}
  return{corrected};
}

function identityBoundary(system){
  const guide=GUIDE[system]||GUIDE.commonweave;
  return`Identity boundary: ${guide.name}, the ${guide.role}, is the only guide answering this turn. Never speak in another guide's first-person voice, use another guide's name as your own, or imitate another guide's signature role. A handoff changes the responding guide before generation; the receiving guide then answers in their own voice.`;
}

function effectiveResponder(options={}){
  const requested=cleanSystem(options.systemId)||detectPageSystem();
  const explicit=cleanSystem(options.handoffSystem);
  const page=detectPageSystem();
  const responding=explicit||(requested==='commonweave'&&page!=='commonweave'?page:requested);
  return{
    requested,
    responding,
    handedOff:responding!==requested,
    reason:explicit?'explicit-handoff':responding!==requested?'current-realm-handoff':'selected-guide'
  };
}

function addIdentityHistory(history,system){
  const rows=Array.isArray(history)?history.slice():[];
  rows.push({role:'system',text:identityBoundary(system)});
  return rows;
}

function responseText(result){
  const answer=clean(result?.response?.answer);
  const next=clean(result?.response?.choice?.nextAction);
  return next?`${answer}\n\nNext: ${next}`:answer;
}

function rememberResponseIdentity(result,identity){
  const text=responseText(result);
  pendingIdentities=pendingIdentities.filter(item=>Date.now()-item.createdAt<30000);
  pendingIdentities.push({
    text,
    system:identity.responding,
    provider:clean(result?.provider),
    model:clean(result?.model),
    createdAt:Date.now()
  });
}

function correctChatPayload(value){
  const state=parse(String(value??''),null);
  if(!state||!Array.isArray(state.messages))return String(value??'');
  pendingIdentities=pendingIdentities.filter(item=>Date.now()-item.createdAt<30000);
  if(!pendingIdentities.length)return String(value??'');
  let changed=false;
  const unresolved=[];
  for(const identity of pendingIdentities){
    let index=-1;
    for(let cursor=state.messages.length-1;cursor>=0;cursor--){
      const row=state.messages[cursor];
      if(!row||row.role!=='assistant'||row.pending)continue;
      if(identity.text&&clean(row.text)===identity.text){index=cursor;break}
      if(index<0&&identity.provider&&clean(row.provider)===identity.provider&&(!identity.model||clean(row.model)===identity.model))index=cursor;
    }
    if(index<0){unresolved.push(identity);continue}
    const row=state.messages[index];
    if(row.guide!==identity.system||row.responderSystem!==identity.system){
      row.guide=identity.system;
      row.responderSystem=identity.system;
      row.identityCorrection='v216-response-owner';
      changed=true;
    }
  }
  pendingIdentities=unresolved;
  if(!changed)return String(value??'');
  state.identityIntegrityRevision='v216-explicit-responder-ownership';
  state.updatedAt=now();
  return JSON.stringify(state);
}

function installStorageBoundary(){
  const proto=globalThis.Storage?.prototype;
  if(proto&&typeof proto.setItem==='function'){
    if(proto.setItem.__guideIdentityIntegrityV216)return true;
    const original=proto.setItem;
    const wrapped=function(key,value){return original.call(this,key,key===CHAT_KEY?correctChatPayload(value):value)};
    wrapped.__guideIdentityIntegrityV216=true;
    proto.setItem=wrapped;
    return true;
  }
  const storage=globalThis.localStorage;
  if(!storage||typeof storage.setItem!=='function'||storage.setItem.__guideIdentityIntegrityV216)return Boolean(storage);
  const original=storage.setItem.bind(storage);
  const wrapped=(key,value)=>original(key,key===CHAT_KEY?correctChatPayload(value):value);
  wrapped.__guideIdentityIntegrityV216=true;
  try{storage.setItem=wrapped;return storage.setItem===wrapped}catch{return false}
}

function reconcilePersistentDom(){
  const root=document.getElementById(ROOT_ID);
  if(!root)return;
  const state=parse(localStorage.getItem(CHAT_KEY),{});
  const rows=Array.isArray(state.messages)?state.messages.filter(row=>row?.role==='assistant'):[];
  const articles=[...root.querySelectorAll('.cwp215-message:not(.is-user)')];
  for(let index=0;index<Math.min(rows.length,articles.length);index++){
    const row=rows[index],system=cleanSystem(row.responderSystem||row.guide)||'commonweave',guide=GUIDE[system],article=articles[index];
    const image=article.querySelector('img');
    if(image&&image.getAttribute('src')!==guide.avatar){image.src=guide.avatar;image.alt=guide.name}
    const name=article.querySelector('.cwp215-meta b');
    if(name&&name.textContent!==guide.name)name.textContent=guide.name;
    article.style.setProperty('--notify',guide.palette);
    article.dataset.responderSystem=system;
  }
}

function installDomBoundary(){
  if(observer)return true;
  observer=new MutationObserver(()=>queueMicrotask(reconcilePersistentDom));
  observer.observe(document.documentElement,{childList:true,subtree:true});
  queueMicrotask(reconcilePersistentDom);
  return true;
}

function wrapAssistant(assistant){
  if(!assistant||typeof assistant.respond!=='function')return assistant;
  if(assistant.respond.__guideIdentityIntegrityV216)return assistant;
  const original=assistant.respond.bind(assistant);

  async function respond(options={}){
    const identity=effectiveResponder(options);
    const result=await original({
      ...options,
      systemId:identity.responding,
      history:addIdentityHistory(options.history,identity.responding)
    });
    const actual=cleanSystem(result?.context?.guide?.system)||identity.responding;
    if(actual!==identity.responding){
      throw new Error(`Guide identity mismatch: ${GUIDE[identity.responding].name} received the handoff, but ${GUIDE[actual].name} received the model turn.`);
    }
    const enriched={
      ...result,
      requestedSystem:identity.requested,
      respondingSystem:actual,
      respondingGuide:GUIDE[actual].name,
      handedOff:identity.handedOff,
      handoffReason:identity.reason,
      identityIntegrity:VERSION
    };
    rememberResponseIdentity(enriched,{...identity,responding:actual});
    try{dispatchEvent(new CustomEvent('commonweave:guide-response-identity',{detail:{requestedSystem:identity.requested,respondingSystem:actual,guide:GUIDE[actual].name,handedOff:identity.handedOff,reason:identity.reason,at:now()}}))}catch{}
    return enriched;
  }

  respond.__guideIdentityIntegrityV216=true;
  if(original.__deterministicModeV175)respond.__deterministicModeV175=true;
  return{
    ...assistant,
    respond,
    identityIntegrityVersion:VERSION,
    identityPolicy:'selected-guide-or-receiving-guide-after-handoff'
  };
}

function ensureAssistantBoundary(){
  if(!assistantValue&&globalThis.CommonweaveAssistantV141)assistantValue=globalThis.CommonweaveAssistantV141;
  const wrapped=wrapAssistant(assistantValue);
  if(wrapped&&wrapped!==assistantValue)assistantValue=wrapped;
  return Boolean(assistantValue?.respond?.__guideIdentityIntegrityV216);
}

function installAssistantBoundary(){
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'CommonweaveAssistantV141');
  if(descriptor&&!descriptor.configurable){
    assistantValue=wrapAssistant(globalThis.CommonweaveAssistantV141);
    try{globalThis.CommonweaveAssistantV141=assistantValue}catch{}
    return false;
  }
  assistantValue=wrapAssistant(globalThis.CommonweaveAssistantV141);
  Object.defineProperty(globalThis,'CommonweaveAssistantV141',{
    configurable:true,
    enumerable:true,
    get:()=>assistantValue,
    set:value=>{
      assistantValue=wrapAssistant(value);
      try{dispatchEvent(new CustomEvent('commonweave:guide-identity-boundary-installed',{detail:{version:VERSION,at:now()}}))}catch{}
    }
  });
  return true;
}

function stabilizeAssistantBoundary(){
  if(stabilizationTimer)return;
  let ticks=0;
  stabilizationTimer=setInterval(()=>{
    ensureAssistantBoundary();
    if(++ticks>=480){clearInterval(stabilizationTimer);stabilizationTimer=0}
  },25);
}

function onResponseIdentity(event){
  const detail=event?.detail||{};
  const system=cleanSystem(detail.respondingSystem);
  if(!detail.handedOff||!system)return;
  queueMicrotask(()=>globalThis.CommonweavePersistentGuideChatV215?.switchGuide?.(system));
}

const migration=migratePersistentThread();
const storageBoundary=installStorageBoundary();
const trapped=installAssistantBoundary();
const domBoundary=installDomBoundary();
stabilizeAssistantBoundary();
addEventListener('commonweave:guide-response-identity',onResponseIdentity);

globalThis.CommonweaveGuideIdentityIntegrityV216=Object.freeze({
  version:VERSION,
  chatKey:CHAT_KEY,
  systems:[...SYSTEMS],
  migration,
  storageBoundary,
  trapped,
  domBoundary,
  identityBoundary,
  effectiveResponder,
  migratePersistentThread,
  reconcilePersistentDom,
  wrapAssistant,
  destroy(){
    observer?.disconnect();
    observer=null;
    removeEventListener('commonweave:guide-response-identity',onResponseIdentity);
    if(stabilizationTimer){clearInterval(stabilizationTimer);stabilizationTimer=0}
  }
});
})();