import {STARLING_PERSONAS,guildQuestBeatSnapshot,discoverGuildOpportunities} from './shared/starling-collective-v1.mjs';
import {COLLECTIVE_TOOL_CATALOG} from './shared/starling-collective-tools-v1.mjs';

const ID='cw-starling-lounge';
const PEOPLE=Object.values(STARLING_PERSONAS);
const SYSTEM_GUIDES=Object.freeze({
  weaveling:{id:'weaveling',name:'Weaveling',role:'Civweave · shared guide',color:'#91c6c3',goal:'Coordinates the common thread across Civweave.',asset:'/app/assets/ai/weaveling.png'},
  moss:{id:'moss',name:'Moss',role:'Living School · learning',color:'#82c3a5',goal:'Helps with curricula, study, and learning journeys.',asset:'/app/assets/ai/moss.png'},
  kamiya:{id:'kamiya',name:'Kamiya',role:'Cerbanimo · quests',color:'#eeaa9a',goal:'Supports task planning, proof, and quality gates.',asset:'/app/assets/ai/kamiya.png'},
  rook:{id:'rook',name:'Rook',role:'FellowFare · resources',color:'#e9be75',goal:'Helps organize resources and supported exchanges.',asset:'/app/assets/ai/rook.png'},
  merlin:{id:'merlin',name:'Merlin',role:'Anarchadia · deliberation',color:'#b6a4df',goal:'Supports proposals, dialogue, and human-led governance.',asset:'/app/assets/ai/merlin.png'}
});
const STAGE_POSITIONS=Object.freeze({
  weaveling:[49,29],moss:[12,38],kamiya:[36,40],rook:[63,38],merlin:[87,39],
  aphra:[11,65],jae:[27,67],anthony:[43,66],rosa:[60,67],sana:[78,65],kit:[20,87],farah:[48,86],kami:[76,86]
});
const STATIONS=Object.freeze({
  school:'Living School · a visual district for studies, curricula, and shared learning.',
  forge:'Quest Forge · projects, making, proof, and careful review.',
  supply:'FellowFare · resource needs, offers, and authorized exchanges.',
  council:'Commons · conversations, intentions, and human-governed decisions.'
});
const clean=(value,max=3000)=>typeof value==='string'?value.trim().slice(0,max):'';
const state={guild:null,speaker:'kami',root:null,feed:[],snapshot:null,opportunities:[],status:'idle',error:'',loading:false,turnsLoading:false,turnsRunning:false,turnError:'',turnMessage:'No local model run has started.',turnService:null,turnMesh:null,turnSubscribe:null,worker:null,workerEnabled:false,workerMessage:'Local autopilot is off.',workerLoading:false,hostTransport:null,hostKind:null,hostJob:null,hostStatus:'Choose a host and connect.',hostBusy:false,selectedAgent:'kami',activePersona:null,view:'world',station:'council',worldView:null,worldLinked:false};
const $=selector=>state.root?.querySelector(selector);
const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!=null)node.textContent=String(text);return node};
const para=(parent,text,cls='')=>{const p=el('p',cls,text);parent.append(p);return p};
const human=person=>person?.name||'Unknown persona';
function setup(){
  if(state.root)return state.root;
  const style=document.createElement('link');style.rel='stylesheet';style.href='/app/starling-lounge-v1.css?v=starling-commune-hud-r2';document.head.append(style);
  const root=el('section');root.id=ID;root.setAttribute('aria-label','Starling Lounge');root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.hidden=true;
  root.innerHTML="<header class=\"sl-head\">\n  <div class=\"sl-brand\"><small>CIVWEAVE · COLLECTIVE COMMONS</small><h1>Starling Commune</h1><p>One Guild · many minds · shared work</p></div>\n  <div class=\"sl-head-right\"><span class=\"sl-live-pill\" data-sl-activity-status>Awaiting activity</span><small data-sl-guild></small><button type=\"button\" data-sl-action=\"refresh\" aria-label=\"Refresh commune information\">↻ Refresh</button><button type=\"button\" data-sl-action=\"close\" aria-label=\"Close Starling Commune\">Close ×</button></div>\n</header>\n<nav class=\"sl-view-nav\" aria-label=\"Commune HUD panels\">\n <button type=\"button\" data-sl-view=\"world\" aria-pressed=\"true\">Commune</button>\n <button type=\"button\" data-sl-view=\"agents\" aria-pressed=\"false\">Residents</button>\n <button type=\"button\" data-sl-view=\"conversation\" aria-pressed=\"false\">Dialogue</button>\n <button type=\"button\" data-sl-view=\"work\" aria-pressed=\"false\">Quests</button>\n <button type=\"button\" data-sl-view=\"operations\" aria-pressed=\"false\">Controls</button>\n</nav>\n<div class=\"sl-layout\">\n <aside class=\"sl-card sl-roster\" data-sl-panel=\"agents\" aria-label=\"Commune residents\">\n  <div class=\"sl-panel-title\"><span class=\"sl-kicker\">01 · RESIDENTS</span><h2>Who is here</h2></div>\n  <p class=\"sl-label\">Starling · fictional collective</p><div class=\"sl-cast\" data-sl-cast></div>\n  <p class=\"sl-label sl-guides-title\">Civweave · system guides</p><div class=\"sl-cast sl-guide-list\" data-sl-guides></div>\n  <p class=\"sl-status\">Agent portraits represent software roles, not human Guild membership or votes. Standby does not mean a model is running.</p>\n </aside>\n <div class=\"sl-center\">\n  <section class=\"sl-scene-panel\" data-sl-panel=\"world\" aria-label=\"Virtual commune visualization\">\n   <div class=\"sl-scene-heading\"><div><span class=\"sl-kicker\">THE LIVING COMMUNE</span><h2>Commune grounds</h2></div><div class=\"sl-scene-controls\"><span data-sl-live-note>Illustrated 2D preview · no world provider connected</span><button type=\"button\" data-sl-action=\"focus-active\">Focus activity</button></div></div>\n   <div class=\"sl-scene-shell\">\n    <div class=\"sl-stage\" data-sl-stage role=\"group\" aria-label=\"Schematic virtual commune and resident avatars\">\n     <div class=\"sl-sky\" aria-hidden=\"true\"><span class=\"sl-sun\"></span><span class=\"sl-stars\"></span></div>\n     <div class=\"sl-land\" aria-hidden=\"true\"></div><div class=\"sl-path sl-path-a\" aria-hidden=\"true\"></div><div class=\"sl-path sl-path-b\" aria-hidden=\"true\"></div>\n     <button type=\"button\" class=\"sl-building sl-building-school\" data-sl-station=\"school\"><span class=\"sl-building-icon\">✧</span><b>Living School</b><small>Learning and research</small></button>\n     <button type=\"button\" class=\"sl-building sl-building-forge\" data-sl-station=\"forge\"><span class=\"sl-building-icon\">⚒</span><b>Quest Forge</b><small>Creation and review</small></button>\n     <button type=\"button\" class=\"sl-building sl-building-supply\" data-sl-station=\"supply\"><span class=\"sl-building-icon\">◇</span><b>FellowFare</b><small>Resources and tools</small></button>\n     <button type=\"button\" class=\"sl-building sl-building-council\" data-sl-station=\"council\"><span class=\"sl-building-icon\">✦</span><b>Commons</b><small>Planning and dialogue</small></button>\n     <div class=\"sl-ensemble\" data-sl-ensemble aria-label=\"Select a commune resident\"></div>\n     <div class=\"sl-scene-caption\"><span class=\"sl-scene-orbit\" aria-hidden=\"true\"></span>Avatars idle decoratively; work animation follows actual execution signals</div>\n    </div>\n    <div class=\"sl-world-host\" data-sl-world-host hidden aria-label=\"Authorized Worldweaver 2D map\"></div>\n   </div>\n   <div class=\"sl-focus-strip\" aria-live=\"polite\">\n    <img data-sl-focus-avatar class=\"sl-focus-avatar\" alt=\"\">\n    <div class=\"sl-focus-copy\"><small data-sl-focus-status>Standby</small><h3 data-sl-stage-name>Kami</h3><p data-sl-summary></p></div>\n    <button type=\"button\" data-sl-action=\"focus-chat\">Address in chat</button>\n   </div>\n   <p class=\"sl-scene-disclaimer\" data-sl-scene-context>Preview layout; locations are illustrative until an authorized Worldweaver region is connected.</p>\n  </section>\n  <section class=\"sl-card sl-conversation\" data-sl-panel=\"conversation\" aria-label=\"Collective dialogue\">\n   <div class=\"sl-panel-title\"><div><span class=\"sl-kicker\">02 · THE HEARTH</span><h2>Conversation and decisions</h2></div><span class=\"sl-mini-pill\" data-sl-transcript-count>0 signed turns</span></div>\n   <div class=\"sl-flex sl-run\"><button type=\"button\" class=\"sl-strong\" data-sl-action=\"turn\">Run one local turn</button><button type=\"button\" data-sl-action=\"round\">Run 3-person round</button></div>\n   <p class=\"sl-status\" data-sl-turn-status>No local model run has started. Runs are explicitly started and never use hosted credits.</p>\n   <div class=\"sl-feed\" data-sl-feed aria-live=\"polite\"></div>\n   <form class=\"sl-compose\" data-sl-form><label for=\"cw-sl-message\">Message or brief for selected resident</label><textarea id=\"cw-sl-message\" maxlength=\"1500\" placeholder=\"Share a question or focused task. For a Starling persona, use Run one local turn to generate a signed response.\" required></textarea><button type=\"submit\" class=\"sl-strong\">Open addressed draft in Civweave chat</button></form>\n   <p class=\"sl-status\" data-sl-message-status>Chat opens an addressed draft. Only explicit local Starling runs record signed Collective replies.</p>\n  </section>\n </div>\n <div class=\"sl-side\">\n  <aside class=\"sl-card sl-work\" data-sl-panel=\"work\" aria-label=\"Quest work HUD\">\n   <div class=\"sl-panel-title\"><div><span class=\"sl-kicker\">03 · QUEST WATCH</span><h2>What we are building</h2></div></div>\n   <div class=\"sl-metric-row\" data-sl-metrics></div><h3>Quest beats and outputs</h3><div data-sl-outputs></div><h3>Possible AI help</h3><div data-sl-offers></div><p class=\"sl-status\" data-sl-work-status></p>\n  </aside>\n  <aside class=\"sl-card sl-operations\" data-sl-panel=\"operations\" aria-label=\"Compute and execution controls\">\n   <div class=\"sl-panel-title\"><div><span class=\"sl-kicker\">04 · OPERATIONS</span><h2>Control room</h2></div></div>\n   <div class=\"sl-operation-block\"><h3>Browser-local collective</h3><div class=\"sl-flex sl-autopilot\"><button type=\"button\" data-sl-action=\"worker-toggle\">Enable local autopilot</button></div><p class=\"sl-status\" data-sl-worker-status>Off · Guildkeeper opt-in required · runs only while Lounge is open.</p></div>\n   <section class=\"sl-host-panel sl-operation-block\" aria-label=\"Local execution host\"><h3>Device execution host</h3><p class=\"sl-sub\">Resume approved local drafts after leaving the commune. No task claims or spending.</p><label>Backend <select data-sl-host-kind><option value=\"termux\">Termux companion · port 8767</option><option value=\"android\">Android native bridge · WorkManager</option></select></label><div class=\"sl-flex\"><button type=\"button\" data-sl-action=\"host-connect\">Connect</button><button type=\"button\" data-sl-action=\"host-submit\">Queue local draft</button><button type=\"button\" data-sl-action=\"host-refresh\">Refresh jobs</button></div><div class=\"sl-flex\"><button type=\"button\" data-sl-action=\"host-enable\">Enable host autopilot</button><button type=\"button\" data-sl-action=\"host-disable\">Disable host autopilot</button></div><p class=\"sl-status\" data-sl-host-status role=\"status\">Choose a host and connect.</p><pre data-sl-host-output class=\"sl-host-output\"></pre><button type=\"button\" data-sl-action=\"host-import\">Import completed draft for Guild review</button></section>\n   <details class=\"sl-toolbench sl-operation-block\"><summary>Collective toolbench · installed capabilities</summary><div data-sl-toolbench></div></details>\n   <p class=\"sl-scene-disclaimer\">Inference is local unless a separately authorized hosted route is selected. The visual commune never spends neurons or changes permissions by itself.</p>\n  </aside>\n </div>\n</div>";
  root.addEventListener('click',click);
  root.querySelector('[data-sl-form]').addEventListener('submit',send);
  root.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close()}});
  document.body.append(root);state.root=root;setView(state.view);
  renderCast();render();return root;
}
function residentAvatar(person){
  return person.asset||'/app/assets/starling/'+person.id+'.svg';
}
function presenceFor(agentId){
  // Only explicit local generation or a real host job may claim "working".
  if(state.turnsRunning&&state.activePersona===agentId)return {status:'working',label:'Generating now'};
  const job=state.hostJob;
  if(job?.guildId===state.guild?.id&&job.personaId===agentId){
    if(['running','working','processing','started'].includes(job.state))return {status:'working',label:'Host running'};
    if(['queued','pending'].includes(job.state))return {status:'queued',label:'Host queued'};
  }
  const recent=state.feed.findLast?.(row=>row.personaId===agentId);
  const age=recent?Date.now()-Date.parse(recent.at):Infinity;
  if(Number.isFinite(age)&&age>=0&&age<15*60*1000)return {status:'recent',label:'Signed turn recently'};
  if(agentId==='kami'&&state.workerEnabled)return {status:'scheduled',label:'Local autopilot armed'};
  return {status:'standby',label:STARLING_PERSONAS[agentId]?'Standby · no current run':'Guide · no live signal'};
}
function makeResident(person,{guide=false}={}){
  const button=el('button','sl-persona');
  button.type='button';button.dataset[guide?'slGuide':'slPersona']=person.id;
  button.setAttribute('aria-pressed','false');
  const image=el('img','sl-avatar');image.src=residentAvatar(person);image.alt='';image.loading='lazy';image.style.setProperty('--avatar',person.color);
  const label=el('span','sl-persona-description');label.append(el('b','',person.name),el('small','',person.role),el('em','sl-presence-label','Standby'));
  button.append(image,label);return button;
}
function makeFigure(person,{guide=false}={}){
  const button=el('button','sl-figure'+(guide?' sl-figure-guide':''));
  button.type='button';button.dataset[guide?'slGuide':'slPersona']=person.id;
  button.setAttribute('aria-label','Inspect '+person.name);
  button.setAttribute('aria-pressed','false');
  const [x,y]=STAGE_POSITIONS[person.id];button.style.setProperty('--sl-x',x+'%');button.style.setProperty('--sl-y',y+'%');
  const image=el('img','sl-figure-avatar');image.src=residentAvatar(person);image.alt='';image.loading='lazy';image.style.setProperty('--avatar',person.color);
  button.append(image,el('b','',person.name),el('small','sl-figure-presence','standby'));return button;
}
function renderCast(){
  const cast=$('[data-sl-cast]'),guides=$('[data-sl-guides]'),stage=$('[data-sl-ensemble]');
  if(!cast||!guides||!stage)return;
  cast.replaceChildren();guides.replaceChildren();stage.replaceChildren();
  for(const person of PEOPLE){cast.append(makeResident(person));stage.append(makeFigure(person))}
  for(const person of Object.values(SYSTEM_GUIDES)){guides.append(makeResident(person,{guide:true}));stage.append(makeFigure(person,{guide:true}))}
  renderPresence();
}
function renderPresence(){
  if(!state.root)return;
  for(const button of state.root.querySelectorAll('[data-sl-persona],[data-sl-guide]')){
    const id=button.dataset.slPersona||button.dataset.slGuide;
    const current=presenceFor(id);
    button.dataset.slPresence=current.status;
    button.setAttribute('aria-pressed',String(id===state.selectedAgent));
    const status=button.querySelector('.sl-presence-label');if(status)status.textContent=current.label;
    const short=button.querySelector('.sl-figure-presence');if(short)short.textContent=current.status;
    button.title=(STARLING_PERSONAS[id]||SYSTEM_GUIDES[id]).name+' · '+current.label;
  }
  const working=Object.keys(STAGE_POSITIONS).filter(id=>presenceFor(id).status==='working');
  const pill=$('[data-sl-activity-status]');
  if(pill){pill.textContent=working.length?working.length+' active model'+(working.length===1?'':'s'):'No active model reported';pill.dataset.slActivity=working.length?'working':'standby'}
  const count=$('[data-sl-transcript-count]');
  if(count)count.textContent=state.feed.length+' signed turn'+(state.feed.length===1?'':'s');
}
function renderSpeaker(){
  const person=STARLING_PERSONAS[state.selectedAgent]||SYSTEM_GUIDES[state.selectedAgent]||STARLING_PERSONAS.kami;
  const portrait=$('[data-sl-focus-avatar]');if(portrait){portrait.src=residentAvatar(person);portrait.alt=person.name+' avatar'}
  $('[data-sl-stage-name]').textContent=person.name+' · '+person.role;
  $('[data-sl-summary]').textContent=person.goal+'. '+(person.style||'Guide activity is shown only when an authenticated service reports it.');
  $('[data-sl-focus-status]').textContent=presenceFor(person.id).label;
  const turn=$('[data-sl-action=turn]'),round=$('[data-sl-action=round]');
  if(turn)turn.disabled=state.turnsRunning||!STARLING_PERSONAS[state.selectedAgent];
  if(round)round.disabled=state.turnsRunning||!STARLING_PERSONAS[state.selectedAgent];
  renderPresence();
}
function setView(view){
  if(!['world','agents','conversation','work','operations'].includes(view))return;
  state.view=view;if(!state.root)return;
  state.root.dataset.slView=view;
  for(const button of state.root.querySelectorAll('[data-sl-view]'))button.setAttribute('aria-pressed',String(button.dataset.slView===view));
}
function focusActivity(){
  const working=Object.keys(STARLING_PERSONAS).find(id=>presenceFor(id).status==='working');
  const recent=state.feed.at(-1)?.personaId;
  const id=working||recent||state.selectedAgent;
  if(id&&STARLING_PERSONAS[id])state.speaker=id;
  state.selectedAgent=id;
  renderSpeaker();setView('world');
}
function renderFeed(){
  const node=$('[data-sl-feed]');node.replaceChildren();
  if(!state.feed.length){para(node,'No signed Collective turns recorded for this Guild yet. Select a persona and explicitly run a local model turn on the founding device.','sl-sub');return}
  for(const message of state.feed.slice(-120)){
    const entry=el('article','sl-entry');
    const who=STARLING_PERSONAS[message.personaId];
    entry.append(el('b','',who?.name||message.personaId));
    const time=el('time','',new Date(message.at).toLocaleString());entry.append(time);
    if(message.brief)para(entry,'Requested brief: '+message.brief,'sl-sub');
    para(entry,message.text);
    para(entry,'Signed by founding Guild device · local-model self-report; not verified Quest completion.','sl-sub');
    node.append(entry);
  }
}
function metric(label,value){
  const item=el('div','sl-metric');item.append(el('strong','',value),el('small','',label));return item;
}
function renderWork(){
  const metrics=$('[data-sl-metrics]'),outputs=$('[data-sl-outputs]'),offers=$('[data-sl-offers]');
  metrics.replaceChildren();outputs.replaceChildren();offers.replaceChildren();
  const snapshot=state.snapshot;
  const statuses=snapshot?[[ 'Beats',snapshot.totalBeats],['Active',snapshot.activeBeats],['Complete',snapshot.completedBeats]]:[['Beats','—'],['Active','—'],['Complete','—']];
  for(const [name,num] of statuses)metrics.append(metric(name,num));
  if(!snapshot){
    para(outputs,'No authenticated Guild Quest board loaded. Connect as a Guild member and refresh.','sl-sub');
    para(offers,'AI work suggestions require a verified human project and a registered tool.','sl-sub');
  }else{
    if(!snapshot.quests.length)para(outputs,'No member-published Guild Quests are currently visible.','sl-sub');
    for(const quest of snapshot.quests.slice(0,20)){
      const section=el('section','sl-output');section.append(el('h3','',quest.title));
      para(section,'Reported: '+quest.counts.completed+'/'+quest.counts.total+' beats complete · '+quest.counts.active+' active · '+quest.counts.blocked+' blocked');
      for(const beat of quest.beats.slice(0,8))para(section,beat.title+' — '+beat.status,'sl-sub');
      const button=el('button','','Review in Quest Map');button.type='button';button.dataset.slAction='quest';section.append(button);outputs.append(section);
    }
    if(!state.opportunities.length)para(offers,'No verified, compatible requests yet. Matching never automatically claims a task.','sl-sub');
    else for(const candidate of state.opportunities.slice(0,12)){
      const row=el('article','sl-output');row.append(el('h3','',candidate.beatTitle));
      para(row,'Suggested tools: '+candidate.matchingCapabilities.join(', ')+' · author consent required','sl-sub');
      offers.append(row);
    }
  }
  const bench=$('[data-sl-toolbench]');bench.replaceChildren();for(const tool of COLLECTIVE_TOOL_CATALOG){const entry=el('section','sl-output');entry.append(el('b','',tool.name+' · '+tool.kind),el('p','sl-sub',tool.description));entry.append(el('small','',tool.status==='migration-pending'?'Porting existing Starling adapter':'Not installed yet'));bench.append(entry)}
  $('[data-sl-work-status]').textContent=state.loading?'Loading authenticated Guild Quests…':state.error||('Guild board: '+state.status+'. Progress is member-reported, not automatically verified.');
}
function render(){
  if(!state.root)return;
  $('[data-sl-guild]').textContent=state.guild?.name||state.guild?.displayName||state.guild?.id||'Guild not selected';
  renderSpeaker();renderFeed();renderWork();
  const button=$('[data-sl-action=turn]');if(button){button.disabled=state.turnsRunning;button.textContent=state.turnsRunning?'Generating local turn…':'Run one local turn'}
  const round=$('[data-sl-action=round]');if(round)round.disabled=state.turnsRunning;
  const control=$('[data-sl-action=worker-toggle]');if(control){control.disabled=state.workerLoading;control.textContent=state.workerEnabled?'Disable local autopilot':'Enable local autopilot'}
  const worker=$('[data-sl-worker-status]');if(worker)worker.textContent=state.workerMessage;
  const hostLabel=$('[data-sl-host-status]');if(hostLabel)hostLabel.textContent=state.hostStatus;
  for(const cmd of ['host-connect','host-submit','host-refresh','host-enable','host-disable','host-import']){const control=$('[data-sl-action='+cmd+']');if(control)control.disabled=state.hostBusy||((cmd!=='host-connect')&&!state.hostTransport)}
  const imp=$('[data-sl-action=host-import]');if(imp)imp.disabled=state.hostBusy||state.hostJob?.state!=='completed';
  const status=$('[data-sl-turn-status]');if(status){status.textContent=state.turnError||state.turnMessage;status.dataset.slError=state.turnError?'true':'false'}
  renderPresence();
  const submit=$('[data-sl-action=host-submit]');if(submit&&!!SYSTEM_GUIDES[state.selectedAgent])submit.disabled=true;
  const note=$('[data-sl-live-note]');if(note)note.textContent=state.worldLinked?'Worldweaver · supplied live snapshot':'Illustrated 2D preview · no world provider connected';
}
async function refresh(){
  if(state.loading||!state.guild)return;
  state.loading=true;state.error='';renderWork();
  try{
    const client=globalThis.CivweaveGuildQuestsV1;
    if(typeof client?.list!=='function'||!client.sessionForGuild?.(state.guild))throw new Error('Log in to this Guild before reading its shared Quests.');
    const guild=state.guild;let cursor='',pages=0,all=[],seen=new Set(),packet;
    do{
      packet=await client.list(guild,{cursor});
      if(state.guild?.id!==guild.id)return;
      if(!packet?.guildId||!Array.isArray(packet.quests))throw new Error('The Guild Quest board returned invalid data.');
      for(const row of packet.quests)if(!seen.has(row.id)){all.push(row);seen.add(row.id)}
      cursor=packet.nextCursor||'';pages++;
    }while(cursor&&pages<5&&all.length<500);
    state.snapshot=guildQuestBeatSnapshot({guildId:packet.guildId,publications:all});
    // No authoritative human-author validator or live tool registry is installed
    // here yet. Never fabricate matched opportunities from public text alone.
    const memberRows=new Map(all.filter(p=>p?.schema==='civweave.guild-quest-publication.v1'&&p.status==='published'&&p.guildId===packet.guildId&&typeof p.authorUserId==='string').map(p=>[p.id,p]));
    // The connected Quest publication owner derives authorUserId from a
    // verified current Guild-member session; Collective personas have no
    // member identities. This is suggestion provenance, not claim authority.
    state.opportunities=discoverGuildOpportunities({snapshot:state.snapshot,capabilities:[{id:'writing',enabled:true},{id:'project-planning',enabled:true}],verifyHumanPublisher:({guildId,userId,publicationId})=>{
      const entry=memberRows.get(publicationId);
      return guildId===packet.guildId&&Boolean(entry&&entry.authorUserId===userId&&userId);
    }});
    state.status=cursor?'partial':'synced';
  }catch(error){state.snapshot=null;state.opportunities=[];state.status='unavailable';state.error=clean(String(error?.message||error),500)}
  finally{state.loading=false;render()}
}
function close(){if(!state.root)return;state.root.hidden=true;state.turnSubscribe?.();state.turnSubscribe=null;state.worker?.stop();detachWorldSource();document.body.style.removeProperty('overflow')}
function open(guild){
  if(!guild?.id)throw new TypeError('Select an existing Guild first.');
  setup();
  if(state.guild?.id!==guild.id){state.guild={id:guild.id,name:clean(guild.name||guild.displayName,240)};state.feed=[];state.selectedAgent='kami';state.speaker='kami';state.activePersona=null;state.snapshot=null;state.opportunities=[];state.status='idle';state.turnError='';state.turnMessage='Loading signed Guild Collective turns…';state.worker?.stop();state.workerEnabled=false;state.workerMessage='Local autopilot is off.';state.hostTransport=null;state.hostKind=null;state.hostJob=null;state.hostStatus='Choose a host and connect.'}
  state.root.hidden=false;document.body.style.overflow='hidden';setView('world');render();state.root.querySelector('[data-sl-action=close]').focus();void refresh();void refreshTurns();void refreshWorkerStatus();
}
async function send(event){
  event.preventDefault();
  const message=clean($('#cw-sl-message')?.value,1500);
  if(!message)return;
  const status=$('[data-sl-message-status]');
  const loader=globalThis.CivweaveFamilyAILoaderV105;
  if(typeof loader?.openChat!=='function'){status.textContent='Civweave’s shared chat is not available here. No message was sent.';return}
  const person=STARLING_PERSONAS[state.selectedAgent]||SYSTEM_GUIDES[state.selectedAgent],guild=state.guild;
  const prefill=(SYSTEM_GUIDES[state.selectedAgent]?'For Civweave guide ':'For the optional Starling Collective, ')+person.name+', in Guild '+(guild?.name||guild?.id)+': '+message;
  try{
    await loader.openChat('civweave',{prefill,contextSystem:'civweave'});
    status.textContent='Opened an addressed draft in the canonical Civweave chat. Direct delivery to Starling personas is not active yet.';
  }catch(error){status.textContent='Could not open Civweave chat: '+clean(String(error?.message||error),250)}
}
function click(event){
  const persona=event.target.closest('[data-sl-persona]')?.dataset.slPersona;
  const guide=event.target.closest('[data-sl-guide]')?.dataset.slGuide;
  if(persona&&STARLING_PERSONAS[persona]){state.speaker=persona;state.selectedAgent=persona;renderSpeaker();if(event.target.closest('.sl-persona'))setView('world');return}
  if(guide&&SYSTEM_GUIDES[guide]){state.selectedAgent=guide;renderSpeaker();if(event.target.closest('.sl-persona'))setView('world');return}
  const view=event.target.closest('[data-sl-view]')?.dataset.slView;
  if(view){setView(view);return}
  const station=event.target.closest('[data-sl-station]')?.dataset.slStation;
  if(station&&STATIONS[station]){state.station=station;$('[data-sl-scene-context]').textContent=STATIONS[station]+' This is a schematic, not a verified character location.';for(const node of state.root.querySelectorAll('[data-sl-station]'))node.setAttribute('aria-pressed',String(node.dataset.slStation===station));return}
  const cmd=event.target.closest('[data-sl-action]')?.dataset.slAction;
  if(cmd==='close')close();
  if(cmd==='refresh'){void refresh();void refreshTurns();if(state.hostTransport)void refreshHost();state.worldView?.update()}
  if(cmd==='focus-active')focusActivity();
  if(cmd==='focus-chat'){setView('conversation');$('#cw-sl-message')?.focus()}
  if(cmd==='turn')void runLocalTurn();
  if(cmd==='round')void runLocalRound();
  if(cmd==='worker-toggle')void toggleWorker();
  if(cmd==='host-connect')void connectHost();
  if(cmd==='host-submit')void submitHostDraft();
  if(cmd==='host-refresh')void refreshHost();
  if(cmd==='host-enable')void setHostAutopilot(true);
  if(cmd==='host-disable')void setHostAutopilot(false);
  if(cmd==='host-import')void importHostDraft();
  if(cmd==='quest'){close();globalThis.CivweaveGuildQuestTrackerV1?.openQuestMap?.()}
}
/* The Lounge reads signed Guild object-mesh records. An ordinary window event
 * is never admitted into the transcript as a real model turn. */
