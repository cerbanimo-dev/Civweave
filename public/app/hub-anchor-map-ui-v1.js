(()=>{
'use strict';

const VERSION='1.0.106-hub-anchor-map-ui-v1';
const ENDPOINT_KEY='federation-finder.physical-node-endpoint';
const REMIND_KEY='civweave.anchor-remind-after.v1';
const DAY_MS=24*60*60*1000;
const endpoint=document.getElementById('nodeEndpoint');
const checkButton=document.getElementById('anchorCheck');
const setupButton=document.getElementById('anchorSetup');
const remindButton=document.getElementById('anchorRemind');
const card=document.getElementById('anchorHealth');
const title=document.getElementById('anchorHealthTitle');
const detail=document.getElementById('anchorHealthDetail');
const meta=document.getElementById('anchorHealthMeta');
const syncButton=document.getElementById('syncNode');
const openNodeButton=document.getElementById('openNode');
if(!endpoint||!card||!title||!detail||!meta)return;

card.dataset.anchorUiVersion=VERSION;

function origin(value=''){
  try{
    const raw=String(value||'').trim();
    if(!raw)return'';
    const url=new URL(/^https?:\/\//i.test(raw)?raw:`https://${raw}`);
    if(!['http:','https:'].includes(url.protocol))return'';
    return url.origin;
  }catch{return''}
}
function dateText(value){
  const time=Date.parse(value||'');
  if(!Number.isFinite(time))return'no checkpoint yet';
  const minutes=Math.max(0,Math.round((Date.now()-time)/60000));
  if(minutes<2)return'checkpoint just now';
  if(minutes<120)return`checkpoint ${minutes} min ago`;
  const hours=Math.round(minutes/60);
  if(hours<48)return`checkpoint ${hours} hr ago`;
  return`checkpoint ${Math.round(hours/24)} d ago`;
}
function quieted(){return Number(localStorage.getItem(REMIND_KEY)||0)>Date.now()}
function setState(state,headline,body,extra=''){
  card.dataset.state=state;
  card.classList.toggle('quiet',state==='cloud-only'&&quieted());
  title.textContent=headline;
  detail.textContent=body;
  meta.textContent=extra;
  if(remindButton)remindButton.hidden=state!=='cloud-only';
}
function general(){
  setState('unknown','Local Anchor recommended','Cloud hubs work without a backup, but Civweave will keep recommending one. Any laptop, desktop, Raspberry Pi, NAS, or home server can preserve hub continuity.','Healthy independent Anchors can earn 3 / 2 / 1 Buttons per week by redundancy rank.');
}
function render(status){
  const state=String(status?.resilienceClass||'cloud-only');
  const healthy=Math.max(0,Number(status?.healthyAnchors||0));
  const total=Math.max(0,Number(status?.totalAnchors||0));
  const coverage=Math.max(0,Math.min(100,Number(status?.recoveryCoverageBps||0)/100));
  const checkpoint=dateText(status?.latestCheckpointAt);
  if(state==='redundantly-anchored'){
    setState(state,`Redundantly anchored · ${healthy} healthy`,`This hub has independent recovery copies. Keep them syncing so the shared ledger and signed checkpoint can reconstruct the hub after a grid failure.`,`${checkpoint} · ${coverage.toFixed(1)}% recovery coverage · ${total} paired`);
    return;
  }
  if(state==='locally-anchored'){
    setState(state,'Locally anchored · 1 healthy backup','The hub has a recoverable local copy. A second independent Anchor is still recommended so one sleeping or lost device does not become the new single point of failure.',`${checkpoint} · ${coverage.toFixed(1)}% recovery coverage · primary healthy Anchor can earn 3 Buttons/week`);
    return;
  }
  setState('cloud-only','Cloud-only · add a local Anchor','Nothing is blocked, but this hub currently depends on cloud infrastructure for its freshest recovery state. Pair a laptop or other local device and let it sync periodically.',`${checkpoint} · ${total} paired · eligible Anchors earn 3 / 2 / 1 Buttons/week`);
}
async function checkNow({silent=false}={}){
  const base=origin(endpoint.value||localStorage.getItem(ENDPOINT_KEY)||'');
  if(!base){general();if(!silent)endpoint.focus();return}
  if(!silent)setState('checking','Checking Anchor health…','Reading the hub’s public resilience status.','');
  try{
    const response=await fetch(`${base}/api/node/anchor/status`,{cache:'no-store',headers:{accept:'application/json'}});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    render(await response.json());
  }catch(error){
    setState('unavailable','Anchor status unavailable','This node did not answer the Civweave Anchor status endpoint. It may be a local/older node or the cloud host may be offline.',String(error?.message||error));
  }
}

checkButton?.addEventListener('click',()=>checkNow());
setupButton?.addEventListener('click',()=>{
  const base=origin(endpoint.value||localStorage.getItem(ENDPOINT_KEY)||'');
  if(!base){endpoint.focus();return}
  if(openNodeButton)openNodeButton.click();
  else window.open(base,'_blank','noopener,noreferrer');
});
remindButton?.addEventListener('click',()=>{
  localStorage.setItem(REMIND_KEY,String(Date.now()+DAY_MS));
  card.classList.add('quiet');
  remindButton.textContent='Reminder set for tomorrow';
});
endpoint.addEventListener('change',()=>checkNow({silent:true}));
syncButton?.addEventListener('click',()=>setTimeout(()=>checkNow({silent:true}),800));

general();
if(origin(endpoint.value||localStorage.getItem(ENDPOINT_KEY)||''))void checkNow({silent:true});
})();
