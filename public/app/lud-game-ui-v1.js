(()=>{
'use strict';
const VERSION='1.1.0-quest-beat';
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
function questBeat(){
  try{
    const arc=globalThis.CivweaveQuestArcChronicleV1;
    if(!arc)return'The Spark';
    const engineState=globalThis.CivweaveCerbanimoQuestV144?.readState?.(),activeId=clean(engineState?.preferences?.activeQuestId),active=activeId?engineState?.quests?.find?.(row=>row?.id===activeId):engineState?.quests?.find?.(row=>!['completed','archived'].includes(row?.status))||engineState?.quests?.[0];
    let story=active?.id?arc.questState?.(active.id):null;
    if(!story){const rows=Object.values(arc.readState?.().quests||{}).sort((a,b)=>Date.parse(b?.updatedAt||0)-Date.parse(a?.updatedAt||0));story=rows[0]||null}
    return arc.beat?.(story?.currentBeatId||'spark')?.label||'The Spark';
  }catch{return'The Spark'}
}
function renderHud(){
  const passportId=passport(),guildState=guild(),beatLabel=questBeat();
  text('lud-hud-passport',passportId);
  text('lud-passport-id',passportId);
  text('lud-hud-guild',guildState.label);
  text('lud-hud-beat',beatLabel);
  const node=document.getElementById('lud-hud-guild');if(node)node.dataset.state=guildState.state;
  return{passportId,guild:guildState,questBeat:beatLabel};
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
addEventListener('civweave:quest-arc-ready',renderHud);
addEventListener('civweave:quest-arc-changed',renderHud);
addEventListener('cerbanimo:quest-engine-changed',renderHud);
addEventListener('pointerdown',event=>pressed(event,true),{passive:true});
addEventListener('pointerup',event=>pressed(event,false),{passive:true});
addEventListener('pointercancel',event=>pressed(event,false),{passive:true});
addEventListener('blur',()=>document.querySelectorAll('[data-pressed="true"]').forEach(node=>delete node.dataset.pressed));
if(document.readyState==='loading')addEventListener('DOMContentLoaded',boot,{once:true});else boot();

globalThis.CivweaveLudGameUiV1=Object.freeze({version:VERSION,renderHud,status:()=>({passportId:passport(),guild:guild(),questBeat:questBeat()})});
})();