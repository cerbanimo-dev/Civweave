(()=>{
'use strict';
const params=new URLSearchParams(location.search);
const BOOT_KEY='civweave.install-boundary.boot.v227';
const LEGACY_BOOT_KEY='civweave.install-boundary.boot.v226';
const SAFE_KEY='civweave.boot-recovery.safe.v426';
const TERMS_KEY='civweave.legal.terms.acceptance.v1';
const TERMS_VERSION='2026-08-13';
const TERMS_URL='/legal/civweave-terms-of-service.txt';
const FALLBACK_VERSION='1.0.131';
const RELEASE_TIMEOUT_MS=1500;
const WORKER_STEP_TIMEOUT_MS=1800;
const ROUTE_TIMEOUT_MS=2200;
let termsGatePromise=null;
const installedDisplay=()=>navigator.standalone===true||['standalone','fullscreen','minimal-ui','window-controls-overlay'].some(mode=>matchMedia(`(display-mode: ${mode})`).matches);
const legacyEntry=/^\/app\/installed-entry-v146(?:\.html)?$/.test(location.pathname);
const explicitInstalled=params.get('installed')==='1'||legacyEntry;
const localDeveloper=()=>['localhost','127.0.0.1','::1'].includes(location.hostname)&&params.get('developer')==='1';
const semver=value=>/^\d+\.\d+\.\d+$/.test(String(value||''))?String(value):'';
const recoveryUi=()=>globalThis.CivweaveBootRecoveryV426||null;
const parse=value=>{try{return JSON.parse(value||'null')}catch{return null}};
function bounded(promise,timeoutMs,label='operation'){
  return new Promise((resolve,reject)=>{
    let settled=false;
    const timer=setTimeout(()=>{if(settled)return;settled=true;reject(new Error(`${label} timed out after ${timeoutMs} ms`))},timeoutMs);
    Promise.resolve(promise).then(value=>{if(settled)return;settled=true;clearTimeout(timer);resolve(value)},error=>{if(settled)return;settled=true;clearTimeout(timer);reject(error)});
  });
}
function authorize(){try{sessionStorage.setItem(BOOT_KEY,'1');sessionStorage.setItem(LEGACY_BOOT_KEY,'1')}catch{}}
function readTermsAcceptance(){
  try{
    const record=parse(localStorage.getItem(TERMS_KEY));
    return record&&record.schema==='civweave.legal.acceptance.v1'&&record.termsVersion===TERMS_VERSION&&record.acceptedAt?record:null;
  }catch{return null}
}
function writeTermsAcceptance(){
  const record={schema:'civweave.legal.acceptance.v1',platform:'civweave',termsVersion:TERMS_VERSION,termsUrl:TERMS_URL,acceptedAt:new Date().toISOString(),method:'clickwrap'};
  localStorage.setItem(TERMS_KEY,JSON.stringify(record));
  const verified=readTermsAcceptance();
  if(!verified)throw new Error('Civweave could not persist your Terms acceptance on this device.');
  try{dispatchEvent(new CustomEvent('civweave:terms-accepted',{detail:{...verified}}))}catch{}
  return verified;
}
function styleTermsGate(){
  if(document.getElementById('cw-terms-gate-style-v1'))return;
  const style=document.createElement('style');
  style.id='cw-terms-gate-style-v1';
  style.textContent=`#cw-terms-gate-v1{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;overflow:auto;padding:max(18px,env(safe-area-inset-top)) 16px max(18px,env(safe-area-inset-bottom));background:radial-gradient(circle at 50% 20%,#173949 0,#07131dee 42%,#03090df8 100%);color:#f5fbff;font:15px/1.48 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}#cw-terms-gate-v1 .cw-terms-card{width:min(680px,100%);padding:22px;border:1px solid #8de5ef66;border-radius:22px;background:#0b1a24f7;box-shadow:0 24px 80px #000c}#cw-terms-gate-v1 small{display:block;color:#8de5ef;font-weight:900;letter-spacing:.12em;text-transform:uppercase}#cw-terms-gate-v1 h1{margin:7px 0 10px;font:700 clamp(1.55rem,6vw,2.25rem)/1.08 Georgia,serif}#cw-terms-gate-v1 p{margin:0 0 14px;color:#c5d5de}#cw-terms-gate-v1 .cw-terms-meta{font-size:.82rem;color:#95abb7}#cw-terms-gate-v1 .cw-terms-link{display:inline-flex;margin:1px 0 16px;color:#a7f0f7;font-weight:850;text-underline-offset:3px}#cw-terms-gate-v1 label{display:grid;grid-template-columns:auto 1fr;align-items:start;gap:11px;padding:14px;border:1px solid #ffffff22;border-radius:14px;background:#ffffff08;cursor:pointer}#cw-terms-gate-v1 input{width:22px;height:22px;margin:1px 0 0;accent-color:#8de5ef}#cw-terms-gate-v1 .cw-terms-actions{display:grid;grid-template-columns:1fr auto;gap:9px;margin-top:15px}#cw-terms-gate-v1 button,#cw-terms-gate-v1 a.cw-terms-exit{min-height:48px;border-radius:13px;padding:11px 15px;font:inherit;font-weight:900;text-align:center;text-decoration:none}#cw-terms-gate-v1 button{border:0;background:linear-gradient(135deg,#8de5ef,#f3d77d);color:#07131c;cursor:pointer}#cw-terms-gate-v1 button:disabled{filter:saturate(.25);opacity:.48;cursor:not-allowed}#cw-terms-gate-v1 a.cw-terms-exit{display:grid;place-items:center;border:1px solid #ffffff2b;background:#ffffff08;color:#d6e3ea}#cw-terms-gate-v1 .cw-terms-error{margin:10px 0 0;color:#ffd391;font-size:.84rem}body.cw-terms-pending>main{pointer-events:none!important;user-select:none!important}@media(max-width:560px){#cw-terms-gate-v1 .cw-terms-card{padding:18px}#cw-terms-gate-v1 .cw-terms-actions{grid-template-columns:1fr}#cw-terms-gate-v1 a.cw-terms-exit{order:2}}`;
  document.head.append(style);
}
function ensureTermsAccepted(){
  const accepted=readTermsAcceptance();
  if(accepted)return Promise.resolve(accepted);
  if(termsGatePromise)return termsGatePromise;
  termsGatePromise=new Promise((resolve,reject)=>{
    const mount=()=>{
      const current=readTermsAcceptance();
      if(current){termsGatePromise=null;resolve(current);return}
      styleTermsGate();
      document.body?.classList.add('cw-terms-pending');
      document.querySelector('#cw-terms-gate-v1')?.remove();
      const gate=document.createElement('section');
      gate.id='cw-terms-gate-v1';
      gate.setAttribute('role','dialog');
      gate.setAttribute('aria-modal','true');
      gate.setAttribute('aria-labelledby','cw-terms-title');
      gate.innerHTML=`<div class="cw-terms-card"><small>Civweave onboarding · required</small><h1 id="cw-terms-title">Agree before entering Civweave</h1><p>Civweave is one connected platform spanning Living School, Cerbanimo, FellowFare, Anarchadia, AI features, and federated nodes. Use of the platform requires affirmative agreement to the current Terms of Service.</p><p class="cw-terms-meta">Terms version ${TERMS_VERSION} · Effective August 13, 2026</p><a class="cw-terms-link" href="${TERMS_URL}" target="_blank" rel="noopener">Read the full Civweave Terms of Service</a><label><input id="cw-terms-consent" type="checkbox"><span><strong>I agree to the Civweave Terms of Service.</strong><br><span class="cw-terms-meta">Checking this box and selecting “Agree & enter Civweave” is my electronic acceptance of the Terms.</span></span></label><div class="cw-terms-actions"><button id="cw-terms-accept" type="button" disabled>Agree & enter Civweave</button><a class="cw-terms-exit" href="/app/index.html?terms=declined">I do not agree</a></div><p id="cw-terms-error" class="cw-terms-error" role="alert" hidden></p></div>`;
      const consent=gate.querySelector('#cw-terms-consent');
      const accept=gate.querySelector('#cw-terms-accept');
      const error=gate.querySelector('#cw-terms-error');
      consent.addEventListener('change',()=>{accept.disabled=!consent.checked;if(error)error.hidden=true});
      accept.addEventListener('click',()=>{
        if(!consent.checked)return;
        try{
          const record=writeTermsAcceptance();
          gate.remove();
          document.body?.classList.remove('cw-terms-pending');
          termsGatePromise=null;
          resolve(record);
        }catch(storageError){
          if(error){error.textContent=`Acceptance could not be saved on this device: ${storageError?.message||storageError}`;error.hidden=false}
        }
      });
      document.body.append(gate);
      recoveryUi()?.setStatus?.('Terms acceptance is required before Civweave can open.');
      queueMicrotask(()=>consent.focus());
    };
    if(document.body)mount();else document.addEventListener('DOMContentLoaded',mount,{once:true});
  }).catch(error=>{termsGatePromise=null;throw error});
  return termsGatePromise;
}
function safeRecoveryRequested(){
  if(params.get('recovery')==='safe')return true;
  try{return sessionStorage.getItem(SAFE_KEY)==='1'}catch{return false}
}
function versionFromManifest(manifest){
  const named=String(manifest?.name||'').match(/\bv(\d+\.\d+\.\d+)\b/i)?.[1];
  if(named)return named;
  try{return semver(new URL(manifest?.start_url||'',location.origin).searchParams.get('version'))}catch{return''}
}
async function resolveReleaseVersion(){
  const scriptUrl=(()=>{try{return new URL(document.currentScript?.src||'',location.href)}catch{return null}})();
  const explicit=semver(scriptUrl?.searchParams.get('v'))||semver(params.get('version'));
  if(explicit)return explicit;
  const controller=typeof AbortController==='function'?new AbortController():null;
  const timer=controller?setTimeout(()=>controller.abort(),RELEASE_TIMEOUT_MS):null;
  try{
    const response=await bounded(fetch(`/app/manifest.webmanifest?boot=${Date.now()}`,{cache:'no-store',signal:controller?.signal}),RELEASE_TIMEOUT_MS,'release manifest');
    if(response.ok){const resolved=versionFromManifest(await bounded(response.json(),700,'release manifest parse'));if(resolved)return resolved}
  }catch{}finally{if(timer)clearTimeout(timer)}
  return FALLBACK_VERSION;
}
function waitForControllerChange(timeout=1600){
  return new Promise(resolve=>{
    let settled=false;
    const finish=()=>{if(settled)return;settled=true;clearTimeout(timer);navigator.serviceWorker?.removeEventListener?.('controllerchange',finish);resolve(true)};
    const timer=setTimeout(finish,timeout);
    navigator.serviceWorker?.addEventListener?.('controllerchange',finish,{once:true});
  });
}
async function refreshWorker(releaseVersion){
  if(!('serviceWorker'in navigator))return null;
  const ui=recoveryUi();
  try{
    const workerUrl=`/service-worker-v203.js?v=${encodeURIComponent(releaseVersion)}-lightweight-shell-v208&revision=boot-recovery-v426`;
    ui?.setStatus?.('Checking the installed app shell…');
    let registration=await bounded(navigator.serviceWorker.register(workerUrl,{scope:'/',updateViaCache:'none'}),WORKER_STEP_TIMEOUT_MS,'service worker registration');
    await bounded(registration.update(),WORKER_STEP_TIMEOUT_MS,'service worker update').catch(()=>null);
    registration=await bounded(navigator.serviceWorker.getRegistration('/'),700,'service worker lookup').catch(()=>registration)||registration;
    const candidate=registration.waiting||registration.installing;
    if(candidate){
      const activate=()=>{try{candidate.postMessage({type:'SKIP_WAITING'})}catch{}};
      if(candidate.state==='installed')activate();
      else candidate.addEventListener('statechange',()=>{if(candidate.state==='installed')activate()});
      await waitForControllerChange(1600);
    }
    return registration;
  }catch{
    ui?.setStatus?.('The existing local shell is taking over startup.');
    return null;
  }
}
function ensureRoutes(releaseVersion){
  if(globalThis.CivweaveSystemRoutesV227)return Promise.resolve(globalThis.CivweaveSystemRoutesV227);
  const routeUrl=`/app/system-routes-v227.js?v=${encodeURIComponent(releaseVersion)}-five-system-route-contract-v227`;
  return bounded(new Promise((resolve,reject)=>{
    const existing=[...document.scripts].find(script=>script.src&&new URL(script.src,location.href).pathname==='/app/system-routes-v227.js');
    const ready=()=>globalThis.CivweaveSystemRoutesV227?resolve(globalThis.CivweaveSystemRoutesV227):reject(new Error('Route contract loaded without becoming ready.'));
    if(existing){
      if(globalThis.CivweaveSystemRoutesV227){resolve(globalThis.CivweaveSystemRoutesV227);return}
      existing.addEventListener('load',ready,{once:true});existing.addEventListener('error',()=>reject(new Error('Route contract failed to load.')),{once:true});return;
    }
    const script=document.createElement('script');script.src=routeUrl;script.async=false;script.onload=ready;script.onerror=()=>reject(new Error('Route contract failed to load.'));document.head.append(script);
  }),ROUTE_TIMEOUT_MS,'route contract');
}
function fallbackDestination(releaseVersion){
  const destination=new URL('/app/working-campus-v156.html',location.origin);
  destination.searchParams.set('installed','1');
  destination.searchParams.set('version',releaseVersion);
  destination.searchParams.set('navigation','five-system-route-contract-v227-fallback');
  destination.searchParams.set('launch','installed-entry-v426');
  if(safeRecoveryRequested())destination.searchParams.set('recovery','safe');
  return destination;
}
async function boot(){
  const ui=recoveryUi();
  await ensureTermsAccepted();
  authorize();
  ui?.setStatus?.('Reading the installed release…');
  const releaseVersion=await bounded(resolveReleaseVersion(),RELEASE_TIMEOUT_MS+350,'release resolution').catch(()=>FALLBACK_VERSION);
  await refreshWorker(releaseVersion);
  const requested=params.get('system')||params.get('target')||'civweave';
  const aliases={hub:'civweave',cabinet:'civweave',cabinets:'civweave',cabinetonly:'civweave',lite:'civweave'};
  const system=aliases[requested]||requested;
  ui?.setStatus?.('Opening the local campus…');
  let destination;
  try{
    const routes=await ensureRoutes(releaseVersion);
    destination=routes.urlFor(routes.routeFor(system)?system:'civweave',{origin:location.origin,version:releaseVersion,source:'installed-entry-v426',developer:localDeveloper()});
    if(safeRecoveryRequested())destination.searchParams.set('recovery','safe');
  }catch{
    destination=fallbackDestination(releaseVersion);
  }
  ui?.markRouted?.();
  location.replace(destination.href);
}
const api=Object.freeze({version:'1.0.131-terms-clickwrap-v1',installedDisplay,explicitInstalled,resolveReleaseVersion,refreshWorker,safeRecoveryRequested,ensureTermsAccepted,readTermsAcceptance,termsVersion:TERMS_VERSION,termsUrl:TERMS_URL,termsKey:TERMS_KEY});
globalThis.CivweaveInstalledEntryV146=api;
document.addEventListener('click',event=>{
  const target=event.target instanceof Element?event.target.closest('#boot-safe'):null;
  if(!target||readTermsAcceptance())return;
  event.preventDefault();
  event.stopImmediatePropagation();
  ensureTermsAccepted().then(()=>target.click()).catch(error=>recoveryUi()?.showRecovery?.(`Terms acceptance could not be completed: ${error?.message||error}`));
},true);
boot().catch(error=>{
  console.error('[Civweave] Installed bootstrap recovery caught a launch failure.',error);
  recoveryUi()?.showRecovery?.(`The normal startup path stopped before the campus opened: ${error?.message||error}`);
});
})();
