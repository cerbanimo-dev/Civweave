(()=>{
'use strict';
const VERSION='1.0.105-chat-fullscreen-v298',ROOT='cw-persistent-guide-chat-v215',STYLE='cw-chat-fullscreen-v298-style';
if(globalThis.CivweaveChatFullscreenV295?.version===VERSION)return;
let settleTimers=[],observer=null;
function root(){return document.getElementById(ROOT)}
function editing(){const el=document.activeElement;return Boolean(el?.closest?.(`#${ROOT}`)&&el?.matches?.('textarea,input[type="text"],[contenteditable="true"]'))}
function viewport(){
  const v=globalThis.visualViewport,layout=Math.max(240,Math.round(innerHeight||document.documentElement?.clientHeight||640)),vv=Math.max(0,Math.round(v?.height||0)),keyboard=editing()&&vv>0&&vv<layout-72,h=keyboard?vv:layout;
  document.documentElement.style.setProperty('--cw298-vv-height',`${Math.max(240,h)}px`);
  const node=root();if(node)node.dataset.cw298Keyboard=keyboard?'true':'false';
}
function settleViewport(){for(const timer of settleTimers)clearTimeout(timer);settleTimers=[0,32,80,150,260,420].map(delay=>setTimeout(()=>{ensureStructure();viewport()},delay))}
function ensureStructure(){
  const node=root();if(!node)return false;
  let log=node.querySelector('[data-log]');if(!log){log=node.querySelector('.cwp215-log');if(log)log.setAttribute('data-log','');else{log=document.createElement('div');log.setAttribute('data-log','');log.setAttribute('role','log');log.setAttribute('aria-live','polite');node.append(log)}}
  let form=node.querySelector('[data-persistent-form]');if(!form){form=node.querySelector('.cwp215-form');if(form)form.setAttribute('data-persistent-form','');else{form=document.createElement('form');form.setAttribute('data-persistent-form','');form.innerHTML='<textarea rows="2" maxlength="12000" required placeholder="Message"></textarea><button data-send type="submit">Send</button>';node.append(form)}}
  let input=form.querySelector('textarea,input[type="text"]');if(!input){input=document.createElement('textarea');input.rows=2;input.maxLength=12000;input.required=true;input.placeholder='Message';form.prepend(input)}
  let send=form.querySelector('[data-send],button[type="submit"]');if(!send){send=document.createElement('button');send.type='submit';send.textContent='Send';form.append(send)}send.setAttribute('data-send','');
  return true
}
function style(){
  if(document.getElementById(STYLE))return;
  const s=document.createElement('style');s.id=STYLE;s.textContent=`
@media(max-width:720px){
#${ROOT}:not([hidden]):not(.is-minimized){position:fixed!important;inset:0 auto auto 0!important;left:0!important;right:auto!important;top:0!important;bottom:auto!important;translate:none!important;transform:none!important;width:100vw!important;height:var(--cw298-vv-height,100dvh)!important;min-height:0!important;max-height:none!important;margin:0!important;border-radius:0!important;border:0!important;overflow:hidden!important;overscroll-behavior:contain!important;contain:layout paint style!important;z-index:2147483646!important;display:flex!important;flex-direction:column!important;box-sizing:border-box!important}
#${ROOT}:not([hidden]):not(.is-minimized)>header,#${ROOT}:not([hidden]):not(.is-minimized)>nav,#${ROOT}:not([hidden]):not(.is-minimized)>.cw242-window-switcher{flex:0 0 auto!important}
#${ROOT}:not([hidden]):not(.is-minimized) [data-log],#${ROOT}:not([hidden]):not(.is-minimized) .cwp215-log{flex:1 1 auto!important;min-height:0!important;height:auto!important;max-height:none!important;overflow-y:auto!important;overscroll-behavior:contain!important;padding-bottom:10px!important}
#${ROOT}:not([hidden]):not(.is-minimized) [data-persistent-form],#${ROOT}:not([hidden]):not(.is-minimized) .cwp215-form{flex:0 0 auto!important;width:100%!important;display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;align-items:stretch!important;gap:8px!important;padding:8px max(8px,env(safe-area-inset-right)) max(6px,env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left))!important;margin:0!important;background:inherit!important}
#${ROOT}:not([hidden]):not(.is-minimized) textarea{min-width:0!important;width:100%!important;min-height:54px!important;max-height:132px!important;resize:none!important}
#${ROOT}:not([hidden]):not(.is-minimized) [data-send]{display:block!important;width:auto!important;min-width:76px!important;min-height:54px!important;align-self:stretch!important}
#${ROOT}.is-minimized{top:auto!important;bottom:max(2px,env(safe-area-inset-bottom))!important;height:auto!important;max-height:none!important}
}`;document.head.append(s)
}
style();ensureStructure();viewport();
globalThis.visualViewport?.addEventListener('resize',settleViewport,{passive:true});
globalThis.visualViewport?.addEventListener('scroll',viewport,{passive:true});
addEventListener('resize',settleViewport,{passive:true});
document.addEventListener('focusin',event=>{if(event.target?.closest?.(`#${ROOT}`))settleViewport()},{passive:true});
document.addEventListener('focusout',event=>{if(event.target?.closest?.(`#${ROOT}`))settleViewport()},{passive:true});
observer=new MutationObserver(()=>queueMicrotask(()=>{ensureStructure();viewport()}));observer.observe(document.documentElement,{childList:true,subtree:true});
globalThis.CivweaveChatFullscreenV295=Object.freeze({version:VERSION,fullScreenMobile:true,keyboardVisualViewport:true,visualViewportHeightOnly:true,staleViewportRecovery:true,androidKeyboardSettling:true,structuralComposerRepair:true,viewport,settleViewport,ensureStructure});
})();
