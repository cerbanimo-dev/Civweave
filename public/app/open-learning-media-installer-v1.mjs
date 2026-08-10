import media from'./open-learning-media-cache-v1.mjs?v=open-media-cache-v1';

const ROOT_ID='open-learning-media-cache';
const state={busy:false};
const $=selector=>document.querySelector(selector);
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function installMarkup(){
  const root=document.getElementById(ROOT_ID);if(!root||root.dataset.bound==='1')return root;
  root.dataset.bound='1';
  root.innerHTML=`
    <div class="knowledge-school-copy">
      <small>OUTAGE MEDIA CACHE</small>
      <h2>Keep rights-cleared learning videos on this device.</h2>
      <p>Civweave can cache approved Public Domain, CC0, CC BY, and CC BY-SA learning media, verify each file with SHA-256, and share permitted copies with paired Civweave nodes. Unknown, NC, ND, custom, and all-rights-reserved media stay out of the mesh cache.</p>
    </div>
    <div class="knowledge-school-presets" data-media-policies aria-label="Media storage profile">
      ${Object.entries(media.POLICY_PRESETS).map(([key,policy])=>`<button type="button" data-media-policy="${escapeHtml(key)}">${escapeHtml(policy.label)}</button>`).join('')}
    </div>
    <div class="knowledge-school-summary"><strong id="open-media-status">Checking local media storage…</strong><span id="open-media-catalog-state">Catalog status unknown.</span></div>
    <div class="gateway-actions knowledge-school-actions">
      <button id="open-media-focus-pack" class="primary" type="button">Download focus pack</button>
      <button id="open-media-outage-pack" class="secondary" type="button">Download outage pack</button>
      <button id="open-media-clear" class="secondary" type="button">Clear media cache</button>
    </div>
    <p id="open-media-help" class="install-help" role="status">Focus pack caches one compact item each for vibe coding, prompt engineering, pseudocoding, critical thinking, and logical frameworks. Outage pack tries two per topic within your selected storage budget.</p>
  `;
  return root;
}
function setBusy(value,message=''){state.busy=value;for(const button of document.querySelectorAll('#open-media-focus-pack,#open-media-outage-pack,#open-media-clear,[data-media-policy]'))button.disabled=value;if(message&&$('#open-media-help'))$('#open-media-help').textContent=message}
async function render(){
  const root=installMarkup();if(!root)return;
  const status=await media.status();
  $('#open-media-status').textContent=`${status.records} cached · ${media.bytesLabel(status.bytes)} of ${media.bytesLabel(status.budgetBytes)} ${status.policy.label}`;
  $('#open-media-catalog-state').textContent=status.catalogFresh?`Catalog current · ${status.meshPeers} mesh peer${status.meshPeers===1?'':'s'} · ${status.meshItems} advertised item${status.meshItems===1?'':'s'}`:'Catalog stale/offline: cached playback remains available, new origin downloads are paused.';
  root.dataset.catalogFresh=status.catalogFresh?'1':'0';
  for(const button of root.querySelectorAll('[data-media-policy]'))button.dataset.active=button.dataset.mediaPolicy===status.policy.name?'1':'0';
}
async function downloadPack(limitPerTopic){
  setBusy(true,`Caching ${limitPerTopic===1?'focus':'outage'} pack. Each file is streamed, SHA-256 verified, and stored locally.`);
  try{
    const result=await media.prefetchFocusPack({limitPerTopic});
    const flat=Object.values(result).flat(),ok=flat.filter(item=>item.ok).length,failed=flat.length-ok;
    $('#open-media-help').textContent=`Media pack complete: ${ok} cached${failed?` · ${failed} skipped or unavailable`:''}. Cached copies can be served to paired Civweave nodes when their licenses permit redistribution.`;
  }catch(error){$('#open-media-help').textContent=`Media pack stopped safely: ${error.message}`}
  finally{setBusy(false);await render()}
}
function bind(){
  const root=installMarkup();if(!root)return;
  root.addEventListener('click',async event=>{
    const policy=event.target.closest?.('[data-media-policy]');
    if(policy&&!state.busy){setBusy(true,'Changing local media storage policy…');try{await media.setStoragePolicy(policy.dataset.mediaPolicy)}finally{setBusy(false);await render()}return}
    if(event.target.closest?.('#open-media-focus-pack')&&!state.busy){await downloadPack(1);return}
    if(event.target.closest?.('#open-media-outage-pack')&&!state.busy){await downloadPack(2);return}
    if(event.target.closest?.('#open-media-clear')&&!state.busy){setBusy(true,'Clearing only the optional Open Learning Media cache…');try{const count=await media.clearCache();$('#open-media-help').textContent=`Removed ${count} cached media item${count===1?'':'s'}. Knowledge schools and the Civweave campus were left untouched.`}catch(error){$('#open-media-help').textContent=`Could not clear media cache: ${error.message}`}finally{setBusy(false);await render()}}
  });
  media.subscribe(()=>render().catch(()=>{}));
  setInterval(()=>render().catch(()=>{}),5000);
  render().catch(error=>{$('#open-media-help').textContent=`Open Learning Media cache unavailable: ${error.message}`});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
