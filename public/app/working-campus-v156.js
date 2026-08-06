(()=>{
'use strict';
const REVISION='campus-document-lifecycle-v221';
const parts=['/app/working-campus-v156.part1.txt','/app/working-campus-v156.part2.txt','/app/working-campus-v156.part3.txt','/app/working-campus-v156.part4.txt','/app/working-campus-v156.part5.txt'];
const required=['conversation','weaveling-chat-form','weaveling-chat-input','workspace','view-title','state-label'];
const controller=new AbortController();
let active=true;
function liveDocument(){return active&&document.documentElement?.isConnected&&document.head?.isConnected&&document.body?.isConnected}
function campusReady(){return liveDocument()&&required.every(id=>document.getElementById(id))}
function stop(){active=false;controller.abort()}
addEventListener('pagehide',stop,{once:true});
addEventListener('beforeunload',stop,{once:true});
async function boot(){
  if(document.readyState==='loading')await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true,signal:controller.signal}));
  if(!campusReady())throw new Error('Working Campus DOM contract is incomplete; startup was cancelled before binding.');
  const source=[];
  for(const pathname of parts){
    if(!active)throw new DOMException('Working Campus navigation interrupted startup.','AbortError');
    const url=new URL(pathname,location.origin);url.searchParams.set('revision',REVISION);
    const response=await fetch(url,{cache:'no-store',signal:controller.signal});
    if(!response.ok)throw new Error(`Working Campus source ${pathname} returned ${response.status}`);
    source.push(await response.text());
  }
  if(!campusReady())throw new Error('Working Campus document changed before runtime evaluation.');
  Function(source.join(''))();
}
boot().catch(error=>{
  if(!active||error?.name==='AbortError')return;
  console.error('[Commonweave] Working Campus failed to start.',error);
  const node=document.querySelector('#workspace');
  if(node)node.innerHTML=`<section class="card"><h2>Working Campus could not start</h2><p>${String(error.message||error)}</p><button class="btn" onclick="location.reload()">Retry</button></section>`;
});
})();
