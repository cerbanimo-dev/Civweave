(()=>{
'use strict';
const VERSION='1.0.4-action-followthrough-v165';
if(globalThis.CivweaveActionFollowthroughV165?.version===VERSION)return;
const ACTION_KEY='civweave.realm-actions.v141';
const ACTIVE_STATES=new Set(['active','published','completed']);
const PENDING_STATES=new Set(['draft','clarifying','review','funding']);
const MATERIAL_TERMS=/\b(materials?|supplies|parts|components|equipment|tools?|lumber|wood|windows?|soil|seedlings?|hardware|fabric|paint|fasteners?|fixtures?)\b/i;
const APPROVAL_PATTERNS=[
  /^\s*(?:yes[, ]*)?(?:please\s+)?(?:go ahead(?:\s+and)?\s+)?(?:approve|submit|publish|post|send|activate|begin|proceed)\b/i,
  /^\s*(?:yes[, ]*)?(?:go ahead|do it|put it up|send it|post it|publish it|submit it)\s*[.!]?\s*$/i,
  /\b(?:approve|submit|publish|post)\s+(?:this|the)\s+(?:draft|request|need|offer|materials? request)\b/i
];
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const clean=(value,max=8000)=>String(value??'').trim().slice(0,max);
const now=()=>new Date().toISOString();
const actions=()=>{const value=parse(localStorage.getItem(ACTION_KEY),[]);return Array.isArray(value)?value:[]};
function save(rows){localStorage.setItem(ACTION_KEY,JSON.stringify(rows.slice(0,120)));try{dispatchEvent(new CustomEvent('civweave:actions-changed',{detail:{items:rows}}))}catch{}}
function latestPending(system){return actions().filter(item=>item?.system===system&&PENDING_STATES.has(item.state)).sort((a,b)=>(Date.parse(b.updatedAt||b.createdAt||0)||0)-(Date.parse(a.updatedAt||a.createdAt||0)||0))[0]||null}
function explicitApproval(text){const value=clean(text,600);return value.length>0&&value.length<220&&APPROVAL_PATTERNS.some(pattern=>pattern.test(value))}
function materialItems(text){
  const raw=clean(text,4000).replace(/\r/g,'');
  const lines=raw.split(/\n|;/).map(value=>value.replace(/^\s*(?:[-*•]|\d+[.)])\s*/,'').trim()).filter(Boolean);
  const candidates=lines.length>1?lines:raw.split(',').map(value=>value.trim()).filter(Boolean);
  return candidates.filter(value=>MATERIAL_TERMS.test(value)||/\b\d+\b/.test(value)).map(value=>clean(value,240)).slice(0,24);
}
function normalizeFellowFareAction(action,text=''){
  if(!action||action.system!=='fellowfare')return action;
  const source=clean(text||action.sourceText,4000);
  if(!MATERIAL_TERMS.test(source)&&action.fields?.category!=='Materials')return action;
  action.kind='materials-request';
  action.fields={...(action.fields||{}),category:'Materials'};
  const items=materialItems(source);
  if(items.length)action.fields.materials=items;
  if(!action.fields.need||/^(other|not yet specified)$/i.test(action.fields.need))action.fields.need=source;
  if(!action.title||/^(resource request|other)$/i.test(action.title)){
    const subject=clean(action.fields.need||source,110).replace(/[.!?]+$/,'');
    action.title=`Materials request${subject?`: ${subject}`:''}`.slice(0,160);
  }
  action.updatedAt=now();
  const rows=actions(),index=rows.findIndex(item=>item.id===action.id);
  if(index>=0){rows[index]=action;save(rows)}
  return action;
}
function approvalGate(action){return{kind:'realm-action-approval',actionId:action.id,state:action.state,required:Boolean(action.approval?.required),label:action.approval?.label||'Approve request',missingRequired:[...(action.missingRequired||[])]}}
function canonicalFellowFareAnswer(action,result=null){
  const missing=action?.missingRequired||[],materials=action?.fields?.category==='Materials'||action?.kind==='materials-request';
  const noun=materials?'materials request':'request';
  if(missing.length)return`Rook kept the ${noun} private. Before it can be submitted, provide ${missing.join(' and ')}.`;
  if(result?.held||action?.state==='funding')return`Rook approved the ${noun} and held it privately until the remaining ${action?.fields?.fundingGap||0} Buttons are earned. Nothing was published early.`;
  if(action?.state==='published')return`Rook published the approved ${noun} to FellowFare. The market record now carries the details and terms you reviewed.`;
  if(ACTIVE_STATES.has(action?.state))return`Rook moved the approved ${noun} onto its active FellowFare route.`;
  return`Rook created a reviewable ${noun} and kept it private. Review the details, then approve it to publish.`;
}
function responsePacket(action,answer,{provider='local-contract',model='civweave-explicit-approval-v165',approval=true}={}){
  return{
    response:{answer,choice:{mode:'Acquire',system:'fellowfare',room:'',nextAction:approval&&action?.missingRequired?.length?`Provide ${action.missingRequired.join(' and ')}.`:approval&&!ACTIVE_STATES.has(action?.state)?`Review and approve “${action?.title||'the request'}.”`:''},assumptions:[],requiresConsent:approval&&!ACTIVE_STATES.has(action?.state),confidence:.99,approvalGate:approval&&!ACTIVE_STATES.has(action?.state)?approvalGate(action):null},
    requestedProvider:'local-contract',provider,model,action,context:null,fallbackFrom:null
  };
}
function patchAssistant(api){
  if(!api?.respond||api.__cw165ActionFollowthrough)return api;
  const original=api.respond.bind(api);
  api.respond=async options=>{
    const request={...(options||{})},system=request.systemId||'civweave',text=clean(request.text,4000);
    if(system==='fellowfare'&&explicitApproval(text)){
      const pending=latestPending('fellowfare');
      if(pending){
        normalizeFellowFareAction(pending,pending.sourceText);
        if((pending.missingRequired||[]).length)return responsePacket(pending,canonicalFellowFareAnswer(pending),{approval:true});
        const contracts=globalThis.CivweaveGuideContractsV141;
        if(!contracts?.approve)throw new Error('The saved FellowFare request could not reach its approval route.');
        const result=contracts.approve(pending.id),action=result?.action||pending;
        normalizeFellowFareAction(action,action.sourceText);
        return responsePacket(action,canonicalFellowFareAnswer(action,result),{approval:false});
      }
    }
    const result=await original(request);
    if(result?.action?.system==='fellowfare'){
      const action=normalizeFellowFareAction(result.action,text);
      result.action=action;
      result.response=result.response||{};
      result.response.answer=canonicalFellowFareAnswer(action);
      result.response.requiresConsent=Boolean(action.approval?.required&&!ACTIVE_STATES.has(action.state));
      result.response.approvalGate=ACTIVE_STATES.has(action.state)?null:approvalGate(action);
      result.response.choice={...(result.response.choice||{}),mode:'Acquire',system:'fellowfare',nextAction:(action.missingRequired||[]).length?`Provide ${action.missingRequired.join(' and ')}.`:`Review and approve “${action.title}.”`};
    }
    return result;
  };
  Object.defineProperty(api,'__cw165ActionFollowthrough',{value:true});
  return api;
}
function patchAvailable(){patchAssistant(globalThis.CivweaveAssistantV141)}
function patchLoader(loader){
  if(!loader?.ensure||loader.__cw165ActionFollowthrough)return loader;
  const ensure=loader.ensure.bind(loader);
  loader.ensure=async(...args)=>{const result=await ensure(...args);patchAvailable();return result};
  if(loader.warm){const warm=loader.warm.bind(loader);loader.warm=async(...args)=>{const result=await warm(...args);patchAvailable();return result}}
  Object.defineProperty(loader,'__cw165ActionFollowthrough',{value:true});
  return loader;
}
patchLoader(globalThis.CivweaveFamilyAILoaderV105);
patchAvailable();
addEventListener('civweave:guide-loader-reset',()=>setTimeout(()=>{patchLoader(globalThis.CivweaveFamilyAILoaderV105);patchAvailable()},0));
globalThis.CivweaveActionFollowthroughV165={version:VERSION,explicitApproval,latestPending,normalizeFellowFareAction,patchAvailable,canonicalFellowFareAnswer};
})();
