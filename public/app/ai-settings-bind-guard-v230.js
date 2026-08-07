(()=>{
'use strict';
const VERSION='230.0-ai-settings-first-open-bind-guard';
const LAYER_ID='cw-ai-settings-cleanroom-v188';
const SETTINGS_SELECTOR='[data-action="settings"],[data-settings],#lite-settings,[data-open-unified-ai-settings],#aiSettings,#modelSettings,#btnAISettings,[data-ai-settings],[data-ls-action="open-ai-settings"]';
if(globalThis.CivweaveAISettingsBindGuardV230?.version===VERSION)return;

function currentController(){
  return globalThis.CivweaveAISettingsCleanroomV188||globalThis.CivweaveModelSettingsControllerV173||globalThis.CivweaveUnifiedAISettingsV175||null;
}
function withCloseLookup(callback){
  const proto=globalThis.HTMLFormElement?.prototype;
  if(!proto?.querySelector)return callback();
  const original=proto.querySelector;
  proto.querySelector=function(selector){
    const found=original.call(this,selector);
    if(found||selector!=='[data-close]'||!this.matches?.('[data-cw-cleanroom-form]'))return found;
    return this.closest?.(`#${LAYER_ID}`)?.querySelector?.('[data-close]')||null;
  };
  try{return callback()}finally{proto.querySelector=original}
}
function discardHalfBoundLayer(){
  const layer=document.getElementById(LAYER_ID);
  if(layer?.hidden&&layer.dataset.bound==='true'&&layer.dataset.civweaveBindComplete!=='true')layer.remove();
}
function install(){
  const base=currentController();
  if(!base?.open)return false;
  if(base.__civweaveSettingsBindGuardV230===true)return true;
  const wrapped={...base};
  wrapped.open=launcher=>{
    discardHalfBoundLayer();
    const layer=withCloseLookup(()=>base.open(launcher));
    if(layer)layer.dataset.civweaveBindComplete='true';
    return layer;
  };
  if(typeof base.ensure==='function')wrapped.ensure=()=>{
    discardHalfBoundLayer();
    return withCloseLookup(()=>base.ensure());
  };
  wrapped.__civweaveSettingsBindGuardV230=true;
  wrapped.bindGuardVersion=VERSION;
  wrapped.facade=wrapped;
  wrapped.settingsFacade=wrapped;
  Object.freeze(wrapped);
  globalThis.CivweaveAISettingsCleanroomV188=wrapped;
  globalThis.CivweaveModelSettingsControllerV173=wrapped;
  globalThis.CivweaveUnifiedAISettingsV175=wrapped;
  globalThis.CivweaveModelSettingsV133=wrapped;
  return true;
}

document.addEventListener('click',event=>{
  const target=event.target instanceof Element?event.target.closest(SETTINGS_SELECTOR):null;
  if(target)install();
},true);
if(document.readyState==='loading')addEventListener('DOMContentLoaded',install,{once:true});else install();

globalThis.CivweaveAISettingsBindGuardV230=Object.freeze({version:VERSION,install,discardHalfBoundLayer,policy:'atomic-first-open-bind-with-scoped-close-lookup'});
})();
