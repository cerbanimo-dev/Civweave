(()=>{
'use strict';
const VERSION='civweave.guild-owner-management.v1',STATE_KEY='civweave.mobile-guild.v1',ID='cw-guild-management-v1',STYLE='cw-guild-management-style-v1';
const clean=(value,max=2000)=>String(value??'').slice(0,max);
const esc=value=>clean(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state=()=>{try{return JSON.parse(localStorage.getItem(STATE_KEY)||'null')}catch{return null}};
const owner=()=>{const v=state();return v?.cloudAttached&&v?.primaryOrigin&&/^[A-Za-z0-9_-]{40,200}$/.test(v.ownerKey||'')?v:null};
function ownedGuild(){
  const v=owner();if(!v)return null;
  try{return Object.freeze({origin:new URL(v.primaryOrigin).origin,guildId:String(v.guildId||'').slice(0,180),
    displayName:String(v.displayName||'').slice(0,160)})}catch{return null}
}
function delegatedGuildkeeper(){
  const api=globalThis.CivweaveHostNodeSessionV1,origin=api?.selectedOrigin?.();
  const session=api?.sessionFor?.(origin);
  return session?.origin===origin&&session.seatClass==='guildkeeper'?session:null;
}
function managementAuth(){
  const founder=owner();
  if(founder)return {origin:founder.primaryOrigin,token:founder.ownerKey,founder:true};
  const member=delegatedGuildkeeper();
  return member?{origin:member.origin,token:member.token,founder:false}:null;
}
function ownerAvailableFor(origin){
  if(!origin)return false;
  const founder=owner(),delegate=delegatedGuildkeeper();
  try{return Boolean(founder&&new URL(founder.primaryOrigin).origin===new URL(origin).origin||
    delegate&&new URL(delegate.origin).origin===new URL(origin).origin)}catch{return false}
}
let root=null,packet=null,busy=false;
function installStyle(){
  if(document.getElementById(STYLE))return;
  const e=document.createElement('style');e.id=STYLE;e.textContent=`
#${ID}[hidden]{display:none!important}#${ID}{position:fixed;inset:0;z-index:2147483646;background:#020710da;display:grid;place-items:center;padding:12px;overflow:auto}
#${ID} .gm-shell{width:min(830px,100%);max-height:calc(100dvh - 24px);overflow:auto;background:linear-gradient(145deg,#0c2430,#0d1428);border:1px solid #74dabe66;border-radius:22px;box-shadow:0 24px 100px #000a;color:#f1fff9;font:15px/1.5 system-ui,sans-serif}
#${ID} .gm-head{padding:18px 22px;display:flex;align-items:center;justify-content:space-between;gap:16px;position:sticky;top:0;background:#0c2330;z-index:2;border-bottom:1px solid #ffffff20}
#${ID} h2,#${ID} h3{margin:0 0 8px}#${ID} h2{font-size:1.3rem}#${ID} p{margin:6px 0 12px}#${ID} .gm-body{padding:18px 22px;display:grid;gap:18px}#${ID} section{border:1px solid #ffffff24;border-radius:16px;padding:16px;background:#071927a6}
#${ID} .gm-small{color:#b4d5d0;font-size:.86rem}#${ID} .gm-info{color:#9fe4d6}#${ID} .gm-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px;margin:14px 0}
#${ID} .gm-slot{min-height:74px;border-radius:13px;display:grid;place-items:center;background:#145646;border:1px solid #7bf9bd88;font-weight:700}#${ID} .gm-slot[data-locked="true"]{background:#343c4b;color:#b1b9c6;border-color:#8793a544}
#${ID} .gm-milestones{margin:8px 0;padding-left:22px}#${ID} .gm-milestones li{padding:4px}#${ID} .gm-milestones li[data-done="true"]{color:#a4efb9}
#${ID} .gm-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:10px}#${ID} button{min-height:44px;padding:8px 12px;border:1px solid #78dfc277;border-radius:10px;background:#183c46;color:#f7fffe;cursor:pointer;font:600 .88rem system-ui}#${ID} button:disabled{opacity:.5;cursor:not-allowed}#${ID} button:focus-visible{outline:3px solid #f5d676}
#${ID} .gm-neuron-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0}
#${ID} .gm-neuron-stat{padding:10px;border:1px solid #79dbc754;border-radius:12px;background:#07352e66;min-width:0}
#${ID} .gm-neuron-stat strong{display:block;font-size:clamp(1.1rem,2.5vw,1.5rem);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
#${ID} .gm-neuron-meter{height:9px;background:#273d47;border-radius:9px;overflow:hidden;margin:10px 0}
#${ID} .gm-neuron-meter span{display:block;height:100%;width:var(--gm-neuron-pct,0%);background:#73daba}
#${ID} .gm-neuron-chart{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));align-items:end;gap:5px;min-height:116px;margin:12px 0 8px;padding:12px 6px 0;border-bottom:1px solid #708982}
#${ID} .gm-neuron-day{display:grid;grid-template-rows:1fr auto;min-width:0;text-align:center;height:116px;font-size:.72rem;color:#c6dcd7}
#${ID} .gm-neuron-bar-track{display:flex;align-items:end;justify-content:center;min-height:0}
#${ID} .gm-neuron-bar{height:var(--gm-neuron-height,3px);min-height:3px;width:min(30px,80%);border-radius:5px 5px 0 0;background:#71ceb2}
#${ID} .gm-neuron-lines{display:grid;gap:7px}
#${ID} .gm-neuron-line{display:flex;justify-content:space-between;gap:10px;align-items:center;border-bottom:1px solid #ffffff14;padding:4px 0}
#${ID} .gm-neuron-line span{overflow-wrap:anywhere;min-width:0}
#${ID} .gm-neuron-line strong{font-variant-numeric:tabular-nums;flex:0 0 auto}
#${ID} .gm-member{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid #ffffff15;overflow-wrap:anywhere}
#${ID} .gm-status{margin:0;min-height:1.5em;color:#ffe0a4}#${ID} .gm-reward{border:2px solid #f6e6a4;border-radius:14px;padding:14px;background:#2f3c2a;font-weight:800;animation:gm-pulse .7s ease-out}#${ID} .gm-reward[hidden]{display:none}
@keyframes gm-pulse{0%{transform:scale(.96);opacity:.3}100%{transform:scale(1);opacity:1}}
@media(max-width:560px){#${ID} .gm-neuron-stats{gap:4px}#${ID} .gm-neuron-stat{padding:7px}#${ID} .gm-head,#${ID} .gm-body{padding:13px}#${ID} .gm-grid{gap:4px}#${ID} .gm-slot{min-height:54px;font-size:.8rem}}
`;document.head.append(e);
}
function ensure(){
  if(root?.isConnected)return root;installStyle();
  root=document.createElement('aside');root.id=ID;root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Guild management');
  root.innerHTML=`<div class="gm-shell"><header class="gm-head"><div><h2>Guild Management</h2><div class="gm-small">Guildkeepers · Cloudflare + physical server</div></div><button type="button" data-gm-close aria-label="Close Guild Management">Close</button></header><div class="gm-body"><p class="gm-status" role="status" aria-live="polite"></p><div class="gm-reward" hidden aria-live="polite"></div><section data-gm-overview></section><section data-gm-neuron-flow aria-label="Guild neuron flow"></section><section data-gm-server></section><section data-gm-members></section><section data-gm-location></section><section data-gm-settings></section></div></div>`;
  root.addEventListener('click',event=>{
    if(event.target===root||event.target.closest?.('[data-gm-close]')){close();return}
    const action=event.target.closest?.('[data-gm-action]')?.dataset.gmAction;
    if(action)void perform(action,event.target.closest('[data-gm-action]'));
  });
  root.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close()}});
  document.body.append(root);return root;
}
function feedback(message){const node=root?.querySelector('.gm-status');if(node)node.textContent=message}
function address(endpoint){const v=managementAuth();if(!v)throw Error('This device has no authorized Guildkeeper session.');const base=new URL(v.origin);if(base.protocol!=='https:')throw Error('Guild Cloud must use HTTPS.');return new URL(endpoint,base.origin)}
async function request(method='GET',action='',extra={}){
  const v=managementAuth();if(!v)throw Error('Guild management requires a verified founder or delegated Guildkeeper credential.');
  const response=await fetch(address('/api/guild/manage'),{method,cache:'no-store',headers:{'authorization':'Bearer '+v.token,'content-type':'application/json'},...(method==='POST'?{body:JSON.stringify({action,...extra})}:{})});
  const body=await response.json().catch(()=>({}));if(!response.ok||body.ok===false)throw Error(body.error||'Guild Cloud returned HTTP '+response.status);return body;
}
const neurons=value=>Number.isSafeInteger(Number(value))&&Number(value)>=0?Number(value).toLocaleString():'—';
function renderNeuronFlow(flow){
  if(!flow||flow.schema!=='civweave.guild-neuron-flow.v1'){
    return '<h3>Neuron flow</h3><p class="gm-small">Guild Cloud usage is not available from this host yet. Refresh after its capacity service is updated.</p>';
  }
  const today=flow.today||{},history=Array.isArray(flow.history)?flow.history:[],nodes=Array.isArray(flow.nodes)?flow.nodes:[],residents=Array.isArray(flow.residents)?flow.residents:[];
  const pct=Math.max(0,Math.min(100,Number(today.utilizationPercent)||0)),peak=Math.max(1,...history.map(row=>Math.max(0,Number(row.chargedNeurons)||0)));
  const chart=history.map(row=>{
    const used=Math.max(0,Number(row.chargedNeurons)||0),height=used?Math.max(4,Math.round(100*used/peak)):3;
    return `<div class="gm-neuron-day" title="${esc(row.day)}: ${neurons(used)} neurons charged"><div class="gm-neuron-bar-track"><span class="gm-neuron-bar" style="--gm-neuron-height:${height}px"></span></div><time datetime="${esc(row.day)}">${esc(row.day.slice(5))}</time></div>`;
  }).join('');
  const nodeRows=nodes.map(row=>`<div class="gm-neuron-line"><span>${esc(row.nodeId)}</span><strong>${neurons(row.chargedNeuronsToday)}</strong></div>`).join('');
  const memberRows=residents.map(row=>`<div class="gm-neuron-line"><span>${esc(row.userId)} <small class="gm-small">(${esc(row.seatClass)})</small></span><strong>${neurons(row.chargedNeuronsToday)} / ${neurons(Number(row.chargedNeuronsToday||0)+Number(row.remainingNeuronsToday||0))}</strong></div>`).join('');
  return `<h3>Neuron flow</h3>
    <p class="gm-small">Guild Cloud inference · today (UTC) · last synced ${esc(flow.asOf||'unknown')}</p>
    <div class="gm-neuron-stats">
      <div class="gm-neuron-stat"><small>Charged today</small><strong>${neurons(today.chargedNeurons)}</strong></div>
      <div class="gm-neuron-stat"><small>Included remaining</small><strong>${neurons(today.includedRemainingNeurons)}</strong></div>
      <div class="gm-neuron-stat"><small>Daily Guild allowance</small><strong>${neurons(today.includedDailyCeilingNeurons)}</strong></div>
    </div>
    <div class="gm-neuron-meter" role="progressbar" aria-label="Guild included neuron allowance used" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="--gm-neuron-pct:${pct}%"></span></div>
    <p class="gm-small">${pct}% of today's Guild included allowance used · next reset ${esc(flow.resetsAt||'unknown')}${Number(today.overdrawnNeurons||0)>0?' · Warning: exceeded computed allowance by '+neurons(today.overdrawnNeurons):''}</p>
    <h3>Last seven days</h3><div class="gm-neuron-chart" role="img" aria-label="${esc(history.map(row=>row.day+': '+neurons(row.chargedNeurons)+' neurons').join('; '))}">${chart}</div>
    <h3>By Guild Cloud node today</h3><div class="gm-neuron-lines">${nodeRows||'<p class="gm-small">No starter nodes reported.</p>'}</div>
    <h3>Resident usage today</h3><div class="gm-neuron-lines">${memberRows||'<p class="gm-small">No enrolled residents yet.</p>'}</div>
    ${Number(today.unassignedNeurons||0)>0?'<p class="gm-small">Former residents used '+neurons(today.unassignedNeurons)+' neurons today, included in totals without exposing removed account details.</p>':''}
    <p class="gm-small">Counts are settled Guild Cloud Workers AI charges, not provider-wide usage or funds. Device-local models, physical/external node AI, paid gateway credits, pending generations, and other Cloudflare Workers sharing the account are not included. Refresh for the latest snapshot.</p>
    <div class="gm-actions"><button type="button" data-gm-action="refresh">Refresh neuron flow</button></div>`;
}
function render(){
  if(!root||root.hidden||!packet)return;
  const {guild={},capacity={},members=[]}=packet,on=capacity.onboarding,stage=Number(on?.stage)||0,available=Number(on?.unlockedSlots)||Number(capacity.communitySeatLimit)||5;
  root.querySelector('[data-gm-overview]').innerHTML=`<h3>${esc(guild.displayName||'Your Guild')}</h3><p class="gm-info">${esc(capacity.memberCount||0)} members · ${available} unlocked of ${on?10:capacity.maxMembers||available} slots ${on?('· '+on.progressPercent+'% physical-server setup'):''}</p><div class="gm-grid" aria-label="Ten Guild membership slots">${Array.from({length:on?10:available},(_,i)=>`<div class="gm-slot" data-guild-reward-slot="${i+1}" data-locked="${i>=available}" aria-label="Member slot ${i+1} ${i>=available?'locked':'unlocked'}">${i>=available?'🔒':'♟'} ${i+1}</div>`).join('')}</div>${on?`<ol class="gm-milestones">${on.milestones.map(m=>`<li data-done="${m.complete}">${m.complete?'✓':'○'} ${esc(m.label)}</li>`).join('')}</ol>`:'<p>This existing Guild retains its legacy membership settings. Physical-node rewards apply to newly paired Guilds.</p>'}<div class="gm-actions"><button data-gm-action="refresh">Refresh Guild status</button></div>`;
  root.querySelector('[data-gm-neuron-flow]').innerHTML=renderNeuronFlow(packet.neuronFlow);
  root.querySelector('[data-gm-server]').innerHTML=`<h3>Physical server</h3><p>${on?.nodeId?'Node: '+esc(on.nodeId):'No physical server currently listed'} · ${esc(on?.nodeState||'unpaired')}</p><p class="gm-small">Last heartbeat: ${esc(on?.lastSeenAt||'none')} · Down since: ${esc(on?.downSince||'not down')} · Earned slots and existing memberships remain intact when a node is retired.</p>${on?`<div class="gm-actions"><button data-gm-action="pair">Create 10-minute pairing code</button><button data-gm-action="finalize" ${stage<4?'disabled':''}>Complete final checks</button><button data-gm-action="revoke">Revoke physical node</button></div><p class="gm-small" data-gm-pair-help>Run the physical-node companion with the pairing code on the server you own. The code is shown once and never shared with ordinary Guild members.</p>`:''}`;
  root.querySelector('[data-gm-members]').innerHTML=`<h3>Members &amp; invitations</h3><p class="gm-small">Cloudflare enforces ${available} currently unlocked Citizen slots. Residents retain access if the server goes offline.</p><div class="gm-actions"><button data-gm-action="copy-invite">Copy Guild invitation link</button></div>${members.length?members.map(m=>`<div class="gm-member"><span>${esc(m.userId)} <small class="gm-small">(${esc(m.role==='guildkeeper'?'Guildkeeper':m.seatClass)})</small></span><button data-gm-action="council">Council vote</button></div>`).join(''):'<p class="gm-small">No enrolled Cloudflare residents yet.</p>'}`;
  root.querySelector('[data-gm-location]').innerHTML=`<h3>Community location checks</h3><p class="gm-small">Guild Map pin: ${guild.location?'Saved':'Unavailable'}. Residents visit the public location, read the physical server's rotating check code, and can earn one nontransferable Guild verification token per day. Their raw location coordinates are not retained.</p><p class="gm-small">Latest accepted community check: ${esc(on?.lastCommunityVerifiedAt||'none')} · Milestone: ${esc(on?.locationVerification?.kind||'pending')}</p><p class="gm-small">Status: ${esc(on?.nodeState||'unpaired')} ${on?.downReason?'· '+esc(on.downReason):''}. A first valid off-pin code flags a discrepancy; two independent reports can mark the node down. A missing heartbeat also marks it down. A sustained 72-hour outage retires the node, not the Guild or its members. No nearby volunteers does not count as a failure.</p><div class="gm-actions"><button data-gm-action="open-check">Open member verification</button></div>`;
  root.querySelector('[data-gm-settings]').innerHTML=`<h3>Roles, permissions &amp; activity</h3><p class="gm-small">Delegated Guildkeepers may manage node operations. Member removals, bans, reports and role changes require majority-approved Council ballots. No Guildkeeper may override an active contributor's vote.</p><p class="gm-small">Cloudflare origin: ${esc(owner()?.primaryOrigin||'none')}. Reward progress and node heartbeat history are preserved server-side.</p>`;
}
function apply(next){
  const on=next?.capacity?.onboarding,v=owner();
  if(v&&on){
    const key='civweave.guild-owner.reward-stage.'+v.guildId,previous=Number(localStorage.getItem(key)||'0'),current=Number(on.stage)||0;
    if(current>previous){const reward=root?.querySelector('.gm-reward');if(reward){reward.hidden=false;reward.textContent='Milestone complete! '+(current-previous)+' Guild member slot'+(current-previous===1?'':'s')+' unlocked · '+on.unlockedSlots+' of 10 now available.'}}
    try{localStorage.setItem(key,String(current))}catch{}
  }
  packet=next;render();
}
async function refresh(){const next=await request();apply(next);feedback('Guild management synced with Cloudflare.')}
async function perform(action,button){
  if(busy)return;busy=true;
  try{
    if(action==='refresh'){await refresh();return}
    if(action==='copy-invite'){const v=owner(),a=managementAuth(),invite=new URL('/app/working-campus-v440.html',location.origin);invite.searchParams.set('host',new URL(a.origin).origin);if(v?.cloudFabric?.starterNodes?.[0]?.nodeId)invite.searchParams.set('node',v.cloudFabric.starterNodes[0].nodeId);await navigator.clipboard.writeText(invite.href);feedback('Guild invitation copied. It contains no owner credential; residents still join using the normal login flow.');return}
    if(action==='council'){close();await globalThis.CivweaveGuildGovernanceV1?.open?.();return}
    if(action==='revoke'&&!confirm('Revoke the current physical server key? Already earned slots remain unlocked.'))return;
    feedback('Checking '+action+'…');
    let extra={};
    if(action==='open-check'){await globalThis.CivweaveGuildNodeCommunityCheckV1?.open?.();return}
    const names={pair:'pair-node',revoke:'revoke-node',finalize:'finalize'};
    const result=await request('POST',names[action],extra);
    await refresh();
    if(action==='pair'){
      const help=root?.querySelector('[data-gm-pair-help]');
      if(help){help.textContent='Pairing code (expires in 10 minutes): '+result.pairingCode+'. On the physical server, set CIVWEAVE_GUILD_ORIGIN and CIVWEAVE_NODE_PAIRING_CODE, then run node scripts/guild-physical-node-agent-v1.mjs. This code is not a Guild owner key.'}
    }
    feedback(action==='pair'?'Pairing code issued. Complete pairing on the physical server.':'Guild action completed.');
  }catch(error){feedback('Unable to complete Guild action: '+clean(error?.message||error,400))}
  finally{busy=false}
}
async function open(){
  if(!managementAuth())return false;
  globalThis.CivweaveGuildSymbolV1?.closeNearbyGuilds?.('owner-management');
  ensure().hidden=false;feedback('Loading owner-only Guild configuration…');
  try{await refresh()}catch(error){feedback('Guild Management unavailable: '+clean(error?.message||error,400))}
  root.querySelector('[data-gm-close]')?.focus({preventScroll:true});return true;
}
function close(){if(root)root.hidden=true}
function syncNav(){const selected=globalThis.CivweaveHostNodeSessionV1?.selectedOrigin?.()||'';const can=ownerAvailableFor(selected);document.querySelectorAll('[data-cw-guild-manage]').forEach(button=>{button.hidden=!can;button.disabled=!can})}
document.addEventListener('click',event=>{if(event.target.closest?.('[data-cw-guild-manage]')){event.preventDefault();void open()}});
addEventListener('civweave:nearby-guilds-opened',syncNav);
addEventListener('civweave:host-node-selected',syncNav);
addEventListener('civweave:host-node-health',syncNav);
addEventListener('civweave:mobile-guild-cloud-attached',syncNav);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',syncNav,{once:true});else syncNav();
globalThis.CivweaveGuildOwnerManagementV1=Object.freeze({version:VERSION,open,close,refresh,ownerAvailable:()=>Boolean(owner()),ownerAvailableFor,ownedGuild});
})();
