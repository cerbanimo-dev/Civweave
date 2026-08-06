(()=>{
'use strict';
const REVISION='campus-atomic-startup-v222';
const parts=['/app/working-campus-v156.part1.txt','/app/working-campus-v156.part2.txt','/app/working-campus-v156.part3.txt','/app/working-campus-v156.part4.txt','/app/working-campus-v156.part5.txt'];
const required=['conversation','weaveling-chat-form','weaveling-chat-input','workspace','view-title','state-label'];
const controller=new AbortController();
let active=true;
let campusRoot=null;
let requiredNodes=[];
function missingRequired(){return required.filter(id=>!document.getElementById(id));}
function liveDocument(){return active&&document.documentElement?.isConnected&&document.head?.isConnected&&document.body?.isConnected;}
function captureCampus(){
  campusRoot=document.querySelector('main.app');
  requiredNodes=required.map(id=>document.getElementById(id));
  const missing=required.filter((id,index)=>!requiredNodes[index]);
  return Boolean(campusRoot?.isConnected)&&missing.length===0;
}
function sameCampus(){return liveDocument()&&campusRoot?.isConnected&&requiredNodes.every(node=>node?.isConnected&&node.ownerDocument===document);}
function stop(){active=false;controller.abort();}
addEventListener('pagehide',stop,{once:true});
addEventListener('beforeunload',stop,{once:true});
async function fetchPart(pathname){
  const url=new URL(pathname,location.origin);
  url.searchParams.set('revision',REVISION);
  const response=await fetch(url,{cache:'no-store',signal:controller.signal});
  if(!response.ok)throw new Error(`Working Campus source ${pathname} returned ${response.status}`);
  return response.text();
}
async function boot(){
  if(document.readyState==='loading')await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true,signal:controller.signal}));
  if(!captureCampus())throw new Error(`Working Campus DOM contract is incomplete: ${missingRequired().join(', ')||'campus root'}.`);
  const source=await Promise.all(parts.map(fetchPart));
  if(!active)throw new DOMException('Working Campus navigation interrupted startup.','AbortError');
  if(!sameCampus()){
    const missing=missingRequired();
    throw new Error(`Working Campus DOM was replaced before runtime evaluation${missing.length?`: ${missing.join(', ')}`:''}.`);
  }
  Function(source.join(''))();
  document.documentElement.dataset.commonweaveCampusRuntime='ready';
  dispatchEvent(new CustomEvent('commonweave:working-campus-runtime-ready',{detail:{revision:REVISION,parts:parts.length,at:new Date().toISOString()}}));
}
boot().catch(error=>{
  if(!active||error?.name==='AbortError')return;
  console.error('[Commonweave] Working Campus failed to start.',error);
  const node=document.querySelector('#workspace');
  if(node)node.innerHTML=`<section class="card"><h2>Working Campus could not start</h2><p>${String(error.message||error)}</p><button class="btn" onclick="location.reload()">Retry</button></section>`;
});
})();
