(()=>{
'use strict';
const VERSION='living-school-flat-loader-v212-curriculum-launch';
const CORE_ENHANCEMENTS=[
  '/app/cabinets/living-school/living-school-mutation-guard-v196.js?v=flat-v212',
  '/app/local-rails-validator-v170.js?v=flat-v212',
  '/app/mobile-regression-v170.js?v=flat-v212',
  '/app/cabinets/living-school/living-school-runtime-stability-v159.js?v=flat-v212',
  '/app/cabinets/living-school/living-school-workbench-v158.js?v=flat-v212',
  '/app/cabinets/living-school/living-school-curriculum-launch-v212.js?v=canonical-state-v212',
  '/app/cabinets/living-school/living-school-paths-v211.js?v=stable-controls-v211',
  '/app/cabinets/living-school/living-school-research-v162.js?v=flat-v212',
  '/app/merlinites-semantic-planner-v164.js?v=flat-v212'
];
const RICH_MEDIA='/app/cabinets/living-school/living-school-two-agent-relay-v165.js?v=flat-opt-in-v212';
const loaded=new Set();
let corePromise=null;
let richPromise=null;
const frame=()=>new Promise(resolve=>(globalThis.requestAnimationFrame||setTimeout)(resolve));
const idle=()=>new Promise(resolve=>(globalThis.requestIdleCallback||((callback)=>setTimeout(callback,32)))(()=>resolve(),{timeout:350}));
function load(src){
  if(loaded.has(src))return Promise.resolve(src);
  return new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=src;script.async=false;script.dataset.livingSchoolFlat=VERSION;
    script.onload=()=>{loaded.add(src);resolve(src)};
    script.onerror=()=>reject(new Error(`Flat Living School enhancement failed: ${src}`));
    document.body.append(script);
  });
}
async function loadCore(){
  if(corePromise)return corePromise;
  corePromise=(async()=>{
    document.documentElement.dataset.livingSchoolFlatEnhancements='loading';
    await frame();await frame();
    for(const src of CORE_ENHANCEMENTS){await load(src);await idle()}
    document.documentElement.dataset.livingSchoolFlatEnhancements='ready';
    document.dispatchEvent(new CustomEvent('commonweave:living-school-flat-ready',{detail:{version:VERSION,count:CORE_ENHANCEMENTS.length}}));
    return true;
  })().catch(error=>{
    document.documentElement.dataset.livingSchoolFlatEnhancements='failed';
    document.documentElement.dataset.livingSchoolFlatError=String(error.message||error).slice(0,180);
    console.error('[Living School] flat enhancement load failed',error);
    return false;
  });
  return corePromise;
}
async function enableRichMedia(){
  if(richPromise)return richPromise;
  richPromise=(async()=>{
    await loadCore();
    await idle();
    await load(RICH_MEDIA);
    document.documentElement.dataset.livingSchoolRichMedia='ready';
    return true;
  })().catch(error=>{
    document.documentElement.dataset.livingSchoolRichMedia='failed';
    console.error('[Living School] optional rich media relay failed',error);
    return false;
  });
  return richPromise;
}
function begin(){
  if(globalThis.LivingSchoolCabinetV151)loadCore();
  else document.addEventListener('commonweave:living-school-ready',loadCore,{once:true});
  document.addEventListener('commonweave:living-school-enable-rich-media',enableRichMedia);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',begin,{once:true});else begin();
globalThis.LivingSchoolFlatLoaderV212={version:VERSION,loadCore,enableRichMedia,loaded:()=>[...loaded]};
})();
