(()=>{
'use strict';

const VERSION='living-school-bootstrap-v199-critical-cache';
const MODULE='/app/cabinets/living-school/living-school-cabinet-v151.mjs';
const STATE_KEY='commonweave.living-school.cabinet.v151';
const ROOM_ID='room';
const MODULE_TIMEOUT_MS=10000;
let attempt=0;
let settled=false;
let lateModulePromise=null;

function esc(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function room(){return document.getElementById(ROOM_ID)}
function mark(state,detail=''){document.documentElement.dataset.livingSchoolBoot=state;document.documentElement.dataset.livingSchoolBootRevision=VERSION;if(detail)document.documentElement.dataset.livingSchoolBootDetail=detail.slice(0,160)}
function installStyle(){if(document.getElementById('ls-bootstrap-v194-style'))return;const style=document.createElement('style');style.id='ls-bootstrap-v194-style';style.textContent=`
.ls-boot-v194{max-width:760px;margin:clamp(14px,4vw,34px) auto;padding:clamp(18px,4vw,34px);border:1px solid #8ecf7066;border-radius:18px;background:linear-gradient(145deg,#0b352af2,#061d18f5);color:#f5e8ba;box-shadow:0 14px 40px #0007}
.ls-boot-v194 small{display:block;color:#9acb70;font-weight:900;letter-spacing:.14em}.ls-boot-v194 h1{margin:.25em 0;font-family:Georgia,serif}.ls-boot-v194 p{line-height:1.5;color:#d6d4ad}.ls-boot-v194 code{overflow-wrap:anywhere;color:#9fe3d1}.ls-boot-v194-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:16px}.ls-boot-v194 button{border:1px solid #ffffff2b;border-radius:11px;padding:10px 13px;background:#173f32;color:#fff7d3;font-weight:900}.ls-boot-v194 button[data-ls-boot-reset]{background:#6c302d}.ls-boot-v194.is-loading{opacity:.86}
`;
document.head.append(style)}
function loading(message='Opening the learning engine from the installed package…'){const target=room();if(!target)return;installStyle();target.innerHTML=`<section class="ls-boot-v194 is-loading" role="status"><small>LIVING SCHOOL STARTUP</small><h1>Preparing Pathway Desk</h1><p>${esc(message)}</p></section>`}
function failure(error){settled=true;mark('failed',error?.message||'unknown');const target=room();if(!target)return;installStyle();const message=String(error?.message||error||'The learning engine did not finish loading.');target.innerHTML=`<section class="ls-boot-v194" role="alert"><small>LOCAL STARTUP RECOVERY</small><h1>Living School could not finish opening.</h1><p>The Commonweave navigation and settings controls remain available. The critical package request stopped waiting instead of locking the page.</p><p><code>${esc(message)}</code></p><div class="ls-boot-v194-actions"><button type="button" data-ls-boot-retry>Retry startup</button><button type="button" data-ls-boot-reset>Back up and reset Living School state</button></div></section>`;target.querySelector('[data-ls-boot-retry]')?.addEventListener('click',()=>boot('manual-retry'));target.querySelector('[data-ls-boot-reset]')?.addEventListener('click',()=>{try{const value=localStorage.getItem(STATE_KEY);if(value)localStorage.setItem(`${STATE_KEY}.recovery-backup.${Date.now()}`,value);localStorage.removeItem(STATE_KEY);sessionStorage.setItem('commonweave.living-school.reset.v199','1')}catch{}location.reload()})}
function moduleTimeout(){return new Promise((_,reject)=>setTimeout(()=>reject(new Error(`The installed learning-engine request did not respond within ${MODULE_TIMEOUT_MS/1000} seconds. The package cache may still be refreshing.`)),MODULE_TIMEOUT_MS))}
async function loadModule(){
  const promise=import(`${MODULE}?v=${VERSION}&attempt=${attempt}`);
  lateModulePromise=promise;
  promise.then(()=>{if(!settled){settled=true;mark('ready','late-module-ready');document.dispatchEvent(new CustomEvent('commonweave:living-school-ready',{detail:{version:VERSION,attempt,reason:'late-module-ready'}}))}}).catch(()=>{});
  return Promise.race([promise,moduleTimeout()]);
}
async function boot(reason='initial'){
  attempt+=1;settled=false;mark('loading',reason);loading(attempt>1?'Retrying the local learning engine…':'Opening the learning engine from the installed package…');
  const slow=setTimeout(()=>{if(!settled)loading('The local package request is still pending. Commonweave will stop waiting and expose recovery controls if it does not answer.')},2500);
  try{
    await loadModule();
    settled=true;clearTimeout(slow);mark('ready',reason);document.dispatchEvent(new CustomEvent('commonweave:living-school-ready',{detail:{version:VERSION,attempt,reason}}));
  }catch(error){clearTimeout(slow);console.error('[Living School] startup failed',error);failure(error)}
}

function start(){if(globalThis.LivingSchoolCabinetV151){settled=true;mark('ready','already-loaded');return}boot('page-load')}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
globalThis.LivingSchoolBootstrapV194={version:VERSION,retry:()=>boot('api-retry'),pending:()=>lateModulePromise};
})();
