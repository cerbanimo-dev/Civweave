(()=>{
'use strict';
const VERSION='1.0.7-network-commons-v219';
const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const clean=(value,max=400)=>String(value??'').trim().slice(0,max);
const relative=value=>{const time=Date.parse(value||0);if(!Number.isFinite(time))return'unknown';const seconds=Math.max(0,Math.round((Date.now()-time)/1000));if(seconds<60)return`${seconds}s ago`;if(seconds<3600)return`${Math.round(seconds/60)}m ago`;return`${Math.round(seconds/3600)}h ago`};
let dialog=null;
let invite=null;
let finishTimer=null;
let busy=false;

function runtime(){
  const discovery=globalThis.CommonweavePeerDiscoveryV219;
  const tools=globalThis.CommonweaveMeshToolsV156;
  if(!discovery||!tools)throw new Error('The Commonweave networking runtime has not loaded.');
  return{discovery,tools};
}

function button(){
  let node=document.querySelector('#network-button,[data-open-network-commons]');
  if(node)return node;
  const header=document.querySelector('.top');
  if(!header)return null;
  node=document.createElement('button');
  node.className='pill';node.id='network-button';node.type='button';node.dataset.openNetworkCommons='';node.innerHTML='<span aria-hidden="true">◎</span><span>People</span>';
  header.append(node);
  return node;
}

function markup(){return`<div class="cw-network-shell">
  <header class="cw-network-head"><div><h2>Network Commons</h2><p>Pair by QR, meet on shared nodes, and exchange only what you permit.</p></div><button class="cw-network-close" type="button" data-net-close aria-label="Close">×</button></header>
  <div class="cw-network-body">
    <div class="cw-network-status" data-net-status></div>
    <div class="cw-net-message" data-net-message hidden></div>
    <div class="cw-network-grid">
      <section class="cw-net-card"><h3>QR pairing</h3><p>Create a short-lived invitation or scan one from another Commonweave device.</p><div data-pairing-panel></div></section>
      <section class="cw-net-card"><h3>Shared-node discovery</h3><p>Presence is opt-in. Paired-only mode broadcasts no name or capability list.</p><div data-settings-panel></div></section>
      <section class="cw-net-card full"><h3>Shared nodes</h3><p>Pairing automatically adds the rendezvous node. You may also add or share other nodes without sharing their access tokens.</p><div data-nodes-panel></div></section>
      <section class="cw-net-card full"><h3>People and node invitations</h3><p>Online means their signed presence was seen recently on at least one shared node.</p><div data-people-panel></div></section>
    </div>
  </div>
</div>`}

function ensureDialog(){
  if(dialog)return dialog;
  dialog=document.createElement('dialog');dialog.id='cw-network-commons';dialog.className='cw-network-dialog';dialog.innerHTML=markup();document.body.append(dialog);
  dialog.addEventListener('click',handleClick);
  dialog.addEventListener('close',()=>stopFinishPolling());
  return dialog;
}

function message(text,error=false){
  const node=dialog?.querySelector('[data-net-message]');if(!node)return;
  node.textContent=text;node.hidden=!text;node.classList.toggle('error',Boolean(error));
}

function setBusy(value){busy=value;dialog?.querySelectorAll('button').forEach(node=>{if(!node.classList.contains('cw-network-close'))node.disabled=value})}

async function copyText(value){
  if(navigator.clipboard?.writeText)return navigator.clipboard.writeText(value);
  const area=document.createElement('textarea');area.value=value;document.body.append(area);area.select();document.execCommand('copy');area.remove();
}

function pairingHtml(status){
  const pending=Object.keys(status.pairings?.pending||{}).length;
  return`<div class="cw-net-stack">
    <div class="cw-net-row"><button class="cw-net-btn primary" type="button" data-net-action="create-invite">Create QR invitation</button><button class="cw-net-btn" type="button" data-net-action="finish-pairing" ${pending?'':'disabled'}>Check pending (${pending})</button></div>
    <div data-invite-output>${invite?`<div class="cw-net-qr-wrap"><canvas class="cw-net-qr" data-invite-canvas aria-label="QR pairing invitation"></canvas><div class="cw-net-stack"><div class="cw-net-field"><label>Invitation code</label><textarea class="cw-net-code" readonly data-invite-code>${esc(invite.code)}</textarea></div><div class="cw-net-row"><button class="cw-net-btn" type="button" data-net-action="copy-invite">Copy</button><button class="cw-net-btn" type="button" data-net-action="finish-pairing">Finish pairing</button></div><span class="cw-net-note">Expires ${esc(new Date(invite.expiresAt).toLocaleTimeString())}. The QR contains a one-time rendezvous secret, not your node access token.</span></div></div>`:''}</div>
    <div class="cw-net-field"><label for="cw-net-invite-input">Scan or paste another invitation</label><textarea id="cw-net-invite-input" data-invite-input placeholder="Paste the Commonweave invitation URL"></textarea></div>
    <div class="cw-net-row"><button class="cw-net-btn primary" type="button" data-net-action="accept-invite">Accept invitation</button><button class="cw-net-btn" type="button" data-net-action="scan-invite">Scan QR</button></div>
    <video class="cw-net-video" data-net-video playsinline hidden></video>
  </div>`;
}

function settingsHtml(settings){return`<div class="cw-net-stack">
  <label class="cw-net-checks"><span><input type="checkbox" data-setting="enabled" ${settings.enabled?'checked':''}> Find people while Commonweave is open</span></label>
  <div class="cw-net-field"><label>Display name</label><input data-setting="label" maxlength="80" value="${esc(settings.label)}"></div>
  <div class="cw-net-field"><label>Discovery visibility</label><select data-setting="visibility"><option value="paired" ${settings.visibility==='paired'?'selected':''}>Paired people only</option><option value="public" ${settings.visibility==='public'?'selected':''}>Public on shared nodes</option></select></div>
  <div class="cw-net-field"><label>Public capability tags</label><input data-setting="capabilities" value="${esc(settings.capabilities.join(', '))}" placeholder="woodworking, teaching, transport"></div>
  <div><span class="cw-net-label">Available exchanges</span><div class="cw-net-checks"><label><input type="checkbox" data-service="tasks" ${settings.services.tasks?'checked':''}> Tasks</label><label><input type="checkbox" data-service="trades" ${settings.services.trades?'checked':''}> Trades</label><label><input type="checkbox" data-service="validations" ${settings.services.validations?'checked':''}> Validations</label></div></div>
  <div class="cw-net-row"><button class="cw-net-btn primary" type="button" data-net-action="save-settings">Save discovery</button><button class="cw-net-btn" type="button" data-net-action="scan-now">Announce and look now</button></div>
  <span class="cw-net-note">Background discovery is best-effort in a PWA. It resumes when the app opens, focuses, or reconnects.</span>
</div>`}

function nodesHtml(status){
  const friends=status.friends||[];
  const rows=(status.nodes||[]).map(node=>`<div class="cw-net-item"><div><strong>${esc(node.label)} <span class="cw-net-badge">${esc(node.source)}</span></strong><small>${esc(node.url)}</small></div><div class="cw-net-item-actions"><button class="cw-net-btn" type="button" data-net-action="copy-node" data-node-url="${esc(node.url)}">Copy</button><button class="cw-net-btn" type="button" data-net-action="share-node" data-node-url="${esc(node.url)}" ${friends.length?'':'disabled'}>Share with paired people</button>${node.removable?`<button class="cw-net-btn danger" type="button" data-net-action="remove-node" data-node-url="${esc(node.url)}">Remove</button>`:''}</div></div>`).join('');
  return`<div class="cw-net-stack"><div class="cw-net-list">${rows||'<div class="cw-net-empty">No node is configured yet.</div>'}</div><div class="cw-net-row"><div class="cw-net-field"><label>Add a node</label><input data-node-input placeholder="https://community.example"></div><button class="cw-net-btn" type="button" data-net-action="add-node">Add</button></div></div>`;
}

function peopleHtml(status){
  const peers=status.peers||[],friends=status.friends||[],online=new Map(peers.map(peer=>[peer.peerId,peer]));
  const people=[...friends.map(friend=>({...friend,peerId:friend.id,paired:true,...online.get(friend.id)})),...peers.filter(peer=>!friends.some(friend=>friend.id===peer.peerId))];
  const peopleRows=people.map(peer=>`<div class="cw-net-item"><div><strong>${esc(peer.label||'Commonweave peer')} ${peer.paired?'<span class="cw-net-badge">paired</span>':'<span class="cw-net-badge">public</span>'}</strong><small>${online.has(peer.peerId)?`Online · seen ${esc(relative(peer.seenAt||peer.updatedAt))} · ${(peer.nodes||[]).length} shared node${(peer.nodes||[]).length===1?'':'s'}`:'Paired · not currently visible on a shared node'}${peer.capabilities?.length?` · ${esc(peer.capabilities.join(', '))}`:''}</small></div><div class="cw-net-item-actions">${peer.services?.tasks?'<span class="cw-net-badge">tasks</span>':''}${peer.services?.trades?'<span class="cw-net-badge">trades</span>':''}${peer.services?.validations?'<span class="cw-net-badge">validations</span>':''}</div></div>`).join('');
  const shares=(status.nodeShares||[]).filter(item=>item.status==='pending').map(item=>`<div class="cw-net-item"><div><strong>Shared node invitation</strong><small>${esc(item.card.label)} · ${esc(item.card.url)}</small></div><div class="cw-net-item-actions"><button class="cw-net-btn primary" type="button" data-net-action="accept-node-share" data-share-id="${esc(item.objectId)}">Add node</button><button class="cw-net-btn" type="button" data-net-action="reject-node-share" data-share-id="${esc(item.objectId)}">Dismiss</button></div></div>`).join('');
  return`<div class="cw-net-list">${shares}${peopleRows||'<div class="cw-net-empty">No paired or discoverable people yet. Create a QR invitation to begin.</div>'}</div>`;
}

async function render(){
  const {discovery,tools}=runtime();
  const [status,pairings]=await Promise.all([discovery.status(),Promise.resolve(tools.pairings())]);
  status.pairings=pairings;
  const online=status.peers.length;
  dialog.querySelector('[data-net-status]').innerHTML=`<span class="cw-net-chip" data-state="${navigator.onLine?'online':'offline'}">${navigator.onLine?'Network available':'Offline'}</span><span class="cw-net-chip">${status.friends.length} paired</span><span class="cw-net-chip">${online} online now</span><span class="cw-net-chip">${status.nodes.length} shared node${status.nodes.length===1?'':'s'}</span><span class="cw-net-chip">Discovery ${status.enabled?'on':'off'}</span>`;
  dialog.querySelector('[data-pairing-panel]').innerHTML=pairingHtml(status);
  dialog.querySelector('[data-settings-panel]').innerHTML=settingsHtml(status.settings);
  dialog.querySelector('[data-nodes-panel]').innerHTML=nodesHtml(status);
  dialog.querySelector('[data-people-panel]').innerHTML=peopleHtml(status);
  if(invite){const canvas=dialog.querySelector('[data-invite-canvas]');if(canvas)tools.renderInvite(canvas,invite.code)}
}

function settingInput(name){return dialog.querySelector(`[data-setting="${name}"]`)}

async function action(name,target){
  const {discovery,tools}=runtime();
  if(name==='create-invite'){
    const current=await discovery.settings();invite=await tools.createInvite({label:current.label});message('Invitation ready. Have the other person scan it.');startFinishPolling();
  }else if(name==='copy-invite'){
    if(invite)await copyText(invite.code);message('Invitation copied.');
  }else if(name==='finish-pairing'){
    const results=await tools.finishAll();const completed=results.filter(row=>row.peerId&&!row.pending).length;message(completed?`${completed} pairing completed.`:'No answer has arrived yet.');if(completed)await discovery.announceAndScan({force:true});
  }else if(name==='accept-invite'){
    const value=clean(dialog.querySelector('[data-invite-input]')?.value,4000);if(!value)throw new Error('Paste or scan a Commonweave invitation first.');
    const result=await tools.acceptInvite(value,{label:(await discovery.settings()).label});message(`Pairing response sent for ${result.peerId}. The inviting device can now finish the handshake.`);await discovery.announceAndScan({force:true});
  }else if(name==='scan-invite'){
    const video=dialog.querySelector('[data-net-video]');video.hidden=false;message('Point the camera at the Commonweave QR code.');
    const code=await tools.scanInvite(video);dialog.querySelector('[data-invite-input]').value=code;video.hidden=true;message('QR invitation captured. Review it, then accept.');
  }else if(name==='save-settings'){
    const services=Object.fromEntries(['tasks','trades','validations'].map(key=>[key,Boolean(dialog.querySelector(`[data-service="${key}"]`)?.checked)]));
    await discovery.setSettings({enabled:Boolean(settingInput('enabled')?.checked),label:settingInput('label')?.value,visibility:settingInput('visibility')?.value,capabilities:clean(settingInput('capabilities')?.value,1000).split(',').map(value=>value.trim()).filter(Boolean),services});message('Discovery settings saved.');
  }else if(name==='scan-now'){
    const result=await discovery.announceAndScan({force:true});message(`Checked ${result.nodeResults.length} node${result.nodeResults.length===1?'':'s'} and found ${result.peers.length} visible peer${result.peers.length===1?'':'s'}.`);
  }else if(name==='add-node'){
    const input=dialog.querySelector('[data-node-input]');await discovery.addNode(input?.value);input.value='';message('Shared node added.');
  }else if(name==='remove-node'){
    await discovery.removeNode(target.dataset.nodeUrl);message('Manual node removed.');
  }else if(name==='copy-node'){
    await copyText(target.dataset.nodeUrl);message('Node address copied.');
  }else if(name==='share-node'){
    const friendIds=tools.friends().map(friend=>friend.id);await discovery.shareNode(target.dataset.nodeUrl,friendIds);message(`Node card shared with ${friendIds.length} paired ${friendIds.length===1?'person':'people'}.`);
  }else if(name==='accept-node-share'){
    await discovery.acceptNodeShare(target.dataset.shareId);message('Shared node accepted and added.');
  }else if(name==='reject-node-share'){
    discovery.rejectNodeShare(target.dataset.shareId);message('Node invitation dismissed.');
  }
  await render();
}

async function handleClick(event){
  if(event.target.closest?.('[data-net-close]')){event.preventDefault();if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');return}
  const target=event.target.closest?.('[data-net-action]');if(!target||busy)return;
  event.preventDefault();
  setBusy(true);message('');
  try{await action(target.dataset.netAction,target)}catch(error){message(clean(error?.message||error,500),true)}finally{setBusy(false)}
}

function startFinishPolling(){
  stopFinishPolling();
  finishTimer=setInterval(async()=>{
    if(!dialog?.open)return;
    try{const results=await runtime().tools.finishAll();if(results.some(row=>row.peerId&&!row.pending)){message('Pairing complete. The new person is now trusted.');await runtime().discovery.announceAndScan({force:true});await render();stopFinishPolling()}}catch{}
  },3500);
}
function stopFinishPolling(){if(finishTimer){clearInterval(finishTimer);finishTimer=null}}

async function open(){
  ensureDialog();message('');
  if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
  try{await render()}catch(error){message(clean(error?.message||error,500),true)}
}

function bind(){
  button();
  if(!document.documentElement.dataset.networkCommonsBound){
    document.documentElement.dataset.networkCommonsBound='1';
    document.addEventListener('click',event=>{if(event.target.closest?.('[data-open-network-commons]'))open()});
  }
  for(const type of ['commonweave:peer-discovery-scan','commonweave:friend-paired','commonweave:friend-invite-accepted','commonweave:peer-discovery-node-added'])addEventListener(type,()=>{if(dialog?.open)render().catch(()=>{})});
}

const api=Object.freeze({VERSION,open,render});
globalThis.CommonweaveNetworkCommonsV219=api;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
