(()=>{
'use strict';

const VERSION='1.5.0-shared-quest-pathway-map';
const ROOT_ID='cerbanimo-intention-landscape';
const INTENTIONS_KEY='civweave.intentions.v127';
const DISCOVERY_KEY='civweave.hub-discovery.v1';
const MESH_KEY='federation-finder.mesh-nodes.v1';
const DIRECTORY_ENDPOINT='/api/hub-map-nodes';
const DIRECTORY_CACHE_KEY='civweave.hub-map.directory.v1';
const HOST_SELECTION_KEY='civweave.host-node.selection.v1';
const HOUSE_KEY='civweave.hub-houses.v1';
const HOUSE_VOTE_KEY='civweave.anarchadia.pending-proposals.v1';
const VOTE_INDEX_KEY='civweave.anarchadia.vote-index.v1';
const GOVERNANCE_DB='civweave-anarchadia-governance-v145';
const GOVERNANCE_STORE='state';

const HOUSES=Object.freeze([
{id:'magenta',name:'House Magenta',solid:'#ff46b7',soft:'#ffb9e7',ink:'#4b082f'},
{id:'cyan',name:'House Cyan',solid:'#35e4ea',soft:'#bdfbff',ink:'#073c45'},
{id:'amber',name:'House Amber',solid:'#ffc24a',soft:'#ffe4a4',ink:'#513400'},
{id:'purple',name:'House Purple',solid:'#a06bff',soft:'#d9c7ff',ink:'#2d155b'},
{id:'pearl',name:'House Pearl',solid:'#f4f1ea',soft:'#ffffff',ink:'#32313a'}
]);
const PATHS=Object.freeze({
'living-school':{id:'living-school',label:'Living School',strap:'Learn & Grow',solid:'#aeea57',soft:'#d8f6a4'},
cerbanimo:{id:'cerbanimo',label:'Cerbanimo',strap:'Design & Build',solid:'#e85dff',soft:'#f3b0ff'},
fellowfare:{id:'fellowfare',label:'FellowFare',strap:'Support & Share',solid:'#efb452',soft:'#f8d99a'},
anarchadia:{id:'anarchadia',label:'Anarchadia',strap:'Agree & Govern',solid:'#ff3d96',soft:'#f6d0df'}
});
const UNASSIGNED_PATH=Object.freeze({id:'unassigned',label:'Unassigned paths',strap:'Subsystem not recognized',solid:'#aebbd0',soft:'#e4eaf5'});
const TIER_COLORS=Object.freeze({guild:'#8af5d2',quest:'#e85dff',map:'#efb452'});
const VOTE_COLORS=['#ff3d9f','#48e6ff','#ffd84e','#9c63ff','#4df2a6','#ff7b54','#67a8ff','#f47dff','#9ee34e','#ffae57'];
const COMPLETE=new Set(['completed','complete','done','closed','fulfilled','settled','accepted','delivered','verified','passed']);
const DEFAULT_GUILD_THEME=Object.freeze({solid:'#8af5d2',soft:'#c9ffef',ink:'#083d32'});

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const parse=(v,f)=>{try{const out=JSON.parse(v);return out==null?f:out}catch{return f}};
const clean=(v,max=1800)=>String(v??'').trim().slice(0,max);
const uid=p=>`${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const arr=v=>Array.isArray(v)?v:[];
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const hash=v=>{let out=2166136261;for(const c of String(v??'')){out^=c.charCodeAt(0);out=Math.imul(out,16777619)}return out>>>0};
const isComplete=v=>COMPLETE.has(clean(v,60).toLowerCase());
const state={screen:1,guildIndex:0,questIndex:0,guilds:[],votes:[],touchStart:null,wheelLock:false,observer:null,rendering:false,shell:null,directoryLoading:false,directoryState:'idle',boards:new Map(),composer:null,publicationBusy:false,publicationNotice:'',withdrawReview:'',requestedSubmission:'',mapSelection:null};

function query(){return new URLSearchParams(location.search)}
function isCivweave(){const data=document.documentElement?.dataset||{},route=globalThis.CivweaveSystemRoutesV227?.identify?.(location.pathname)||'';return route==='civweave'||query().get('system')==='civweave'||data.civweaveSystemRoute==='civweave'||data.civweaveSystem==='civweave'||data.system==='civweave'}
function shouldOwnSurface(){const q=query();return isCivweave()&&!q.get('capability')&&!q.get('room')}
function houseStore(){const raw=parse(localStorage.getItem(HOUSE_KEY),{});return raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{}}
function normalizeHouse(v){const id=clean(typeof v==='object'?v?.id:v,40).toLowerCase();return HOUSES.find(x=>x.id===id)||null}
function houseFor(guild){
  const explicit=normalizeHouse(guild?.house||guild?.houseId||guild?.theme);
  if(explicit)return explicit;
  const id=clean(guild?.id||guild?.name,160);
  if(!id)return null;
  return normalizeHouse(houseStore()[id]);
}
function houseVars(house){const h=house||DEFAULT_GUILD_THEME;return`--house:${h.solid};--house-soft:${h.soft};--house-ink:${h.ink}`}

function normalizeSlots(raw){
  const slots=raw?.slots&&typeof raw.slots==='object'?raw.slots:{};
  const citizen=Number(slots.citizen??slots.free??raw?.citizenSlots??raw?.freeSlots);
  const patron=Number(slots.patron??slots.paid??raw?.patronSlots??raw?.paidSlots);
  return{
    citizen:Number.isFinite(citizen)&&citizen>=0?Math.floor(citizen):null,
    patron:Number.isFinite(patron)&&patron>=0?Math.floor(patron):null
  };
}
function normalizeGuild(raw,index=0,source='discovery'){
  if(!raw||typeof raw!=='object')return null;
  const id=clean(raw.id||raw.guildId||raw.hubId||raw.nodeId||raw.slug,180);
  const name=clean(raw.guildName||raw.displayName||raw.name||raw.label||raw.hubName||raw.nodeName,180);
  if(!id||!name)return null;
  const description=clean(raw.description||raw.summary||raw.about||raw.purpose||raw.bio,1200);
  const quests=arr(raw.sharedIntentions||raw.intentions||raw.publicIntentions||raw.weaves||raw.quests);
  const distance=Number(raw.distanceKm??raw.distance??raw.proximityKm),boost=Number(raw.boostScore??raw.boost??(raw.boosted?1:0))||0;
  const location=raw.location&&typeof raw.location==='object'?raw.location:raw.publicLocation&&typeof raw.publicLocation==='object'?raw.publicLocation:null;
  return{
    id,name,description,quests,
    boosted:Boolean(raw.boosted||boost>0),boost,
    distance:Number.isFinite(distance)?distance:null,
    source,
    house:raw.house||raw.houseId||raw.theme||'',
    status:clean(raw.status,40),
    publicOrigin:clean(raw.publicOrigin||raw.origin||raw.endpoint,1000),
    slots:normalizeSlots(raw),
    location,
    raw
  };
}
function normalizeDirectoryGuild(raw,index=0){return normalizeGuild(raw,index,'directory')}
function localIntentions(){return arr(parse(localStorage.getItem(INTENTIONS_KEY),[])).filter(x=>x&&typeof x==='object')}
function selectedGuildRecord(){const value=parse(localStorage.getItem(HOST_SELECTION_KEY),null);return value&&typeof value==='object'?value:null}
function directoryCache(){const value=parse(localStorage.getItem(DIRECTORY_CACHE_KEY),null);return value?.schema==='civweave.hub-map-directory.v1'&&Array.isArray(value.nodes)?value:null}
function mergeGuild(current,next){
  if(!current)return next;
  const quests=next.quests.length?next.quests:current.quests;
  return{
    ...current,...next,
    description:next.description||current.description,
    quests,
    house:next.house||current.house,
    status:next.status||current.status,
    publicOrigin:next.publicOrigin||current.publicOrigin,
    location:next.location||current.location,
    slots:{citizen:next.slots?.citizen??current.slots?.citizen??null,patron:next.slots?.patron??current.slots?.patron??null},
    raw:{...(current.raw||{}),...(next.raw||{})}
  };
}
function discoveredGuilds(){
  const byId=new Map();
  const add=guild=>{if(!guild)return;byId.set(guild.id,mergeGuild(byId.get(guild.id),guild))};
  const discovery=parse(localStorage.getItem(DISCOVERY_KEY),[]),rows=Array.isArray(discovery)?discovery:arr(discovery?.hubs||discovery?.guilds||discovery?.items||Object.values(discovery||{}));
  rows.forEach((row,i)=>add(normalizeGuild(row,i,'discovery')));
  const mesh=parse(localStorage.getItem(MESH_KEY),[]),meshRows=Array.isArray(mesh)?mesh:Object.values(mesh||{});
  meshRows.forEach((row,i)=>add(normalizeGuild(row,i,'mesh')));
  const cached=directoryCache();
  arr(cached?.nodes).forEach((row,i)=>add(normalizeDirectoryGuild(row,i)));

  const selected=selectedGuildRecord(),selectedId=clean(selected?.nodeId||selected?.guildId||selected?.hubId||selected?.id,180);
  if(selectedId){
    let guild=byId.get(selectedId);
    if(!guild){
      guild=normalizeGuild({
        ...selected,
        id:selectedId,
        nodeId:selectedId,
        displayName:selected.displayName||selected.guildName||selected.name,
        publicOrigin:selected.origin||selected.publicOrigin
      },0,'local');
    }
    if(guild){
      guild={...guild,source:'local'};
      byId.set(guild.id,guild);
    }
  }

  return[...byId.values()].sort((a,b)=>Number(b.source==='local')-Number(a.source==='local')||Number(b.boosted)-Number(a.boosted)||(b.boost-a.boost)||((a.distance??Infinity)-(b.distance??Infinity))||a.name.localeCompare(b.name));
}

function questClient(){return globalThis.CivweaveGuildQuestsV1||null}
function membership(guild){return questClient()?.sessionForGuild(guild)||null}
function boardFor(guild){const board=state.boards.get(guild?.id),session=membership(guild);return board&&session?.userId===board.userId?board:null}
async function refreshQuestBoard(guild=activeGuild(),{force=false,append=false}={}){
  if(!guild)return;
  const client=questClient(),session=membership(guild),prior=boardFor(guild);
  if(!client||!session||prior?.status==='loading'||!force&&prior)return;
  const board={userId:session.userId,status:'loading',quests:prior?.quests||[],nextCursor:prior?.nextCursor||null,error:''};state.boards.set(guild.id,board);renderSurface();
  try{
    const packet=await client.list(guild,{cursor:append?board.nextCursor||'':''});
    if(membership(guild)?.userId!==board.userId)return;
    const guildId=packet.guildId||packet.nodeId;
    const rows=arr(packet.quests).filter(row=>row?.status==='published'&&row.guildId===guildId&&row.quest);
    board.quests=append?[...board.quests,...rows].filter((row,index,all)=>all.findIndex(other=>other.id===row.id)===index):rows;
    board.guildId=guildId;board.nextCursor=packet.nextCursor||null;board.status='live';
  }catch(error){board.status='error';board.error=clean(error?.message||error,1200)}
  renderSurface();resumeRequestedSubmission();
}
function availableDrafts(){return localIntentions().flatMap(raw=>{try{return[{id:raw.id||raw.plan?.id,snapshot:questClient().preview(raw)}]}catch{return[]}})}
async function prepareSubmission(guild,draft){
  const composer={guildId:guild.id,draftId:draft?.id||'',snapshot:draft?.snapshot||null,expectedRevision:null,preparing:Boolean(draft)};state.composer=composer;state.publicationNotice='';renderSurface();if(!draft)return;
  try{const row=await questClient().ownPublication(guild,composer.snapshot,{guildId:boardFor(guild)?.guildId});if(state.composer===composer)composer.expectedRevision=row?.revision||0}catch(error){if(state.composer===composer)state.publicationNotice=clean(error?.message||error,1200)}finally{composer.preparing=false;if(state.composer===composer)renderSurface()}
}
function selectDraft(id){const guild=activeGuild();if(state.composer&&guild)void prepareSubmission(guild,availableDrafts().find(row=>row.id===id))}
function composeQuest(){const guild=activeGuild();if(guild&&membership(guild))void prepareSubmission(guild,availableDrafts()[0])}
function openSubmission(id){
  id=String(id||'');if(!/^[A-Za-z0-9:_-]{1,180}$/.test(id))return false;const draft=availableDrafts().find(row=>row.id===id);if(!draft)return false;
  state.requestedSubmission=id;state.screen=2;state.publicationNotice='';resumeRequestedSubmission();return true;
}
function resumeRequestedSubmission(){
  const id=state.requestedSubmission,guild=activeGuild();if(!id)return;
  const draft=availableDrafts().find(row=>row.id===id);if(!draft){state.requestedSubmission='';return}
  if(!guild){state.screen=1;renderSurface();return}
  if(!membership(guild)){renderSurface();return}
  const board=boardFor(guild);if(board?.status==='live'){state.requestedSubmission='';void prepareSubmission(guild,draft);return}
  if(!board)void refreshQuestBoard(guild,{force:true});else renderSurface();
}
async function publishQuest(){
  const guild=activeGuild(),composer=state.composer,client=questClient();if(state.publicationBusy||!guild||composer?.guildId!==guild.id||!composer.snapshot||!client||composer.preparing||composer.expectedRevision==null)return;
  state.publicationBusy=true;state.publicationNotice='';renderSurface();
  try{
    const packet=await client.publish(guild,composer.snapshot,{expectedRevision:composer.expectedRevision});
    const publication=packet.publication;if(!publication||publication.status!=='published')throw new Error('The Guild did not confirm publication.');
    const board=boardFor(guild)||{userId:membership(guild)?.userId,quests:[],nextCursor:null};board.quests=[publication,...board.quests.filter(row=>row.id!==publication.id)];board.status='live';board.error='';state.boards.set(guild.id,board);
    state.composer=null;state.publicationNotice=`Quest submitted to ${guild.name}. Guild members can now view it.`;state.questIndex=0;
  }catch(error){state.publicationNotice=clean(error?.message||error,1200)}finally{state.publicationBusy=false;renderSurface()}
}
async function withdrawQuest(){
  const guild=activeGuild(),publication=boardFor(guild)?.quests.find(row=>row.id===state.withdrawReview);if(state.publicationBusy||!publication)return;
  state.publicationBusy=true;state.publicationNotice='';renderSurface();
  try{await questClient().withdraw(guild,publication);const board=boardFor(guild);if(board)board.quests=board.quests.filter(row=>row.id!==publication.id);state.withdrawReview='';state.publicationNotice=`Quest withdrawn from ${guild.name}. Your local Quest is still available.`}catch(error){state.publicationNotice=clean(error?.message||error,1200)}finally{state.publicationBusy=false;renderSurface()}
}
async function refreshDirectory(){
  if(state.directoryLoading||navigator.onLine===false)return;
  state.directoryLoading=true;
  state.directoryState='loading';
  try{
    const response=await fetch(DIRECTORY_ENDPOINT,{cache:'no-store',headers:{accept:'application/json'}}),packet=await response.json().catch(()=>({}));
    if(!response.ok||packet?.ok!==true||!Array.isArray(packet.nodes))throw new Error(packet?.error||`HTTP ${response.status}`);
    try{localStorage.setItem(DIRECTORY_CACHE_KEY,JSON.stringify(packet))}catch{}
    state.directoryState='live';
    state.guilds=discoveredGuilds();
    state.guildIndex=clamp(state.guildIndex,0,Math.max(0,state.guilds.length-1));
    state.questIndex=0;
    renderSurface();
  }catch{
    state.directoryState=directoryCache()?'cached':'unavailable';
    if(!state.guilds.length){state.guilds=discoveredGuilds();renderSurface()}
  }finally{state.directoryLoading=false}
}

function normalizeNeeds(quest){
  const raw=quest?.openNeeds||quest?.needs||quest?.plan?.needs||quest?.plan?.openNeeds||[];
  const direct=arr(raw).map((need,i)=>typeof need==='string'?{id:`need-${i}`,title:clean(need,240),realm:''}:{id:clean(need?.id||`need-${i}`,120),title:clean(need?.title||need?.name||need?.label||need?.description,240),realm:clean(need?.realm||need?.system,40)}).filter(x=>x.title);
  if(direct.length)return direct;
  const derived=[];
  for(const path of arr(quest?.plan?.paths||quest?.paths)){
    const source=arr(path?.tasks).length?arr(path.tasks):arr(path?.steps),progress=arr(path?.progress);
    source.forEach((task,i)=>{
      const status=clean(typeof task==='object'?task?.status:path?.status,40).toLowerCase();
      if(COMPLETE.has(status)||progress.includes(i))return;
      const title=clean(typeof task==='string'?task:task?.need||task?.title||task?.name||task?.label||task?.deliverable||task?.description,240);
      if(title)derived.push({id:clean(typeof task==='object'?task?.id||`need-${derived.length}`:`need-${derived.length}`,120),title,realm:clean(path?.realm||task?.realm,40)});
    });
  }
  return derived.slice(0,8);
}
function normalizeQuest(raw,index=0){
  if(!raw||typeof raw!=='object')return null;
  const plan=raw.plan&&typeof raw.plan==='object'?raw.plan:raw;
  const title=clean(plan.title||raw.title||raw.text||raw.name,160);
  if(!title)return null;
  const id=clean(raw.id||plan.id||`quest-${index}`,180),description=clean(plan.outcome||raw.description||raw.summary||raw.text,1000);
  return{id,title,description,state:clean(raw.state||plan.state||'shared',40),needs:normalizeNeeds(raw),plan,raw};
}
function questVisible(raw){const mode=globalThis.CivweaveLudModeV1;return mode?.isEnabled?.()===true?mode.contentVisible?.(raw)===true:true}
function questsFor(guild){const board=boardFor(guild);return board?board.quests.filter(row=>questVisible(row.quest)).map(row=>{const quest=normalizeQuest(row.quest);return quest?{...quest,publication:row}:null}).filter(Boolean):arr(guild?.quests).filter(questVisible).map(normalizeQuest).filter(Boolean)}
function realmForPath(path){const v=clean(path?.realm||path?.system||path?.type,80).toLowerCase();if(v.includes('living')||v.includes('learn'))return'living-school';if(/anarchadia|governance|civic|consent|agreement|vote/.test(v))return'anarchadia';if(v.includes('fellow')||v.includes('market')||v.includes('resource')||v.includes('mentor')||v.includes('outsource')||v.includes('material'))return'fellowfare';if(/cerbanimo|skilled|labor|design|build|productive/.test(v))return'cerbanimo';return'unassigned'}
function pathSpec(path){return PATHS[realmForPath(path)]||UNASSIGNED_PATH}
function pathLabel(path){return[clean(path?.title,240),clean(path?.realm||path?.system||path?.type,80)].filter(Boolean).join(' · ')}
function taskList(path){
  const source=arr(path?.tasks).length?arr(path.tasks):arr(path?.steps),progress=new Set(arr(path?.progress).map(Number)),pathDone=isComplete(path?.status);
  return source.map((task,i)=>{
    if(typeof task==='string')return{index:i,id:`${realmForPath(path)}-${i}`,title:clean(task,220),status:pathDone||progress.has(i)?'completed':'ready',complete:pathDone||progress.has(i),raw:{}};
    const title=clean(task?.title||task?.name||task?.label||task?.deliverable||task?.description,220);
    if(!title)return null;
    const status=clean(task?.status||((pathDone||progress.has(i))?'completed':'ready'),40);
    return{index:i,id:clean(task?.id||task?.taskId||`${realmForPath(path)}-${i}`,160),title,status,complete:isComplete(status)||pathDone||progress.has(i),raw:task||{}};
  }).filter(Boolean);
}
function mapFor(quest){const lanes=Object.fromEntries(Object.keys(PATHS).map(realm=>[realm,[]]));for(const path of arr(quest?.plan?.paths||quest?.raw?.paths||quest?.plan?.tracks)){const realm=realmForPath(path);if(!lanes[realm])lanes[realm]=[];lanes[realm].push(...taskList(path).map(task=>({...task,pathLabel:pathLabel(path)})))}return lanes}
function questProgress(quest){const tasks=Object.values(mapFor(quest)).flat(),done=tasks.filter(x=>x.complete).length;return{done,total:tasks.length,percent:tasks.length?Math.round(done/tasks.length*100):0}}

function voteId(vote,i=0){return clean(vote?.id||vote?.voteId||vote?.proposalId||vote?.proposal_id||vote?.slug||`vote-${i}`,180)}
function voteTaskIds(vote){return new Set(arr(vote?.taskIds||vote?.relatedTaskIds||vote?.tasks||vote?.targets).map(x=>clean(typeof x==='object'?x?.id||x?.taskId:x,180)).filter(Boolean))}
function normalizeVotes(raw){const source=Array.isArray(raw)?raw:arr(raw?.votes||raw?.proposals||raw?.ballots||raw?.items);return source.map((vote,i)=>{const id=voteId(vote,i);return{id,label:clean(vote?.title||vote?.label||vote?.question||vote?.name||'Open vote',180),status:clean(vote?.status||vote?.state||'open',40).toLowerCase(),taskIds:voteTaskIds(vote),raw:vote}}).filter(v=>v.id&&!COMPLETE.has(v.status))}
function localVotes(){const a=parse(localStorage.getItem(VOTE_INDEX_KEY),[]),b=parse(localStorage.getItem(HOUSE_VOTE_KEY),[]);return[...normalizeVotes(a),...normalizeVotes(b)].filter((v,i,all)=>all.findIndex(x=>x.id===v.id)===i)}
function readGovernanceState(){if(!globalThis.indexedDB)return Promise.resolve(null);return new Promise(resolve=>{let request;try{request=indexedDB.open(GOVERNANCE_DB)}catch{return resolve(null)}request.onerror=()=>resolve(null);request.onsuccess=()=>{const db=request.result;if(!db.objectStoreNames.contains(GOVERNANCE_STORE)){db.close();resolve(null);return}try{const get=db.transaction(GOVERNANCE_STORE,'readonly').objectStore(GOVERNANCE_STORE).get('active');get.onsuccess=()=>{const v=get.result;db.close();resolve(v||null)};get.onerror=()=>{db.close();resolve(null)}}catch{db.close();resolve(null)}}})}
async function refreshVotes(){const governance=await readGovernanceState(),combined=[...localVotes(),...normalizeVotes(governance)];state.votes=combined.filter((v,i,all)=>all.findIndex(x=>x.id===v.id)===i);if(shouldOwnSurface())renderSurface()}
function votesForTask(task){const direct=arr(task?.raw?.votes||task?.raw?.voteIds||task?.raw?.anarchadiaVotes).map((vote,i)=>typeof vote==='object'?{id:voteId(vote,i),label:clean(vote?.title||'Open vote',180),taskIds:new Set([task.id]),status:'open'}:{id:clean(vote,180),label:'Open vote',taskIds:new Set([task.id]),status:'open'}).filter(v=>v.id),linked=state.votes.filter(v=>v.taskIds.has(task.id));return[...direct,...linked].filter((v,i,all)=>all.findIndex(x=>x.id===v.id)===i)}
function voteNumber(vote){const ordered=[...state.votes].sort((a,b)=>a.id.localeCompare(b.id)),i=ordered.findIndex(x=>x.id===vote.id);return(i>=0?i:hash(vote.id)%99)+1}
function voteColor(vote){return VOTE_COLORS[hash(vote.id)%VOTE_COLORS.length]}

function guildMeta(g){
  const bits=[];
  if(g.source==='local')bits.push('Your Guild');
  else if(g.source==='directory')bits.push('Guild Map');
  else if(g.source==='mesh')bits.push('Nearby Guild');
  else bits.push('Discovered Guild');
  if(g.status)bits.push(g.status);
  if(g.boosted)bits.push('Boosted');
  if(Number.isFinite(g.distance)&&g.distance>0)bits.push(`${g.distance<10?g.distance.toFixed(1):Math.round(g.distance)} km`);
  return bits.join(' · ');
}
function tierCopy(){return[{title:'Choose a Guild',subtitle:'Find your people. Join their purpose.'},{title:'Choose a Quest',subtitle:'See the shared intentions of your Guild.'},{title:'Quest Map',subtitle:'Your action routes. Your impact.'}][state.screen-1]}
function carousel(items,selected,kind){
  if(!items.length)return`<div class="cil-empty-rail">No ${kind==='guild'?'Guilds':'Quests'} available yet.</div>`;
  const n=items.length;
  return`<div class="cil-carousel" data-carousel="${kind}" tabindex="0" role="listbox" aria-label="${kind==='guild'?'Nearby and boosted Guilds':'Shared Quests'}">${items.map((item,i)=>{
    let distance=i-selected;if(n>2){if(distance>n/2)distance-=n;if(distance<-n/2)distance+=n}
    const depth=Math.abs(distance),active=distance===0,house=kind==='guild'?houseFor(item):houseFor(state.guilds[state.guildIndex]),progress=kind==='quest'?questProgress(item):null;
    return`<button type="button" class="cil-card3d ${active?'is-active':''}" data-${kind}-index="${i}" style="--slot:${distance};--depth:${depth};${houseVars(house)}" role="option" aria-selected="${active}"><span class="cil-card-glow"></span><span class="cil-card-sigil" aria-hidden="true">${kind==='guild'?'⌂':'✦'}</span><small>${kind==='guild'?esc(house?.name||'Guild'):'Shared Quest'}</small><b>${esc(item.name||item.title)}</b>${kind==='guild'?`<em>${esc(guildMeta(item))}</em>`:`<em>${progress.total?`${progress.done}/${progress.total} map steps · ${progress.percent}%`:`${item.needs.length} open need${item.needs.length===1?'':'s'}`}</em>`}</button>`;
  }).join('')}</div>`;
}
function guildFacts(guild,house,quests){
  const facts=[`<span><b>${quests.length}</b> shared Quest${quests.length===1?'':'s'}</span>`];
  if(house)facts.push(`<span><b>${esc(house.name)}</b> community House</span>`);
  if(guild.slots?.citizen!=null)facts.push(`<span><b>${guild.slots.citizen}</b> Citizen slot${guild.slots.citizen===1?'':'s'}</span>`);
  if(guild.slots?.patron!=null)facts.push(`<span><b>${guild.slots.patron}</b> Patron slot${guild.slots.patron===1?'':'s'}</span>`);
  const rally=guild.location?.rallyPoint;
  if(rally?.name)facts.push(`<span><b>${esc(rally.name)}</b> Rally Point</span>`);
  return facts.join('');
}
function guildCard(guild){
  const house=houseFor(guild),quests=questsFor(guild);
  return`<article class="cil-dropcard cil-guild-card" style="${houseVars(house)}"><div class="cil-card-handle"></div><div class="cil-card-heading"><div><small>GUILD · ${esc(guildMeta(guild))}</small><h2>${esc(guild.name)}</h2></div>${house?`<span class="cil-house-orb" title="${esc(house.name)}"></span>`:''}</div>${guild.description?`<p>${esc(guild.description)}</p>`:''}<div class="cil-guild-facts">${guildFacts(guild,house,quests)}</div><div class="cil-card-actions"><button type="button" class="cil-primary" data-advance="guild">Browse Guild Quests <span>↓</span></button><button type="button" class="cil-quiet" data-house-vote="${esc(guild.id)}">Guild House vote</button><button type="button" class="cil-quiet" data-starling-lounge="1">Starling Lounge ✦</button></div></article>`;
}
function submissionPreview(snapshot){
  const plan=snapshot.plan;
  return`<section class="cil-submit-preview" aria-label="Quest submission preview"><h3>${esc(plan.title)}</h3><p>Reported state: ${esc(snapshot.state)}</p>${plan.outcome?`<p>${esc(plan.outcome)}</p>`:''}
    ${arr(plan.paths).map(path=>`<section><h4>${esc(pathSpec(path).label)}${pathLabel(path)?` · ${esc(pathLabel(path))}`:''}</h4>${path.purpose?`<p>${esc(path.purpose)}</p>`:''}<p>Reported path state: ${esc(path.status||'unspecified')} · ${arr(path.progress).length} of ${arr(path.steps).length} steps reported complete.</p><ol>${arr(path.steps).map((step,index)=>`<li>${esc(typeof step==='string'?step:step.title)}${typeof step==='object'&&step.description?`<p>${esc(step.description)}</p>`:''}<small>Reported: ${esc(typeof step==='object'&&step.status?step.status:arr(path.progress).includes(index)?'complete':'unspecified')}</small></li>`).join('')}</ol>${path.completionCriteria?`<p>Completion: ${esc(path.completionCriteria)}</p>`:''}</section>`).join('')}
    ${arr(snapshot.needs).length?`<h4>Open needs</h4><ul>${snapshot.needs.map(need=>`<li>${esc(typeof need==='string'?need:need.title)}${typeof need==='object'?`<small>${esc(need.realm)} · ${esc(need.status||'unspecified')}</small>`:''}</li>`).join('')}</ul>`:''}
  </section>`;
}
function composerPanel(guild,composer){
  const drafts=availableDrafts(),disabled=state.publicationBusy?'disabled':'',submitDisabled=state.publicationBusy||composer.preparing||composer.expectedRevision==null;
  const label=state.publicationBusy?'Submitting…':composer.preparing?'Checking prior submission…':`Submit Quest to ${guild.name}`;
  return`<div class="cil-submit-form">
    <label for="cil-quest-draft">Your local Quest</label>
    ${drafts.length?`<select id="cil-quest-draft" data-quest-draft ${disabled}>${drafts.map(draft=>`<option value="${esc(draft.id)}" ${composer.draftId===draft.id?'selected':''}>${esc(draft.snapshot.plan.title)}</option>`).join('')}</select>`:'<p>Create a Quest with Weaveling on the Campus first, then return here to submit it.</p>'}
    <p>Review the title, outcome, map steps, and open needs below. Submitting shares this snapshot with ${esc(guild.name)} members.</p>
    ${composer.snapshot?submissionPreview(composer.snapshot):''}
    <div class="cil-card-actions">
      ${composer.snapshot?`<button type="button" class="cil-primary" data-quest-action="publish" ${submitDisabled?'disabled':''}>${esc(label)}</button>`:''}
      ${composer.snapshot&&composer.expectedRevision==null&&!composer.preparing?'<button type="button" class="cil-quiet" data-quest-action="prepare">Retry preparation</button>':''}
      <button type="button" class="cil-quiet" data-quest-action="cancel" ${disabled}>Cancel</button>
    </div>
  </div>`;
}
function publicationPanel(guild){
  if(!guild)return'';
  if(!questClient())return'<section class="cil-dropcard cil-publication"><h2>Connected Guild Quest board unavailable</h2><p>This package can show saved eligible Guild Quests. Connected Quest viewing and submission are unavailable here.</p></section>';
  const session=membership(guild),board=boardFor(guild),composer=state.composer?.guildId===guild.id?state.composer:null,disabled=state.publicationBusy?'disabled':'';
  if(!session)return`<section class="cil-dropcard cil-publication"><h2>Guild member Quests</h2><p>Log in to ${esc(guild.name)} to view its member board or submit one of your Quests.</p><div class="cil-card-actions"><button type="button" class="cil-primary" data-quest-action="login">Open Guild login</button></div></section>`;
  const boardMessage=board?.status==='loading'?'Loading this Guild’s shared Quests…':board?.error||'Quests on this board are shared with Guild members.';
  return`<section class="cil-dropcard cil-publication" aria-label="Submit Quest to Guild">
    <h2>Share work with ${esc(guild.name)}</h2><p role="status">${esc(boardMessage)}</p>
    ${state.publicationNotice?`<p class="cil-publication-notice" role="status">${esc(state.publicationNotice)}</p>`:''}
    <div class="cil-card-actions">
      <button type="button" class="cil-quiet" data-quest-action="refresh" ${board?.status==='loading'||state.publicationBusy?'disabled':''}>Refresh Guild Quests</button>
      ${board?.nextCursor?`<button type="button" class="cil-quiet" data-quest-action="more" ${disabled}>Load more Quests</button>`:''}
      ${!composer?`<button type="button" class="cil-primary" data-quest-action="compose" ${board?.status==='loading'||state.publicationBusy?'disabled':''}>Submit Quest to Guild</button>`:''}
    </div>
    ${composer?composerPanel(guild,composer):''}
  </section>`;
}
function withdrawalControls(quest){const row=quest?.publication,guild=activeGuild();if(!row||row.authorUserId!==membership(guild)?.userId)return'';const reviewing=state.withdrawReview===row.id;return`<div class="cil-card-actions">${reviewing?`<p>Withdraw this Quest from ${esc(guild.name)}? Your local Quest stays on this device.</p><button type="button" class="cil-quiet" data-quest-action="withdraw" ${state.publicationBusy?'disabled':''}>Withdraw from ${esc(guild.name)}</button><button type="button" class="cil-quiet" data-quest-action="cancel-withdraw">Keep shared</button>`:`<button type="button" class="cil-quiet" data-quest-action="review-withdraw" data-publication-id="${esc(row.id)}">Withdraw Quest</button>`}</div>`}
function emptyQuestMessage(){if(!questClient())return'Connected Guild Quest viewing is unavailable in this package.';if(!membership(activeGuild()))return'Log in to this Guild to load its member Quest board.';const board=boardFor(activeGuild());if(board?.error)return'The Guild board could not be loaded. Refresh Guild Quests to retry.';if(board?.status==='loading')return'Loading this Guild’s shared Quests…';return'No shared Quests eligible for this operating mode are available on this Guild board.'}
function emptyGuildCard(){const source=state.directoryState==='unavailable'?'The live Guild directory is unavailable and this device has no saved Guild data.':'No Guild records are available from the live directory or this device yet.';return`<article class="cil-dropcard cil-empty"><div class="cil-card-handle"></div><small>GUILD DIRECTORY</small><h2>No Guild data available</h2><p>${esc(source)}</p></article>`}
function questCard(quest){if(!quest)return`<article class="cil-dropcard cil-empty"><div class="cil-card-handle"></div><small>QUEST BOARD</small><h2>Guild Quest board</h2><p>${esc(emptyQuestMessage())}</p></article>`;const needs=quest.needs,progress=questProgress(quest);return`<article class="cil-dropcard cil-needs-card"><div class="cil-card-handle"></div><small>QUEST · ${quest.publication?'SHARED BY A MEMBER':esc(quest.state||'shared')}</small><div class="cil-card-heading"><div><h2>${esc(quest.title)}</h2>${quest.description?`<p>${esc(quest.description)}</p>`:''}</div><div class="cil-progress-orb" style="--quest-progress:${progress.percent}"><b>${progress.percent}%</b><small>${quest.publication?'reported':'mapped'}</small></div></div><div class="cil-section-kicker">Open needs</div><div class="cil-needs">${needs.length?needs.map(n=>`<div class="cil-need"><span>${esc(PATHS[n.realm]?.label||'Guild need')}</span><b>${esc(n.title)}</b></div>`).join(''):'<p class="cil-muted">No open needs are published right now. You can still inspect the Quest Map.</p>'}</div><button type="button" class="cil-primary" data-advance="quest">View Quest Map <span>↓</span></button>${withdrawalControls(quest)}</article>`}
function voteBadges(task){const votes=votesForTask(task);if(!votes.length)return'';return`<span class="cil-votes" aria-label="${votes.length} related Anarchadia vote${votes.length===1?'':'s'}">${votes.slice(0,4).map(v=>`<span class="cil-vote" style="--vote:${voteColor(v)}" title="${esc(v.label)}">${voteNumber(v)}</span>`).join('')}</span>`}
function selectedMapDetails(quest){
  const selected=state.mapSelection;if(selected?.questId!==quest?.plan?.id)return'';
  const path=arr(quest.plan.paths)[selected.pathIndex];if(!path)return'';
  const tasks=taskList(path),steps=Number.isInteger(selected.stepIndex)?tasks.filter(task=>task.index===selected.stepIndex):tasks;
  return`<section class="cil-dropcard" data-quest-map-selection tabindex="-1"><h3>${esc(path.title||'Path details')}</h3>${path.purpose?`<p>${esc(path.purpose)}</p>`:''}<ol>${steps.map(task=>`<li>${esc(task.title)} · ${quest.publication?'member-reported ':''}${esc(task.status)}${voteBadges(task)}</li>`).join('')}</ol>${path.completionCriteria?`<p><strong>Completion:</strong> ${esc(path.completionCriteria)}</p>`:''}</section>`;
}
function mapPanel(quest){
  if(!quest)return'';
  const local=localIntentions().some(row=>row?.kind==='weave-plan'&&(row.id===quest.plan.id||row.plan?.id===quest.plan.id)),actions=['inspect',...(local?['edit','submit-guild']:[])],reported=Boolean(quest.publication);
  return`<section class="cil-map"><header class="cil-map-head"><div><small>GUILD QUEST MAP</small><h2>${esc(quest.title)}</h2><p>Learning, building, resources, and agreements can advance together.</p></div><button type="button" class="cil-up" data-screen="2" aria-label="Back to Quest level">↑ Quests</button></header>${globalThis.CivweaveQuestPathwayMapV1?.render?.({...quest.plan,state:quest.state},{actions,reported,scope:reported?'Shared Guild Quest snapshot':'Saved Guild Quest'})||'<p>The map is unavailable in this package. Reopen the app to load it.</p>'}${selectedMapDetails(quest)}<footer><span>${reported?'This map is a member-reported snapshot. Proof is not included in this publication.':"Progress reflects this saved Quest."}</span></footer></section>`;
}
function mapAction(detail,event){
  const quest=activeQuests()[state.questIndex]||activeQuests()[0];if(!quest||quest.plan?.id!==detail.questId)return;
  if(detail.action==='inspect'){
    const path=arr(quest.plan.paths)[detail.pathIndex];if(!path||String(path.id||'')!==detail.pathId)return;
    state.mapSelection={questId:detail.questId,pathIndex:detail.pathIndex,stepIndex:detail.stepIndex};renderSurface();const node=document.querySelector('[data-quest-map-selection]');node?.focus({preventScroll:true});node?.scrollIntoView?.({block:'nearest'});return;
  }
  if(detail.action==='submit-guild')return openSubmission(detail.questId);
  if(detail.action==='edit'){
    let owner=globalThis.CivweaveSharedReviewSurfaceV234;try{if(!owner&&parent!==globalThis&&parent.location.origin===location.origin&&parent.document.getElementById('cw-persistent-system-stage')?.contentWindow===globalThis)owner=parent.CivweaveSharedReviewSurfaceV234}catch{}
    return owner?.handleMapAction?.(detail,{source:event.target});
  }
}
function screenControls(){const labels=[['1','Guilds'],['2','Quests'],['3','Quest Map']];return`<nav class="cil-level-indicator" aria-label="Guild Quest hierarchy">${labels.map(([num,label],i)=>{const screen=i+1,disabled=screen===2?!activeGuild():screen===3?!activeQuests().length:false;return`${i?'<span aria-hidden="true">›</span>':''}<button type="button" data-screen="${screen}" class="${state.screen===screen?'is-active':''}" ${disabled?'disabled':''}><i>${num}</i>${label}</button>`}).join('')}</nav>`}
function surfaceHtml(){
  const guilds=state.guilds,guild=guilds[state.guildIndex]||guilds[0]||null,quests=questsFor(guild),quest=quests[state.questIndex]||quests[0]||null,house=houseFor(guild),copy=tierCopy();
  state.questIndex=clamp(state.questIndex,0,Math.max(0,quests.length-1));
  return`<section id="${ROOT_ID}" class="cil-root cil-screen-${state.screen}" style="${houseVars(house)}" aria-label="Civweave Guild Quest tracker"><div class="cil-aurora"></div><header class="cil-titlebar"><div class="cil-titlecopy"><small>CIVWEAVE · GUILD QUEST TRACKER</small><h1>${esc(copy.title)}</h1><p>${esc(copy.subtitle)}</p></div>${screenControls()}</header><div class="cil-stage"><section class="cil-level cil-guild-level"><div class="cil-level-label"><span>01</span><b>Guilds</b><small>Guilds · live + saved</small></div>${carousel(guilds,state.guildIndex,'guild')}${state.screen===1?(guild?guildCard(guild):emptyGuildCard()):''}</section>${state.screen>=2?`<section class="cil-level cil-quest-level"><div class="cil-level-label"><span>02</span><b>Quests</b><small>${esc(guild?.name||'Guild')} · shared intentions</small></div>${carousel(quests,state.questIndex,'quest')}${state.screen===2?questCard(quest):''}</section>`:''}${state.screen===3&&quest?`<section class="cil-level cil-map-level"><div class="cil-level-label"><span>03</span><b>Quest Map</b><small>Living School · Cerbanimo · FellowFare · Anarchadia</small></div>${mapPanel(quest)}</section>`:''}</div>${publicationPanel(guild)}<footer class="cil-journey-footer"><b>Guilds → Quests → Quest Maps</b><span>Many paths. One weave. Better together.</span></footer><div class="cil-gesture-hint">Swipe, scroll, or use ← → to rotate · tap the centered card to descend</div></section>`;
}

function hideLegacy(shell,hidden){for(const sel of ['.rc-hero','.rc-active','.rc-dashboard','.rc-room-nav','.rc-workspace'])for(const node of shell.querySelectorAll(sel))node.hidden=hidden}
function addReturnLink(){const shell=document.querySelector('#rc-app .rc-shell');if(!shell||!isCivweave())return;let link=shell.querySelector('[data-cil-return]');if(shouldOwnSurface()){link?.remove();return}if(link)return;const top=shell.querySelector('.rc-top');if(!top)return;link=document.createElement('a');link.href='/app/civweave-guild-quest-v1.html';link.className='cil-return-link';link.dataset.cilReturn='1';link.textContent='Guild Quest Tracker';top.append(link)}
function renderSurface(){if(state.rendering)return;state.rendering=true;try{const shell=document.querySelector('#rc-app .rc-shell');if(!shell)return;state.shell=shell;addReturnLink();const existing=document.getElementById(ROOT_ID);if(!shouldOwnSurface()){existing?.remove();hideLegacy(shell,false);return}hideLegacy(shell,true);if(!state.guilds.length)state.guilds=discoveredGuilds();const markup=surfaceHtml();if(existing)existing.outerHTML=markup;else shell.querySelector('.rc-top')?.insertAdjacentHTML('afterend',markup);globalThis.CivweaveQuestPathwayMapV1?.bind?.(document.getElementById(ROOT_ID),mapAction)}finally{state.rendering=false}}
function activeGuild(){return state.guilds[state.guildIndex]||state.guilds[0]||null}
function activeQuests(){return questsFor(activeGuild())}
function rotate(kind,direction){if(kind==='guild'){const count=state.guilds.length;if(!count)return;setIndex('guild',(state.guildIndex+direction+count)%count)}else{const quests=activeQuests(),count=quests.length;if(!count)return;state.questIndex=(state.questIndex+direction+count)%count;renderSurface()}}
function advance(kind){if(kind==='guild'&&state.screen===1&&activeGuild()){state.screen=2;state.questIndex=0;renderSurface();refreshQuestBoard()}else if(kind==='quest'&&state.screen===2&&activeQuests().length){state.screen=3;renderSurface()}}
function setScreen(value){const next=Number(value);if(next===1)state.screen=1;else if(next===2&&activeGuild())state.screen=2;else if(next===3&&activeQuests().length)state.screen=3;else return;renderSurface()}
function setIndex(kind,index){const next=Number(index);if(!Number.isFinite(next))return;if(kind==='guild'){if(next===state.guildIndex&&state.screen===1)return advance('guild');state.guildIndex=clamp(next,0,Math.max(0,state.guilds.length-1));state.questIndex=0;state.composer=null;state.publicationNotice='';state.withdrawReview=''}else{const quests=activeQuests();if(next===state.questIndex&&state.screen===2)return advance('quest');state.questIndex=clamp(next,0,Math.max(0,quests.length-1))}renderSurface();if(kind==='guild')refreshQuestBoard()}
function requestHouseVote(guildId){const guild=state.guilds.find(x=>x.id===guildId)||activeGuild();if(!guild)return;const house=houseFor(guild),proposal={id:uid('house-vote'),schema:'civweave.house-change-proposal.v1',type:'house-change',status:'requested',hubId:guild.id,guildId:guild.id,hubName:guild.name,guildName:guild.name,currentHouse:house?.id||null,options:HOUSES.map(x=>x.id),title:`Choose ${guild.name}'s Civweave House`,taskIds:[],createdAt:new Date().toISOString()};const old=parse(localStorage.getItem(HOUSE_VOTE_KEY),[]),list=Array.isArray(old)?old:[];list.unshift(proposal);try{localStorage.setItem(HOUSE_VOTE_KEY,JSON.stringify(list.slice(0,100)))}catch{}try{dispatchEvent(new CustomEvent('civweave:anarchadia-proposal-requested',{detail:proposal}))}catch{}const toast=document.getElementById('rc-toast');if(toast){toast.textContent=`Guild House vote queued for Anarchadia: ${guild.name}.`;toast.hidden=false;setTimeout(()=>{toast.hidden=true},3200)}refreshVotes()}
function onQuestAction(target){
  const action=target.dataset.questAction;
  if(action==='compose')composeQuest();
  else if(action==='prepare'&&state.composer?.snapshot)void prepareSubmission(activeGuild(),{id:state.composer.draftId,snapshot:state.composer.snapshot});
  else if(action==='cancel'){state.composer=null;state.publicationNotice='';renderSurface()}
  else if(action==='publish')void publishQuest();
  else if(action==='refresh'||action==='more')void refreshQuestBoard(activeGuild(),{force:true,append:action==='more'});
  else if(action==='review-withdraw'){state.withdrawReview=target.dataset.publicationId;renderSurface()}
  else if(action==='cancel-withdraw'){state.withdrawReview='';renderSurface()}
  else if(action==='withdraw')void withdrawQuest();
  else if(action==='login'){let launcher=globalThis.CivweaveGuildSymbolV1;try{launcher=parent.CivweaveGuildSymbolV1||launcher}catch{}if(launcher?.openNearbyGuilds)launcher.openNearbyGuilds();else location.assign('/finder?view=guilds&source=quest-submission')}
}
async function openStarlingLounge(){const guild=activeGuild();if(!guild)return;try{const mod=await import('/app/starling-lounge-v1.mjs?v=native-r1');mod.CivweaveStarlingLoungeV1.open(guild)}catch(error){const toast=document.getElementById('rc-toast');if(toast){toast.hidden=false;toast.textContent='Starling Lounge is unavailable: '+clean(error?.message||error,220)}}}
function onClick(event){const target=event.target.closest?.('[data-guild-index],[data-quest-index],[data-advance],[data-screen],[data-house-vote],[data-quest-action],[data-starling-lounge]');if(!target||target.disabled)return;if(target.dataset.starlingLounge){event.preventDefault();void openStarlingLounge();return;}if(target.dataset.questAction){event.preventDefault();onQuestAction(target);return}if(target.dataset.houseVote){event.preventDefault();event.stopPropagation();requestHouseVote(target.dataset.houseVote);return}if(target.dataset.screen){event.preventDefault();setScreen(target.dataset.screen);return}if(target.dataset.guildIndex!=null){event.preventDefault();setIndex('guild',target.dataset.guildIndex);return}if(target.dataset.questIndex!=null){event.preventDefault();setIndex('quest',target.dataset.questIndex);return}if(target.dataset.advance){event.preventDefault();advance(target.dataset.advance)}}
function onChange(event){if(event.target.matches?.('[data-quest-draft]'))selectDraft(event.target.value)}
function onKey(event){const node=event.target.closest?.('[data-carousel]');if(!node||!['ArrowLeft','ArrowRight','Enter',' '].includes(event.key))return;event.preventDefault();const kind=node.dataset.carousel;if(event.key==='ArrowLeft')rotate(kind,-1);else if(event.key==='ArrowRight')rotate(kind,1);else advance(kind)}
function onWheel(event){const node=event.target.closest?.('[data-carousel]');if(!node||state.wheelLock||Math.abs(event.deltaX)+Math.abs(event.deltaY)<8)return;event.preventDefault();state.wheelLock=true;rotate(node.dataset.carousel,(event.deltaX||event.deltaY)>0?1:-1);setTimeout(()=>{state.wheelLock=false},180)}
function onTouchStart(event){const node=event.target.closest?.('[data-carousel]');if(!node||!event.touches?.length)return;state.touchStart={kind:node.dataset.carousel,x:event.touches[0].clientX,y:event.touches[0].clientY}}
function onTouchEnd(event){if(!state.touchStart||!event.changedTouches?.length)return;const touch=event.changedTouches[0],dx=touch.clientX-state.touchStart.x,dy=touch.clientY-state.touchStart.y,kind=state.touchStart.kind;state.touchStart=null;if(Math.abs(dx)<36||Math.abs(dx)<Math.abs(dy))return;rotate(kind,dx<0?1:-1)}
function refreshFromStorage(){state.guilds=discoveredGuilds();state.guildIndex=clamp(state.guildIndex,0,Math.max(0,state.guilds.length-1));state.questIndex=0;state.votes=localVotes();renderSurface();refreshQuestBoard();resumeRequestedSubmission()}
function onStorage(event){if([INTENTIONS_KEY,DISCOVERY_KEY,MESH_KEY,DIRECTORY_CACHE_KEY,HOST_SELECTION_KEY,HOUSE_KEY,HOUSE_VOTE_KEY,VOTE_INDEX_KEY].includes(event.key))refreshFromStorage()}
function onProgressChanged(){state.guilds=discoveredGuilds();renderSurface()}
function onDirectoryChanged(){state.guilds=discoveredGuilds();renderSurface()}
function boot(){
  state.guilds=discoveredGuilds();state.votes=localVotes();
  document.addEventListener('click',onClick,true);document.addEventListener('change',onChange);document.addEventListener('keydown',onKey,true);document.addEventListener('wheel',onWheel,{capture:true,passive:false});document.addEventListener('touchstart',onTouchStart,{capture:true,passive:true});document.addEventListener('touchend',onTouchEnd,{capture:true,passive:true});
  addEventListener('storage',onStorage);addEventListener('civweave:intentions-changed',onProgressChanged);addEventListener('civweave:proof-progress-synced',onProgressChanged);addEventListener('civweave:hub-map-directory',onDirectoryChanged);addEventListener('civweave:host-node-selected',refreshFromStorage);
  state.observer=new MutationObserver(()=>{if(state.rendering)return;const shell=document.querySelector('#rc-app .rc-shell');if(shell!==state.shell||(shouldOwnSurface()&&!document.getElementById(ROOT_ID))){state.shell=shell;renderSurface()}else addReturnLink()});state.observer.observe(document.getElementById('rc-app')||document.body,{childList:true,subtree:true});
  for(const event of ['civweave:capacity-session-ready','civweave:capacity-session-cleared','civweave:host-node-session-ready'])addEventListener(event,refreshFromStorage);
  addEventListener('online',()=>refreshQuestBoard(activeGuild(),{force:true}));
  renderSurface();refreshVotes();refreshDirectory();refreshQuestBoard();
  Promise.resolve(questClient()?.restoreSelected()).then(()=>refreshQuestBoard()).catch(()=>{});
  const api=Object.freeze({version:VERSION,houses:HOUSES,paths:PATHS,tierColors:TIER_COLORS,refresh(){refreshFromStorage();refreshVotes();refreshDirectory()},houseForGuild:g=>houseFor(g),houseForHub:g=>houseFor(g),requestHouseVote,openSubmission,openGuilds(){state.screen=1;renderSurface()},openQuests(){if(activeGuild()){state.screen=2;renderSurface()}},openQuestMap(){if(activeQuests().length){state.screen=3;renderSurface()}}});
  const requested=String(query().get('submitQuest')||'');if(requested)openSubmission(requested);
  globalThis.CivweaveCerbanimoIntentionLandscapeV1=api;globalThis.CivweaveGuildQuestTrackerV1=api;
  try{dispatchEvent(new CustomEvent('civweave:guild-quest-tracker-ready',{detail:{version:VERSION,hierarchy:['guild','quest','quest-map'],houses:HOUSES.map(x=>x.id),paths:Object.keys(PATHS),directoryEndpoint:DIRECTORY_ENDPOINT}}))}catch{}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
