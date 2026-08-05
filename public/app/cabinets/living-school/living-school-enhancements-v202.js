(()=>{
'use strict';
const VERSION='living-school-enhancements-after-core-v202';
const SCRIPTS=[
  '/app/cabinets/living-school/living-school-mutation-guard-v196.js?v=image-runtime-v202',
  '/app/local-rails-validator-v170.js?v=image-runtime-v202',
  '/app/mobile-regression-v170.js?v=image-runtime-v202',
  '/app/cabinets/living-school/living-school-runtime-stability-v159.js?v=image-runtime-v202',
  '/app/cabinets/living-school/living-school-research-v162.js?v=image-runtime-v202',
  '/app/merlinites-semantic-planner-v164.js?v=image-runtime-v202',
  '/app/cabinets/living-school/living-school-workbench-v158.js?v=image-runtime-v202',
  '/app/cabinets/living-school/living-school-two-agent-relay-v165.js?v=image-runtime-v202',
  '/app/cabinets/living-school/living-school-paths-v160.js?v=image-runtime-v202'
];
let started=false;
const nextFrame=()=>new Promise(resolve=>(globalThis.requestAnimationFrame||setTimeout)(resolve));
const pause=()=>new Promise(resolve=>(globalThis.requestIdleCallback||((callback)=>setTimeout(callback,24)))(()=>resolve(),{timeout:250}));
function load(src){return new Promise((resolve,reject)=>{const node=document.createElement('script');node.src=src;node.async=false;node.dataset.livingSchoolEnhancement=VERSION;node.onload=()=>resolve(src);node.onerror=()=>reject(new Error(`Living School enhancement failed to load: ${src}`));document.body.append(node)})}
async function start(){
  if(started)return;started=true;
  document.documentElement.dataset.livingSchoolEnhancements='loading';
  await nextFrame();await nextFrame();
  try{
    for(const src of SCRIPTS){await load(src);await pause()}
    document.documentElement.dataset.livingSchoolEnhancements='ready';
    document.dispatchEvent(new CustomEvent('commonweave:living-school-enhancements-ready',{detail:{version:VERSION,scripts:SCRIPTS.length}}));
  }catch(error){
    document.documentElement.dataset.livingSchoolEnhancements='failed';
    document.documentElement.dataset.livingSchoolEnhancementError=String(error.message||error).slice(0,180);
    console.error('[Living School] optional enhancement load failed',error);
  }
}
function listen(){
  if(globalThis.LivingSchoolCabinetV151)return start();
  document.addEventListener('commonweave:living-school-ready',start,{once:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',listen,{once:true});else listen();
globalThis.LivingSchoolEnhancementsV202={version:VERSION,start,scripts:SCRIPTS.slice()};
})();
