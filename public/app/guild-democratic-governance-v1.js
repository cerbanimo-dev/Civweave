(()=>{
'use strict';
const ID='cw-guild-democratic-council-v1',VERSION='1.3.0-identity-removal-appeals';
if(globalThis.CivweaveGuildGovernanceV1)return;
const clean=(value,max=500)=>String(value??'').trim().slice(0,max);
const esc=value=>clean(value,2000).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let root=null,packet=null,busy=false,notice='',lastCount=null;
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
  root.innerHTML='<div class="gc-shell"><header><div><h2 id="gc-title">Guild Council</h2><p>Contributors propose actions. An eligible majority approves them, and a passing vote triggers the action automatically.</p></div><button type="button" data-gc-close>Close</button></header><p data-gc-message role="status" aria-live="polite"></p><div data-gc-summary></div><div data-gc-notices></div><div data-gc-appeals></div><div data-gc-form-area></div><div data-gc-cases></div><div data-gc-work></div><div data-gc-ballots></div><div data-gc-nearby></div></div>';
  root.addEventListener('click',event=>{
    if(event.target.closest('[data-gc-close]')){root.hidden=true;return}
    const vote=event.target.closest('[data-gc-vote]');if(vote)void cast(vote.dataset.gcVote,vote.dataset.ballotId);
    if(event.target.closest('[data-gc-refresh]'))void refresh();
    const ack=event.target.closest('[data-gc-ack-notice]');if(ack)void acknowledgeNotice(ack.dataset.kind,ack.dataset.refId);
    const sponsor=event.target.closest('[data-gc-sponsor-appeal]');if(sponsor)void sponsorAppeal(sponsor.dataset.gcSponsorAppeal);
    const restore=event.target.closest('[data-gc-sponsor-removal]');if(restore)void sponsorRemovalAppeal(restore.dataset.gcSponsorRemoval);
    const start=event.target.closest('[data-gc-start-ballot]');if(start)void startBallot(start.dataset.gcStartBallot);
    const review=event.target.closest('[data-gc-review-work]');if(review)void reviewWork(review.dataset.gcReviewWork,review.dataset.proofId);
  });
  root.addEventListener('submit',event=>{
    if(event.target.matches('[data-gc-form]')){event.preventDefault();void propose(event.target)}
    if(event.target.matches('[data-gc-case-response]')){event.preventDefault();void respondCase(event.target)}
    if(event.target.matches('[data-gc-work-form]')){event.preventDefault();void submitWork(event.target)}
    if(event.target.matches('[data-gc-appeal-form]')){event.preventDefault();void submitAppeal(event.target)}
  });
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
  const notices=packet.notices||[],appeals=packet.appeals||[],removalAppeals=packet.removalAppeals||[];
  root.querySelector('[data-gc-notices]').innerHTML='<h3>My Council notices · '+Number(packet.unreadNoticeCount||0)+' unread</h3>'+
    '<p>Notices are available when you open the Guild Council. Acknowledging a notice records that you viewed it; it never casts a vote or waives your rights. No push delivery is claimed.</p>'+
    (notices.length?notices.map(n=>'<article class="gc-item"><strong>'+esc(n.label)+'</strong><p class="gc-muted">'+esc(n.createdAt)+' · '+(n.readAt?'Acknowledged '+esc(n.readAt):'Not yet acknowledged')+'</p>'+
      (!n.readAt?'<button type="button" data-gc-ack-notice data-kind="'+esc(n.kind)+'" data-ref-id="'+esc(n.refId)+'">Acknowledge notice</button>':'')+'</article>').join(''):'<p>No Council notices for this member.</p>');
  root.querySelector('[data-gc-appeals]').innerHTML='<h3>Ban appeals</h3><p>A banned resident can appeal using their original device credential even after Guild access ends. Eligible Guild contributors may open a democratic reconsideration vote. Filing an appeal does not automatically revoke a sanction.</p>'+
    (appeals.length?appeals.map(a=>'<article class="gc-item"><strong>Ban appeal · '+esc(a.status)+'</strong><p>Member '+esc(a.targetUserId)+' · '+esc(a.statement)+'</p><p class="gc-muted">Original sanction: '+esc(a.banBallotId)+'</p>'+
      (packet.actorEligible&&a.status==='pending'?'<button type="button" data-gc-sponsor-appeal="'+esc(a.id)+'">Open majority reconsideration vote</button>':'')+
      (a.ballotId?'<p>Reconsideration vote: '+esc(a.ballotId)+'</p>':'')+'</article>').join(''):'<p>No ban appeals filed.</p>')+
    '<h3>Removal appeals</h3><p>A majority may restore an approved removed member when a Citizen seat is available. This never creates a login session or bypasses capacity.</p>'+
    (removalAppeals.length?removalAppeals.map(a=>'<article class="gc-item"><strong>Removal appeal · '+esc(a.status)+'</strong><p>Member '+esc(a.targetUserId)+' · '+esc(a.statement)+'</p>'+
      (packet.actorEligible&&a.status==='pending'?'<button type="button" data-gc-sponsor-removal="'+esc(a.id)+'">Open membership restoration vote</button>':'')+
      (a.ballotId?'<p>Decision: '+esc(a.ballotId)+'</p>':'')+'</article>').join(''):'<p>No removal appeals filed.</p>');
  root.querySelector('[data-gc-summary]').innerHTML='<p><strong>'+Number(packet.activeCount||0)+' active Guild voters</strong> · '+Number(packet.majority||1)+' affirmative votes required · your delegated role: '+esc(packet.actorRole||'member')+'</p><p class="gc-muted">All enrolled members active within 30 days may vote, including a targeted member. Only residents with independently accepted completed work or a verified physical-node check-in within 30 days may propose. Neuron consumption or mere login does not qualify anyone to propose. Voting expires after seven days.</p>';
  if(packet.actorEligible){
    const banned=(packet.bans||[]).filter(row=>!members.some(member=>member.userId===row.userId));
    const options=members.map(member=>'<option value="'+esc(member.userId)+'">'+esc(member.userId)+(member.role==='guildkeeper'?' · Guildkeeper':'')+'</option>').join('')+
      banned.map(row=>'<option value="'+esc(row.userId)+'">'+esc(row.userId)+' · currently banned</option>').join('');
    const reasons=['harassment','threats','fraud','impersonation','safety','repeated-disruption','other'].map(code=>'<option value="'+code+'">'+code.replaceAll('-',' ')+'</option>').join('');
    root.querySelector('[data-gc-form-area]').innerHTML='<h3>Propose a decision</h3><form data-gc-form><label>Action<select name="kind"><option value="transfer-role">Transfer delegated Guildkeeper role</option><option value="remove">Remove member</option><option value="ban">Ban member for 90 days</option><option value="lift-ban">Lift an existing ban</option><option value="report">Report to neighbouring Guilds</option></select></label><label>Member<select required name="targetUserId">'+options+'</select></label><label>Role after a transfer<select name="role"><option value="guildkeeper">Guildkeeper</option><option value="member">Member</option></select></label><label>Reason for a nearby report<select name="reasonCode">'+reasons+'</select></label><label>Why should the Guild consider this action?<textarea name="statement" minlength="20" maxlength="1000" required placeholder="Explain the circumstances fairly, and distinguish observations from assumptions."></textarea></label><p>Sanctions and reports first open a 24-hour notice for the member to respond. The later ballot casts your yes vote. No Guildkeeper can skip the majority.</p><button type="submit">Submit proposal and my vote</button></form>';
  }else root.querySelector('[data-gc-form-area]').innerHTML='<h3>Propose a decision</h3><p>Only Guild members with a recent verified contribution may open proposals. Complete independently reviewed Quest work or a verified physical-node check-in to become eligible.</p>';
  const identity=session()?.userId||'',cases=packet.cases||[],workProofs=packet.workProofs||[];
  root.querySelector('[data-gc-cases]').innerHTML='<h3>Member cases and right to respond</h3><p>Every removal, ban or nearby report begins with a private Guild notice. Voting can start after 24 hours; the targeted member can supply a response for voters to consider.</p>'+
    (cases.length?cases.map(c=>{
      const ready=Date.now()>=Date.parse(c.noticeUntil);
      const canOpen=packet.actorEligible&&!c.ballotId&&ready;
      const response=c.targetUserId===identity&&(!c.ballotId||ballots.some(b=>b.id===c.ballotId&&b.status==='open'))?'<form data-gc-case-response data-case-id="'+esc(c.id)+'"><label>Your response<textarea name="response" minlength="20" maxlength="2000" required placeholder="Give your account of the circumstances."></textarea></label><button type="submit">Submit my response</button></form>':'';
      return '<article class="gc-item"><strong>'+esc(c.action)+' · '+esc(c.targetUserId)+'</strong><p>'+esc(c.statement)+'</p><p>Opened: '+esc(c.createdAt)+' · response period until '+esc(c.noticeUntil)+'</p>'+(c.response?'<p><strong>Member response:</strong> '+esc(c.response)+'</p>':'<p class="gc-muted">No response recorded yet.</p>')+response+
        (canOpen?'<button type="button" data-gc-start-ballot="'+esc(c.id)+'">Start majority ballot</button>':'')+
        (c.ballotId?'<p>Ballot opened · '+esc(c.ballotId)+'</p>':!ready?'<p class="gc-muted">Waiting for the response period to finish.</p>':'')+'</article>';
    }).join(''):'<p>No active disciplinary cases.</p>');
  root.querySelector('[data-gc-work]').innerHTML='<h3>Completed-work verification</h3><p>Publishing a Quest alone does not earn governance proposal eligibility. Submit a real published Guild Quest for independent review. One reviewer is required in a two-member Guild; two independent reviewers in larger Guilds. A one-member Guild cannot self-award work credit.</p>'+
    '<form data-gc-work-form><label>Published Guild Quest ID<input name="questId" required placeholder="guild-quest:..." maxlength="76"></label><label>Work completion summary<textarea name="statement" required minlength="20" maxlength="1000" placeholder="What was actually completed? Provide verifiable details for your peers."></textarea></label><button type="submit">Submit work for peer review</button></form>'+
    (workProofs.length?workProofs.map(p=>{
      const approve=p.status==='pending'&&p.authorId!==identity;
      return '<article class="gc-item"><strong>'+esc(p.authorId)+' · '+esc(p.status)+'</strong><p>'+esc(p.statement)+'</p><p class="gc-muted">Quest: '+esc(p.questId)+' · independent approvals required: '+Number(p.requiredApprovals)+'</p>'+
        (approve?'<div class="gc-actions"><button type="button" data-gc-review-work="accept" data-proof-id="'+esc(p.id)+'">Verify completed work</button><button type="button" data-gc-review-work="reject" data-proof-id="'+esc(p.id)+'">Reject claim</button></div>':'')+'</article>';
    }).join(''):'<p>No completed-work claims yet.</p>');
  root.querySelector('[data-gc-ballots]').innerHTML='<h3>Open and recent votes</h3>'+(ballots.length?ballots.map(b=>{
    const actions=b.status==='open'&&eligible.includes(session()?.userId)?'<div class="gc-actions"><button type="button" data-gc-vote="yes" data-ballot-id="'+esc(b.id)+'">Vote yes</button><button type="button" data-gc-vote="no" data-ballot-id="'+esc(b.id)+'">Vote no</button></div>':'';
    return '<article class="gc-item"><strong>'+esc(b.action)+' · '+esc(b.targetUserId)+'</strong><p>Proposal: '+esc(b.statement||'No rationale provided')+'</p><p>Status: '+esc(b.displayedStatus||b.status)+' · '+Number(b.yes||0)+' yes / '+Number(b.no||0)+' no · majority '+Number(b.requiredYes||1)+' · closes '+esc(b.expiresAt)+'</p>'+(b.status==='approved'?'<p class="gc-done">Approved: action automatically applied.</p>':'')+actions+'</article>';
  }).join(''):'<p>No votes have been opened yet.</p>')+'<p><button type="button" data-gc-refresh>Refresh Guild Council</button></p>';
  root.querySelector('[data-gc-nearby]').innerHTML='<h3>Nearby Guild reports</h3><p>Approved reports are sent to registered Guilds within 25 km. Reports carry only a reason category and a pseudonymous reference; a receiving Guild must investigate independently before taking action.</p><p>Awaiting relay: '+Number(packet.reportQueuedCount||0)+'</p>'+(packet.outboundReports||[]).map(row=>'<p class="gc-muted">Approved report '+esc(row.ballotId)+' · '+esc(row.state)+(row.state==='delivered'?' · '+Number(row.recipients||0)+' nearby Guild recipients':' · retry pending')+'</p>').join('')+
    (packet.nearbyReports||[]).map(row=>'<article class="gc-item"><strong>'+esc(row.receipt?.reasonCode||'unspecified')+'</strong><p>Reporting Guild: '+esc(row.sourceGuildId)+' · '+esc(row.receivedAt)+' · unverified community allegation</p></article>').join('');
}
function broadcastNoticeCount(value){
  const count=Math.max(0,Math.floor(Number(value)||0));
  if(lastCount===count)return;
  lastCount=count;
  dispatchEvent(new CustomEvent('civweave:guild-council-notices',{detail:{unreadCount:count}}));
}
async function refreshNoticeCount(){
  if(busy)return;
  try{const active=session();if(!active){broadcastNoticeCount(0);return}
    const status=await request();broadcastNoticeCount(status.unreadNoticeCount);
  }catch{broadcastNoticeCount(0)}
}
async function refresh(){
  if(busy)return;busy=true;
  try{
    packet=await request();
    try{const member=session();if(member)await globalThis.CivweaveHostNodeSessionV1?.status?.(member.nodeId)}catch{}
    try{const nearby=await request('GET',null,'/nearby');packet.nearbyReports=nearby.reports||[]}catch{packet.nearbyReports=[]}
    render();broadcastNoticeCount(packet.unreadNoticeCount||0);say('Council records synchronized.');
  }catch(error){showAppealFallback();say('Guild Council unavailable: '+clean(error.message)+'. A previously banned member can still file an appeal below.')}
  finally{busy=false}
}
async function propose(form){
  if(busy)return;busy=true;
  const data=new FormData(form);
  const input={action:'propose',kind:clean(data.get('kind'),30),targetUserId:clean(data.get('targetUserId'),180),
    role:clean(data.get('role'),30),reasonCode:clean(data.get('reasonCode'),50),statement:clean(data.get('statement'),1000)};
  if(['remove','ban','report'].includes(input.kind))input.action='open-case';
  try{const result=await request('POST',input);say(result.case?'Case opened. Voting begins after 24 hours of notice and the right to respond.':result.ballot?.status==='approved'?'Majority reached; the action executed automatically.':'Proposal recorded and your yes vote cast.')}
  catch(error){say('Proposal rejected: '+clean(error.message))}
  finally{busy=false;void refresh()}
}
async function startBallot(caseId){
  if(busy)return;
  const existing=(packet?.cases||[]).find(c=>c.id===caseId);if(!existing)return say('This case is no longer available.');
  busy=true;
  try{
    const result=await request('POST',{action:'propose',kind:existing.action,targetUserId:existing.targetUserId,
      reasonCode:existing.reasonCode,statement:existing.statement,caseId});
    say(result.ballot?.status==='approved'?'Majority reached; the action executed automatically.':'The response window has closed. Majority ballot opened.');
  }catch(error){say('Unable to start vote: '+clean(error.message))}
  finally{busy=false;void refresh()}
}
async function respondCase(form){
  if(busy)return;busy=true;
  try{await request('POST',{action:'respond-case',caseId:form.dataset.caseId,response:new FormData(form).get('response')});
    say('Your response was recorded for Guild members to review.');
  }catch(error){say('Unable to submit response: '+clean(error.message))}
  finally{busy=false;void refresh()}
}
async function submitWork(form){
  if(busy)return;busy=true;const values=new FormData(form);
  try{await request('POST',{action:'submit-work',questId:clean(values.get('questId'),90),statement:clean(values.get('statement'),1000)});
    say('Work completion submitted. Independent Guild reviewers must verify it.');
  }catch(error){say('Work submission rejected: '+clean(error.message))}
  finally{busy=false;void refresh()}
}
async function reviewWork(decision,proofId){
  if(busy)return;busy=true;
  try{const result=await request('POST',{action:'review-work',proofId,decision});
    say(result.proof?.status==='accepted'?'Independent review quorum reached. Verified contribution recorded.':'Your review is recorded.');
  }catch(error){say('Review rejected: '+clean(error.message))}
  finally{busy=false;void refresh()}
}
async function sponsorRemovalAppeal(appealId){
  if(busy)return;busy=true;
  try{const result=await request('POST',{action:'sponsor-removal-appeal',appealId});
    say(result.ballot?.status==='approved'?'Majority restored this membership, subject to available Citizen capacity.':'Restoration ballot opened for the active Guild electorate.');
  }catch(error){say('Restoration sponsorship failed: '+clean(error.message))}
  finally{busy=false;void refresh()}
}
async function acknowledgeNotice(kind,refId){
  if(busy)return;busy=true;
  try{await request('POST',{action:'ack-notice',kind,refId});say('Notice acknowledged. Voting and appeal rights are unchanged.')}
  catch(error){say('Acknowledgment failed: '+clean(error.message))}
  finally{busy=false;void refresh()}
}
async function sponsorAppeal(appealId){
  if(busy)return;busy=true;
  try{const result=await request('POST',{action:'sponsor-appeal',appealId});
    say(result.ballot?.status==='approved'?'Majority reached: the ban was automatically lifted.':'Reconsideration ballot opened for member votes.')}
  catch(error){say('Appeal sponsorship failed: '+clean(error.message))}
  finally{busy=false;void refresh()}
}
function savedAppealIdentity(){
  const api=globalThis.CivweaveHostNodeSessionV1,origin=api?.selectedOrigin?.();
  if(!origin)return null;
  let selected={},credentials={};
  try{
    selected=JSON.parse(localStorage.getItem(api.selectionKey)||'{}')||{};
    credentials=JSON.parse(localStorage.getItem(api.credentialKey)||'{}')||{};
  }catch{return null}
  const identity=credentials[origin+'#'+clean(selected.nodeId,180)]||credentials[origin];
  return identity?.userId&&identity?.credential?{...identity,origin,nodeId:clean(selected.nodeId,180)}:null;
}
function showAppealFallback(){
  if(!root)return;
  const area=root.querySelector('[data-gc-appeals]');
  if(!area)return;
  root.querySelector('[data-gc-summary]').innerHTML='';
  root.querySelector('[data-gc-notices]').innerHTML='';
  root.querySelector('[data-gc-form-area]').innerHTML='';
  root.querySelector('[data-gc-cases]').innerHTML='';
  root.querySelector('[data-gc-work]').innerHTML='';
  root.querySelector('[data-gc-ballots]').innerHTML='';
  root.querySelector('[data-gc-nearby]').innerHTML='';
  area.innerHTML='<h3>Appeal a Guild sanction</h3><p>A member removed or banned by Council can submit one credential-verified appeal from their original device. Appeal submission never automatically restores a seat or lifts a ban.</p>'+
    (savedAppealIdentity()?'<form data-gc-appeal-form><label>Decision to appeal<select name="kind"><option value="ban">90-day ban</option><option value="remove">Removal without ban</option></select></label><label>Your explanation<textarea name="statement" minlength="20" maxlength="2000" required placeholder="Explain why the community should reconsider this decision."></textarea></label><button type="submit">Submit a formal appeal</button></form>':'<p>Original Guild device credentials are unavailable. This browser cannot authenticate an appeal.</p>');
}
async function submitAppeal(form){
  if(busy)return;busy=true;
  try{
    const identity=savedAppealIdentity();
    if(!identity)throw Error('This device does not retain the original Guild credentials.');
    const url=new URL('/api/guild/governance/appeal',identity.origin);
    if(identity.nodeId)url.searchParams.set('nodeId',identity.nodeId);
    const response=await fetch(url,{method:'POST',cache:'no-store',headers:{'content-type':'application/json'},
      body:JSON.stringify({userId:identity.userId,credential:identity.credential,kind:new FormData(form).get('kind'),statement:new FormData(form).get('statement')})});
    const answer=await response.json().catch(()=>({}));
    if(!response.ok||answer.ok===false)throw Error(answer.error||'Appeal request failed.');
    form.reset();say('Appeal filed. An active Guild contributor can sponsor a reconsideration vote; filing alone does not revoke the ban.');
  }catch(error){say('Unable to file appeal: '+clean(error.message))}
  finally{busy=false}
}
async function cast(choice,ballotId){
  if(busy)return;busy=true;
  try{const result=await request('POST',{action:'vote',choice,ballotId});say(result.ballot?.status==='approved'?'Majority reached; the action executed automatically.':'Your vote is recorded.')}
  catch(error){say('Vote rejected: '+clean(error.message))}
  finally{busy=false;void refresh()}
}
async function open(){ensure().hidden=false;say('Checking your active Guild session…');await refresh();return true}
globalThis.CivweaveGuildGovernanceV1=Object.freeze({version:VERSION,open,refresh,refreshNoticeCount,unreadCount:()=>lastCount||0,close:()=>{if(root)root.hidden=true}});
addEventListener('civweave:host-node-selected',()=>void refreshNoticeCount());
addEventListener('civweave:host-node-logged-in',()=>void refreshNoticeCount());
addEventListener('civweave:capacity-session-ready',()=>void refreshNoticeCount());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refreshNoticeCount()});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>void refreshNoticeCount(),{once:true});
else void refreshNoticeCount();
})();