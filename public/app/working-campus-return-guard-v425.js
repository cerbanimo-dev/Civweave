(()=>{
'use strict';

const VERSION='working-campus-return-v425';
const RECOVERY_KEY='civweave.working-campus.return-recovery.v425';
const RECOVERY_WINDOW_MS=30_000;
const CANONICAL_PATH='/app/working-campus-v156.html';
const BOOT_KEY='civweave.install-boundary.boot.v227';
const LEGACY_BOOT_KEY='civweave.install-boundary.boot.v226';
const REQUIRED_SELECTORS=['main.app','main.app>header.top','main.app>.campus','main.app>.main','nav.bottom','#conversation','#workspace'];
let lastInspection=null;
let recoveryPanel=null;

if(globalThis.CivweaveWorkingCampusReturnGuardV425?.version===VERSION)return;

const now=()=>Date.now();
const parse=value=>{try{return JSON.parse(value||'null')}catch{return null}};
const frame=()=>new Promise(resolve=>(globalThis.requestAnimationFrame||((fn)=>setTimeout(fn,0)))(()=>resolve()));
function preauthorizeCanonicalCampus(){
  try{
    sessionStorage.setItem(BOOT_KEY,'1');
    sessionStorage.setItem(LEGACY_BOOT_KEY,'1');
    document.documentElement?.setAttribute('data-civweave-install-boundary-preauthorized',VERSION);
    return true;
  }catch{return false}
}
function readRecovery(){try{return parse(sessionStorage.getItem(RECOVERY_KEY))}catch{return null}}
function writeRecovery(value){try{sessionStorage.setItem(RECOVERY_KEY,JSON.stringify(value))}catch{}}
function clearRecovery(){try{sessionStorage.removeItem(RECOVERY_KEY)}catch{}}
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
  lastInspection={version:VERSION,healthy,missing,appVisible:computedVisible(app),visibilityState:document.visibilityState||'unknown',at:new Date().toISOString()};
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
async function verifyOrRecover(reason='check'){
  if(document.visibilityState==='hidden')return{deferred:true,reason};
  preauthorizeCanonicalCampus();
  await frame();await frame();
  let inspection=inspect();
  if(inspection.healthy){clearRecovery();return inspection}
  forceReveal();
  await frame();
  inspection=inspect();
  if(inspection.healthy){clearRecovery();return inspection}
  const previous=readRecovery();
  const recent=previous&&Number(previous.at)>now()-RECOVERY_WINDOW_MS;
  if(recent){renderFailSafe(reason,inspection);return{...inspection,failsafe:true}}
  writeRecovery({at:now(),reason,count:Number(previous?.count||0)+1,path:location.pathname});
  location.replace(canonicalUrl(reason));
  return{...inspection,reloading:true};
}
function holdBfCache(event){
  if(!event?.persisted)return;
  if(document.documentElement)document.documentElement.dataset.civweaveBfcacheHold=VERSION;
  event.stopImmediatePropagation?.();
}
function resume(event){
  preauthorizeCanonicalCampus();
  if(document.documentElement)document.documentElement.dataset.civweaveBfcacheResume=event?.persisted?VERSION:'normal';
  try{dispatchEvent(new CustomEvent('civweave:working-campus-page-resumed',{detail:{version:VERSION,persisted:Boolean(event?.persisted)}}))}catch{}
  void verifyOrRecover(event?.persisted?'bfcache-return':'pageshow');
}
function scheduleInitialCheck(){void verifyOrRecover('initial-paint')}

preauthorizeCanonicalCampus();
addEventListener('pagehide',holdBfCache,true);
addEventListener('pageshow',resume,true);
addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void verifyOrRecover('visibility-return')});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scheduleInitialCheck,{once:true});else queueMicrotask(scheduleInitialCheck);

globalThis.CivweaveWorkingCampusReturnGuardV425=Object.freeze({
  version:VERSION,
  recoveryKey:RECOVERY_KEY,
  inspect,
  forceReveal,
  verifyOrRecover,
  clearRecovery,
  canonicalUrl,
  preauthorizeCanonicalCampus,
  installBoundaryPolicy:'canonical-campus-preauthorized-before-shared-boundary',
  state:()=>({lastInspection,recovery:readRecovery(),failsafe:Boolean(recoveryPanel?.isConnected)})
});
})();
