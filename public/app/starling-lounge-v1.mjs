import {STARLING_PERSONAS,guildQuestBeatSnapshot,discoverGuildOpportunities} from './shared/starling-collective-v1.mjs';
import {COLLECTIVE_TOOL_CATALOG} from './shared/starling-collective-tools-v1.mjs';

const ID='cw-starling-lounge';
const PEOPLE=Object.values(STARLING_PERSONAS);
const clean=(value,max=3000)=>typeof value==='string'?value.trim().slice(0,max):'';
const state={guild:null,speaker:'kami',root:null,feed:[],snapshot:null,opportunities:[],status:'idle',error:'',loading:false,turnsLoading:false,turnsRunning:false,turnError:'',turnMessage:'No local model run has started.',turnService:null,turnMesh:null,turnSubscribe:null,worker:null,workerEnabled:false,workerMessage:'Local autopilot is off.',workerLoading:false,hostTransport:null,hostKind:null,hostJob:null,hostStatus:'Choose a host and connect.',hostBusy:false};
const $=selector=>state.root?.querySelector(selector);
const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!=null)node.textContent=String(text);return node};
const para=(parent,text,cls='')=>{const p=el('p',cls,text);parent.append(p);return p};
const human=person=>person?.name||'Unknown persona';
function setup(){
  if(state.root)return state.root;
  const style=document.createElement('link');style.rel='stylesheet';style.href='/app/starling-lounge-v1.css?v=starling-native-r1';document.head.append(style);
  const root=el('section');root.id=ID;root.setAttribute('aria-label','Starling Lounge');root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.hidden=true;
  root.innerHTML='<header class="sl-head"><div><small>THE COLLECTIVE · CIVWEAVE GUILD</small><h1>✦ Starling Lounge</h1></div><div class="sl-flex"><small data-sl-guild></small><button type="button" data-sl-action="refresh">Refresh</button><button type="button" data-sl-action="close" aria-label="Close Starling Lounge">Close ×</button></div></header><div class="sl-layout"><aside class="sl-card"><p class="sl-label">The cast · eight voices</p><div class="sl-cast" data-sl-cast></div><p class="sl-status">AI-generated fictional characters. Their internal deliberations do not count as human Guild votes.</p></aside><main class="sl-card"><p class="sl-label">The living lounge · activity and conversation</p><div class="sl-stage" data-sl-stage><div class="sl-moon"></div><div class="sl-ensemble" data-sl-ensemble aria-label="Collective personas"></div><img class="sl-stage-avatar" data-sl-stage-avatar alt="Selected Starling Collective avatar"><div class="sl-stage-name" data-sl-stage-name></div></div><div class="sl-narrative" data-sl-summary></div><div class="sl-flex sl-run"><h2 class="sl-grow">Collective conversation</h2><button type="button" class="sl-strong" data-sl-action="turn">Run one local turn</button><button type="button" data-sl-action="round">Run 3-person round</button></div><p class="sl-status" data-sl-turn-status>No local model run has started. Runs are explicitly started, one at a time, and never use hosted credits.</p><div class="sl-flex sl-autopilot"><button type="button" data-sl-action="worker-toggle">Enable local autopilot</button><small data-sl-worker-status>Off · Guildkeeper opt-in required · runs only while Lounge is open.</small></div><div class="sl-feed" data-sl-feed aria-live="polite"></div><form class="sl-compose" data-sl-form><label for="cw-sl-message">Brief for the selected persona</label><textarea id="cw-sl-message" maxlength="1500" placeholder="Give the persona one focused task or question. Running a local turn records this brief for Guild review…" required></textarea><button type="submit" class="sl-strong">Open message in Civweave chat</button></form><p class="sl-status" data-sl-message-status>Run one local turn to deliver this brief to the selected persona through your local model. Both brief and reply are saved to the Guild mesh. Open in Civweave chat uses the existing shared chat instead.</p></main><aside class="sl-card sl-work"><p class="sl-label">The maker’s corner · Guild Quest tracker</p><div class="sl-metric-row" data-sl-metrics></div><h2>Quest beats and outputs</h2><div data-sl-outputs></div><h3>Possible AI help</h3><div data-sl-offers></div><h3>Collective Toolbench</h3><div data-sl-toolbench></div><section class="sl-host-panel" aria-label="Local execution host"><h3>Local execution host</h3><p class="sl-sub">Run and recover drafts after closing the Lounge, using either Android native work or the paired Termux host. No task claims or spending.</p><label>Backend <select data-sl-host-kind><option value="termux">Termux companion · port 8767</option><option value="android">Android native bridge · WorkManager</option></select></label><div class="sl-flex"><button type="button" data-sl-action="host-connect">Connect</button><button type="button" data-sl-action="host-submit">Queue local draft</button><button type="button" data-sl-action="host-refresh">Refresh jobs</button></div><div class="sl-flex"><button type="button" data-sl-action="host-enable">Enable host autopilot</button><button type="button" data-sl-action="host-disable">Disable host autopilot</button></div><p class="sl-status" data-sl-host-status role="status">Choose a host and connect.</p><pre data-sl-host-output class="sl-host-output"></pre><button type="button" data-sl-action="host-import">Import completed draft for Guild review</button></section><p class="sl-status" data-sl-work-status></p></aside></div>';
  root.addEventListener('click',click);
  root.querySelector('[data-sl-form]').addEventListener('submit',send);
  root.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close()}});
  document.body.append(root);state.root=root;
  renderCast();render();return root;
}
function renderCast(){
  const target=$('[data-sl-cast]');if(!target)return;
  target.replaceChildren();
  const orbit=$('[data-sl-ensemble]');orbit.replaceChildren();
  for(const person of PEOPLE){
    const chip=el('button','sl-stage-persona');chip.type='button';chip.dataset.slPersona=person.id;chip.setAttribute('aria-label','Select '+person.name);chip.setAttribute('aria-pressed',String(person.id===state.speaker));
    const portrait=el('img');portrait.src='/app/assets/starling/'+person.id+'.svg';portrait.alt='';portrait.loading='lazy';chip.append(portrait);orbit.append(chip);
    const b=el('button','sl-persona');b.type='button';b.dataset.slPersona=person.id;b.setAttribute('aria-pressed',String(state.speaker===person.id));
    const avatar=el('img','sl-avatar');avatar.src='/app/assets/starling/'+person.id+'.svg';avatar.alt='';avatar.loading='lazy';
    const label=el('span');label.append(el('b','',person.name),el('small','',person.role));
    b.append(avatar,label);target.append(b);
  }
}
function renderSpeaker(){
  const person=STARLING_PERSONAS[state.speaker]||STARLING_PERSONAS.kami;
  $('[data-sl-stage-avatar]').src='/app/assets/starling/'+person.id+'.svg';
  $('[data-sl-stage-avatar]').style.setProperty('--avatar',person.color);
  $('[data-sl-stage-name]').textContent=person.name+' · '+person.role;
  $('[data-sl-summary]').textContent=person.goal+'. '+person.style+'.';
  for(const button of state.root.querySelectorAll('[data-sl-persona]'))button.setAttribute('aria-pressed',String(button.dataset.slPersona===person.id));
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
function close(){if(!state.root)return;state.root.hidden=true;state.turnSubscribe?.();state.turnSubscribe=null;state.worker?.stop();document.body.style.removeProperty('overflow')}
function open(guild){
  if(!guild?.id)throw new TypeError('Select an existing Guild first.');
  setup();
  if(state.guild?.id!==guild.id){state.guild={id:guild.id,name:clean(guild.name||guild.displayName,240)};state.feed=[];state.snapshot=null;state.opportunities=[];state.status='idle';state.turnError='';state.turnMessage='Loading signed Guild Collective turns…';state.worker?.stop();state.workerEnabled=false;state.workerMessage='Local autopilot is off.';state.hostTransport=null;state.hostKind=null;state.hostJob=null;state.hostStatus='Choose a host and connect.'}
  state.root.hidden=false;document.body.style.overflow='hidden';render();state.root.querySelector('[data-sl-action=close]').focus();void refresh();void refreshTurns();void refreshWorkerStatus();
}
async function send(event){
  event.preventDefault();
  const message=clean($('#cw-sl-message')?.value,1500);
  if(!message)return;
  const status=$('[data-sl-message-status]');
  const loader=globalThis.CivweaveFamilyAILoaderV105;
  if(typeof loader?.openChat!=='function'){status.textContent='Civweave’s shared chat is not available here. No message was sent.';return}
  const person=STARLING_PERSONAS[state.speaker],guild=state.guild;
  const prefill='For the optional Starling Collective, '+person.name+', in Guild '+(guild?.name||guild?.id)+': '+message;
  try{
    await loader.openChat('civweave',{prefill,contextSystem:'civweave'});
    status.textContent='Opened an addressed draft in the canonical Civweave chat. Direct delivery to Starling personas is not active yet.';
  }catch(error){status.textContent='Could not open Civweave chat: '+clean(String(error?.message||error),250)}
}
function click(event){
  const persona=event.target.closest('[data-sl-persona]')?.dataset.slPersona;
  if(persona&&STARLING_PERSONAS[persona]){state.speaker=persona;renderSpeaker();return}
  const cmd=event.target.closest('[data-sl-action]')?.dataset.slAction;
  if(cmd==='close')close();
  if(cmd==='refresh'){void refresh();void refreshTurns()}
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
    if(turns.length)state.speaker=turns.at(-1).personaId;
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
  const guild=state.guild,personaId=state.speaker;
  state.turnsRunning=true;state.turnError='';
  state.turnMessage='The selected local model is generating one turn. No cloud budget or automatic loop is enabled.';
  render();
  try{
    await globalThis.CivweaveFamilyAILoaderV105?.ensure?.();
    const service=await turnService();
    await service.runOneTurn({guildId:guild.id,personaId,taskPrompt:clean($('#cw-sl-message')?.value,1200)});
    if(state.guild?.id===guild.id){$('#cw-sl-message').value='';state.turnMessage='Local model turn saved and signed to Guild mesh.';await refreshTurns()}
  }catch(error){if(state.guild?.id===guild.id)state.turnError=clean(String(error?.message||error),500)}
  finally{state.turnsRunning=false;if(state.guild?.id===guild.id)render()}
}
async function runLocalRound(){
  if(state.turnsRunning||!state.guild)return;
  const guild=state.guild;
  const ids=Object.keys(STARLING_PERSONAS),start=ids.indexOf(state.speaker);
  const personas=[0,1,2].map(offset=>ids[(Math.max(0,start)+offset)%ids.length]);
  state.turnsRunning=true;state.turnError='';
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
          state.speaker=record.payload.personaId;
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
    const intention=await selectedFoundingIntention(),guildId=state.guild.id,model='qwen35-4b-native';
    const job=await state.hostTransport.submit({
      jobId:crypto.randomUUID().replaceAll('-',''),guildId,personaId:state.speaker,
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
export const CivweaveStarlingLoungeV1=Object.freeze({version:'1.0.0',open,close,refresh});
if(typeof globalThis!=='undefined')globalThis.CivweaveStarlingLoungeV1=CivweaveStarlingLoungeV1;
