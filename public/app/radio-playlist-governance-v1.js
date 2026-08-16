(()=>{
'use strict';
if(globalThis.CivweaveRadioPlaylistGovernanceV1?.version==='1.1.0-event-driven-v1')return;

const VERSION='1.1.0-event-driven-v1';
const DIALOG_ID='cw-playlist-nomination-v1';
const PANEL_ID='cw-playlist-governance-panel-v1';
const PASSPORT_KEY='civweave.anarchadia.citizen-console.v139';
const clean=(value,max=1000)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function api(){return globalThis.CivweaveCanonicalPlaylistsV1}
function systemId(){return globalThis.CivweaveSystemRoutesV227?.identify?.(location.pathname)||document.documentElement?.dataset?.civweaveSystemRoute||document.documentElement?.dataset?.civweaveSystem||''}
function actorId(){try{const row=JSON.parse(localStorage.getItem(PASSPORT_KEY)||'{}');return clean(row.passportId||row.profile?.passportId,220)}catch{return''}}
function activeElectorate(){
  const sources=[
    ()=>globalThis.CivweaveActiveMeshElectorate?.members?.(),
    ()=>globalThis.CivweaveRegionGossipV1?.activeEligibleMemberIds?.(),
    ()=>{try{return JSON.parse(localStorage.getItem('civweave.anarchadia.active-electorate.v1')||'[]')}catch{return[]}}
  ];
  for(const read of sources){try{const rows=read();if(Array.isArray(rows)&&rows.length)return rows}catch{}}
  return [];
}
function toast(message,bad=false){
  let node=document.querySelector('#cwPlaylistToastV1');
  if(!node){node=document.createElement('div');node.id='cwPlaylistToastV1';node.className='cw-playlist-toast-v1';document.body.append(node)}
  node.textContent=clean(message,400);node.dataset.bad=bad?'true':'false';node.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>node.hidden=true,4200);
}
function installStyle(){
  if(document.querySelector('#cwPlaylistGovernanceStyleV1'))return;
  const style=document.createElement('style');style.id='cwPlaylistGovernanceStyleV1';style.textContent=`
.cw-playlist-dialog-v1{width:min(680px,calc(100vw - 24px));max-height:min(86dvh,900px);overflow:auto;border:1px solid #ffffff30;border-radius:18px;background:#11121a;color:#fff;padding:0;box-shadow:0 24px 80px #000b}.cw-playlist-dialog-v1::backdrop{background:#080912cc}.cw-playlist-dialog-v1 form{display:grid;gap:12px;padding:18px}.cw-playlist-dialog-v1 header{display:flex;align-items:start;justify-content:space-between;gap:16px}.cw-playlist-dialog-v1 h2{margin:0;font-size:20px}.cw-playlist-dialog-v1 p{margin:.35rem 0 0;opacity:.76}.cw-playlist-dialog-v1 label{display:grid;gap:5px;font-size:12px;font-weight:750}.cw-playlist-dialog-v1 input,.cw-playlist-dialog-v1 textarea{width:100%;box-sizing:border-box;border:1px solid #ffffff30;border-radius:10px;background:#ffffff0b;color:inherit;padding:10px}.cw-playlist-grid-v1{display:grid;grid-template-columns:1fr 1fr;gap:10px}.cw-playlist-dialog-actions-v1{display:flex;justify-content:flex-end;gap:8px}.cw-playlist-panel-v1{position:fixed;z-index:2147483613;right:12px;bottom:calc(var(--cw-themed-nav-height,64px) + env(safe-area-inset-bottom) + 12px);width:min(430px,calc(100vw - 24px));max-height:60dvh;overflow:auto;padding:12px;border:1px solid #ffffff30;border-radius:16px;background:#11121af5;color:#fff;box-shadow:0 18px 60px #000a}.cw-playlist-panel-v1 header{display:flex;align-items:center;justify-content:space-between;gap:12px}.cw-playlist-panel-v1 h3{margin:0}.cw-playlist-panel-v1 [data-playlist-panel-close]{width:34px;height:34px;border:1px solid #ffffff2c;border-radius:9px;background:#ffffff0a;color:#fff;font-size:19px}.cw-playlist-proposal-v1{display:grid;gap:7px;padding:10px 0;border-top:1px solid #ffffff20}.cw-playlist-proposal-v1:first-of-type{border-top:0}.cw-playlist-votes-v1{display:flex;gap:6px;flex-wrap:wrap}.cw-playlist-votes-v1 button{min-height:34px}.cw-playlist-toast-v1{position:fixed;z-index:2147483647;left:50%;bottom:22px;transform:translateX(-50%);max-width:min(560px,calc(100vw - 24px));padding:10px 14px;border-radius:999px;background:#17251c;color:#fff;box-shadow:0 10px 30px #0008}.cw-playlist-toast-v1[data-bad="true"]{background:#35171c}@media(max-width:600px){.cw-playlist-grid-v1{grid-template-columns:1fr}.cw-playlist-panel-v1{right:12px;left:12px;width:auto}}`;
  document.head.append(style);
}
function ensureDialog(){
  let dialog=document.querySelector(`#${DIALOG_ID}`);if(dialog)return dialog;
  dialog=document.createElement('dialog');dialog.id=DIALOG_ID;dialog.className='cw-playlist-dialog-v1';
  dialog.innerHTML=`<form method="dialog" data-playlist-nomination-form><header><div><h2>Nominate a track</h2><p>Spotify anchors ordinary nominations. Alternate services are welcome and Anarchadia decides what becomes canonical.</p></div><button type="button" data-playlist-close aria-label="Close">×</button></header><input type="hidden" name="playlistId"><div class="cw-playlist-grid-v1"><label>Track title<input name="title" maxlength="240" required></label><label>Primary artist<input name="artist" maxlength="240" required></label><label>Spotify track link<input name="spotify" type="url" inputmode="url" placeholder="https://open.spotify.com/track/…" required></label><label>ISRC, if known<input name="isrc" maxlength="32"></label><label>Album<input name="album" maxlength="240"></label><label>Duration, seconds<input name="durationSeconds" type="number" min="0" max="7200" step="1"></label><label>Apple Music<input name="appleMusic" type="url"></label><label>YouTube Music<input name="youtubeMusic" type="url"></label><label>YouTube<input name="youtube" type="url"></label><label>Bandcamp<input name="bandcamp" type="url"></label><label>SoundCloud<input name="soundcloud" type="url"></label><label>Tidal<input name="tidal" type="url"></label><label>Deezer<input name="deezer" type="url"></label></div><label>Why this belongs here<textarea name="rationale" rows="3" maxlength="1200"></textarea></label><div class="cw-playlist-dialog-actions-v1"><button type="button" data-playlist-close>Cancel</button><button type="submit">Send to Anarchadia</button></div></form>`;
  document.body.append(dialog);dialog.querySelectorAll('[data-playlist-close]').forEach(button=>button.addEventListener('click',()=>dialog.close()));dialog.querySelector('form')?.addEventListener('submit',event=>{event.preventDefault();submitNomination(event.currentTarget)});return dialog;
}
function openNomination(requestedSystem=systemId()){
  const core=api(),id=clean(requestedSystem,80);
  if(!core){toast('Playlist governance is still loading.',true);return false}
  if(!core.playlists[id]){toast('This surface has no canonical station playlist.',true);return false}
  const dialog=ensureDialog(),form=dialog.querySelector('form');form.reset();form.elements.playlistId.value=id;dialog.showModal();return true;
}
function submitNomination(form){
  try{
    const values=Object.fromEntries(new FormData(form).entries()),electorate=activeElectorate();
    const proposal=api().createProposal({playlistId:values.playlistId,title:values.title,artist:values.artist,spotify:values.spotify,isrc:values.isrc,album:values.album,durationSeconds:values.durationSeconds,rationale:values.rationale,providerLinks:{spotify:values.spotify,appleMusic:values.appleMusic,youtubeMusic:values.youtubeMusic,youtube:values.youtube,bandcamp:values.bandcamp,soundcloud:values.soundcloud,tidal:values.tidal,deezer:values.deezer},source:{system:'user'}},{electorate});
    form.closest('dialog')?.close();toast(proposal.status==='awaiting-electorate'?'Nomination saved. Anarchadia will freeze the active mesh electorate before voting.':'Nomination is open for Anarchadia voting.');
  }catch(error){toast(error.message||String(error),true)}
}
function nominateCerbanimoTrack(input={}){
  try{
    const proposal=api().nominateCerbanimoTrack({...input,playlistId:input.playlistId||'cerbanimo'},{electorate:activeElectorate()});
    toast(proposal.status==='awaiting-electorate'?'Cerbanimo track nominated. Anarchadia will freeze the active mesh electorate before voting.':'Cerbanimo track is open for Anarchadia voting.');
    dispatchEvent(new CustomEvent('civweave:cerbanimo-track-nomination-created',{detail:{proposal}}));return proposal;
  }catch(error){toast(error.message||String(error),true);throw error}
}
function proposalRows(){return api()?.read?.().proposals?.filter(row=>['awaiting-electorate','voting','approved'].includes(row.status)).slice(-12).reverse()||[]}
function proposalCard(row){
  const tally=api().tallyProposal(row),mine=actorId(),eligible=mine&&row.governance?.electorateSnapshot?.includes(mine),open=row.status==='voting';
  return `<article class="cw-playlist-proposal-v1" data-playlist-proposal="${esc(row.id)}"><strong>${esc(row.action==='remove'?'Remove':'Add')} ${esc(row.track?.artist)} · ${esc(row.track?.title)}</strong><small>${esc(row.playlistLabel)} · ${esc(row.source?.qualityGate||'')} · ${esc(row.status)}</small><small>${tally.cast}/${tally.eligible} active electorate votes · ${Math.round(tally.approval*100)}% approval</small>${open&&eligible?`<div class="cw-playlist-votes-v1"><button type="button" data-playlist-vote="approve">Approve</button><button type="button" data-playlist-vote="reject">Reject</button><button type="button" data-playlist-vote="abstain">Abstain</button></div>`:row.status==='awaiting-electorate'?'<small>Waiting for the mesh-wide active electorate snapshot.</small>':''}</article>`;
}
function renderGovernancePanel({force=false}={}){
  if(systemId()!=='anarchadia'){document.querySelector(`#${PANEL_ID}`)?.remove();return false}
  const proposals=proposalRows(),existing=document.querySelector(`#${PANEL_ID}`);
  if(!proposals.length){existing?.remove();return false}
  if(!force&&!existing)return false;
  let panel=existing;
  if(!panel){
    panel=document.createElement('aside');panel.id=PANEL_ID;panel.className='cw-playlist-panel-v1';document.body.append(panel);
    panel.addEventListener('click',event=>{
      const close=event.target.closest?.('[data-playlist-panel-close]');if(close){panel.remove();return}
      const button=event.target.closest?.('[data-playlist-vote]');if(!button)return;
      const proposalId=button.closest('[data-playlist-proposal]')?.dataset.playlistProposal;
      try{api().castVote(proposalId,actorId(),button.dataset.playlistVote);renderGovernancePanel({force:true})}catch(error){toast(error.message||String(error),true)}
    });
  }
  panel.innerHTML=`<header><h3>Canonical playlist votes</h3><button type="button" data-playlist-panel-close aria-label="Close playlist votes">×</button></header>${proposals.map(proposalCard).join('')}`;
  return true;
}
function openGovernance(){
  if(systemId()!=='anarchadia'){toast('Playlist voting lives in Anarchadia.',true);return false}
  if(!proposalRows().length){document.querySelector(`#${PANEL_ID}`)?.remove();toast('No playlist nominations are waiting here.');return false}
  return renderGovernancePanel({force:true});
}
function tryElectorateRefresh(){
  const members=activeElectorate();if(!members.length)return;
  const rows=api()?.read?.().proposals||[];
  for(const row of rows){if(row.status==='awaiting-electorate'&&!row.votes?.length){try{api().setElectorate(row.id,members)}catch{}}}
}
function refreshOpenPanel(){tryElectorateRefresh();if(document.querySelector(`#${PANEL_ID}`))renderGovernancePanel({force:true})}
function start(){
  installStyle();tryElectorateRefresh();
  addEventListener('civweave:playlist-nomination-open',event=>openNomination(event.detail?.system||systemId()));
  addEventListener('civweave:playlist-governance-open',openGovernance);
  addEventListener('civweave:canonical-playlists:changed',refreshOpenPanel);
  addEventListener('civweave:cerbanimo-track-nominate',event=>{try{nominateCerbanimoTrack(event.detail||{})}catch{}});
  addEventListener('storage',event=>{if(event.key==='civweave.canonical-playlists.v1')refreshOpenPanel()});
}
const apiObject=Object.freeze({version:VERSION,openNomination,openGovernance,nominateCerbanimoTrack,activeElectorate,actorId,renderGovernancePanel,idleEventDriven:true,mutationObserver:false});
globalThis.CivweaveRadioPlaylistGovernanceV1=apiObject;
document.readyState==='loading'?addEventListener('DOMContentLoaded',start,{once:true}):start();
})();
