(()=>{
'use strict';
const VERSION='1.3.0-symbolic-hud-nav';
const HUD_ID='cw-lud-hud-nav';
const HUD_STYLE_ID='cw-lud-hud-nav-style';
if(globalThis.CivweaveLudGameUiV1?.version===VERSION)return;

const text=(id,value)=>{const node=document.getElementById(id);if(node&&value!=null)node.textContent=String(value)};
const clean=value=>String(value??'').trim();
const HUD_SYSTEMS=Object.freeze([
  Object.freeze({id:'civweave',label:'Civweave'}),
  Object.freeze({id:'living-school',label:'Living School',kind:'learning-module'}),
  Object.freeze({id:'cerbanimo',label:'Cerbanimo',kind:'quest'}),
  Object.freeze({id:'fellowfare',label:'FellowFare'}),
  Object.freeze({id:'anarchadia',label:'Anarchadia'})
]);

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
  document.documentElement.dataset.ludHudNav='symbolic-v1';
  if(document.body)document.body.dataset.ludReady='true';
}
function pressed(event,value){
  const target=event.target?.closest?.('button,a.button,#cw-lud-hud-nav a');
  if(!target)return;
  if(value)target.dataset.pressed='true';else delete target.dataset.pressed;
}
function ensureHudStyle(){
  if(document.getElementById(HUD_STYLE_ID))return true;
  const style=document.createElement('style');style.id=HUD_STYLE_ID;style.textContent=`
#${HUD_ID}{position:fixed;z-index:2147483600;left:50%;bottom:max(6px,env(safe-area-inset-bottom));transform:translateX(-50%);width:min(720px,calc(100vw - 12px));min-height:76px;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));overflow:hidden;border:1px solid #d7b86277;border-radius:16px;background:linear-gradient(180deg,#181b22f5,#0a0d12f5);box-shadow:0 10px 34px #000b,0 0 20px #f5d66d12}
#${HUD_ID} a{all:unset;box-sizing:border-box;min-width:0;display:grid;grid-template-rows:44px auto;place-items:center;gap:2px;padding:7px 3px 6px;border-right:1px solid #ffffff12;color:#ece8d5;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
#${HUD_ID} a:last-child{border-right:0}#${HUD_ID} a:focus-visible{outline:2px solid #fff4b8;outline-offset:-3px}#${HUD_ID} a[data-active="true"]{background:#ffffff0d;box-shadow:inset 0 2px 0 var(--cw-lud-symbol-color,#fff),inset 0 0 24px color-mix(in srgb,var(--cw-lud-symbol-color,#fff) 11%,transparent)}
#${HUD_ID} a[data-pressed="true"]{transform:translateY(1px);filter:brightness(.9)}
#${HUD_ID} .cw-lud-hud-symbol{display:block;width:38px;height:38px;background:var(--cw-lud-symbol-color,#fff);-webkit-mask:var(--cw-lud-symbol) center/contain no-repeat;mask:var(--cw-lud-symbol) center/contain no-repeat;filter:drop-shadow(0 1px 3px #000b)}
#${HUD_ID} .cw-lud-hud-label{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:800 9px/1.1 system-ui,sans-serif;letter-spacing:.015em}
#${HUD_ID} [data-lud-hud-system="civweave"]{--cw-lud-symbol:url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iOSIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJibGFjayIgc3Ryb2tlLXdpZHRoPSIyIi8+PHBhdGggZD0iTTE1LjcgOC4zIDEzLjQgMTMuNCA4LjMgMTUuN2wyLjMtNS4xeiIgZmlsbD0iYmxhY2siLz48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxLjMiIGZpbGw9ImJsYWNrIi8+PC9zdmc+");--cw-lud-symbol-color:#f4e6a1}
#${HUD_ID} [data-lud-hud-system="living-school"]{--cw-lud-symbol:url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTcgOWMwLTMgMi4yLTUgNS01czUgMiA1IDVIN1ptMS4xIDJoNy44Yy45IDAgMS40LjggMS4yIDEuNkMxNi4xIDE3LjMgMTQuNCAyMCAxMiAyMHMtNC4xLTIuNy01LjEtNy40Yy0uMi0uOC40LTEuNiAxLjItMS42WiIgZmlsbD0iYmxhY2siLz48cGF0aCBkPSJNMTIgNGMwLTIgMS4xLTMgMy4yLTN2MmMtMSAwLTEuMi40LTEuMiAxWiIgZmlsbD0iYmxhY2siLz48L3N2Zz4=");--cw-lud-symbol-color:#d9f09a}
#${HUD_ID} [data-lud-hud-system="cerbanimo"]{--cw-lud-symbol:url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTQgOWgxNnYxMUg0ek0zIDZoMTh2NEgzek0xMSA2aDJ2MTRoLTJ6IiBmaWxsPSJibGFjayIvPjxwYXRoIGQ9Ik0xMiA2QzguNCA2IDYgNS4xIDYgMy41IDYgMiA3LjIgMSA4LjcgMSAxMC41IDEgMTIgMy4yIDEyIDZabTAgMGMzLjYgMCA2LS45IDYtMi41QzE4IDIgMTYuOCAxIDE1LjMgMSAxMy41IDEgMTIgMy4yIDEyIDZaIiBmaWxsPSJibGFjayIvPjwvc3ZnPg==");--cw-lud-symbol-color:#ffd676}
#${HUD_ID} [data-lud-hud-system="fellowfare"]{--cw-lud-symbol:url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iOSIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJibGFjayIgc3Ryb2tlLXdpZHRoPSIyLjQiLz48Y2lyY2xlIGN4PSI5IiBjeT0iOSIgcj0iMS41IiBmaWxsPSJibGFjayIvPjxjaXJjbGUgY3g9IjE1IiBjeT0iOSIgcj0iMS41IiBmaWxsPSJibGFjayIvPjxjaXJjbGUgY3g9IjkiIGN5PSIxNSIgcj0iMS41IiBmaWxsPSJibGFjayIvPjxjaXJjbGUgY3g9IjE1IiBjeT0iMTUiIHI9IjEuNSIgZmlsbD0iYmxhY2siLz48L3N2Zz4=");--cw-lud-symbol-color:#fff0bd}
#${HUD_ID} [data-lud-hud-system="anarchadia"]{--cw-lud-symbol:url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iOSIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJibGFjayIgc3Ryb2tlLXdpZHRoPSIyIi8+PHBhdGggZD0iTTcuNSAxOCAxMiA2bDQuNSAxMk05LjQgMTNoNS4yIiBmaWxsPSJub25lIiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjwvc3ZnPg==");--cw-lud-symbol-color:#ff3d96}
body.lud-game-shell .lud-stage{padding-bottom:116px!important}
@media(max-width:560px){#${HUD_ID}{min-height:68px}#${HUD_ID} a{grid-template-rows:38px auto;padding:5px 2px}#${HUD_ID} .cw-lud-hud-symbol{width:33px;height:33px}#${HUD_ID} .cw-lud-hud-label{font-size:7.5px}body.lud-game-shell .lud-stage{padding-bottom:106px!important}}
`;
  document.head?.append(style);return true;
}
function selectHumanKind(kind){
  if(!kind)return false;
  const select=document.querySelector('#author-form select[name="kind"]');if(!select)return false;
  select.value=kind;select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));return true;
}
function hudTarget(system){
  if(system==='civweave')return document.querySelector('.lud-hero');
  if(system==='living-school'||system==='cerbanimo')return document.getElementById('author-form');
  if(system==='fellowfare')return document.getElementById('market');
  if(system==='anarchadia')return document.getElementById('lud-passport-id')?.closest?.('.install-card')||document.getElementById('lud-passport-id');
  return null;
}
function activateHudSystem(system,{scroll=true}={}){
  const row=HUD_SYSTEMS.find(item=>item.id===system);if(!row)return false;
  if(row.kind)selectHumanKind(row.kind);
  document.querySelectorAll(`#${HUD_ID} [data-lud-hud-system]`).forEach(link=>{const active=link.dataset.ludHudSystem===system;link.dataset.active=active?'true':'false';if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current')});
  const target=hudTarget(system);if(scroll&&target?.scrollIntoView)target.scrollIntoView({behavior:'smooth',block:'start'});
  return Boolean(target);
}
function installHudNav(){
  ensureHudStyle();
  let nav=document.getElementById(HUD_ID);if(nav)return nav;
  nav=document.createElement('nav');nav.id=HUD_ID;nav.setAttribute('aria-label','Lud HUD systems');nav.dataset.ludHud='symbolic-v1';
  for(const row of HUD_SYSTEMS){
    const link=document.createElement('a');link.href='#';link.dataset.ludHudSystem=row.id;link.setAttribute('aria-label',`${row.label} · Lud HUD`);
    const symbol=document.createElement('span');symbol.className='cw-lud-hud-symbol';symbol.setAttribute('aria-hidden','true');
    const label=document.createElement('span');label.className='cw-lud-hud-label';label.textContent=row.label;
    link.append(symbol,label);link.addEventListener('click',event=>{event.preventDefault();activateHudSystem(row.id)});nav.append(link);
  }
  document.body?.append(nav);activateHudSystem('civweave',{scroll:false});return nav;
}
function boot(){markReady();installHudNav();renderHud()}

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

globalThis.CivweaveLudGameUiV1=Object.freeze({version:VERSION,installHudNav,activateHudSystem,renderHud,renderChronicle,status:()=>({passportId:passport(),guild:guild(),questBeat:questBeat(),hud:'symbolic-v1'})});
})();