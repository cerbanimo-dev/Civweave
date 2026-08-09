(()=>{
'use strict';
const CATALOG_URL='/downloads/knowledge-schools/video-atlases/catalog.json';
const BASE='/downloads/knowledge-schools/video-atlases/';
const CACHE_NAME='cw-video-learning-atlas-v1';
const RECEIPT_KEY='civweave.video-learning-atlas.v1';
const card=document.querySelector('.knowledge-card'),schoolList=document.querySelector('#knowledge-school-list');
if(!card||!schoolList||document.querySelector('#video-atlas-panel'))return;
const panel=document.createElement('section');panel.id='video-atlas-panel';panel.className='video-atlas-panel';panel.innerHTML=`<div class="knowledge-school-copy"><small>VIDEO LEARNING ATLAS</small><h3>Pair selected schools with model-friendly video catalogs</h3><p>These bundles contain links and lightweight educational metadata, not video files. The current YouTube description sidecar is refreshed separately so the durable seed stays policy-safe.</p></div><div class="knowledge-school-summary"><strong id="video-atlas-total">Loading video catalog…</strong><span id="video-atlas-state">Catalogs update independently from the app shell.</span></div><div class="gateway-actions knowledge-school-actions"><button id="stage-video-atlases" class="secondary" type="button" disabled>Loading video catalog…</button><button id="save-video-atlases" class="secondary" type="button" disabled>Save selected atlas ZIPs</button><a id="video-atlas-catalog-link" href="${CATALOG_URL}">Video catalog</a></div>`;
const summary=card.querySelector('.knowledge-school-summary');summary?.insertAdjacentElement('beforebegin',panel);
const total=panel.querySelector('#video-atlas-total'),stateNode=panel.querySelector('#video-atlas-state'),stageButton=panel.querySelector('#stage-video-atlases'),saveButton=panel.querySelector('#save-video-atlases');
let catalog=null,busy=false;
const selected=()=>[...schoolList.querySelectorAll('input[type="checkbox"]:checked')].map(input=>input.value);
const human=value=>{let n=Number(value)||0;const u=['B','KiB','MiB','GiB'];let i=0;while(n>=1024&&i<u.length-1){n/=1024;i++}return`${n.toFixed(i?2:0)} ${u[i]}`};
const receipt=()=>{try{return JSON.parse(localStorage.getItem(RECEIPT_KEY)||'{}')||{}}catch{return{}}};
const writeReceipt=value=>localStorage.setItem(RECEIPT_KEY,JSON.stringify(value));
const hex=bytes=>Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
const sha256=async buffer=>hex(await crypto.subtle.digest('SHA-256',buffer));
const bySlug=()=>new Map((catalog?.schools||[]).map(row=>[row.school_slug,row]));
function currentRows(){const map=bySlug();return selected().map(slug=>map.get(slug)).filter(Boolean)}
function urls(row){return{zip:new URL(BASE+row.zip_file,location.origin).href}}
async function current(row){const cache=await caches.open(CACHE_NAME),response=await cache.match(urls(row).zip);if(!response)return false;const saved=receipt()[row.school_slug]||{};return saved.sha256===row.zip_sha256&&Number(saved.bytes)===Number(row.zip_bytes)}
async function refresh(){
  if(!catalog)return;
  const rows=currentRows(),bytes=rows.reduce((sum,row)=>sum+Number(row.zip_bytes||0),0),statuses=await Promise.all(rows.map(current)),saved=statuses.filter(Boolean).length;
  total.textContent=`${rows.length} video atlas${rows.length===1?'':'es'} · ${human(bytes)} compressed`;
  stateNode.textContent=rows.length?`${saved}/${rows.length} selected atlases saved offline · ${catalog.total_records||0} catalog records total`:'Select one or more knowledge schools above.';
  stageButton.disabled=busy||!rows.length||saved===rows.length;stageButton.textContent=saved===rows.length&&rows.length?'Selected video atlases saved':`Download ${rows.length-saved} missing video atlas${rows.length-saved===1?'':'es'}`;
  saveButton.disabled=busy||!rows.length||saved!==rows.length;
}
async function stage(){
  if(busy)return;busy=true;stageButton.disabled=true;saveButton.disabled=true;
  try{
    const rows=currentRows(),cache=await caches.open(CACHE_NAME),r=receipt();let done=0;
    for(const row of rows){
      if(await current(row)){done++;continue}
      stateNode.textContent=`Downloading ${row.school_name} video atlas · ${done}/${rows.length}`;
      const response=await fetch(urls(row).zip,{cache:'no-store'});if(!response.ok)throw new Error(`${row.school_name} video atlas failed (${response.status}).`);
      const buffer=await response.arrayBuffer();if(buffer.byteLength!==Number(row.zip_bytes))throw new Error(`${row.school_name} video atlas size mismatch.`);
      const digest=await sha256(buffer);if(digest!==row.zip_sha256)throw new Error(`${row.school_name} video atlas checksum mismatch.`);
      await cache.put(urls(row).zip,new Response(buffer,{headers:{'Content-Type':'application/zip','Content-Length':String(buffer.byteLength),'X-Civweave-SHA256':digest}}));
      r[row.school_slug]={sha256:digest,bytes:buffer.byteLength,savedAt:new Date().toISOString(),file:row.zip_file};writeReceipt(r);done++;
    }
    for(const extra of ['lookup.json','youtube-metadata-current.json.gz']){try{const response=await fetch(BASE+extra,{cache:'no-store'});if(response.ok)await cache.put(new URL(BASE+extra,location.origin).href,response.clone())}catch{}}
    stateNode.textContent=`${done} selected video atlas${done===1?'':'es'} saved offline.`;
  }catch(error){stateNode.textContent=error?.message||String(error)}finally{busy=false;await refresh()}
}
async function save(){
  if(busy)return;busy=true;try{
    const rows=currentRows(),cache=await caches.open(CACHE_NAME);let count=0;
    for(const row of rows){const response=await cache.match(urls(row).zip);if(!response)continue;const blob=await response.blob(),href=URL.createObjectURL(blob),link=document.createElement('a');link.href=href;link.download=row.zip_file;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(href),60000);count++;await new Promise(resolve=>setTimeout(resolve,300));}
    stateNode.textContent=`Started ${count} video atlas ZIP download${count===1?'':'s'}.`;
  }finally{busy=false;await refresh()}
}
async function init(){
  try{
    const response=await fetch(CATALOG_URL,{cache:'no-store'});if(!response.ok)throw new Error(`Video atlas catalog is not published yet (${response.status}).`);catalog=await response.json();if(catalog?.schema!=='civweave.video-learning-atlas.catalog.v1')throw new Error('Video atlas catalog schema is incompatible.');
    schoolList.addEventListener('change',()=>refresh());stageButton.addEventListener('click',stage);saveButton.addEventListener('click',save);await refresh();
  }catch(error){total.textContent='Video atlas build pending';stateNode.textContent=error?.message||String(error);stageButton.textContent='Video catalogs unavailable';}
}
init();
})();