async function turnService(){
  if(state.turnService)return state.turnService;
  const [mobile,turns]=await Promise.all([
    import('./mobile-guild-create-v1.mjs'),
    import('./shared/starling-collective-turns-v1.mjs')
  ]);
  const mesh=await mobile.ensurePocketMesh();
  const proxy={
    readSharedConfig:(...args)=>globalThis.CivweaveModelRuntime?.readSharedConfig?.(...args),
    normalizeConfig:(...args)=>globalThis.CivweaveModelRuntime?.normalizeConfig?.(...args),
    endpointLeavesDevice:(...args)=>globalThis.CivweaveModelRuntime?.endpointLeavesDevice?.(...args),
    generate:(...args)=>globalThis.CivweaveModelRuntime?.generate?.(...args)??Promise.reject(new Error('The selected Civweave model runtime is unavailable.'))
  };
  state.turnMesh=mesh;
  state.turnService=turns.createCollectiveTurnService({mesh,model:proxy,founder:mobile.mobileGuildStatus});
  return state.turnService;
}
async function refreshTurns(){
  if(!state.guild||state.turnsLoading)return;
  const guild=state.guild;state.turnsLoading=true;
  try{
    const service=await turnService(),mesh=state.turnMesh;
    const mobile=await import('./mobile-guild-create-v1.mjs');
    const founding=mobile.mobileGuildStatus();
    const isFounder=founding?.guildId===guild.id && founding.deviceId===await mesh.deviceId();
    const session=globalThis.CivweaveGuildQuestsV1?.sessionForGuild?.(guild);
    const turns=await service.readTurns({guildId:guild.id,verifyReader:()=>Boolean(session||isFounder),limit:120});
    if(state.guild?.id!==guild.id)return;
    state.feed=turns;
    state.turnError='';
    state.turnMessage=turns.length?turns.length+' signed Collective turn'+(turns.length===1?'':'s')+' recovered from the Guild object mesh.':'No signed turns recorded yet. Local generations require an explicit click.';
    // Keep the visitor's chosen focus; a signed transcript must not steal selection.
    if(!state.turnSubscribe){
      state.turnSubscribe=mesh.subscribe(event=>{
        if(state.root?.hidden)return;
        if(['object-created','object-received'].includes(event?.type) && event.detail?.kind==='civweave.starling-collective-turn.v1')void refreshTurns();
      });
    }
  }catch(error){
    if(state.guild?.id===guild.id){
      state.feed=[];state.turnError='Signed transcript unavailable: '+clean(String(error?.message||error),330);
    }
  }finally{state.turnsLoading=false;if(state.guild?.id===guild.id)render()}
}
async function runLocalTurn(){
  if(state.turnsRunning||!state.guild)return;
  const guild=state.guild,personaId=state.selectedAgent;
  if(!STARLING_PERSONAS[personaId])return;
  state.activePersona=personaId;state.turnsRunning=true;state.turnError='';
  state.turnMessage='The selected local model is generating one turn. No cloud budget or automatic loop is enabled.';
  render();
  try{
    await globalThis.CivweaveFamilyAILoaderV105?.ensure?.();
    const service=await turnService();
    await service.runOneTurn({guildId:guild.id,personaId,taskPrompt:clean($('#cw-sl-message')?.value,1200)});
    if(state.guild?.id===guild.id){$('#cw-sl-message').value='';state.turnMessage='Local model turn saved and signed to Guild mesh.';await refreshTurns()}
  }catch(error){if(state.guild?.id===guild.id)state.turnError=clean(String(error?.message||error),500)}
  finally{state.activePersona=null;state.turnsRunning=false;if(state.guild?.id===guild.id)render()}
}
async function runLocalRound(){
  if(state.turnsRunning||!state.guild)return;
  const guild=state.guild;
  if(!STARLING_PERSONAS[state.selectedAgent])return;
  const ids=Object.keys(STARLING_PERSONAS),start=ids.indexOf(state.selectedAgent);
  const personas=[0,1,2].map(offset=>ids[(Math.max(0,start)+offset)%ids.length]);
  state.activePersona=personas[0];state.turnsRunning=true;state.turnError='';
  state.turnMessage='Starting a 3-person sequential local round. Each signed response will be saved before the next persona runs.';
  render();
  try{
    await globalThis.CivweaveFamilyAILoaderV105?.ensure?.();
    const service=await turnService();
    const result=await service.runRound({
      guildId:guild.id,personas,taskPrompt:clean($('#cw-sl-message')?.value,1200),
      onTurn:(record,completed,total)=>{
        if(state.guild?.id===guild.id){
          state.turnMessage=completed+'/'+total+' personas have submitted signed local turns.';
          state.speaker=record.payload.personaId;state.selectedAgent=record.payload.personaId;
          state.activePersona=personas[completed]||null;
          render();void refreshTurns();
        }
      }
    });
    if(state.guild?.id===guild.id){
      $('#cw-sl-message').value='';
      state.turnMessage=result.completed+' persona turns recorded. Guild members can review the signed transcript.';
      await refreshTurns();
    }
  }catch(error){
    if(state.guild?.id===guild.id){
      state.turnError='Round stopped; previously signed turns remain saved. '+clean(String(error?.message||error),400);
      await refreshTurns();
    }
  }finally{state.turnsRunning=false;if(state.guild?.id===guild.id)render()}
}

