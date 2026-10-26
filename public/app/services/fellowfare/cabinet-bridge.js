(()=>{
'use strict';
const VERSION='1.0.0-native-direct-owner';
if(globalThis.CivweaveFellowFareCabinetBridgeV1?.version===VERSION)return;
const ORIGIN=location.origin;
const NATIVE=Boolean(document.querySelector('[data-fellowfare-native-host]'));
const BRIDGE_PEER=parent;
const LEGACY_KEY='fellowfare.mvp.state.v3';
const V2_KEY='fellowfare.marketplace.v2';
let ready=false;
function route(name){const api=globalThis.CivweaveFellowFareMarketplaceV2;if(!api?.routeTo)return false;api.routeTo(name);return true}
function composer(mode='offer',text=''){
  const api=globalThis.CivweaveFellowFareMarketplaceV2;
  if(api?.openComposer){api.openComposer(mode==='need'?'need':'offer');requestAnimationFrame(()=>{const form=document.querySelector('#ffv2ComposerForm');if(form&&text){form.elements.description.value=String(text).slice(0,2400);if(!form.elements.title.value)form.elements.title.value=String(text).trim().slice(0,120)}});return true}
  return route('loom');
}
function command(name,payload={}){
  if(name==='compose')return composer(payload.mode,payload.text||'');
  if(['market','loom','assemblies','inbox','profile'].includes(name))return route(name);
  return false;
}
function importLegacyThread(thread={}){
  const api=globalThis.CivweaveFellowFareMarketplaceV2;if(!api)return null;
  const sourceId=String(thread.id||'').trim();
  const duplicate=api.listings().find(row=>row?.source?.sourceId===sourceId||row?.legacyId===sourceId);
  if(duplicate)return duplicate;
  const category=String(thread.category||'').toLowerCase();
  let kind=thread.mode==='need'?'request':thread.mode==='collective'?'collective':/service|work|repair|transport/.test(category)?'service':/learning|teach|tutor/.test(category)?'tutoring':'resource';
  return api.publishListing({kind,mode:thread.mode==='need'?'need':'offer',title:thread.title||'Imported exchange listing',description:thread.description||'',pricing:{usdMinor:Number(thread.amount)>0?Math.round(Number(thread.amount)*100):0,gift:Array.isArray(thread.methods)&&thread.methods.includes('Gift'),barter:Array.isArray(thread.methods)&&thread.methods.includes('Barter')},fulfillment:{area:thread.area||'',timing:thread.when||'',quantity:thread.quantity||'',partial:Boolean(thread.partial)},source:{system:'fellowfare',sourceId:sourceId||null},ownerId:thread.ownerId||'me'});
}
function consumeExchangeImport(message){
  const threads=message?.bundle?.entities?.threads;
  if(!Array.isArray(threads)||!threads.length)return;
  const imported=threads.map(importLegacyThread).filter(Boolean);
  const receipt={type:'civweave:exchange-import-receipt',status:'reviewed',detail:`Imported ${imported.length} reviewed FellowFare listing${imported.length===1?'':'s'} into the live marketplace.`,automaticEffect:false};
  if(NATIVE)dispatchEvent(new CustomEvent('fellowfare:cabinet-receipt',{detail:receipt}));else BRIDGE_PEER.postMessage(receipt,ORIGIN);
}
if(!NATIVE)addEventListener('message',event=>{
  if(event.origin!==ORIGIN||event.source!==BRIDGE_PEER||!event.data||typeof event.data!=='object')return;
  if(event.data.type==='fellowfare:cabinet-command'){command(String(event.data.command||'market'),event.data.payload||{});return}
  if(event.data.type==='civweave:exchange-import'){consumeExchangeImport(event.data);return}
});
addEventListener('storage',event=>{
  if(![LEGACY_KEY,V2_KEY,'civweave.reward-ledger.v2','civweave.cerbanimo-commerce-receipts.v1'].includes(event.key)||event.newValue===event.oldValue)return;
  globalThis.CivweaveFellowFareMarketplaceV2?.render?.();
});
function start(){
  document.body.classList.add(NATIVE?'ff-market-native':'ff-cabinet-embedded');
  const hash=location.hash.slice(1);if(!['market','loom','assemblies','inbox','profile'].includes(hash))history.replaceState(null,'','#market');
  globalThis.CivweaveFellowFareMarketplaceV2?.render?.(location.hash.slice(1)||'market');
  ready=true;
  const detail={type:'fellowfare:cabinet-ready',version:'2.0.0-live-market',capabilities:['products','services','learning-modules','tutoring','resources','needs','collectives','listings','orders','proposals','agreements','assemblies','canonical-acorns','canonical-buttons','commerce-receipts','usd-money-edge-status','portable-market-data']};
  if(NATIVE)dispatchEvent(new CustomEvent('fellowfare:cabinet-ready',{detail}));else BRIDGE_PEER.postMessage(detail,ORIGIN);
}
globalThis.CivweaveFellowFareCabinetBridgeV1=Object.freeze({version:VERSION,native:NATIVE,command,importReviewed:consumeExchangeImport,get ready(){return ready}});
if(document.readyState==='loading')addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
