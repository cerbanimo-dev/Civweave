(()=>{
'use strict';
const CATALOG_URL='/downloads/knowledge-schools/video-atlases/catalog.json';
const BASE='/downloads/knowledge-schools/video-atlases/';
const CACHE_NAME='cw-video-learning-atlas-v1';
const RECEIPT_KEY='civweave.video-learning-atlas.v1';
const INSTALL_MARKER_KEY='civweave.pwa.installed-marker.v1';
const AUTO_START_DELAY_MS=2500;
const AUTO_IDLE_TIMEOUT_MS=1800;
const card=document.querySelector('.knowledge-card'),schoolList=document.querySelector('#knowledge-school-list'),presets=document.querySelector('#knowledge-school-presets');
if(!card||!schoolList||document.querySelector('#video-atlas-panel'))return;
const panel=document.createElement('section');panel.id='video-atlas-panel';panel.className='video-atlas-panel';panel.innerHTML=`<div class="knowledge-school-copy"><small>VIDEO LEARNING ATLAS</small><h3>All available link atlases cache themselves after install</h3><p>These compact bundles contain links and lightweight educational metadata, not video files. Civweave now stages every published atlas lazily after installation, along with the current YouTube description and embeddability sidecars, so no school-by-school selection is required.</p></div><div class="knowledge-school-summary"><strong id="video-atlas-total">Loading video catalog…</strong><span id="video-atlas-state">Catalogs update independently from the app shell.</span></div><div class="gateway-actions knowledge-school-actions"><button id="stage-video-atlases" class="secondary" type="button" disabled>Loading video catalog…</button><button id="save-video-atlases" class="secondary" type="button" disabled>Export cached atlas ZIPs</button><a id="video-atlas-catalog-link" href="${CATALOG_URL}">Video catalog</a></div>`;
const summary=card.querySelector('.knowledge-school-summary');summary?.insertAdjacentElement('beforebegin',panel);
const total=panel.querySelector('#video-atlas-total'),stateNode=panel.querySelector('#video-atlas-state'),stageButton=panel.querySelector('#stage-video-atlases'),saveButton=panel.querySelector('#save-video-atlases');
let catalog=null,busy=false,refreshTimer=0,autoTimer=0;
const human=value=>{let n=Number(value)||0;const u=['B','KiB','MiB','GiB'];let i=0;while(n>=1024&&i<u.length-1){n/=1024;i++}return`${n.toFixed(i?2:0)} ${u[i]}`};
const receipt=()=>{try{return JSON.parse(localStorage.getItem(RECEIPT_KEY)||'{}')||{}}catch{return{}}};
const writeReceipt=value=>{try{localStorage.setItem(RECEIPT_KEY,JSON.stringify(value))}catch{}};
const hex=bytes=>Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
const sha256=async buffer=>hex(await crypto.subtle.digest('SHA-256',buffer));
function currentRows(){return Array.isArray(catalog?.schools)?catalog.schools.filter(row=>row?.school_slug&&row?.zip_file):[]}
function urls(row){return{zip:new URL(BASE+row.zip_file,location.origin).href}}
function installedContext(){
  try{const bridge=globalThis.CivweavePWAInstallV250;if(bridge?.appRuntime?.()||bridge?.installedMarker?.())return true}catch{}
  try{const marker=JSON.parse(localStorage.getItem(INSTALL_MARKER_KEY)||'null');if(marker?.origin===location.origin&&marker?.manifestId==='/civweave-local')return true}catch{}
  try{if(navigator.standalone===true)return true;if(['standalone','fullscreen','minimal-ui','window-controls-overlay'].some(mode=>matchMedia(`(display-mode: ${mode})`).matches))return true}catch{}
  return false;
}
function automaticNetworkAllowed(){const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;return navigator.onLine!==false&&!connection?.saveData&&!['slow-2g','2g'].includes(connection?.effectiveType)}
function idleTurn(){return new Promise(resolve=>{if(typeof requestIdleCallback==='function')requestIdleCallback(()=>resolve(),{timeout:AUTO_IDLE_TIMEOUT_MS});else setTimeout(resolve,500)})}
async function current(row){const cache=await caches.open(CACHE_NAME),response=await cache.match(urls(row).zip);if(!response)return false;const saved=receipt()[row.school_slug]||{};return saved.sha256===row.zip_sha256&&Number(saved.bytes)===Number(row.zip_bytes)}
async function refresh(){
  if(!catalog)return;
  const rows=currentRows(),bytes=rows.reduce((sum,row)=>sum+Number(row.zip_bytes||0),0),statuses=await Promise.all(rows.map(current)),saved=statuses.filter(Boolean).length;
  total.textContent=`${rows.length} video atlas${rows.length===1?'':'es'} · ${human(bytes)} compressed`;
  stateNode.textContent=rows.length?`${saved}/${rows.length} link atlases cached offline · ${catalog.total_records||0} catalog records total${installedContext()?' · automatic post-install queue active':' · will queue after install'}`:'No published video atlases are available yet.';
  stageButton.disabled=busy||!rows.length||saved===rows.length;stageButton.textContent=saved===rows.length&&rows.length?'All link atlases cached':`Cache ${rows.length-saved} missing link atlas${rows.length-saved===1?'':'es'} now`;
  saveButton.disabled=busy||!rows.length||saved===0;
}
function scheduleRefresh(){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>refresh().catch(error=>{stateNode.textContent=error?.message||String(error)}),0)}
async function stage({lazy=false,forceInstalled=false}={}){
  if(busy)return false;
  if(lazy&&!forceInstalled&&!installedContext())return false;
  if(lazy&&!automaticNetworkAllowed()){stateNode.textContent='Link-atlas lazy download is paused by offline, Save-Data, or very slow-network settings. It will resume automatically.';return false}
  busy=true;stageButton.disabled=true;saveButton.disabled=true;
  try{
    const rows=currentRows(),cache=await caches.open(CACHE_NAME),r=receipt();let done=0,downloaded=0;
    for(const row of rows){
      if(await current(row)){done++;continue}
      if(lazy&&!automaticNetworkAllowed())break;
      if(lazy)await idleTurn();
      stateNode.textContent=`${lazy?'Lazy caching':'Caching'} ${row.school_name} link atlas · ${done}/${rows.length}`;
      const response=await fetch(urls(row).zip,{cache:'no-store'});if(!response.ok)throw new Error(`${row.school_name} video atlas failed (${response.status}).`);
      const buffer=await response.arrayBuffer();if(buffer.byteLength!==Number(row.zip_bytes))throw new Error(`${row.school_name} video atlas size mismatch.`);
      const digest=await sha256(buffer);if(digest!==row.zip_sha256)throw new Error(`${row.school_name} video atlas checksum mismatch.`);
      await cache.put(urls(row).zip,new Response(buffer,{headers:{'Content-Type':'application/zip','Content-Length':String(buffer.byteLength),'X-Civweave-SHA256':digest}}));
      r[row.school_slug]={sha256:digest,bytes:buffer.byteLength,savedAt:new Date().toISOString(),file:row.zip_file};writeReceipt(r);done++;downloaded++;await refresh();
    }
    for(const extra of ['lookup.json','youtube-availability-current.json','youtube-metadata-current.json.gz']){
      if(lazy)await idleTurn();
      try{const response=await fetch(BASE+extra,{cache:'no-store'});if(response.ok)await cache.put(new URL(BASE+extra,location.origin).href,response.clone())}catch{}
    }
    const remaining=(await Promise.all(rows.map(current))).filter(value=>!value).length;
    stateNode.textContent=remaining?`${rows.length-remaining}/${rows.length} link atlases cached. ${remaining} will resume automatically later.`:`All ${rows.length} published link atlases are cached${downloaded?` · ${downloaded} added this pass`:''}.`;
    return remaining===0;
  }catch(error){stateNode.textContent=`Link-atlas caching stopped safely: ${error?.message||error}. It will retry later.`;return false}
  finally{busy=false;await refresh()}
}
function scheduleLazyStage(source='startup',forceInstalled=false){
  clearTimeout(autoTimer);autoTimer=setTimeout(()=>stage({lazy:true,forceInstalled}).catch(error=>{stateNode.textContent=`Automatic link-atlas queue unavailable: ${error?.message||error}`}),AUTO_START_DELAY_MS);
}
async function save(){
  if(busy)return;busy=true;try{
    const rows=currentRows(),cache=await caches.open(CACHE_NAME);let count=0;
    for(const row of rows){const response=await cache.match(urls(row).zip);if(!response)continue;const blob=await response.blob(),href=URL.createObjectURL(blob),link=document.createElement('a');link.href=href;link.download=row.zip_file;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(href),60000);count++;await new Promise(resolve=>setTimeout(resolve,300));}
    stateNode.textContent=`Started ${count} cached video atlas ZIP export${count===1?'':'s'}.`;
  }finally{busy=false;await refresh()}
}
async function init(){
  try{
    const response=await fetch(CATALOG_URL,{cache:'no-store'});if(!response.ok)throw new Error(`Video atlas catalog is not published yet (${response.status}).`);catalog=await response.json();if(catalog?.schema!=='civweave.video-learning-atlas.catalog.v1')throw new Error('Video atlas catalog schema is incompatible.');
    stageButton.addEventListener('click',()=>stage({lazy:false}));saveButton.addEventListener('click',save);
    schoolList.addEventListener('change',scheduleRefresh);presets?.addEventListener('click',()=>setTimeout(scheduleRefresh,0));
    addEventListener('civweave:pwa-installed',()=>scheduleLazyStage('pwa-installed',true));
    addEventListener('appinstalled',()=>scheduleLazyStage('appinstalled',true));
    addEventListener('online',()=>scheduleLazyStage('online'));
    try{(navigator.connection||navigator.mozConnection||navigator.webkitConnection)?.addEventListener?.('change',()=>scheduleLazyStage('connection-change'))}catch{}
    await refresh();scheduleLazyStage('startup');
  }catch(error){total.textContent='Video atlas build pending';stateNode.textContent=error?.message||String(error);stageButton.textContent='Video catalogs unavailable';}
}
init();
import('/app/open-learning-media-installer-v1.mjs?v=open-media-cache-v1').catch(error=>console.warn('[Civweave] Open Learning Media installer unavailable.',error));
})();