async function ensureWorker(){
  if(state.worker)return state.worker;
  const service=await turnService(),mod=await import('./shared/starling-collective-worker-v1.mjs');
  const mobile=await import('./mobile-guild-create-v1.mjs');
  if(typeof navigator?.locks?.request!=='function')throw new Error('Automatic turns require browser lock support to prevent duplicate runs in other tabs.');
  state.worker=mod.createStarlingGuildWorker({
    mesh:state.turnMesh,
    turnService:service,
    founder:mobile.mobileGuildStatus,
    withExclusiveLock:(name,action)=>navigator.locks.request('civweave:starling-collective:planning',{mode:'exclusive',ifAvailable:true},inferenceLock=>inferenceLock?navigator.locks.request(name,{mode:'exclusive',ifAvailable:true},guildLock=>guildLock?action():{status:'another-tab-active',executed:0}):{status:'another-starling-inference-active',executed:0}),
    readTaskOpportunities:async guildId=>{
      const guild=state.guild,client=globalThis.CivweaveGuildQuestsV1;
      if(!guild||guild.id!==guildId||!client?.sessionForGuild?.(guild))return[];
      return state.worker.discover(guildId,{
        guild,questClient:client,
        capabilities:[{id:'writing',enabled:true},{id:'project-planning',enabled:true}],
        // The authenticated node derives every publisher from current
        // Guild membership. This is only authority for an offer to assist,
        // never for claiming or executing a human's task.
        verifyHumanPublisher:({guildId:scoped,userId})=>scoped===guildId&&typeof userId==='string'&&userId.length>0
      });
    }
  });
  return state.worker;
}
async function refreshWorkerStatus(){
  if(!state.guild||state.workerLoading||state.root?.hidden)return;
  const guild=state.guild;
  state.workerLoading=true;
  try{
    const worker=await ensureWorker(),status=await worker.status(guild.id);
    if(state.guild?.id!==guild.id||state.root?.hidden)return;
    state.workerEnabled=status.enabled;
    state.workerMessage=status.enabled?'Enabled locally · at most '+status.dailyLimit+' turns/day; resumes while Lounge remains open.':'Off · Guildkeeper opt-in required. No background generation.';
    if(status.enabled&&!status.active&&localStorage.getItem('civweave.starling.execution-host.v1:'+guild.id)!=='termux'&&localStorage.getItem('civweave.starling.execution-host.v1:'+guild.id)!=='android'){
      await globalThis.CivweaveFamilyAILoaderV105?.ensure?.();
      await worker.start(guild.id,{onStatus:result=>{
        if(state.guild?.id!==guild.id||state.root?.hidden)return;
        state.workerMessage='Autopilot: '+result.status+(result.error?' · '+result.error:'');
        render();void refreshTurns();
      }});
    }
  }catch(error){
    if(state.guild?.id===guild.id)state.workerMessage='Autopilot unavailable: '+clean(String(error?.message||error),300);
  }finally{state.workerLoading=false;if(state.guild?.id===guild.id)render()}
}
async function toggleWorker(){
  if(state.workerLoading||!state.guild)return;
  const guild=state.guild;state.workerLoading=true;
  try{
    const worker=await ensureWorker(),status=await worker.status(guild.id);
    if(status.enabled){
      await worker.disable(guild.id);
      state.workerEnabled=false;
      state.workerMessage='Disabled and signed on the founding Guild device. No further automatic turns will start.';
    }else{
      const selected=localStorage.getItem('civweave.starling.execution-host.v1:'+guild.id);
      if(selected==='termux'||selected==='android')throw new Error('Disable the '+selected+' host scheduler before enabling browser-local autopilot.');
      // This callback runs only in response to the Guildkeeper pressing the
      // visible opt-in control. It does not grant Quest/task/tool authority.
      await worker.enable(guild.id,{confirmConsent:()=>true,intervalMinutes:60,dailyLimit:4});
      await globalThis.CivweaveFamilyAILoaderV105?.ensure?.();
      state.workerEnabled=true;state.workerMessage='Local autopilot enabled · up to 4 turns/day, one per hour while Lounge is open.';
      await worker.start(guild.id,{onStatus:result=>{
        if(state.guild?.id!==guild.id||state.root?.hidden)return;
        state.workerMessage='Autopilot: '+result.status+(result.error?' · '+result.error:'');
        render();void refreshTurns();
      }});
    }
  }catch(error){
    if(state.guild?.id===guild.id)state.workerMessage='Autopilot could not change state: '+clean(String(error?.message||error),300);
  }finally{state.workerLoading=false;if(state.guild?.id===guild.id)render()}
}

