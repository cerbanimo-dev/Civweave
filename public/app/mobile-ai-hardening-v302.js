(()=>{
'use strict';

const VERSION='1.0.117-mobile-ai-hardening-v302';
const REVISION='mobile-chat-composer-stack-v363';
const STYLE_ID='cw-mobile-ai-hardening-v302-style';
const TEST_MARKER='civweave.local-ai.test-inflight.v302';
const RECOVERY_KEY='civweave.local-ai.test-recovery.v302';
const SELECTION_KEY='civweave.local-ai.selection.v266';
const WEBGPU_QUARANTINE_KEY='civweave.local-ai.webgpu-quarantine.v299';
if(globalThis.CivweaveMobileAIHardeningV302?.version===VERSION&&globalThis.CivweaveMobileAIHardeningV302?.revision===REVISION)return;

const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const now=()=>new Date().toISOString();
const clean=(value,max=500)=>String(value??'').trim().slice(0,max);

function isMobile(){
  const narrow=globalThis.matchMedia?.('(max-width: 760px)')?.matches;
  const coarse=globalThis.matchMedia?.('(pointer: coarse)')?.matches;
  return Boolean(narrow||(coarse&&Math.min(Number(innerWidth)||9999,Number(innerHeight)||9999)<1000));
}

// Compatibility API only. Chat layout no longer writes viewport measurements into
// document styles. Modern Chromium resolves 100dvh in CSS without a JS feedback loop.
function syncViewport(){
  const viewport=globalThis.visualViewport;
  return Object.freeze({
    height:Math.max(1,Math.round(viewport?.height||innerHeight||1)),
    width:Math.max(1,Math.round(viewport?.width||innerWidth||1)),
    top:Math.max(0,Math.round(viewport?.offsetTop||0)),
    left:Math.max(0,Math.round(viewport?.offsetLeft||0)),
    writes:0
  });
}

function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
@media(max-width:720px){
html[data-civweave-mobile-ai-hardening="v302"] body #cw-persistent-guide-chat-v215:not([hidden]):not(.is-minimized){
  position:fixed!important;
  inset:0!important;
  left:0!important;
  right:0!important;
  top:0!important;
  bottom:0!important;
  width:100vw!important;
  height:100dvh!important;
  min-height:0!important;
  max-width:none!important;
  max-height:100dvh!important;
  margin:0!important;
  border:0!important;
  border-radius:0!important;
  display:grid!important;
  grid-template-rows:max-content max-content max-content minmax(0,1fr) max-content!important;
  overflow:hidden!important;
  overscroll-behavior:contain!important;
  background:var(--guide-panel,#111827)!important;
  box-shadow:none!important;
  contain:layout paint style!important;
  z-index:2147483646!important;
  box-sizing:border-box!important;
  pointer-events:auto!important;
}
html[data-civweave-mobile-ai-hardening="v302"] body #cw-persistent-guide-chat-v215:not([hidden]):not(.is-minimized):has(>.cw295-saved-chats){
  grid-template-rows:max-content max-content max-content max-content minmax(0,1fr) max-content!important;
}
html[data-civweave-mobile-ai-hardening="v302"] body #cw-persistent-guide-chat-v215:not([hidden]):not(.is-minimized)>header{
  grid-template-columns:44px minmax(0,1fr) 38px 38px!important;
  gap:6px!important;
  padding:calc(7px + env(safe-area-inset-top)) 8px 7px!important;
}
html[data-civweave-mobile-ai-hardening="v302"] body #cw-persistent-guide-chat-v215:not([hidden]):not(.is-minimized)>header [data-guide-avatar]{
  width:44px!important;
  height:44px!important;
  min-width:44px!important;
}
html[data-civweave-mobile-ai-hardening="v302"] body #cw-persistent-guide-chat-v215:not([hidden]):not(.is-minimized) .cw242-window-switcher{
  min-width:0!important;
  overflow:hidden!important;
}
html[data-civweave-mobile-ai-hardening="v302"] body #cw-persistent-guide-chat-v215:not([hidden]):not(.is-minimized) [data-log]{
  min-height:0!important;
  overflow:auto!important;
  overscroll-behavior:contain!important;
  touch-action:pan-y!important;
  -webkit-overflow-scrolling:touch;
}
html[data-civweave-mobile-ai-hardening="v302"] body #cw-persistent-guide-chat-v215:not([hidden]):not(.is-minimized) [data-persistent-form]{
  min-width:0!important;
  grid-template-columns:minmax(0,1fr) 68px!important;
  grid-template-rows:38px 38px!important;
  gap:8px!important;
  align-items:stretch!important;
  padding:8px max(8px,env(safe-area-inset-right)) calc(8px + env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left))!important;
}
html[data-civweave-mobile-ai-hardening="v302"] body #cw-persistent-guide-chat-v215:not([hidden]):not(.is-minimized) [data-persistent-form] textarea{
  grid-column:1!important;
  grid-row:1 / span 2!important;
  min-width:0!important;
  width:100%!important;
  height:84px!important;
  min-height:84px!important;
  max-height:84px!important;
  resize:none!important;
}
html[data-civweave-mobile-ai-hardening="v302"] body #cw-persistent-guide-chat-v215:not([hidden]):not(.is-minimized) [data-voice]{
  grid-column:2!important;
  grid-row:1!important;
  width:68px!important;
  min-width:68px!important;
  height:38px!important;
  min-height:38px!important;
  padding:0 10px!important;
  align-self:stretch!important;
}
html[data-civweave-mobile-ai-hardening="v302"] body #cw-persistent-guide-chat-v215:not([hidden]):not(.is-minimized) [data-send]{
  grid-column:2!important;
  grid-row:2!important;
  width:68px!important;
  min-width:68px!important;
  height:38px!important;
  min-height:38px!important;
  padding:0 10px!important;
  align-self:stretch!important;
}
}
`;
  document.head.append(style);
}

function recoveryRecord(marker){
  return{schema:'civweave.local-ai.test-recovery.v302',recoveredAt:now(),model:clean(marker?.model||marker?.id||'',120),startedAt:marker?.startedAt||'',reason:'interrupted-local-model-test',downloadPreserved:true,selectionCleared:true};
}

function recoverInterruptedTest(){
  let marker=null;
  try{marker=parse(localStorage.getItem(TEST_MARKER),null)}catch{}
  if(!marker)return null;
  try{localStorage.removeItem(TEST_MARKER)}catch{}
  try{globalThis.CivweaveLocalModelRuntimeV266?.shutdown?.({reason:'interrupted-model-test-recovery'})}catch{}
  try{
    const selected=parse(localStorage.getItem(SELECTION_KEY),{});
    if(selected?.active||selected?.id){
      localStorage.setItem(SELECTION_KEY,JSON.stringify({active:false,id:null,updatedAt:now(),recoveredFrom:clean(marker?.model||marker?.id||selected.id,120),recovery:'interrupted-model-test'}));
    }
  }catch{}
  const record=recoveryRecord(marker);
  try{localStorage.setItem(RECOVERY_KEY,JSON.stringify(record))}catch{}
  queueMicrotask(()=>{try{dispatchEvent(new CustomEvent('civweave:local-model-test-recovered',{detail:record}))}catch{}});
  return record;
}

function addRecoveryNotice(){
  let record=null;
  try{record=parse(localStorage.getItem(RECOVERY_KEY),null)}catch{}
  if(!record)return false;
  const panel=document.getElementById('cw-local-ai-v266');
  if(!panel)return false;
  let notice=panel.querySelector('[data-mobile-ai-recovery-v302]');
  if(!notice){
    notice=document.createElement('div');
    notice.dataset.mobileAiRecoveryV302='true';
    notice.style.cssText='margin:8px 0;padding:10px 12px;border:1px solid rgba(255,192,109,.55);border-radius:10px;background:rgba(94,54,15,.28);color:#fff4dc;line-height:1.4';
    panel.prepend(notice);
  }
  const label=record.model?` (${record.model})`:'';
  notice.textContent=`Civweave recovered from an interrupted local-model test${label}. The downloaded files were kept, but local AI was deselected so the app can open safely. Re-select a model when you are ready.`;
  try{localStorage.removeItem(RECOVERY_KEY)}catch{}
  return true;
}

function quarantineForSafeMobileTest(spec){
  if(!isMobile()||spec?.device!=='webgpu'||!spec?.id)return false;
  try{
    const runtime=globalThis.CivweaveLocalModelRuntimeV266;
    if(typeof runtime?.markQuarantined==='function')return Boolean(runtime.markQuarantined(spec.id,'mobile-health-check-safe-compatibility'));
    const rows=new Set(parse(sessionStorage.getItem(WEBGPU_QUARANTINE_KEY),[]));
    rows.add(spec.id);
    sessionStorage.setItem(WEBGPU_QUARANTINE_KEY,JSON.stringify([...rows]));
    sessionStorage.setItem(`${WEBGPU_QUARANTINE_KEY}.reason.${spec.id}`,'mobile-health-check-safe-compatibility');
    return true;
  }catch{return false}
}

function beginTest(spec={}){
  const mobile=isMobile();
  const safeCompatibility=quarantineForSafeMobileTest(spec);
  const marker={schema:'civweave.local-ai.test-inflight.v302',model:clean(spec.id,120),label:clean(spec.label,160),device:clean(spec.device,40),estimatedBytes:Number(spec.estimatedBytes||0),mobile,safeCompatibility,startedAt:now()};
  try{localStorage.setItem(TEST_MARKER,JSON.stringify(marker))}catch{}
  try{dispatchEvent(new CustomEvent('civweave:local-model-test-started',{detail:marker}))}catch{}
  return{mobile,safeCompatibility,benchmark:!mobile,maxNewTokens:mobile?12:32,mode:safeCompatibility?'mobile-safe-compatibility':mobile?'mobile-safe-direct':'full-health'};
}

function finishTest(spec={},detail={}){
  let marker=null;
  try{marker=parse(localStorage.getItem(TEST_MARKER),null)}catch{}
  if(!marker||!spec?.id||!marker.model||marker.model===spec.id){try{localStorage.removeItem(TEST_MARKER)}catch{}}
  const result={model:clean(spec.id,120),ok:Boolean(detail.ok),mode:detail.mode||'',error:clean(detail.error?.message||detail.error||'',300),finishedAt:now()};
  try{dispatchEvent(new CustomEvent('civweave:local-model-test-finished',{detail:result}))}catch{}
  return result;
}

function start(){
  document.documentElement.dataset.civweaveMobileAiHardening='v302';
  document.documentElement.dataset.civweaveChatLayout='composer-stack-v363';
  installStyle();
  recoverInterruptedTest();
  addEventListener('civweave:model-settings-opened',()=>setTimeout(addRecoveryNotice,0));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addRecoveryNotice,{once:true});else queueMicrotask(addRecoveryNotice);
}

start();
globalThis.CivweaveMobileAIHardeningV302=Object.freeze({version:VERSION,revision:REVISION,isMobile,syncViewport,recoverInterruptedTest,beginTest,finishTest,testMarker:TEST_MARKER,recoveryKey:RECOVERY_KEY,mobileFullscreenChat:true,mobileSafeCompatibility:true,mobileBenchmarkDisabled:true,interruptedTestRecovery:true,chatLayoutMode:'css-dvh-plus-stacked-composer',savedThreadRows:6,viewportEventOwnership:false,viewportStyleWrites:false,mainThreadQuiescentOnChatOpen:true});
})();
