(()=>{
'use strict';

const VERSION='working-campus-return-v425';
const REVISION='legacy-nav-first-paint-v431';
const RECOVERY_KEY='civweave.working-campus.return-recovery.v425';
const RECOVERY_WINDOW_MS=30_000;
const STARTUP_GRACE_MS=2400;
const UNHEALTHY_HOLD_MS=900;
const RETRY_DELAY_MS=260;
const INTERACTION_GRACE_MS=1800;
const INTERACTION_FAILSAFE_MS=10_000;
const CANONICAL_PATH='/app/working-campus-v156.html';
const BOOT_KEY='civweave.install-boundary.boot.v228';
const LEGACY_BOOT_KEYS=['civweave.install-boundary.boot.v227','civweave.install-boundary.boot.v226'];
const LANGUAGE_KEY='civweave.language.v1';
const JAPANESE_MODE_SRC='/app/japanese-mode-v1.js?v=japanese-mode-v1';
const SUPPORT_URL='https://www.patreon.com/c/Civweave';
const LEGACY_NAV_STYLE_ID='cw-working-campus-legacy-nav-first-paint-v431';
const REQUIRED_SELECTORS=['main.app','main.app>header.top','main.app>.campus','main.app>.main','nav.bottom','#conversation','#workspace'];
const WEAVELING_INTERACTION_SELECTOR='.guide button,.guide a,.weaveling-chat-form textarea,.weaveling-chat-form button,[data-open-unified-ai-settings],[data-cw-onboarding-replay]';
let lastInspection=null;
let recoveryPanel=null;
let verifyFlight=null;
let retryTimer=0;
let unhealthySince=0;
let protectedInteractionActive=false;
let lastProtectedInteractionAt=0;
let protectedInteractionFailsafeTimer=0;
const bootStartedAt=Date.now();

if(globalThis.CivweaveWorkingCampusReturnGuardV425?.version===VERSION&&globalThis.CivweaveWorkingCampusReturnGuardV425?.revision===REVISION)return;

const now=()=>Date.now();
const parse=value=>{try{return JSON.parse(value||'null')}catch{return null}};
const frame=()=>new Promise(resolve=>(globalThis.requestAnimationFrame||((fn)=>setTimeout(fn,0)))(()=>resolve()));
function suppressLegacyNavigationFirstPaint(){
  if(document.getElementById(LEGACY_NAV_STYLE_ID))return true;
  const style=document.createElement('style');
  style.id=LEGACY_NAV_STYLE_ID;
  style.textContent='main.app>.campus,nav.bottom{display:none!important}';
  (document.head||document.documentElement).append(style);
  document.documentElement?.setAttribute('data-civweave-legacy-navigation','suppressed-before-first-paint-v431');
  return true;
}
function requestedLanguage(){
  let explicit='';
  try{
    const params=new URLSearchParams(location.search);
    const value=String(params.get('lang')||params.get('locale')||'').toLowerCase();
    if(value==='ja'||value==='ja-jp'||params.get('japanese')==='1')explicit='ja';
    else if(value==='en'||value==='en-us')explicit='en';
  }catch{}
  if(explicit){try{localStorage.setItem(LANGUAGE_KEY,explicit)}catch{};return explicit}
  try{return localStorage.getItem(LANGUAGE_KEY)==='ja'?'ja':'en'}catch{return'en'}
}
function activateLanguageMode(){
  const selected=requestedLanguage();
  if(selected!=='ja')return selected;
  document.documentElement?.setAttribute('lang','ja');
  document.documentElement?.setAttribute('data-civweave-language','ja');
  if(document.querySelector(`script[src^="${JAPANESE_MODE_SRC.split('?')[0]}"]`))return selected;
  const script=document.createElement('script');
  script.src=JAPANESE_MODE_SRC;
  script.async=false;
  script.dataset.cwJapaneseMode='';
  (document.head||document.documentElement).append(script);
  return selected;
}
function ensureSupportButton(){
  const foot=document.querySelector('.guide-foot');
  if(!foot)return false;
  if(foot.querySelector('[data-civweave-core-support]'))return true;
  const link=document.createElement('a');
  link.dataset.civweaveCoreSupport='';
  link.className='btn';
  link.href=SUPPORT_URL;
  link.target='_blank';
  link.rel='noopener noreferrer';
  link.textContent='Support';
  link.setAttribute('aria-label','Support Civweave directly on Patreon');
  link.title='Support Civweave directly';
  link.style.cssText='display:inline-flex;align-items:center;justify-content:center;margin-left:auto;padding:7px 8px;font-size:11px;text-decoration:none;white-space:nowrap;';
  foot.append(link);
  return true;
}
function preauthorizeCanonicalCampus(){
  try{
    sessionStorage.setItem(BOOT_KEY,'1');
    for(const key of LEGACY_BOOT_KEYS)sessionStorage.removeItem(key);
    document.documentElement?.setAttribute('data-civweave-install-boundary-preauthorized',VERSION);
    return true;
  }catch{return false}
}
function readRecovery(){try{return parse(sessionStorage.getItem(RECOVERY_KEY))}catch{return null}}
function writeRecovery(value){try{sessionStorage.setItem(RECOVERY_KEY,JSON.stringify(value))}catch{}}
function clearRecovery(){try{sessionStorage.removeItem(RECOVERY_KEY)}catch{}}
function releaseExpiredRecovery(){
  const previous=readRecovery();
  if(previous&&Number(previous.at)<=now()-RECOVERY_WINDOW_MS)clearRecovery();
}
function currentRelease(){
  const param=new URLSearchParams(location.search).get('version');
  if(/^\d+\.\d+\.\d+$/.test(param||''))return param;
  const chip=String(document.querySelector('.version-chip')?.textContent||'').match(/(\d+\.\d+\.\d+)/)?.[1];
  if(chip)return chip;
  const title=String(document.title||'').match(/\bv(\d+\.\d+\.\d+)\b/i)?.[1];
  return title||'';
}
function canonicalUrl(reason='automatic'){
  const target=new URL(CANONICAL_PATH,location.origin);
  target.searchParams.set('installed','1');
  const release=currentRelease();
  if(release)target.searchParams.set('version',release);
  if(requestedLanguage()==='ja')target.searchParams.set('lang','ja');
  target.searchParams.set('recovery',VERSION);
  target.searchParams.set('reason',String(reason||'automatic').slice(0,80));
  target.searchParams.set('epoch',String(now()));
  return target.href;
}
function computedVisible(node){
  if(!node?.isConnected)return false;
  if(typeof getComputedStyle!=='function')return true;
  const style=getComputedStyle(node);
  if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity||1)<=0.01)return false;
  if(document.visibilityState==='visible'&&typeof node.getBoundingClientRect==='function'){
    const rect=node.getBoundingClientRect();
    if((innerWidth||0)>80&&(innerHeight||0)>80&&(rect.width<40||rect.height<40))return false;
  }
  return true;
}
function inspect(){
  const missing=REQUIRED_SELECTORS.filter(selector=>!document.querySelector(selector));
  const app=document.querySelector('main.app');
  const healthy=Boolean(document.documentElement?.isConnected&&document.body?.isConnected&&!missing.length&&computedVisible(app));
  lastInspection={version:VERSION,revision:REVISION,healthy,missing,appVisible:computedVisible(app),visibilityState:document.visibilityState||'unknown',at:new Date().toISOString()};
  if(document.documentElement)document.documentElement.dataset.civweaveWorkingCampusReturn=healthy?'healthy':'unhealthy';
  return lastInspection;
}
function forceReveal(){
  const root=document.documentElement,body=document.body,app=document.querySelector('main.app');
  for(const node of [root,body,app]){
    if(!node?.style)continue;
    node.removeAttribute?.('hidden');
    node.removeAttribute?.('inert');
    node.style.setProperty('visibility','visible','important');
    node.style.setProperty('opacity','1','important');
  }
  if(body?.style)body.style.setProperty('min-height','100%','important');
  if(app?.style){app.style.setProperty('display','block','important');app.style.setProperty('min-height','100vh','important')}
  return Boolean(app);
}
function renderFailSafe(reason,inspection=inspect()){
  if(recoveryPanel?.isConnected)return recoveryPanel;
  const body=document.body||document.documentElement;
  if(!body)return null;
  const panel=document.createElement('section');
  panel.id='cw-working-campus-return-recovery-v425';
  panel.setAttribute('role','alert');
  panel.style.cssText='position:fixed!important;inset:14px!important;z-index:2147483647!important;display:grid!important;place-items:center!important;padding:20px!important;background:#07111ff5!important;color:#fff!important;font:15px/1.45 system-ui,sans-serif!important;visibility:visible!important;opacity:1!important;';
  const card=document.createElement('div');
  card.style.cssText='width:min(620px,100%)!important;padding:20px!important;border:1px solid #8af5d277!important;border-radius:18px!important;background:#0d1830!important;box-shadow:0 18px 60px #000b!important;';
  const title=document.createElement('h1');title.textContent='Civweave stopped a blank-screen recovery loop.';title.style.cssText='margin:0 0 8px!important;font:700 24px/1.15 Georgia,serif!important;color:#fff!important;';
  const copy=document.createElement('p');copy.textContent=`Working Campus did not restore cleanly (${reason}). Your local data is still in place. You can retry the campus or open Downloads without reinstalling.`;copy.style.cssText='margin:0 0 16px!important;color:#dbe7ee!important;';
  const detail=document.createElement('p');detail.textContent=inspection.missing.length?`Missing shell pieces: ${inspection.missing.join(', ')}`:'The shell exists but is not visibly paintable.';detail.style.cssText='margin:0 0 16px!important;color:#9eb4c7!important;font-size:12px!important;';
  const actions=document.createElement('div');actions.style.cssText='display:flex!important;gap:9px!important;flex-wrap:wrap!important;';
  const retry=document.createElement('button');retry.type='button';retry.textContent='Retry Working Campus';retry.style.cssText='padding:10px 13px!important;border:1px solid #8af5d299!important;border-radius:10px!important;background:#17394a!important;color:#fff!important;font-weight:800!important;cursor:pointer!important;';
  retry.addEventListener('click',()=>{clearRecovery();preauthorizeCanonicalCampus();location.replace(canonicalUrl('manual-retry'))});
  const downloads=document.createElement('button');downloads.type='button';downloads.textContent='Open Downloads';downloads.style.cssText='padding:10px 13px!important;border:1px solid #ffd06a88!important;border-radius:10px!important;background:#342913!important;color:#fff!important;font-weight:800!important;cursor:pointer!important;';
  downloads.addEventListener('click',()=>location.assign('/app/index.html?manage=downloads&source=working-campus-recovery'));
  actions.append(retry,downloads);card.append(title,copy,detail,actions);panel.append(card);body.append(panel);recoveryPanel=panel;
  if(document.documentElement)document.documentElement.dataset.civweaveWorkingCampusReturn='failsafe';
  return panel;
}
function clearRetry(){if(retryTimer){clearTimeout(retryTimer);retryTimer=0}}
function scheduleVerify(reason='settle',delay=RETRY_DELAY_MS){
  clearRetry();
  retryTimer=setTimeout(()=>{retryTimer=0;void verifyOrRecover(reason)},Math.max(0,Number(delay)||0));
  return true;
}
function interactionGraceRemaining(){
  if(protectedInteractionActive)return INTERACTION_GRACE_MS;
  if(!lastProtectedInteractionAt)return 0;
  return Math.max(0,INTERACTION_GRACE_MS-(now()-lastProtectedInteractionAt));
}
function deferForProtectedInteraction(reason){
  const remaining=interactionGraceRemaining();
  if(!remaining)return false;
  unhealthySince=0;
  scheduleVerify(`${reason}-interaction-settle`,Math.max(RETRY_DELAY_MS,remaining+40));
  if(document.documentElement)document.documentElement.dataset.civweaveWorkingCampusReturn='interaction-settling';
  return true;
}
function protectedInteractionStart(event){
  const target=event?.target;
  if(!target?.closest?.(WEAVELING_INTERACTION_SELECTOR))return;
  protectedInteractionActive=true;
  lastProtectedInteractionAt=now();
  unhealthySince=0;
  clearRetry();
  if(protectedInteractionFailsafeTimer)clearTimeout(protectedInteractionFailsafeTimer);
  protectedInteractionFailsafeTimer=setTimeout(()=>{
    protectedInteractionFailsafeTimer=0;
    protectedInteractionActive=false;
    lastProtectedInteractionAt=now();
    scheduleVerify('interaction-failsafe-release',INTERACTION_GRACE_MS);
  },INTERACTION_FAILSAFE_MS);
}
function protectedInteractionEnd(){
  if(!protectedInteractionActive)return;
  protectedInteractionActive=false;
  lastProtectedInteractionAt=now();
  if(protectedInteractionFailsafeTimer){clearTimeout(protectedInteractionFailsafeTimer);protectedInteractionFailsafeTimer=0}
  scheduleVerify('interaction-release',INTERACTION_GRACE_MS);
}
async function verifyOnce(reason='check'){
  if(document.visibilityState==='hidden')return{deferred:true,reason};
  if(deferForProtectedInteraction(reason))return{deferred:true,reason,interaction:true};
  preauthorizeCanonicalCampus();
  await frame();await frame();
  let inspection=inspect();
  if(inspection.healthy){unhealthySince=0;clearRetry();releaseExpiredRecovery();return inspection}
  forceReveal();
  await frame();
  inspection=inspect();
  if(inspection.healthy){unhealthySince=0;clearRetry();releaseExpiredRecovery();return inspection}
  const observedAt=now();
  if(!unhealthySince)unhealthySince=observedAt;
  const startupAge=observedAt-bootStartedAt;
  const unhealthyAge=observedAt-unhealthySince;
  const startupSettled=document.readyState==='complete'&&startupAge>=STARTUP_GRACE_MS;
  const failureSustained=unhealthyAge>=UNHEALTHY_HOLD_MS;
  if(!startupSettled||!failureSustained){
    const remaining=Math.max(RETRY_DELAY_MS,Math.min(1000,Math.max(STARTUP_GRACE_MS-startupAge,UNHEALTHY_HOLD_MS-unhealthyAge,0)));
    scheduleVerify(`${reason}-settle`,remaining);
    if(document.documentElement)document.documentElement.dataset.civweaveWorkingCampusReturn='settling';
    return{...inspection,deferred:true,settling:true,startupAge,unhealthyAge};
  }
  if(deferForProtectedInteraction(reason))return{...inspection,deferred:true,interaction:true,startupAge,unhealthyAge};
  const previous=readRecovery();
  const recent=previous&&Number(previous.at)>now()-RECOVERY_WINDOW_MS;
  if(recent){renderFailSafe(reason,inspection);return{...inspection,failsafe:true}}
  writeRecovery({at:now(),reason,count:Number(previous?.count||0)+1,path:location.pathname,revision:REVISION});
  clearRetry();
  location.replace(canonicalUrl(reason));
  return{...inspection,reloading:true};
}
function verifyOrRecover(reason='check'){
  if(verifyFlight)return verifyFlight;
  verifyFlight=verifyOnce(reason).finally(()=>{verifyFlight=null});
  return verifyFlight;
}
function holdBfCache(event){
  if(!event?.persisted)return;
  clearRetry();
  if(document.documentElement)document.documentElement.dataset.civweaveBfcacheHold=VERSION;
  event.stopImmediatePropagation?.();
}
function resume(event){
  preauthorizeCanonicalCampus();
  activateLanguageMode();
  ensureSupportButton();
  if(document.documentElement)document.documentElement.dataset.civweaveBfcacheResume=event?.persisted?VERSION:'normal';
  try{dispatchEvent(new CustomEvent('civweave:working-campus-page-resumed',{detail:{version:VERSION,revision:REVISION,persisted:Boolean(event?.persisted)}}))}catch{}
  if(event?.persisted)void verifyOrRecover('bfcache-return');
  else scheduleVerify('pageshow',RETRY_DELAY_MS);
}
function scheduleInitialCheck(){ensureSupportButton();scheduleVerify('initial-paint',RETRY_DELAY_MS)}

