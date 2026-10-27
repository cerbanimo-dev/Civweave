(()=>{
'use strict';

// Persistent content documents use the parent's exact chat object. They never
// create a second transcript, launcher, streaming owner, or chat lifecycle.
try{
  const host=globalThis.parent,query=new URLSearchParams(location.search);
  if(host&&host!==globalThis&&query.get('persistentShell')==='1'&&host.CivweavePersistentSystemShellV1){
    const attach=()=>{const api=host.CivweaveGuideChatSurfaceV350||host.CivweavePersistentGuideChatV215;if(!api?.canonicalOwner)return false;globalThis.CivweaveGuideChatSurfaceV350=api;globalThis.CivweavePersistentGuideChatV215=api;return true};
    if(!attach())host.addEventListener('civweave:guide-chat-ready',()=>{if(attach())dispatchEvent(new CustomEvent('civweave:guide-workspace-ready',{detail:{parentOwned:true}}))},{once:true});
    return;
  }
}catch{}

const VERSION='1.0.196-guide-chat-surface-v350-ai-lifecycle';
const ROOT_ID='cw-persistent-guide-chat-v215';
const LAUNCHER_ID='cwp215-launcher';
const STYLE_ID='cw-guide-chat-surface-v350-style';
const STATE_KEY='civweave.guide-chat-surface.v350';
const RETIRED_STATE_KEY='civweave.guide-workspace.v242';
const LOCAL_SELECTION_KEY='civweave.local-ai.selection.v266';
const SPECIALIZED_MODELS_PATH='/app/local-ai/specialized-model-capabilities-v1.js?v=1.0.0';
const VOICE_RUNTIME_VERSION='1.1.6-guide-voice-runtime-v1-parakeet-no-proxy-worker';
const VOICE_RUNTIME_PATH='/app/guide-voice-runtime-v1.js?v=1.1.6';
const SYSTEMS=['civweave','living-school','cerbanimo','fellowfare','anarchadia'];
const GUIDE=Object.freeze({
  civweave:{name:'Weaveling',label:'Civweave',role:'Quest guide and central orchestrator',avatar:'/app/assets/ai/chat/weaveling-face-v255.webp',accent:'#d8dde7',panel:'#111827',placeholder:'Message Weaveling about a Quest'},
  'living-school':{name:'Moss',label:'Living School',role:'Learning Journey guide',avatar:'/app/assets/ai/chat/moss-face-v255.webp',accent:'#59cf87',panel:'#17342c',placeholder:'Message Moss about a Learning Journey'},
  cerbanimo:{name:'Kamiya',label:'Cerbanimo',role:'Endeavor guide',avatar:'/app/assets/ai/chat/kamiya-face-v255.webp',accent:'#ff54d3',panel:'#170824',placeholder:'Message Kamiya about an Endeavor'},
  fellowfare:{name:'Rook',label:'FellowFare',role:'Manifest guide and Quartermaster',avatar:'/app/assets/ai/chat/rook-face-v255.webp',accent:'#f2a93b',panel:'#2c1b17',placeholder:'Message Rook about a Manifest'},
  anarchadia:{name:'Merlin',label:'Anarchadia',role:'Civic and automation guide',avatar:'/app/assets/ai/chat/merlin-face-v255.webp',accent:'#ff4f9a',panel:'#090909',placeholder:'Message Merlin'}
});
const GUIDE_ADDRESS=Object.freeze(Object.fromEntries(Object.entries(GUIDE).map(([system,item])=>[item.name.toLowerCase(),system])));
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
let nativeAbortController=null;
let seen={};
let root=null;
let launcher=null;
let voicePromise=null;
let voiceStatus='';

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
function configuredRoute(){
  try{
    const canonical=globalThis.CivweaveSettingsV320?.readState?.();
    if(canonical?.route||canonical?.provider)return String(canonical.route||canonical.provider).toLowerCase();
  }catch{}
  try{
    const profiles=parse(localStorage.getItem('civweave-model-profiles-v1'),{});
    const raw=profiles.interactive||parse(localStorage.getItem('civweave.universal-ai.v127'),{});
    return String(raw?.route||raw?.provider||'').toLowerCase();
  }catch{return''}
}
function selectedLocal(){
  try{
    // A saved downloaded-model ID is NOT authorization to run it if the
    // active route is Ollama, a native llama-server or any other provider.
    const route=configuredRoute();
    if(route&& !['downloaded-local','generative-local','local-ai','browser','qwen','smollm2','smollm3'].includes(route))return null;
    const gguf=parse(localStorage.getItem('civweave.mobile.gguf-primary.v2'),null);
    const profiles=parse(localStorage.getItem('civweave-model-profiles-v1'),{});
    const raw=profiles.interactive||parse(localStorage.getItem('civweave.universal-ai.v127'),{});
    if(gguf?.enabled&&gguf.engine==='wllama'&&raw?.model===gguf.model&&
       (raw?.provider==='openai-compatible'||raw?.route==='openai-compatible'))return null;
    const value=parse(localStorage.getItem(LOCAL_SELECTION_KEY),{});
    return value?.active&&value?.id?value:null;
  }catch{return null}
}
function nativeApiRoute(){
  const route=configuredRoute();
  return route==='openai-compatible'||route==='ollama'||route==='local-api';
}
function activeNativePhoneServer(){
  const route=configuredRoute();
  if(route!=='openai-compatible')return false;
  let state=null;
  try{state=globalThis.CivweaveSettingsV320?.readState?.()||null}catch{}
  if(!state){
    try{
      const profiles=parse(localStorage.getItem('civweave-model-profiles-v1'),{});
      state=profiles.interactive||parse(localStorage.getItem('civweave.universal-ai.v127'),{});
    }catch{}
  }
  return state?.model==='qwen35-4b-native'&&state?.endpoint==='http://127.0.0.1:8080/v1';
}
async function verifyNativePhoneServerTransport(){
  if(!activeNativePhoneServer())return false;
  // This fetch reads ONLY the model catalog. It cannot load GGUF weights or
  // initiate model inference; a browser CORS failure ends before AI bootstrap.
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),7000);
  try{
    const response=await fetch('http://127.0.0.1:8080/v1/models',{
      method:'GET',mode:'cors',credentials:'omit',cache:'no-store',signal:controller.signal
    });
    if(!response.ok)throw new Error('llama-server model catalog returned HTTP '+response.status);
    const body=await response.json(),models=Array.isArray(body?.data)?body.data:[];
    if(!models.some(row=>row?.id==='qwen35-4b-native'))
      throw new Error('llama-server responded, but qwen35-4b-native is not registered. Check --alias.');
    return true;
  }catch(error){
    const reason=controller.signal.aborted?'local browser-to-Termux probe timed out after 7 seconds':clean(error?.message||error,300);
    throw new Error('Native server connection failed before model loading: '+reason+'. Check /native-server-diagnostic.html in this browser; no secondary AI was started.');
  }finally{clearTimeout(timer)}
}
function voiceState(){try{return globalThis.CivweaveGuideVoiceV1?.state?.()||null}catch{return null}}
function state(){const voice=voiceState();return Object.freeze({version:VERSION,pageSystem,activeWindow:activeSystem,activeSystem,open:openState,minimized,busy,canonicalOwner:true,presentation:'single-current-chat-surface',selectedLocalModel:selectedLocal()?.id||'',voice:{loaded:Boolean(globalThis.CivweaveGuideVoiceV1),listening:Boolean(voice?.listening),source:voice?.source||'',status:voiceStatus}})}
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
function resolveGuideAddress(text,{allowBare=false}={}){
  const value=clean(text);if(!value)return{system:'',guide:'',text:'',addressed:false};
  const names=Object.keys(GUIDE_ADDRESS).join('|');
  const prefix=allowBare?'(?:(?:hey|hi|hello|ok|okay)\\s+)?':'(?:hey|hi|hello|ok|okay)\\s+';
  const match=value.match(new RegExp(`^\\s*${prefix}(${names})\\b[\\s,:;.!?-]*(.*)$`,'i'));
  if(!match)return{system:'',guide:'',text:value,addressed:false};
  const name=match[1].toLowerCase(),system=GUIDE_ADDRESS[name]||'';
  return{system,guide:name,text:clean(match[2]),addressed:Boolean(system)};
}
function loadScript(path,ready){
  if(ready?.())return Promise.resolve(true);
  const target=new URL(path,location.href),existing=[...document.scripts].find(script=>{try{return new URL(script.src,location.href).href===target.href}catch{return false}});
  if(existing)return new Promise((resolve,reject)=>{let elapsed=0;const timer=setInterval(()=>{elapsed+=50;if(ready?.()){clearInterval(timer);resolve(true)}else if(elapsed>=12000){clearInterval(timer);reject(new Error(`${target.pathname}${target.search} loaded without its runtime.`))}},50)});
  return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=target.href;script.async=false;script.onload=()=>ready?.()?resolve(true):reject(new Error(`${target.pathname}${target.search} loaded without its runtime.`));script.onerror=()=>reject(new Error(`Could not load ${target.pathname}${target.search}.`));document.head.append(script)});
}
async function ensureSpecializedRegistry(){await loadScript(SPECIALIZED_MODELS_PATH,()=>globalThis.CivweaveLocalSpecializedAI);return globalThis.CivweaveLocalSpecializedAI}
async function ensureVoiceRuntime(){
  const current=globalThis.CivweaveGuideVoiceV1;
  if(current?.version===VOICE_RUNTIME_VERSION)return current;
  if(voicePromise)return voicePromise;
  if(current)try{current.stop?.()}catch{}
  voiceStatus='Loading offline voice…';syncChrome();
  voicePromise=(async()=>{
    await ensureSpecializedRegistry();
    await loadScript(VOICE_RUNTIME_PATH,()=>globalThis.CivweaveGuideVoiceV1?.version===VOICE_RUNTIME_VERSION);
    const voice=globalThis.CivweaveGuideVoiceV1;
    if(voice?.version!==VOICE_RUNTIME_VERSION)throw new Error('Corrected offline voice runtime did not load.');
    voiceStatus='';syncChrome();return voice;
  })().catch(error=>{voicePromise=null;voiceStatus=clean(error?.message||error,240);syncChrome();throw error});
  return voicePromise;
}
async function toggleVoice(){
  try{const voice=await ensureVoiceRuntime();voiceStatus='';await voice.toggle?.({guide:activeSystem});syncChrome();emitState();return Boolean(voice.state?.().listening)}catch(error){voiceStatus=clean(error?.message||error||'Offline voice is unavailable.',300);syncChrome();emitState();return false}
}

