(()=>{
'use strict';

const VERSION='1.0.164-guide-chat-surface-v350-canonical-artifacts';
const ROOT_ID='cw-persistent-guide-chat-v215';
const LAUNCHER_ID='cwp215-launcher';
const STYLE_ID='cw-guide-chat-surface-v350-style';
const STATE_KEY='civweave.guide-chat-surface.v350';
const RETIRED_STATE_KEY='civweave.guide-workspace.v242';
const LOCAL_SELECTION_KEY='civweave.local-ai.selection.v266';
const SYSTEMS=['civweave','living-school','cerbanimo','fellowfare','anarchadia'];
const GUIDE=Object.freeze({
  civweave:{name:'Weaveling',label:'Civweave',role:'Quest guide and central orchestrator',avatar:'/app/assets/ai/chat/weaveling-face-v255.webp',accent:'#d8dde7',panel:'#111827',placeholder:'Message Weaveling about a Quest'},
  'living-school':{name:'Moss',label:'Living School',role:'Learning Journey guide',avatar:'/app/assets/ai/chat/moss-face-v255.webp',accent:'#59cf87',panel:'#17342c',placeholder:'Message Moss about a Learning Journey'},
  cerbanimo:{name:'Kamiya',label:'Cerbanimo',role:'Endeavor guide',avatar:'/app/assets/ai/chat/kamiya-face-v255.webp',accent:'#ff54d3',panel:'#170824',placeholder:'Message Kamiya about an Endeavor'},
  fellowfare:{name:'Rook',label:'FellowFare',role:'Manifest guide and Quartermaster',avatar:'/app/assets/ai/chat/rook-face-v255.webp',accent:'#f2a93b',panel:'#2c1b17',placeholder:'Message Rook about a Manifest'},
  anarchadia:{name:'Merlin',label:'Anarchadia',role:'Civic and automation guide',avatar:'/app/assets/ai/chat/merlin-face-v255.webp',accent:'#ff4f9a',panel:'#090909',placeholder:'Message Merlin'}
});
if(globalThis.CivweaveGuideChatSurfaceV350?.version===VERSION)return;

const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[char]));
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const clone=value=>{try{return typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value))}catch{return value}};
const now=()=>new Date().toISOString();
const uid=prefix=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
let pageSystem='civweave';
let activeSystem='civweave';
let openState=false;
let minimized=false;
let busy=false;
let seen={};
let root=null;
let launcher=null;

