(()=>{
'use strict';
const VERSION='1.2.0-quest-chronicle';
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
function activeQuestStory(){
  try{
    const arc=globalThis.CivweaveQuestArcChronicleV1;
    if(!arc)return{arc:null,quest:null,story:null};
    const engineState=globalThis.CivweaveCerbanimoQuestV144?.readState?.(),activeId=clean(engineState?.preferences?.activeQuestId),quest=activeId?engineState?.quests?.find?.(row=>row?.id===activeId):engineState?.quests?.find?.(row=>!['completed','archived'].includes(row?.status))||engineState?.quests?.[0]||null;
    let story=quest?.id?arc.questState?.(quest.id):null;
    if(!story){const rows=Object.values(arc.readState?.().quests||{}).sort((a,b)=>Date.parse(b?.updatedAt||0)-Date.parse(a?.updatedAt||0));story=rows[0]||null}
    return{arc,quest,story};
  }catch{return{arc:null,quest:null,story:null}}
}
function questBeat(){const {arc,story}=activeQuestStory();return arc?.beat?.(story?.currentBeatId||'spark')?.label||'The Spark'}
function renderChronicle(){
  const host=document.getElementById('lud-beat-history');if(!host)return[];
  host.replaceChildren();
  const {arc,story}=activeQuestStory(),rows=story?.questId?arc?.historyProjections?.(story.questId,{limit:8})||[]:[];
  if(!rows.length){const empty=document.createElement('p');empty.className='status';empty.textContent='Cleared and setback Quest Beats will appear here as the Chronicle grows.';host.append(empty);return[]}
  for(const row of rows.slice().reverse()){
    const card=document.createElement('article');card.className='card lud-chronicle-receipt';
    const title=document.createElement('h3');title.textContent=row.displayText;
    const meta=document.createElement('p');meta.textContent=`Quest Chronicle · ${row.outcome==='SETBACK'?'route changed':'beat cleared'}`;
    card.append(title,meta);host.append(card);
  }
  return rows;
}
function renderHud(){
  const passportId=passport(),guildState=guild(),beatLabel=questBeat();
  text('lud-hud-passport',passportId);
  text('lud-passport-id',passportId);
  text('lud-hud-guild',guildState.label);
  text('lud-hud-beat',beatLabel);
  const node=document.getElementById('lud-hud-guild');if(node)node.dataset.state=guildState.state;
  const chronicle=renderChronicle();
  return{passportId,guild:guildState,questBeat:beatLabel,chronicleCount:chronicle.length};
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

globalThis.CivweaveLudGameUiV1=Object.freeze({version:VERSION,renderHud,renderChronicle,status:()=>({passportId:passport(),guild:guild(),questBeat:questBeat()})});
})();