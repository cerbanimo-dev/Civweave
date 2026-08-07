(()=>{
'use strict';

const VERSION='1.0.0';
const REVISION='experience-orchestrator-v232';
const DEFAULT_TTL_MS=18000;
const PROTECTED_ROUTE_RE=/(?:^|\/)(?:checkout|payment|billing|auth|login|sign[-_]?in|sign[-_]?up|submit|confirmation?|destructive|recovery|error)(?:\/|$)/i;
let activeSlot=null;
let tokenCounter=0;

function now(){return Date.now()}
function routeText(value){return String(value||`${location.pathname}${location.search}`).slice(0,1800)}
function markedProtected(){
  const root=document.documentElement;
  const body=document.body;
  if(root?.dataset?.protectedFlow==='true'||body?.dataset?.protectedFlow==='true')return true;
  return Boolean(document.querySelector?.('[data-protected-flow="true"],[data-critical-flow="true"],[data-destructive-confirmation="true"]'));
}
function protectedFlow(context={}){
  if(context.userInteractionState?.critical===true)return true;
  if(context.protectedFlow===true)return true;
  return PROTECTED_ROUTE_RE.test(routeText(context.route))||markedProtected();
}
function clearExpired(){if(activeSlot&&activeSlot.expiresAt<=now())activeSlot=null}
function emit(type,detail={}){
  const event={type,source:'experience-orchestrator',timestamp:new Date().toISOString(),...detail};
  globalThis.dispatchEvent?.(new CustomEvent('civweave:experience-orchestrator',{detail:event}));
  return event;
}
function claim(experienceId,options={}){
  const id=String(experienceId||'').trim();
  if(!id)return Object.freeze({ok:false,reason:'missing_experience_id'});
  if(protectedFlow(options.context||{}))return Object.freeze({ok:false,reason:'protected_flow'});
  clearExpired();
  if(activeSlot&&activeSlot.experienceId!==id)return Object.freeze({ok:false,reason:'another_experience_active',activeExperience:activeSlot.experienceId});
  const token=`${id}:${++tokenCounter}:${now().toString(36)}`;
  activeSlot={experienceId:id,token,priority:Number(options.priority||0),expiresAt:now()+Math.max(1000,Number(options.ttlMs||DEFAULT_TTL_MS))};
  emit('EXPERIENCE_SLOT_CLAIMED',{experienceId:id,token,priority:activeSlot.priority});
  return Object.freeze({ok:true,token,experienceId:id});
}
function release(tokenOrExperienceId){
  clearExpired();
  if(!activeSlot)return false;
  const value=String(tokenOrExperienceId||'');
  if(value!==activeSlot.token&&value!==activeSlot.experienceId)return false;
  const released=activeSlot;
  activeSlot=null;
  emit('EXPERIENCE_SLOT_RELEASED',{experienceId:released.experienceId});
  return true;
}
function status(){clearExpired();return Object.freeze({version:VERSION,revision:REVISION,active:activeSlot?{...activeSlot}:null,protectedFlow:protectedFlow()})}

const api=Object.freeze({version:VERSION,revision:REVISION,claim,release,status,protectedFlow});
globalThis.CivweaveExperienceOrchestratorV232=api;
globalThis.dispatchEvent?.(new CustomEvent('civweave:experience-orchestrator-ready',{detail:{version:VERSION,revision:REVISION}}));
})();
