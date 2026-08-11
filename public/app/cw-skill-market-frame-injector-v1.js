(()=>{
'use strict';
if(globalThis.CivweaveSkillMarketFrameInjectorV1)return;
const VERSION='1.0.0';
const scripts=[
  ['/app/cw-reward-ledger-v2.js?v=2.0.0','reward-ledger'],
  ['/app/cw-skill-market-v1.js?v=1.0.0','skill-market'],
  ['/app/cw-fellowfare-fee-policy-v1.js?v=1.0.0','fellowfare-fee-policy'],
  ['/app/cw-skill-market-surfaces-v1.js?v=1.0.0','skill-market-surfaces']
];
const seen=new WeakSet();
async function injectIntoDocument(doc){
  if(!doc?.documentElement)return;
  for(const [src,key] of scripts){
    if(doc.querySelector(`script[data-cw-skill-market-frame="${key}"]`))continue;
    if(key==='reward-ledger'&&doc.defaultView?.CivweaveCanonicalRewardsV2)continue;
    if(key==='skill-market'&&doc.defaultView?.CivweaveSkillMarketV1)continue;
    if(key==='fellowfare-fee-policy'&&doc.defaultView?.CivweaveFellowFareFeePolicyV1)continue;
    if(key==='skill-market-surfaces'&&doc.defaultView?.CivweaveSkillMarketSurfacesV1)continue;
    await new Promise(resolve=>{const node=doc.createElement('script');node.src=src;node.dataset.cwSkillMarketFrame=key;node.onload=node.onerror=()=>resolve();(doc.head||doc.documentElement).append(node)});
  }
}
function bindFrame(frame){
  if(!frame||seen.has(frame))return;seen.add(frame);
  const apply=async()=>{try{const doc=frame.contentDocument;if(!doc?.documentElement)return;await injectIntoDocument(doc);scan(doc)}catch{}};
  frame.addEventListener('load',apply);void apply();
}
function scan(root=document){root.querySelectorAll?.('iframe').forEach(bindFrame)}
function boot(){scan();new MutationObserver(records=>records.forEach(record=>[...record.addedNodes].forEach(node=>{if(node?.nodeType!==1)return;if(node.matches?.('iframe'))bindFrame(node);scan(node)}))).observe(document.documentElement,{childList:true,subtree:true})}
const api=Object.freeze({version:VERSION,scan,injectIntoDocument});globalThis.CivweaveSkillMarketFrameInjectorV1=api;
document.readyState==='loading'?addEventListener('DOMContentLoaded',boot,{once:true}):boot();
})();