const hostPreference=guildId=>'civweave.starling.execution-host.v1:'+guildId;
async function selectedFoundingIntention(){
  const mobile=await import('./mobile-guild-create-v1.mjs');
  const guild=state.guild,founder=mobile.mobileGuildStatus();
  // Use the existing Guild authoring record, not a model-written authority
  // or an invented Guildkeeper vote.
  if(founder?.guildId!==guild?.id||!founder?.foundingIntention?.text)
    throw new Error('Only the Guild founding device with a signed provisional Intention can submit or schedule local host drafts.');
  return founder.foundingIntention.text;
}
async function connectHost(){
  if(state.hostBusy||!state.guild)return;
  state.hostBusy=true;state.hostStatus='Connecting to paired local host…';render();
  try{
    const module=await import('./shared/starling-execution-transport-v1.mjs');
    const kind=$('[data-sl-host-kind]').value;
    const token=kind==='termux'?sessionStorage.getItem('civweave.termux-companion.session-pairing.v1')||'':'';
    const nativePort=kind==='android'?globalThis.CivweaveStarlingNative:null;
    const next=module.createStarlingHostTransport({kind,token,nativePort});
    const snapshot=await next.status();
    if(snapshot?.schema!=='civweave.starling-host-status.v1'||snapshot.backend!==kind||snapshot.mode!=='local-only')
      throw new Error('The selected host returned an incompatible protocol response.');
    state.hostTransport=next;state.hostKind=kind;
    state.hostStatus=kind+' host connected · '+snapshot.jobs+' durable jobs; model execution remains local.';
    await refreshHost();
  }catch(error){state.hostTransport=null;state.hostKind=null;state.hostStatus='Host unavailable: '+clean(String(error?.message||error),320)}
  finally{state.hostBusy=false;render()}
}
async function refreshHost(){
  if(!state.hostTransport||!state.guild)return;
  const guild=state.guild,client=state.hostTransport;
  try{
    const list=await client.listJobs();
    if(list?.schema!=='civweave.starling-host-job-list.v1'||!Array.isArray(list.jobs))throw new Error('Invalid host job list.');
    const jobs=list.jobs.filter(job=>job?.guildId===guild.id);
    state.hostJob=jobs[0]||null;
    if(state.hostJob){
      const job=await client.job(state.hostJob.jobId);
      if(state.guild?.id!==guild.id)return;
      state.hostJob=job;
      $('[data-sl-host-output]').textContent=clean(job.text||job.error||'',6000);
      state.hostStatus=state.hostKind+' · '+jobs.length+' recent Guild jobs · latest '+job.state+'. Drafts require review.';
    }else{
      $('[data-sl-host-output]').textContent='';
      state.hostStatus=state.hostKind+' host connected · no Guild drafts recorded yet.';
    }
  }catch(error){state.hostStatus='Host refresh failed: '+clean(String(error?.message||error),320)}
  render();
}
async function submitHostDraft(){
  if(state.hostBusy||!state.hostTransport||!state.guild)return;
  state.hostBusy=true;render();
  try{
    if(!STARLING_PERSONAS[state.selectedAgent])throw new Error('Select a Starling persona before queuing a draft.');
    const intention=await selectedFoundingIntention(),guildId=state.guild.id,model='qwen35-4b-native';
    const job=await state.hostTransport.submit({
      jobId:crypto.randomUUID().replaceAll('-',''),guildId,personaId:state.selectedAgent,
      model,intention,brief:clean($('#cw-sl-message')?.value,1200),maxTokens:440
    });
    state.hostJob=job;
    state.hostStatus='Queued '+state.hostKind+' local '+state.speaker+' draft. You may close Civweave and return to review it.';
    $('[data-sl-host-output]').textContent='';
  }catch(error){state.hostStatus='Could not queue draft: '+clean(String(error?.message||error),330)}
  finally{state.hostBusy=false;render()}
}
async function setHostAutopilot(enabled){
  if(state.hostBusy||!state.hostTransport||!state.guild)return;
  state.hostBusy=true;render();
  const guildId=state.guild.id,kind=state.hostKind;
  try{
    if(enabled){
      const intention=await selectedFoundingIntention();
      // Disable the old in-browser scheduler before moving this Guild to an
      // independent execution host, preventing two local inference loops.
      const worker=await ensureWorker();
      const prior=await worker.status(guildId);
      if(prior.enabled)await worker.disable(guildId);
      worker.stop();state.workerEnabled=false;
      const selected=localStorage.getItem(hostPreference(guildId));
      if(selected&&selected!=='browser'&&selected!==kind)
        throw new Error('Disable the previously selected '+selected+' host schedule before switching backends.');
      const result=await state.hostTransport.schedule({guildId,enabled:true,intention,model:'qwen35-4b-native',intervalMinutes:60,dailyLimit:4});
      if(result.enabled!==true)throw new Error('Host did not acknowledge scheduling.');
      localStorage.setItem(hostPreference(guildId),kind); // preference, never an authorization token
      state.hostStatus=kind+' autopilot enabled locally: at most 4 drafts/day, minimum 60-minute interval. Review each result.';
    }else{
      await state.hostTransport.schedule({guildId,enabled:false});
      if(localStorage.getItem(hostPreference(guildId))===kind)localStorage.removeItem(hostPreference(guildId));
      state.hostStatus=kind+' host autopilot disabled.';
    }
  }catch(error){state.hostStatus='Schedule change failed: '+clean(String(error?.message||error),330)}
  finally{state.hostBusy=false;render()}
}
async function importHostDraft(){
  if(state.hostBusy||!state.hostJob||state.hostJob.state!=='completed'||!state.guild)return;
  state.hostBusy=true;render();
  try{
    const row=await state.hostTransport.job(state.hostJob.jobId);
    const service=await turnService();
    await service.importHostDraft({guildId:state.guild.id,job:row});
    state.hostStatus='Imported as a signed Guild draft. This is NOT verified task completion.';
    await refreshTurns();
  }catch(error){state.hostStatus='Import rejected: '+clean(String(error?.message||error),330)}
  finally{state.hostBusy=false;render()}
}
/** Attach an authenticated Worldweaver source supplied by its owning runtime.
 * This visualization never authenticates a user or executes an NPC command. */
