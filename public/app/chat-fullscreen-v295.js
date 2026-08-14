(()=>{
'use strict';
const VERSION='1.0.106-chat-fullscreen-v299',REVISION='chat-interaction-safe-v348',ROOT='cw-persistent-guide-chat-v215',STYLE='cw-chat-fullscreen-v299-style';
if(globalThis.CivweaveChatFullscreenV295?.version===VERSION&&globalThis.CivweaveChatFullscreenV295?.revision===REVISION)return;
let settleTimers=[],observer=null,rootObserver=null,restingHeight=0,lastOrientation='';
function root(){return document.getElementById(ROOT)}
function mobile(){return matchMedia?.('(max-width:720px)')?.matches??innerWidth<=720}
function editing(){const el=document.activeElement;return Boolean(el?.closest?.(`#${ROOT}`)&&el?.matches?.('textarea,input[type="text"],[contenteditable="true"]'))}
function orientationKey(){return innerWidth>innerHeight?'landscape':'portrait'}
function viewport(){
  const v=globalThis.visualViewport,layout=Math.max(240,Math.round(innerHeight||document.documentElement?.clientHeight||640)),vv=Math.max(0,Math.round(v?.height||0)),orientation=orientationKey();
  if(lastOrientation&&lastOrientation!==orientation)restingHeight=0;lastOrientation=orientation;
  const isEditing=editing(),keyboard=isEditing&&vv>0&&vv<Math.max(layout,restingHeight||layout)-72;
  if(!isEditing)restingHeight=Math.max(restingHeight,layout,vv||0);
  const h=keyboard?Math.min(vv||layout,layout):Math.max(restingHeight||0,layout,vv||0);
  document.documentElement.style.setProperty('--cw299-vv-height',`${Math.max(240,h)}px`);
  const node=root();if(node)node.dataset.cw299Keyboard=keyboard?'true':'false';
  enforceFullScreen(node);
}
function clearInline(node){for(const prop of ['position','inset','left','right','top','bottom','translate','transform','width','height','min-height','max-height','margin','border-radius','border','overflow','overscroll-behavior','contain','z-index','display','flex-direction','box-sizing'])if(node.style.getPropertyValue(prop))node.style.removeProperty(prop)}
function enforceFullScreen(node=root()){
  if(!node)return false;
  if(!mobile()||node.hidden||node.classList.contains('is-minimized')){clearInline(node);return false}
  const important=(prop,value)=>{if(node.style.getPropertyValue(prop)===value&&node.style.getPropertyPriority(prop)==='important')return;node.style.setProperty(prop,value,'important')};
  important('position','fixed');important('inset','0 auto auto 0');important('left','0');important('right','auto');important('top','0');important('bottom','auto');important('translate','none');important('transform','none');important('width','100vw');important('height','var(--cw299-vv-height,100dvh)');important('min-height','0');important('max-height','none');important('margin','0');important('border-radius','0');important('border','0');important('overflow','hidden');important('overscroll-behavior','contain');important('contain','layout paint style');important('z-index','2147483646');important('display','flex');important('flex-direction','column');important('box-sizing','border-box');
  node.dataset.cw299Fullscreen='true';return true
}
function ensureStructure(){
  const node=root();if(!node)return false;
  let log=node.querySelector('[data-log]');if(!log){log=node.querySelector('.cwp215-log');if(log)log.setAttribute('data-log','');else{log=document.createElement('div');log.setAttribute('data-log','');log.setAttribute('role','log');log.setAttribute('aria-live','polite');node.append(log)}}
  let form=node.querySelector('[data-persistent-form]');if(!form){form=node.querySelector('.cwp215-form');if(form)form.setAttribute('data-persistent-form','');else{form=document.createElement('form');form.setAttribute('data-persistent-form','');form.innerHTML='<textarea rows="2" maxlength="12000" required placeholder="Message"></textarea><button data-send type="submit">Send</button>';node.append(form)}}
  let input=form.querySelector('textarea,input[type="text"]');if(!input){input=document.createElement('textarea');input.rows=2;input.maxLength=12000;input.required=true;input.placeholder='Message';form.prepend(input)}
  let send=form.querySelector('[data-send],button[type="submit"]');if(!send){send=document.createElement('button');send.type='submit';send.textContent='Send';form.append(send)}send.setAttribute('data-send','');
  if(rootObserver?.target!==node){try{rootObserver?.disconnect?.()}catch{}rootObserver=new MutationObserver(()=>queueMicrotask(()=>{ensureStructure();viewport();enforceFullScreen(node)}));rootObserver.observe(node,{attributes:true,attributeFilter:['hidden','class'],childList:true,subtree:true});rootObserver.target=node}
  return true
}
function settleViewport(){for(const timer of settleTimers)clearTimeout(timer);settleTimers=[0,80,220,500].map(delay=>setTimeout(()=>{ensureStructure();viewport();enforceFullScreen()},delay))}
function style(){
  if(document.getElementById(STYLE))return;
  const s=document.createElement('style');s.id=STYLE;s.textContent=`
@media(max-width:720px){
#${ROOT}:not([hidden]):not(.is-minimized){position:fixed!important;inset:0 auto auto 0!important;left:0!important;right:auto!important;top:0!important;bottom:auto!important;translate:none!important;transform:none!important;width:100vw!important;height:var(--cw299-vv-height,100dvh)!important;min-height:0!important;max-height:none!important;margin:0!important;border-radius:0!important;border:0!important;overflow:hidden!important;overscroll-behavior:contain!important;contain:layout paint style!important;z-index:2147483646!important;display:flex!important;flex-direction:column!important;box-sizing:border-box!important}
#${ROOT}:not([hidden]):not(.is-minimized)>header,#${ROOT}:not([hidden]):not(.is-minimized)>nav,#${ROOT}:not([hidden]):not(.is-minimized)>.cw242-window-switcher{flex:0 0 auto!important}
#${ROOT}:not([hidden]):not(.is-minimized) [data-log],#${ROOT}:not([hidden]):not(.is-minimized) .cwp215-log{flex:1 1 auto!important;min-height:0!important;height:auto!important;max-height:none!important;overflow-y:auto!important;overscroll-behavior:contain!important;padding-bottom:10px!important}
#${ROOT}:not([hidden]):not(.is-minimized) [data-persistent-form],#${ROOT}:not([hidden]):not(.is-minimized) .cwp215-form{flex:0 0 auto!important;width:100%!important;display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;align-items:stretch!important;gap:8px!important;padding:8px max(8px,env(safe-area-inset-right)) max(6px,env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left))!important;margin:0!important;background:inherit!important}
#${ROOT}:not([hidden]):not(.is-minimized) textarea{min-width:0!important;width:100%!important;min-height:54px!important;max-height:132px!important;resize:none!important}
#${ROOT}:not([hidden]):not(.is-minimized) [data-send]{display:block!important;width:auto!important;min-width:76px!important;min-height:54px!important;align-self:stretch!important}
#${ROOT}.is-minimized{top:auto!important;bottom:max(2px,env(safe-area-inset-bottom))!important;height:auto!important;max-height:none!important}
}`;document.head.append(s)
}
style();ensureStructure();viewport();settleViewport();
globalThis.visualViewport?.addEventListener('resize',settleViewport,{passive:true});
globalThis.visualViewport?.addEventListener('scroll',viewport,{passive:true});
addEventListener('resize',settleViewport,{passive:true});addEventListener('orientationchange',()=>{restingHeight=0;settleViewport()},{passive:true});addEventListener('pageshow',settleViewport,{passive:true});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')settleViewport()},{passive:true});
document.addEventListener('focusin',event=>{if(event.target?.closest?.(`#${ROOT}`))settleViewport()},{passive:true});
document.addEventListener('focusout',event=>{if(event.target?.closest?.(`#${ROOT}`))settleViewport()},{passive:true});
addEventListener('civweave:guide-workspace-state',settleViewport,{passive:true});
if(!root()){observer=new MutationObserver(()=>{if(!root())return;try{observer.disconnect()}catch{}observer=null;ensureStructure();viewport();settleViewport()});observer.observe(document.documentElement,{childList:true,subtree:true})}
globalThis.CivweaveChatFullscreenV295=Object.freeze({version:VERSION,revision:REVISION,fullScreenMobile:true,keyboardVisualViewport:true,staleViewportRecovery:true,restingViewportMemory:true,inlineImportantEnforcement:true,workspaceStateEnforcement:true,androidKeyboardSettling:true,structuralComposerRepair:true,mutationLoopGuard:true,styleMutationObserverDisabled:true,permanentDocumentObserver:false,rootMountObserverOneShot:true,boundedViewportSettlement:true,viewport,settleViewport,ensureStructure,enforceFullScreen});
})();
