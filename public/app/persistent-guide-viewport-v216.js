(()=>{
'use strict';

const VERSION='1.0.8-persistent-guide-viewport-v216';
const ROOT_ID='cw-persistent-guide-chat-v215';
const LAUNCHER_ID='cwp215-launcher';
const STYLE_ID='cw-persistent-guide-viewport-style-v216';
const HEIGHT_VAR='--cwp215-visual-viewport-height';
const INSET_VAR='--cwp215-keyboard-inset';
const KEYBOARD_THRESHOLD=80;

if(globalThis.CivweavePersistentGuideViewportV216?.version===VERSION)return;

let frame=0;
let observer=null;
let baselineHeight=0;
let keyboardOpen=false;
const onFocusOut=()=>setTimeout(schedule,0);

function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
:root{${HEIGHT_VAR}:100dvh;${INSET_VAR}:0px}
#${ROOT_ID}{bottom:max(calc(var(--cw-themed-nav-height,0px) + env(safe-area-inset-bottom) + 12px),var(${INSET_VAR},0px))!important;max-height:min(calc(100dvh - var(--cw-themed-nav-height,0px) - env(safe-area-inset-bottom) - 28px),calc(var(${HEIGHT_VAR},100dvh) - 16px))!important}
#${ROOT_ID}[data-keyboard-open="true"]{bottom:var(${INSET_VAR},0px)!important;max-height:calc(var(${HEIGHT_VAR},100dvh) - 8px)!important}
#${LAUNCHER_ID}{bottom:max(calc(var(--cw-themed-nav-height,0px) + env(safe-area-inset-bottom) + 12px),calc(var(${INSET_VAR},0px) + 12px))!important}
@media(max-width:680px){#${ROOT_ID}{max-height:min(calc(88dvh - var(--cw-themed-nav-height,0px)),calc(var(${HEIGHT_VAR},100dvh) - 8px))!important}#${ROOT_ID}[data-keyboard-open="true"]{max-height:calc(var(${HEIGHT_VAR},100dvh) - 4px)!important;border-radius:20px 20px 0 0}}
`;
  const head=document.head;if(!head)return false;head.append(style);return true;
}

function isChatInput(node){
  return node instanceof Element&&Boolean(node.closest(`#${ROOT_ID}`))&&node.matches('textarea,input:not([type]),input[type="text"],input[type="search"],input[type="email"],input[type="url"],input[type="tel"],[contenteditable="true"]');
}

function viewportMetrics(){
  const viewport=globalThis.visualViewport;
  const height=Math.max(1,Number(viewport?.height||innerHeight||document.documentElement.clientHeight||1));
  const offsetTop=Math.max(0,Number(viewport?.offsetTop||0));
  const visibleBottom=offsetTop+height;
  const layoutHeight=Math.max(
    Number(innerHeight||0),
    Number(document.documentElement.clientHeight||0),
    visibleBottom
  );
  return{height,offsetTop,visibleBottom,layoutHeight};
}

function apply(){
  frame=0;
  installStyle();
  const metrics=viewportMetrics();
  const activeInput=isChatInput(document.activeElement);
  const settled=metrics.layoutHeight-metrics.height<KEYBOARD_THRESHOLD&&metrics.offsetTop<KEYBOARD_THRESHOLD;
  if(!baselineHeight||(!activeInput&&settled))baselineHeight=metrics.layoutHeight;
  else baselineHeight=Math.max(baselineHeight,metrics.layoutHeight,metrics.visibleBottom);
  const occluded=Math.max(0,baselineHeight-metrics.visibleBottom);
  keyboardOpen=activeInput&&(occluded>KEYBOARD_THRESHOLD||baselineHeight-metrics.height>KEYBOARD_THRESHOLD);
  const keyboardInset=keyboardOpen?Math.round(occluded):0;
  const height=Math.round(metrics.height);
  document.documentElement.style.setProperty(HEIGHT_VAR,`${height}px`);
  document.documentElement.style.setProperty(INSET_VAR,`${keyboardInset}px`);
  const root=document.getElementById(ROOT_ID);
  const launcher=document.getElementById(LAUNCHER_ID);
  root?.setAttribute('data-keyboard-open',String(keyboardOpen));
  launcher?.setAttribute('data-keyboard-open',String(keyboardOpen));
  if(keyboardOpen){
    const input=root?.querySelector('textarea:focus,input:focus,[contenteditable="true"]:focus');
    input?.scrollIntoView?.({block:'nearest',inline:'nearest'});
  }
}

function schedule(){
  if(frame)return;
  frame=requestAnimationFrame(apply);
}

function resetBaseline(){
  baselineHeight=0;
  schedule();
  setTimeout(schedule,120);
  setTimeout(schedule,420);
}

function boot(){
  installStyle();
  apply();
  globalThis.visualViewport?.addEventListener('resize',schedule,{passive:true});
  globalThis.visualViewport?.addEventListener('scroll',schedule,{passive:true});
  addEventListener('resize',schedule,{passive:true});
  addEventListener('orientationchange',resetBaseline,{passive:true});
  document.addEventListener('focusin',schedule,true);
  document.addEventListener('focusout',onFocusOut,true);
  observer=new MutationObserver(schedule);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  try{dispatchEvent(new CustomEvent('civweave:persistent-guide-viewport-ready',{detail:{version:VERSION,visualViewport:Boolean(globalThis.visualViewport),at:new Date().toISOString()}}))}catch{}
}

function destroy(){
  observer?.disconnect();
  globalThis.visualViewport?.removeEventListener('resize',schedule);
  globalThis.visualViewport?.removeEventListener('scroll',schedule);
  removeEventListener('resize',schedule);
  removeEventListener('orientationchange',resetBaseline);
  document.removeEventListener('focusin',schedule,true);
  document.removeEventListener('focusout',onFocusOut,true);
  document.documentElement.style.removeProperty(HEIGHT_VAR);
  document.documentElement.style.removeProperty(INSET_VAR);
  document.getElementById(STYLE_ID)?.remove();
}

addEventListener('pagehide',destroy,{once:true});
document.readyState==='loading'?addEventListener('DOMContentLoaded',boot,{once:true}):boot();

globalThis.CivweavePersistentGuideViewportV216=Object.freeze({
  version:VERSION,
  rootId:ROOT_ID,
  launcherId:LAUNCHER_ID,
  refresh:schedule,
  destroy,
  state:()=>({keyboardOpen,baselineHeight,visualViewportHeight:globalThis.visualViewport?.height||innerHeight})
});
})();
