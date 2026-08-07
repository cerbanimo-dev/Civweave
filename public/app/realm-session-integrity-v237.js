(()=>{
'use strict';

const VERSION='1.0.31-realm-session-integrity-v237';
const SYSTEMS=['civweave','living-school','cerbanimo','fellowfare','anarchadia'];
const ROOT_ID='cw-persistent-guide-chat-v215';
const LAUNCHER_ID='cwp215-launcher';
const STYLE_ID='cw-realm-session-integrity-v237-style';
const MIGRATION_KEY='civweave.realm-chat-migration.v237';
const OLD_SHARED_KEY='civweave.persistent-guide-chat.v214';
const ACTION_KEY='civweave.realm-actions.v141';
const GUIDE={
  civweave:{name:'Weaveling',label:'Civweave',role:'Central mirror and orchestrator',avatar:'/app/assets/ai/weaveling.png',accent:'#d8dde7',panel:'#111827'},
  'living-school':{name:'Moss',label:'Living School',role:'Learning guide',avatar:'/app/assets/ai/moss.png',accent:'#59cf87',panel:'#17342c'},
  cerbanimo:{name:'Kamiya',label:'Cerbanimo',role:'Questwright and skilled-work guide',avatar:'/app/assets/ai/kamiya.png',accent:'#ff54d3',panel:'#170824'},
  fellowfare:{name:'Rook',label:'FellowFare',role:'Quartermaster and exchange guide',avatar:'/app/assets/ai/rook.png',accent:'#f2a93b',panel:'#2c1b17'},
  anarchadia:{name:'Merlin',label:'Anarchadia',role:'Civic, feature-request, and automation guide',avatar:'/app/assets/ai/merlin.png',accent:'#ff4f9a',panel:'#090909'}
};
const FOUNDATION_SCHOOLS=[
  ['people','School of People and Lives',110],['history','School of History',86],['geography','School of Geography',106],['arts','School of Arts',43],['everyday-life','School of Everyday Life',56],['philosophy-and-religion','School of Philosophy and Religion',57],['society-and-social-sciences','School of Society and Social Sciences',145],['health-medicine-and-disease','School of Health, Medicine and Disease',42],['science','School of Science',213],['technology','School of Technology',98],['mathematics','School of Mathematics',45]
];
const TUTORIALS={
  'GitHub repository':{title:'Choose the GitHub repository',body:'Enter the repository automation is allowed to work in using owner/repository format. Example: cerbanimo-dev/Civweave. Civweave stores this as the automation repository and uses the configured base branch, usually main.'},
  'GitHub automation dispatch':{title:'Connect GitHub automation dispatch',body:'Civweave needs one dispatch route before delegated implementation can start. Configure either the built-in CivweaveGithubAutomationFlow bridge, a repository-dispatch endpoint, or a GitHub token that can dispatch the configured repository workflow. Creator-led planning does not require this.'},
  'AI task validator automation endpoint':{title:'Connect the AI task validator',body:'Every automated implementation step must receive a passing AI validation receipt before merge. Configure either CivweaveAITaskValidator.validateAutomationStep or an HTTPS validator endpoint in automation settings. The validator should return a signed or otherwise trustworthy pass/fail receipt tied to the exact step and commit.'}
};

if(globalThis.CivweaveRealmSessionIntegrityV237?.version===VERSION)return;

const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const now=()=>new Date().toISOString();
const uid=prefix=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const clone=value=>typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value));
const threadKey=system=>`civweave.guide-thread.${system}.v237`;
const legacyThreadKey=system=>system==='civweave'?'civweave.weaveling-chat.v127':`civweave.guide-chat.${system}.v128`;
let pageSystem='';
let root=null;
let launcher=null;
let uiObserver=null;
let repairQueued=false;
let busy=false;
let contractsValue=null;
let assistantPatched=null;

