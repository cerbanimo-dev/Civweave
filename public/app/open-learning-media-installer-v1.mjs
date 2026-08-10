import media from'./open-learning-media-cache-v1.mjs?v=open-media-cache-v1';

const ROOT_ID='open-learning-media-cache';
const state={busy:false,packs:[]};
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
      <h2>Build an offline video shelf, one knowledge pack at a time.</h2>
      <p>Civweave can cache approved Public Domain, CC0, CC BY, and CC BY-SA learning media, verify each file with SHA-256, and share permitted copies with paired Civweave nodes. General Knowledge stays broad; extension packs let you deepen particular kinds of learning without hauling the whole library onto every device.</p>
    </div>
    <div class="knowledge-school-presets" data-media-policies aria-label="Media storage profile">
      ${Object.entries(media.POLICY_PRESETS).map(([key,policy])=>`<button type="button" data-media-policy="${escapeHtml(key)}">${escapeHtml(policy.label)}</button>`).join('')}
    </div>
    <div class="knowledge-school-summary"><strong id="open-media-status">Checking local media storage…</strong><span id="open-media-catalog-state">Catalog status unknown.</span></div>
    <div id="open-media-pack-grid" class="knowledge-school-presets" aria-label="Learning media packs"></div>
    <div class="gateway-actions knowledge-school-actions">
      <button id="open-media-outage-pack" class="primary" type="button">General knowledge outage pack</button>
      <button id="open-media-clear" class="secondary" type="button">Clear media cache</button>
    </div>
    <p id="open-media-help" class="install-help" role="status">Choose General Knowledge for broad coverage, or add only the extension packs you want. Each pack caches compact rights-cleared videos within your selected storage budget.</p>
  `;
  return root;
}
function setBusy(value,message=''){
  state.busy=value;
  for(const button of document.querySelectorAll('#open-media-outage-pack,#open-media-clear,[data-media-policy],[data-media-pack]'))button.disabled=value;
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
function renderPackButtons(){
  const grid=$('#open-media-pack-grid');if(!grid)return;
  grid.innerHTML=state.packs.map(pack=>`
    <button type="button" data-media-pack="${escapeHtml(pack.slug)}" ${pack.available===false?'disabled':''} title="${escapeHtml(pack.description||'')}">
      ${escapeHtml(pack.name)} · ${pack.topics.length} topic${pack.topics.length===1?'':'s'}${pack.kind==='core'?' · core':' · extension'}
    </button>
  `).join('');
}
async function render(){
  const root=installMarkup();if(!root)return;
  await loadPacks();renderPackButtons();
  const status=await media.status();
  $('#open-media-status').textContent=`${status.records} cached · ${media.bytesLabel(status.bytes)} of ${media.bytesLabel(status.budgetBytes)} ${status.policy.label}`;
  $('#open-media-catalog-state').textContent=status.catalogFresh?`Catalog current · ${state.packs.length} pack${state.packs.length===1?'':'s'} · ${status.meshPeers} mesh peer${status.meshPeers===1?'':'s'} · ${status.meshItems} advertised item${status.meshItems===1?'':'s'}`:'Catalog stale/offline: cached playback remains available, new origin downloads are paused.';
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
function bind(){
  const root=installMarkup();if(!root)return;
  root.addEventListener('click',async event=>{
    const policy=event.target.closest?.('[data-media-policy]');
    if(policy&&!state.busy){setBusy(true,'Changing local media storage policy…');try{await media.setStoragePolicy(policy.dataset.mediaPolicy)}finally{setBusy(false);await render()}return}
    const packButton=event.target.closest?.('[data-media-pack]');
    if(packButton&&!state.busy&&!packButton.disabled){await downloadPack(packButton.dataset.mediaPack,{limitPerTopic:1,label:'starter pack'});return}
    if(event.target.closest?.('#open-media-outage-pack')&&!state.busy){await downloadPack('general-knowledge',{limitPerTopic:2,pinned:true,label:'outage pack'});return}
    if(event.target.closest?.('#open-media-clear')&&!state.busy){setBusy(true,'Clearing only the optional Open Learning Media cache…');try{const count=await media.clearCache();$('#open-media-help').textContent=`Removed ${count} cached media item${count===1?'':'s'}. Knowledge schools and the Civweave campus were left untouched.`}catch(error){$('#open-media-help').textContent=`Could not clear media cache: ${error.message}`}finally{setBusy(false);await render()}}
  });
  media.subscribe(()=>render().catch(()=>{}));
  setInterval(()=>render().catch(()=>{}),5000);
  render().catch(error=>{$('#open-media-help').textContent=`Open Learning Media cache unavailable: ${error.message}`});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
