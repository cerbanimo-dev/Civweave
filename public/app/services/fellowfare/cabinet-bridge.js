const ORIGIN=location.origin;
const NATIVE=Boolean(document.querySelector('[data-fellowfare-native-host]'));
const BRIDGE_PEER=NATIVE?window:parent;
const LEGACY_KEY='fellowfare.mvp.state.v3';
const V2_KEY='fellowfare.marketplace.v2';
const routeButton=route=>document.querySelector(`[data-route="${CSS.escape(route)}"]`);
function route(route){const button=routeButton(route);if(button){button.click();return true}globalThis.CivweaveFellowFareMarketplaceV2?.routeTo?.(route);return false}
function composer(mode='offer',text=''){
  const api=globalThis.CivweaveFellowFareMarketplaceV2;
  if(api?.openComposer){api.openComposer(mode==='need'?'need':'offer');requestAnimationFrame(()=>{const form=document.querySelector('#ffv2ComposerForm');if(form&&text){form.elements.description.value=String(text).slice(0,2400);if(!form.elements.title.value)form.elements.title.value=String(text).trim().slice(0,120)}});return}
  route('loom');
}
function command(name,payload={}){
  if(name==='compose'){composer(payload.mode,payload.text||'');return}
  if(['market','loom','assemblies','inbox','profile'].includes(name)){route(name);return}
  route('market');
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
  BRIDGE_PEER.postMessage({type:'civweave:exchange-import-receipt',status:'reviewed',detail:`Imported ${imported.length} reviewed FellowFare listing${imported.length===1?'':'s'} into the live marketplace.`,automaticEffect:false},ORIGIN);
}
addEventListener('message',event=>{
  if(event.origin!==ORIGIN||event.source!==BRIDGE_PEER||!event.data||typeof event.data!=='object')return;
  if(event.data.type==='fellowfare:cabinet-command'){command(String(event.data.command||'market'),event.data.payload||{});return}
  if(event.data.type==='civweave:exchange-import'){consumeExchangeImport(event.data);return}
});
addEventListener('storage',event=>{
  if(![LEGACY_KEY,V2_KEY,'civweave.reward-ledger.v2','civweave.cerbanimo-commerce-receipts.v1'].includes(event.key)||event.newValue===event.oldValue)return;
  globalThis.CivweaveFellowFareMarketplaceV2?.render?.();
});
addEventListener('DOMContentLoaded',()=>{
  document.body.classList.add(NATIVE?'ff-market-native':'ff-cabinet-embedded');
  const hash=location.hash.slice(1);if(!['market','loom','assemblies','inbox','profile'].includes(hash))history.replaceState(null,'','#market');
  globalThis.CivweaveFellowFareMarketplaceV2?.render?.(location.hash.slice(1)||'market');
  BRIDGE_PEER.postMessage({type:'fellowfare:cabinet-ready',version:'2.0.0-live-market',capabilities:['products','services','learning-modules','tutoring','resources','needs','collectives','listings','orders','proposals','agreements','assemblies','canonical-acorns','canonical-buttons','commerce-receipts','usd-money-edge-status','portable-market-data']},ORIGIN);
},{once:true});
