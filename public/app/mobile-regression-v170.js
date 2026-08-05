(()=>{
'use strict';
const VERSION='1.0.4-mobile-regression-v175-deterministic';
if(globalThis.CommonweaveMobileRegressionV170?.version===VERSION)return;
let lastLivingError='';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function openSettings(){const controller=globalThis.CommonweaveModelSettingsControllerV173;if(!controller?.open)throw new Error('The unified Commonweave AI settings controller is unavailable.');return controller.open()}
function patchLoader(){const api=globalThis.CommonweaveFamilyAILoaderV105;if(!api||api.__cw175Settings)return false;api.openSettings=openSettings;Object.defineProperty(api,'__cw175Settings',{value:true});return true}
function suppressExtraLaunchers(){document.querySelectorAll('#gc153-launcher,.gc153-launcher,[data-commonweave-bottom-launcher],[data-weaveling-launcher]').forEach(node=>{node.hidden=true;node.setAttribute('aria-hidden','true');node.tabIndex=-1})}
function showLivingRecovery(message){const room=document.getElementById('room');if(!room||room.querySelector('.ls-recovery'))return;room.innerHTML=`<section class="ls-recovery"><small>LIVING SCHOOL STARTUP RECOVERY</small><h1>The Pathway Desk did not finish opening.</h1><p>${String(message||'The core learning module did not become ready.').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</p><div class="ls-actions"><button type="button" data-ls170-retry>Retry this screen</button><button type="button" data-ls170-reset>Back up and reset the local school view</button></div></section>`}
function resetLiving(){const key='commonweave.living-school.cabinet.v151',value=localStorage.getItem(key);if(value)localStorage.setItem(`${key}.backup.${Date.now()}`,value);localStorage.removeItem(key);location.reload()}
async function verifyLivingBoot(){if(!document.documentElement.hasAttribute('data-living-school-cabinet'))return;await sleep(4200);const room=document.getElementById('room'),api=globalThis.LivingSchoolCabinetV151;if(api&&room&&!room.children.length){try{api.setRoom('desk')}catch(error){lastLivingError=error.message}}await sleep(250);if(!globalThis.LivingSchoolCabinetV151||!room?.children.length)showLivingRecovery(lastLivingError||'The cabinet module was blocked before it could render its first room. Your saved record has not been deleted.')}
function bind(){document.addEventListener('click',event=>{if(event.target.closest?.('[data-ls170-retry]'))location.reload();if(event.target.closest?.('[data-ls170-reset]'))resetLiving()},true);addEventListener('error',event=>{const source=String(event.filename||'');if(source.includes('living-school-cabinet')||source.includes('/services/living-school/modules/'))lastLivingError=event.message||'A Living School module failed to load.'});addEventListener('unhandledrejection',event=>{const text=String(event.reason?.message||event.reason||'');if(/living school|living-school|rubric|project gate|cerbanimo bridge/i.test(text))lastLivingError=text})}
function patch(){patchLoader();suppressExtraLaunchers()}
function boot(){bind();patch();let attempts=0;const timer=setInterval(()=>{patch();if(patchLoader()||attempts++>40)clearInterval(timer)},100);new MutationObserver(records=>{if(records.some(record=>record.addedNodes.length))queueMicrotask(patch)}).observe(document.documentElement,{childList:true,subtree:true});verifyLivingBoot()}
document.readyState==='loading'?addEventListener('DOMContentLoaded',boot,{once:true}):boot();
globalThis.CommonweaveMobileRegressionV170={version:VERSION,openSettings,verifyLivingBoot,defaultProvider:'deterministic',transformerActive:false};
})();
