(()=>{
'use strict';

const VERSION='1.0.164-guide-chat-surface-v350-voice-v1';
const ROOT_ID='cw-persistent-guide-chat-v215';
const LAUNCHER_ID='cwp215-launcher';
const STYLE_ID='cw-guide-chat-surface-v350-style';
const STATE_KEY='civweave.guide-chat-surface.v350';
const RETIRED_STATE_KEY='civweave.guide-workspace.v242';
const LOCAL_SELECTION_KEY='civweave.local-ai.selection.v266';
const VOICE_PREFS_KEY='civweave.guide-chat.voice.v1';
const SYSTEMS=['civweave','living-school','cerbanimo','fellowfare','anarchadia'];
const GUIDE=Object.freeze({
  civweave:{name:'Weaveling',label:'Civweave',role:'Central mirror and orchestrator',avatar:'/app/assets/ai/chat/weaveling-face-v255.webp',accent:'#d8dde7',panel:'#111827',placeholder:'Message Weaveling'},
  'living-school':{name:'Moss',label:'Living School',role:'Learning guide',avatar:'/app/assets/ai/chat/moss-face-v255.webp',accent:'#59cf87',panel:'#17342c',placeholder:'Message Moss'},
  cerbanimo:{name:'Kamiya',label:'Cerbanimo',role:'Questwright and skilled-work guide',avatar:'/app/assets/ai/chat/kamiya-face-v255.webp',accent:'#ff54d3',panel:'#170824',placeholder:'Message Kamiya'},
  fellowfare:{name:'Rook',label:'FellowFare',role:'Quartermaster and exchange guide',avatar:'/app/assets/ai/chat/rook-face-v255.webp',accent:'#f2a93b',panel:'#2c1b17',placeholder:'Message Rook'},
  anarchadia:{name:'Merlin',label:'Anarchadia',role:'Civic and automation guide',avatar:'/app/assets/ai/chat/merlin-face-v255.webp',accent:'#ff4f9a',panel:'#090909',placeholder:'Message Merlin'}
});
if(globalThis.CivweaveGuideChatSurfaceV350?.version===VERSION)return;

const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const clone=value=>{try{return typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value))}catch{return value}};
const now=()=>new Date().toISOString();
const uid=prefix=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const recognitionCtor=()=>globalThis.SpeechRecognition||globalThis.webkitSpeechRecognition||null;
const voiceDefaults=()=>({schema:'civweave.guide-chat.voice.v1',autoSpeak:false,rate:1,language:clean(document.documentElement?.lang||navigator.language||'en-US',40)||'en-US',voiceURI:''});
let pageSystem='civweave';
let activeSystem='civweave';
let openState=false;
let minimized=false;
let busy=false;
let seen={};
let root=null;
let launcher=null;
let recognition=null;
let listening=false;
let speaking=false;
let voiceTranscript='';
let voicePrefs=readVoicePrefs();

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
function readVoicePrefs(){
  const defaults=voiceDefaults();
  try{const saved=parse(localStorage.getItem(VOICE_PREFS_KEY),{});return{...defaults,...saved,rate:Math.min(2,Math.max(.6,Number(saved?.rate)||defaults.rate)),language:clean(saved?.language||defaults.language,40),voiceURI:clean(saved?.voiceURI,240),autoSpeak:Boolean(saved?.autoSpeak)}}catch{return defaults}
}
function saveVoicePrefs(){try{localStorage.setItem(VOICE_PREFS_KEY,JSON.stringify({...voicePrefs,updatedAt:now()}))}catch{}}
function voiceSupport(){return Object.freeze({speechRecognition:Boolean(recognitionCtor()),speechSynthesis:Boolean(globalThis.speechSynthesis&&globalThis.SpeechSynthesisUtterance)})}
function voiceState(){return Object.freeze({supported:voiceSupport(),listening,speaking,preferences:Object.freeze({...voicePrefs})})}
function state(){return Object.freeze({version:VERSION,pageSystem,activeWindow:activeSystem,activeSystem,open:openState,minimized,busy,canonicalOwner:true,presentation:'single-current-chat-surface',selectedLocalModel:selectedLocal()?.id||'',voice:voiceState()})}
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
function emitVoice(type,detail={}){try{dispatchEvent(new CustomEvent(`civweave:guide-voice-${type}`,{detail:{system:activeSystem,...voiceState(),...detail}}))}catch{}}
function guide(system=activeSystem){return GUIDE[system]||GUIDE.civweave}

