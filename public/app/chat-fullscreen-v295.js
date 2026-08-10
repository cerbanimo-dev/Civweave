(()=>{
'use strict';
const VERSION='1.0.97-chat-fullscreen-v295',ROOT='cw-persistent-guide-chat-v215',STYLE='cw-chat-fullscreen-v295-style';
if(globalThis.CivweaveChatFullscreenV295?.version===VERSION)return;
function viewport(){const v=globalThis.visualViewport,h=Math.max(240,Math.round(v?.height||innerHeight||640)),top=Math.max(0,Math.round(v?.offsetTop||0));document.documentElement.style.setProperty('--cw295-vv-height',`${h}px`);document.documentElement.style.setProperty('--cw295-vv-top',`${top}px`)}
function style(){if(document.getElementById(STYLE))return;const s=document.createElement('style');s.id=STYLE;s.textContent=`
#${ROOT}{grid-template-rows:auto auto auto minmax(0,1fr) auto!important}
@media(max-width:720px){
#${ROOT}:not(.is-minimized){left:0!important;right:0!important;top:var(--cw295-vv-top,0px)!important;bottom:auto!important;width:auto!important;height:var(--cw295-vv-height,100dvh)!important;max-height:none!important;border-radius:0!important;border-left:0!important;border-right:0!important;border-bottom:0!important}
#${ROOT}:not(.is-minimized) [data-log]{min-height:0!important}
#${ROOT}:not(.is-minimized) [data-persistent-form]{padding:8px max(8px,env(safe-area-inset-right)) max(5px,env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left))!important}
#${ROOT}:not(.is-minimized) textarea{min-height:58px!important;max-height:min(28dvh,190px)!important;resize:none!important}
#${ROOT}:not(.is-minimized) [data-send]{min-height:46px!important}
#${ROOT}.is-minimized{top:auto!important;bottom:max(2px,env(safe-area-inset-bottom))!important;height:auto!important;max-height:none!important}
}`;document.head.append(s)}
style();viewport();visualViewport?.addEventListener('resize',viewport,{passive:true});visualViewport?.addEventListener('scroll',viewport,{passive:true});addEventListener('resize',viewport,{passive:true});
globalThis.CivweaveChatFullscreenV295=Object.freeze({version:VERSION,fullScreenMobile:true,keyboardVisualViewport:true,viewport});
})();