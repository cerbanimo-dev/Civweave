(()=>{
'use strict';
const VERSION='1.0.0';
if(globalThis.CivweaveLudGameUiV1?.version===VERSION)return;

const text=(id,value)=>{const node=document.getElementById(id);if(node&&value!=null)node.textContent=String(value)};
const clean=value=>String(value??'').trim();

function passport(){
  try{return clean(globalThis.CivweavePassportIdentityV1?.passportId?.())||'Local Passport'}catch{return'Local Passport'}
}
function guild(){
  try{
    const api=globalThis.CivweaveHostNodeSessionV1,status=api?.publicStatus?.()||{},session=Array.isArray(status.sessions)?status.sessions.find(row=>row?.active):null;
    if(session)return{label:clean(session.nodeId)||'Guild joined',state:'joined'};
    if(status.selectedOrigin)return{label:'Guild selected',state:'selected'};
  }catch{}
  return{label:'Find a Guild',state:'open'};
}
function renderHud(){
  const passportId=passport(),guildState=guild();
  text('lud-hud-passport',passportId);
  text('lud-passport-id',passportId);
  text('lud-hud-guild',guildState.label);
  const node=document.getElementById('lud-hud-guild');if(node)node.dataset.state=guildState.state;
  return{passportId,guild:guildState};
}
function markReady(){
  document.documentElement.dataset.ludUi='game-v1';
  if(document.body)document.body.dataset.ludReady='true';
}
function pressed(event,value){
  const target=event.target?.closest?.('button,a.button');
  if(!target)return;
  if(value)target.dataset.pressed='true';else delete target.dataset.pressed;
}
function boot(){markReady();renderHud()}

addEventListener('civweave:passport-ready',renderHud);
addEventListener('civweave:capacity-session-ready',renderHud);
addEventListener('civweave:capacity-session-cleared',renderHud);
addEventListener('civweave:host-node-selected',renderHud);
addEventListener('pointerdown',event=>pressed(event,true),{passive:true});
addEventListener('pointerup',event=>pressed(event,false),{passive:true});
addEventListener('pointercancel',event=>pressed(event,false),{passive:true});
addEventListener('blur',()=>document.querySelectorAll('[data-pressed="true"]').forEach(node=>delete node.dataset.pressed));
if(document.readyState==='loading')addEventListener('DOMContentLoaded',boot,{once:true});else boot();

globalThis.CivweaveLudGameUiV1=Object.freeze({version:VERSION,renderHud,status:()=>({passportId:passport(),guild:guild()})});
})();
