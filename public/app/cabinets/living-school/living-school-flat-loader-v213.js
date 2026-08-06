(()=>{
'use strict';
const VERSION='living-school-flat-loader-v217-single-tap-owner';
const CORE_ENHANCEMENTS=[
  '/app/cabinets/living-school/living-school-mutation-guard-v196.js?v=flat-v213',
  '/app/local-rails-validator-v170.js?v=flat-v213',
  '/app/mobile-regression-v170.js?v=flat-v213',
  '/app/cabinets/living-school/living-school-runtime-stability-v159.js?v=flat-v213',
  '/app/cabinets/living-school/living-school-workbench-v158.js?v=flat-v213',
  '/app/cabinets/living-school/living-school-paths-v213.js?v=direct-controls-v213',
  '/app/cabinets/living-school/living-school-interactions-v213.js?v=direct-surfaces-v217',
  '/app/cabinets/living-school/living-school-research-v162.js?v=flat-v213',
  '/app/merlinites-semantic-planner-v164.js?v=flat-v213'
];
// Compatibility marker: living-school-interactions-v213.js?v=direct-surfaces-v213
const RICH_MEDIA='/app/cabinets/living-school/living-school-two-agent-relay-v165.js?v=flat-opt-in-v213';
const loaded=new Set();
let corePromise=null;
let richPromise=null;
const frame=()=>new Promise(resolve=>(globalThis.requestAnimationFrame||setTimeout)(resolve));
const idle=()=>new Promise(resolve=>(globalThis.requestIdleCallback||((callback)=>setTimeout(callback,32)))(()=>resolve(),{timeout:350}));
function coreLoadOrder(){
  const prelude=CORE_ENHANCEMENTS.filter(src=>!/(living-school-(?:workbench|paths|interactions|research)|merlinites-semantic-planner)/.test(src));
  const interactionOwner=CORE_ENHANCEMENTS.filter(src=>src.includes('living-school-interactions-'));
  const pathOwner=CORE_ENHANCEMENTS.filter(src=>src.includes('living-school-paths-'));
  const prioritized=new Set([...prelude,...interactionOwner,...pathOwner]);
  const deferred=CORE_ENHANCEMENTS.filter(src=>!prioritized.has(src));
  return[...prelude,...interactionOwner,...pathOwner,...deferred];
}
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
    document.documentElement.dataset.livingSchoolInteractionOwner='loading';
    await frame();await frame();
    for(const src of coreLoadOrder()){
      await load(src);
      if(src.includes('living-school-interactions-'))document.documentElement.dataset.livingSchoolInteractionOwner='direct-v217';
      await idle();
    }
    document.documentElement.dataset.livingSchoolFlatEnhancements='ready';
    document.dispatchEvent(new CustomEvent('commonweave:living-school-flat-ready',{detail:{version:VERSION,count:CORE_ENHANCEMENTS.length,interactionOwner:'direct-v217',order:coreLoadOrder()}}));
    return true;
  })().catch(error=>{
    document.documentElement.dataset.livingSchoolFlatEnhancements='failed';
    document.documentElement.dataset.livingSchoolInteractionOwner='failed';
    document.documentElement.dataset.livingSchoolFlatError=String(error.message||error).slice(0,180);
    console.error('[Living School] flat enhancement load failed',error);
    return false;
  });
  return corePromise;
}
async function enableRichMedia(){
  if(richPromise)return richPromise;
  richPromise=(async()=>{
    await loadCore();await idle();await load(RICH_MEDIA);
    document.documentElement.dataset.livingSchoolRichMedia='ready';return true;
  })().catch(error=>{
    document.documentElement.dataset.livingSchoolRichMedia='failed';
    console.error('[Living School] optional rich media relay failed',error);return false;
  });
  return richPromise;
}
function begin(){
  if(globalThis.LivingSchoolCabinetV151)loadCore();
  else document.addEventListener('commonweave:living-school-ready',loadCore,{once:true});
  document.addEventListener('commonweave:living-school-enable-rich-media',enableRichMedia);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',begin,{once:true});else begin();
globalThis.LivingSchoolFlatLoaderV213={version:VERSION,loadCore,enableRichMedia,loaded:()=>[...loaded],order:()=>coreLoadOrder().slice(),interactionOwner:'direct-v217'};
})();