function detectSystem(){
  const route=globalThis.CivweaveSystemRoutesV227?.identify?.(location.pathname);
  if(SYSTEMS.includes(route))return route;
  const query=new URLSearchParams(location.search).get('system');
  if(SYSTEMS.includes(query))return query;
  const declared=clean(document.documentElement?.dataset?.civweaveSystemRoute||document.documentElement?.dataset?.civweaveSystem||document.body?.dataset?.civweaveSystem||document.body?.dataset?.system,80).toLowerCase();
  if(SYSTEMS.includes(declared))return declared;
  const path=location.pathname.toLowerCase();
  if(path.includes('/cabinets/living-school/')||path.includes('living-school'))return'living-school';
  if(path.includes('realm-console-v140')||path.includes('cerbanimo'))return'cerbanimo';
  if(path.includes('fellowfare'))return'fellowfare';
  if(path.includes('anarchadia'))return'anarchadia';
  return'civweave';
}
function emptyThread(system){return{schema:'civweave.realm-guide-thread.v237',system,messages:[],open:false,minimized:false,unread:0,updatedAt:null}}
function readThread(system=pageSystem){
  const value=parse(localStorage.getItem(threadKey(system)),null);
  if(value&&Array.isArray(value.messages))return{...emptyThread(system),...value,system,messages:value.messages.slice(-120)};
  return emptyThread(system);
}
function writeThread(system,value){
  const next={...emptyThread(system),...value,system,messages:Array.isArray(value?.messages)?value.messages.slice(-120):[],updatedAt:now()};
  try{localStorage.setItem(threadKey(system),JSON.stringify(next))}catch{}
  try{dispatchEvent(new CustomEvent('civweave:realm-guide-thread-changed',{detail:{system,updatedAt:next.updatedAt}}))}catch{}
  return next;
}
function append(system,row){const state=readThread(system);state.messages.push({...row,id:row.id||uid('msg'),at:row.at||now()});writeThread(system,state);return state}
function inferRowSystem(row,fallback=pageSystem){const value=clean(row?.responderSystem||row?.guide||row?.actionSnapshot?.system||row?.handoff?.toSystem,80).toLowerCase();return SYSTEMS.includes(value)?value:fallback}
function migrateThreads(){
  if(localStorage.getItem(MIGRATION_KEY)==='done')return{migrated:false};
  const buckets=Object.fromEntries(SYSTEMS.map(system=>[system,[]]));
  for(const system of SYSTEMS){
    const legacy=parse(localStorage.getItem(legacyThreadKey(system)),[]);
    if(Array.isArray(legacy))for(const row of legacy)if(row?.text)buckets[system].push({...row,guide:row.role==='assistant'?system:row.guide,migratedFrom:'realm-v128'});
  }
  const shared=parse(localStorage.getItem(OLD_SHARED_KEY),{}),rows=Array.isArray(shared?.messages)?shared.messages:[];
  let pendingUsers=[];
  for(const row of rows){
    if(!row?.text)continue;
    if(row.role==='user'){pendingUsers.push(row);continue}
    const system=inferRowSystem(row,pageSystem||'civweave');
    for(const user of pendingUsers)buckets[system].push({...user,migratedFrom:'shared-v214'});
    pendingUsers=[];
    buckets[system].push({...row,guide:system,responderSystem:system,migratedFrom:'shared-v214'});
  }
  for(const user of pendingUsers)buckets[pageSystem||'civweave'].push({...user,migratedFrom:'shared-v214'});
  for(const system of SYSTEMS){
    if(localStorage.getItem(threadKey(system)))continue;
    const dedup=[],seen=new Set();
    for(const row of buckets[system]){const key=`${row.role}|${clean(row.text,5000)}|${row.at||''}`;if(seen.has(key))continue;seen.add(key);dedup.push(row)}
    writeThread(system,{...emptyThread(system),messages:dedup.slice(-120)});
  }
  localStorage.setItem(MIGRATION_KEY,'done');
  return{migrated:true,counts:Object.fromEntries(SYSTEMS.map(system=>[system,buckets[system].length]))};
}