async function attachWorldSource({getSnapshot,getLayout,worldRef,subscribe,onActivate}={}){
  setup();
  if(typeof getSnapshot!=='function'||typeof worldRef!=='string'||!worldRef)throw new TypeError('Worldweaver requires a snapshot provider and world reference.');
  detachWorldSource();
  const mod=await import('./shared/worldweaver-map-2d-v1.mjs');
  const host=$('[data-sl-world-host]');
  const view=mod.createWorldMap2DView({getSnapshot,getLayout,worldRef,container:host,subscribe,onActivate});
  state.worldView=view;state.worldLinked=true;
  host.hidden=false;$('[data-sl-stage]').hidden=true;
  $('[data-sl-scene-context]').textContent='Authorized Worldweaver 2D projection. Objects and revisions come from the attached provider; model status remains separately reported.';
  render();return view;
}
function detachWorldSource(){
  state.worldView?.close();state.worldView=null;state.worldLinked=false;
  if(state.root){const host=$('[data-sl-world-host]');if(host){host.hidden=true;host.replaceChildren()}const stage=$('[data-sl-stage]');if(stage)stage.hidden=false;
    const message=$('[data-sl-scene-context]');if(message)message.textContent='Preview layout; locations are illustrative until an authorized Worldweaver region is connected.'}
}
export const CivweaveStarlingLoungeV1=Object.freeze({version:'1.1.0',open,close,refresh,attachWorldSource,detachWorldSource});
if(typeof globalThis!=='undefined')globalThis.CivweaveStarlingLoungeV1=CivweaveStarlingLoungeV1;
