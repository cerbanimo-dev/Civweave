(()=>{
'use strict';

const VERSION='1.0.0-settings-local-interaction-repair-v1';
const LAYER_ID='cw-settings-v320';
const DIRECT_SRC='/app/settings-local-models-direct-v325.js?v=settings-local-interaction-repair-v1';
const ACTION_SRC='/app/settings-local-route-v331.js?cwAction=1&v=settings-local-interaction-repair-v1';
const STYLE_ID='cw-settings-local-interaction-repair-v1-style';
let directPromise=null,actionPromise=null,importing=false,scheduled=false;

function root(){return document.getElementById(LAYER_ID)}
function localSelected(layer=root()){
  if(!layer?.isConnected||layer.hidden)return false;
  const form=layer.querySelector('[data-cw-settings-form]');
  return form?.dataset?.activeSettingsTab==='local-models'||layer.querySelector('[data-settings-tab="local-models"]')?.getAttribute('aria-selected')==='true';
}
function localTarget(layer=root()){return layer?.querySelector('[data-settings-tab-panel="local-models"]')||null}
function placeholder(layer=root()){
  const target=localTarget(layer);if(!target)return true;
  return Boolean(target.querySelector('[data-local-model-slot-placeholder]')||/Reading saved local model choices|Loading saved local model controls|Opening saved local model controls/i.test(target.textContent||''));
}
function statusNode(layer=root()){
  return layer?.querySelector('[data-local-status]')||layer?.querySelector('[data-cw-direct-local-status]')||layer?.querySelector('[data-local-model-management-status]')||null;
}
function setStatus(text,error=false){
  const node=statusNode();if(!node)return;
  node.textContent=String(text||'');
  node.classList?.toggle?.('cw-local-error',Boolean(error));
}
function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');style.id=STYLE_ID;
  style.textContent=`html[data-settings-open-state="open"] #cw-local-ai-download-dock-v324{display:none!important}#${LAYER_ID} [data-settings-tab-panel="local-models"]{min-height:0}`;
  document.head?.append(style);
}
function hideLegacyDock(){const dock=document.getElementById('cw-local-ai-download-dock-v324');if(dock)dock.hidden=true}
function direct(){return globalThis.CivweaveSettingsLocalDirectV325}
function currentRoute(){return globalThis.CivweaveSettingsLocalRouteV323}
function scriptFor(path){return [...document.scripts].find(script=>{try{return new URL(script.src,location.href).pathname===path}catch{return false}})||null}
function appendScript(src,marker,ready){
  if(ready())return Promise.resolve(ready());
  return new Promise((resolve,reject)=>{
    const path=new URL(src,location.href).pathname,existing=scriptFor(path);
    const done=()=>{const value=ready();value?resolve(value):reject(new Error(`${marker} loaded without its API.`))};
    if(existing){
      if(ready()){resolve(ready());return}
      existing.addEventListener('load',done,{once:true});
      existing.addEventListener('error',()=>reject(new Error(`${marker} could not load.`)),{once:true});
      setTimeout(()=>{const value=ready();if(value)resolve(value)},0);
      return;
    }
    const script=document.createElement('script');script.src=src;script.async=false;script.dataset.civweaveSettingsLocalRepair=marker;
    script.onload=done;script.onerror=()=>reject(new Error(`${marker} could not load.`));
    (document.head||document.documentElement).append(script);
  });
}
function ensureDirect(){
  if(typeof direct()?.render==='function')return Promise.resolve(direct());
  if(directPromise)return directPromise;
  directPromise=appendScript(DIRECT_SRC,'direct-saved-state',()=>typeof direct()?.render==='function'?direct():null).finally(()=>{directPromise=null});
  return directPromise;
}
function actionRouteReady(){
  const route=currentRoute();
  return route?.settingsV325DisplayShim!==true&&route?.loaderBridge!==true&&route?.actionModulesOnDemand===true&&typeof route?.ensureActionModules==='function'?route:null;
}
function ensureActionRoute(){
  const ready=actionRouteReady();if(ready)return Promise.resolve(ready);
  if(actionPromise)return actionPromise;
  actionPromise=new Promise((resolve,reject)=>{
    try{delete globalThis.CivweaveSettingsLocalRouteV323}catch{try{globalThis.CivweaveSettingsLocalRouteV323=undefined}catch{}}
    const script=document.createElement('script');script.src=ACTION_SRC;script.async=false;script.dataset.civweaveSettingsInlinePackAction='v1';
    script.onload=()=>{const route=actionRouteReady();route?resolve(route):reject(new Error('Local model action route loaded without its action API.'))};
    script.onerror=()=>reject(new Error('Local model action route could not load.'));
    (document.head||document.documentElement).append(script);
  }).finally(()=>{actionPromise=null});
  return actionPromise;
}
async function renderSavedState(){
  const layer=root();if(!localSelected(layer))return false;
  installStyle();hideLegacyDock();
  if(typeof direct()?.render==='function'){
    try{if(direct().render(layer)&&!placeholder(layer))return true}catch{}
  }
  try{
    const renderer=await ensureDirect();
    if(!localSelected(layer))return false;
    const ok=Boolean(renderer?.render?.(layer));
    if(ok&&!placeholder(layer))return true;
    throw new Error('Saved Local Models renderer did not replace the loading placeholder.');
  }catch(error){
    const target=localTarget(layer),node=statusNode(layer);
    if(node)node.textContent=`Local models could not finish opening: ${String(error?.message||error)}`;
    else if(target)target.innerHTML=`<section class="cw-clean-panel"><h3>Local models could not open</h3><p>${String(error?.message||error)}</p><button type="button" data-cw-settings-local-retry>Retry local model controls</button></section>`;
    return false;
  }
}
function scheduleRender(){
  if(scheduled)return;scheduled=true;
  queueMicrotask(()=>setTimeout(()=>{scheduled=false;void renderSavedState()},0));
}
function packFromImportLink(anchor){
  try{const url=new URL(anchor.href,location.href);if(url.searchParams.get('source')!=='settings-ai-pack-import')return'';return String(url.searchParams.get('pack')||'').trim()}catch{return''}
}
async function inlineImport(packId){
  if(importing||!packId)return false;importing=true;
  const layer=root();hideLegacyDock();setStatus(`Opening ${packId} file picker inside Settings…`);
  try{
    const route=await ensureActionRoute();
    await route.ensureActionModules?.();
    const browser=globalThis.CivweaveBrowserPackDownloadV1;
    if(!browser?.pickAndImport)throw new Error('The local model file importer did not become ready.');
    const result=await browser.pickAndImport(packId,{onProgress:progress=>{
      const message=progress?.message||progress?.phase;if(message)setStatus(String(message));
    }});
    if(result?.cancelled){setStatus('Import cancelled. Existing local model files were left unchanged.');return true}
    setStatus('Imported local model files. Rechecking the pack…');
    try{await globalThis.CivweaveGemma4DualActionsV2?.synchronizeImportedModels?.()}catch{}
    try{globalThis.CivweaveGemma4DualActionsV2?.scheduleDecorate?.()}catch{}
    try{currentRoute()?.renderLocalModels?.(layer)}catch{}
    try{direct()?.render?.(layer)}catch{}
    return true;
  }catch(error){setStatus(String(error?.message||error),true);return false}
  finally{importing=false;hideLegacyDock()}
}
function onClick(event){
  const layer=root();if(!layer)return;
  const tab=event.target instanceof Element?event.target.closest?.(`#${LAYER_ID} [data-settings-tab="local-models"]`):null;
  if(tab){scheduleRender();return}
  const retry=event.target instanceof Element?event.target.closest?.(`#${LAYER_ID} [data-cw-settings-local-retry]`):null;
  if(retry){event.preventDefault();event.stopImmediatePropagation();scheduleRender();return}
  const anchor=event.target instanceof Element?event.target.closest?.(`#${LAYER_ID} a[href*="source=settings-ai-pack-import"]`):null;
  if(!anchor)return;
  const packId=packFromImportLink(anchor);if(!packId)return;
  event.preventDefault();event.stopImmediatePropagation();void inlineImport(packId);
}
function inspect(){installStyle();hideLegacyDock();if(localSelected()&&placeholder())scheduleRender()}

document.addEventListener('click',onClick,true);
addEventListener('civweave:model-settings-opened',inspect);
addEventListener('civweave:settings-ready',inspect);
addEventListener('civweave:local-model-pack-progress',hideLegacyDock);
addEventListener('civweave:local-model-download-progress',hideLegacyDock);
addEventListener('pageshow',inspect);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inspect,{once:true});else queueMicrotask(inspect);

globalThis.CivweaveSettingsLocalInteractionRepairV1=Object.freeze({version:VERSION,renderSavedState,ensureDirect,ensureActionRoute,inlineImport,eventDriven:true,mutationObserver:false,inlineImportOnly:true,legacyDownloadPageNavigation:false,legacyProgressDockInSettings:false,savedStateOnlyView:true});
})();
