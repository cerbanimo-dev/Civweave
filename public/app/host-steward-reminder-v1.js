(()=>{
'use strict';
const VERSION='host-steward-reminder-v1';
const STEWARD_KEY='civweave.host-steward.v1';
const ANCHOR_KEY='civweave.host-anchor.paired.v1';
const SNOOZE_KEY='civweave.host-anchor.snooze-until.v1';
const params=new URLSearchParams(location.search);
if(params.get('host_setup')==='1'){
  try{localStorage.setItem(STEWARD_KEY,'1')}catch{}
}
const steward=()=>{try{return localStorage.getItem(STEWARD_KEY)==='1'}catch{return false}};
const paired=()=>{try{return localStorage.getItem(ANCHOR_KEY)==='1'}catch{return false}};
const snoozed=()=>{try{return Number(localStorage.getItem(SNOOZE_KEY)||0)>Date.now()}catch{return false}};
function savePaired(){try{localStorage.setItem(ANCHOR_KEY,'1');localStorage.removeItem(SNOOZE_KEY)}catch{}}
function snooze(){try{localStorage.setItem(SNOOZE_KEY,String(Date.now()+24*60*60*1000))}catch{}}
function remove(){document.querySelector('[data-civweave-anchor-reminder]')?.remove()}
function render(meta){
  if(!steward()||paired()||snoozed()||!meta?.localAnchorRecommended)return;
  remove();
  const node=document.createElement('aside');
  node.dataset.civweaveAnchorReminder='1';
  node.setAttribute('role','status');
  node.innerHTML=`<div class="cw-anchor-copy"><small>HOST STEWARD</small><strong>Add a local Anchor</strong><span>Your Cloudflare host is live. Civweave strongly recommends a local companion/backup so this host can preserve identity and state if the cloud side disappears.</span></div><div class="cw-anchor-actions"><a href="/host-local-anchor.html">Install local Anchor</a><button type="button" data-anchor-paired>Anchor is paired</button><button type="button" data-anchor-later>Remind me tomorrow</button></div>`;
  const style=document.createElement('style');
  style.textContent='[data-civweave-anchor-reminder]{position:fixed;z-index:2147483000;left:max(12px,env(safe-area-inset-left));right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));display:flex;gap:14px;align-items:center;justify-content:space-between;padding:14px 16px;border:1px solid #d8b86488;border-radius:16px;background:#0b1320f2;color:#f7f2e7;box-shadow:0 16px 50px #0009;font:14px/1.35 system-ui,-apple-system,sans-serif;backdrop-filter:blur(12px)}.cw-anchor-copy{display:grid;gap:3px;max-width:720px}.cw-anchor-copy small{font-weight:900;letter-spacing:.12em;color:#e4c86f}.cw-anchor-copy strong{font-size:1rem}.cw-anchor-copy span{color:#c9d2d8}.cw-anchor-actions{display:flex;flex-wrap:wrap;gap:7px;justify-content:flex-end}.cw-anchor-actions a,.cw-anchor-actions button{min-height:38px;padding:8px 11px;border:1px solid #d8b86477;border-radius:10px;background:#172434;color:#fff;text-decoration:none;font:700 12px system-ui;cursor:pointer}.cw-anchor-actions a{background:#5b4618}@media(max-width:760px){[data-civweave-anchor-reminder]{align-items:stretch;flex-direction:column}.cw-anchor-actions{justify-content:stretch}.cw-anchor-actions a,.cw-anchor-actions button{flex:1;text-align:center}}';
  document.head.append(style);
  document.body.append(node);
  node.querySelector('[data-anchor-paired]')?.addEventListener('click',()=>{savePaired();remove()});
  node.querySelector('[data-anchor-later]')?.addEventListener('click',()=>{snooze();remove()});
}
async function boot(){
  if(!steward())return;
  try{
    const response=await fetch('/app/host-deployment-v1.json',{cache:'no-store'});
    if(!response.ok)return;
    const meta=await response.json();
    if(meta?.schema!=='civweave.host-deployment.v1')return;
    render(meta);
  }catch{}
}
if(document.readyState==='loading')addEventListener('DOMContentLoaded',boot,{once:true});else boot();
globalThis.CivweaveHostStewardReminderV1=Object.freeze({version:VERSION,markPaired(){savePaired();remove()},reset(){try{localStorage.removeItem(ANCHOR_KEY);localStorage.removeItem(SNOOZE_KEY)}catch{};boot()},isSteward:steward,isPaired:paired});
})();