suppressLegacyNavigationFirstPaint();
preauthorizeCanonicalCampus();
activateLanguageMode();
document.addEventListener('pointerdown',protectedInteractionStart,true);
document.addEventListener('pointerup',protectedInteractionEnd,true);
document.addEventListener('pointercancel',protectedInteractionEnd,true);
document.addEventListener('contextmenu',event=>{if(event?.target?.closest?.(WEAVELING_INTERACTION_SELECTOR)){lastProtectedInteractionAt=now();scheduleVerify('interaction-contextmenu',INTERACTION_GRACE_MS)}},true);
addEventListener('pagehide',holdBfCache,true);
addEventListener('pageshow',resume,true);
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden'){clearRetry();return}
  ensureSupportButton();
  const grace=interactionGraceRemaining();
  scheduleVerify('visibility-return',Math.max(RETRY_DELAY_MS,grace+40));
});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scheduleInitialCheck,{once:true});else scheduleInitialCheck();

globalThis.CivweaveWorkingCampusReturnGuardV425=Object.freeze({
  version:VERSION,
  revision:REVISION,
  recoveryKey:RECOVERY_KEY,
  inspect,
  forceReveal,
  verifyOrRecover,
  scheduleVerify,
  clearRecovery,
  canonicalUrl,
  preauthorizeCanonicalCampus,
  activateLanguageMode,
  suppressLegacyNavigationFirstPaint,
  ensureSupportButton,
  supportUrl:SUPPORT_URL,
  language:requestedLanguage,
  startupGraceMs:STARTUP_GRACE_MS,
  unhealthyHoldMs:UNHEALTHY_HOLD_MS,
  interactionGraceMs:INTERACTION_GRACE_MS,
  installBoundaryPolicy:'canonical-campus-preauthorized-before-shared-boundary-v228',
  reloadPolicy:'sustained-failure-only-single-flight-with-interaction-grace',
  legacyNavigationPolicy:'suppressed-before-first-paint-v431',
  state:()=>({lastInspection,recovery:readRecovery(),failsafe:Boolean(recoveryPanel?.isConnected),language:requestedLanguage(),unhealthySince,verificationActive:Boolean(verifyFlight),retryScheduled:Boolean(retryTimer),protectedInteractionActive,lastProtectedInteractionAt})
});
})();