(()=>{
'use strict';
const REVISION='host-node-status-selection-v2-mobile-guild-compat';
const SELECTION_KEY='civweave.host-node.selection.v1';
const HOST_ENDPOINT_KEY='federation-finder.physical-node-endpoint';
const clean=(value,max=1000)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const setText=(node,value)=>{if(node&&node.textContent!==value)node.textContent=value;};

function currentMeta(){
  const parts=(document.getElementById('cw-host-node-meta')?.textContent||'').split('·').map(value=>value.trim()).filter(Boolean);
  const origin=parts.find(value=>/^https:\/\//i.test(value))||'';
  const nodeId=parts.length>1&&!/^https:\/\//i.test(parts[0])?parts[0]:'';
  const runtime=parts.find(value=>value==='cloudflare-mobile-guild-edge')||'';
  return{parts,origin,nodeId,runtime};
}
function selectedRecord(){
  try{
    const saved=parse(localStorage.getItem(SELECTION_KEY),{});
    return{origin:new URL(saved?.origin||'').origin,nodeId:clean(saved?.nodeId,180)};
  }catch{return{origin:'',nodeId:''};}
}
function slotUnknown(id){
  const text=clean(document.getElementById(id)?.textContent,40);
  return !text||text==='—'||text==='-';
}
function mobileSelectionOnly(meta=currentMeta()){
  if(meta.runtime!=='cloudflare-mobile-guild-edge'||!meta.origin||!meta.nodeId)return false;
  if(!slotUnknown('cw-host-free-slots')||!slotUnknown('cw-host-paid-slots'))return false;
  return !globalThis.CivweaveHostNodeSessionV1?.sessionFor?.(meta.nodeId||meta.origin);
}
function persistSelection(meta){
  const title=clean(document.getElementById('cw-host-node-title')?.textContent,180)||meta.nodeId;
  const selection=Object.freeze({schema:'civweave.host-node-selection.v1',origin:meta.origin,nodeId:meta.nodeId,displayName:title,selectedAt:new Date().toISOString(),source:REVISION,loginMode:'legacy-mobile-selection'});
  localStorage.setItem(HOST_ENDPOINT_KEY,meta.origin);
  localStorage.setItem(SELECTION_KEY,JSON.stringify(selection));
  return selection;
}
function applyMobileCompatibility(){
  const meta=currentMeta(),button=document.getElementById('cw-host-node-join');
  if(!button||!mobileSelectionOnly(meta))return false;
  const selected=selectedRecord(),isSelected=selected.origin===meta.origin&&selected.nodeId===meta.nodeId;
  button.disabled=false;
  button.dataset.mode='mobile-selection';
  button.dataset.selected=String(isSelected);
  setText(button,isSelected?'Using this Guild':'Use this Guild');
  const help=document.getElementById('cw-host-node-help');
  if(help&&!isSelected)setText(help,'This Mobile Guild is online and discoverable, but its current Worker predates Citizen/Patron login. Use this Guild selects it for this device; member admission requires a Worker upgrade.');
  return true;
}
function sync(){
  const {origin,nodeId}=currentMeta();
  if(!origin||!nodeId){applyMobileCompatibility();return false;}
  let changed=false;
  try{
    const url=new URL(location.href);
    if(url.searchParams.get('host')!==origin||url.searchParams.get('node')!==nodeId){
      url.searchParams.set('host',origin);
      url.searchParams.set('node',nodeId);
      history.replaceState(history.state,'',url);
      changed=true;
    }
  }catch{}
  globalThis.CivweaveHostNodePaidJoinV1?.apply?.();
  applyMobileCompatibility();
  return changed;
}
function selectLegacyMobileGuild(event){
  const target=event.target?.closest?.('#cw-host-node-join');
  if(!target)return false;
  const meta=currentMeta();
  if(!mobileSelectionOnly(meta))return false;
  event.preventDefault();
  event.stopImmediatePropagation();
  let selection;
  try{selection=persistSelection(meta)}catch(error){
    setText(document.getElementById('cw-host-node-help'),`Civweave could not save this Guild on the device: ${error?.message||error}`);
    return true;
  }
  target.disabled=false;
  target.dataset.mode='mobile-selection';
  target.dataset.selected='true';
  setText(target,'Using this Guild');
  const title=clean(document.getElementById('cw-host-node-title')?.textContent,180)||'This Guild';
  setText(document.getElementById('cw-host-node-help'),`${title} is now this device’s Guild. Its current Mobile Guild Worker predates Citizen/Patron login, so no capacity session was created. Upgrade the Guild Worker before testing member admission.`);
  try{dispatchEvent(new CustomEvent('civweave:host-node-selected',{detail:selection}));dispatchEvent(new CustomEvent('civweave:legacy-mobile-guild-selected',{detail:selection}));}catch{}
  return true;
}

document.addEventListener('click',selectLegacyMobileGuild,true);
const observer=new MutationObserver(sync);observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync,{once:true});else sync();
addEventListener('pagehide',()=>{observer.disconnect();document.removeEventListener('click',selectLegacyMobileGuild,true);},{once:true});
globalThis.CivweaveHostNodeStatusSelectionV1=Object.freeze({revision:REVISION,sync,applyMobileCompatibility,mobileSelectionOnly});
})();
