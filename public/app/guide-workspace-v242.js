(()=>{
'use strict';

const VERSION='1.0.113-guide-workspace-v242-canonical-v250-css-r1';
const SYSTEMS=['civweave','living-school','cerbanimo','fellowfare','anarchadia'];
const ROOT_ID='cw-persistent-guide-chat-v215';
const LAUNCHER_ID='cwp215-launcher';
const STYLE_ID='cw-guide-workspace-v242-style';
const SWITCHER_CLASS='cw242-window-switcher';
const STATE_KEY='civweave.guide-workspace.v242';
const GUIDE={
  civweave:{name:'Weaveling',label:'Civweave',role:'Central mirror and orchestrator',avatar:'/app/assets/ai/weaveling.png',accent:'#d8dde7',panel:'#111827'},
  'living-school':{name:'Moss',label:'Living School',role:'Learning guide',avatar:'/app/assets/ai/moss.png',accent:'#59cf87',panel:'#17342c'},
  cerbanimo:{name:'Kamiya',label:'Cerbanimo',role:'Questwright and skilled-work guide',avatar:'/app/assets/ai/kamiya.png',accent:'#ff54d3',panel:'#170824'},
  fellowfare:{name:'Rook',label:'FellowFare',role:'Quartermaster and exchange guide',avatar:'/app/assets/ai/rook.png',accent:'#f2a93b',panel:'#2c1b17'},
  anarchadia:{name:'Merlin',label:'Anarchadia',role:'Civic, feature-request, and automation guide',avatar:'/app/assets/ai/merlin.png',accent:'#ff4f9a',panel:'#090909'}
};

if(globalThis.CivweaveGuideWorkspaceV242?.version===VERSION)return;

const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const now=()=>new Date().toISOString();
const uid=prefix=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const clone=value=>typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value));
let pageSystem='civweave';
let activeWindow='civweave';
let workspaceOpen=false;
let minimized=false;
let busy=false;
let root=null;
let launcher=null;
let priorApi=null;
let bodyObserver=null;
let resizeFrame=0;
let suppressClickUntil=0;
let suppressedControl=null;

function detectSystem(){
  const route=globalThis.CivweaveSystemRoutesV227?.identify?.(location.pathname);
  if(SYSTEMS.includes(route))return route;
  const declared=clean(document.documentElement?.dataset?.civweaveSystemRoute||document.documentElement?.dataset?.civweaveSystem||document.body?.dataset?.civweaveSystem||document.body?.dataset?.system,80).toLowerCase();
  if(SYSTEMS.includes(declared))return declared;
  const query=new URLSearchParams(location.search).get('system');
  if(SYSTEMS.includes(query))return query;
  const path=location.pathname.toLowerCase();
  if(path.includes('/cabinets/living-school/')||path.includes('living-school'))return'living-school';
  if(path.includes('realm-console-v140')||path.includes('cerbanimo'))return'cerbanimo';
  if(path.includes('fellowfare'))return'fellowfare';
  if(path.includes('anarchadia'))return'anarchadia';
  return'civweave';
}

function realmApi(){return globalThis.CivweaveRealmSessionIntegrityV237}
function emptyThread(system){return{schema:'civweave.realm-guide-thread.v237',system,messages:[],open:false,minimized:false,unread:0,updatedAt:null}}
function readThread(system){const api=realmApi();return api?.readThread?.(system)||emptyThread(system)}
function writeThread(system,value){const api=realmApi();if(api?.writeThread)return api.writeThread(system,value);return value}
function append(system,row){const thread=readThread(system);thread.messages=Array.isArray(thread.messages)?thread.messages:[];thread.messages.push({...row,id:row.id||uid('msg'),at:row.at||now()});return writeThread(system,thread)}
function readWorkspace(){const value=parse(localStorage.getItem(STATE_KEY),{});return{open:Boolean(value.open),minimized:Boolean(value.minimized),activeWindow:SYSTEMS.includes(value.activeWindow)?value.activeWindow:null,seen:value.seen&&typeof value.seen==='object'?value.seen:{}}}
function saveWorkspace(){const previous=readWorkspace();try{localStorage.setItem(STATE_KEY,JSON.stringify({open:workspaceOpen,minimized,activeWindow,seen:previous.seen,updatedAt:now()}))}catch{}}
function markSeen(system){const value=readWorkspace();value.seen={...value.seen,[system]:now()};value.open=workspaceOpen;value.minimized=minimized;value.activeWindow=activeWindow;try{localStorage.setItem(STATE_KEY,JSON.stringify(value))}catch{}}
function hasUnread(system){if(system===activeWindow&&workspaceOpen)return false;const thread=readThread(system),seen=readWorkspace().seen?.[system]||'';return Boolean(Number(thread.unread||0)>0||(thread.updatedAt&&(!seen||thread.updatedAt>seen)))}
function emitWorkspaceState(){try{dispatchEvent(new CustomEvent('civweave:guide-workspace-state',{detail:{version:VERSION,pageSystem,activeWindow,open:workspaceOpen,minimized,busy,canonicalOwner:true}}))}catch{}}