function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
:root{--cw-top-safe-height:0px}
#${ROOT_ID}{--guide-accent:#d8dde7;--guide-panel:#111827;position:fixed;right:max(12px,env(safe-area-inset-right));bottom:calc(var(--cw-themed-nav-height,64px) + env(safe-area-inset-bottom) + 12px);z-index:2147483612;width:min(430px,calc(100vw - 24px));max-height:calc(100dvh - var(--cw-themed-nav-height,64px) - env(safe-area-inset-bottom) - 28px);display:grid;grid-template-rows:auto minmax(130px,1fr) auto;overflow:hidden;border:1px solid color-mix(in srgb,var(--guide-accent) 55%,transparent);border-radius:20px;background:var(--guide-panel);color:#fff;box-shadow:0 24px 70px #0009;font:14px/1.45 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
#${ROOT_ID}[hidden]{display:none!important}#${ROOT_ID}.is-minimized{grid-template-rows:auto}#${ROOT_ID}.is-minimized [data-log],#${ROOT_ID}.is-minimized [data-persistent-form]{display:none!important}
#${ROOT_ID} *{box-sizing:border-box}#${ROOT_ID} header{display:flex;align-items:center;gap:10px;padding:11px 12px;border-bottom:1px solid #ffffff1f;background:#ffffff08}#${ROOT_ID} header img{width:44px;height:44px;border-radius:50%;object-fit:cover;border:2px solid var(--guide-accent)}#${ROOT_ID} header div{min-width:0;flex:1}#${ROOT_ID} header small{display:block;color:var(--guide-accent);font-weight:900;letter-spacing:.08em}#${ROOT_ID} header strong{display:block;font-size:1.05rem}#${ROOT_ID} header span{display:block;color:#c8d1dc;font-size:.76rem}#${ROOT_ID} header button{width:36px;height:36px;border:1px solid #ffffff24;border-radius:10px;background:#ffffff0b;color:#fff;cursor:pointer}
#${ROOT_ID} [data-log]{overflow:auto;padding:12px;display:flex;flex-direction:column;gap:10px;overscroll-behavior:contain}#${ROOT_ID} article{display:grid;grid-template-columns:34px minmax(0,1fr);gap:8px;align-items:start}#${ROOT_ID} article.is-user{display:flex;justify-content:flex-end}#${ROOT_ID} article>img{width:34px;height:34px;border-radius:50%;object-fit:cover;border:1px solid var(--message-accent,var(--guide-accent))}#${ROOT_ID} .cw237-bubble{max-width:88%;padding:9px 10px;border:1px solid #ffffff20;border-radius:13px;background:#ffffff0c;white-space:pre-wrap;overflow-wrap:anywhere}#${ROOT_ID} .is-user .cw237-bubble{background:color-mix(in srgb,var(--guide-accent) 18%,#0b1320)}#${ROOT_ID} .is-handover .cw237-bubble{border-color:var(--message-accent);box-shadow:inset 3px 0 0 var(--message-accent)}#${ROOT_ID} .cw237-meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:5px;color:#aeb9c7;font-size:.67rem}#${ROOT_ID} .cw237-meta b{color:var(--message-accent,var(--guide-accent))}#${ROOT_ID} .cw237-gate{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px}#${ROOT_ID} .cw237-gate button{min-height:32px;border:1px solid var(--message-accent,var(--guide-accent));border-radius:999px;padding:0 9px;background:#ffffff0c;color:inherit;font-weight:800;cursor:pointer}
#${ROOT_ID} [data-persistent-form]{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:10px;border-top:1px solid #ffffff1f;background:#0002}#${ROOT_ID} textarea{min-height:48px;max-height:140px;resize:vertical;border:1px solid #ffffff2e;border-radius:11px;padding:9px 10px;background:#02060daa;color:#fff;font:inherit}#${ROOT_ID} [data-send]{min-width:74px;border:1px solid var(--guide-accent);border-radius:11px;background:color-mix(in srgb,var(--guide-accent) 20%,#0a1420);color:#fff;font-weight:900;cursor:pointer}
#${LAUNCHER_ID}{--guide-accent:#d8dde7;position:fixed;right:max(12px,env(safe-area-inset-right));bottom:calc(var(--cw-themed-nav-height,64px) + env(safe-area-inset-bottom) + 12px);z-index:2147483611;width:58px;height:58px;padding:0;border:2px solid var(--guide-accent);border-radius:50%;background:#08111d;box-shadow:0 0 22px color-mix(in srgb,var(--guide-accent) 55%,transparent);cursor:pointer;overflow:hidden}#${LAUNCHER_ID} img{width:100%;height:100%;object-fit:cover}
#cw-shared-guide-surface-v236{scroll-margin-top:calc(var(--cw-top-safe-height) + 12px)}html[data-cw237-fixed-top="true"] #cw-shared-guide-surface-v236{margin-top:calc(var(--cw-top-safe-height) + 12px)!important}
.cw237-setup-links{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.cw237-setup-links button{border:1px solid #ffd36e88;border-radius:999px;padding:5px 9px;background:#ffd36e16;color:inherit;font-weight:800;cursor:pointer}
#cw237-setup-tutorial{width:min(560px,calc(100vw - 24px));border:1px solid #ffffff33;border-radius:18px;padding:0;background:#0c1627;color:#f8fbff;box-shadow:0 24px 90px #000b}#cw237-setup-tutorial::backdrop{background:#0009}#cw237-setup-tutorial section{padding:18px}#cw237-setup-tutorial h2{margin:0 0 8px}#cw237-setup-tutorial p{white-space:pre-wrap;color:#ccd7e6}#cw237-setup-tutorial menu{display:flex;justify-content:flex-end;gap:8px;padding:0;margin:16px 0 0}#cw237-setup-tutorial button{min-height:38px;border:1px solid #ffffff32;border-radius:999px;padding:0 12px;background:#ffffff0e;color:inherit;font-weight:800;cursor:pointer}
.cw237-foundation{margin-top:10px;padding:11px;border:1px solid #f3cf6555;border-radius:14px;background:#f3cf650b}.cw237-foundation h3{margin:0 0 5px}.cw237-foundation p{margin:5px 0;color:inherit}.cw237-foundation ul{margin:7px 0;padding-left:20px}.cw237-foundation a{display:inline-flex;margin-top:7px;padding:7px 10px;border:1px solid #f3cf6570;border-radius:999px;color:inherit;font-weight:800;text-decoration:none}
@media(max-width:620px){#${ROOT_ID}{left:max(8px,env(safe-area-inset-left));right:max(8px,env(safe-area-inset-right));width:auto}#${ROOT_ID} [data-persistent-form]{grid-template-columns:1fr}#${ROOT_ID} [data-send]{min-height:40px}}
`;
  document.head.append(style);
}
function gateMarkup(row){
  const gate=row?.approvalGate;
  if(gate?.kind==='realm-action-approval')return`<div class="cw237-gate"><button type="button" data-gate="open-action" data-id="${esc(gate.actionId)}">Review draft</button>${gate.required&&!gate.missingRequired?.length?`<button type="button" data-gate="approve-action" data-id="${esc(gate.actionId)}">${esc(gate.label||'Approve')}</button>`:''}</div>`;
  if(gate?.kind==='intention-activation')return`<div class="cw237-gate"><button type="button" data-gate="open-plan" data-id="${esc(gate.planId)}">Review weave</button><button type="button" data-gate="activate-plan" data-id="${esc(gate.planId)}">Activate weave</button></div>`;
  return'';
}
function rowSystem(row){if(row?.role==='handover')return row.sourceSystem;return SYSTEMS.includes(row?.guide)?row.guide:pageSystem}
function renderMessages(){
  if(!root)return;const log=root.querySelector('[data-log]'),thread=readThread(pageSystem),guide=GUIDE[pageSystem];if(!log)return;
  if(!thread.messages.length){log.innerHTML=`<div class="cw237-bubble">${esc(guide.name)} keeps a private ${esc(guide.label)} thread here. Cross-realm work arrives only as explicit handover cards.</div>`;return}
  log.innerHTML=thread.messages.map(row=>{
    if(row.role==='user')return`<article class="is-user"><div class="cw237-bubble">${esc(row.text)}</div></article>`;
    const system=rowSystem(row),meta=GUIDE[system]||guide,handover=row.role==='handover';
    return`<article class="${handover?'is-handover':''}" style="--message-accent:${meta.accent}"><img src="${meta.avatar}" alt="${esc(meta.name)}"><div class="cw237-bubble">${handover?`<strong>Handover from ${esc(meta.name)} · ${esc(meta.label)}</strong>\n`:''}${esc(row.text)}<div class="cw237-meta"><b>${esc(meta.name)}</b>${row.provider?`<span>${esc(row.provider)}${row.model?` · ${esc(row.model)}`:''}</span>`:''}${handover?'<span>handover</span>':''}</div>${gateMarkup(row)}</div></article>`;
  }).join('');log.scrollTop=log.scrollHeight;
}
function setGuideVisuals(){
  const guide=GUIDE[pageSystem];if(!guide)return;for(const node of [root,launcher])if(node){node.style.setProperty('--guide-accent',guide.accent);node.style.setProperty('--guide-panel',guide.panel)}
  if(root){root.dataset.guide=pageSystem;const image=root.querySelector('[data-guide-avatar]'),name=root.querySelector('[data-guide-name]'),role=root.querySelector('[data-guide-role]');if(image){image.src=guide.avatar;image.alt=guide.name}if(name)name.textContent=guide.name;if(role)role.textContent=`${guide.role} · ${guide.label}`}
  if(launcher){const image=launcher.querySelector('img');if(image){image.src=guide.avatar;image.alt=`Open ${guide.name}`};launcher.setAttribute('aria-label',`Open ${guide.name} chat`)}
}
function mountChat(){
  const legacy=globalThis.CivweavePersistentGuideChatV215;try{legacy?.destroy?.()}catch{}
  try{globalThis.CivweaveGuideIdentityIntegrityV216?.destroy?.()}catch{}
  document.getElementById(ROOT_ID)?.remove();document.getElementById(LAUNCHER_ID)?.remove();document.getElementById('cw-persistent-guide-chat-style-v215')?.remove();
  root=document.createElement('section');root.id=ROOT_ID;root.hidden=true;root.innerHTML=`<header><img data-guide-avatar alt=""><div><small>${esc(GUIDE[pageSystem].label)} THREAD</small><strong data-guide-name></strong><span data-guide-role></span></div><button type="button" data-minimize aria-label="Minimize chat">−</button><button type="button" data-close aria-label="Close chat">×</button></header><div data-log role="log" aria-live="polite"></div><form data-persistent-form><textarea rows="2" maxlength="12000" required placeholder="Message ${esc(GUIDE[pageSystem].name)}"></textarea><button data-send type="submit">Send</button></form>`;
  launcher=document.createElement('button');launcher.id=LAUNCHER_ID;launcher.type='button';launcher.innerHTML='<img alt="">';
  document.body.append(root,launcher);setGuideVisuals();renderMessages();
  root.querySelector('[data-close]').addEventListener('click',closeChat);root.querySelector('[data-minimize]').addEventListener('click',()=>{const state=readThread(pageSystem);state.minimized=!state.minimized;writeThread(pageSystem,state);root.classList.toggle('is-minimized',state.minimized)});
  root.querySelector('[data-persistent-form]').addEventListener('submit',onSubmit,true);launcher.addEventListener('click',()=>openChat({guide:pageSystem}));
  document.addEventListener('click',onTrigger,true);addEventListener('civweave:realm-guide-thread-changed',event=>{if(event.detail?.system===pageSystem)renderMessages()});
  dispatchEvent(new CustomEvent('civweave:persistent-guide-chat-ready',{detail:{version:VERSION,system:pageSystem,realmIsolated:true}}));
}
function openChat(options={}){const state=readThread(pageSystem);state.open=true;state.minimized=false;state.unread=0;writeThread(pageSystem,state);root.hidden=false;root.classList.remove('is-minimized');const input=root.querySelector('textarea');if(options.prefill)input.value=clean(options.prefill,12000);queueMicrotask(()=>input?.focus({preventScroll:true}));return true}
function closeChat(){const state=readThread(pageSystem);state.open=false;writeThread(pageSystem,state);root.hidden=true;return true}
function switchGuide(system){return system===pageSystem}
function notify(system,text,options={}){if(!SYSTEMS.includes(system)||!clean(text))return false;const state=append(system,{role:'assistant',guide:system,text:clean(text,6000),notification:true});if(system!==pageSystem)state.unread=Math.min(99,Number(state.unread||0)+1);if(system===pageSystem&&options.open)openChat();return true}
function onTrigger(event){const trigger=event.target.closest?.('[data-cwf-chat],[data-open-guide-chat],[data-open-persistent-chat],#moss,#compass,.ls-moss,.ls-compass,[data-guide]');if(!trigger)return;event.preventDefault();event.stopImmediatePropagation();openChat({guide:pageSystem})}
function historyFor(system){return readThread(system).messages.slice(-24).map(row=>row.role==='handover'?{role:'system',text:`Handover from ${GUIDE[row.sourceSystem]?.name||row.sourceSystem}: ${clean(row.text,5000)}`}:{role:row.role==='user'?'user':'assistant',text:clean(row.text,5000)}).filter(row=>row.text)}
function handoffTarget(result,source){const explicit=clean(result?.handoffSystem||result?.response?.handoffSystem||result?.response?.choice?.handoffSystem,80).toLowerCase();if(SYSTEMS.includes(explicit)&&explicit!==source)return explicit;const choice=clean(result?.response?.choice?.system,80).toLowerCase();return SYSTEMS.includes(choice)&&choice!==source?choice:''}
async function createHandover(source,target,result){
  if(!SYSTEMS.includes(source)||!SYSTEMS.includes(target)||source===target)return null;
  const summary=clean(result?.response?.answer||'Work is ready for a cross-realm handoff.',5000),need=clean(result?.response?.choice?.nextAction||'Review the source work and continue from the target realm.',1200),text=`Summary of work: ${summary}\n\nWhat ${GUIDE[source].name} needs from ${GUIDE[target].name}: ${need}`;
  append(target,{role:'handover',sourceSystem:source,targetSystem:target,text,provider:result?.provider,model:result?.model});
  const assistant=globalThis.CivweaveAssistantV141;if(!assistant?.respond)return{text,target};
  try{
    const prompt=`You received a handover from ${GUIDE[source].name} in ${GUIDE[source].label}. ${text}\n\nRespond as ${GUIDE[target].name}. Acknowledge what was received, say what you can do next, and ask only for information that is actually missing.`;
    const response=await assistant.respond({text:prompt,systemId:target,history:historyFor(target)});
    append(target,{role:'assistant',guide:target,text:[clean(response?.response?.answer,9000),clean(response?.response?.choice?.nextAction)?`Next: ${clean(response.response.choice.nextAction,1200)}`:''].filter(Boolean).join('\n\n'),provider:response?.provider,model:response?.model,approvalGate:response?.response?.approvalGate||null,actionSnapshot:response?.action?clone(response.action):null});
  }catch(error){append(target,{role:'assistant',guide:target,text:`I received the handover, but my model route did not complete: ${clean(error.message,500)}`,provider:'handover-recovery'})}
  return{text,target};
}
async function onSubmit(event){event.preventDefault();event.stopImmediatePropagation();if(busy)return;const form=event.currentTarget,input=form.querySelector('textarea'),text=clean(input?.value,12000);if(!text)return;busy=true;const button=form.querySelector('[data-send]');if(button)button.disabled=true;append(pageSystem,{role:'user',text});const pendingId=uid('pending');append(pageSystem,{id:pendingId,role:'assistant',guide:pageSystem,text:`${GUIDE[pageSystem].name} is thinking…`,pending:true});input.value='';renderMessages();try{
    await globalThis.CivweaveFamilyAILoaderV105?.ensure?.();const assistant=globalThis.CivweaveAssistantV141;if(!assistant?.respond)throw new Error('The shared assistant runtime is not ready.');const result=await assistant.respond({text,systemId:pageSystem,history:historyFor(pageSystem).filter(row=>!row.pending)}),state=readThread(pageSystem),index=state.messages.findIndex(row=>row.id===pendingId),next=clean(result?.response?.choice?.nextAction,1200),replacement={role:'assistant',guide:pageSystem,text:[clean(result?.response?.answer,10000),next?`Next: ${next}`:''].filter(Boolean).join('\n\n'),provider:result?.provider,model:result?.model,approvalGate:result?.response?.approvalGate||null,planSnapshot:result?.plan?clone(result.plan):null,actionSnapshot:result?.action?clone(result.action):null};if(index>=0)state.messages[index]=replacement;else state.messages.push(replacement);writeThread(pageSystem,state);const target=handoffTarget(result,pageSystem);if(target)await createHandover(pageSystem,target,result);
  }catch(error){const state=readThread(pageSystem),index=state.messages.findIndex(row=>row.id===pendingId),replacement={role:'assistant',guide:pageSystem,text:`${GUIDE[pageSystem].name} could not complete this call: ${clean(error.message,800)}`,provider:'local-recovery'};if(index>=0)state.messages[index]=replacement;else state.messages.push(replacement);writeThread(pageSystem,state)}finally{busy=false;if(button)button.disabled=false;renderMessages();input.focus()}}
function installChatApi(){const api=Object.freeze({version:VERSION,realmIsolated:true,readState:()=>readThread(pageSystem),readThread,open:openChat,close:closeChat,switchGuide,notify,handover:(source,target,summary,need='')=>{append(target,{role:'handover',sourceSystem:source,targetSystem:target,text:`Summary of work: ${clean(summary,5000)}${need?`\n\nWhat ${GUIDE[source]?.name||source} needs: ${clean(need,1200)}`:''}`});return true},submitText:async text=>{openChat({guide:pageSystem,prefill:text});root.querySelector('[data-persistent-form]').requestSubmit();return true},destroy(){uiObserver?.disconnect();uiObserver=null;root?.remove();launcher?.remove()}});globalThis.CivweavePersistentGuideChatV215=api;return api}

function saveActions(rows){localStorage.setItem(ACTION_KEY,JSON.stringify(rows.slice(0,120)));try{dispatchEvent(new CustomEvent('civweave:actions-changed',{detail:{items:rows}}))}catch{}}
function pendingFellowFare(api){return api?.items?.().find(item=>item?.system==='fellowfare'&&['draft','clarifying','review'].includes(item.state))||null}
function repairFellowFareAction(action,text=''){
  if(!action||action.system!=='fellowfare')return action;const value=clean(text,5000),lower=value.toLowerCase();let changed=false;
  if(/\bbuttons?\b|\bcoins?\b/i.test(value)&&action.fields?.exchangeMethod!=='Buttons'){action.fields={...(action.fields||{}),exchangeMethod:'Buttons'};changed=true}
  if(/\b(no\s+(?:maximum|max)(?:imum)?\s+budget|no\s+budget\s+cap|unlimited(?:\s+budget)?|without\s+(?:a\s+)?budget\s+cap)\b/i.test(value)&&action.fields?.budgetPolicy!=='Unlimited'){action.fields={...(action.fields||{}),budgetPolicy:'Unlimited'};changed=true}
  if(/\b(auto(?:matic(?:ally)?)?\s*(?:set|price|pricing)|automatically\s+set\s+button\s+prices|button\s+prices)\b/i.test(value)){action.fields={...(action.fields||{}),buttonPricingPolicy:'Auto-estimate Button prices per line item during review; all estimates remain editable before publication.'};changed=true}
  const hasTerms=Boolean(action.fields?.exchangeMethod)||action.fields?.budget!=null||action.fields?.budgetPolicy==='Unlimited';
  if(hasTerms&&Array.isArray(action.missingRequired)){const before=action.missingRequired.length;action.missingRequired=action.missingRequired.filter(item=>item!=='maximum budget or exchange method');changed=changed||before!==action.missingRequired.length}
  if((/\bfinalize[_\s-]*exchange[_\s-]*parameters\b/i.test(lower)||hasTerms)&&!action.missingRequired?.length&&action.state==='clarifying'){action.state='review';changed=true}
  if(!action.missingRequired?.length){action.approval={...(action.approval||{}),required:true,label:'Finalize & publish request'};if(action.state==='clarifying')action.state='review'}
  if(changed){action.updatedAt=now();const rows=parse(localStorage.getItem(ACTION_KEY),[]),index=Array.isArray(rows)?rows.findIndex(item=>item?.id===action.id):-1;if(index>=0){rows[index]=action;saveActions(rows)}}
  return action;
}
function patchContracts(api){
  if(!api?.compose||api.__cw237FellowFareTerms)return api;const original=api.compose.bind(api);api.compose=(text,system,ctx)=>{if(system==='fellowfare'){const pending=pendingFellowFare(api);if(pending){const repaired=repairFellowFareAction(pending,text);if(repaired!==pending||!repaired.missingRequired?.includes('maximum budget or exchange method')||/finalize[_\s-]*exchange[_\s-]*parameters/i.test(text))return repaired}}return repairFellowFareAction(original(text,system,ctx),text)};Object.defineProperty(api,'__cw237FellowFareTerms',{value:true});return api
}
function installContractTrap(){contractsValue=patchContracts(globalThis.CivweaveGuideContractsV141);const descriptor=Object.getOwnPropertyDescriptor(globalThis,'CivweaveGuideContractsV141');if(!descriptor||descriptor.configurable){try{Object.defineProperty(globalThis,'CivweaveGuideContractsV141',{configurable:true,enumerable:true,get:()=>contractsValue,set:value=>{contractsValue=patchContracts(value)}})}catch{}}}

const planningSchema={type:'object',required:['title','objective','tasks'],properties:{title:{type:'string'},objective:{type:'string'},promise:{type:'string'},audience:{type:'string'},assumptions:{type:'array',items:{type:'string'}},dataPoints:{type:'array',items:{type:'string'}},risks:{type:'array',items:{type:'string'}},acceptanceCriteria:{type:'array',items:{type:'string'}},tasks:{type:'array',minItems:5,maxItems:18,items:{type:'object',required:['id','title','objective','dependencies','evidence'],properties:{id:{type:'string'},title:{type:'string'},objective:{type:'string'},dependencies:{type:'array',items:{type:'string'}},dataNeeded:{type:'array',items:{type:'string'}},evidence:{type:'array',items:{type:'string'}},acceptanceCriteria:{type:'array',items:{type:'string'}}}}}}};
function localPlanningFallback(text){return{title:clean(text,120).replace(/^let'?s\s+/i,'')||'Creator-led project',objective:clean(text,1200),promise:'Build one coherent, testable experience before expanding scope.',audience:'Define the intended user or player before implementation.',assumptions:['The project remains creator-led until an implementation task is explicitly delegated.'],dataPoints:['Target user and context','Core loop and desired state change','Session length and progression','Safety and accessibility constraints','Evidence that the experience is working'],risks:['Scope expands before the core loop is tested','Progression metrics reward the wrong behavior','Aesthetic framing outruns evidence'],acceptanceCriteria:['A complete first experience can be used end to end.','Dependencies and evidence are explicit.'],tasks:[{id:'01',title:'Define the experience promise',objective:'Describe the intended user, outcome, and one-sentence promise.',dependencies:[],dataNeeded:['Audience','Desired outcome'],evidence:['Experience brief'],acceptanceCriteria:['Promise is testable']},{id:'02',title:'Map the core loop',objective:'Describe trigger, action, feedback, progression, success, and reset.',dependencies:['01'],dataNeeded:['User actions','Feedback signals'],evidence:['Core-loop diagram'],acceptanceCriteria:['One session can be simulated']},{id:'03',title:'Design progression and state',objective:'Define progression without confusing game score with personal worth.',dependencies:['02'],dataNeeded:['Stages','Unlock conditions'],evidence:['Progression table'],acceptanceCriteria:['Each stage has observable entry and exit conditions']},{id:'04',title:'Identify content and data dependencies',objective:'List content, assets, measurements, storage, and research required.',dependencies:['01','02'],dataNeeded:['Source needs','Data model'],evidence:['Dependency map'],acceptanceCriteria:['No required input is implicit']},{id:'05',title:'Prototype the smallest complete slice',objective:'Build or stage one complete usable session.',dependencies:['02','03','04'],dataNeeded:['Prototype constraints'],evidence:['Working prototype'],acceptanceCriteria:['A user can complete one full loop']},{id:'06',title:'Test and revise',objective:'Observe use, record friction, and revise from evidence.',dependencies:['05'],dataNeeded:['Test notes','Observed confusion'],evidence:['Revision log'],acceptanceCriteria:['At least one evidence-driven revision is recorded']} ]}}
function persistAgenticPlan(text,analysis,plan,result){
  const at=now(),tasks=(Array.isArray(plan.tasks)?plan.tasks:[]).slice(0,18),id=uid('action-project'),action={schema:'civweave.realm-action.v1',id,system:'cerbanimo',kind:'creator-project-plan',title:clean(plan.title,180)||'Creator-led project plan',state:'review',createdAt:at,updatedAt:at,sourceText:clean(text),roomId:'cerbanimo.nexus',fields:{objective:clean(plan.objective,1800)||clean(text,1200),audience:clean(plan.audience,800),promise:clean(plan.promise,800),sourceRealm:analysis?.sourceRealm||'cerbanimo',implementationMode:'Creator-led · agentic planning',automationOnly:'No',dataPoints:(plan.dataPoints||[]).slice(0,20),risks:(plan.risks||[]).slice(0,16),assumptions:(plan.assumptions||[]).slice(0,16),ownership:'The user owns the project. GitHub automation requires a later, explicitly delegated bounded implementation request.'},missingRequired:[],checkpoints:tasks.map(task=>task.title),acceptanceCriteria:(plan.acceptanceCriteria||[]).slice(0,16),evidence:tasks.flatMap(task=>task.evidence||[]).slice(0,24),approval:{required:true,label:'Activate project plan'},execution:{status:'not-started',events:[]},creatorProject:{schema:'civweave.creator-project-plan.v237',planner:'agentic',tasks:tasks.map((task,index)=>({id:clean(task.id,80)||`task-${index+1}`,title:clean(task.title,500),objective:clean(task.objective,1400),dependencies:(task.dependencies||[]).map(item=>clean(item,120)).filter(Boolean),dataNeeded:(task.dataNeeded||[]).map(item=>clean(item,500)).filter(Boolean),evidence:(task.evidence||[]).map(item=>clean(item,500)).filter(Boolean),acceptanceCriteria:(task.acceptanceCriteria||[]).map(item=>clean(item,500)).filter(Boolean),owner:'user',state:'pending'}))},source:{kind:'agentic-creator-planner-v237',provider:result?.actual?.provider||result?.provider||'local-fallback',model:result?.actual?.model||result?.model||'dependency-planner'}};
  const rows=parse(localStorage.getItem(ACTION_KEY),[]),list=Array.isArray(rows)?rows:[],fingerprint=clean(`creator|${text}`,900).toLowerCase(),old=list.find(item=>item?.fingerprint===fingerprint&&['review','active'].includes(item.state));action.fingerprint=fingerprint;if(old){action.id=old.id;action.createdAt=old.createdAt;Object.assign(old,action)}else list.unshift(action);saveActions(list);return old||action;
}
async function agenticCreatorPlan(args,analysis){
  const runtime=globalThis.CivweaveModelRuntime;let plan=null,result=null;
  if(runtime?.generateAgentic){try{const base=runtime.readSharedConfig?.('agentic')||runtime.readSharedConfig?.('interactive')||{},config={...base,timeoutMs:Math.max(Number(base.timeoutMs||0),180000),maxTokens:Math.max(Number(base.maxTokens||0),10000),temperature:.2};result=await runtime.generateAgentic({purpose:'cerbanimo-project-planning-v237',config,schema:planningSchema,context:{request:clean(args.text,12000),sourceRealm:analysis?.sourceRealm||'cerbanimo',planningContract:'Think patiently. Build dependencies before ordering tasks. Identify data needed, assumptions, risks, acceptance criteria, and evidence. Do not dispatch code or GitHub automation.'},messages:[{role:'system',content:'You are Kamiya planning a substantial creator-led Cerbanimo project. Think through dependencies and data requirements before sequencing tasks. Return JSON only. The user owns every task. Do not start implementation automation, GitHub work, or code dispatch.'},{role:'user',content:clean(args.text,12000)}]});if(result?.status==='success'&&result.outputJson)plan=result.outputJson}catch{}}
  if(!plan)plan=localPlanningFallback(args.text);const action=persistAgenticPlan(args.text,analysis,plan,result),provider=result?.actual?.provider||result?.provider||'agentic-planner-fallback',model=result?.actual?.model||result?.model||'local-dependency-plan-v237';return{response:{answer:`Kamiya built a dependency-aware creator-led plan with ${action.creatorProject.tasks.length} tasks. The plan identifies data needs, dependencies, evidence, and acceptance criteria before implementation. No coding automation or GitHub job started.`,choice:{mode:'Build',system:'cerbanimo',room:'cerbanimo.nexus',nextAction:`Review and activate “${action.title}.”`},assumptions:action.fields.assumptions||[],requiresConsent:true,confidence:.96,approvalGate:{kind:'realm-action-approval',actionId:action.id,state:action.state,required:true,label:action.approval.label,missingRequired:[]}},provider,requestedProvider:'agentic',model,action,context:{schema:'civweave.creator-planning-context.v237',sourceRealm:analysis?.sourceRealm||'cerbanimo',implementationMode:'creator-led-agentic'},fallbackFrom:result?null:{provider:'agentic',reason:'Agentic model route unavailable; dependency-aware local fallback used.'}}
}
function patchCodeRouter(){
  const router=globalThis.CivweaveCodeAutomationV217,assistant=globalThis.CivweaveAssistantV141;if(!router?.analyze||!assistant?.respond||assistant.respond.__cw237CreatorPlanner)return false;const current=assistant.respond.bind(assistant),wrapped=async args=>{const analysis=router.analyze(args?.text,args?.systemId);if(analysis?.route==='creator-plan')return agenticCreatorPlan(args||{},analysis);return current(args)};wrapped.__cw237CreatorPlanner=true;wrapped.__prior=current;assistant.respond=wrapped;assistantPatched=wrapped;return true
}

function repairLogo(){const image=document.querySelector('#brand-home img,.brand img[alt="Civweave"]');if(!image)return false;const fallback='/app/logos/civweave-app-icon.png';if(/civweave-symbol\.svg/i.test(image.getAttribute('src')||''))image.src=fallback;if(!image.dataset.cw237LogoFallback){image.dataset.cw237LogoFallback='true';image.addEventListener('error',()=>{if(!image.src.endsWith(fallback))image.src=fallback})}return true}
function repairTopSafe(){let height=0;for(const node of document.querySelectorAll('header.top,.rc-top,.ffc144-top,.ls-top,[data-app-header]')){const style=getComputedStyle(node);if(style.position!=='fixed'||style.display==='none'||style.visibility==='hidden')continue;const rect=node.getBoundingClientRect();if(rect.bottom>0&&rect.top<=4)height=Math.max(height,Math.round(rect.bottom))}document.documentElement.style.setProperty('--cw-top-safe-height',`${height}px`);document.documentElement.dataset.cw237FixedTop=height?'true':'false'}
function tutorialDialog(){let dialog=document.getElementById('cw237-setup-tutorial');if(dialog)return dialog;dialog=document.createElement('dialog');dialog.id='cw237-setup-tutorial';dialog.innerHTML='<section><small>CODE AUTOMATION SETUP</small><h2 data-title></h2><p data-body></p><menu><button type="button" data-open-settings>Open AI settings</button><button type="button" data-close>Close</button></menu></section>';document.body.append(dialog);dialog.querySelector('[data-close]').addEventListener('click',()=>dialog.close?.());dialog.querySelector('[data-open-settings]').addEventListener('click',()=>{globalThis.CivweaveFamilyAILoaderV105?.openSettings?.();dialog.close?.()});return dialog}
function openTutorial(label){const info=TUTORIALS[label];if(!info)return;const dialog=tutorialDialog();dialog.querySelector('[data-title]').textContent=info.title;dialog.querySelector('[data-body]').textContent=info.body;if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','')}
function decorateTutorials(){for(const warning of document.querySelectorAll('#cw-shared-review-surface-v234 .cwsr234-warning')){if(warning.dataset.cw237Tutorials)return;const labels=Object.keys(TUTORIALS).filter(label=>warning.textContent.includes(label));if(!labels.length)continue;warning.dataset.cw237Tutorials='true';warning.innerHTML='<strong>Still needed:</strong>';const box=document.createElement('div');box.className='cw237-setup-links';for(const label of labels){const button=document.createElement('button');button.type='button';button.textContent=label;button.addEventListener('click',()=>openTutorial(label));box.append(button)}warning.append(box)}}
function recommendedSchools(capability=''){const text=clean(capability,3000).toLowerCase(),slugs=[];const add=(...items)=>items.forEach(item=>{if(!slugs.includes(item))slugs.push(item)});if(/meditat|mindful|attention|breath|conscious|contemplat|state change|will-based/.test(text))add('philosophy-and-religion','health-medicine-and-disease','science','people');if(/game|gamif|player|reward|progression/.test(text))add('arts','technology','society-and-social-sciences');if(/garden|food|soil|plant|community/.test(text))add('science','everyday-life','society-and-social-sciences','geography');if(!slugs.length)add('people','science','everyday-life');return slugs.slice(0,5)}
function savedSchoolSlugs(){const receipt=parse(localStorage.getItem('civweave.knowledge-schools.v2'),{});return new Set(Object.keys(receipt||{}))}
function repairLivingSchool(){
  if(pageSystem!=='living-school')return;for(const button of document.querySelectorAll('[data-ls-action="evaluate-assessment"]')){button.disabled=false;button.title='Assessment can be attempted now. Passing evidence and module completion are tracked separately.'}
  const research=document.querySelector('.lsc218-research-status');if(!research||document.querySelector('.cw237-foundation'))return;const capability=document.querySelector('[name="capability"]')?.value||'',recommended=recommendedSchools(capability),saved=savedSchoolSlugs(),bySlug=new Map(FOUNDATION_SCHOOLS.map(row=>[row[0],row])),panel=document.createElement('section');panel.className='cw237-foundation';const available=recommended.filter(slug=>saved.has(slug));panel.innerHTML=`<h3>Optional foundation library</h3><p>${saved.size?`${saved.size}/11 foundation schools appear saved on this device.`:'No foundation schools are saved on this device yet.'} ${available.length?`Moss can consult ${available.length} especially relevant saved school${available.length===1?'':'s'} locally.`:'If live research is unavailable, the optional library gives Moss a local source pool instead of relying only on model training memory.'}</p><p><b>For this capability Moss would check:</b></p><ul>${recommended.map(slug=>{const row=bySlug.get(slug);return`<li>${esc(row[1])} · ${row[2]} articles${saved.has(slug)?' · saved':''}</li>`}).join('')}</ul><p><small>Foundation catalog: 11 schools · 1,001 articles. The list is stored with Civweave so Moss can explain what local sources would be useful even before the school ZIPs are downloaded.</small></p><a href="/app/index.html#knowledge-school-list">Open optional library download</a>`;research.insertAdjacentElement('afterend',panel)
}
function repairUi(){repairQueued=false;repairLogo();repairTopSafe();decorateTutorials();repairLivingSchool();patchContracts(globalThis.CivweaveGuideContractsV141);patchCodeRouter()}
function queueRepair(){if(repairQueued)return;repairQueued=true;queueMicrotask(repairUi)}
function observeUi(){if(uiObserver)return;uiObserver=new MutationObserver(records=>{if(records.some(record=>record.addedNodes?.length||record.removedNodes?.length))queueRepair()});uiObserver.observe(document.body,{childList:true,subtree:true});addEventListener('resize',repairTopSafe,{passive:true})}

function start(){pageSystem=detectSystem();installStyle();migrateThreads();installContractTrap();installChatApi();mountChat();observeUi();repairUi();addEventListener('civweave:code-automation-ready',()=>queueMicrotask(()=>{patchCodeRouter();patchContracts(globalThis.CivweaveGuideContractsV141)}));document.documentElement.dataset.civweaveRealmSessionIntegrity='v237'}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();

globalThis.CivweaveRealmSessionIntegrityV237=Object.freeze({version:VERSION,detectSystem,readThread,writeThread,migrateThreads,createHandover,repairFellowFareAction,agenticCreatorPlan,recommendedSchools,foundationSchools:FOUNDATION_SCHOOLS.map(([slug,name,articles])=>({slug,name,articles})),tutorials:Object.keys(TUTORIALS),repairUi});
})();
