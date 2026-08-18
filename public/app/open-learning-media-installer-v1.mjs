import media from'./open-learning-media-cache-v1.mjs?v=open-media-cache-v1';

const ROOT_ID='open-learning-media-cache';
const INSTALL_MARKER_KEY='civweave.pwa.installed-marker.v1';
const AUTO_RECEIPT_KEY='civweave.open-learning-media.auto-prefetch.v1';
const AUTO_START_DELAY_MS=3500;
const AUTO_IDLE_TIMEOUT_MS=2200;
const AUTO_TOPIC_ATTEMPTS=6;
const state={busy:false,autoBusy:false,packs:[],autoDone:0,autoTotal:0,autoPacks:0,autoTimer:0};
const $=selector=>document.querySelector(selector);
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const FALLBACK_PACKS=[
  {slug:'general-knowledge',name:'General Knowledge',kind:'core',default:true,description:'Broad history, geography, science, math, arts, health, civics, technology, and philosophy.',topics:['world-history','earth-geography','civics-society','biology-life','physics-foundations','chemistry-foundations','astronomy-space','mathematics-foundations','computing-basics','arts-culture','health-wellness','philosophy-ethics']},
  {slug:'digital-ai-literacy',name:'Digital & AI Literacy',kind:'extension',description:'AI-assisted creation, prompting, algorithms, critical thinking, and logic.',topics:['computing-basics','vibe-coding','prompt-engineering','pseudocoding','critical-thinking','logical-frameworks']},
];

