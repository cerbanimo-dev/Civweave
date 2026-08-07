(()=>{
'use strict';
const REVISION='canonical-campus-startup-v227';
const BRAND_REVISION='main-brand-v231';
const routeScript='/app/system-routes-v227.js?v=1.0.20-five-system-route-contract-v227';
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
  if(!campusReady())throw new Error(`Working Campus DOM contract is incomplete: ${missingRequired().join(', ')||'campus root'}.`);
  await ensureRouteContract();
  const source=await Promise.all(parts.map(fetchPart));
  if(!liveDocument())throw new DOMException('Working Campus navigation interrupted startup.','AbortError');
  Function(source.join(''))();
  document.documentElement.dataset.civweaveCampusRuntime='ready';
  dispatchEvent(new CustomEvent('civweave:working-campus-runtime-ready',{detail:{revision:REVISION,brandRevision:BRAND_REVISION,parts:parts.length,at:new Date().toISOString(),policy:'canonical-core-only-five-system-routing'}}));
}
boot().catch(error=>{
  if(!active||error?.name==='AbortError')return;
  console.error('[Civweave] Working Campus failed to start.',error);
  const node=document.querySelector('#workspace');
  if(node)node.innerHTML=`<section class="card"><h2>Working Campus could not start</h2><p>${String(error.message||error)}</p><button class="btn" onclick="location.reload()">Retry</button></section>`;
});
})();
