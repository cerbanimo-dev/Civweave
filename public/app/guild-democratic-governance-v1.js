(()=>{
'use strict';
const ID='cw-guild-democratic-council-v1',VERSION='1.0.0';
if(globalThis.CivweaveGuildGovernanceV1)return;
const clean=(value,max=500)=>String(value??'').trim().slice(0,max);
const esc=value=>clean(value,2000).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let root=null,packet=null,busy=false,notice='';
function session(){
  const api=globalThis.CivweaveHostNodeSessionV1,origin=api?.selectedOrigin?.()||'';
  let saved={};try{saved=JSON.parse(localStorage.getItem('civweave.host-node.selection.v1')||'{}')||{}}catch{}
  const row=api?.sessionFor?.(saved.nodeId||origin);
  return row?.origin===origin&&(!saved.nodeId||saved.nodeId===row.nodeId)?row:null;
}
function ensure(){
  if(root?.isConnected)return root;
  const style=document.createElement('style');style.id=ID+'-style';
  style.textContent='#'+ID+'[hidden],#'+ID+' [hidden]{display:none!important}#'+ID+'{position:fixed;inset:0;z-index:2147482300;background:#030b13df;display:grid;place-items:center;padding:12px;color:#effff7}#'+ID+' .gc-shell{width:min(760px,100%);max-height:calc(100dvh - 24px);overflow:auto;background:linear-gradient(145deg,#123137,#101a2d);padding:18px;border:1px solid #73cbb95e;border-radius:18px}#'+ID+' header{display:flex;justify-content:space-between;align-items:start;gap:10px}#'+ID+' h2{margin:0;font-size:1.3rem}#'+ID+' h3{margin:18px 0 7px;font-size:1rem}#'+ID+' p{font:.83rem/1.5 system-ui;color:#cce5df}#'+ID+' label{display:block;font:.82rem/1.5 system-ui;margin:10px 0}#'+ID+' input,#'+ID+' select,#'+ID+' textarea{display:block;width:100%;margin-top:5px;padding:9px;background:#081d27;color:white;border:1px solid #80cfb75b;border-radius:8px;min-height:42px}#'+ID+' button{min-height:40px;padding:8px 12px;background:#164b49;color:#effff6;border:1px solid #76d8ae;border-radius:9px;cursor:pointer}#'+ID+' button:disabled{opacity:.5}#'+ID+' .gc-actions{display:flex;flex-wrap:wrap;gap:8px}#'+ID+' .gc-item{padding:12px;margin-top:10px;border:1px solid #80cdb23b;border-radius:11px;background:#081d26}#'+ID+' .gc-muted{color:#afcbc6}#'+ID+' .gc-done{color:#aeffcc;font-weight:800}';
  document.head.append(style);
  root=document.createElement('aside');root.id=ID;root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','gc-title');
  root.innerHTML='<div class="gc-shell"><header><div><h2 id="gc-title">Guild Council</h2><p>Contributors propose actions. An eligible majority approves them, and a passing vote triggers the action automatically.</p></div><button type="button" data-gc-close>Close</button></header><p data-gc-message role="status" aria-live="polite"></p><div data-gc-summary></div><div data-gc-form-area></div><div data-gc-ballots></div><div data-gc-nearby></div></div>';
  root.addEventListener('click',event=>{
    if(event.target.closest('[data-gc-close]')){root.hidden=true;return}
    const vote=event.target.closest('[data-gc-vote]');if(vote)void cast(vote.dataset.gcVote,vote.dataset.ballotId);
    if(event.target.closest('[data-gc-refresh]'))void refresh();
  });
  root.addEventListener('submit',event=>{if(event.target.matches('[data-gc-form]')){event.preventDefault();void propose(event.target)}});
  document.body.append(root);return root;
}
function say(value){notice=clean(value);if(root)root.querySelector('[data-gc-message]').textContent=notice}
async function request(method='GET',body=null,part=''){
  const active=session();if(!active)throw new Error('Log in to your selected Guild before using Council.');
  const url=new URL('/api/guild/governance'+part,active.origin);url.searchParams.set('nodeId',active.nodeId);
  const result=await fetch(url,{method,cache:'no-store',headers:{authorization:'Bearer '+active.token,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  const packet=await result.json().catch(()=>({}));
  if(!result.ok||packet.ok===false)throw new Error(packet.error||'Guild governance request failed.');
  return packet;
}
function render(){
  if(!packet)return;
  const eligible=packet.eligible||[],members=packet.members||[],ballots=packet.ballots||[];
  root.querySelector('[data-gc-summary]').innerHTML='<p><strong>'+Number(packet.activeCount||0)+' active contributors</strong> · '+Number(packet.majority||1)+' affirmative votes required · your delegated role: '+esc(packet.actorRole||'member')+'</p><p class="gc-muted">Verified Quest publication or physical-node contribution during the previous 30 days makes a member eligible. Neuron consumption and mere logins do not. All eligible members including the target may vote. Voting expires after seven days.</p>';
  if(packet.actorEligible){
    const options=members.map(member=>'<option value="'+esc(member.userId)+'">'+esc(member.userId)+(member.role==='guildkeeper'?' · Guildkeeper':'')+'</option>').join('');
    const reasons=['harassment','threats','fraud','impersonation','safety','repeated-disruption','other'].map(code=>'<option value="'+code+'">'+code.replaceAll('-',' ')+'</option>').join('');
    root.querySelector('[data-gc-form-area]').innerHTML='<h3>Propose a decision</h3><form data-gc-form><label>Action<select name="kind"><option value="transfer-role">Transfer delegated Guildkeeper role</option><option value="remove">Remove member</option><option value="ban">Ban member for 90 days</option><option value="report">Report to neighbouring Guilds</option></select></label><label>Member<select required name="targetUserId">'+options+'</select></label><label>Role after a transfer<select name="role"><option value="guildkeeper">Guildkeeper</option><option value="member">Member</option></select></label><label>Reason for a nearby report<select name="reasonCode">'+reasons+'</select></label><label>Why should the Guild consider this action?<textarea name="statement" minlength="20" maxlength="1000" required placeholder="Explain the circumstances fairly, and distinguish observations from assumptions."></textarea></label><p>Creating the proposal records your yes vote. No Guildkeeper can skip the majority requirement.</p><button type="submit">Submit proposal and my vote</button></form>';
  }else root.querySelector('[data-gc-form-area]').innerHTML='<h3>Propose a decision</h3><p>Only Guild members with a recent verified contribution may open proposals. Publish a Guild Quest or complete a verified physical-node check-in to become eligible.</p>';
  root.querySelector('[data-gc-ballots]').innerHTML='<h3>Open and recent votes</h3>'+(ballots.length?ballots.map(b=>{
    const actions=b.status==='open'&&eligible.includes(session()?.userId)?'<div class="gc-actions"><button type="button" data-gc-vote="yes" data-ballot-id="'+esc(b.id)+'">Vote yes</button><button type="button" data-gc-vote="no" data-ballot-id="'+esc(b.id)+'">Vote no</button></div>':'';
    return '<article class="gc-item"><strong>'+esc(b.action)+' · '+esc(b.targetUserId)+'</strong><p>Proposal: '+esc(b.statement||'No rationale provided')+'</p><p>Status: '+esc(b.displayedStatus||b.status)+' · '+Number(b.yes||0)+' yes / '+Number(b.no||0)+' no · majority '+Number(b.requiredYes||1)+' · closes '+esc(b.expiresAt)+'</p>'+(b.status==='approved'?'<p class="gc-done">Approved: action automatically applied.</p>':'')+actions+'</article>';
  }).join(''):'<p>No votes have been opened yet.</p>')+'<p><button type="button" data-gc-refresh>Refresh Guild Council</button></p>';
  root.querySelector('[data-gc-nearby]').innerHTML='<h3>Nearby Guild reports</h3><p>Approved reports are sent to registered Guilds within 25 km. Reports carry only a reason category and a pseudonymous reference; a receiving Guild must investigate independently before taking action.</p><p>Awaiting relay: '+Number(packet.reportQueuedCount||0)+'</p>'+
    (packet.nearbyReports||[]).map(row=>'<article class="gc-item"><strong>'+esc(row.receipt?.reasonCode||'unspecified')+'</strong><p>Reporting Guild: '+esc(row.sourceGuildId)+' · '+esc(row.receivedAt)+' · unverified community allegation</p></article>').join('');
}
async function refresh(){
  if(busy)return;busy=true;
  try{
    packet=await request();
    try{const member=session();if(member)await globalThis.CivweaveHostNodeSessionV1?.status?.(member.nodeId)}catch{}
    try{const nearby=await request('GET',null,'/nearby');packet.nearbyReports=nearby.reports||[]}catch{packet.nearbyReports=[]}
    render();say('Council records synchronized.');
  }catch(error){say('Guild Council unavailable: '+clean(error.message))}
  finally{busy=false}
}
async function propose(form){
  if(busy)return;busy=true;
  const data=new FormData(form);
  const input={action:'propose',kind:clean(data.get('kind'),30),targetUserId:clean(data.get('targetUserId'),180),
    role:clean(data.get('role'),30),reasonCode:clean(data.get('reasonCode'),50),statement:clean(data.get('statement'),1000)};
  try{const result=await request('POST',input);say(result.ballot?.status==='approved'?'Majority reached; the action executed automatically.':'Proposal recorded and your yes vote cast.')}
  catch(error){say('Proposal rejected: '+clean(error.message))}
  finally{busy=false;void refresh()}
}
async function cast(choice,ballotId){
  if(busy)return;busy=true;
  try{const result=await request('POST',{action:'vote',choice,ballotId});say(result.ballot?.status==='approved'?'Majority reached; the action executed automatically.':'Your vote is recorded.')}
  catch(error){say('Vote rejected: '+clean(error.message))}
  finally{busy=false;void refresh()}
}
async function open(){ensure().hidden=false;say('Checking your active Guild session…');await refresh();return true}
globalThis.CivweaveGuildGovernanceV1=Object.freeze({version:VERSION,open,refresh,close:()=>{if(root)root.hidden=true}});
})();