(()=>{
'use strict';

const VERSION='1.0.1-settings-local-progress-card-owned-direct-aware';
const PANEL_ID='cw-local-ai-v324';
const DIRECT_PANEL_ID='cw-local-models-direct-v325';
const PACK_STATE_KEY='civweave.local-ai.packs.v1';
const DOWNLOADS_KEY='civweave.local-ai.downloads.v266';
if(globalThis.CivweaveSettingsLocalProgressPlacementV1?.version===VERSION)return;

let activeTarget=null;
const timers=new Set();
const parse=(value,fallback={})=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const escapeSelector=value=>{try{return CSS?.escape?CSS.escape(String(value)):String(value).replace(/["\\]/g,'\\$&')}catch{return String(value).replace(/["\\]/g,'\\$&')}};

function inferTarget(){
  try{
    const packs=parse(localStorage.getItem(PACK_STATE_KEY),{});
    for(const [id,state] of Object.entries(packs)){
      if(['downloading','finalizing','browser-queuing','browser-importing','browser-partial','browser-queued','paused','error'].includes(String(state?.status||'')))return{kind:'pack',id};
    }
    const downloads=parse(localStorage.getItem(DOWNLOADS_KEY),{});
    for(const [id,state] of Object.entries(downloads)){
      if(['downloading','finalizing','paused','error'].includes(String(state?.status||'')))return{kind:'model',id};
    }
  }catch{}
  return null;
}

function statusNode(){
  return document.querySelector(`#${PANEL_ID} [data-local-status]`)||document.querySelector(`#${DIRECT_PANEL_ID} [data-cw-direct-local-status]`);
}

function targetCard(target=activeTarget){
  if(!target)return null;
  const id=escapeSelector(target.id);
  if(target.kind==='pack'){
    return document.querySelector(`#${PANEL_ID} [data-pack-id="${id}"]`)||document.querySelector(`#${DIRECT_PANEL_ID} [data-pack-id="${id}"]`)||target.element?.isConnected&&target.element||null;
  }
  if(target.kind==='model'){
    return document.querySelector(`#${PANEL_ID} [data-model-id="${id}"]`)||document.querySelector(`#${DIRECT_PANEL_ID} [data-model-id="${id}"]`)||target.element?.isConnected&&target.element||null;
  }
  return target.element?.isConnected?target.element:null;
}

function localize(){
  const node=statusNode();
  if(!node?.isConnected)return false;
  if(!activeTarget)activeTarget=inferTarget();
  const card=targetCard();
  if(!card?.isConnected)return false;
  const actions=card.querySelector('.cw-local-actions,.cw-direct-actions');
  if(node.parentElement!==card){
    if(actions)card.insertBefore(node,actions);else card.append(node);
  }
  node.dataset.cardOwnedProgress='true';
  node.style.minHeight='0';
  node.style.padding='8px 10px';
  node.style.border='1px solid #77e9cf35';
  node.style.borderRadius='10px';
  node.style.background='#081b20';
  node.style.color='#c9fff2';
  return true;
}

function schedule(delays=[0,40,160]){
  for(const delay of delays){
    const timer=setTimeout(()=>{timers.delete(timer);localize()},delay);
    timers.add(timer);
  }
}

function targetFromButton(button){
  const packId=button?.dataset?.localPackFinish||button?.dataset?.localPackDownload||button?.dataset?.localPackImport||button?.dataset?.localPackUse||button?.dataset?.localPackRemove||button?.dataset?.localPackCancel;
  if(packId)return{kind:'pack',id:String(packId),element:button.closest?.('.cw-pack-card,.cw-direct-card')||null};
  const modelId=button?.dataset?.localDownload||button?.dataset?.localUse||button?.dataset?.localRemove||button?.dataset?.localCancel;
  if(modelId)return{kind:'model',id:String(modelId),element:button.closest?.('.cw-local-row,.cw-direct-model')||null};
  return null;
}

function onClick(event){
  const button=event.target?.closest?.('button');
  const target=targetFromButton(button);
  if(!target)return;
  activeTarget=target;
  schedule([0,40,160,500,1200]);
}

function onPackProgress(event){
  const id=String(event?.detail?.id||'').trim();
  if(id)activeTarget={kind:'pack',id};
  schedule([0,30,120]);
}
function onModelProgress(event){
  const id=String(event?.detail?.id||event?.detail?.modelId||'').trim();
  if(id)activeTarget={kind:'model',id};
  schedule([0,30,120]);
}
function onSettings(){
  if(!activeTarget)activeTarget=inferTarget();
  schedule([0,80,250]);
}

addEventListener('click',onClick,true);
for(const name of ['civweave:local-model-pack-progress','civweave:local-model-pack-installed','civweave:local-model-pack-removed','civweave:local-model-pack-selected'])addEventListener(name,onPackProgress);
for(const name of ['civweave:local-model-download-progress','civweave:local-model-downloaded','civweave:local-model-removed'])addEventListener(name,onModelProgress);
addEventListener('civweave:model-settings-opened',onSettings);
addEventListener('civweave:settings-ready',onSettings);
addEventListener('pageshow',onSettings);

onSettings();
globalThis.CivweaveSettingsLocalProgressPlacementV1=Object.freeze({version:VERSION,localize,schedule,inferTarget,targetCard,targetFromButton,cardOwnedProgress:true,directCards:true,globalProgressBanner:false});
})();