import {STARLING_PERSONAS,guildQuestBeatSnapshot,discoverGuildOpportunities} from './shared/starling-collective-v1.mjs';
import {COLLECTIVE_TOOL_CATALOG} from './shared/starling-collective-tools-v1.mjs';

const ID='cw-starling-lounge';
const PEOPLE=Object.values(STARLING_PERSONAS);
const clean=(value,max=3000)=>typeof value==='string'?value.trim().slice(0,max):'';
const state={guild:null,speaker:'kami',root:null,feed:[],snapshot:null,opportunities:[],status:'idle',error:'',loading:false};
const $=selector=>state.root?.querySelector(selector);
const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!=null)node.textContent=String(text);return node};
const para=(parent,text,cls='')=>{const p=el('p',cls,text);parent.append(p);return p};
const human=person=>person?.name||'Unknown persona';
function setup(){
  if(state.root)return state.root;
  const style=document.createElement('link');style.rel='stylesheet';style.href='/app/starling-lounge-v1.css?v=starling-native-r1';document.head.append(style);
  const root=el('section');root.id=ID;root.setAttribute('aria-label','Starling Lounge');root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.hidden=true;
  root.innerHTML='<header class="sl-head"><div><small>THE COLLECTIVE · CIVWEAVE GUILD</small><h1>✦ Starling Lounge</h1></div><div class="sl-flex"><small data-sl-guild></small><button type="button" data-sl-action="refresh">Refresh</button><button type="button" data-sl-action="close" aria-label="Close Starling Lounge">Close ×</button></div></header><div class="sl-layout"><aside class="sl-card"><p class="sl-label">The cast · eight voices</p><div class="sl-cast" data-sl-cast></div><p class="sl-status">AI-generated fictional characters. Their internal deliberations do not count as human Guild votes.</p></aside><main class="sl-card"><p class="sl-label">The living lounge · activity and conversation</p><div class="sl-stage" data-sl-stage><div class="sl-moon"></div><img class="sl-stage-avatar" data-sl-stage-avatar alt="Selected Starling Collective avatar"><div class="sl-stage-name" data-sl-stage-name></div></div><div class="sl-narrative" data-sl-summary></div><h2>Collective conversation</h2><div class="sl-feed" data-sl-feed aria-live="polite"></div><form class="sl-compose" data-sl-form><label for="cw-sl-message">Communicate with the Collective</label><textarea id="cw-sl-message" maxlength="1500" placeholder="Write a message for the Collective or selected persona…" required></textarea><button type="submit" class="sl-strong">Open message in Civweave chat</button></form><p class="sl-status" data-sl-message-status>Messages open in Civweave’s existing chat. Direct persona delivery is not enabled until the native worker is installed.</p></main><aside class="sl-card sl-work"><p class="sl-label">The maker’s corner · Guild Quest tracker</p><div class="sl-metric-row" data-sl-metrics></div><h2>Quest beats and outputs</h2><div data-sl-outputs></div><h3>Possible AI help</h3><div data-sl-offers></div><h3>Collective Toolbench</h3><div data-sl-toolbench></div><p class="sl-status" data-sl-work-status></p></aside></div>';
  root.addEventListener('click',click);
  root.querySelector('[data-sl-form]').addEventListener('submit',send);
  root.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close()}});
  document.body.append(root);state.root=root;
  renderCast();render();return root;
}
function renderCast(){
  const target=$('[data-sl-cast]');if(!target)return;
  target.replaceChildren();
  for(const person of PEOPLE){
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
  if(!state.feed.length){para(node,'No recorded Collective turns for this Guild yet. When the native model scheduler is connected, real persona conversations and decisions will appear here.','sl-sub');return}
  for(const message of state.feed.slice(-120)){
    const entry=el('article','sl-entry');
    const who=STARLING_PERSONAS[message.personaId];
    entry.append(el('b','',who?.name||message.personaId));
    const time=el('time','',new Date(message.at).toLocaleString());entry.append(time);
    para(entry,message.text);
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
    state.opportunities=discoverGuildOpportunities({snapshot:state.snapshot,capabilities:[],verifyHumanPublisher:()=>false});
    state.status=cursor?'partial':'synced';
  }catch(error){state.snapshot=null;state.opportunities=[];state.status='unavailable';state.error=clean(String(error?.message||error),500)}
  finally{state.loading=false;render()}
}
function close(){if(!state.root)return;state.root.hidden=true;document.body.style.removeProperty('overflow')}
function open(guild){
  if(!guild?.id)throw new TypeError('Select an existing Guild first.');
  setup();
  if(state.guild?.id!==guild.id){state.guild={id:guild.id,name:clean(guild.name||guild.displayName,240)};state.feed=[];state.snapshot=null;state.opportunities=[];state.status='idle'}
  state.root.hidden=false;document.body.style.overflow='hidden';render();state.root.querySelector('[data-sl-action=close]').focus();void refresh();
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
  if(cmd==='refresh')void refresh();
  if(cmd==='quest'){close();globalThis.CivweaveGuildQuestTrackerV1?.openQuestMap?.()}
}
/** Display-only runtime event hook. The future authenticated Collective runner
 * must record durable evidence itself; events alone confer no authority. */
function activity(event){
  const packet=event?.detail;
  if(!packet||packet.guildId!==state.guild?.id||!STARLING_PERSONAS[packet.personaId]||typeof packet.text!=='string')return;
  state.feed.push({personaId:packet.personaId,text:packet.text.slice(0,3500),at:new Date().toISOString()});
  state.feed=state.feed.slice(-120);state.speaker=packet.personaId;render();
}
if(typeof globalThis.addEventListener==='function')globalThis.addEventListener('civweave:starling-turn-recorded',activity);
export const CivweaveStarlingLoungeV1=Object.freeze({version:'1.0.0',open,close,refresh});
if(typeof globalThis!=='undefined')globalThis.CivweaveStarlingLoungeV1=CivweaveStarlingLoungeV1;
