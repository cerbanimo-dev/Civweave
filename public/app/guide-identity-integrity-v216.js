(()=>{
'use strict';

const VERSION='1.0.0-guide-identity-integrity-v216';
const CHAT_KEY='commonweave.persistent-guide-chat.v214';
const SYSTEMS=['commonweave','living-school','cerbanimo','fellowfare','anarchadia'];
const GUIDE={
  commonweave:{name:'Weaveling',role:'central mirror and orchestrator'},
  'living-school':{name:'Moss',role:'learning guide'},
  cerbanimo:{name:'Kamiya',role:'Questwright and skilled-work guide'},
  fellowfare:{name:'Rook',role:'quartermaster and exchange guide'},
  anarchadia:{name:'Merlin',role:'civic, feature-request, and automation guide'}
};

if(globalThis.CommonweaveGuideIdentityIntegrityV216?.version===VERSION)return;

const cleanSystem=value=>SYSTEMS.includes(String(value||'').trim().toLowerCase())?String(value).trim().toLowerCase():'';
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const now=()=>new Date().toISOString();
let commonweaveQueue=Promise.resolve();
let assistantValue;

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
  return`Identity boundary: ${guide.name}, the ${guide.role}, is the only guide answering this turn. Never speak in another guide's first-person voice, use another guide's name as your own, or imitate another guide's signature role. When work belongs to another guide, state the handoff plainly and stop; the receiving guide must answer the next turn in their own voice.`;
}

function shadowPageSystem(system){
  const root=document.documentElement;
  const body=document.body;
  const rootHad=root?.hasAttribute('data-commonweave-system');
  const bodyHad=body?.hasAttribute('data-commonweave-system');
  const rootValue=root?.getAttribute('data-commonweave-system');
  const bodyValue=body?.getAttribute('data-commonweave-system');
  const originalRelative=`${location.pathname}${location.search}${location.hash}`;
  let forcedRelative=originalRelative;
  let changedUrl=false;

  try{
    const url=new URL(location.href);
    const querySystem=cleanSystem(url.searchParams.get('system'));
    if(querySystem&&querySystem!==system){
      url.searchParams.set('system',system);
      forcedRelative=`${url.pathname}${url.search}${url.hash}`;
      history.replaceState(history.state,'',forcedRelative);
      changedUrl=true;
    }
  }catch{}

  if(root)root.dataset.commonweaveSystem=system;
  if(body)body.dataset.commonweaveSystem=system;

  return()=>{
    try{
      if(root?.dataset?.commonweaveSystem===system){
        if(rootHad)root.setAttribute('data-commonweave-system',rootValue||'');
        else root.removeAttribute('data-commonweave-system');
      }
      if(body?.dataset?.commonweaveSystem===system){
        if(bodyHad)body.setAttribute('data-commonweave-system',bodyValue||'');
        else body.removeAttribute('data-commonweave-system');
      }
      const currentRelative=`${location.pathname}${location.search}${location.hash}`;
      if(changedUrl&&currentRelative===forcedRelative)history.replaceState(history.state,'',originalRelative);
    }catch{}
  };
}

function addIdentityHistory(history,system){
  const rows=Array.isArray(history)?history.slice():[];
  rows.push({role:'system',text:identityBoundary(system)});
  return rows;
}

function wrapAssistant(assistant){
  if(!assistant||typeof assistant.respond!=='function')return assistant;
  if(assistant.identityIntegrityVersion===VERSION)return assistant;
  const original=assistant.respond.bind(assistant);

  async function run(options,requestedSystem){
    const restore=requestedSystem==='commonweave'?shadowPageSystem(requestedSystem):()=>{};
    try{
      const result=await original({
        ...(options||{}),
        systemId:requestedSystem,
        history:addIdentityHistory(options?.history,requestedSystem)
      });
      const actualSystem=cleanSystem(result?.context?.guide?.system)||requestedSystem;
      if(actualSystem!==requestedSystem){
        throw new Error(`Guide identity mismatch: ${GUIDE[requestedSystem].name} was selected, but ${GUIDE[actualSystem].name} received the model turn.`);
      }
      const enriched={
        ...result,
        requestedSystem,
        respondingSystem:actualSystem,
        respondingGuide:GUIDE[actualSystem].name,
        identityIntegrity:VERSION
      };
      try{dispatchEvent(new CustomEvent('commonweave:guide-response-identity',{detail:{requestedSystem,respondingSystem:actualSystem,guide:GUIDE[actualSystem].name,at:now()}}))}catch{}
      return enriched;
    }finally{
      restore();
    }
  }

  function respond(options={}){
    const requestedSystem=cleanSystem(options.handoffSystem||options.systemId)||'commonweave';
    if(requestedSystem!=='commonweave')return run(options,requestedSystem);
    const task=commonweaveQueue.then(()=>run(options,requestedSystem),()=>run(options,requestedSystem));
    commonweaveQueue=task.catch(()=>{});
    return task;
  }

  return{
    ...assistant,
    respond,
    identityIntegrityVersion:VERSION,
    identityPolicy:'explicit-selected-guide-or-explicit-handoff'
  };
}

function installAssistantBoundary(){
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'CommonweaveAssistantV141');
  if(descriptor&&!descriptor.configurable){
    if(globalThis.CommonweaveAssistantV141)globalThis.CommonweaveAssistantV141=wrapAssistant(globalThis.CommonweaveAssistantV141);
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

const migration=migratePersistentThread();
const trapped=installAssistantBoundary();

globalThis.CommonweaveGuideIdentityIntegrityV216=Object.freeze({
  version:VERSION,
  chatKey:CHAT_KEY,
  systems:[...SYSTEMS],
  migration,
  trapped,
  identityBoundary,
  migratePersistentThread,
  wrapAssistant
});
})();