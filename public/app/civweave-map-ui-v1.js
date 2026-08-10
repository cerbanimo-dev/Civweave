(()=>{
'use strict';

const VERSION='civweave-map-v1-ui-1.0.0';
let mounted=false;
let refreshTimer=null;
const now=()=>new Date().toISOString();
const clean=(value,max=1000)=>String(value??'').trim().slice(0,max);
const esc=value=>clean(value,2000).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[char]));
const fmtBytes=value=>{const bytes=Math.max(0,Number(value)||0);if(bytes<1024)return`${bytes} B`;const units=['KiB','MiB','GiB'];let n=bytes/1024,i=0;while(n>=1024&&i<units.length-1){n/=1024;i++}return`${n>=100?n.toFixed(0):n>=10?n.toFixed(1):n.toFixed(2)} ${units[i]}`};
const fmtAge=value=>{const ms=Date.now()-Date.parse(value||0);if(!Number.isFinite(ms)||ms<0)return'';if(ms<60000)return'just now';if(ms<3600000)return`${Math.floor(ms/60000)}m ago`;if(ms<86400000)return`${Math.floor(ms/3600000)}h ago`;return`${Math.floor(ms/86400000)}d ago`};
function storage(){return globalThis.CivweaveMapStorageV1}
function offline(){return globalThis.CivweaveMapOfflineV1}
function coverage(){return globalThis.CivweaveMapCoverageV277}
function node(tag,attrs={},text=''){const el=document.createElement(tag);for(const [key,value] of Object.entries(attrs)){if(key==='class')el.className=value;else if(key==='id')el.id=value;else el.setAttribute(key,value)}if(text)el.textContent=text;return el}
function section(){
  const panel=document.getElementById('panel');if(!panel)return null;
  const marker=panel.querySelector('.note');const wrap=node('section',{id:'mapV1Console','data-civweave-map-v1':VERSION});
  wrap.innerHTML=`
    <h3>Offline map</h3>
    <div class="row"><button id="coverageToggle" class="btn" type="button">Auto coverage on</button><button id="mapPersistStorage" class="btn" type="button">Keep maps</button><button id="mapSelfTest" class="btn" type="button">Run map check</button></div>
    <div class="field"><label for="basemapMode">Basemap behavior</label><select id="basemapMode"><option value="auto">Auto · online when connected</option><option value="online">Online only</option><option value="offline">Downloaded maps only</option></select></div>
    <p id="coverageStatus">Offline coverage is checking this view…</p>
    <div id="mapStorageStatus" class="note">Reading map storage…</div>
    <div id="downloadedMapList" class="results" style="max-height:320px;margin-top:7px"><div class="empty">No downloaded map regions yet.</div></div>`;
  marker?.parentNode?.insertBefore(wrap,marker);if(!marker)panel.append(wrap);return wrap;
}
async function refreshStorage(){
  const s=storage(),el=document.getElementById('mapStorageStatus'),list=document.getElementById('downloadedMapList');if(!s||!el||!list)return;
  try{
    const [stats,packs]=await Promise.all([s.estimate(),s.listPacks()]);
    const quota=stats.quota?` · device ${fmtBytes(stats.usage||0)} / ${fmtBytes(stats.quota)}`:'';
    el.textContent=`Map cache ${fmtBytes(stats.mapBytes)} / ${fmtBytes(stats.budgetBytes)}${quota} · ${stats.packs} region${stats.packs===1?'':'s'} · ${stats.pinned} pinned`;
    if(!packs.length){list.innerHTML='<div class="empty">No downloaded map regions yet. Move into an area while online and Auto coverage can request one from the federation.</div>';return}
    list.innerHTML=packs.map(pack=>{
      const verified=pack.verified?'verified':'unverified';const pin=pack.pinned?'Pinned':'Pin';const active=offline()?.status?.().activePackId===pack.packId;
      const metadata=[pack.region,fmtBytes(pack.bytes),verified,pack.cachedAt?fmtAge(pack.cachedAt):'',pack.license].filter(Boolean).join(' · ');
      const attribution=pack.attribution?`<small>${esc(pack.attribution)}</small>`:'';
      return `<div class="card" data-map-pack="${esc(pack.packId)}"><strong>${active?'● ':''}${esc(pack.title||pack.packId)}</strong><small>${esc(metadata)}</small>${attribution}<div class="row" style="margin-top:7px"><button class="btn" type="button" data-pack-use="${esc(pack.packId)}">Use</button><button class="btn" type="button" data-pack-pin="${esc(pack.packId)}">${pin}</button><button class="btn" type="button" data-pack-remove="${esc(pack.packId)}">Remove</button></div></div>`;
    }).join('');
    list.querySelectorAll('[data-pack-use]').forEach(button=>button.addEventListener('click',()=>offline()?.activate?.(button.dataset.packUse,{reason:'user'}).then(refreshStorage).catch(error=>setCoverage(error.message))));
    list.querySelectorAll('[data-pack-pin]').forEach(button=>button.addEventListener('click',async()=>{const pack=await s.getPack(button.dataset.packPin);await s.setPinned(button.dataset.packPin,!pack?.pinned);await refreshStorage()}));
    list.querySelectorAll('[data-pack-remove]').forEach(button=>button.addEventListener('click',async()=>{await s.removePack(button.dataset.packRemove,{reason:'user'});await refreshStorage()}));
  }catch(error){el.textContent=`Map storage unavailable · ${error.message}`}
}
function setCoverage(text){const el=document.getElementById('coverageStatus');if(el)el.textContent=clean(text,700)}
function refreshCoverageButton(){const button=document.getElementById('coverageToggle'),c=coverage();if(button&&c){const on=c.autoEnabled();button.textContent=`Auto coverage ${on?'on':'paused'}`;button.classList.toggle('active',on)}}
async function refreshPersistenceButton(){
  const button=document.getElementById('mapPersistStorage');if(!button)return;
  if(!navigator.storage?.persisted){button.textContent='Storage managed by browser';button.disabled=true;return}
  try{const granted=await navigator.storage.persisted();button.textContent=granted?'Maps kept offline':'Keep maps';button.classList.toggle('active',granted)}catch{button.textContent='Keep maps'}
}
async function requestPersistentStorage(){
  const button=document.getElementById('mapPersistStorage');if(!button)return;
  if(!navigator.storage?.persist){button.textContent='Storage managed by browser';button.disabled=true;return}
  try{const already=await navigator.storage.persisted?.(),granted=already||await navigator.storage.persist();button.textContent=granted?'Maps kept offline':'Browser may reclaim maps';button.classList.toggle('active',granted)}catch{button.textContent='Storage permission unavailable'}
}
async function selfTest(){
  const button=document.getElementById('mapSelfTest');if(button){button.disabled=true;button.textContent='Checking…'}
  try{
    const result=await offline()?.selfTest?.();const failed=Object.entries(result||{}).filter(([key,value])=>['maplibre','indexedDb','storage','pmtiles','protocol'].includes(key)&&!value).map(([key])=>key);
    setCoverage(result?.ready?`Map v1 check passed · offline renderer, PMTiles, and storage are ready.`:`Map v1 check needs attention · ${failed.join(', ')||'runtime incomplete'}.`);
  }catch(error){setCoverage(`Map v1 check failed · ${error.message}`)}finally{if(button){button.disabled=false;button.textContent='Run map check'}}
}
function scheduleRefresh(delay=80){if(refreshTimer)clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>{refreshStorage().catch(()=>{});refreshCoverageButton();refreshPersistenceButton().catch(()=>{})},delay)}
async function mount(){
  if(mounted)return true;const wrap=section();if(!wrap)return false;mounted=true;
  const mode=document.getElementById('basemapMode');if(mode){mode.value=offline()?.mode?.()||'auto';mode.addEventListener('change',()=>offline()?.setMode?.(mode.value))}
  document.getElementById('coverageToggle')?.addEventListener('click',()=>{const c=coverage();if(c)c.setAutoEnabled(!c.autoEnabled());refreshCoverageButton()});
  document.getElementById('mapPersistStorage')?.addEventListener('click',requestPersistentStorage);
  document.getElementById('mapSelfTest')?.addEventListener('click',selfTest);
  for(const event of ['civweave:map-pack-cached','civweave:map-pack-removed','civweave:map-pack-pin-changed','civweave:map-basemap-changed','civweave:map-offline-coverage-ready'])addEventListener(event,()=>scheduleRefresh());
  addEventListener('civweave:map-coverage-status',event=>setCoverage(event.detail?.message||''));
  await refreshStorage();refreshCoverageButton();await refreshPersistenceButton();
  dispatchEvent(new CustomEvent('civweave:map-v1-ui-ready',{detail:{version:VERSION,at:now()}}));return true;
}
function boot(){if(document.getElementById('panel'))mount().catch(()=>{});else{let ticks=0;const timer=setInterval(()=>{if(document.getElementById('panel')){clearInterval(timer);mount().catch(()=>{})}else if(++ticks>200)clearInterval(timer)},50)}}

globalThis.CivweaveMapUIV1=Object.freeze({version:VERSION,mount,refreshStorage,selfTest,requestPersistentStorage});document.readyState==='loading'?addEventListener('DOMContentLoaded',boot,{once:true}):queueMicrotask(boot);
})();