function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
#${LAUNCHER_ID}{position:fixed;z-index:2147483611;right:max(12px,env(safe-area-inset-right));bottom:calc(var(--cw-themed-nav-height,64px) + env(safe-area-inset-bottom) + 12px);width:60px;height:60px;padding:0;border:1px solid color-mix(in srgb,var(--guide-accent,#d8dde7) 64%,transparent);border-radius:50%;overflow:hidden;background:#07111f;box-shadow:0 10px 30px #0009,0 0 20px color-mix(in srgb,var(--guide-accent,#d8dde7) 34%,transparent);cursor:pointer;appearance:none;-webkit-appearance:none}
#${LAUNCHER_ID} img{display:block;width:100%;height:100%;object-fit:cover}
body:has(#${ROOT_ID}:not([hidden])) #${LAUNCHER_ID},body:has(#${ROOT_ID}:not([hidden])) #cw-human-message-launcher-v1{visibility:hidden!important;pointer-events:none!important}
#${ROOT_ID}{--guide-accent:#d8dde7;--guide-panel:#111827;position:fixed;z-index:2147483612;right:max(12px,env(safe-area-inset-right));bottom:calc(var(--cw-themed-nav-height,64px) + env(safe-area-inset-bottom) + 12px);width:min(520px,calc(100vw - 24px));height:min(720px,calc(100dvh - var(--cw-themed-nav-height,64px) - env(safe-area-inset-bottom) - 28px));display:flex;flex-direction:column;overflow:hidden;border:1px solid color-mix(in srgb,var(--guide-accent) 46%,transparent);border-radius:20px;background:var(--guide-panel);color:#f8fbff;box-shadow:0 24px 80px #000b;font:15px/1.45 Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color-scheme:dark;isolation:isolate;contain:layout paint style}
#${ROOT_ID}[hidden]{display:none!important}#${ROOT_ID} *{box-sizing:border-box}#${ROOT_ID}>header,#${ROOT_ID}>.cw242-window-switcher,#${ROOT_ID}>.cw350-context,#${ROOT_ID}>[data-persistent-form]{flex:0 0 auto}#${ROOT_ID}>[data-log]{flex:1 1 0}
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
#${ROOT_ID} .cw350-artifact-gate{margin-top:9px;padding:10px;border:1px solid color-mix(in srgb,var(--guide-accent) 42%,transparent);border-radius:12px;background:#0002}#${ROOT_ID} .cw350-artifact-gate strong,#${ROOT_ID} .cw350-artifact-gate span{display:block}#${ROOT_ID} .cw350-artifact-gate span{margin-top:3px;color:#becada;font-size:12px}#${ROOT_ID} .cw350-artifact-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}#${ROOT_ID} .cw350-artifact-actions button{min-height:42px;padding:9px 12px;border:1px solid var(--guide-accent);border-radius:10px;background:color-mix(in srgb,var(--guide-accent) 22%,#182334);color:#fff;font:750 13px/1.2 system-ui;cursor:pointer}#${ROOT_ID} .cw350-artifact-actions button:focus-visible{outline:3px solid #fff;outline-offset:3px}
#${ROOT_ID} [data-persistent-form]{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;padding:10px max(10px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom)) max(10px,env(safe-area-inset-left));border-top:1px solid color-mix(in srgb,var(--guide-accent) 32%,transparent);background:#0002}#${ROOT_ID} textarea{min-width:0;width:100%;min-height:54px;max-height:min(28dvh,180px);resize:none;border:1px solid #ffffff22;border-radius:12px;padding:11px;background:#050b15;color:#fff;font:inherit;caret-color:var(--guide-accent);outline:none}#${ROOT_ID} textarea:focus,#${ROOT_ID} textarea:focus-visible{border-color:var(--guide-accent)!important;outline:3px solid color-mix(in srgb,var(--guide-accent) 88%,#fff 12%)!important;outline-offset:2px;box-shadow:0 0 0 1px color-mix(in srgb,var(--guide-accent) 56%,transparent),0 0 18px color-mix(in srgb,var(--guide-accent) 30%,transparent)}#${ROOT_ID} [data-send],#${ROOT_ID} [data-voice]{border:1px solid var(--guide-accent);border-radius:12px;background:color-mix(in srgb,var(--guide-accent) 28%,#182334);color:#fff;font:900 14px/1 system-ui}#${ROOT_ID} [data-send]{min-width:76px;padding:0 14px}#${ROOT_ID} [data-voice]{min-width:54px;padding:0 10px;font-size:20px}#${ROOT_ID} [data-voice][data-listening="true"]{background:color-mix(in srgb,var(--guide-accent) 60%,#182334);box-shadow:0 0 18px color-mix(in srgb,var(--guide-accent) 42%,transparent)}#${ROOT_ID} button{cursor:pointer}
@media(max-width:720px){#${ROOT_ID}{position:fixed;inset:0;width:100vw;height:100dvh;max-width:none;max-height:100dvh;border:0;border-radius:0;grid-template-rows:auto auto auto minmax(0,1fr) auto}#${ROOT_ID}>header{grid-template-columns:44px minmax(0,1fr) 40px;padding-top:calc(7px + env(safe-area-inset-top))}#${ROOT_ID}>header img{width:44px;height:44px}#${ROOT_ID} .cw242-window-switcher{gap:4px;padding:7px 5px 8px}#${ROOT_ID} .cw242-window img{width:48px;height:48px;border-radius:12px}#${LAUNCHER_ID}{width:56px;height:56px}}
@media(max-width:390px){#${ROOT_ID} .cw242-window-switcher{gap:2px;padding-left:3px;padding-right:3px}#${ROOT_ID} .cw242-window img{width:44px;height:44px}#${ROOT_ID} [data-send]{min-width:66px;padding:0 10px}#${ROOT_ID} [data-voice]{min-width:48px}}
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
  root.innerHTML=`<header><img data-guide-avatar alt=""><div><strong data-guide-name></strong><span data-guide-role></span></div><button data-close type="button" aria-label="Close chat">×</button></header><nav class="cw242-window-switcher" aria-label="Guide chats">${switcherMarkup()}</nav><div class="cw350-context" data-context></div><div data-log role="log" aria-live="polite"></div><form data-persistent-form><textarea rows="2" maxlength="12000" required></textarea><button data-voice type="button" aria-label="Start offline voice" title="Start offline voice">◉</button><button data-send type="submit">Send</button></form>`;
  root.querySelector('[data-close]').addEventListener('click',close);
  root.querySelector('[data-send]').addEventListener('click',()=>{if(busy&&nativeAbortController){nativeAbortController.abort();const control=root.querySelector('[data-send]');if(control){control.textContent='Stopping…';control.disabled=true;}}});
  root.querySelector('.cw242-window-switcher').addEventListener('click',event=>{const button=event.target.closest?.('[data-cw242-window]');if(button)switchGuide(button.dataset.cw242Window,{open:true,focus:true})});
  root.querySelector('[data-voice]').addEventListener('click',()=>{void toggleVoice()});
  root.querySelector('[data-persistent-form]').addEventListener('submit',event=>{event.preventDefault();const input=event.currentTarget.querySelector('textarea'),text=clean(input?.value);if(!text)return;void submitText(text,activeSystem)});
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
  const current=guide(activeSystem),page=guide(pageSystem),voice=voiceState();
  document.documentElement.style.setProperty('--guide-accent',current.accent);
  if(launcher){launcher.style.setProperty('--guide-accent',page.accent);launcher.setAttribute('aria-label',`Talk to ${page.name}`);const image=launcher.querySelector('img');if(image){image.src=page.avatar;image.alt=page.name}}
  if(!root)return;
  root.style.setProperty('--guide-accent',current.accent);root.style.setProperty('--guide-panel',current.panel);root.dataset.guide=activeSystem;root.dataset.pageSystem=pageSystem;
  const avatar=root.querySelector('[data-guide-avatar]');if(avatar){avatar.src=current.avatar;avatar.alt=current.name}
  const name=root.querySelector('[data-guide-name]');if(name)name.textContent=current.name;
  const role=root.querySelector('[data-guide-role]');if(role)role.textContent=current.role;
  const input=root.querySelector('textarea');if(input)input.placeholder=current.placeholder;
  const voiceButton=root.querySelector('[data-voice]');if(voiceButton){const listening=Boolean(voice?.listening);voiceButton.dataset.listening=listening?'true':'false';voiceButton.setAttribute('aria-pressed',listening?'true':'false');voiceButton.setAttribute('aria-label',`${listening?'Stop':'Start'} offline voice with ${current.name}`);voiceButton.title=`${listening?'Stop':'Start'} offline voice with ${current.name}`;voiceButton.textContent=listening?'■':'◉'}
  const context=root.querySelector('[data-context]');if(context){const base=activeSystem===pageSystem?current.label:`${current.label} conversation · opened from ${guide(pageSystem).label}`;context.textContent=[base,voiceStatus||(voice?.listening?`Offline voice listening · say “Hey ${current.name}” or another guide name to switch context.`:'')].filter(Boolean).join(' · ')}
  syncSwitcher();
}
function savedArtifactItems(key){
  try{const items=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(items)?items:[]}catch{return[]}
}
function artifactGateView(row){
  if(row?.role==='user'||row?.pending)return null;
  const gate=row?.approvalGate;
  if(gate?.kind==='intention-activation'&&gate.planId){
    const id=String(gate.planId),owner=globalThis.CivweaveIntentionUI,items=typeof owner?.items==='function'?owner.items():savedArtifactItems('civweave.intentions.v127'),item=items.find(value=>value?.id===id||value?.plan?.id===id);
    if(!item)return{id,state:'missing',title:'Quest unavailable',description:'This Quest is no longer saved on this device.',commands:[]};
    const state=String(item.state||item.plan?.state||'review'),commands=[['open-plan','Review Quest']];
    if(state==='review'&&item.plan?.paths?.length)commands.push(['activate-plan','Activate Quest']);
    return{id,state,title:state==='active'?'Quest active':state==='completed'?'Quest completed':'Quest review',description:state==='review'?'Review the saved Quest before activating its paths.':`Saved status: ${state}.`,commands};
  }
  if(gate?.kind==='realm-action-approval'&&gate.actionId){
    const id=String(gate.actionId),owner=globalThis.CivweaveGuideContractsV141,action=typeof owner?.get==='function'?owner.get(id):savedArtifactItems('civweave.realm-actions.v141').find(value=>value?.id===id);
    if(!action)return{id,state:'missing',title:'Draft unavailable',description:'This draft is no longer saved on this device.',commands:[]};
    const state=String(action.state||'review'),missing=Array.isArray(action.missingRequired)?action.missingRequired:[],review=['draft','clarifying','review'].includes(state),commands=[['open-action','Review draft']];
    if(review&&!missing.length&&action.approval?.required)commands.push(['approve-action',String(action.approval.label||'Approve')]);
    return{id,state,title:missing.length?'Draft needs details':review?'Approval required':state.charAt(0).toUpperCase()+state.slice(1),description:missing.length?`Missing: ${missing.join(', ')}.`:review?'The saved draft awaits your review.':`Saved status: ${state}.`,commands};
  }
  // Learning Journey decisions are presented by their existing Moss owner.
  return null;
}
function syncArtifactGate(article,row){
  const view=artifactGateView(row);let panel=article.querySelector('.cw350-artifact-gate');
  if(!view){panel?.remove();return;}
  if(!panel){
    panel=document.createElement('section');panel.className='cw350-artifact-gate';
    const title=document.createElement('strong'),description=document.createElement('span'),actions=document.createElement('div');actions.className='cw350-artifact-actions';
    panel.append(title,description,actions);article.querySelector('.cw350-bubble')?.parentElement?.append(panel);
  }
  if(panel.dataset.state!==view.state)panel.dataset.state=view.state;
  const title=panel.querySelector('strong'),description=panel.querySelector('span'),actions=panel.querySelector('.cw350-artifact-actions');
  if(title.textContent!==view.title)title.textContent=view.title;
  if(description.textContent!==view.description)description.textContent=view.description;
  const previous=new Map([...actions.children].map(button=>[`${button.dataset.gate}:${button.dataset.id}`,button]));
  for(const[command,label]of view.commands){
    const key=`${command}:${view.id}`;let button=previous.get(key);previous.delete(key);
    if(!button){button=document.createElement('button');button.type='button';button.dataset.gate=command;button.dataset.id=view.id;actions.append(button);}
    if(button.textContent!==label)button.textContent=label;
  }
  for(const button of previous.values())button.remove();
}
function syncArtifactGates(){
  if(!root)return;
  const log=root.querySelector('[data-log]');if(!log)return;
  const messages=readThread(activeSystem).messages||[],rows=new Map(messages.map((row,index)=>[String(row.id||`history-${activeSystem}-${index}`),row]));
  for(const article of log.children)syncArtifactGate(article,rows.get(article.dataset.messageId));
}
function clippedQuestCandidate(row,messages,index){
  if(activeSystem!=='civweave'||!row||row.role!=='assistant'||row.pending||row.planSnapshot?.paths?.length||row.approvalGate?.kind==='intention-activation')return null;
  if(!/Learning Journey plan:|Response reached the generation limit|## Module|\\bStatus: REVIEW\\b/i.test(String(row.text||'')))return null;
  let source=null;
  for(let i=index-1;i>=0;i--)if(messages[i]?.role==='user'){source=messages[i];break}
  const original=clean(source?.text||'',5000);
  if(!/\\b(?:help me|help us|we want|i want|create|build|start|establish|organize|launch|design|plan|develop|make)\\b/i.test(original)||
    !/\\b(?:commune|garden|infrastructure|community|cooperative|project|quest|app|website|service|collective|enterprise|workspace|device|platform)\\b/i.test(original))return null;
  return {original,excerpt:clean(row.text,3600)};
}
let captureQuestBusy=false;
function syncClippedQuestCapture(article,row,messages,index){
  const candidate=clippedQuestCandidate(row,messages,index);
  let panel=article.querySelector('.cw350-clipped-quest-capture');
  if(!candidate){panel?.remove();return}
  if(!panel){
    panel=document.createElement('section');
    panel.className='cw350-artifact-gate cw350-clipped-quest-capture';
    const title=document.createElement('strong'),description=document.createElement('span'),actions=document.createElement('div');
    actions.className='cw350-artifact-actions';
    panel.append(title,description,actions);
    article.querySelector('.cw350-bubble')?.parentElement?.append(panel);
  }
  const title=panel.querySelector('strong'),description=panel.querySelector('span'),actions=panel.querySelector('.cw350-artifact-actions');
  title.textContent=row.capturedQuestId?'Structured Quest captured':'Recover clipped generation';
  description.textContent=row.capturedQuestId?
    'Your reviewable structured Quest was saved. It has not been activated.':
    'This answer is chat text, not a saved Quest. Use the original request plus this partial draft to create a validated, reviewable cross-realm Quest.';
  let button=actions.querySelector('button');
  if(!button){button=document.createElement('button');button.type='button';actions.append(button)}
  button.textContent=row.capturedQuestId?'Open captured Quest':'Capture as structured Quest';
  button.disabled=captureQuestBusy;
  button.onclick=async()=>{
    if(row.capturedQuestId){globalThis.CivweaveIntentionUI?.open?.(row.capturedQuestId);return}
    if(captureQuestBusy)return;
    captureQuestBusy=true;button.disabled=true;button.textContent='Generating structured Quest…';
    const notice=document.createElement('span');notice.textContent='Converting existing text using the selected model; no Quest will activate automatically.';
    panel.append(notice);
    try{
      const module=await import('/app/local-ai/native-server-guide-fastpath-v1.js?v=1.0.14-clipped-quest-capture');
      const result=await module.captureClippedQuest({originalRequest:candidate.original,clippedText:candidate.excerpt});
      if(!result?.planItemId||result?.plan?.state!=='review')throw new Error('No validated reviewable Quest was produced.');
      const thread=readThread('civweave'),idx=(thread.messages||[]).findIndex(item=>item.id===row.id);
      if(idx>=0)thread.messages[idx]={...thread.messages[idx],capturedQuestId:result.planItemId};
      thread.messages.push({id:uid('msg'),at:now(),role:'assistant',guide:'civweave',responderSystem:'civweave',
        text:clean(result?.response?.answer||'The recovered structured Quest is ready for review.',10000),
        nextAction:clean(result?.response?.choice?.nextAction||'',1200),
        provider:result.provider,model:result.model,approvalGate:result.response?.approvalGate||null,
        planSnapshot:clone(result.plan),capturedFromMessageId:row.id});
      writeThread('civweave',thread);
      render();
    }catch(error){
      notice.textContent='Capture failed: '+clean(error?.message||error,700)+'. The original message remains saved; no Quest was activated.';
    }finally{captureQuestBusy=false;button.disabled=false;if(!row.capturedQuestId)button.textContent='Capture as structured Quest'}
  };
}
function render(){
  if(!root)return false;syncChrome();const log=root.querySelector('[data-log]');if(!log)return false;
  const thread=readThread(activeSystem),messages=Array.isArray(thread.messages)?thread.messages:[];
  const existing=new Map([...log.children].map(article=>[article.dataset.messageId,article]));
  let cursor=log.firstElementChild;
  messages.forEach((row,index)=>{
    const id=String(row.id||`history-${activeSystem}-${index}`),user=row?.role==='user',role=user?'user':'assistant';
    const who=GUIDE[row?.guide||row?.responderSystem||activeSystem]||guide(activeSystem),meta=[row?.provider,row?.model].filter(Boolean).join(' · '),pending=Boolean(row?.pending);
    let article=existing.get(id);existing.delete(id);
    if(article&&article.dataset.role!==role){if(article===cursor)cursor=article.nextElementSibling;article.remove();article=null;}
    if(!article){
      article=document.createElement('article');
      if(!user)article.append(document.createElement('img'));
      const body=document.createElement('div'),bubble=document.createElement('div');bubble.className='cw350-bubble';body.append(bubble);article.append(body);
    }
    article.dataset.messageId=id;article.dataset.role=role;article.dataset.messageRole=role;article.dataset.pending=pending?'true':'false';
    article.classList.toggle('is-user',user);article.classList.toggle('cw-ai-pending',pending);
    const avatar=article.querySelector('img');
    if(avatar){if(avatar.getAttribute('src')!==who.avatar)avatar.setAttribute('src',who.avatar);if(avatar.getAttribute('alt')!==who.name)avatar.setAttribute('alt',who.name);}
    const bubble=article.querySelector('.cw350-bubble'),text=String(row.text||'');
    // Finalization keeps the streamed bubble and any capability controls in
    // place. Only write text when the final answer actually differs.
    if(bubble&&bubble.textContent!==text)bubble.textContent=text;
    let nextNode=article.querySelector('.cw350-next');
    const nextAction=user?'':String(row.nextAction||'');
    if(nextAction){if(!nextNode){nextNode=document.createElement('div');nextNode.className='cw350-next';bubble.parentElement.append(nextNode);}const nextText=`Next: ${nextAction}`;if(nextNode.textContent!==nextText)nextNode.textContent=nextText;}else nextNode?.remove();
    let metadata=article.querySelector('.cw350-meta');
    if(!user&&meta){if(!metadata){metadata=document.createElement('div');metadata.className='cw350-meta';bubble.parentElement.append(metadata);}if(metadata.textContent!==meta)metadata.textContent=meta;}
    else metadata?.remove();
    syncArtifactGate(article,row);
    syncClippedQuestCapture(article,row,messages,index);
    if(article!==cursor)log.insertBefore(article,cursor);else cursor=cursor.nextElementSibling;
  });
  for(const article of existing.values())article.remove();
  if(openState)markSeen(activeSystem);syncSwitcher();
  requestAnimationFrame(()=>{try{log.scrollTop=log.scrollHeight}catch{}});
  globalThis.CivweaveSavedChatUIV295?.render?.(activeSystem);
  return true;
}
function paintNativeStream(system,messageId,text){
  // Update only the pending bubble. Rebuilding the entire thread on each
  // token caused excessive main-thread work on Android.
  if(activeSystem!==system||!root||!openState)return;
  const rows=root.querySelectorAll('[data-log] article[data-pending="true"]');
  for(const article of rows){
    if(article.dataset.messageId!==messageId)continue;
    const bubble=article.querySelector('.cw350-bubble');
    if(bubble&&bubble.textContent!==text)bubble.textContent=text;
    break;
  }
}
function historyFor(system){return(readThread(system).messages||[]).filter(row=>!row.pending&&!row.modelError&&!/^(?:deterministic|manual)/.test(row.provider||'')&&['user','assistant'].includes(row.role)).slice(-16).map(row=>({role:row.role,text:clean(row.text,6000)}))}
function paintStream(system,text){
  const pending=[...(readThread(system).messages||[])].reverse().find(row=>row?.role==='assistant'&&row.pending);
  return pending?paintNativeStream(system,pending.id,text):false;
}
function localFailure(system,selection,error){const message=clean(error?.message||error||'The selected local model did not complete.',900);return{text:`${guide(system).name} could not run the selected local model ${selection?.id||''}: ${message}`,provider:'local-model-error',model:error?.executionModel||selection?.id||'',error:message}}
async function fallbackReply(system,text){
  const selection=selectedLocal();
  try{
    await globalThis.CivweaveFamilyAILoaderV105?.ensure?.();
    const runtime=globalThis.CivweaveModelRuntime;
    if(typeof runtime?.generate!=='function')throw new Error('The AI runtime is unavailable.');
    const result=await runtime.generate({purpose:`${system}-guide-chat-v350`,executionProfile:'interactive',config:selection?{provider:'downloaded-local',route:'downloaded-local',model:selection.id,externalConsent:false}:undefined,messages:[{role:'system',content:`You are ${guide(system).name}, ${guide(system).role}. Give a useful concise response while preserving user control.`},...historyFor(system).slice(-10).map(row=>({role:row.role,content:row.text})),{role:'user',content:text}]});
    const output=clean(result?.outputText||result?.text||result?.output||result?.response,10000),provider=result?.actual?.provider||result?.provider||result?.requested?.provider||'model-runtime',model=result?.actual?.model||result?.model||result?.requested?.model||'';
    if((result?.status&&result.status!=='success')||!output||/deterministic|manual/.test(provider)||result?.completionValidation?.valid===false)throw new Error('The selected AI route did not produce a usable answer. Check the provider in Settings and retry.');
    return{text:output,provider,model};
  }catch(error){
    if(selection)return localFailure(system,selection,error);
    const message=clean(error?.message||error,900);
    return{text:`${guide(system).name} could not generate a response: ${message}`,provider:'model-error',model:'',error:message};
  }
}
function actualPlanningModel(result){
  const answer=clean(result?.response?.answer||'',12000);
  const known=result?.executionModel||result?.actual?.model||result?.deepGenerationModel||'';
  const planning=/Moss could not generate the high-level Learning Journey plan|Learning Journey plan:|Moss could not start the selected AI for Learning Journey planning/i.test(answer);
  if(!planning)return known||result?.model||'';
  const role=globalThis.CivweaveLocalGenerationModelPolicyV1;
  const configured=role?.supportsSelected?.()&&String(result?.provider||'').toLowerCase()==='downloaded-local';
  return known||(configured?role.resolve('deep'):result?.model)||'';
}
function explicitHandoffTarget(result,system){
  // Offering another guide's capability is not consent to copy private chat
  // context or start that guide. The passover owner records acceptance first.
  if(result?.handoff?.kind==='guide-capability-passover'&&!result.handoff.acceptedAt)return'';
  const target=clean(result?.handoff?.targetSystem||result?.handoffSystem||result?.response?.handoffSystem,80);
  return SYSTEMS.includes(target)&&target!==system?target:'';
}
async function submitActive(text){
  const value=clean(text),system=activeSystem;if(!value||busy||!SYSTEMS.includes(system))return false;
  busy=true;ensureRoot();const button=root.querySelector('[data-send]'),input=root.querySelector('textarea');
  const nativeRequested=activeNativePhoneServer(),ollamaRequested=configuredRoute()==='ollama',requestAbort=(nativeRequested||ollamaRequested)?new AbortController():null;
  nativeAbortController=requestAbort;
  if(button){button.disabled=!(nativeRequested||ollamaRequested);button.type=(nativeRequested||ollamaRequested)?'button':'submit';button.textContent=(nativeRequested||ollamaRequested)?'Stop':'Send';}
  if(input)input.value='';
  append(system,{role:'user',text:value});const pendingId=uid('pending');append(system,{id:pendingId,role:'assistant',guide:system,text:`${guide(system).name} is thinking…`,pending:true});render();emitAvatar(system,'',value,'thinking');
  try{
    // The current user turn has already been appended to the visible thread.
    // Do not submit it as both a historical user message and the current turn.
    const recentHistory=historyFor(system);
    const pastHistory=recentHistory.at(-1)?.role==='user'&&recentHistory.at(-1)?.text===value
      ?recentHistory.slice(0,-1):recentHistory;
    let result;
    let paintTimer=null,latestText='',lastPaint=0;
    const paint=()=>{
      paintTimer=null;lastPaint=Date.now();paintNativeStream(system,pendingId,latestText);
    };
    const onToken=(delta,accumulated,meta)=>{
      if(meta?.kind==='quest-progress'){
        const phase=meta.phase==='saved'?'Saved for REVIEW':meta.phase==='generating'?'Creating Quest':'Preparing cross-realm Quest';
        latestText='Weaveling · '+phase+(meta.characters?' · '+Number(meta.characters)+' characters drafted':'')+'. Activation requires approval.';
      }
      else if(meta?.kind==='moss-progress')
        latestText='Moss · '+(meta.phase==='compile'?'Compiling JSON':meta.phase==='repair'?'Repairing plan':meta.phase==='saved'?'Saved for REVIEW':'Drafting outline')+' · '+(Number(meta.characters)||0)+' characters received. Approval required.';
      else if(typeof accumulated==='string'&&accumulated){
        const stream=globalThis.CivweaveGuideStreamThinkingV249;
        latestText=/weaveling-intention-json/i.test(meta?.purpose||'')
          ?(stream?.visibleWeavelingPlan?.(accumulated)||'Preparing your Quest for review…')
          :(stream?.splitThinking?.(accumulated)?.answer??accumulated);
      }
      if(!latestText)return;
      if(Date.now()-lastPaint>=80){if(paintTimer){clearTimeout(paintTimer);paintTimer=null;}paint();}
      else if(!paintTimer)paintTimer=setTimeout(paint,80);
    };
    try {
    if(ollamaRequested){
      result=await globalThis.CivweaveFamilyAILoaderV105.respondOllama({text:value,system,history:pastHistory,onToken,signal:requestAbort?.signal});
    }else if(nativeRequested){
      // On a verified Termux route, do not initialize the entire Civweave
      // assistant stack before the first request reaches the HTTP model.
      // This path never loads browser GGUF weights or starts a fallback.
      try{localStorage.setItem('civweave.native-server.last-request.v1',JSON.stringify({at:new Date().toISOString(),stage:'native-preflight',route:'openai-compatible',model:'qwen35-4b-native'}))}catch{}
      // Use the existing canonical tracker in native-server sessions too.
      try{await globalThis.CivweaveGemma4LiteRTRequestAuthorityV1?.ensureTracker?.()}catch(error){
        console.warn('[Civweave] Optional generation tracker unavailable:',error);
      }
      await verifyNativePhoneServerTransport();
      const direct=await import('/app/local-ai/native-server-guide-fastpath-v1.js?v=1.0.13-ai-lifecycle');
      if(requestAbort?.signal.aborted)throw new Error('Generation cancelled before the request was sent.');
      result=await direct.respondNative({text:value,system,history:pastHistory,onToken,signal:requestAbort?.signal});
    }else{
      await globalThis.CivweaveFamilyAILoaderV105?.ensure?.();const assistant=globalThis.CivweaveAssistantV141;if(!assistant?.respond)throw new Error('Shared assistant runtime is not ready.');
      result=await assistant.respond({text:value,systemId:system,handoffSystem:system!==pageSystem?system:undefined,history:pastHistory});
    }
    }finally{if(paintTimer){clearTimeout(paintTimer);paint();}}
    const thread=readThread(system),index=(thread.messages||[]).findIndex(row=>row.id===pendingId),next=clean(result?.response?.choice?.nextAction,1200),respondingSystem=SYSTEMS.includes(result?.context?.guide?.system)?result.context.guide.system:system,replacement={id:pendingId,at:thread.messages?.[index]?.at||now(),role:'assistant',guide:respondingSystem,responderSystem:respondingSystem,text:clean(result?.response?.answer,10000),nextAction:next,provider:result?.provider,model:actualPlanningModel(result),chargedNeurons:Number(result?.usage?.chargedNeurons)||0,remainingNeurons:Number.isFinite(Number(result?.usage?.remainingNeurons))?Number(result.usage.remainingNeurons):null,approximateTurnsLeft:Number.isFinite(Number(result?.usage?.approximateTurnsLeft))?Number(result.usage.approximateTurnsLeft):null,responseRouting:result?.responseRouting||null,semanticRoute:result?.context?.routingAnswer||null,approvalGate:result?.response?.approvalGate||null,planSnapshot:result?.plan?clone(result.plan):null,actionSnapshot:result?.action?clone(result.action):null};
    if(index>=0)thread.messages[index]=replacement;else thread.messages.push(replacement);writeThread(system,thread);emitAvatar(respondingSystem,replacement.text,value,'response');const target=explicitHandoffTarget(result,system);if(target)await realmApi()?.createHandover?.(system,target,result);
  }catch(error){
    // Stop and local HTTP failures end this request. A retry needs a new
    // user action and must never awaken a stale downloaded-model runtime.
    const fallback=(requestAbort?.signal.aborted||ollamaRequested||nativeApiRoute())
      ? {text:requestAbort?.signal.aborted?'Generation stopped.':`${guide(system).name} could not complete the selected local-server request: ${clean(error?.message||error,900)}. No second model was started. Check the native server and retry explicitly.`,provider:'model-error',model:'',error:clean(error?.message||error,900)}
      : await fallbackReply(system,value);
    const thread=readThread(system),index=(thread.messages||[]).findIndex(row=>row.id===pendingId),replacement={id:pendingId,at:thread.messages?.[index]?.at||now(),role:'assistant',guide:system,responderSystem:system,text:fallback.text,provider:fallback.provider,model:fallback.model||'',recoveredBy:'guide-chat-surface-v350',modelError:fallback.error||clean(error?.message||error,900)};if(index>=0)thread.messages[index]=replacement;else thread.messages.push(replacement);writeThread(system,thread);if(['local-model-error','model-error'].includes(fallback.provider)){try{dispatchEvent(new CustomEvent('civweave:chat-model-failed',{detail:{system,model:fallback.model,message:fallback.error||replacement.modelError}}))}catch{}}else emitAvatar(system,replacement.text,value,'response');
  }finally{busy=false;nativeAbortController=null;if(button){button.disabled=false;button.type='submit';button.textContent='Send';}render();emitState()}
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
async function submitText(text,system=activeSystem,options={}){
  if(SYSTEMS.includes(system)&&system!==activeSystem)switchGuide(system,{open:false});
  const value=clean(text);if(!value)return false;
  const addressed=options.skipAddress?{addressed:false,text:value}:resolveGuideAddress(value,{allowBare:options.allowBare===true});
  if(addressed.addressed){switchGuide(addressed.system,{open:openState,focus:false});if(!addressed.text)return true;return submitActive(addressed.text)}
  return submitActive(value);
}
async function submitVoiceText(text,system=activeSystem){return submitText(text,system,{allowBare:true})}
function start(){
  pageSystem=detectSystem();activeSystem=pageSystem;installStyle();restoreState();ensureLauncher();syncChrome();openState=false;minimized=false;
  void ensureSpecializedRegistry().catch(()=>{});
  addEventListener('civweave:system-route-changed',event=>{const system=event?.detail?.system;if(SYSTEMS.includes(system)&&system!==pageSystem){pageSystem=system;syncChrome()}});
  addEventListener('civweave:realm-guide-thread-changed',()=>{if(root)queueMicrotask(()=>{if(openState)markSeen(activeSystem);syncSwitcher()})});
  for(const name of ['civweave:actions-changed','civweave:intentions-changed'])addEventListener(name,syncArtifactGates);
  addEventListener('storage',event=>{if(['civweave.realm-actions.v141','civweave.intentions.v127'].includes(event.key))syncArtifactGates()});
  addEventListener('civweave:guide-voice-state',event=>{const detail=event.detail||{};voiceStatus=clean(detail.error||'',300);if(root)syncChrome();emitState()});
  document.documentElement.dataset.civweaveGuideSurface='guide-chat-v350';
  document.documentElement.dataset.civweaveGuideArtifactLanguage='canonical-v1';
  try{dispatchEvent(new CustomEvent('civweave:guide-chat-ready',{detail:state()}));dispatchEvent(new CustomEvent('civweave:persistent-guide-chat-ready',{detail:state()}));dispatchEvent(new CustomEvent('civweave:guide-workspace-ready',{detail:{...state(),compatibilityEventOnly:true}}))}catch{}
}

const api=Object.freeze({version:VERSION,canonicalOwner:true,presentationOwner:'guide-chat-surface-v350',retiredWorkspaceView:true,systems:Object.freeze([...SYSTEMS]),guideFor:system=>GUIDE[system]||null,state,open,close,minimize,switchGuide,openWindow,closeWorkspace,activeWindow,submitText,submitVoiceText,resolveGuideAddress,ensureSpecializedRegistry,ensureVoiceRuntime,toggleVoice,render,paintStream,ensureRoot,ensureLauncher,hasUnread,selectedLocal,artifactLanguage:'Weaveling=Quest; Moss=Learning Journey; Kamiya=Endeavor; Rook=Manifest'});
globalThis.CivweaveGuideChatSurfaceV350=api;
globalThis.CivweavePersistentGuideChatV215=api;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