function retireViewportTrap(){try{globalThis.CivweavePersistentGuideViewportV216?.destroy?.()}catch{}document.documentElement.dataset.civweaveGuideViewport='css-v242'}
function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
#${ROOT_ID}{--guide-accent:#d8dde7;--guide-panel:#111827;--guide-panel-2:#202a3c;--guide-ink:#f8fbff;--guide-muted:#b8c6df;--guide-line:color-mix(in srgb,var(--guide-accent) 44%,transparent);--guide-button:#344056;position:fixed!important;z-index:2147483644!important;right:max(10px,env(safe-area-inset-right))!important;bottom:calc(var(--cw-themed-nav-height,64px) + env(safe-area-inset-bottom) + 10px)!important;width:min(460px,calc(100vw - 20px))!important;height:min(72dvh,680px)!important;max-height:calc(100dvh - var(--cw-themed-nav-height,64px) - env(safe-area-inset-bottom) - env(safe-area-inset-top) - 24px)!important;display:grid!important;grid-template-rows:auto auto minmax(96px,1fr) auto!important;overflow:hidden!important;overscroll-behavior:auto!important;touch-action:auto!important;isolation:isolate!important;contain:layout paint style!important;pointer-events:auto!important;box-sizing:border-box!important;border:1px solid var(--guide-line)!important;border-radius:22px!important;background:var(--guide-panel)!important;color:var(--guide-ink)!important;box-shadow:0 24px 80px #0009,0 0 34px color-mix(in srgb,var(--guide-accent) 22%,transparent)!important;font:15px/1.45 Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;color-scheme:dark}
#${ROOT_ID}:has(>.cw295-saved-chats){grid-template-rows:auto auto auto minmax(96px,1fr) auto!important}
#${ROOT_ID}[hidden]{display:none!important}
#${ROOT_ID}[data-guide="living-school"]{--guide-panel:#17342c;--guide-panel-2:#23483b;--guide-ink:#fff8df;--guide-muted:#d7d1ae;--guide-button:#356b56;border-radius:18px!important}
#${ROOT_ID}[data-guide="cerbanimo"]{--guide-panel:#170824;--guide-panel-2:#28103d;--guide-ink:#fff7ff;--guide-muted:#d6c4e6;--guide-button:#5b1768;border-radius:12px!important}
#${ROOT_ID}[data-guide="fellowfare"]{--guide-panel:#2c1b17;--guide-panel-2:#493128;--guide-ink:#fff8e7;--guide-muted:#dfcdb9;--guide-button:#72462d;border-radius:16px!important}
#${ROOT_ID}[data-guide="anarchadia"]{--guide-panel:#090909;--guide-panel-2:#191919;--guide-ink:#fff;--guide-muted:#d8d8d8;--guide-button:#391125;border-radius:4px!important}
#${ROOT_ID},#${ROOT_ID} *{box-sizing:border-box}
#${ROOT_ID} button,#${ROOT_ID} textarea{font:inherit}
#${ROOT_ID}>header{min-width:0;display:grid;grid-template-columns:auto minmax(0,1fr) 40px 40px;align-items:center;gap:9px;padding:11px 12px;border-bottom:1px solid var(--guide-line);background:linear-gradient(135deg,color-mix(in srgb,var(--guide-panel-2) 92%,#fff 2%),var(--guide-panel));box-shadow:inset 0 1px #ffffff0b}
#${ROOT_ID}>header [data-guide-avatar]{display:block;width:52px;height:52px;min-width:52px;object-fit:cover;border:2px solid var(--guide-accent);border-radius:14px;background:var(--guide-panel-2);box-shadow:0 0 18px color-mix(in srgb,var(--guide-accent) 36%,transparent)}
#${ROOT_ID}>header>div{min-width:0}
#${ROOT_ID}>header small,#${ROOT_ID}>header strong,#${ROOT_ID}>header span{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#${ROOT_ID}>header small{color:var(--guide-accent);font-size:.67rem;font-weight:900;letter-spacing:.1em;text-transform:uppercase}
#${ROOT_ID}>header strong{margin-top:2px;color:var(--guide-ink);font-size:1.06rem;line-height:1.15}
#${ROOT_ID}>header span{margin-top:3px;color:var(--guide-muted);font-size:.76rem}
#${ROOT_ID}>header button{width:40px;height:40px;margin:0;padding:0;display:grid;place-items:center;border:1px solid var(--guide-line);border-radius:11px;background:color-mix(in srgb,var(--guide-button) 86%,#000);color:var(--guide-ink);font-size:1.2rem;font-weight:800;line-height:1;cursor:pointer;appearance:none;-webkit-appearance:none}
#${ROOT_ID}>header button:hover,#${ROOT_ID}>header button:focus-visible{border-color:var(--guide-accent);background:color-mix(in srgb,var(--guide-button) 72%,var(--guide-accent) 28%);outline:none;box-shadow:0 0 0 3px color-mix(in srgb,var(--guide-accent) 18%,transparent)}
#${ROOT_ID}.is-minimized{height:auto!important;grid-template-rows:auto auto!important}
#${ROOT_ID}.is-minimized [data-log],#${ROOT_ID}.is-minimized [data-persistent-form],#${ROOT_ID}.is-minimized .cw295-saved-chats{display:none!important}
#${ROOT_ID} .${SWITCHER_CLASS}{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;padding:7px 8px;border-bottom:1px solid #ffffff20;background:#0003}
#${ROOT_ID} .cw242-window{position:relative;min-width:0;display:grid;justify-items:center;gap:2px;padding:4px 2px;border:1px solid transparent;border-radius:10px;background:transparent;color:#bfc9d6;cursor:pointer}
#${ROOT_ID} .cw242-window img{width:30px;height:30px;border-radius:50%;object-fit:cover;border:1px solid var(--window-accent);filter:saturate(.72) brightness(.82)}
#${ROOT_ID} .cw242-window span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px;font-weight:800}
#${ROOT_ID} .cw242-window[aria-pressed="true"]{border-color:var(--window-accent);background:color-mix(in srgb,var(--window-accent) 14%,transparent);color:#fff}
#${ROOT_ID} .cw242-window[aria-pressed="true"] img{filter:none;box-shadow:0 0 12px color-mix(in srgb,var(--window-accent) 52%,transparent)}
#${ROOT_ID} .cw242-window[data-here="true"]::before{content:"HERE";position:absolute;top:1px;right:2px;padding:1px 3px;border-radius:6px;background:var(--window-accent);color:#07111f;font:900 7px/1 system-ui}
#${ROOT_ID} .cw242-unread{position:absolute;top:1px;left:calc(50% + 8px);width:8px;height:8px;border-radius:50%;background:var(--window-accent);box-shadow:0 0 8px var(--window-accent)}
#${ROOT_ID} .cw242-unread[hidden]{display:none!important}
#${ROOT_ID} [data-log]{min-height:0;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:10px;overscroll-behavior:auto!important;touch-action:pan-y!important;-webkit-overflow-scrolling:touch;scrollbar-color:var(--guide-accent) transparent;background:radial-gradient(circle at 50% 0,color-mix(in srgb,var(--guide-accent) 8%,transparent),transparent 48%),var(--guide-panel)}
#${ROOT_ID} [data-log] article{display:grid;grid-template-columns:34px minmax(0,1fr);gap:8px;align-items:start}
#${ROOT_ID} [data-log] article.is-user{display:flex;justify-content:flex-end;padding-left:40px}
#${ROOT_ID} [data-log] article>img{width:34px;height:34px;border-radius:11px;object-fit:cover;border:1px solid var(--message-accent,var(--guide-accent))}
#${ROOT_ID} .cw237-bubble{max-width:88%;padding:9px 10px;border:1px solid color-mix(in srgb,var(--guide-line) 76%,transparent);border-radius:13px;background:color-mix(in srgb,var(--guide-panel-2) 88%,transparent);color:var(--guide-ink);white-space:pre-wrap;overflow-wrap:anywhere;box-shadow:0 5px 14px #0002}
#${ROOT_ID} [data-log]>.cw237-bubble{max-width:100%;margin:auto 0;color:var(--guide-muted);text-align:center}
#${ROOT_ID} .is-user .cw237-bubble{background:color-mix(in srgb,var(--guide-accent) 18%,var(--guide-panel-2));border-color:color-mix(in srgb,var(--guide-accent) 52%,transparent)}
#${ROOT_ID} .is-handover .cw237-bubble{border-color:var(--message-accent);box-shadow:inset 3px 0 0 var(--message-accent)}
#${ROOT_ID} .cw237-meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:5px;color:var(--guide-muted);font-size:.67rem}
#${ROOT_ID} .cw237-meta b{color:var(--message-accent,var(--guide-accent))}
#${ROOT_ID} .cw237-gate{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px}
#${ROOT_ID} .cw237-gate button{min-height:32px;border:1px solid var(--message-accent,var(--guide-accent));border-radius:999px;padding:0 9px;background:#ffffff0c;color:inherit;font-weight:800;cursor:pointer}
#${ROOT_ID} [data-persistent-form]{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:stretch;gap:8px;padding:10px;border-top:1px solid var(--guide-line);background:color-mix(in srgb,var(--guide-panel-2) 90%,transparent)}
#${ROOT_ID} [data-persistent-form] textarea{min-width:0;width:100%;min-height:54px;max-height:150px;resize:vertical;border:1px solid var(--guide-line);border-radius:12px;padding:10px 11px;background:color-mix(in srgb,var(--guide-panel) 92%,#000);color:var(--guide-ink);outline:none;touch-action:manipulation}
#${ROOT_ID} [data-persistent-form] textarea:focus{border-color:var(--guide-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--guide-accent) 17%,transparent)}
#${ROOT_ID} [data-send]{min-width:76px;border:1px solid var(--guide-accent);border-radius:12px;padding:0 13px;background:linear-gradient(145deg,var(--guide-button),color-mix(in srgb,var(--guide-accent) 24%,var(--guide-button)));color:var(--guide-ink);font-weight:900;cursor:pointer}
#${ROOT_ID} [data-send]:disabled{opacity:.55;cursor:wait}
#${ROOT_ID} [data-close],#${ROOT_ID} [data-minimize],#${ROOT_ID} [data-cw242-window]{touch-action:manipulation;user-select:none;-webkit-user-select:none}
#${LAUNCHER_ID}{z-index:2147483643!important;position:fixed;right:max(12px,env(safe-area-inset-right));bottom:calc(var(--cw-themed-nav-height,64px) + env(safe-area-inset-bottom) + 12px);width:52px;height:52px;padding:0;display:grid;place-items:center;border:2px solid var(--guide-accent,#d8dde7);border-radius:50%;background:var(--guide-panel,#111827);box-shadow:0 6px 18px #0009;overflow:hidden;cursor:pointer;pointer-events:auto!important;appearance:none;-webkit-appearance:none}
#${LAUNCHER_ID}[hidden]{display:none!important}#${LAUNCHER_ID}>img{display:block;width:100%;height:100%;border-radius:50%;object-fit:cover}
@media(max-width:620px){#${ROOT_ID}{left:max(7px,env(safe-area-inset-left))!important;right:max(7px,env(safe-area-inset-right))!important;width:auto!important;height:min(62dvh,560px)!important;max-height:calc(100dvh - var(--cw-themed-nav-height,58px) - env(safe-area-inset-bottom) - env(safe-area-inset-top) - 18px)!important;border-radius:16px!important}#${ROOT_ID}>header{grid-template-columns:auto minmax(0,1fr) 38px 38px;padding:8px;gap:6px}#${ROOT_ID}>header button{width:38px;height:38px}#${ROOT_ID} .cw242-window img{width:27px;height:27px}#${ROOT_ID} .cw242-window span{font-size:8px}#${ROOT_ID} [data-persistent-form]{padding:8px}#${ROOT_ID} [data-send]{min-width:72px}}
@media(prefers-reduced-motion:reduce){#${ROOT_ID} *,#${LAUNCHER_ID} *{transition:none!important;animation:none!important}}
`;
  document.head.append(style)
}

function gateMarkup(row){const gate=row?.approvalGate;if(gate?.kind==='realm-action-approval')return`<div class="cw237-gate"><button type="button" data-gate="open-action" data-id="${esc(gate.actionId)}">Review draft</button>${gate.required&&!gate.missingRequired?.length?`<button type="button" data-gate="approve-action" data-id="${esc(gate.actionId)}">${esc(gate.label||'Approve')}</button>`:''}</div>`;if(gate?.kind==='intention-activation')return`<div class="cw237-gate"><button type="button" data-gate="open-plan" data-id="${esc(gate.planId)}">Review weave</button><button type="button" data-gate="activate-plan" data-id="${esc(gate.planId)}">Activate weave</button></div>`;return''}
function rowSystem(row,fallback=activeWindow){if(row?.role==='handover'&&SYSTEMS.includes(row.sourceSystem))return row.sourceSystem;return SYSTEMS.includes(row?.guide)?row.guide:fallback}
function ensureRoot(){
  root=document.getElementById(ROOT_ID);launcher=document.getElementById(LAUNCHER_ID);
  if(!root){root=document.createElement('section');root.id=ROOT_ID;root.hidden=true;root.innerHTML='<header><img data-guide-avatar alt=""><div><small data-window-label></small><strong data-guide-name></strong><span data-guide-role></span></div><button type="button" data-minimize aria-label="Minimize chat">−</button><button type="button" data-close aria-label="Close chat">×</button></header><nav class="'+SWITCHER_CLASS+'" aria-label="Guide chat windows"></nav><div data-log role="log" aria-live="polite"></div><form data-persistent-form><textarea rows="2" maxlength="12000" required></textarea><button data-send type="submit">Send</button></form>';document.body.append(root)}
  if(!root.querySelector('.'+SWITCHER_CLASS)){const nav=document.createElement('nav');nav.className=SWITCHER_CLASS;nav.setAttribute('aria-label','Guide chat windows');root.querySelector('header')?.after(nav)}
  if(!launcher){launcher=document.createElement('button');launcher.id=LAUNCHER_ID;launcher.type='button';launcher.innerHTML='<img alt="">';document.body.append(launcher)}return root
}
function renderSwitcher(){ensureRoot();const nav=root.querySelector('.'+SWITCHER_CLASS);if(!nav)return;nav.innerHTML=SYSTEMS.map(system=>{const guide=GUIDE[system];return`<button type="button" class="cw242-window" data-cw242-window="${system}" data-here="${system===pageSystem}" aria-pressed="${system===activeWindow}" style="--window-accent:${guide.accent}" aria-label="Open ${esc(guide.name)} chat window"><img src="${guide.avatar}" alt=""><span>${esc(guide.name)}</span><i class="cw242-unread" ${hasUnread(system)?'':'hidden'}></i></button>`}).join('')}
function renderVisuals(){ensureRoot();const guide=GUIDE[activeWindow],pageGuide=GUIDE[pageSystem];if(!guide||!pageGuide)return;root.dataset.guide=activeWindow;root.dataset.pageSystem=pageSystem;root.style.setProperty('--guide-accent',guide.accent);root.style.setProperty('--guide-panel',guide.panel);const avatar=root.querySelector('[data-guide-avatar]'),label=root.querySelector('[data-window-label]'),name=root.querySelector('[data-guide-name]'),role=root.querySelector('[data-guide-role]'),input=root.querySelector('textarea');if(avatar){avatar.src=guide.avatar;avatar.alt=guide.name}if(label)label.textContent=`${guide.label} THREAD${activeWindow===pageSystem?' · HERE':' · WINDOW'}`;if(name)name.textContent=guide.name;if(role)role.textContent=`${guide.role} · ${guide.label}`;if(input)input.placeholder=`Message ${guide.name}`;launcher.style.setProperty('--guide-accent',pageGuide.accent);launcher.style.setProperty('--guide-panel',pageGuide.panel);const launchImage=launcher.querySelector('img');if(launchImage){launchImage.src=pageGuide.avatar;launchImage.alt=`Open ${pageGuide.name}`};launcher.setAttribute('aria-label',`Open ${pageGuide.name} chat`)}
function renderMessages(){ensureRoot();const log=root.querySelector('[data-log]'),thread=readThread(activeWindow),guide=GUIDE[activeWindow];if(!log)return;const rows=Array.isArray(thread.messages)?thread.messages:[];if(!rows.length){log.innerHTML=`<div class="cw237-bubble">${esc(guide.name)} keeps a private ${esc(guide.label)} thread. Switching windows never mixes histories. Cross-realm work appears only as an explicit handover card.</div>`;return}log.innerHTML=rows.map(row=>{if(row.role==='user')return`<article class="is-user"><div class="cw237-bubble">${esc(row.text)}</div></article>`;const system=rowSystem(row),meta=GUIDE[system]||guide,handover=row.role==='handover';return`<article class="${handover?'is-handover':''}" style="--message-accent:${meta.accent}"><img src="${meta.avatar}" alt="${esc(meta.name)}"><div class="cw237-bubble">${handover?`<strong>Handover from ${esc(meta.name)} · ${esc(meta.label)}</strong>\n`:''}${esc(row.text)}<div class="cw237-meta"><b>${esc(meta.name)}</b>${row.provider?`<span>${esc(row.provider)}${row.model?` · ${esc(row.model)}`:''}</span>`:''}${handover?'<span>handover</span>':''}</div>${gateMarkup(row)}</div></article>`}).join('')}
function render({keepScroll=false}={}){ensureRoot();const log=root.querySelector('[data-log]'),before=log?.scrollTop||0;root.hidden=!workspaceOpen;root.classList.toggle('is-minimized',minimized);renderVisuals();renderSwitcher();renderMessages();if(log){if(keepScroll)log.scrollTop=before;else log.scrollTop=log.scrollHeight}markSeen(activeWindow);emitWorkspaceState()}

function openWindow(system=pageSystem,options={}){if(!SYSTEMS.includes(system))system=pageSystem;activeWindow=system;workspaceOpen=true;minimized=false;saveWorkspace();render();const input=root.querySelector('textarea');if(options.prefill&&input)input.value=clean(options.prefill,12000);if(options.focus===true)queueMicrotask(()=>input?.focus({preventScroll:true}));return root}
function closeWorkspace(){workspaceOpen=false;minimized=false;saveWorkspace();render({keepScroll:true});return true}
function toggleMinimize(){workspaceOpen=true;minimized=!minimized;saveWorkspace();render({keepScroll:true});return true}
function switchWindow(system,{open=false}={}){if(!SYSTEMS.includes(system))return false;activeWindow=system;if(open)workspaceOpen=true;minimized=false;saveWorkspace();render();return true}
function historyFor(system){return(readThread(system).messages||[]).slice(-24).filter(row=>!row.pending).map(row=>row.role==='handover'?{role:'system',text:`Handover from ${GUIDE[row.sourceSystem]?.name||row.sourceSystem}: ${clean(row.text,5000)}`}:{role:row.role==='user'?'user':'assistant',text:clean(row.text,5000)}).filter(row=>row.text)}
function explicitHandoffTarget(result,source){const target=clean(result?.handoffSystem||result?.response?.handoffSystem||result?.response?.choice?.handoffSystem,80).toLowerCase();return SYSTEMS.includes(target)&&target!==source?target:''}
function deterministicReply(system,text){
  const guide=GUIDE[system]||GUIDE.civweave,value=clean(text,900);
  if(system==='living-school')return`Moss kept your message locally. For “${value}”, name the smallest thing you need to understand, practice, or demonstrate next.`;
  if(system==='cerbanimo')return`Kamiya kept your message locally. For “${value}”, define the concrete deliverable, what counts as done, and the first verifiable dependency.`;
  if(system==='fellowfare')return`Rook kept your message locally. For “${value}”, name the exact need or offer, timing, acceptable substitutes, and exchange boundary.`;
  if(system==='anarchadia')return`Merlin kept your message locally. For “${value}”, name the proposed change, who it affects, and the reversible test for success.`;
  return`${guide.name} kept your message locally. For “${value}”, start with the outcome you want, then separate what must be learned, built, acquired, or agreed.`
}
async function fallbackReply(system,text){
  try{await globalThis.CivweaveFamilyAILoaderV105?.ensure?.()}catch{}
  const runtime=globalThis.CivweaveModelRuntime;
  if(typeof runtime?.generate==='function'){
    try{
      const result=await runtime.generate({purpose:`${system}-guide-workspace-v250`,executionProfile:'interactive',messages:[{role:'system',content:`You are ${GUIDE[system].name}, ${GUIDE[system].role}. Give a useful, concise next response while preserving user control.`},...historyFor(system).slice(-10).map(row=>({role:row.role,content:row.text})),{role:'user',content:text}],deterministic:()=>deterministicReply(system,text),fallback:()=>deterministicReply(system,text)});
      const answer=clean(result?.outputText,10000);if(answer)return{text:answer,provider:result?.actual?.provider||result?.fallback?.provider||result?.provider||'shared-model',model:result?.actual?.model||result?.model||''}
    }catch{}
  }
  return{text:deterministicReply(system,text),provider:'deterministic-local',model:''}
}

async function submitActive(text){
  const value=clean(text,12000),system=activeWindow;if(!value||busy||!SYSTEMS.includes(system))return false;busy=true;ensureRoot();const button=root.querySelector('[data-send]');if(button)button.disabled=true;append(system,{role:'user',text:value});const pendingId=uid('pending');append(system,{id:pendingId,role:'assistant',guide:system,text:`${GUIDE[system].name} is thinking…`,pending:true});const input=root.querySelector('textarea');if(input)input.value='';render();
  try{
    await globalThis.CivweaveFamilyAILoaderV105?.ensure?.();
    const assistant=globalThis.CivweaveAssistantV141;
    if(!assistant?.respond)throw new Error('The shared assistant runtime is not ready.');
    const result=await assistant.respond({text:value,systemId:system,handoffSystem:system!==pageSystem?system:undefined,history:historyFor(system)});
    const thread=readThread(system),index=(thread.messages||[]).findIndex(row=>row.id===pendingId),next=clean(result?.response?.choice?.nextAction,1200),replacement={role:'assistant',guide:system,responderSystem:system,text:[clean(result?.response?.answer,10000),next?`Next: ${next}`:''].filter(Boolean).join('\n\n'),provider:result?.provider,model:result?.model,approvalGate:result?.response?.approvalGate||null,planSnapshot:result?.plan?clone(result.plan):null,actionSnapshot:result?.action?clone(result.action):null};if(index>=0)thread.messages[index]=replacement;else thread.messages.push(replacement);writeThread(system,thread);const target=explicitHandoffTarget(result,system);if(target)await realmApi()?.createHandover?.(system,target,result)
  }catch{
    const fallback=await fallbackReply(system,value),thread=readThread(system),index=(thread.messages||[]).findIndex(row=>row.id===pendingId),replacement={role:'assistant',guide:system,responderSystem:system,text:fallback.text,provider:fallback.provider,model:fallback.model||'',recoveredBy:'guide-workspace-v250'};if(index>=0)thread.messages[index]=replacement;else thread.messages.push(replacement);writeThread(system,thread)
  }finally{busy=false;if(button)button.disabled=false;render()}return true
}

function onPointerDownCapture(event){
  const switchControl=event.target.closest?.(`#${ROOT_ID} [data-cw242-window]`),closeControl=event.target.closest?.(`#${ROOT_ID} [data-close]`),minimizeControl=event.target.closest?.(`#${ROOT_ID} [data-minimize]`);
  if(!switchControl&&!closeControl&&!minimizeControl)return;
  if(event.pointerType==='mouse'&&event.button!==0)return;
  event.preventDefault();event.stopImmediatePropagation();suppressClickUntil=performance.now()+500;suppressedControl=switchControl||closeControl||minimizeControl;
  if(switchControl){switchWindow(switchControl.dataset.cw242Window,{open:true});return}
  const active=document.activeElement;if(active?.closest?.(`#${ROOT_ID},#cw-shared-guide-surface-v236`))active.blur?.();
  if(closeControl)closeWorkspace();else toggleMinimize()
}
function onClickCapture(event){
  if(performance.now()<suppressClickUntil&&suppressedControl?.contains?.(event.target)){event.preventDefault();event.stopImmediatePropagation();return}
  const windowButton=event.target.closest?.('[data-cw242-window]');if(windowButton){event.preventDefault();event.stopImmediatePropagation();switchWindow(windowButton.dataset.cw242Window,{open:true});return}
  if(event.target.closest?.(`#${ROOT_ID} [data-close]`)){event.preventDefault();event.stopImmediatePropagation();closeWorkspace();return}
  if(event.target.closest?.(`#${ROOT_ID} [data-minimize]`)){event.preventDefault();event.stopImmediatePropagation();toggleMinimize();return}
  const launch=event.target.closest?.(`#${LAUNCHER_ID}`);if(launch){event.preventDefault();event.stopImmediatePropagation();openWindow(pageSystem);return}
  if(root?.contains(event.target)||launcher?.contains(event.target))return;
  const trigger=event.target.closest?.('[data-cwf-chat],[data-open-guide-chat],[data-open-persistent-chat],#moss,#compass,.ls-moss,.ls-compass,[data-guide]');if(!trigger)return;
  const requested=clean(trigger.getAttribute?.('data-guide'),80).toLowerCase();const system=SYSTEMS.includes(requested)?requested:pageSystem;event.preventDefault();event.stopImmediatePropagation();openWindow(system)
}
function onSubmitCapture(event){
  const target=event.target;
  if(!(target instanceof HTMLFormElement))return;
  const canonical=target.matches(`#${ROOT_ID} [data-persistent-form]`),workingCampus=pageSystem==='civweave'&&target.id==='weaveling-chat-form'&&Boolean(target.closest('.app'));
  if(!canonical&&!workingCampus)return;
  const input=target.querySelector('textarea,input[type="text"]'),text=clean(input?.value,12000);event.preventDefault();event.stopImmediatePropagation();if(!text)return;
  if(workingCampus){if(input)input.value='';openWindow('civweave');void submitActive(text);return}
  void submitActive(text)
}
function onThreadChanged(event){const system=event.detail?.system;if(!SYSTEMS.includes(system))return;queueMicrotask(()=>render({keepScroll:system!==activeWindow}))}
function onBodyChange(records){if(records.some(record=>[...record.removedNodes].some(node=>node?.id===ROOT_ID||node?.id===LAUNCHER_ID))){queueMicrotask(()=>{ensureRoot();render({keepScroll:true})})}}
function onResize(){if(resizeFrame)return;resizeFrame=requestAnimationFrame(()=>{resizeFrame=0;document.documentElement.style.setProperty('--cw242-visual-height',`${Math.round(globalThis.visualViewport?.height||innerHeight)}px`)})}

function installApi(){
  priorApi=globalThis.CivweavePersistentGuideChatV215;
  const api=Object.freeze({version:VERSION,realmIsolated:true,workspace:true,canonicalOwner:true,systems:[...SYSTEMS],readState:()=>({...readThread(activeWindow),open:workspaceOpen,minimized}),readThread,open:options=>openWindow(SYSTEMS.includes(options?.guide)?options.guide:pageSystem,options||{}),close:closeWorkspace,minimize:()=>{if(!minimized)toggleMinimize();return true},restore:()=>{if(minimized)toggleMinimize();return true},switchGuide:(system,options={})=>switchWindow(system,{open:options.open===true}),notify:(system,text,options={})=>{if(!SYSTEMS.includes(system)||!clean(text))return false;const thread=readThread(system);thread.messages.push({id:uid('msg'),at:now(),role:'assistant',guide:system,responderSystem:system,text:clean(text,6000),notification:true});if(system!==activeWindow||!workspaceOpen)thread.unread=Math.min(99,Number(thread.unread||0)+1);writeThread(system,thread);if(options.open)openWindow(system);return true},handover:(source,target,summary,need='')=>priorApi?.handover?.(source,target,summary,need)??false,submitText:async(text,system=activeWindow)=>{switchWindow(SYSTEMS.includes(system)?system:activeWindow,{open:workspaceOpen});return submitActive(text)},activeWindow:()=>activeWindow,pageSystem:()=>pageSystem,destroy(){document.removeEventListener('pointerdown',onPointerDownCapture,true);document.removeEventListener('click',onClickCapture,true);document.removeEventListener('submit',onSubmitCapture,true);removeEventListener('civweave:realm-guide-thread-changed',onThreadChanged);bodyObserver?.disconnect();globalThis.visualViewport?.removeEventListener('resize',onResize);removeEventListener('resize',onResize);document.getElementById(STYLE_ID)?.remove()}});
  globalThis.CivweavePersistentGuideChatV215=api;return api
}

function start(){pageSystem=detectSystem();const saved=readWorkspace();activeWindow=pageSystem;workspaceOpen=saved.open;minimized=saved.minimized;installStyle();retireViewportTrap();ensureRoot();installApi();document.addEventListener('pointerdown',onPointerDownCapture,true);document.addEventListener('click',onClickCapture,true);document.addEventListener('submit',onSubmitCapture,true);addEventListener('civweave:realm-guide-thread-changed',onThreadChanged);bodyObserver=new MutationObserver(onBodyChange);bodyObserver.observe(document.body,{childList:true});globalThis.visualViewport?.addEventListener('resize',onResize,{passive:true});addEventListener('resize',onResize,{passive:true});onResize();render();document.documentElement.dataset.civweaveGuideWorkspace='v250-canonical-owner';dispatchEvent(new CustomEvent('civweave:guide-workspace-ready',{detail:{version:VERSION,pageSystem,activeWindow,realmIsolated:true,windowCount:5,gestureSafe:true,sendSafe:true,canonicalOwner:true,transportFallback:true}}))}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();

globalThis.CivweaveGuideWorkspaceV242=Object.freeze({version:VERSION,systems:[...SYSTEMS],detectSystem,readThread,openWindow,switchWindow,closeWorkspace,toggleMinimize,submitActive,state:()=>({pageSystem,activeWindow,open:workspaceOpen,minimized,busy,canonicalOwner:true})});
})();
