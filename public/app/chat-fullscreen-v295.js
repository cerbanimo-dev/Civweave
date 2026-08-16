(()=>{
'use strict';
const VERSION='1.0.108-chat-fullscreen-v299',REVISION='saved-tabs-grid-v351',ROOT='cw-persistent-guide-chat-v215',STYLE='cw-chat-fullscreen-v299-style';
if(globalThis.CivweaveChatFullscreenV295?.version===VERSION&&globalThis.CivweaveChatFullscreenV295?.revision===REVISION)return;

function root(){return document.getElementById(ROOT)}
function mobile(){return globalThis.matchMedia?.('(max-width:720px)')?.matches??innerWidth<=720}
function viewport(){
  const v=globalThis.visualViewport;
  return Object.freeze({height:Math.max(1,Math.round(v?.height||innerHeight||1)),width:Math.max(1,Math.round(v?.width||innerWidth||1)),writes:0});
}
function clearLegacyInline(node=root()){
  if(!node?.style)return false;
  let changed=false;
  for(const prop of ['position','inset','left','right','top','bottom','translate','transform','width','height','min-height','max-height','margin','border-radius','border','overflow','overscroll-behavior','contain','z-index','display','flex-direction','box-sizing']){
    if(!node.style.getPropertyValue(prop))continue;
    node.style.removeProperty(prop);changed=true;
  }
  node.removeAttribute('data-cw299-keyboard');
  node.removeAttribute('data-cw299-fullscreen');
  return changed;
}
function enforceFullScreen(node=root()){
  if(!node||!mobile()||node.hidden||node.classList.contains('is-minimized'))return false;
  // Compatibility method only. Fullscreen sizing is owned entirely by CSS so this
  // function never writes layout or schedules work on the main thread.
  return true;
}
function ensureStructure(){
  const node=root();if(!node)return false;
  let changed=false;
  let log=node.querySelector('[data-log]');
  if(!log){log=node.querySelector('.cwp215-log');if(log){log.setAttribute('data-log','');changed=true}}
  let form=node.querySelector('[data-persistent-form]');
  if(!form){form=node.querySelector('.cwp215-form');if(form){form.setAttribute('data-persistent-form','');changed=true}}
  if(form){
    let send=form.querySelector('[data-send],button[type="submit"]');
    if(send&&!send.hasAttribute('data-send')){send.setAttribute('data-send','');changed=true}
  }
  return Boolean(log&&form)||changed;
}
function settleViewport(){
  // Deliberately bounded to one synchronous compatibility pass. No timers,
  // MutationObservers, rAF loops, or visualViewport event ownership.
  ensureStructure();
  clearLegacyInline();
  return true;
}
function style(){
  if(document.getElementById(STYLE))return;
  const s=document.createElement('style');s.id=STYLE;s.textContent=`
#${ROOT}:not([hidden]):not(.is-minimized):has(>.cw295-saved-chats){grid-template-rows:auto auto auto auto minmax(0,1fr) auto!important}
@media(max-width:720px){
#${ROOT}:not([hidden]):not(.is-minimized){position:fixed!important;inset:0!important;left:0!important;right:0!important;top:0!important;bottom:0!important;width:100vw!important;height:100dvh!important;min-height:0!important;max-height:100dvh!important;margin:0!important;border-radius:0!important;border:0!important;overflow:hidden!important;overscroll-behavior:contain!important;contain:layout paint style!important;z-index:2147483646!important;display:grid!important;grid-template-rows:auto auto auto minmax(0,1fr) auto!important;box-sizing:border-box!important;pointer-events:auto!important}
#${ROOT}:not([hidden]):not(.is-minimized):has(>.cw295-saved-chats){grid-template-rows:auto auto auto auto minmax(0,1fr) auto!important}
#${ROOT}:not([hidden]):not(.is-minimized)>header,#${ROOT}:not([hidden]):not(.is-minimized)>nav,#${ROOT}:not([hidden]):not(.is-minimized)>.cw242-window-switcher{min-height:0!important}
#${ROOT}:not([hidden]):not(.is-minimized) [data-log],#${ROOT}:not([hidden]):not(.is-minimized) .cwp215-log{min-height:0!important;height:auto!important;max-height:none!important;overflow-y:auto!important;overscroll-behavior:contain!important;touch-action:pan-y!important;-webkit-overflow-scrolling:touch;padding-bottom:10px!important}
#${ROOT}:not([hidden]):not(.is-minimized) [data-persistent-form],#${ROOT}:not([hidden]):not(.is-minimized) .cwp215-form{width:100%!important;display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;align-items:stretch!important;gap:8px!important;padding:8px max(8px,env(safe-area-inset-right)) max(6px,env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left))!important;margin:0!important;background:inherit!important}
#${ROOT}:not([hidden]):not(.is-minimized) textarea{min-width:0!important;width:100%!important;min-height:54px!important;max-height:min(28dvh,180px)!important;resize:none!important}
#${ROOT}:not([hidden]):not(.is-minimized) [data-send]{display:block!important;width:auto!important;min-width:76px!important;min-height:54px!important;align-self:stretch!important}
#${ROOT}.is-minimized{top:auto!important;bottom:max(2px,env(safe-area-inset-bottom))!important;height:auto!important;max-height:none!important}
}`;document.head.append(s)
}
style();
// Clear inline values left by pre-v349 builds once at module load. After this point
// CSS owns mobile layout and the module remains quiescent until explicitly called.
clearLegacyInline();

globalThis.CivweaveChatFullscreenV295=Object.freeze({
  version:VERSION,
  revision:REVISION,
  fullScreenMobile:true,
  keyboardVisualViewport:false,
  staleViewportRecovery:true,
  restingViewportMemory:false,
  inlineImportantEnforcement:false,
  workspaceStateEnforcement:false,
  androidKeyboardSettling:false,
  structuralComposerRepair:'bounded-on-demand',
  mutationLoopGuard:true,
  styleMutationObserverDisabled:true,
  domWideObserver:false,
  rootSubtreeObserver:false,
  viewportEventOwnership:false,
  cssOnlyLayout:true,
  mainThreadQuiescent:true,
  viewport,
  settleViewport,
  ensureStructure,
  enforceFullScreen,
  clearLegacyInline
});
})();