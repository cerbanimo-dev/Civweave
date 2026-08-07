(()=>{
'use strict';

const VERSION='1.0.34-persistent-guide-viewport-v216-css-safe-v242';
const ROOT_ID='cw-persistent-guide-chat-v215';
const LAUNCHER_ID='cwp215-launcher';
const STYLE_ID='cw-persistent-guide-viewport-style-v216';
const HEIGHT_VAR='--cwp215-visual-viewport-height';
const REGRESSION_FIXES='/app/regression-fixes-v243.js?v=guide-interaction-r2';

if(globalThis.CivweavePersistentGuideViewportV216?.version===VERSION)return;

let frame=0;

function installStyle(){
  if(document.getElementById(STYLE_ID))return true;
  const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
:root{${HEIGHT_VAR}:100dvh}
#${ROOT_ID}{max-height:min(72dvh,calc(var(${HEIGHT_VAR},100dvh) - var(--cw-themed-nav-height,0px) - env(safe-area-inset-bottom) - 24px));overscroll-behavior:auto!important;touch-action:auto!important}
#${ROOT_ID} [data-log]{overscroll-behavior:auto!important;touch-action:pan-y!important;-webkit-overflow-scrolling:touch}
#${LAUNCHER_ID}{touch-action:manipulation}
`;
  if(!document.head)return false;document.head.append(style);return true;
}
function installRegressionFixes(){
  if(globalThis.CivweaveRegressionFixesV243||document.querySelector(`script[src^="${REGRESSION_FIXES.split('?')[0]}"]`))return true;
  if(!document.head)return false;
  const script=document.createElement('script');script.src=REGRESSION_FIXES;script.async=false;document.head.append(script);return true;
}

function apply(){
  frame=0;installStyle();const height=Math.max(1,Math.round(Number(globalThis.visualViewport?.height||innerHeight||document.documentElement.clientHeight||1)));document.documentElement.style.setProperty(HEIGHT_VAR,`${height}px`)
}
function schedule(){if(frame)return;frame=requestAnimationFrame(apply)}
function boot(){installStyle();installRegressionFixes();apply();globalThis.visualViewport?.addEventListener('resize',schedule,{passive:true});addEventListener('resize',schedule,{passive:true});addEventListener('orientationchange',schedule,{passive:true});try{dispatchEvent(new CustomEvent('civweave:persistent-guide-viewport-ready',{detail:{version:VERSION,visualViewport:Boolean(globalThis.visualViewport),scrollTrap:false,interactionRepair:'v243.1',at:new Date().toISOString()}}))}catch{}}
function destroy(){globalThis.visualViewport?.removeEventListener('resize',schedule);removeEventListener('resize',schedule);removeEventListener('orientationchange',schedule);if(frame)cancelAnimationFrame(frame);frame=0;document.documentElement.style.removeProperty(HEIGHT_VAR);document.getElementById(STYLE_ID)?.remove()}

addEventListener('pagehide',destroy,{once:true});document.readyState==='loading'?addEventListener('DOMContentLoaded',boot,{once:true}):boot();

globalThis.CivweavePersistentGuideViewportV216=Object.freeze({version:VERSION,rootId:ROOT_ID,launcherId:LAUNCHER_ID,refresh:schedule,destroy,state:()=>({visualViewportHeight:globalThis.visualViewport?.height||innerHeight,scrollTrap:false,mutationObserver:false,autoScroll:false,interactionRepair:'v243.1'})});
})();