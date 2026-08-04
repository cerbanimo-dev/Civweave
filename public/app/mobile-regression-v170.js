(()=>{
'use strict';
const VERSION='1.0.4-mobile-regression-v170';
if(globalThis.CommonweaveMobileRegressionV170?.version===VERSION)return;
const SETTINGS_CSS='/app/model-settings-v133.css?v=mobile-r170';
const SETTINGS_SCRIPTS=[
  ['/app/shared/commonweave-model-runtime.js?v=mobile-r170',()=>globalThis.CommonweaveModelRuntime],
  ['/app/minilm-reflex-runtime-v138.js?v=mobile-r170',()=>globalThis.CommonweaveReflexRuntime],
  ['/app/minilm-model-settings-v138.js?v=mobile-r170',()=>globalThis.CommonweaveModelSettingsV133]
];
let settingsPromise=null,lastLivingError='';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function addCss(href){if(document.querySelector(`link[data-cw170-style="${href}"]`))return;const link=document.createElement('link');link.rel='stylesheet';link.href=href;link.dataset.cw170Style=href;document.head.append(link)}
function loadScript(src,ready){if(ready?.())return Promise.resolve();return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.async=false;script.dataset.cw170='';const timer=setTimeout(()=>finish(new Error(`${new URL(src,location.href).pathname} timed out while loading`)),15000);function finish(error){clearTimeout(timer);if(error){script.remove();reject(error)}else resolve()}script.onload=()=>ready?.()?finish():finish(new Error(`${new URL(src,location.href).pathname} loaded without its runtime`));script.onerror=()=>finish(new Error(`Could not load ${new URL(src,location.href).pathname}`));document.head.append(script)})}
function settingsHasCurrentControls(api=globalThis.CommonweaveModelSettingsV133){try{const html=String(api?.inlineMarkup?.()||'');return html.includes('name="apiKey"')&&html.includes('data-test-gemini')&&html.includes('data-benchmark')}catch{return false}}
async function ensureSettings(){
  if(settingsHasCurrentControls())return globalThis.CommonweaveModelSettingsV133;
  if(settingsPromise)return settingsPromise;
  settingsPromise=(async()=>{
    addCss(SETTINGS_CSS);
    for(const [src,ready] of SETTINGS_SCRIPTS.slice(0,2))await loadScript(src,ready);
    if(!settingsHasCurrentControls()){
      const stale=document.getElementById('cw-ai-settings-v157');if(stale?.open)stale.close();stale?.remove();
      try{delete globalThis.CommonweaveModelSettingsV133;delete globalThis.CommonweaveModelSettingsV157}catch{}
      await loadScript(SETTINGS_SCRIPTS[2][0],SETTINGS_SCRIPTS[2][1]);
    }
    const api=globalThis.CommonweaveModelSettingsV133;
    if(!settingsHasCurrentControls(api))throw new Error('The current Gemini key and connection-test controls were not found.');
    return api;
  })().catch(error=>{settingsPromise=null;throw error});
  return settingsPromise;
}
function decorateSettings(root){
  const panel=root?.querySelector?.('[data-route-panel="bundled"]');
  if(panel&&!panel.querySelector('[data-cw170-local-boundary]')){
    const note=document.createElement('div');note.dataset.cw170LocalBoundary='';note.className='cw-ai-fallback-contract';note.innerHTML='<b>Local validation boundary</b><span>Deterministic parsers, tests, schemas, and explicit rail rules decide pass or fail. MiniLM may rank which rail submitted evidence resembles, but it cannot prove code correctness, write a patch, or apply a change. Generating changes requires an imported generative model.</span>';
    panel.append(note);
  }
  const gemini=root?.querySelector?.('[data-route-panel="gemini"]');
  if(gemini){
    const key=gemini.querySelector('input[name="apiKey"]'),test=gemini.querySelector('[data-test-gemini]');
    if(key)key.setAttribute('aria-label','Gemini API key, stored for this browser session only');
    if(test)test.textContent='Test Gemini connection and response';
  }
}
async function openSettings(){
  const api=await ensureSettings();
  const stale=document.getElementById('cw-ai-settings-v157');if(stale&&!stale.querySelector('input[name="apiKey"]')){if(stale.open)stale.close();stale.remove()}
  const dialog=api.open();decorateSettings(dialog);return dialog;
}
function patchLoader(){const api=globalThis.CommonweaveFamilyAILoaderV105;if(!api||api.__cw170Settings)return false;api.openSettings=openSettings;Object.defineProperty(api,'__cw170Settings',{value:true});return true}
function suppressExtraLaunchers(){document.querySelectorAll('#gc153-launcher,.gc153-launcher,[data-commonweave-bottom-launcher],[data-weaveling-launcher]').forEach(node=>{node.hidden=true;node.setAttribute('aria-hidden','true');node.tabIndex=-1})}
function showLivingRecovery(message){
  const room=document.getElementById('room');if(!room||room.querySelector('.ls-recovery'))return;
  room.innerHTML=`<section class="ls-recovery"><small>LIVING SCHOOL STARTUP RECOVERY</small><h1>The Pathway Desk did not finish opening.</h1><p>${String(message||'The core learning module did not become ready.').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</p><div class="ls-actions"><button type="button" data-ls170-retry>Retry this screen</button><button type="button" data-ls170-reset>Back up and reset the local school view</button></div></section>`;
}
function resetLiving(){const key='commonweave.living-school.cabinet.v151',value=localStorage.getItem(key);if(value)localStorage.setItem(`${key}.backup.${Date.now()}`,value);localStorage.removeItem(key);location.reload()}
async function verifyLivingBoot(){
  if(!document.documentElement.hasAttribute('data-living-school-cabinet'))return;
  await sleep(4200);
  const room=document.getElementById('room'),api=globalThis.LivingSchoolCabinetV151;
  if(api&&room&&!room.children.length){try{api.setRoom('desk')}catch(error){lastLivingError=error.message}}
  await sleep(250);
  if(!globalThis.LivingSchoolCabinetV151||!room?.children.length)showLivingRecovery(lastLivingError||'The cabinet module was blocked before it could render its first room. Your saved record has not been deleted.');
}
function bind(){
  document.addEventListener('click',event=>{if(event.target.closest?.('[data-ls170-retry]'))location.reload();if(event.target.closest?.('[data-ls170-reset]'))resetLiving()},true);
  addEventListener('error',event=>{const source=String(event.filename||'');if(source.includes('living-school-cabinet')||source.includes('/services/living-school/modules/'))lastLivingError=event.message||'A Living School module failed to load.'});
  addEventListener('unhandledrejection',event=>{const text=String(event.reason?.message||event.reason||'');if(/living school|living-school|rubric|project gate|cerbanimo bridge/i.test(text))lastLivingError=text});
}
function patch(){patchLoader();suppressExtraLaunchers();document.querySelectorAll('#cw-ai-settings-v157').forEach(decorateSettings)}
function boot(){bind();patch();let attempts=0;const timer=setInterval(()=>{patch();if(patchLoader()||attempts++>40)clearInterval(timer)},100);new MutationObserver(records=>{if(records.some(record=>record.addedNodes.length))queueMicrotask(patch)}).observe(document.documentElement,{childList:true,subtree:true});verifyLivingBoot()}
document.readyState==='loading'?addEventListener('DOMContentLoaded',boot,{once:true}):boot();
globalThis.CommonweaveMobileRegressionV170={version:VERSION,ensureSettings,openSettings,verifyLivingBoot,capabilityBoundary:'MiniLM ranks relevance only; deterministic tools validate; imported generative models create changes.'};
})();