function detectSystem(){
  const route=globalThis.CivweaveSystemRoutesV227?.identify?.(location.pathname);
  if(SYSTEMS.includes(route))return route;
  const declared=clean(document.documentElement?.dataset?.civweaveSystemRoute||document.documentElement?.dataset?.civweaveSystem||document.body?.dataset?.civweaveSystem||document.body?.dataset?.system,80).toLowerCase();
  if(SYSTEMS.includes(declared))return declared;
  const query=new URLSearchParams(location.search).get('system');
  return SYSTEMS.includes(query)?query:'civweave';
}
function realmApi(){return globalThis.CivweaveRealmSessionIntegrityV237}
function threadKey(system){return`civweave.guide-thread.v350.${system}`}
function emptyThread(system){return{schema:'civweave.realm-guide-thread.v237',system,messages:[],open:false,minimized:false,unread:0,updatedAt:null}}
function readThread(system){
  const via=realmApi()?.readThread?.(system);if(via)return via;
  try{const value=parse(localStorage.getItem(threadKey(system)),null);return value&&typeof value==='object'?value:emptyThread(system)}catch{return emptyThread(system)}
}
function writeThread(system,value){
  const thread={...emptyThread(system),...(value||{}),system,updatedAt:value?.updatedAt||now()};
  if(realmApi()?.writeThread)return realmApi().writeThread(system,thread);
  try{localStorage.setItem(threadKey(system),JSON.stringify(thread))}catch{}
  try{dispatchEvent(new CustomEvent('civweave:realm-guide-thread-changed',{detail:{system,thread}}))}catch{}
  return thread;
}
function append(system,row){
  const thread=readThread(system);thread.messages=Array.isArray(thread.messages)?thread.messages:[];
  thread.messages.push({...row,id:row.id||uid('msg'),at:row.at||now()});thread.updatedAt=now();
  return writeThread(system,thread);
}
function selectedLocal(){try{const value=parse(localStorage.getItem(LOCAL_SELECTION_KEY),{});return value?.active&&value?.id?value:null}catch{return null}}
function state(){return Object.freeze({version:VERSION,pageSystem,activeWindow:activeSystem,activeSystem,open:openState,minimized,busy,canonicalOwner:true,presentation:'single-current-chat-surface',selectedLocalModel:selectedLocal()?.id||''})}
function saveState(){try{localStorage.setItem(STATE_KEY,JSON.stringify({...state(),seen:{...seen},updatedAt:now()}))}catch{}}
function restoreState(){
  let value={};try{value=parse(localStorage.getItem(STATE_KEY),{})}catch{}
  if(!Object.keys(value).length){try{const old=parse(localStorage.getItem(RETIRED_STATE_KEY),{});value={activeSystem:old.activeWindow,seen:old.seen||{},open:false,minimized:false};localStorage.removeItem(RETIRED_STATE_KEY)}catch{}}
  activeSystem=SYSTEMS.includes(value.activeSystem)?value.activeSystem:pageSystem;
  seen=value.seen&&typeof value.seen==='object'?{...value.seen}:{};
  openState=false;minimized=false;
}
function markSeen(system){if(!SYSTEMS.includes(system))return;const thread=readThread(system);seen[system]=thread.updatedAt||now();saveState()}
function hasUnread(system){
  if(!SYSTEMS.includes(system)||(openState&&activeSystem===system))return false;
  const thread=readThread(system),lastSeen=clean(seen[system],80);
  return Boolean(Number(thread.unread||0)>0||(thread.updatedAt&&(!lastSeen||thread.updatedAt>lastSeen)));
}
function emitState(){
  const detail=state();
  try{dispatchEvent(new CustomEvent('civweave:guide-chat-state',{detail}))}catch{}
  try{dispatchEvent(new CustomEvent('civweave:guide-workspace-state',{detail}))}catch{}
}
function emitOpened(){try{dispatchEvent(new CustomEvent('civweave:guide-chat-opened',{detail:state()}))}catch{}}
function emitAvatar(system,text,userText='',phase='response'){try{dispatchEvent(new CustomEvent('civweave:avatar-direct-text',{detail:{system,text:clean(text),userText:clean(userText,1200),phase}}))}catch{}}
function guide(system=activeSystem){return GUIDE[system]||GUIDE.civweave}