function ensureRoot(){
  let root=document.getElementById(ROOT_ID);if(root)return root;
  root=document.createElement('section');root.id=ROOT_ID;root.className='knowledge-card';root.setAttribute('aria-label','Open Learning Media cache');
  const marker=document.querySelector('.gateway-grid');if(marker)marker.insertAdjacentElement('beforebegin',root);else(document.querySelector('.gateway')||document.body)?.append(root);return root;
}
function installMarkup(){
  const root=ensureRoot();if(!root||root.dataset.bound==='1')return root;
  root.dataset.bound='1';
  root.innerHTML=`
    <div class="knowledge-school-copy">
      <small>OPEN LEARNING MEDIA</small>
      <h2>Available learning packs fill themselves after install.</h2>
      <p>Civweave lazily caches one compact approved video per available topic after the PWA is installed. Downloads run sequentially during idle time, stay inside the selected storage budget, preserve SHA-256 verification, and keep Public Domain, CC0, CC BY, and CC BY-SA redistribution rules intact.</p>
    </div>
    <div class="knowledge-school-presets" data-media-policies aria-label="Media storage profile">
      ${Object.entries(media.POLICY_PRESETS).map(([key,policy])=>`<button type="button" data-media-policy="${escapeHtml(key)}">${escapeHtml(policy.label)}</button>`).join('')}
    </div>
    <div class="knowledge-school-summary"><strong id="open-media-status">Checking local media storage…</strong><span id="open-media-catalog-state">Catalog status unknown.</span></div>
    <div id="open-media-pack-grid" class="knowledge-school-presets" aria-label="Learning media packs"></div>
    <div class="gateway-actions knowledge-school-actions">
      <button id="open-media-outage-pack" class="primary" type="button">Pin general knowledge outage pack</button>
      <button id="open-media-clear" class="secondary" type="button">Clear media cache</button>
    </div>
    <p id="open-media-help" class="install-help" role="status">No pack selection is required. All currently available packs will join the lazy download queue after Civweave is installed. The Minimal storage profile remains an explicit opt-out from automatic media files.</p>
  `;
  return root;
}
function setBusy(value,message=''){
  state.busy=value;
  const disabled=value||state.autoBusy;
  for(const button of document.querySelectorAll('#open-media-outage-pack,#open-media-clear,[data-media-policy]'))button.disabled=disabled;
  if(message&&$('#open-media-help'))$('#open-media-help').textContent=message;
}
function setAutoBusy(value,message=''){
  state.autoBusy=value;
  const disabled=value||state.busy;
  for(const button of document.querySelectorAll('#open-media-outage-pack,#open-media-clear,[data-media-policy]'))button.disabled=disabled;
  if(message&&$('#open-media-help'))$('#open-media-help').textContent=message;
}
async function requestPersistence(){try{return Boolean(await navigator.storage?.persist?.())}catch{return false}}
async function loadPacks(){
  try{
    const lookup=await media.loadLookup();
    const packs=Array.isArray(lookup?.packs)?lookup.packs.filter(pack=>pack?.slug&&Array.isArray(pack?.topics)&&pack.topics.length):[];
    state.packs=packs.length?packs:FALLBACK_PACKS;
  }catch{state.packs=FALLBACK_PACKS}
  return state.packs;
}
function availablePacks(){return state.packs.filter(pack=>pack.available!==false)}
function renderPackButtons(){
  const grid=$('#open-media-pack-grid');if(!grid)return;
  grid.innerHTML=state.packs.map(pack=>`
    <button type="button" data-media-pack="${escapeHtml(pack.slug)}" disabled title="${escapeHtml(pack.description||'')}">
      ${escapeHtml(pack.name)} · ${pack.available===false?'waiting for approved coverage':'automatic'} · ${pack.topics.length} topic${pack.topics.length===1?'':'s'}
    </button>
  `).join('');
}
async function render(){
  const root=installMarkup();if(!root)return;
  await loadPacks();renderPackButtons();
  const status=await media.status();
  $('#open-media-status').textContent=`${status.records} cached · ${media.bytesLabel(status.bytes)} of ${media.bytesLabel(status.budgetBytes)} ${status.policy.label}`;
  const progress=state.autoTotal?` · lazy queue ${state.autoDone}/${state.autoTotal} topics`:'';
  $('#open-media-catalog-state').textContent=status.catalogFresh?`Catalog current · ${availablePacks().length}/${state.packs.length} packs available${progress} · ${status.meshPeers} mesh peer${status.meshPeers===1?'':'s'} · ${status.meshItems} advertised item${status.meshItems===1?'':'s'}`:'Catalog stale/offline: cached playback remains available, new origin downloads are paused.';
  root.dataset.catalogFresh=status.catalogFresh?'1':'0';
  for(const button of root.querySelectorAll('[data-media-policy]'))button.dataset.active=button.dataset.mediaPolicy===status.policy.name?'1':'0';
}
async function downloadPack(packSlug,{limitPerTopic=1,pinned=false,label='pack'}={}){
  const pack=state.packs.find(item=>item.slug===packSlug);
  if(!pack)throw new Error(`Unknown media pack: ${packSlug}`);
  setBusy(true,`Caching ${pack.name}. Each file is streamed, SHA-256 verified, and stored locally.`);
  try{
    const persistent=await requestPersistence();
    const results={};
    for(const slug of pack.topics)results[slug]=await media.prefetchTopic(slug,{limit:limitPerTopic,pinned});
    const flat=Object.values(results).flat(),ok=flat.filter(item=>item.ok).length,failed=flat.length-ok;
    $('#open-media-help').textContent=`${pack.name} ${label} complete: ${ok} cached${failed?` · ${failed} skipped or unavailable`:''}. ${persistent?'The browser granted durable storage.':'Storage remains browser-managed; Civweave will still protect its own cache lane during updates.'} Rights-cleared cached copies remain eligible for paired-node sharing.`;
  }catch(error){$('#open-media-help').textContent=`${pack.name} stopped safely: ${error.message}`}
  finally{setBusy(false);await render()}
}
function installedContext(){
  try{const bridge=globalThis.CivweavePWAInstallV250;if(bridge?.appRuntime?.()||bridge?.installedMarker?.())return true}catch{}
  try{const marker=JSON.parse(localStorage.getItem(INSTALL_MARKER_KEY)||'null');if(marker?.origin===location.origin&&marker?.manifestId==='/civweave-local')return true}catch{}
  try{if(navigator.standalone===true)return true;if(['standalone','fullscreen','minimal-ui','window-controls-overlay'].some(mode=>matchMedia(`(display-mode: ${mode})`).matches))return true}catch{}
  return false;
}
function automaticNetworkAllowed(){const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;return navigator.onLine!==false&&!connection?.saveData&&!['slow-2g','2g'].includes(connection?.effectiveType)}
function idleTurn(){return new Promise(resolve=>{if(typeof requestIdleCallback==='function')requestIdleCallback(()=>resolve(),{timeout:AUTO_IDLE_TIMEOUT_MS});else setTimeout(resolve,650)})}
function readAutoReceipt(){try{return JSON.parse(localStorage.getItem(AUTO_RECEIPT_KEY)||'{}')||{}}catch{return{}}}
function writeAutoReceipt(value){try{localStorage.setItem(AUTO_RECEIPT_KEY,JSON.stringify(value))}catch{}}
function lookupToken(lookup){return String(lookup?.built_at||lookup?.revision||lookup?.schema||'catalog')}
function uniqueAvailableTopics(){const seen=new Set(),topics=[];for(const pack of availablePacks())for(const slug of pack.topics)if(slug&&!seen.has(slug)){seen.add(slug);topics.push(slug)}return topics}
function smallestFileBytes(record,policy){const file=media.chooseFile(record,{maxBytes:Number(policy.maxAutomaticItemBytes)||Infinity,preferSmall:true});return file?Number(file.bytes)||0:Number.MAX_SAFE_INTEGER}
async function cacheTopicAutomatically(lookup,topicSlug,policy){
  const records=(lookup?.topics?.[topicSlug]||[])
    .filter(record=>record?.cache_policy==='MESH_REDISTRIBUTABLE'&&media.licenseAllowed(record?.license))
    .map(record=>({...record,topicSlug}))
    .sort((a,b)=>smallestFileBytes(a,policy)-smallestFileBytes(b,policy)||Number(b.quality_score||0)-Number(a.quality_score||0));
  if(!records.length)return{ok:false,skipped:true,reason:'no approved direct file'};
  const errors=[];
  for(const record of records.slice(0,AUTO_TOPIC_ATTEMPTS)){
    const file=media.chooseFile(record,{maxBytes:Number(policy.maxAutomaticItemBytes)||Infinity,preferSmall:true});
    if(!file)continue;
    try{return{ok:true,record:await media.cacheRecord(record,{automatic:true,pinned:false})}}catch(error){errors.push(error?.message||String(error))}
  }
  return{ok:false,skipped:false,reason:errors[0]||'no automatic-size candidate succeeded'};
}
async function lazyDownloadAllAvailablePacks({forceInstalled=false,source='startup'}={}){
  if(state.autoBusy||state.busy)return false;
  if(!forceInstalled&&!installedContext())return false;
  if(!automaticNetworkAllowed()){$('#open-media-help').textContent='Automatic learning-pack downloads are paused by offline, Save-Data, or very slow-network settings. They will resume when the connection allows it.';return false}
  const lookup=await media.loadLookup();await loadPacks();
  const policy=await media.storagePolicy();
  if(!policy.autoPrefetch){$('#open-media-help').textContent='Minimal storage is active, so automatic media-file downloads are paused. Link catalogs still download lazily. Choose Learning Path, Outage Ready, or Archive to resume media files.';return false}
  const topics=uniqueAvailableTopics(),token=lookupToken(lookup),previous=readAutoReceipt();
  const completed=new Set(previous.catalogToken===token&&Array.isArray(previous.completedTopics)?previous.completedTopics:[]);
  const skipped=new Set(previous.catalogToken===token&&Array.isArray(previous.skippedTopics)?previous.skippedTopics:[]);
  state.autoTotal=topics.length;state.autoDone=topics.filter(slug=>completed.has(slug)||skipped.has(slug)).length;state.autoPacks=availablePacks().length;
  if(state.autoDone>=state.autoTotal){$('#open-media-help').textContent=`All ${state.autoPacks} currently available learning packs are staged for this catalog (${state.autoTotal} unique topics).`;await render();return true}
  setAutoBusy(true,`Lazily filling ${state.autoPacks} learning packs · ${state.autoDone}/${state.autoTotal} topics complete.`);
  await requestPersistence();
  try{
    for(const slug of topics){
      if(completed.has(slug)||skipped.has(slug))continue;
      if(!automaticNetworkAllowed())break;
      await idleTurn();
      $('#open-media-help').textContent=`Lazy learning-pack download · ${state.autoDone}/${state.autoTotal} topics · caching ${slug.replaceAll('-',' ')}…`;
      const result=await cacheTopicAutomatically(lookup,slug,policy);
      if(result.ok)completed.add(slug);else if(result.skipped)skipped.add(slug);
      state.autoDone=topics.filter(item=>completed.has(item)||skipped.has(item)).length;
      writeAutoReceipt({schema:'civweave.open-learning-media.auto-prefetch.v1',catalogToken:token,completedTopics:[...completed],skippedTopics:[...skipped],availablePacks:availablePacks().map(pack=>pack.slug),updatedAt:new Date().toISOString(),source});
      await render();
    }
    const pending=topics.filter(slug=>!completed.has(slug)&&!skipped.has(slug)).length;
    $('#open-media-help').textContent=pending?`Learning-pack lazy download paused with ${pending} topic${pending===1?'':'s'} remaining. It will resume automatically when this installed page has a usable connection.`:`All ${state.autoPacks} currently available learning packs are staged automatically: ${completed.size} topics cached${skipped.size?` · ${skipped.size} topics have no approved direct file yet`:''}.`;
    return pending===0;
  }catch(error){$('#open-media-help').textContent=`Automatic learning-pack download stopped safely: ${error?.message||error}. It will retry later.`;return false}
  finally{setAutoBusy(false);await render()}
}
function scheduleAutoDownload(source='startup',forceInstalled=false){
  clearTimeout(state.autoTimer);state.autoTimer=setTimeout(()=>lazyDownloadAllAvailablePacks({forceInstalled,source}).catch(error=>{$('#open-media-help').textContent=`Automatic learning-pack queue unavailable: ${error?.message||error}`}),AUTO_START_DELAY_MS);
}
function bind(){
  const root=installMarkup();if(!root)return;
  root.addEventListener('click',async event=>{
    const policy=event.target.closest?.('[data-media-policy]');
    if(policy&&!state.busy&&!state.autoBusy){setBusy(true,'Changing local media storage policy…');try{await media.setStoragePolicy(policy.dataset.mediaPolicy)}finally{setBusy(false);await render();scheduleAutoDownload('policy-change')}return}
    if(event.target.closest?.('#open-media-outage-pack')&&!state.busy&&!state.autoBusy){await downloadPack('general-knowledge',{limitPerTopic:2,pinned:true,label:'outage pack'});return}
    if(event.target.closest?.('#open-media-clear')&&!state.busy&&!state.autoBusy){setBusy(true,'Clearing only the optional Open Learning Media cache…');try{const count=await media.clearCache();try{localStorage.removeItem(AUTO_RECEIPT_KEY)}catch{}$('#open-media-help').textContent=`Removed ${count} cached media item${count===1?'':'s'}. The automatic queue will rebuild eligible items after the next idle window.`}catch(error){$('#open-media-help').textContent=`Could not clear media cache: ${error.message}`}finally{setBusy(false);await render();scheduleAutoDownload('cache-clear')}}
  });
  media.subscribe(()=>render().catch(()=>{}));
  addEventListener('civweave:pwa-installed',()=>scheduleAutoDownload('pwa-installed',true));
  addEventListener('appinstalled',()=>scheduleAutoDownload('appinstalled',true));
  addEventListener('online',()=>scheduleAutoDownload('online'));
  try{(navigator.connection||navigator.mozConnection||navigator.webkitConnection)?.addEventListener?.('change',()=>scheduleAutoDownload('connection-change'))}catch{}
  setInterval(()=>render().catch(()=>{}),5000);
  render().then(()=>scheduleAutoDownload('startup')).catch(error=>{$('#open-media-help').textContent=`Open Learning Media cache unavailable: ${error.message}`});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
