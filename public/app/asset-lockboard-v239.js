(()=>{
'use strict';

const VERSION='1.0.32-asset-lockboard-v239';
const CATALOG_URL='/app/asset-lockboard-catalog-v239.json';
const STORAGE_KEY='civweave.asset-lockboard.v239';
const PAGE_SIZE=120;
const $=selector=>document.querySelector(selector);
const clean=value=>String(value??'').trim();
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const bytes=value=>{const n=Number(value||0);if(n<1024)return`${n} B`;if(n<1024*1024)return`${(n/1024).toFixed(1)} KiB`;return`${(n/1024/1024).toFixed(2)} MiB`};
let catalog=null;
let config=null;
let selectedSlotId='';
let candidatePath='';
let slotQuery='';
let assetQuery='';
let assetPage=0;
let slotFilter='all';

function defaultConfig(){return{schema:'civweave.asset-lockboard.state.v239',personalEnabled:true,slotLocks:{},pathOverrides:{},updatedAt:null}}
function readConfig(){let value={};try{value=parse(localStorage.getItem(STORAGE_KEY),{})}catch{}return{...defaultConfig(),...value,slotLocks:{...(value.slotLocks||{})},pathOverrides:{...(value.pathOverrides||{})}}}
function saveConfig(message='Saved visual asset choices.'){
  config.updatedAt=new Date().toISOString();
  localStorage.setItem(STORAGE_KEY,JSON.stringify(config));
  try{dispatchEvent(new CustomEvent('civweave:asset-lockboard-changed',{detail:{version:VERSION}}))}catch{}
  globalThis.CivweaveAssetCustomizationV239?.refresh?.();
  renderStats();renderSlots();renderDetail();toast(message);
}
function toast(message){const node=$('#toast');if(!node)return;node.textContent=message;node.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>node.hidden=true,2600)}
function slotById(id){return catalog?.slots?.find(slot=>slot.id===id)||null}
function selectedSlot(){return slotById(selectedSlotId)}
function selectedCandidate(){return candidatePath||config?.slotLocks?.[selectedSlotId]||selectedSlot()?.assetPath||''}
function assetByPath(path){return catalog?.assets?.find(asset=>asset.path===path)||null}
function currentReplacement(slot){return config?.slotLocks?.[slot?.id]||slot?.assetPath||''}
function renderStats(){
  if(!catalog)return;
  $('#asset-count').textContent=catalog.assetCount;
  $('#slot-count').textContent=catalog.slotCount;
  $('#missing-count').textContent=catalog.missingReferenceCount;
  $('#lock-count').textContent=Object.keys(config.slotLocks).length;
  $('#override-count').textContent=Object.keys(config.pathOverrides).length;
  $('#personal-enabled').checked=config.personalEnabled!==false;
}
function filteredSlots(){
  const q=slotQuery.toLowerCase();
  return catalog.slots.filter(slot=>{
    const locked=Boolean(config.slotLocks[slot.id]);
    if(slotFilter==='locked'&&!locked)return false;
    if(slotFilter==='missing'&&slot.exists)return false;
    if(slotFilter==='unlocked'&&locked)return false;
    if(!q)return true;
    return [slot.sourcePath,slot.assetPath,slot.context,slot.kind].some(value=>String(value||'').toLowerCase().includes(q));
  });
}
function renderSlots(){
  if(!catalog)return;
  const rows=filteredSlots();
  $('#slot-summary').textContent=`${rows.length} shown · ${catalog.slotCount} total image slots`;
  $('#slot-list').innerHTML=rows.map(slot=>{
    const target=currentReplacement(slot);
    const locked=Boolean(config.slotLocks[slot.id]);
    return`<button class="slot ${slot.id===selectedSlotId?'active':''}" type="button" data-slot="${esc(slot.id)}"><img loading="lazy" src="${esc(target)}" alt=""><span><strong>${esc(slot.sourcePath)}:${slot.line}</strong><small>${esc(slot.assetPath)}</small><small>${esc(slot.context)}</small><span class="flags">${locked?'<span class="flag locked">LOCKED</span>':''}${slot.exists?'':'<span class="flag missing">MISSING</span>'}<span class="flag">${esc(slot.kind)}</span></span></span></button>`;
  }).join('')||'<div class="detail-empty">No slots match this filter.</div>';
  $('#slot-list').querySelectorAll('[data-slot]').forEach(button=>button.addEventListener('click',()=>{selectedSlotId=button.dataset.slot;candidatePath=config.slotLocks[selectedSlotId]||slotById(selectedSlotId)?.assetPath||'';renderSlots();renderAssets();renderDetail()}));
}
function filteredAssets(){
  const q=assetQuery.toLowerCase();
  return catalog.assets.filter(asset=>!q||[asset.path,asset.filename,asset.extension].some(value=>String(value||'').toLowerCase().includes(q)));
}
function renderAssets(){
  if(!catalog)return;
  const rows=filteredAssets();
  const pages=Math.max(1,Math.ceil(rows.length/PAGE_SIZE));
  assetPage=Math.max(0,Math.min(assetPage,pages-1));
  const start=assetPage*PAGE_SIZE,visible=rows.slice(start,start+PAGE_SIZE),selected=selectedCandidate();
  $('#asset-summary').textContent=`${rows.length} matching · page ${assetPage+1}/${pages}`;
  $('#asset-grid').innerHTML=visible.map(asset=>`<button class="asset ${asset.path===selected?'active':''}" type="button" data-asset="${esc(asset.path)}"><img loading="lazy" src="${esc(asset.path)}" alt=""><strong title="${esc(asset.path)}">${esc(asset.filename)}</strong><small>${esc(asset.extension.toUpperCase())} · ${bytes(asset.bytes)} · ${asset.usageCount} use${asset.usageCount===1?'':'s'}</small></button>`).join('')||'<div class="detail-empty">No image files match this search.</div>';
  $('#asset-grid').querySelectorAll('[data-asset]').forEach(button=>button.addEventListener('click',()=>{candidatePath=button.dataset.asset;renderAssets();renderDetail()}));
  $('#asset-prev').disabled=assetPage<=0;$('#asset-next').disabled=assetPage>=pages-1;
}
function renderDetail(){
  const root=$('#detail');
  const slot=selectedSlot();
  if(!slot){root.innerHTML='<div class="detail-empty">Choose an image slot on the left, then pick the exact asset file in the gallery.</div>';return}
  const candidate=selectedCandidate();
  const locked=config.slotLocks[slot.id]||'';
  const personal=config.pathOverrides[slot.assetPath]||'';
  const candidateAsset=assetByPath(candidate);
  root.innerHTML=`
    <div class="meta"><div><b>Source slot</b> ${esc(slot.sourcePath)}:${slot.line}:${slot.column}</div><div><b>Slot ID</b> ${esc(slot.id)}</div><div><b>Reference kind</b> ${esc(slot.kind)}</div><div class="context">${esc(slot.context)}</div></div>
    <div class="compare"><div class="preview"><small>Current source asset</small><img src="${esc(slot.assetPath)}" alt=""><span class="path">${esc(slot.assetPath)}</span></div><div class="preview"><small>Selected candidate</small><img src="${esc(candidate)}" alt=""><span class="path">${esc(candidate)}</span></div></div>
    <div class="meta"><div><b>Canonical slot lock</b> ${locked?esc(locked):'not locked'}</div><div><b>Personal path replacement</b> ${personal?`${esc(slot.assetPath)} → ${esc(personal)}`:'none'}</div>${candidateAsset?`<div><b>Candidate file</b> ${bytes(candidateAsset.bytes)} · ${esc(candidateAsset.extension.toUpperCase())} · ${candidateAsset.usageCount} known uses</div>`:''}</div>
    <div class="action-stack"><button class="btn primary" id="lock-slot" type="button" ${candidate?'':'disabled'}>Lock this exact source slot → selected asset</button><button class="btn" id="replace-path" type="button" ${candidate?'':'disabled'}>Replace this current asset path on my device → selected asset</button>${locked?'<button class="btn" id="unlock-slot" type="button">Remove canonical slot lock</button>':''}${personal?'<button class="btn" id="clear-path" type="button">Remove this personal path replacement</button>':''}</div>
    <div class="notice">Canonical locks are exported with source file + line + slot ID for source repair. Personal path replacements are local customization and never modify the repository.</div>`;
  $('#lock-slot')?.addEventListener('click',()=>{config.slotLocks[slot.id]=candidate;saveConfig(`Locked ${slot.sourcePath}:${slot.line} to ${candidate}.`)});
  $('#replace-path')?.addEventListener('click',()=>{config.pathOverrides[slot.assetPath]=candidate;config.personalEnabled=true;saveConfig(`Personal skin now maps ${slot.assetPath} to ${candidate}. Reloading other open pages may be needed.`)});
  $('#unlock-slot')?.addEventListener('click',()=>{delete config.slotLocks[slot.id];candidatePath=slot.assetPath;saveConfig('Canonical slot lock removed.')});
  $('#clear-path')?.addEventListener('click',()=>{delete config.pathOverrides[slot.assetPath];saveConfig('Personal path replacement removed. Reload to restore any CSS images already rewritten in memory.')});
}
function exportMapping(){
  const canonicalLocks=Object.entries(config.slotLocks).map(([id,targetPath])=>{
    const slot=slotById(id)||{};
    return{id,targetPath,sourcePath:slot.sourcePath||null,line:slot.line||null,column:slot.column||null,kind:slot.kind||null,currentAssetPath:slot.assetPath||null,context:slot.context||null};
  });
  const payload={schema:'civweave.asset-lockboard.export.v239',version:VERSION,catalogGeneratedAt:catalog.generatedAt,exportedAt:new Date().toISOString(),canonicalLocks,pathOverrides:config.pathOverrides,personalEnabled:config.personalEnabled!==false};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`civweave-asset-locks-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast(`Exported ${canonicalLocks.length} canonical locks and ${Object.keys(config.pathOverrides).length} personal replacements.`)
}
async function importMapping(file){
  if(!file)return;
  const value=parse(await file.text(),null);if(!value)throw new Error('That file is not valid JSON.');
  const next=defaultConfig();
  if(Array.isArray(value.canonicalLocks))for(const row of value.canonicalLocks)if(row?.id&&row?.targetPath)next.slotLocks[row.id]=row.targetPath;
  else if(value.slotLocks&&typeof value.slotLocks==='object')next.slotLocks={...value.slotLocks};
  if(value.pathOverrides&&typeof value.pathOverrides==='object')next.pathOverrides={...value.pathOverrides};
  next.personalEnabled=value.personalEnabled!==false;config=next;saveConfig('Imported asset lockboard mapping.');
}
function bind(){
  $('#slot-search').addEventListener('input',event=>{slotQuery=event.target.value;renderSlots()});
  $('#asset-search').addEventListener('input',event=>{assetQuery=event.target.value;assetPage=0;renderAssets()});
  $('#slot-filter').addEventListener('change',event=>{slotFilter=event.target.value;renderSlots()});
  $('#asset-prev').addEventListener('click',()=>{assetPage-=1;renderAssets()});
  $('#asset-next').addEventListener('click',()=>{assetPage+=1;renderAssets()});
  $('#personal-enabled').addEventListener('change',event=>{config.personalEnabled=event.target.checked;saveConfig(config.personalEnabled?'Personal skin enabled.':'Personal skin disabled. Reload other pages to restore canonical assets.')});
  $('#export-map').addEventListener('click',exportMapping);
  $('#import-map').addEventListener('click',()=>$('#import-file').click());
  $('#import-file').addEventListener('change',event=>importMapping(event.target.files?.[0]).catch(error=>toast(error.message)));
  $('#clear-locks').addEventListener('click',()=>{if(!confirm('Remove all canonical slot locks? Personal skin replacements will remain.'))return;config.slotLocks={};saveConfig('All canonical slot locks cleared.')});
  $('#clear-personal').addEventListener('click',()=>{if(!confirm('Remove every personal image replacement on this device?'))return;config.pathOverrides={};saveConfig('Personal skin cleared. Reload other pages to restore canonical assets.')});
}
async function boot(){
  config=readConfig();
  bind();
  try{
    const response=await fetch(`${CATALOG_URL}?v=${Date.now()}`,{cache:'no-store'});
    if(!response.ok)throw new Error(`Catalog returned ${response.status}.`);
    catalog=await response.json();
    if(!Array.isArray(catalog.assets)||!Array.isArray(catalog.slots))throw new Error('Catalog format is invalid.');
    renderStats();renderSlots();renderAssets();renderDetail();
    $('#catalog-status').textContent=`Generated ${new Date(catalog.generatedAt).toLocaleString()}`;
  }catch(error){
    $('#catalog-status').textContent='Catalog unavailable';
    $('#slot-list').innerHTML=`<div class="detail-empty">The generated asset catalog could not load: ${esc(error.message)}<br><br>Run the Civweave release/build step to regenerate it.</div>`;
  }
}

document.readyState==='loading'?addEventListener('DOMContentLoaded',boot,{once:true}):boot();
globalThis.CivweaveAssetLockboardV239=Object.freeze({version:VERSION,storageKey:STORAGE_KEY,exportMapping});
})();