function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
#${LAUNCHER_ID}{position:fixed;z-index:2147483611;right:max(12px,env(safe-area-inset-right));bottom:calc(var(--cw-themed-nav-height,64px) + env(safe-area-inset-bottom) + 12px);width:60px;height:60px;padding:0;border:1px solid color-mix(in srgb,var(--guide-accent,#d8dde7) 64%,transparent);border-radius:50%;overflow:hidden;background:#07111f;box-shadow:0 10px 30px #0009,0 0 20px color-mix(in srgb,var(--guide-accent,#d8dde7) 34%,transparent);cursor:pointer;appearance:none;-webkit-appearance:none}
#${LAUNCHER_ID} img{display:block;width:100%;height:100%;object-fit:cover}
#${ROOT_ID}{--guide-accent:#d8dde7;--guide-panel:#111827;position:fixed;z-index:2147483612;right:max(12px,env(safe-area-inset-right));bottom:calc(var(--cw-themed-nav-height,64px) + env(safe-area-inset-bottom) + 12px);width:min(520px,calc(100vw - 24px));height:min(72dvh,720px);display:grid;grid-template-rows:auto auto auto minmax(0,1fr) auto;overflow:hidden;border:1px solid color-mix(in srgb,var(--guide-accent) 46%,transparent);border-radius:20px;background:var(--guide-panel);color:#f8fbff;box-shadow:0 24px 80px #000b;font:15px/1.45 Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color-scheme:dark;isolation:isolate;contain:layout paint style}
#${ROOT_ID}[hidden]{display:none!important}#${ROOT_ID} *{box-sizing:border-box}
#${ROOT_ID}>header{display:grid;grid-template-columns:48px minmax(0,1fr) 40px;align-items:center;gap:9px;padding:10px 11px calc(10px + env(safe-area-inset-top));border-bottom:1px solid color-mix(in srgb,var(--guide-accent) 34%,transparent);background:color-mix(in srgb,var(--guide-panel) 88%,#fff 4%)}
#${ROOT_ID}>header img{width:48px;height:48px;border:2px solid var(--guide-accent);border-radius:14px;object-fit:cover}#${ROOT_ID}>header div{min-width:0}#${ROOT_ID}>header strong,#${ROOT_ID}>header span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#${ROOT_ID}>header strong{font-size:1rem}#${ROOT_ID}>header span{margin-top:2px;color:#b9c6d8;font-size:.72rem}
#${ROOT_ID} [data-close]{width:40px;height:40px;border:1px solid color-mix(in srgb,var(--guide-accent) 40%,transparent);border-radius:10px;background:#ffffff0c;color:#fff;font-size:20px;font-weight:900}
#${ROOT_ID} .cw242-window-switcher{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;padding:8px 9px 9px;border-bottom:1px solid #ffffff18;background:#0003}
#${ROOT_ID} .cw242-window{position:relative;min-width:0;display:grid;justify-items:center;gap:3px;padding:5px 2px;border:1px solid transparent;border-radius:12px;background:transparent;color:#aebbc9;cursor:pointer}
#${ROOT_ID} .cw242-window img{width:52px;height:52px;border-radius:14px;object-fit:cover;border:2px solid var(--window-accent);filter:saturate(.72) brightness(.8);box-shadow:0 3px 12px #0007}
#${ROOT_ID} .cw242-window span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px;font-weight:850}
#${ROOT_ID} .cw242-window[aria-pressed="true"]{border-color:color-mix(in srgb,var(--window-accent) 58%,transparent);background:color-mix(in srgb,var(--window-accent) 12%,transparent);color:#fff}
#${ROOT_ID} .cw242-window[aria-pressed="true"] img{filter:none;box-shadow:0 0 16px color-mix(in srgb,var(--window-accent) 58%,transparent),0 3px 12px #0009}
#${ROOT_ID} .cw242-window[data-here="true"]::before{content:"";position:absolute;left:6px;top:6px;width:7px;height:7px;border-radius:50%;background:var(--window-accent);box-shadow:0 0 8px var(--window-accent)}
#${ROOT_ID} .cw242-unread{position:absolute;right:7px;top:6px;width:10px;height:10px;border:2px solid #08111d;border-radius:50%;background:var(--window-accent);box-shadow:0 0 9px var(--window-accent)}#${ROOT_ID} .cw242-unread[hidden]{display:none!important}
#${ROOT_ID} .cw350-context{padding:7px 11px;border-bottom:1px solid #ffffff12;color:#9fb0c3;font-size:11px;background:#0002}#${ROOT_ID} [data-log]{min-height:0;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:10px;overscroll-behavior:contain;touch-action:pan-y;-webkit-overflow-scrolling:touch}#${ROOT_ID} [data-log]:empty::before{content:'Start a conversation';margin:auto;color:#71839a;font-weight:750}
#${ROOT_ID} article{display:grid;grid-template-columns:32px minmax(0,1fr);gap:8px;align-items:start}#${ROOT_ID} article.is-user{display:flex;justify-content:flex-end;padding-left:42px}#${ROOT_ID} article>img{width:32px;height:32px;border:1px solid var(--guide-accent);border-radius:10px;object-fit:cover}#${ROOT_ID} .cw350-bubble{max-width:88%;padding:9px 11px;border:1px solid #ffffff18;border-radius:13px;background:#ffffff0b;white-space:pre-wrap;overflow-wrap:anywhere}#${ROOT_ID} .is-user .cw350-bubble{background:color-mix(in srgb,var(--guide-accent) 16%,#ffffff08);border-color:color-mix(in srgb,var(--guide-accent) 42%,transparent)}#${ROOT_ID} .cw350-meta{margin-top:5px;color:#8394aa;font-size:10px}
#${ROOT_ID} [data-persistent-form]{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:10px max(10px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom)) max(10px,env(safe-area-inset-left));border-top:1px solid color-mix(in srgb,var(--guide-accent) 32%,transparent);background:#0002}#${ROOT_ID} textarea{min-width:0;width:100%;min-height:54px;max-height:min(28dvh,180px);resize:none;border:1px solid #ffffff22;border-radius:12px;padding:11px;background:#050b15;color:#fff;font:inherit}#${ROOT_ID} [data-send]{min-width:76px;border:1px solid var(--guide-accent);border-radius:12px;padding:0 14px;background:color-mix(in srgb,var(--guide-accent) 28%,#182334);color:#fff;font:900 14px/1 system-ui}#${ROOT_ID} button{cursor:pointer}
@media(max-width:720px){#${ROOT_ID}{position:fixed;inset:0;width:100vw;height:100dvh;max-width:none;max-height:100dvh;border:0;border-radius:0;grid-template-rows:auto auto auto minmax(0,1fr) auto}#${ROOT_ID}>header{grid-template-columns:44px minmax(0,1fr) 40px;padding-top:calc(7px + env(safe-area-inset-top))}#${ROOT_ID}>header img{width:44px;height:44px}#${ROOT_ID} .cw242-window-switcher{gap:4px;padding:7px 5px 8px}#${ROOT_ID} .cw242-window img{width:48px;height:48px;border-radius:12px}#${LAUNCHER_ID}{width:56px;height:56px}}
@media(max-width:390px){#${ROOT_ID} .cw242-window-switcher{gap:2px;padding-left:3px;padding-right:3px}#${ROOT_ID} .cw242-window img{width:44px;height:44px}}
`;
  document.head.append(style);
}
function ensureLauncher(){
  if(launcher?.isConnected)return launcher;
  launcher=document.getElementById(LAUNCHER_ID)||document.createElement('button');
  launcher.id=LAUNCHER_ID;launcher.type='button';launcher.setAttribute('aria-label',`Talk to ${guide(pageSystem).name}`);launcher.innerHTML='<img alt="">';
  launcher.addEventListener('click',()=>open({guide:pageSystem,focus:true}));
  if(!launcher.isConnected)document.body.append(launcher);
  syncChrome();return launcher;
}
function switcherMarkup(){return SYSTEMS.map(system=>{const item=GUIDE[system];return`<button class="cw242-window" type="button" data-cw242-window="${system}" style="--window-accent:${item.accent}" aria-label="${esc(item.name)} · ${esc(item.label)}" aria-pressed="false"><img src="${esc(item.avatar)}" alt="${esc(item.name)}"><span>${esc(item.name)}</span><i class="cw242-unread" data-unread hidden aria-hidden="true"></i></button>`}).join('')}
function ensureRoot(){
  if(root?.isConnected)return root;
  root=document.getElementById(ROOT_ID)||document.createElement('section');root.id=ROOT_ID;root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Civweave guide chat');
  root.innerHTML=`<header><img data-guide-avatar alt=""><div><strong data-guide-name></strong><span data-guide-role></span></div><button data-close type="button" aria-label="Close chat">×</button></header><nav class="cw242-window-switcher" aria-label="Guide chats">${switcherMarkup()}</nav><div class="cw350-context" data-context></div><div data-log role="log" aria-live="polite"></div><form data-persistent-form><textarea rows="2" maxlength="12000" required></textarea><button data-send type="submit">Send</button></form>`;
  root.querySelector('[data-close]').addEventListener('click',close);
  root.querySelector('.cw242-window-switcher').addEventListener('click',event=>{const button=event.target.closest?.('[data-cw242-window]');if(button)switchGuide(button.dataset.cw242Window,{open:true,focus:true})});
  root.querySelector('[data-persistent-form]').addEventListener('submit',event=>{event.preventDefault();const input=event.currentTarget.querySelector('textarea'),text=clean(input?.value);if(!text)return;void submitActive(text)});
  root.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close()}});
  if(!root.isConnected)document.body.append(root);
  syncChrome();render();return root;
}
function syncSwitcher(){
  if(!root)return;
  root.querySelectorAll('[data-cw242-window]').forEach(button=>{
    const system=button.dataset.cw242Window,current=system===activeSystem;
    button.setAttribute('aria-pressed',current?'true':'false');button.dataset.here=system===pageSystem?'true':'false';
    const unread=button.querySelector('[data-unread]');if(unread)unread.hidden=!hasUnread(system);
  });
}
function syncChrome(){
  const current=guide(activeSystem),page=guide(pageSystem);
  document.documentElement.style.setProperty('--guide-accent',current.accent);
  if(launcher){launcher.style.setProperty('--guide-accent',page.accent);const image=launcher.querySelector('img');if(image){image.src=page.avatar;image.alt=page.name}}
  if(!root)return;
  root.style.setProperty('--guide-accent',current.accent);root.style.setProperty('--guide-panel',current.panel);root.dataset.guide=activeSystem;root.dataset.pageSystem=pageSystem;
  const avatar=root.querySelector('[data-guide-avatar]');if(avatar){avatar.src=current.avatar;avatar.alt=current.name}
  const name=root.querySelector('[data-guide-name]');if(name)name.textContent=current.name;
  const role=root.querySelector('[data-guide-role]');if(role)role.textContent=current.role;
  const input=root.querySelector('textarea');if(input)input.placeholder=current.placeholder;
  const context=root.querySelector('[data-context]');if(context)context.textContent=activeSystem===pageSystem?current.label:`${current.label} conversation · opened from ${guide(pageSystem).label}`;
  syncSwitcher();
}
function render(){
  if(!root)return false;syncChrome();const log=root.querySelector('[data-log]');if(!log)return false;
  const messages=Array.isArray(readThread(activeSystem).messages)?readThread(activeSystem).messages:[];
  log.innerHTML=messages.map(row=>{
    const user=row?.role==='user',who=GUIDE[row?.guide||row?.responderSystem||activeSystem]||guide(activeSystem),meta=[row?.provider,row?.model].filter(Boolean).join(' · '),pending=Boolean(row?.pending);
    if(user)return`<article class="is-user" data-role="user" data-message-role="user" data-pending="false"><div class="cw350-bubble">${esc(row.text||'')}</div></article>`;
    return`<article data-role="assistant" data-message-role="assistant" data-pending="${pending?'true':'false'}" class="${pending?'cw-ai-pending':''}"><img src="${esc(who.avatar)}" alt="${esc(who.name)}"><div><div class="cw350-bubble">${esc(row.text||'')}</div>${meta?`<div class="cw350-meta">${esc(meta)}</div>`:''}</div></article>`;
  }).join('');
  if(openState)markSeen(activeSystem);syncSwitcher();
  requestAnimationFrame(()=>{try{log.scrollTop=log.scrollHeight}catch{}});
  globalThis.CivweaveSavedChatUIV295?.render?.(activeSystem);
  return true;
}
function historyFor(system){return(readThread(system).messages||[]).filter(row=>!row.pending&&['user','assistant'].includes(row.role)).slice(-16).map(row=>({role:row.role,text:clean(row.text,6000)}))}
function deterministicReply(system,text){
  const value=clean(text,180),g=guide(system);
  if(system==='living-school')return`Moss kept this locally. For “${value}”, identify the capability, the smallest practice step, and the evidence that would prove it before shaping a Learning Journey.`;
  if(system==='cerbanimo')return`Kamiya kept this locally. For “${value}”, define the Endeavor's concrete deliverable, what counts as done, and the first verifiable dependency.`;
  if(system==='fellowfare')return`Rook kept this locally. For “${value}”, name the exact need or offer, timing, acceptable substitutes, and exchange boundary for the Manifest.`;
  if(system==='anarchadia')return`Merlin kept this locally. For “${value}”, name the proposed change, who it affects, and the reversible test for success.`;
  return`${g.name} kept this locally. For “${value}”, start with the Quest outcome you want, then separate what must be learned, built, acquired, or agreed.`;
}
function localFailure(system,selection,error){const message=clean(error?.message||error||'The selected local model did not complete.',900);return{text:`${guide(system).name} could not run the selected local model ${selection?.id||''}: ${message}`,provider:'local-model-error',model:selection?.id||'',error:message}}
async function fallbackReply(system,text){
  const selection=selectedLocal();
  try{await globalThis.CivweaveFamilyAILoaderV105?.ensure?.()}catch(error){if(selection)return localFailure(system,selection,error)}
  const runtime=globalThis.CivweaveModelRuntime;
  if(typeof runtime?.generate==='function')try{
    const result=await runtime.generate({purpose:`${system}-guide-chat-v350`,executionProfile:'interactive',config:selection?{provider:'downloaded-local',route:'downloaded-local',model:selection.id,externalConsent:false}:undefined,messages:[{role:'system',content:`You are ${guide(system).name}, ${guide(system).role}. Give a useful concise response while preserving user control.`},...historyFor(system).slice(-10).map(row=>({role:row.role,content:row.text})),{role:'user',content:text}],deterministic:()=>deterministicReply(system,text),fallback:()=>deterministicReply(system,text)});
    const output=clean(result?.outputText||result?.text||result?.output||result?.response,10000),provider=result?.actual?.provider||result?.provider||result?.requested?.provider||'model-runtime',model=result?.actual?.model||result?.model||result?.requested?.model||'';
    if(selection&&!output)throw new Error('The selected downloaded-local route returned no text.');
    return{text:output||deterministicReply(system,text),provider,model};
  }catch(error){if(selection)return localFailure(system,selection,error)}
  if(selection)return localFailure(system,selection,'The selected downloaded-local runtime is unavailable.');
  return{text:deterministicReply(system,text),provider:'deterministic-local',model:''};
}
function explicitHandoffTarget(result,system){const target=clean(result?.handoff?.targetSystem||result?.handoffSystem||result?.response?.handoffSystem,80);return SYSTEMS.includes(target)&&target!==system?target:''}
async function submitActive(text){
  const value=clean(text),system=activeSystem;if(!value||busy||!SYSTEMS.includes(system))return false;
  busy=true;ensureRoot();const button=root.querySelector('[data-send]'),input=root.querySelector('textarea');if(button)button.disabled=true;if(input)input.value='';
  append(system,{role:'user',text:value});const pendingId=uid('pending');append(system,{id:pendingId,role:'assistant',guide:system,text:`${guide(system).name} is thinking…`,pending:true});render();emitAvatar(system,'',value,'thinking');
  try{
    await globalThis.CivweaveFamilyAILoaderV105?.ensure?.();const assistant=globalThis.CivweaveAssistantV141;if(!assistant?.respond)throw new Error('Shared assistant runtime is not ready.');
    const result=await assistant.respond({text:value,systemId:system,handoffSystem:system!==pageSystem?system:undefined,history:historyFor(system)});
    const thread=readThread(system),index=(thread.messages||[]).findIndex(row=>row.id===pendingId),next=clean(result?.response?.choice?.nextAction,1200),replacement={role:'assistant',guide:system,responderSystem:system,text:[clean(result?.response?.answer,10000),next?`Next: ${next}`:''].filter(Boolean).join('\n\n'),provider:result?.provider,model:result?.model,chargedNeurons:Number(result?.usage?.chargedNeurons)||0,remainingNeurons:Number.isFinite(Number(result?.usage?.remainingNeurons))?Number(result.usage.remainingNeurons):null,approximateTurnsLeft:Number.isFinite(Number(result?.usage?.approximateTurnsLeft))?Number(result.usage.approximateTurnsLeft):null,responseRouting:result?.responseRouting||null,semanticRoute:result?.context?.routingAnswer||null,approvalGate:result?.response?.approvalGate||null,planSnapshot:result?.plan?clone(result.plan):null,actionSnapshot:result?.action?clone(result.action):null};
    if(index>=0)thread.messages[index]=replacement;else thread.messages.push(replacement);writeThread(system,thread);emitAvatar(system,replacement.text,value,'response');const target=explicitHandoffTarget(result,system);if(target)await realmApi()?.createHandover?.(system,target,result);
  }catch(error){
    const fallback=await fallbackReply(system,value),thread=readThread(system),index=(thread.messages||[]).findIndex(row=>row.id===pendingId),replacement={role:'assistant',guide:system,responderSystem:system,text:fallback.text,provider:fallback.provider,model:fallback.model||'',recoveredBy:'guide-chat-surface-v350',modelError:fallback.error||clean(error?.message||error,900)};if(index>=0)thread.messages[index]=replacement;else thread.messages.push(replacement);writeThread(system,thread);if(fallback.provider==='local-model-error'){try{dispatchEvent(new CustomEvent('civweave:chat-model-failed',{detail:{system,model:fallback.model,message:fallback.error||replacement.modelError}}))}catch{}}else emitAvatar(system,replacement.text,value,'response');
  }finally{busy=false;if(button)button.disabled=false;render();emitState()}
  return true;
}
function switchGuide(system,options={}){
  if(!SYSTEMS.includes(system))return false;activeSystem=system;
  const shouldOpen=options.open===true||(openState&&options.open!==false);
  if(shouldOpen){ensureRoot();openState=true;minimized=false;root.hidden=false;markSeen(system);syncChrome();render();if(options.focus)queueMicrotask(()=>root.querySelector('textarea')?.focus?.({preventScroll:true}));emitOpened()}
  else if(root){syncChrome();render()}
  saveState();emitState();return true;
}
function open(options={}){
  const target=SYSTEMS.includes(options.guide)?options.guide:activeSystem;activeSystem=target;ensureRoot();openState=true;minimized=false;root.hidden=false;
  if(options.prefill){const input=root.querySelector('textarea');if(input)input.value=clean(options.prefill)}markSeen(target);syncChrome();render();if(options.focus!==false)queueMicrotask(()=>root.querySelector('textarea')?.focus?.({preventScroll:true}));saveState();emitState();emitOpened();return true;
}
function close(){if(!root)return false;markSeen(activeSystem);openState=false;minimized=false;root.hidden=true;saveState();emitState();return true}
function minimize(){return close()}
function openWindow(system,options={}){return open({guide:system,...options})}
function closeWorkspace(){return close()}
function activeWindow(){return activeSystem}
async function submitText(text,system=activeSystem){if(SYSTEMS.includes(system)&&system!==activeSystem)switchGuide(system,{open:false});return submitActive(text)}
function start(){
  pageSystem=detectSystem();activeSystem=pageSystem;installStyle();restoreState();ensureLauncher();syncChrome();openState=false;minimized=false;
  addEventListener('civweave:realm-guide-thread-changed',()=>{if(root)queueMicrotask(()=>{if(openState)markSeen(activeSystem);syncSwitcher()})});
  document.documentElement.dataset.civweaveGuideSurface='guide-chat-v350';
  document.documentElement.dataset.civweaveGuideArtifactLanguage='canonical-v1';
  try{dispatchEvent(new CustomEvent('civweave:guide-chat-ready',{detail:state()}));dispatchEvent(new CustomEvent('civweave:persistent-guide-chat-ready',{detail:state()}));dispatchEvent(new CustomEvent('civweave:guide-workspace-ready',{detail:{...state(),compatibilityEventOnly:true}}))}catch{}
}

const api=Object.freeze({version:VERSION,canonicalOwner:true,presentationOwner:'guide-chat-surface-v350',retiredWorkspaceView:true,systems:Object.freeze([...SYSTEMS]),guideFor:system=>GUIDE[system]||null,state,open,close,minimize,switchGuide,openWindow,closeWorkspace,activeWindow,submitText,render,ensureRoot,ensureLauncher,hasUnread,selectedLocal,artifactLanguage:'Weaveling=Quest; Moss=Learning Journey; Kamiya=Endeavor; Rook=Manifest'});
globalThis.CivweaveGuideChatSurfaceV350=api;
globalThis.CivweavePersistentGuideChatV215=api;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();