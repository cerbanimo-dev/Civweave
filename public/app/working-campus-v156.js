(()=>{
'use strict';
const REVISION='canonical-campus-startup-v227';
const BRAND_REVISION='main-brand-v231';
const WEB_ENTRY_REVISION='web-install-entry-v232';
const HUB_REVISION='weaveling-hub-v233';
const HUB_SCRIPT='/app/weaveling-hub-v233.js';
const routeScript='/app/system-routes-v227.js?v=1.0.22-five-system-route-contract-v227';
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
#cw-web-install-entry-v232{position:relative;z-index:3;max-width:1180px;margin:12px auto 0;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;padding:14px 16px;border:1px solid #8af5d266;border-radius:20px;background:linear-gradient(135deg,#102a3ef2,#1e1737ed);box-shadow:0 14px 36px #0007,inset 0 0 28px #8af5d20d}
#cw-web-install-entry-v232[hidden]{display:none!important}#cw-web-install-entry-v232 small{display:block;color:#8af5d2;font-weight:900;letter-spacing:.11em;text-transform:uppercase}#cw-web-install-entry-v232 strong{display:block;margin:2px 0 3px;font:700 20px/1.15 Georgia,serif}#cw-web-install-entry-v232 p{margin:0;color:#c6d1df;max-width:720px}
#cw-web-install-entry-v232 .cw-web-install-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end}#cw-web-install-entry-v232 a,#cw-web-install-entry-v232 button{min-height:44px;border-radius:13px;padding:10px 14px;font:800 13px/1 system-ui,sans-serif;text-decoration:none}#cw-web-install-entry-v232 a{border:1px solid #8af5d2aa;background:linear-gradient(135deg,#8af5d238,#ef8cff35);color:#fff}#cw-web-install-entry-v232 button{border:1px solid #ffffff2b;background:#ffffff0b;color:#dce6ef;cursor:pointer}
@media(max-width:700px){#cw-web-install-entry-v232{grid-template-columns:1fr;margin-top:9px}#cw-web-install-entry-v232 .cw-web-install-actions{justify-content:stretch}#cw-web-install-entry-v232 a,#cw-web-install-entry-v232 button{flex:1;text-align:center}}
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
  if(!icon){icon=document.createElement('link');icon.rel='icon';icon.type='image/svg+xml';document.head.append(icon)}
  icon.href='/app/logos/civweave-symbol.svg';
  const brand=document.querySelector('#brand-home img');
  if(brand){brand.src='/app/logos/civweave-symbol.svg';brand.alt='Civweave';}
  if(document.getElementById('cw-main-brand-v231'))return;
  const style=document.createElement('style');
  style.id='cw-main-brand-v231';
  style.textContent=`
#brand-home{grid-template-columns:220px minmax(0,1fr)!important;gap:20px!important}
#brand-home img{width:220px!important;height:220px!important;object-fit:contain!important;filter:drop-shadow(0 0 22px #f4f4ef33)!important}
.campus .realm-node{min-height:180px!important}
.campus .realm-node img{width:118px!important;height:118px!important;object-fit:contain!important}
.guide-head img{width:96px!important;height:96px!important;object-fit:contain!important}
@media(max-width:800px){#brand-home{grid-template-columns:180px minmax(0,1fr)!important}#brand-home img{width:180px!important;height:180px!important}.campus .realm-node img{width:104px!important;height:104px!important}.campus .realm-node{min-height:168px!important}}
@media(max-width:480px){#brand-home{grid-template-columns:140px minmax(0,1fr)!important}#brand-home img{width:140px!important;height:140px!important}.campus .realm-node img{width:88px!important;height:88px!important}.campus .realm-node{min-height:150px!important}.guide-head img{width:82px!important;height:82px!important}}
`;
  document.head.append(style);
  document.documentElement.dataset.civweaveBrandPresentation=BRAND_REVISION;
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
  installWebEntryPrompt();
  if(!campusReady())throw new Error(`Working Campus DOM contract is incomplete: ${missingRequired().join(', ')||'campus root'}.`);
  await ensureHub();
  await ensureRouteContract();
  const source=await Promise.all(parts.map(fetchPart));
  if(!liveDocument())throw new DOMException('Working Campus navigation interrupted startup.','AbortError');
  Function(source.join(''))();
  document.documentElement.dataset.civweaveCampusRuntime='ready';
  dispatchEvent(new CustomEvent('civweave:working-campus-runtime-ready',{detail:{revision:REVISION,brandRevision:BRAND_REVISION,webEntryRevision:WEB_ENTRY_REVISION,hubRevision:HUB_REVISION,parts:parts.length,at:new Date().toISOString(),policy:'canonical-core-only-five-system-routing'}}));
}
boot().catch(error=>{
  if(!active||error?.name==='AbortError')return;
  console.error('[Civweave] Working Campus failed to start.',error);
  const node=document.querySelector('#workspace');
  if(node)node.innerHTML=`<section class="card"><h2>Working Campus could not start</h2><p>${String(error.message||error)}</p><button class="btn" onclick="location.reload()">Retry</button></section>`;
});
})();
