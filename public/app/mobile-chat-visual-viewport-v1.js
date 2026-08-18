(()=>{
'use strict';

const VERSION='1.0.2-mobile-chat-visual-viewport-v1-stacked-compact-composer';
const ROOT_ID='cw-persistent-guide-chat-v215';
const STYLE_ID='cw-mobile-chat-visual-viewport-v1-style';
if(globalThis.CivweaveMobileChatVisualViewportV1?.version===VERSION)return;

let frame=0;
let bound=false;
const mobile=()=>globalThis.matchMedia?.('(max-width:720px)')?.matches??Number(innerWidth||0)<=720;
const px=value=>`${Math.max(0,Math.round(Number(value)||0))}px`;

function metrics(){
  const viewport=globalThis.visualViewport;
  return Object.freeze({
    height:Math.max(1,Math.round(viewport?.height||innerHeight||1)),
    width:Math.max(1,Math.round(viewport?.width||innerWidth||1)),
    top:Math.max(0,Math.round(viewport?.offsetTop||0)),
    left:Math.max(0,Math.round(viewport?.offsetLeft||0))
  });
}

function apply(){
  const root=document.documentElement;
  if(!root)return null;
  const value=metrics();
  if(!mobile()){
    for(const name of ['--cw-chat-visual-height','--cw-chat-visual-width','--cw-chat-visual-top','--cw-chat-visual-left'])root.style.removeProperty(name);
    return value;
  }
  root.style.setProperty('--cw-chat-visual-height',px(value.height));
  root.style.setProperty('--cw-chat-visual-width',px(value.width));
  root.style.setProperty('--cw-chat-visual-top',px(value.top));
  root.style.setProperty('--cw-chat-visual-left',px(value.left));
  const chat=document.getElementById(ROOT_ID);
  if(chat)chat.dataset.civweaveVisualViewport='v1-stacked-compact-composer';
  return value;
}

function schedule(){
  if(frame)return;
  const raf=globalThis.requestAnimationFrame||((callback)=>setTimeout(callback,0));
  frame=raf(()=>{frame=0;apply()});
}

function installStyle(){
  document.getElementById(STYLE_ID)?.remove();
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
@media(max-width:720px){
html[data-civweave-mobile-ai-hardening="v302"] body #${ROOT_ID}:not([hidden]):not(.is-minimized),
html body #${ROOT_ID}:not([hidden]):not(.is-minimized){
  position:fixed!important;
  inset:auto!important;
  top:var(--cw-chat-visual-top,0px)!important;
  left:var(--cw-chat-visual-left,0px)!important;
  right:auto!important;
  bottom:auto!important;
  width:var(--cw-chat-visual-width,100vw)!important;
  height:var(--cw-chat-visual-height,100dvh)!important;
  min-height:0!important;
  max-height:var(--cw-chat-visual-height,100dvh)!important;
  margin:0!important;
  overflow:hidden!important;
  box-sizing:border-box!important;
  display:flex!important;
  flex-direction:column!important;
  align-items:stretch!important;
  contain:layout paint style!important;
}
html body #${ROOT_ID}:not([hidden]):not(.is-minimized)>header,
html body #${ROOT_ID}:not([hidden]):not(.is-minimized)>.cw242-window-switcher,
html body #${ROOT_ID}:not([hidden]):not(.is-minimized)>.cw350-context,
html body #${ROOT_ID}:not([hidden]):not(.is-minimized)>.cw295-saved-chats,
html body #${ROOT_ID}:not([hidden]):not(.is-minimized)>[data-persistent-form]{
  flex:0 0 auto!important;
}
html[data-civweave-mobile-ai-hardening="v302"] body #${ROOT_ID}:not([hidden]):not(.is-minimized) [data-log],
html body #${ROOT_ID}:not([hidden]):not(.is-minimized) [data-log]{
  flex:1 1 0!important;
  min-height:0!important;
  height:0!important;
  max-height:none!important;
  overflow-y:auto!important;
  overflow-x:hidden!important;
  overscroll-behavior:contain!important;
  touch-action:pan-y!important;
  -webkit-overflow-scrolling:touch;
}
html[data-civweave-mobile-ai-hardening="v302"] body #${ROOT_ID}:not([hidden]):not(.is-minimized) [data-persistent-form],
html body #${ROOT_ID}:not([hidden]):not(.is-minimized) [data-persistent-form]{
  position:relative!important;
  z-index:2!important;
  display:grid!important;
  grid-template-columns:minmax(0,1fr) 86px!important;
  grid-template-rows:38px 38px!important;
  gap:8px!important;
  align-items:stretch!important;
  flex:none!important;
  min-height:0!important;
  width:100%!important;
  margin:0!important;
}
html body #${ROOT_ID}:not([hidden]):not(.is-minimized) [data-persistent-form] textarea{
  grid-column:1!important;
  grid-row:1 / span 2!important;
  height:84px!important;
  min-height:84px!important;
  max-height:84px!important;
}
html body #${ROOT_ID}:not([hidden]):not(.is-minimized) [data-persistent-form] [data-voice],
html body #${ROOT_ID}:not([hidden]):not(.is-minimized) [data-persistent-form] [data-send]{
  grid-column:2!important;
  width:100%!important;
  min-width:0!important;
  height:38px!important;
  min-height:38px!important;
  max-height:38px!important;
  padding-top:0!important;
  padding-bottom:0!important;
}
html body #${ROOT_ID}:not([hidden]):not(.is-minimized) [data-persistent-form] [data-voice]{grid-row:1!important}
html body #${ROOT_ID}:not([hidden]):not(.is-minimized) [data-persistent-form] [data-send]{grid-row:2!important}
}
`;
  document.head?.append(style);
}

function bind(){
  if(bound)return true;
  bound=true;
  const viewport=globalThis.visualViewport;
  viewport?.addEventListener?.('resize',schedule,{passive:true});
  viewport?.addEventListener?.('scroll',schedule,{passive:true});
  addEventListener('resize',schedule,{passive:true});
  addEventListener('orientationchange',schedule,{passive:true});
  addEventListener('pageshow',schedule,{passive:true});
  addEventListener('civweave:guide-chat-opened',schedule);
  addEventListener('civweave:guide-chat-state',schedule);
  document.addEventListener('focusin',event=>{if(event.target?.closest?.(`#${ROOT_ID}`))schedule()},true);
  document.addEventListener('focusout',event=>{if(event.target?.closest?.(`#${ROOT_ID}`))schedule()},true);
  return true;
}

function start(){installStyle();bind();apply()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();

globalThis.CivweaveMobileChatVisualViewportV1=Object.freeze({version:VERSION,metrics,apply,schedule,bind,mobile,visualViewportOwned:true,composerVisibilityInvariant:true,longThreadScrollOwner:true,mobileLayout:'flex-column-fixed-composer-stacked-actions'});
})();
