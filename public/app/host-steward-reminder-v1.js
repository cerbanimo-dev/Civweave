(()=>{
'use strict';
const VERSION='host-steward-reminder-v2';
const STEWARD_KEY='civweave.host-steward.v1';
const ANCHOR_KEY='civweave.host-anchor.paired.v1';
const ANCHOR_ORIGIN_KEY='civweave.host-anchor.origin.v1';
const VERIFIED_KEY='civweave.host-anchor.verified-at.v1';
const SNOOZE_KEY='civweave.host-anchor.snooze-until.v1';
const params=new URLSearchParams(location.search);
if(params.get('host_setup')==='1'){try{localStorage.setItem(STEWARD_KEY,'1')}catch{}}
const steward=()=>{try{return localStorage.getItem(STEWARD_KEY)==='1'}catch{return false}};
const paired=()=>{try{return localStorage.getItem(ANCHOR_KEY)==='1'}catch{return false}};
const snoozed=()=>{try{return Number(localStorage.getItem(SNOOZE_KEY)||0)>Date.now()}catch{return false}};
const storedOrigin=()=>{try{return String(localStorage.getItem(ANCHOR_ORIGIN_KEY)||'').trim()}catch{return''}};
function saveHealthy(origin){try{localStorage.setItem(ANCHOR_KEY,'1');localStorage.setItem(ANCHOR_ORIGIN_KEY,origin);localStorage.setItem(VERIFIED_KEY,new Date().toISOString());localStorage.removeItem(SNOOZE_KEY)}catch{}}
function saveUnhealthy(){try{localStorage.removeItem(ANCHOR_KEY)}catch{}}
function snooze(){try{localStorage.setItem(SNOOZE_KEY,String(Date.now()+24*60*60*1000))}catch{}}
function remove(){document.querySelector('[data-civweave-anchor-reminder]')?.remove()}
async function checkHealth(){
  const origin=storedOrigin();
  if(!origin)return{known:false,healthy:false,reason:'no-cloud-node-linked'};
  try{
    const response=await fetch(`${origin.replace(/\/$/,'')}/api/node/anchor/status`,{cache:'no-store',headers:{accept:'application/json'}}),payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload.error||`HTTP ${response.status}`);
    const healthy=Math.max(0,Number(payload.healthyAnchors||0));
    if(healthy>0){saveHealthy(origin);return{known:true,healthy:true,payload}}
    saveUnhealthy();return{known:true,healthy:false,payload,reason:Math.max(0,Number(payload.totalAnchors||0))?'proof-stale-or-pending':'cloud-only'};
  }catch(error){return{known:false,healthy:paired(),error:String(error?.message||error),reason:'status-unavailable'}}
}
function render(meta,health={}){
  if(!steward()||snoozed()||!meta?.localAnchorRecommended)return;
  remove();
  const node=document.createElement('aside');
  node.dataset.civweaveAnchorReminder='1';
  node.setAttribute('role','status');
  const needsRepair=health.known&&health.healthy===false&&health.reason!=='no-cloud-node-linked';
  const headline=needsRepair?'Local Anchor needs attention':'Add a local Anchor';
  const copy=needsRepair?'The hub can see the Anchor relationship, but no device currently proves a fresh recoverable checkpoint. Re-sync or restore the local backup.':'Your Cloudflare host is live. Civweave strongly recommends a local companion so identity, settings, and reconstructable ledger continuity survive a cloud/grid failure.';
  const origin=storedOrigin(),href=origin?`/host-local-anchor.html?host=${encodeURIComponent(origin)}`:'/host-local-anchor.html';
  node.innerHTML=`<div class="cw-anchor-copy"><small>HOST STEWARD</small><strong>${headline}</strong><span>${copy}</span></div><div class="cw-anchor-actions"><a href="${href}">Open Anchor setup</a><button type="button" data-anchor-check>Check now</button><button type="button" data-anchor-later>Remind me tomorrow</button></div>`;
  const style=document.createElement('style');
  style.textContent='[data-civweave-anchor-reminder]{position:fixed;z-index:2147483000;left:max(12px,env(safe-area-inset-left));right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));display:flex;gap:14px;align-items:center;justify-content:space-between;padding:14px 16px;border:1px solid #d8b86488;border-radius:16px;background:#0b1320f2;color:#f7f2e7;box-shadow:0 16px 50px #0009;font:14px/1.35 system-ui,-apple-system,sans-serif;backdrop-filter:blur(12px)}.cw-anchor-copy{display:grid;gap:3px;max-width:720px}.cw-anchor-copy small{font-weight:900;letter-spacing:.12em;color:#e4c86f}.cw-anchor-copy strong{font-size:1rem}.cw-anchor-copy span{color:#c9d2d8}.cw-anchor-actions{display:flex;flex-wrap:wrap;gap:7px;justify-content:flex-end}.cw-anchor-actions a,.cw-anchor-actions button{min-height:38px;padding:8px 11px;border:1px solid #d8b86477;border-radius:10px;background:#172434;color:#fff;text-decoration:none;font:700 12px system-ui;cursor:pointer}.cw-anchor-actions a{background:#5b4618}@media(max-width:760px){[data-civweave-anchor-reminder]{align-items:stretch;flex-direction:column}.cw-anchor-actions{justify-content:stretch}.cw-anchor-actions a,.cw-anchor-actions button{flex:1;text-align:center}}';
  document.head.append(style);document.body.append(node);
  node.querySelector('[data-anchor-check]')?.addEventListener('click',async event=>{event.currentTarget.disabled=true;event.currentTarget.textContent='Checking…';const result=await checkHealth();if(result.healthy){remove();return}event.currentTarget.disabled=false;event.currentTarget.textContent='Still needs attention';node.querySelector('.cw-anchor-copy span').textContent=result.known?'No healthy fresh storage proof is currently registered. Open Anchor setup to re-sync it.':'The live status check was unavailable. Open Anchor setup to inspect the local copy.'});
  node.querySelector('[data-anchor-later]')?.addEventListener('click',()=>{snooze();remove()});
}
async function boot(){
  if(!steward())return;
  try{
    const response=await fetch('/app/host-deployment-v1.json',{cache:'no-store'});if(!response.ok)return;
    const meta=await response.json();if(meta?.schema!=='civweave.host-deployment.v1')return;
    const health=await checkHealth();
    if(health.healthy)return;
    if(!health.known&&paired())return;
    render(meta,health);
  }catch{}
}
if(document.readyState==='loading')addEventListener('DOMContentLoaded',boot,{once:true});else boot();
globalThis.CivweaveHostStewardReminderV1=Object.freeze({version:VERSION,verify:checkHealth,reset(){try{localStorage.removeItem(ANCHOR_KEY);localStorage.removeItem(ANCHOR_ORIGIN_KEY);localStorage.removeItem(VERIFIED_KEY);localStorage.removeItem(SNOOZE_KEY)}catch{};boot()},isSteward:steward,isPaired:paired});
})();
