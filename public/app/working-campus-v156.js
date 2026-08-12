(()=>{
'use strict';
const REVISION='canonical-campus-startup-v227';
const BRAND_REVISION='compact-shell-v235';
const WEB_ENTRY_REVISION='web-install-entry-v232';
const HUB_REVISION='weaveling-hub-v233';
const STATE_REPAIR_REVISION='working-campus-state-repair-v238';
const HUB_SCRIPT='/app/weaveling-hub-v233.js';
const routeScript='/app/system-routes-v227.js?v=1.0.121-five-system-route-contract-v227';
const parts=['/app/working-campus-v156.part1.txt','/app/working-campus-v156.part2.txt','/app/working-campus-v156.part3.txt','/app/working-campus-v156.part4.txt','/app/working-campus-v156.part5.txt'];
const required=['conversation','weaveling-chat-form','weaveling-chat-input','workspace','view-title','state-label'];
const controller=new AbortController();
const bootDocument=document.documentElement;
const bootUrl=location.href;
let active=true;
function missingRequired(){return required.filter(id=>!document.getElementById(id));}
function liveDocument(){return active&&document.documentElement===bootDocument&&document.documentElement?.isConnected&&document.head?.isConnected&&document.body?.isConnected&&location.href===bootUrl;}
function campusReady(){return liveDocument()&&Boolean(document.querySelector('main.app'))&&missingRequired().length===0;}
function stop(){active=false;controller.abort();}
addEventListener('pagehide',stop,{once:true});
addEventListener('beforeunload',stop,{once:true});
function installedDisplay(){return navigator.standalone===true||['standalone','fullscreen','minimal-ui','window-controls-overlay'].some(mode=>matchMedia(`(display-mode: ${mode})`).matches)}
function safeParse(value,fallback){try{return JSON.parse(value)??fallback}catch{return fallback}}
function safeClone(value){try{return typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value))}catch{return null}}
function recoveredPlan(source={},fallback={}){
  const value=source&&typeof source==='object'?source:{};
  const title=String(value.title||value.text||fallback.title||fallback.text||fallback.wish||'Recovered weave').trim().slice(0,140)||'Recovered weave';
  const wish=String(value.wish||fallback.wish||fallback.text||title).trim();
  const paths=Array.isArray(value.paths)?value.paths.filter(Boolean).map(path=>({
    ...path,
    id:path?.id||`recovered-path-${Math.random().toString(36).slice(2,8)}`,
    realm:path?.realm||'cerbanimo',
    title:String(path?.title||'Recovered path'),
    purpose:String(path?.purpose||'Recovered from local state. Review before continuing.'),
    steps:Array.isArray(path?.steps)?path.steps:[],
    progress:Array.isArray(path?.progress)?path.progress:[],
    status:path?.status||'ready'
  })):[];
  const governance=value.governance&&typeof value.governance==='object'?value.governance:{};
  return{
    ...value,
    schema:value.schema||'civweave.intention-weave.v1',
    id:value.id||fallback.id||`recovered-weave-${Date.now().toString(36)}`,
    title,
    wish,
    outcome:String(value.outcome||fallback.outcome||'Recovered from an older local weave record. Review the route before activation.'),
    state:['review','active','completed'].includes(value.state)?value.state:'review',
    createdAt:value.createdAt||fallback.createdAt||new Date().toISOString(),
    updatedAt:new Date().toISOString(),
    profile:value.profile&&typeof value.profile==='object'?value.profile:{},
    assumptions:Array.isArray(value.assumptions)?value.assumptions:[],
    paths,
    governance:{
      realm:'anarchadia',
      title:String(governance.title||'Recovered passport entry'),
      purpose:String(governance.purpose||'Review recovered participation, boundaries, and commitments before activation.'),
      agreements:Array.isArray(governance.agreements)?governance.agreements:[]
    },
    requiresExplicitActivation:value.requiresExplicitActivation!==false,
    recoveredBy:STATE_REPAIR_REVISION
  };
}
function repairPersistedCampusState(){
  const K='civweave.working-campus.v1',I='civweave.intentions.v127';
  let state=safeParse(localStorage.getItem(K),{});
  if(!state||typeof state!=='object'||Array.isArray(state))state={};
  let ledger=safeParse(localStorage.getItem(I),[]);
  if(!Array.isArray(ledger))ledger=[];
  let changed=false,ledgerChanged=false;
  ledger=ledger.map(row=>{
    if(!row||row.kind!=='weave-plan')return row;
    const existing=row.plan&&typeof row.plan==='object'?row.plan:null;
    const next=recoveredPlan(existing||{},row);
    if(!existing||!existing.title||!Array.isArray(existing.paths)||!existing.governance){ledgerChanged=true;return{...row,text:row.text||next.title,state:row.state||next.state,plan:next,updatedAt:next.updatedAt}}
    return row;
  });
  const planValid=state.plan&&typeof state.plan==='object';
  if(planValid){
    const repaired=recoveredPlan(state.plan,{wish:state.wish});
    if(!state.plan.title||!Array.isArray(state.plan.paths)||!state.plan.governance){state.plan=repaired;changed=true}
  }else if(['review','active'].includes(state.stage)){
    const candidate=ledger.find(row=>row?.kind==='weave-plan'&&row?.plan&&typeof row.plan==='object');
    if(candidate){state.plan=safeClone(candidate.plan)||recoveredPlan(candidate.plan,candidate);state.wish=state.plan.wish||state.wish||'';state.stage=state.plan.state==='review'?'review':'active';changed=true}
    else{state.plan=null;state.stage=String(state.wish||'').trim()?'profile':'wish';changed=true}
  }
  if(!['weave','progress','library','campus'].includes(state.view)){state.view='weave';changed=true}
  if(!Array.isArray(state.conversation)){state.conversation=[];changed=true}
  if(state.stage==='active'&&(!state.plan||!Array.isArray(state.plan.paths))){state.stage=state.plan?'review':(String(state.wish||'').trim()?'profile':'wish');changed=true}
  if(ledgerChanged)try{localStorage.setItem(I,JSON.stringify(ledger.slice(0,100)))}catch{}
  if(changed)try{state.updatedAt=new Date().toISOString();localStorage.setItem(K,JSON.stringify(state))}catch{}
  document.documentElement.dataset.civweaveCampusStateRepair=STATE_REPAIR_REVISION;
  return{changed,ledgerChanged,stage:state.stage||'wish',hasPlan:Boolean(state.plan)};
}
function installWebEntryPrompt(){
  if(installedDisplay())return false;
  try{if(sessionStorage.getItem('civweave.web-install-prompt.dismissed.v232')==='1')return false}catch{}
  const app=document.querySelector('main.app'),top=document.querySelector('.top');
  if(!app||!top||document.getElementById('cw-web-install-entry-v232'))return false;
  let style=document.getElementById('cw-web-install-entry-style-v232');
  if(!style){
    style=document.createElement('style');
    style.id='cw-web-install-entry-style-v232';
    style.textContent=`
#cw-web-install-entry-v232{position:relative;z-index:3;max-width:1180px;margin:7px auto;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;padding:9px 11px;border:1px solid #8af5d255;border-radius:14px;background:linear-gradient(135deg,#102a3eea,#1e1737e8);box-shadow:0 8px 24px #0005,inset 0 0 18px #8af5d20a}
#cw-web-install-entry-v232[hidden]{display:none!important}#cw-web-install-entry-v232 small{display:block;color:#8af5d2;font-size:8px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}#cw-web-install-entry-v232 strong{display:inline;margin-right:6px;font:700 14px/1.15 Georgia,serif}#cw-web-install-entry-v232 p{display:inline;margin:0;color:#c6d1df;font-size:10.5px;line-height:1.3}
#cw-web-install-entry-v232 .cw-web-install-actions{display:flex;gap:5px;align-items:center;flex-wrap:nowrap;justify-content:flex-end}#cw-web-install-entry-v232 a,#cw-web-install-entry-v232 button{min-height:34px;border-radius:9px;padding:7px 9px;font:800 11px/1 system-ui,sans-serif;text-decoration:none;white-space:nowrap}#cw-web-install-entry-v232 a{border:1px solid #8af5d299;background:linear-gradient(135deg,#8af5d230,#ef8cff2e);color:#fff}#cw-web-install-entry-v232 button{border:1px solid #ffffff24;background:#ffffff0a;color:#dce6ef;cursor:pointer}
@media(max-width:700px){#cw-web-install-entry-v232{grid-template-columns:1fr}#cw-web-install-entry-v232 .cw-web-install-actions{justify-content:stretch}#cw-web-install-entry-v232 a,#cw-web-install-entry-v232 button{flex:1;text-align:center}}
`;
    document.head.append(style);
  }
  const prompt=document.createElement('section');
  prompt.id='cw-web-install-entry-v232';
  prompt.dataset.webInstallEntry=WEB_ENTRY_REVISION;
  prompt.innerHTML='<div><small>Designed to live on your device</small><strong>Install Civweave for the full local and offline campus.</strong><p>You can use Civweave in this browser now. Installing downloads the working campus to your device and keeps the local-first experience available offline.</p></div><div class="cw-web-install-actions"><a data-cw-web-install href="/app/index.html">Install Civweave</a><button data-cw-web-continue type="button">Continue in browser</button></div>';
  const installer=new URL('/app/index.html',location.origin);
  installer.searchParams.set('install','required');
  installer.searchParams.set('next',`${location.pathname}${location.search}${location.hash}`.slice(0,1800));
  prompt.querySelector('[data-cw-web-install]').href=installer.href;
  prompt.querySelector('[data-cw-web-continue]').addEventListener('click',()=>{try{sessionStorage.setItem('civweave.web-install-prompt.dismissed.v232','1')}catch{}prompt.hidden=true});
  top.insertAdjacentElement('afterend',prompt);
  document.documentElement.dataset.civweaveWebEntry=WEB_ENTRY_REVISION;
  return true;
}
function installBrandPresentation(){
  let manifest=document.querySelector('link[rel="manifest"]');
  if(!manifest){manifest=document.createElement('link');manifest.rel='manifest';manifest.href='/app/manifest.webmanifest';document.head.append(manifest)}
  let icon=document.querySelector('link[rel~="icon"]');
  if(!icon){icon=document.createElement('link');icon.rel='icon';icon.type='image/png';document.head.append(icon)}
  icon.href='/app/logos/civweave-app-icon.png';
  const brand=document.querySelector('#brand-home img');
  if(brand){brand.src='/app/logos/civweave-app-icon.png';brand.alt='Civweave';}
  document.documentElement.dataset.civweaveBrandPresentation=BRAND_REVISION;
}
function installDiagnosticsPolicy(){
  const params=new URLSearchParams(location.search);
  let stored='';
  try{stored=localStorage.getItem('civweave.log-level')||''}catch{}
  const enabled=params.get('diagnostics')==='1'||params.get('cwlog')==='1'||stored==='debug';
  document.documentElement.dataset.civweaveDiagnostics=enabled?'true':'false';
  const button=document.getElementById('diagnostics-button');
  if(button){button.hidden=!enabled;button.setAttribute('aria-hidden',enabled?'false':'true')}
  return enabled;
}
function installCivweaveChatLauncherOwnership(){
  const own=()=>{
    try{return globalThis.CivweavePersistentGuideChatV215?.switchGuide?.('civweave')||false}catch{return false}
  };
  addEventListener('civweave:persistent-guide-chat-ready',()=>own());
  document.addEventListener('click',event=>{
    const target=event.target instanceof Element?event.target:null;
    if(!target)return;
    if(target.closest('#cwp215-launcher')){
      const chat=globalThis.CivweavePersistentGuideChatV215;
      if(!chat?.open)return;
      event.preventDefault();
      event.stopImmediatePropagation();
      chat.open({guide:'civweave'});
      return;
    }
    if(target.closest('#cw-persistent-guide-chat-v215 [data-close]'))queueMicrotask(own);
  },true);
  own();
  document.documentElement.dataset.civweaveChatLauncherOwner='civweave-v235';
}
function installHeaderHitSafety(){
  let style=document.getElementById('cw-working-campus-hit-safety-v238');
  if(!style){style=document.createElement('style');style.id='cw-working-campus-hit-safety-v238';style.textContent=`main.app>.top{position:relative!important;z-index:2147483620!important;pointer-events:auto!important;isolation:isolate}main.app>.top>*{pointer-events:auto!important;position:relative}main.app>.top:after{pointer-events:none!important}#cw-shared-guide-surface-v236{z-index:2!important}#cw-web-install-entry-v232{z-index:3!important}`;document.head.append(style)}
  document.documentElement.dataset.civweaveHeaderHitSafety='v238';
}
function ensureRouteContract(){
  if(globalThis.CivweaveSystemRoutesV227){globalThis.CivweaveSystemRoutesV227.authorize();return Promise.resolve(true)}
  return new Promise((resolve,reject)=>{
    const existing=[...document.scripts].find(script=>script.src&&new URL(script.src,location.href).pathname==='/app/system-routes-v227.js');
    const ready=()=>{if(globalThis.CivweaveSystemRoutesV227){globalThis.CivweaveSystemRoutesV227.authorize();resolve(true)}else reject(new Error('The five-system route contract loaded without becoming ready.'))};
    if(existing){existing.addEventListener('load',ready,{once:true});existing.addEventListener('error',()=>reject(new Error('The five-system route contract could not load.')),{once:true});return}
    const script=document.createElement('script');script.src=routeScript;script.async=false;script.onload=ready;script.onerror=()=>reject(new Error('The five-system route contract could not load.'));document.head.append(script);
  });
}
function ensureHub(){
  if(globalThis.CivweaveWeavelingHubV233)return Promise.resolve(true);
  return new Promise((resolve,reject)=>{
    const existing=[...document.scripts].find(script=>script.src&&new URL(script.src,location.href).pathname===HUB_SCRIPT);
    const ready=()=>globalThis.CivweaveWeavelingHubV233?resolve(true):reject(new Error('The Weaveling observation hub loaded without becoming ready.'));
    if(existing){existing.addEventListener('load',ready,{once:true});existing.addEventListener('error',()=>reject(new Error('The Weaveling observation hub could not load.')),{once:true});return}
    const script=document.createElement('script');script.src=`${HUB_SCRIPT}?v=${HUB_REVISION}`;script.async=false;script.onload=ready;script.onerror=()=>reject(new Error('The Weaveling observation hub could not load.'));document.head.append(script);
  });
}
async function fetchPart(pathname){
  const url=new URL(pathname,location.origin);
  url.searchParams.set('revision',REVISION);
  const response=await fetch(url,{cache:'no-store',signal:controller.signal,redirect:'follow',headers:{'x-civweave-package':'working-campus-v227'}});
  if(!response.ok)throw new Error(`Working Campus source ${pathname} returned ${response.status}`);
  return response.text();
}
async function boot(){
  if(document.readyState==='loading')await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true,signal:controller.signal}));
  installBrandPresentation();
  installDiagnosticsPolicy();
  installHeaderHitSafety();
  repairPersistedCampusState();
  installCivweaveChatLauncherOwnership();
  installWebEntryPrompt();
  if(!campusReady())throw new Error(`Working Campus DOM contract is incomplete: ${missingRequired().join(', ')||'campus root'}.`);
  await ensureHub();
  await ensureRouteContract();
  const source=await Promise.all(parts.map(fetchPart));
  if(!liveDocument())throw new DOMException('Working Campus navigation interrupted startup.','AbortError');
  Function(source.join(''))();
  document.documentElement.dataset.civweaveCampusRuntime='ready';
  dispatchEvent(new CustomEvent('civweave:working-campus-runtime-ready',{detail:{revision:REVISION,brandRevision:BRAND_REVISION,webEntryRevision:WEB_ENTRY_REVISION,hubRevision:HUB_REVISION,stateRepairRevision:STATE_REPAIR_REVISION,parts:parts.length,at:new Date().toISOString(),policy:'canonical-core-only-five-system-routing'}}));
}
boot().catch(error=>{
  if(!active||error?.name==='AbortError')return;
  console.error('[Civweave] Working Campus failed to start.',error);
  const node=document.querySelector('#workspace');
  if(node)node.innerHTML=`<section class="card"><h2>Working Campus could not start</h2><p>${String(error.message||error)}</p><button class="btn" onclick="location.reload()">Retry</button></section>`;
});
})();

