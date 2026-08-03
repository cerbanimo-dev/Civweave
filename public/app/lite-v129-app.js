function renderDetail(system,room,capability){
  const native=renderNative(capability);
  return `<button class="back-button" type="button" data-back-room>← ${esc(room.label)}</button><section class="detail-card"><small class="kicker">${esc(system.name)} · ${esc(room.label)} · ${esc(capability.id)}</small><h2>${esc(capability.label)}</h2><p>${esc(capability.summary)}</p><div class="meta-row">${consentChip(capability)}<span class="chip">${esc(capability.operation)}</span><span class="chip">source ${esc(capability.sourceStatus)}</span></div><div class="detail-grid">${detailItem('Cabinet surface',capability.visual.surface)}${detailItem('Lite route',capability.lite.route)}${detailItem('Handoffs',(Array.isArray(capability.handoffs)?capability.handoffs:[]).join(', ')||'none')}${detailItem('Rewards',(Array.isArray(capability.rewards)?capability.rewards:[]).join(', ')||'none')}</div><footer class="detail-actions">${capability.lite.sourceRoute?`<button class="primary" type="button" data-source="${esc(capability.id)}">Open working tool in this cabinet</button>`:''}<a href="${esc(CommonweaveParity.cabinetUrl(state))}">Open Cabinet Mode</a></footer></section>${native}`;
}
function renderSource(system,capability){
  return `<section class="source-workspace"><header class="source-toolbar"><div><b>${esc(capability.label)}</b><small>Existing working surface · themed for ${esc(system.name)}</small></div><div><a href="${esc(capability.lite.sourceRoute)}" target="_blank" rel="noopener">Pop out</a> <button type="button" data-close-source>Return</button></div></header><iframe class="source-frame" title="${esc(capability.label)} working tool" src="${esc(capability.lite.sourceRoute)}"></iframe></section>`;
}
function render(){
  const resolved=CommonweaveParity.resolve(ledger,state);state={systemId:resolved.system.id,roomId:resolved.room.id,capabilityId:resolved.capability?.id||''};
  applyShell(resolved.system);renderCabinetControls(resolved.system);renderRooms(resolved.system,resolved.room);
  $('#cabinet-link').href=CommonweaveParity.cabinetUrl(state);
  const caps=roomCapabilities(resolved.system,resolved.room);
  $('#screen-status').innerHTML=`<span><b>${esc(resolved.room.label)}</b> · ${caps.length} capabilities</span><span>Cabinet Mode ↔ Lite parity</span>`;
  const main=$('#lite-main');
  if(workspace){main.innerHTML=renderSource(resolved.system,workspace)}
  else if(resolved.capability)main.innerHTML=renderDetail(resolved.system,resolved.room,resolved.capability);
  else main.innerHTML=renderRoom(resolved.system,resolved.room,caps);
  main.scrollTop=0;main.focus({preventScroll:true});
}
function openSource(id){const capability=ledger.index.capabilities.get(id);if(!capability?.lite?.sourceRoute)return toast('No working source route is recorded yet.');workspace=capability;render();report('source-opened',{capability:id,route:capability.lite.sourceRoute})}
function buildWeave(w){
  const wish=w.wish.trim();const outcome=w.clarification?.outcome?.trim();const context=w.clarification?.context?.trim();const constraints=w.clarification?.constraints?.trim();const posture=w.skill?.posture||'practice';
  const target=outcome||wish;const learnMode=posture==='learn'?'Teach the foundations before execution':posture==='known'?'Use concise references and focus on verification':'Teach concepts at the moment they are needed';
  return {learning:`${learnMode}. Build a curriculum for: ${target}. Include safety, concepts, practice, and a knowledge check.`,quest:`Create a staged quest that produces a visible, verifiable result for: ${target}. Break it into dependencies and proof checkpoints.`,materials:`Identify tools, materials, people, spaces, and exchange options needed for: ${target}. Include quantities, alternatives, and logistics.`,governance:`Record the intention “${wish}”. Context: ${context||'not yet specified'}. Constraints and consent boundaries: ${constraints||'none recorded yet'}.`,createdAt:new Date().toISOString()};
}
function jumpToCapability(id){const c=ledger.index.capabilities.get(id);if(!c)return;setRoute({systemId:c.system,roomId:c.room,capabilityId:c.id})}
document.addEventListener('click',event=>{
  const control=event.target.closest('[data-system],[data-room],[data-capability],[data-source],[data-back-room],[data-close-source],[data-jump-capability]');if(!control)return;
  if(control.dataset.system){const system=systemFor(control.dataset.system);setRoute({systemId:system.id,roomId:system.rooms[0].id,capabilityId:''});return}
  if(control.dataset.room){setRoute({roomId:control.dataset.room,capabilityId:''});return}
  if(control.dataset.capability){setRoute({capabilityId:control.dataset.capability});return}
  if(control.dataset.source){openSource(control.dataset.source);return}
  if(control.dataset.jumpCapability){jumpToCapability(control.dataset.jumpCapability);return}
  if(control.hasAttribute('data-back-room')){setRoute({capabilityId:''});return}
  if(control.hasAttribute('data-close-source')){workspace=null;render()}
});
document.addEventListener('submit',event=>{
  const form=event.target.closest('[data-native-form]');if(!form)return;event.preventDefault();const data=new FormData(form);let w=readWorkflow();
  switch(form.dataset.nativeForm){
    case 'model':{const next={route:data.get('route'),model:String(data.get('model')||'').trim()||'Weaveling local planner',endpoint:String(data.get('endpoint')||'').trim(),consent:data.get('consent')==='on'};localStorage.setItem(SETTINGS_KEY,JSON.stringify(next));toast('Model setup saved for every guide.');report('model-saved',{route:next.route,hasEndpoint:Boolean(next.endpoint),consent:next.consent});break}
    case 'wish':w=workflowPatch({wish:String(data.get('wish')||'').trim(),weave:null,activatedAt:null});toast('Wish held locally. Clarification is next.');break;
    case 'clarify':w=workflowPatch({clarification:{outcome:String(data.get('outcome')||'').trim(),context:String(data.get('context')||'').trim(),constraints:String(data.get('constraints')||'').trim()},weave:null,activatedAt:null});toast('Clarification saved.');break;
    case 'skill':w=workflowPatch({skill:{posture:String(data.get('posture')||'practice'),level:Number(data.get('level')||0)},weave:null,activatedAt:null});toast('Skill posture saved.');break;
    case 'generate':w=workflowPatch({weave:buildWeave(w),activatedAt:null});toast('Three-path weave drafted for review.');render();break;
    case 'review':{const weave={learning:String(data.get('learning')||'').trim(),quest:String(data.get('quest')||'').trim(),materials:String(data.get('materials')||'').trim(),governance:String(data.get('governance')||'').trim(),createdAt:w.weave?.createdAt||new Date().toISOString(),reviewedAt:new Date().toISOString()};w=workflowPatch({weave,activatedAt:null});toast('Reviewed weave saved.');break}
    case 'activate':if(data.get('confirm')!=='on')return toast('Confirm the handoffs before activation.');w=workflowPatch({activatedAt:new Date().toISOString()});toast('Weave activated. The next useful room is Living School.');break;
    case 'passport':if(data.get('confirm')!=='on')return toast('Choose whether to seal this record.');w=workflowPatch({passport:{wish:w.wish,pledge:String(data.get('pledge')||'').trim(),sealedAt:new Date().toISOString()}});toast('Intention sealed in the local Passport record.');break;
    default:return;
  }
  render();
});
$('#lite-settings').addEventListener('click',()=>jumpToCapability('commonweave.model-setup'));
addEventListener('popstate',()=>{workspace=null;state=CommonweaveParity.routeState();render()});
async function mount(){try{ledger=await CommonweaveParity.load();state=CommonweaveParity.routeState();render();report('mounted',{systems:ledger.systems.length,capabilities:ledger.capabilities.length})}catch(error){$('#lite-main').innerHTML=`<div class="empty-state"><h2>Parity ledger could not load</h2><p>${esc(error.message)}</p></div>`}}
mount();
