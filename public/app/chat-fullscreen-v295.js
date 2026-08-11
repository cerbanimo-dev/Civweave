(()=>{
'use strict';
const VERSION='1.0.104-chat-fullscreen-v297',ROOT='cw-persistent-guide-chat-v215',STYLE='cw-chat-fullscreen-v297-style';
if(globalThis.CivweaveChatFullscreenV295?.version===VERSION)return;
let settleTimers=[];
function viewport(){
  const v=globalThis.visualViewport;
  const h=Math.max(240,Math.round(v?.height||innerHeight||640));
  document.documentElement.style.setProperty('--cw297-vv-height',`${h}px`);
}
function settleViewport(){
  for(const timer of settleTimers)clearTimeout(timer);
  settleTimers=[0,40,100,180,320].map(delay=>setTimeout(viewport,delay));
}
function style(){
  if(document.getElementById(STYLE))return;
  const s=document.createElement('style');s.id=STYLE;s.textContent=`
#${ROOT}{grid-template-rows:auto auto auto minmax(0,1fr) auto!important}
@media(max-width:720px){
#${ROOT}:not(.is-minimized){left:0!important;right:0!important;top:0!important;bottom:auto!important;width:100vw!important;height:var(--cw297-vv-height,100dvh)!important;max-height:none!important;border-radius:0!important;border:0!important;overflow:hidden!important;overscroll-behavior:contain!important}
#${ROOT}:not(.is-minimized) [data-log]{min-height:0!important;height:auto!important;overflow-y:auto!important;overscroll-behavior:contain!important;padding-bottom:10px!important}
#${ROOT}:not(.is-minimized) [data-persistent-form]{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;align-items:end!important;gap:8px!important;padding:8px max(8px,env(safe-area-inset-right)) max(6px,env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left))!important}
#${ROOT}:not(.is-minimized) textarea{min-width:0!important;min-height:54px!important;max-height:132px!important;resize:none!important}
#${ROOT}:not(.is-minimized) [data-send]{width:auto!important;min-width:76px!important;min-height:54px!important;align-self:stretch!important}
#${ROOT}.is-minimized{top:auto!important;bottom:max(2px,env(safe-area-inset-bottom))!important;height:auto!important;max-height:none!important}
}`;
  document.head.append(s);
}
style();viewport();
globalThis.visualViewport?.addEventListener('resize',settleViewport,{passive:true});
globalThis.visualViewport?.addEventListener('scroll',viewport,{passive:true});
addEventListener('resize',settleViewport,{passive:true});
document.addEventListener('focusin',event=>{if(event.target?.closest?.(`#${ROOT}`))settleViewport()},{passive:true});
document.addEventListener('focusout',event=>{if(event.target?.closest?.(`#${ROOT}`))settleViewport()},{passive:true});
globalThis.CivweaveChatFullscreenV295=Object.freeze({version:VERSION,fullScreenMobile:true,keyboardVisualViewport:true,visualViewportHeightOnly:true,androidKeyboardSettling:true,viewport,settleViewport});
})();
