(()=>{
'use strict';
const VERSION='living-library-downloads-v1.1-wikimedia-direct';
const TOGGLE_ID='library-manage-toggle';
const PANEL_ID='living-library-downloads';
const CLOSE_ID='living-library-downloads-close';
const FOUNDATION_SCRIPT='/app/knowledge-school-seeds-v1.js?v=knowledge-schools-v2';
const INSTALLER_SCRIPT='/app/knowledge-school-installer-v1.js?v=knowledge-schools-v2';
let loadingPromise=null;
let upstreamPromise=null;
let tierManifestPromise=null;
if(globalThis.CivweaveLivingLibraryDownloadsV1?.version===VERSION)return;
const q=(selector,root=document)=>root?.querySelector?.(selector)||null;
const qa=(selector,root=document)=>[...(root?.querySelectorAll?.(selector)||[])];
const labelFor=layer=>layer==='expanded'?'Expanded':'Deep';

function appendClassic(src){return new Promise((resolve,reject)=>{const pathname=new URL(src,location.href).pathname,existing=[...document.scripts].find(node=>node.src&&new URL(node.src,location.href).pathname===pathname);if(existing){if(pathname.includes('knowledge-school-seeds')&&globalThis.CivweaveKnowledgeSchools)return resolve();if(pathname.includes('knowledge-school-installer')&&q('#knowledge-school-list')?.children?.length)return resolve();existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',()=>reject(new Error(`Could not load ${src}`)),{once:true});return}const script=document.createElement('script');script.src=src;script.async=true;script.addEventListener('load',resolve,{once:true});script.addEventListener('error',()=>reject(new Error(`Could not load ${src}`)),{once:true});document.body.append(script)})}
const upstream=()=>upstreamPromise||(upstreamPromise=import('/app/knowledge-library-upstream-v1.mjs?v=wikimedia-direct-v1'));
const tiers=()=>tierManifestPromise||(tierManifestPromise=import('/app/knowledge-library-tiers-v1.mjs?v=wikimedia-direct-v1').then(runtime=>runtime.loadTierManifest()));
function tierStateText(record){if(record?.slug==='foundation'||record?.availability==='ready')return'Available now';if(record?.availability==='source-ready')return'Direct from Wikimedia';if(record?.availability==='build-required')return'Index not ready yet';return String(record?.availability||'Unavailable').replaceAll('-',' ')}
function notifyChanged(detail={}){try{dispatchEvent(new CustomEvent('civweave:living-library-updated',{detail:{version:VERSION,...detail}}))}catch{}}

async function ensureFoundationManager(){if(loadingPromise)return loadingPromise;loadingPromise=(async()=>{const help=q('#knowledge-school-help');if(help)help.textContent='Opening Foundation library downloads…';if(!globalThis.CivweaveKnowledgeSchools)await appendClassic(FOUNDATION_SCRIPT);await appendClassic(INSTALLER_SCRIPT);return true})().catch(error=>{loadingPromise=null;const help=q('#knowledge-school-help');if(help){help.textContent=error?.message||String(error);help.classList.add('is-error')}throw error});return loadingPromise}

function selectedSlugs(section){return qa('input[type="checkbox"]:checked',section).map(input=>input.value)}
function updateUpstreamButtons(section){const count=selectedSlugs(section).length,busy=section.dataset.busy==='true';const download=q('[data-upstream-download]',section),remove=q('[data-upstream-remove]',section);if(download){download.disabled=busy||!count;download.textContent=busy?'Downloading from Wikimedia…':count?`Download ${count} selected school${count===1?'':'s'} from Wikimedia`:'Select schools to download'}if(remove)remove.disabled=busy||!count}
async function refreshUpstreamManager(section,runtime){
  const layer=section.dataset.upstreamLayer,status=await runtime.layerStatus(layer),bySlug=new Map((status.schools||[]).map(row=>[row.school_slug,row]));
  for(const input of qa('input[type="checkbox"]',section)){
    const state=bySlug.get(input.value),row=input.closest('.living-library-upstream-school'),badge=q('[data-upstream-status]',row),detail=q('[data-upstream-detail]',row);
    if(row){row.classList.toggle('is-current',Boolean(state?.current));row.classList.toggle('is-partial',Boolean(state?.partial))}
    if(badge)badge.textContent=state?.current?'saved':state?.partial?'partial':'available';
    if(detail)detail.textContent=`${Number(state?.downloaded||0).toLocaleString()} / ${Number(state?.article_count||0).toLocaleString()} articles saved`;
  }
  updateUpstreamButtons(section);
}
function upstreamProgressCopy(progress){const school=progress.school?.school_name||'Knowledge School',title=progress.title||'',done=Number(progress.completed||0),total=Number(progress.total||0),failed=Number(progress.failed||0);if(progress.phase==='cached')return`${school} · ${done}/${total} already saved`;if(progress.phase==='fetching')return`${school} · ${done}/${total} · fetching ${title} from Wikimedia…`;return`${school} · ${done}/${total} saved${failed?` · ${failed} source item${failed===1?'':'s'} will retry next time`:''}`}
async function downloadSelected(section,runtime){
  if(section.dataset.busy==='true')return;const layer=section.dataset.upstreamLayer,slugs=selectedSlugs(section);if(!slugs.length)return;section.dataset.busy='true';updateUpstreamButtons(section);const help=q('[data-upstream-help]',section);
  try{
    let failed=0;
    for(let index=0;index<slugs.length;index++){
      const slug=slugs[index];
      const result=await runtime.downloadCumulative(layer,slug,{onProgress:progress=>{if(help)help.textContent=`${index+1}/${slugs.length} schools · ${upstreamProgressCopy(progress)}`}});
      failed+=Number(result.failed||0);
      await refreshUpstreamManager(section,runtime);
    }
    if(help)help.textContent=failed?`Download pass complete. ${failed} Wikimedia article${failed===1?'':'s'} could not be fetched and will retry next time.`:`Selected ${labelFor(layer)} knowledge is saved on this device. Article bodies came directly from Wikimedia.`;
    notifyChanged({layer,action:'download'});
  }catch(error){if(help)help.textContent=error?.name==='AbortError'?'Download stopped. Already-saved articles remain available.':error?.message||String(error)}finally{section.dataset.busy='false';await refreshUpstreamManager(section,runtime).catch(()=>{});updateUpstreamButtons(section)}
}
async function removeSelected(section,runtime){
  if(section.dataset.busy==='true')return;const layer=section.dataset.upstreamLayer,slugs=selectedSlugs(section);if(!slugs.length)return;section.dataset.busy='true';updateUpstreamButtons(section);const help=q('[data-upstream-help]',section);
  try{for(const slug of slugs){if(help)help.textContent=`Removing ${labelFor(layer)} · ${slug}…`;await runtime.removeSchool(layer,slug)}if(help)help.textContent=`Removed selected ${labelFor(layer)} additions from this device.`;notifyChanged({layer,action:'remove'})}catch(error){if(help)help.textContent=error?.message||String(error)}finally{section.dataset.busy='false';await refreshUpstreamManager(section,runtime).catch(()=>{});updateUpstreamButtons(section)}
}
async function ensureUpstreamManager(record,runtime){
  if(record?.availability!=='source-ready'||!['expanded','deep'].includes(record.slug))return null;
  const panel=document.getElementById(PANEL_ID),foundation=q('.living-library-foundation-manager',panel);if(!panel||!foundation)return null;
  let section=q(`[data-upstream-layer="${record.slug}"]`,panel);if(section){await refreshUpstreamManager(section,runtime);return section}
  const layer=await runtime.layerRecord(record.slug);if(!layer)return null;
  section=document.createElement('section');section.className='living-library-upstream-manager';section.dataset.upstreamLayer=record.slug;section.dataset.busy='false';
  const cumulative=Number(record.cumulative_target_articles||0).toLocaleString(),delta=Number(record.indexed_articles||layer.article_count||0).toLocaleString(),dependency=record.slug==='deep'?'<p class="living-library-upstream-note">Deep is additive: downloading a school also fills its Expanded additions first.</p>':'';
  section.innerHTML=`<header><small>DIRECT SOURCE DOWNLOAD</small><h3>${labelFor(record.slug)} Local Library</h3><p>${delta} additional Vital articles indexed toward the ${cumulative} cumulative library. Article bodies download directly from English Wikipedia and are cached only on this device.</p>${dependency}</header><div class="living-library-upstream-schools"></div><div class="living-library-upstream-actions"><button type="button" data-upstream-download disabled>Select schools to download</button><button type="button" data-upstream-remove disabled>Remove selected saved additions</button></div><p data-upstream-help role="status">Nothing is selected automatically. Choose only the schools you want to carry offline.</p>`;
  const list=q('.living-library-upstream-schools',section);
  for(const school of layer.schools||[]){const row=document.createElement('label');row.className='living-library-upstream-school';row.innerHTML=`<input type="checkbox" value="${school.school_slug}"><span><strong>${school.school_name}</strong><small data-upstream-detail>0 / ${Number(school.article_count||0).toLocaleString()} articles saved</small></span><em data-upstream-status>available</em>`;q('input',row)?.addEventListener('change',()=>updateUpstreamButtons(section));list.append(row)}
  q('[data-upstream-download]',section)?.addEventListener('click',()=>downloadSelected(section,runtime));q('[data-upstream-remove]',section)?.addEventListener('click',()=>removeSelected(section,runtime));foundation.after(section);await refreshUpstreamManager(section,runtime);return section;
}

async function renderTierAvailability(){
  try{
    const manifest=await tiers();let directRuntime=null;
    for(const record of manifest.layers||[]){
      const sourceReady=record.availability==='source-ready',ready=record.slug==='foundation'||record.availability==='ready'||sourceReady,card=q(`[data-library-tier-card="${record.slug}"]`);if(card){card.dataset.availability=record.availability||'unknown';const state=q('[data-library-tier-state]',card);if(state)state.textContent=tierStateText(record);const count=q('[data-library-tier-count]',card);if(count){const materialized=Number(record.materialized_articles||0),indexed=Number(record.indexed_articles||0),target=Number(record.cumulative_target_articles||0);count.textContent=record.slug==='foundation'?`${materialized.toLocaleString()} packaged articles`:sourceReady?`${indexed.toLocaleString()} indexed additions · ${target.toLocaleString()} cumulative target · bodies from Wikimedia`:`${target.toLocaleString()} cumulative target · source index pending`;}}
      const option=q(`#library-tier-filter option[value="${record.slug}"]`);if(option){option.disabled=!ready;option.textContent=record.slug==='foundation'?'Foundation':sourceReady?`${labelFor(record.slug)} · downloaded articles`:`${labelFor(record.slug)} · source index pending`}
      if(sourceReady&&['expanded','deep'].includes(record.slug)){directRuntime=directRuntime||await upstream();await ensureUpstreamManager(record,directRuntime)}
    }
  }catch(error){console.warn('[Living Library downloads] Tier availability',error)}
}
function setExpanded(expanded){const toggle=document.getElementById(TOGGLE_ID),panel=document.getElementById(PANEL_ID);if(!toggle||!panel)return false;panel.hidden=!expanded;toggle.setAttribute('aria-expanded',expanded?'true':'false');if(expanded){ensureFoundationManager().catch(()=>{});renderTierAvailability();requestAnimationFrame(()=>q('input,button,select',panel)?.focus({preventScroll:true}))}return true}
function mount(){const toggle=document.getElementById(TOGGLE_ID),panel=document.getElementById(PANEL_ID),close=document.getElementById(CLOSE_ID);if(!toggle||!panel)return false;if(toggle.dataset.livingLibraryDownloadsBound!=='1'){toggle.dataset.livingLibraryDownloadsBound='1';toggle.addEventListener('click',()=>setExpanded(panel.hidden));close?.addEventListener('click',()=>{setExpanded(false);toggle.focus({preventScroll:true})})}renderTierAvailability();if(location.hash==='#library-downloads'||new URLSearchParams(location.search).get('manageLibrary')==='1')setExpanded(true);return true}
mount();addEventListener('pageshow',mount);addEventListener('civweave:living-library-updated',()=>renderTierAvailability());
globalThis.CivweaveLivingLibraryDownloadsV1=Object.freeze({version:VERSION,mount,open:()=>setExpanded(true),close:()=>setExpanded(false),refresh:renderTierAvailability});
})();
