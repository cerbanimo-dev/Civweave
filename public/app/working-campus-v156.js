(()=>{
'use strict';
const REVISION='canonical-campus-startup-v226';
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
async function fetchPart(pathname){
  const url=new URL(pathname,location.origin);
  url.searchParams.set('revision',REVISION);
  const response=await fetch(url,{cache:'no-store',signal:controller.signal,redirect:'follow'});
  if(!response.ok)throw new Error(`Working Campus source ${pathname} returned ${response.status}`);
  return response.text();
}
async function boot(){
  if(document.readyState==='loading')await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true,signal:controller.signal}));
  if(!campusReady())throw new Error(`Working Campus DOM contract is incomplete: ${missingRequired().join(', ')||'campus root'}.`);
  const source=await Promise.all(parts.map(fetchPart));
  if(!liveDocument())throw new DOMException('Working Campus navigation interrupted startup.','AbortError');
  Function(source.join(''))();
  document.documentElement.dataset.commonweaveCampusRuntime='ready';
  dispatchEvent(new CustomEvent('commonweave:working-campus-runtime-ready',{detail:{revision:REVISION,parts:parts.length,at:new Date().toISOString(),policy:'canonical-core-only'}}));
}
boot().catch(error=>{
  if(!active||error?.name==='AbortError')return;
  console.error('[Commonweave] Working Campus failed to start.',error);
  const node=document.querySelector('#workspace');
  if(node)node.innerHTML=`<section class="card"><h2>Working Campus could not start</h2><p>${String(error.message||error)}</p><button class="btn" onclick="location.reload()">Retry</button></section>`;
});
})();