function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
#${LAUNCHER_ID}{position:fixed;z-index:2147483611;right:max(12px,env(safe-area-inset-right));bottom:calc(var(--cw-themed-nav-height,64px) + env(safe-area-inset-bottom) + 12px);width:60px;height:60px;padding:0;border:1px solid color-mix(in srgb,var(--guide-accent,#d8dde7) 64%,transparent);border-radius:50%;overflow:hidden;background:#07111f;box-shadow:0 10px 30px #0009,0 0 20px color-mix(in srgb,var(--guide-accent,#d8dde7) 34%,transparent);cursor:pointer;appearance:none;-webkit-appearance:none}
#${LAUNCHER_ID} img{display:block;width:100%;height:100%;object-fit:cover}
#${ROOT_ID}{--guide-accent:#d8dde7;--guide-panel:#111827;position:fixed;z-index:2147483612;right:max(12px,env(safe-area-inset-right));bottom:calc(var(--cw-themed-nav-height,64px) + env(safe-area-inset-bottom) + 12px);width:min(520px,calc(100vw - 24px));height:min(72dvh,720px);display:grid;grid-template-rows:auto auto auto minmax(0,1fr) auto;overflow:hidden;border:1px solid color-mix(in srgb,var(--guide-accent) 46%,transparent);border-radius:20px;background:var(--guide-panel);color:#f8fbff;box-shadow:0 24px 80px #000b;font:15px/1.45 Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color-scheme:dark;isolation:isolate;contain:layout paint style}
#${ROOT_ID}[hidden]{display:none!important}#${ROOT_ID} *{box-sizing:border-box}
#${ROOT_ID}>header{display:grid;grid-template-columns:48px minmax(0,1fr) 40px 40px;align-items:center;gap:8px;padding:10px 11px calc(10px + env(safe-area-inset-top));border-bottom:1px solid color-mix(in srgb,var(--guide-accent) 34%,transparent);background:color-mix(in srgb,var(--guide-panel) 88%,#fff 4%)}
#${ROOT_ID}>header img{width:48px;height:48px;border:2px solid var(--guide-accent);border-radius:14px;object-fit:cover}#${ROOT_ID}>header div{min-width:0}#${ROOT_ID}>header strong,#${ROOT_ID}>header span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#${ROOT_ID}>header strong{font-size:1rem}#${ROOT_ID}>header span{margin-top:2px;color:#b9c6d8;font-size:.72rem}
#${ROOT_ID} [data-close],#${ROOT_ID} [data-auto-speak]{width:40px;height:40px;border:1px solid color-mix(in srgb,var(--guide-accent) 40%,transparent);border-radius:10px;background:#ffffff0c;color:#fff;font-size:18px;font-weight:900}#${ROOT_ID} [data-auto-speak][aria-pressed="true"]{background:color-mix(in srgb,var(--guide-accent) 26%,#111827);box-shadow:0 0 12px color-mix(in srgb,var(--guide-accent) 32%,transparent)}#${ROOT_ID} [data-auto-speak][data-speaking="true"]{animation:cw350-pulse 1s ease-in-out infinite alternate}
#${ROOT_ID} .cw242-window-switcher{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;padding:8px 9px 9px;border-bottom:1px solid #ffffff18;background:#0003}
#${ROOT_ID} .cw242-window{position:relative;min-width:0;display:grid;justify-items:center;gap:3px;padding:5px 2px;border:1px solid transparent;border-radius:12px;background:transparent;color:#aebbc9;cursor:pointer}
#${ROOT_ID} .cw242-window img{width:52px;height:52px;border-radius:14px;object-fit:cover;border:2px solid var(--window-accent);filter:saturate(.72) brightness(.8);box-shadow:0 3px 12px #0007}#${ROOT_ID} .cw242-window span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px;font-weight:850}
#${ROOT_ID} .cw242-window[aria-pressed="true"]{border-color:color-mix(in srgb,var(--window-accent) 58%,transparent);background:color-mix(in srgb,var(--window-accent) 12%,transparent);color:#fff}#${ROOT_ID} .cw242-window[aria-pressed="true"] img{filter:none;box-shadow:0 0 16px color-mix(in srgb,var(--window-accent) 58%,transparent),0 3px 12px #0009}
#${ROOT_ID} .cw242-window[data-here="true"]::before{content:"";position:absolute;left:6px;top:6px;width:7px;height:7px;border-radius:50%;background:var(--window-accent);box-shadow:0 0 8px var(--window-accent)}#${ROOT_ID} .cw242-unread{position:absolute;right:7px;top:6px;width:10px;height:10px;border:2px solid #08111d;border-radius:50%;background:var(--window-accent);box-shadow:0 0 9px var(--window-accent)}#${ROOT_ID} .cw242-unread[hidden]{display:none!important}
#${ROOT_ID} .cw350-context{padding:7px 11px;border-bottom:1px solid #ffffff12;color:#9fb0c3;font-size:11px;background:#0002}#${ROOT_ID} [data-log]{min-height:0;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:10px;overscroll-behavior:contain;touch-action:pan-y;-webkit-overflow-scrolling:touch}#${ROOT_ID} [data-log]:empty::before{content:'Start a conversation';margin:auto;color:#71839a;font-weight:750}
#${ROOT_ID} article{display:grid;grid-template-columns:32px minmax(0,1fr);gap:8px;align-items:start}#${ROOT_ID} article.is-user{display:flex;justify-content:flex-end;padding-left:42px}#${ROOT_ID} article>img{width:32px;height:32px;border:1px solid var(--guide-accent);border-radius:10px;object-fit:cover}#${ROOT_ID} .cw350-bubble{max-width:88%;padding:9px 11px;border:1px solid #ffffff18;border-radius:13px;background:#ffffff0b;white-space:pre-wrap;overflow-wrap:anywhere}#${ROOT_ID} .is-user .cw350-bubble{background:color-mix(in srgb,var(--guide-accent) 16%,#ffffff08);border-color:color-mix(in srgb,var(--guide-accent) 42%,transparent)}#${ROOT_ID} .cw350-meta{margin-top:5px;color:#8394aa;font-size:10px}
#${ROOT_ID} [data-persistent-form]{display:grid;grid-template-columns:minmax(0,1fr) 46px auto;grid-template-areas:'input mic send' 'status status status';gap:7px;padding:10px max(10px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom)) max(10px,env(safe-area-inset-left));border-top:1px solid color-mix(in srgb,var(--guide-accent) 32%,transparent);background:#0002}#${ROOT_ID} textarea{grid-area:input;min-width:0;width:100%;min-height:54px;max-height:min(28dvh,180px);resize:none;border:1px solid #ffffff22;border-radius:12px;padding:11px;background:#050b15;color:#fff;font:inherit}#${ROOT_ID} [data-mic]{grid-area:mic;width:46px;min-height:54px;border:1px solid #ffffff2a;border-radius:12px;background:#ffffff0b;color:#fff;font-size:20px}#${ROOT_ID} [data-mic][aria-pressed="true"]{border-color:var(--guide-accent);background:color-mix(in srgb,var(--guide-accent) 24%,#101827);box-shadow:0 0 14px color-mix(in srgb,var(--guide-accent) 42%,transparent);animation:cw350-pulse .7s ease-in-out infinite alternate}#${ROOT_ID} [data-send]{grid-area:send;min-width:76px;border:1px solid var(--guide-accent);border-radius:12px;padding:0 14px;background:color-mix(in srgb,var(--guide-accent) 28%,#182334);color:#fff;font:900 14px/1 system-ui}#${ROOT_ID} [data-voice-status]{grid-area:status;min-height:14px;color:#9fb0c3;font-size:10px;padding:0 2px}#${ROOT_ID} button{cursor:pointer}#${ROOT_ID} button:disabled{cursor:not-allowed;opacity:.45}
@keyframes cw350-pulse{from{filter:brightness(.9)}to{filter:brightness(1.35)}}
@media(max-width:720px){#${ROOT_ID}{position:fixed;inset:0;width:100vw;height:100dvh;max-width:none;max-height:100dvh;border:0;border-radius:0;grid-template-rows:auto auto auto minmax(0,1fr) auto}#${ROOT_ID}>header{grid-template-columns:44px minmax(0,1fr) 40px 40px;padding-top:calc(7px + env(safe-area-inset-top))}#${ROOT_ID}>header img{width:44px;height:44px}#${ROOT_ID} .cw242-window-switcher{gap:4px;padding:7px 5px 8px}#${ROOT_ID} .cw242-window img{width:48px;height:48px;border-radius:12px}#${LAUNCHER_ID}{width:56px;height:56px}}
@media(max-width:390px){#${ROOT_ID} .cw242-window-switcher{gap:2px;padding-left:3px;padding-right:3px}#${ROOT_ID} .cw242-window img{width:44px;height:44px}#${ROOT_ID} [data-send]{min-width:66px;padding:0 10px}}
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
  root.innerHTML=`<header><img data-guide-avatar alt=""><div><strong data-guide-name></strong><span data-guide-role></span></div><button data-auto-speak type="button" aria-label="Speak guide replies" aria-pressed="false" title="Speak guide replies">🔊</button><button data-close type="button" aria-label="Close chat">×</button></header><nav class="cw242-window-switcher" aria-label="Guide chats">${switcherMarkup()}</nav><div class="cw350-context" data-context></div><div data-log role="log" aria-live="polite"></div><form data-persistent-form><textarea rows="2" maxlength="12000" required></textarea><button data-mic type="button" aria-label="Start voice input" aria-pressed="false" title="Voice input">🎙</button><button data-send type="submit">Send</button><div data-voice-status role="status" aria-live="polite"></div></form>`;
  root.querySelector('[data-close]').addEventListener('click',close);
  root.querySelector('[data-auto-speak]').addEventListener('click',toggleAutoSpeak);
  root.querySelector('[data-mic]').addEventListener('click',toggleListening);
  root.querySelector('.cw242-window-switcher').addEventListener('click',event=>{const button=event.target.closest?.('[data-cw242-window]');if(button)switchGuide(button.dataset.cw242Window,{open:true,focus:true})});
  root.querySelector('[data-persistent-form]').addEventListener('submit',event=>{event.preventDefault();const input=event.currentTarget.querySelector('textarea'),text=clean(input?.value);if(!text)return;void submitActive(text,{inputMode:'text'})});
  root.querySelector('textarea').addEventListener('keydown',()=>{if(speaking)stopSpeaking({reason:'typing'})});
  root.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();if(listening)stopListening({submit:false});else if(speaking)stopSpeaking({reason:'escape'});else close()}});
  if(!root.isConnected)document.body.append(root);
  syncChrome();render();return root;
}
function voiceStatus(message=''){
  if(!root)return;const status=root.querySelector('[data-voice-status]');if(status)status.textContent=clean(message,240);
}
function syncVoiceControls(){
  if(!root)return;
  const support=voiceSupport(),mic=root.querySelector('[data-mic]'),speaker=root.querySelector('[data-auto-speak]');
  if(mic){mic.hidden=!support.speechRecognition;mic.disabled=busy||!support.speechRecognition;mic.setAttribute('aria-pressed',listening?'true':'false');mic.setAttribute('aria-label',listening?'Stop voice input':'Start voice input');mic.title=listening?'Stop listening':'Voice input'}
  if(speaker){speaker.hidden=!support.speechSynthesis;speaker.setAttribute('aria-pressed',voicePrefs.autoSpeak?'true':'false');speaker.dataset.speaking=speaking?'true':'false';speaker.setAttribute('aria-label',speaking?'Stop speaking':voicePrefs.autoSpeak?'Disable spoken replies':'Enable spoken replies');speaker.title=speaking?'Stop speaking':voicePrefs.autoSpeak?'Spoken replies on':'Spoken replies off'}
  if(!support.speechRecognition&&!support.speechSynthesis)voiceStatus('Voice is unavailable in this browser. Text chat remains available.');
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
  syncSwitcher();syncVoiceControls();
}
function render(){
  if(!root)return false;syncChrome();const log=root.querySelector('[data-log]');if(!log)return false;
  const messages=Array.isArray(readThread(activeSystem).messages)?readThread(activeSystem).messages:[];
  log.innerHTML=messages.map(row=>{
    const user=row?.role==='user',who=GUIDE[row?.guide||row?.responderSystem||activeSystem]||guide(activeSystem),meta=[row?.provider,row?.model].filter(Boolean).join(' · '),pending=Boolean(row?.pending);
    if(user)return`<article class="is-user" data-role="user" data-message-role="user" data-pending="false"><div class="cw350-bubble">${esc(row.text||'')}</div></article>`;
    return`<article data-role="assistant" data-message-role="assistant" data-pending="${pending?'true':'false'}" class="${pending?'cw-ai-pending':''}"><img src="${esc(who.avatar)}" alt="${esc(who.name)}"><div><div class="cw350-bubble">${esc(row.text||'')}</div>${meta?`<div class="cw350-meta">${esc(meta)}</div>`:''}</div></article>`;
  }).join('');
  if(openState)markSeen(activeSystem);syncSwitcher();syncVoiceControls();
  requestAnimationFrame(()=>{try{log.scrollTop=log.scrollHeight}catch{}});
  globalThis.CivweaveSavedChatUIV295?.render?.(activeSystem);
  return true;
}
function historyFor(system){return(readThread(system).messages||[]).filter(row=>!row.pending&&['user','assistant'].includes(row.role)).slice(-16).map(row=>({role:row.role,text:clean(row.text,6000)}))}
function deterministicReply(system,text){
  const value=clean(text,180),g=guide(system);
  if(system==='living-school')return`Moss kept this locally. For “${value}”, identify the skill, the smallest practice step, and the evidence that would prove it.`;
  if(system==='cerbanimo')return`Kamiya kept this locally. For “${value}”, define the concrete deliverable, what counts as done, and the first verifiable dependency.`;
  if(system==='fellowfare')return`Rook kept this locally. For “${value}”, name the exact need or offer, timing, acceptable substitutes, and exchange boundary.`;
  if(system==='anarchadia')return`Merlin kept this locally. For “${value}”, name the proposed change, who it affects, and the reversible test for success.`;
  return`${g.name} kept this locally. For “${value}”, start with the outcome you want, then separate what must be learned, built, acquired, or agreed.`;
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
function pickSpeechVoice(){
  const synth=globalThis.speechSynthesis;if(!synth?.getVoices)return null;const voices=synth.getVoices()||[];
  if(voicePrefs.voiceURI){const exact=voices.find(item=>item.voiceURI===voicePrefs.voiceURI);if(exact)return exact}
  const lang=clean(voicePrefs.language,40).toLowerCase();return voices.find(item=>clean(item.lang,40).toLowerCase()===lang)||voices.find(item=>clean(item.lang,40).toLowerCase().split('-')[0]===lang.split('-')[0])||null;
}
function stopSpeaking({reason='manual'}={}){
  if(globalThis.speechSynthesis)try{globalThis.speechSynthesis.cancel()}catch{}
  const changed=speaking;speaking=false;syncVoiceControls();if(changed)emitVoice('speech-ended',{reason});return changed;
}
function speakText(text,{system=activeSystem,force=false}={}){
  const support=voiceSupport(),value=clean(text,10000);if(!support.speechSynthesis||!value||(!force&&!voicePrefs.autoSpeak))return false;
  stopSpeaking({reason:'replace'});const utterance=new SpeechSynthesisUtterance(value);utterance.rate=voicePrefs.rate;utterance.lang=voicePrefs.language||navigator.language||'en-US';const selected=pickSpeechVoice();if(selected)utterance.voice=selected;
  utterance.onstart=()=>{speaking=true;syncVoiceControls();emitVoice('speech-started',{system})};
  utterance.onend=()=>{speaking=false;syncVoiceControls();emitVoice('speech-ended',{system,reason:'complete'})};
  utterance.onerror=event=>{speaking=false;syncVoiceControls();emitVoice('speech-error',{system,error:clean(event?.error||'speech-synthesis-error',120)})};
  try{globalThis.speechSynthesis.speak(utterance);return true}catch{return false}
}
function maybeSpeak(system,text){if(openState&&activeSystem===system&&voicePrefs.autoSpeak)speakText(text,{system})}
function setVoicePreferences(next={}){
  const prefs={...voicePrefs};
  if(Object.prototype.hasOwnProperty.call(next,'autoSpeak'))prefs.autoSpeak=Boolean(next.autoSpeak);
  if(Object.prototype.hasOwnProperty.call(next,'rate'))prefs.rate=Math.min(2,Math.max(.6,Number(next.rate)||1));
  if(Object.prototype.hasOwnProperty.call(next,'language'))prefs.language=clean(next.language,40)||prefs.language;
  if(Object.prototype.hasOwnProperty.call(next,'voiceURI'))prefs.voiceURI=clean(next.voiceURI,240);
  voicePrefs=prefs;saveVoicePrefs();syncVoiceControls();emitVoice('preferences',{preferences:{...voicePrefs}});return voiceState();
}
function toggleAutoSpeak(){
  if(speaking){stopSpeaking({reason:'speaker-button'});return}
  setVoicePreferences({autoSpeak:!voicePrefs.autoSpeak});voiceStatus(voicePrefs.autoSpeak?'Spoken replies are on.':'Spoken replies are off.');
}
function clearRecognition(){
  if(!recognition)return;recognition.onstart=null;recognition.onresult=null;recognition.onerror=null;recognition.onend=null;recognition=null;
}
function startListening(){
  const Ctor=recognitionCtor();if(!Ctor){voiceStatus('Voice input is unavailable in this browser.');return false}
  if(busy){voiceStatus('Wait for the current reply before starting voice input.');return false}
  if(listening)return true;
  stopSpeaking({reason:'barge-in'});clearRecognition();voiceTranscript='';
  const rec=new Ctor();recognition=rec;rec.continuous=false;rec.interimResults=true;rec.maxAlternatives=1;rec.lang=voicePrefs.language||navigator.language||'en-US';
  rec.onstart=()=>{listening=true;voiceTranscript='';voiceStatus('Listening… tap the microphone again to finish.');syncVoiceControls();emitVoice('listening-started')};
  rec.onresult=event=>{
    let finalText='',interimText='';for(let index=event.resultIndex;index<event.results.length;index++){const result=event.results[index],text=clean(result?.[0]?.transcript,12000);if(result?.isFinal)finalText+=`${text} `;else interimText+=`${text} `}
    if(finalText)voiceTranscript=clean(`${voiceTranscript} ${finalText}`,12000);
    const visible=clean(`${voiceTranscript} ${interimText}`,12000),input=root?.querySelector('textarea');if(input&&visible)input.value=visible;
    emitVoice('transcript',{final:Boolean(finalText),text:visible});
  };
  rec.onerror=event=>{const error=clean(event?.error||'voice-input-error',120);if(error!=='aborted')voiceStatus(error==='not-allowed'?'Microphone permission was not granted.':'Voice input stopped. You can continue by typing.');emitVoice('error',{error})};
  rec.onend=()=>{
    const submitted=clean(voiceTranscript||root?.querySelector('textarea')?.value,12000);listening=false;clearRecognition();syncVoiceControls();emitVoice('listening-ended',{text:submitted});
    if(submitted&&!busy){voiceStatus('Sending voice message…');void submitActive(submitted,{inputMode:'voice'})}else if(submitted)voiceStatus('Voice text is ready. Send it when the current reply finishes.');else voiceStatus('Voice input stopped.');
  };
  try{rec.start();return true}catch(error){clearRecognition();listening=false;voiceStatus('Voice input could not start.');emitVoice('error',{error:clean(error?.message||error,180)});syncVoiceControls();return false}
}
function stopListening({submit=true}={}){
  if(!recognition||!listening)return false;
  if(submit){try{recognition.stop()}catch{};return true}
  const rec=recognition;rec.onstart=null;rec.onresult=null;rec.onerror=null;rec.onend=null;recognition=null;listening=false;voiceTranscript='';
  try{rec.abort()}catch{}
  syncVoiceControls();emitVoice('listening-ended',{discarded:true,text:''});voiceStatus('Voice input stopped.');return true;
}
function toggleListening(){return listening?stopListening({submit:true}):startListening()}

async function submitActive(text,{inputMode='text'}={}){
  const value=clean(text),system=activeSystem;if(!value||busy||!SYSTEMS.includes(system))return false;
  if(listening)stopListening({submit:false});
  busy=true;ensureRoot();const button=root.querySelector('[data-send]'),input=root.querySelector('textarea');if(button)button.disabled=true;if(input)input.value='';syncVoiceControls();
  append(system,{role:'user',text:value,inputMode});const pendingId=uid('pending');append(system,{id:pendingId,role:'assistant',guide:system,text:`${guide(system).name} is thinking…`,pending:true});render();emitAvatar(system,'',value,'thinking');
  try{
    await globalThis.CivweaveFamilyAILoaderV105?.ensure?.();const assistant=globalThis.CivweaveAssistantV141;if(!assistant?.respond)throw new Error('Shared assistant runtime is not ready.');
    const result=await assistant.respond({text:value,systemId:system,handoffSystem:system!==pageSystem?system:undefined,history:historyFor(system)});
    const thread=readThread(system),index=(thread.messages||[]).findIndex(row=>row.id===pendingId),next=clean(result?.response?.choice?.nextAction,1200),replacement={role:'assistant',guide:system,responderSystem:system,text:[clean(result?.response?.answer,10000),next?`Next: ${next}`:''].filter(Boolean).join('\n\n'),provider:result?.provider,model:result?.model,chargedNeurons:Number(result?.usage?.chargedNeurons)||0,remainingNeurons:Number.isFinite(Number(result?.usage?.remainingNeurons))?Number(result.usage.remainingNeurons):null,approximateTurnsLeft:Number.isFinite(Number(result?.usage?.approximateTurnsLeft))?Number(result.usage.approximateTurnsLeft):null,responseRouting:result?.responseRouting||null,semanticRoute:result?.context?.routingAnswer||null,approvalGate:result?.response?.approvalGate||null,planSnapshot:result?.plan?clone(result.plan):null,actionSnapshot:result?.action?clone(result.action):null};
    if(index>=0)thread.messages[index]=replacement;else thread.messages.push(replacement);writeThread(system,thread);emitAvatar(system,replacement.text,value,'response');maybeSpeak(system,replacement.text);const target=explicitHandoffTarget(result,system);if(target)await realmApi()?.createHandover?.(system,target,result);
  }catch(error){
    const fallback=await fallbackReply(system,value),thread=readThread(system),index=(thread.messages||[]).findIndex(row=>row.id===pendingId),replacement={role:'assistant',guide:system,responderSystem:system,text:fallback.text,provider:fallback.provider,model:fallback.model||'',recoveredBy:'guide-chat-surface-v350',modelError:fallback.error||clean(error?.message||error,900)};if(index>=0)thread.messages[index]=replacement;else thread.messages.push(replacement);writeThread(system,thread);if(fallback.provider==='local-model-error'){try{dispatchEvent(new CustomEvent('civweave:chat-model-failed',{detail:{system,model:fallback.model,message:fallback.error||replacement.modelError}}))}catch{}}else emitAvatar(system,replacement.text,value,'response');maybeSpeak(system,replacement.text);
  }finally{busy=false;if(button)button.disabled=false;render();syncVoiceControls();emitState()}
  return true;
}
function switchGuide(system,options={}){
  if(!SYSTEMS.includes(system))return false;if(system!==activeSystem){if(listening)stopListening({submit:false});if(speaking)stopSpeaking({reason:'guide-switch'})}activeSystem=system;
  const shouldOpen=options.open===true||(openState&&options.open!==false);
  if(shouldOpen){ensureRoot();openState=true;minimized=false;root.hidden=false;markSeen(system);syncChrome();render();if(options.focus)queueMicrotask(()=>root.querySelector('textarea')?.focus?.({preventScroll:true}));emitOpened()}
  else if(root){syncChrome();render()}
  saveState();emitState();return true;
}
function open(options={}){
  const target=SYSTEMS.includes(options.guide)?options.guide:activeSystem;if(target!==activeSystem){if(listening)stopListening({submit:false});if(speaking)stopSpeaking({reason:'guide-switch'})}activeSystem=target;ensureRoot();openState=true;minimized=false;root.hidden=false;
  if(options.prefill){const input=root.querySelector('textarea');if(input)input.value=clean(options.prefill)}markSeen(target);syncChrome();render();if(options.focus!==false)queueMicrotask(()=>root.querySelector('textarea')?.focus?.({preventScroll:true}));saveState();emitState();emitOpened();return true;
}
function close(){if(!root)return false;if(listening)stopListening({submit:false});if(speaking)stopSpeaking({reason:'chat-close'});markSeen(activeSystem);openState=false;minimized=false;root.hidden=true;saveState();emitState();return true}
function minimize(){return close()}
function openWindow(system,options={}){return open({guide:system,...options})}
function closeWorkspace(){return close()}
function activeWindow(){return activeSystem}
async function submitText(text,system=activeSystem){if(SYSTEMS.includes(system)&&system!==activeSystem)switchGuide(system,{open:false});return submitActive(text,{inputMode:'text'})}
function start(){
  pageSystem=detectSystem();activeSystem=pageSystem;installStyle();restoreState();ensureLauncher();syncChrome();openState=false;minimized=false;
  addEventListener('civweave:realm-guide-thread-changed',()=>{if(root)queueMicrotask(()=>{if(openState)markSeen(activeSystem);syncSwitcher()})});
  addEventListener('pagehide',()=>{if(listening)stopListening({submit:false});if(speaking)stopSpeaking({reason:'pagehide'})});
  document.documentElement.dataset.civweaveGuideSurface='guide-chat-v350';
  try{dispatchEvent(new CustomEvent('civweave:guide-chat-ready',{detail:state()}));dispatchEvent(new CustomEvent('civweave:persistent-guide-chat-ready',{detail:state()}));dispatchEvent(new CustomEvent('civweave:guide-workspace-ready',{detail:{...state(),compatibilityEventOnly:true}}))}catch{}
}

const api=Object.freeze({version:VERSION,canonicalOwner:true,presentationOwner:'guide-chat-surface-v350',retiredWorkspaceView:true,systems:Object.freeze([...SYSTEMS]),guideFor:system=>GUIDE[system]||null,state,open,close,minimize,switchGuide,openWindow,closeWorkspace,activeWindow,submitText,render,ensureRoot,ensureLauncher,hasUnread,selectedLocal,voiceState,startListening,stopListening,speakText,stopSpeaking,setVoicePreferences});
globalThis.CivweaveGuideChatSurfaceV350=api;
globalThis.CivweavePersistentGuideChatV215=api;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
