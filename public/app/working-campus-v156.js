(()=>{
'use strict';
const parts=['/app/working-campus-v156.part1.txt','/app/working-campus-v156.part2.txt','/app/working-campus-v156.part3.txt','/app/working-campus-v156.part4.txt','/app/working-campus-v156.part5.txt'];
const loadScript=(src,ready)=>{
  if(ready?.())return Promise.resolve(true);
  const path=new URL(src,location.href).pathname;
  const existing=[...document.scripts].find(script=>script.src&&new URL(script.src).pathname===path);
  if(existing)return new Promise((resolve,reject)=>{
    let ticks=0;
    const timer=setInterval(()=>{
      if(ready?.()){clearInterval(timer);resolve(true)}
      else if(++ticks>240){clearInterval(timer);reject(new Error(`${path} loaded without becoming ready.`))}
    },50);
  });
  return new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=src;
    script.async=false;
    script.onload=()=>ready?.()?resolve(true):reject(new Error(`${path} loaded without becoming ready.`));
    script.onerror=()=>reject(new Error(`Could not load ${path}.`));
    document.head.append(script);
  });
};
function loadStyle(href){
  const path=new URL(href,location.href).pathname;
  if([...document.styleSheets].some(sheet=>{try{return sheet.href&&new URL(sheet.href).pathname===path}catch{return false}}))return;
  const link=document.createElement('link');link.rel='stylesheet';link.href=href;document.head.append(link);
}
async function startCampus(){
  const source=await Promise.all(parts.map(async path=>{
    const response=await fetch(path,{cache:'force-cache'});
    if(!response.ok)throw new Error(`Working Campus source ${path} returned ${response.status}`);
    return response.text();
  }));
  Function(source.join(''))();
}
async function startNetworkCommons(){
  loadStyle('/app/network-commons-v219.css?v=1.0.7');
  await loadScript('/extensions/commonweave-qr-v156.js?v=1.0.7',()=>globalThis.CommonweaveQRV156);
  await loadScript('/extensions/commonweave-mesh-tools-v156.js?v=1.0.7',()=>globalThis.CommonweaveMeshToolsV156);
  await loadScript('/extensions/commonweave-peer-discovery-v219.js?v=1.0.7',()=>globalThis.CommonweavePeerDiscoveryV219);
  await loadScript('/app/network-commons-v219.js?v=1.0.7',()=>globalThis.CommonweaveNetworkCommonsV219);
}
startCampus().catch(error=>{
  console.error('[Commonweave] Working Campus failed to start.',error);
  const node=document.querySelector('#workspace');
  if(node)node.innerHTML=`<section class="card"><h2>Working Campus could not start</h2><p>${String(error.message||error)}</p><button class="btn" onclick="location.reload()">Retry</button></section>`;
});
startNetworkCommons().catch(error=>console.warn('[Commonweave] Network Commons could not start.',error));
})();
