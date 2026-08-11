(()=>{
'use strict';
if(globalThis.CivweaveFederatedEconomyFrameInjectorV1)return;
const VERSION='1.0.0';
const BASE=[
 ['/app/cw-reward-ledger-v2.js?v=2.0.0','reward-ledger'],
 ['/app/cw-skill-market-v1.js?v=1.0.0','skill-market'],
 ['/app/cw-skill-market-surfaces-v1.js?v=1.0.0','skill-surfaces'],
 ['/app/cw-fellowfare-fee-policy-v2.js?v=2.0.0','fee-policy'],
 ['/app/cw-fellowfare-market-safety-v1.js?v=1.0.0','market-safety'],
 ['/app/cw-passport-roaming-v1.js?v=1.0.0','passport-roaming'],
 ['/app/cw-passport-recovery-crypto-v1.js?v=1.0.0','passport-recovery-crypto'],
 ['/app/cw-passport-recovery-v1.js?v=1.0.0','passport-recovery'],
 ['/app/cw-hub-commons-v1.js?v=1.0.0','hub-commons'],
 ['/app/cw-hub-peer-mesh-v1.js?v=1.0.0','hub-peer'],
 ['/app/cw-hub-peer-bootstrap-v1.js?v=1.0.0','hub-peer-bootstrap'],
 ['/app/cw-hub-compute-worker-v1.js?v=1.0.0','hub-compute-worker'],
 ['/app/cw-hub-spot-v1.js?v=1.0.0','hub-spot']
];
const FELLOW=[
 ['/app/services/fellowfare/skill-market-bridge-v1.js?v=1.0.0','fellowfare-skill-bridge'],
 ['/app/services/fellowfare/market-safety-bridge-v1.js?v=1.0.0','fellowfare-safety-bridge'],
 ['/app/services/fellowfare/commerce-bridge-v1.js?v=1.0.0','fellowfare-commerce-bridge']
];
function add(doc,[src,id]){return new Promise(resolve=>{if(doc.querySelector(`script[data-cw-federated-economy="${id}"]`)){resolve();return}const s=doc.createElement('script');s.src=src;s.dataset.cwFederatedEconomy=id;s.onload=s.onerror=resolve;(doc.head||doc.documentElement).append(s)})}
async function inject(frameOrDoc){let doc,path;try{doc=frameOrDoc?.contentDocument||frameOrDoc;path=doc?.location?.pathname||''}catch{return}if(!doc?.documentElement)return;for(const row of BASE)await add(doc,row);if(/fellowfare/i.test(path)||doc.querySelector('#composerForm,#ffc144-app,[data-civweave-system="fellowfare"]'))for(const row of FELLOW)await add(doc,row);scan(doc)}
function scan(root=document){try{root.querySelectorAll('iframe').forEach(frame=>{frame.addEventListener('load',()=>inject(frame));void inject(frame)})}catch{}}
function boot(){void inject(document);new MutationObserver(records=>records.forEach(r=>[...r.addedNodes].forEach(n=>{if(n?.nodeType!==1)return;if(n.matches?.('iframe')){n.addEventListener('load',()=>inject(n));void inject(n)}n.querySelectorAll?.('iframe').forEach(f=>{f.addEventListener('load',()=>inject(f));void inject(f)})}))).observe(document.documentElement,{childList:true,subtree:true})}
const api=Object.freeze({version:VERSION,inject,scan});globalThis.CivweaveFederatedEconomyFrameInjectorV1=api;document.readyState==='loading'?addEventListener('DOMContentLoaded',boot,{once:true}):boot();
})();
