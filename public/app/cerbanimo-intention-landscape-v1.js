(()=>{
'use strict';

const VERSION='1.0.0';
const ROOT_ID='cerbanimo-intention-landscape';
const INTENTIONS_KEY='civweave.intentions.v127';
const DISCOVERY_KEY='civweave.hub-discovery.v1';
const MESH_KEY='federation-finder.mesh-nodes.v1';
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
  'living-school':{id:'living-school',label:'Living School',strap:'Learnings · documentation',solid:'#12dba0',soft:'#8af5d1'},
  cerbanimo:{id:'cerbanimo',label:'Cerbanimo',strap:'Practice · labor · making',solid:'#9c4dff',soft:'#ff48b5'},
  fellowfare:{id:'fellowfare',label:'FellowFare',strap:'Resources · mentors · outsourcing',solid:'#ffb52f',soft:'#ffe19a'}
});
const VOTE_COLORS=['#ff3d9f','#48e6ff','#ffd84e','#9c63ff','#4df2a6','#ff7b54','#67a8ff','#f47dff','#9ee34e','#ffae57'];
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const parse=(value,fallback)=>{try{const out=JSON.parse(value);return out==null?fallback:out}catch{return fallback}};
const clean=(value,max=1800)=>String(value??'').trim().slice(0,max);
const uid=prefix=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const arr=value=>Array.isArray(value)?value:[];
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const hash=value=>{let out=2166136261;for(const char of String(value??'')){out^=char.charCodeAt(0);out=Math.imul(out,16777619)}return out>>>0};

const state={screen:1,hubIndex:0,intentionIndex:0,hubs:[],votes:[],touchStart:null,wheelLock:false,observer:null,rendering:false,shell:null};

function currentQuery(){return new URLSearchParams(location.search)}
function isCerbanimo(){return currentQuery().get('system')==='cerbanimo'||document.documentElement.dataset.system==='cerbanimo'}
function shouldOwnSurface(){const query=currentQuery();return isCerbanimo()&&!query.get('capability')&&!query.get('room')}
function houseStore(){const raw=parse(localStorage.getItem(HOUSE_KEY),{});return raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{}}
function saveHouseStore(value){try{localStorage.setItem(HOUSE_KEY,JSON.stringify(value))}catch{}}
function randomHouseIndex(seed){try{const bytes=new Uint32Array(1);crypto.getRandomValues(bytes);return bytes[0]%HOUSES.length}catch{return hash(seed)%HOUSES.length}}
function normalizeHouse(value){const id=clean(typeof value==='object'?value?.id:value,40).toLowerCase();return HOUSES.find(house=>house.id===id)||null}
function houseFor(hub){const explicit=normalizeHouse(hub?.house||hub?.houseId||hub?.theme);if(explicit)return explicit;const id=clean(hub?.id||hub?.name||'local-hub',160),saved=houseStore();const assigned=normalizeHouse(saved[id]);if(assigned)return assigned;const selected=HOUSES[randomHouseIndex(id)];saved[id]=selected.id;saveHouseStore(saved);return selected}

function normalizeHub(raw,index=0,source='discovery'){
  if(!raw||typeof raw!=='object')return null;
  const id=clean(raw.id||raw.hubId||raw.nodeId||raw.slug||raw.name||`hub-${index}`,180);
  const name=clean(raw.name||raw.label||raw.hubName||raw.nodeName||`Hub ${index+1}`,120);
  const description=clean(raw.description||raw.summary||raw.about||raw.purpose||raw.bio||'This hub has not published a description yet.',1200);
  const intentions=arr(raw.sharedIntentions||raw.intentions||raw.publicIntentions||raw.weaves);
  const distance=Number(raw.distanceKm??raw.distance??raw.proximityKm);
  const boost=Number(raw.boostScore??raw.boost??(raw.boosted?1:0))||0;
  return{id,name,description,intentions,boosted:Boolean(raw.boosted||boost>0),boost,distance:Number.isFinite(distance)?distance:null,source,house:raw.house||raw.houseId||raw.theme||'',raw};
}
function localIntentions(){return arr(parse(localStorage.getItem(INTENTIONS_KEY),[])).filter(item=>item&&typeof item==='object')}
function discoveredHubs(){
  const sources=[];
  const discovery=parse(localStorage.getItem(DISCOVERY_KEY),[]);
  const rows=Array.isArray(discovery)?discovery:arr(discovery?.hubs||discovery?.items||Object.values(discovery||{}));
  rows.forEach((row,index)=>{const hub=normalizeHub(row,index,'discovery');if(hub)sources.push(hub)});
  const mesh=parse(localStorage.getItem(MESH_KEY),[]);
  const meshRows=Array.isArray(mesh)?mesh:Object.values(mesh||{});
  meshRows.forEach((row,index)=>{const hub=normalizeHub(row,index,'mesh');if(hub&&!sources.some(item=>item.id===hub.id))sources.push(hub)});
  const ownIntentions=localIntentions();
  const own={id:'local-civweave-hub',name:'Your Civweave Hub',description:'Shared intentions published by this device or host node appear here alongside nearby and boosted hubs.',intentions:ownIntentions,boosted:false,boost:0,distance:0,source:'local',house:'',raw:{}};
  if(!sources.some(item=>item.source==='local'||item.id===own.id))sources.unshift(own);
  return sources.sort((a,b)=>Number(b.boosted)-Number(a.boosted)||(b.boost-a.boost)||((a.distance??Infinity)-(b.distance??Infinity))||a.name.localeCompare(b.name));
}

function normalizeNeeds(intention){
  const raw=intention?.openNeeds||intention?.needs||intention?.plan?.needs||intention?.plan?.openNeeds||[];
  const direct=arr(raw).map((need,index)=>typeof need==='string'?{id:`need-${index}`,title:need}:{id:clean(need?.id||`need-${index}`,120),title:clean(need?.title||need?.name||need?.label||need?.description||'Open need',240),realm:clean(need?.realm||need?.system,40)}).filter(need=>need.title);
  if(direct.length)return direct;
  const paths=arr(intention?.plan?.paths||intention?.paths);
  const derived=[];
  for(const path of paths){for(const task of arr(path?.tasks||path?.steps)){const status=clean(task?.status,40).toLowerCase();if(['completed','complete','done','closed'].includes(status))continue;const title=clean(typeof task==='string'?task:task?.need||task?.title||task?.name||task?.deliverable,240);if(title)derived.push({id:clean(task?.id||`need-${derived.length}`,120),title,realm:clean(path?.realm||task?.realm,40)})}}
  return derived.slice(0,8);
}
function normalizeIntention(raw,index=0){
  if(!raw||typeof raw!=='object')return null;
  const plan=raw.plan&&typeof raw.plan==='object'?raw.plan:raw;
  const id=clean(raw.id||plan.id||`intention-${index}`,180);
  const title=clean(plan.title||raw.title||raw.text||raw.name||`Shared intention ${index+1}`,160);
  const description=clean(plan.outcome||raw.description||raw.summary||raw.text||'No description has been published for this intention yet.',1000);
  return{id,title,description,state:clean(raw.state||plan.state||'shared',40),needs:normalizeNeeds(raw),plan,raw};
}
function intentionsFor(hub){return arr(hub?.intentions).map(normalizeIntention).filter(Boolean)}

function realmForPath(path){const value=clean(path?.realm||path?.system||path?.type,80).toLowerCase();if(value.includes('living')||value.includes('learn'))return'living-school';if(value.includes('fellow')||value.includes('market')||value.includes('resource')||value.includes('mentor')||value.includes('outsource'))return'fellowfare';return'cerbanimo'}
function taskList(path){
  const source=arr(path?.tasks).length?arr(path.tasks):arr(path?.steps);
  return source.map((task,index)=>{
    if(typeof task==='string')return{id:`${realmForPath(path)}-${index}`,title:clean(task,220),status:'ready',raw:{}};
    return{id:clean(task?.id||task?.taskId||`${realmForPath(path)}-${index}`,160),title:clean(task?.title||task?.name||task?.label||task?.deliverable||task?.description||`Task ${index+1}`,220),status:clean(task?.status||'ready',40),raw:task||{}};
  }).filter(task=>task.title);
}
function mapFor(intention){
  const lanes={'living-school':[],'cerbanimo':[],'fellowfare':[]};
  const paths=arr(intention?.plan?.paths||intention?.raw?.paths||intention?.plan?.tracks);
  for(const path of paths){const realm=realmForPath(path);lanes[realm].push(...taskList(path))}
  return lanes;
}

function voteId(vote,index=0){return clean(vote?.id||vote?.voteId||vote?.proposalId||vote?.proposal_id||vote?.slug||`vote-${index}`,180)}
function voteTaskIds(vote){return new Set(arr(vote?.taskIds||vote?.relatedTaskIds||vote?.tasks||vote?.targets).map(item=>clean(typeof item==='object'?item?.id||item?.taskId:item,180)).filter(Boolean))}
function normalizeVotes(raw){
  const source=Array.isArray(raw)?raw:arr(raw?.votes||raw?.proposals||raw?.ballots||raw?.items);
  return source.map((vote,index)=>{const id=voteId(vote,index);return{id,label:clean(vote?.title||vote?.label||vote?.question||vote?.name||'Open vote',180),status:clean(vote?.status||vote?.state||'open',40).toLowerCase(),taskIds:voteTaskIds(vote),raw:vote}}).filter(vote=>vote.id&&!['closed','complete','completed','resolved','archived'].includes(vote.status));
}
function localVotes(){
  const indexed=parse(localStorage.getItem(VOTE_INDEX_KEY),[]),pending=parse(localStorage.getItem(HOUSE_VOTE_KEY),[]);
  return [...normalizeVotes(indexed),...normalizeVotes(pending)].filter((vote,index,all)=>all.findIndex(item=>item.id===vote.id)===index);
}
function readGovernanceState(){
  if(!globalThis.indexedDB)return Promise.resolve(null);
  return new Promise(resolve=>{let request;try{request=indexedDB.open(GOVERNANCE_DB)}catch{return resolve(null)}request.onerror=()=>resolve(null);request.onsuccess=()=>{const db=request.result;if(!db.objectStoreNames.contains(GOVERNANCE_STORE)){db.close();resolve(null);return}let get;try{const tx=db.transaction(GOVERNANCE_STORE,'readonly');get=tx.objectStore(GOVERNANCE_STORE).get('active');get.onsuccess=()=>{const value=get.result;db.close();resolve(value||null)};get.onerror=()=>{db.close();resolve(null)}}catch{db.close();resolve(null)}}});
}
async function refreshVotes(){const governance=await readGovernanceState();const combined=[...localVotes(),...normalizeVotes(governance)];state.votes=combined.filter((vote,index,all)=>all.findIndex(item=>item.id===vote.id)===index);if(shouldOwnSurface())renderSurface()}
function votesForTask(task){
  const direct=arr(task?.raw?.votes||task?.raw?.voteIds||task?.raw?.anarchadiaVotes).map((vote,index)=>typeof vote==='object'?{id:voteId(vote,index),label:clean(vote?.title||'Open vote',180),taskIds:new Set([task.id]),status:'open'}:{id:clean(vote,180),label:'Open vote',taskIds:new Set([task.id]),status:'open'}).filter(vote=>vote.id);
  const linked=state.votes.filter(vote=>vote.taskIds.has(task.id));
  return [...direct,...linked].filter((vote,index,all)=>all.findIndex(item=>item.id===vote.id)===index);
}
function voteNumber(vote){const ordered=[...state.votes].sort((a,b)=>a.id.localeCompare(b.id));const index=ordered.findIndex(item=>item.id===vote.id);return(index>=0?index:hash(vote.id)%99)+1}
function voteColor(vote){return VOTE_COLORS[hash(vote.id)%VOTE_COLORS.length]}

function houseVars(house){return`--house:${house.solid};--house-soft:${house.soft};--house-ink:${house.ink}`}
function hubMeta(hub){const bits=[];if(hub.boosted)bits.push('Boosted');if(Number.isFinite(hub.distance)&&hub.distance>0)bits.push(`${hub.distance<10?hub.distance.toFixed(1):Math.round(hub.distance)} km`);if(hub.source==='local')bits.push('This hub');else if(hub.source==='mesh')bits.push('Nearby mesh');return bits.join(' · ')||'Hub node'}
function carousel(items,selected,kind){
  if(!items.length)return`<div class="cil-empty-rail">No ${kind==='hub'?'hubs':'shared intentions'} available yet.</div>`;
  const n=items.length;
  return`<div class="cil-carousel" data-carousel="${kind}" tabindex="0" role="listbox" aria-label="${kind==='hub'?'Nearby and boosted hubs':'Shared intentions'}">${items.map((item,index)=>{
    let distance=index-selected;if(n>2){if(distance>n/2)distance-=n;if(distance<-n/2)distance+=n}
    const depth=Math.abs(distance),active=distance===0,house=kind==='hub'?houseFor(item):houseFor(state.hubs[state.hubIndex]);
    return`<button type="button" class="cil-card3d ${active?'is-active':''}" data-${kind}-index="${index}" style="--slot:${distance};--depth:${depth};${houseVars(house)}" role="option" aria-selected="${active}"><span class="cil-card-glow"></span><small>${kind==='hub'?esc(house.name):esc(item.state||'shared intention')}</small><b>${esc(item.name||item.title)}</b>${kind==='hub'?`<em>${esc(hubMeta(item))}</em>`:`<em>${esc(item.needs.length)} open need${item.needs.length===1?'':'s'}</em>`}</button>`}).join('')}</div>`;
}
function hubCard(hub){const house=houseFor(hub);return`<article class="cil-dropcard" data-advance="hub" style="${houseVars(house)}"><div class="cil-card-handle"></div><div class="cil-card-heading"><div><small>${esc(house.name)} · ${esc(hubMeta(hub))}</small><h2>${esc(hub.name)}</h2></div><span class="cil-house-orb" title="${esc(house.name)}"></span></div><p>${esc(hub.description)}</p><div class="cil-card-actions"><button type="button" class="cil-primary" data-advance="hub">Open shared intentions <span>↓</span></button><button type="button" class="cil-quiet" data-house-vote="${esc(hub.id)}">Vote on House</button></div></article>`}
function intentionCard(intention){
  if(!intention)return`<article class="cil-dropcard cil-empty"><div class="cil-card-handle"></div><h2>No shared intentions here yet</h2><p>When this hub publishes a shared intention, its open needs and three-path execution map will appear here.</p></article>`;
  const needs=intention.needs;
  return`<article class="cil-dropcard cil-needs-card" data-advance="intention"><div class="cil-card-handle"></div><small>OPEN NEEDS · ${esc(intention.title)}</small><h2>${needs.length?`${needs.length} ways to move this intention`: 'No open needs posted'}</h2><div class="cil-needs">${needs.length?needs.map(need=>`<div class="cil-need"><span>${esc(PATHS[need.realm]?.label||'Open')}</span><b>${esc(need.title)}</b></div>`).join(''):'<p>This intention can still be browsed. The hub has not published any open needs yet.</p>'}</div><button type="button" class="cil-primary" data-advance="intention">Open intention map <span>↓</span></button></article>`
}
function voteBadges(task){const votes=votesForTask(task);if(!votes.length)return'';return`<span class="cil-votes" aria-label="${votes.length} related Anarchadia vote${votes.length===1?'':'s'}">${votes.slice(0,4).map(vote=>`<span class="cil-vote" style="--vote:${voteColor(vote)}" title="${esc(vote.label)}">${voteNumber(vote)}</span>`).join('')}</span>`}
function lane(realm,tasks){const spec=PATHS[realm];return`<section class="cil-lane" data-lane="${realm}"><header><span class="cil-lane-glyph"></span><b>${esc(spec.label)}</b><small>${esc(spec.strap)}</small></header><div class="cil-track">${tasks.length?tasks.map((task,index)=>`<button type="button" class="cil-task" data-task-id="${esc(task.id)}" style="--task-step:${index}"><span class="cil-node"></span><b>${esc(task.title)}</b><small>${esc(task.status)}</small>${voteBadges(task)}</button>`).join(''):`<div class="cil-lane-empty"><span class="cil-node"></span><small>No active ${esc(spec.label)} tasks.</small></div>`}</div></section>`}
function mapPanel(intention){
  const lanes=mapFor(intention);return`<section class="cil-map"><header class="cil-map-head"><div><small>INTENTION MAP</small><h2>${esc(intention?.title||'Shared intention')}</h2></div><button type="button" class="cil-up" data-screen="2" aria-label="Back to intention level">↑ Intentions</button></header><div class="cil-map-grid">${lane('living-school',lanes['living-school'])}${lane('cerbanimo',lanes.cerbanimo)}${lane('fellowfare',lanes.fellowfare)}</div><footer><span><i class="cil-vote-demo"></i> Numbered color bubbles are open Anarchadia votes. One vote keeps the same color across every related task.</span></footer></section>`
}
function screenControls(){return`<div class="cil-level-indicator" aria-label="Current landscape level"><button data-screen="1" class="${state.screen===1?'is-active':''}">Hubs</button><span>›</span><button data-screen="2" class="${state.screen===2?'is-active':''}" ${state.screen<2?'disabled':''}>Intentions</button><span>›</span><button data-screen="3" class="${state.screen===3?'is-active':''}" ${state.screen<3?'disabled':''}>Map</button></div>`}
function surfaceHtml(){
  const hubs=state.hubs,hub=hubs[state.hubIndex]||hubs[0],intentions=intentionsFor(hub),intention=intentions[state.intentionIndex]||intentions[0]||null,house=houseFor(hub||{id:'local'});
  state.intentionIndex=clamp(state.intentionIndex,0,Math.max(0,intentions.length-1));
  return`<section id="${ROOT_ID}" class="cil-root cil-screen-${state.screen}" style="${houseVars(house)}" aria-label="Cerbanimo intention landscape"><div class="cil-aurora"></div><header class="cil-titlebar"><div><small>CERBANIMO · INTENTION LANDSCAPE</small><h1>${state.screen===1?'Discover a hub':state.screen===2?'Choose a shared intention':'Follow the work'}</h1></div>${screenControls()}</header><div class="cil-stage"><section class="cil-level cil-hub-level"><div class="cil-level-label"><span>01</span><b>Hub level</b><small>Nearby + boosted</small></div>${carousel(hubs,state.hubIndex,'hub')}${state.screen===1?hubCard(hub):''}</section>${state.screen>=2?`<section class="cil-level cil-intention-level"><div class="cil-level-label"><span>02</span><b>Intention level</b><small>${esc(hub?.name||'Hub')}</small></div>${carousel(intentions,state.intentionIndex,'intention')}${state.screen===2?intentionCard(intention):''}</section>`:''}${state.screen===3?`<section class="cil-level cil-map-level">${mapPanel(intention)}</section>`:''}</div><div class="cil-gesture-hint">Swipe, scroll, or use ← → to rotate · tap the centered card to descend</div></section>`;
}

function hideLegacy(shell,hidden){for(const selector of ['.rc-hero','.rc-active','.rc-dashboard','.rc-room-nav','.rc-workspace'])for(const node of shell.querySelectorAll(selector))node.hidden=hidden}
function addReturnLink(){const shell=document.querySelector('#rc-app .rc-shell');if(!shell||!isCerbanimo())return;let link=shell.querySelector('[data-cil-return]');if(shouldOwnSurface()){link?.remove();return}if(link)return;const top=shell.querySelector('.rc-top');if(!top)return;link=document.createElement('a');link.href='/app/realm-console-v140.html?system=cerbanimo&embed=1';link.className='cil-return-link';link.dataset.cilReturn='1';link.textContent='Intention Landscape';top.append(link)}
function renderSurface(){
  if(state.rendering)return;state.rendering=true;
  try{
    const shell=document.querySelector('#rc-app .rc-shell');if(!shell){return}state.shell=shell;
    addReturnLink();
    const existing=document.getElementById(ROOT_ID);
    if(!shouldOwnSurface()){existing?.remove();hideLegacy(shell,false);return}
    hideLegacy(shell,true);
    if(!state.hubs.length)state.hubs=discoveredHubs();
    const markup=surfaceHtml();
    if(existing)existing.outerHTML=markup;else shell.querySelector('.rc-top')?.insertAdjacentHTML('afterend',markup);
  }finally{state.rendering=false}
}
function activeHub(){return state.hubs[state.hubIndex]||state.hubs[0]}
function activeIntentions(){return intentionsFor(activeHub())}
function rotate(kind,direction){
  if(kind==='hub'){
    const count=state.hubs.length;if(!count)return;state.hubIndex=(state.hubIndex+direction+count)%count;state.intentionIndex=0;
  }else{
    const intentions=activeIntentions(),count=intentions.length;if(!count)return;state.intentionIndex=(state.intentionIndex+direction+count)%count;
  }
  renderSurface();
}
function advance(kind){if(kind==='hub'&&state.screen===1){state.screen=2;state.intentionIndex=0;renderSurface()}else if(kind==='intention'&&state.screen===2&&activeIntentions().length){state.screen=3;renderSurface()}}
function setScreen(value){const next=Number(value);if(next===1){state.screen=1}else if(next===2){state.screen=2}else if(next===3&&activeIntentions().length){state.screen=3}else return;renderSurface()}
function setIndex(kind,index){const next=Number(index);if(!Number.isFinite(next))return;if(kind==='hub'){if(next===state.hubIndex&&state.screen===1)return advance('hub');state.hubIndex=clamp(next,0,Math.max(0,state.hubs.length-1));state.intentionIndex=0}else{const intentions=activeIntentions();if(next===state.intentionIndex&&state.screen===2)return advance('intention');state.intentionIndex=clamp(next,0,Math.max(0,intentions.length-1))}renderSurface()}
function requestHouseVote(hubId){
  const hub=state.hubs.find(item=>item.id===hubId)||activeHub(),house=houseFor(hub),proposal={id:uid('house-vote'),schema:'civweave.house-change-proposal.v1',type:'house-change',status:'requested',hubId:hub.id,hubName:hub.name,currentHouse:house.id,options:HOUSES.map(item=>item.id),title:`Choose ${hub.name}'s Civweave House`,taskIds:[],createdAt:new Date().toISOString()};
  const old=parse(localStorage.getItem(HOUSE_VOTE_KEY),[]),list=Array.isArray(old)?old:[];list.unshift(proposal);try{localStorage.setItem(HOUSE_VOTE_KEY,JSON.stringify(list.slice(0,100)))}catch{}
  try{dispatchEvent(new CustomEvent('civweave:anarchadia-proposal-requested',{detail:proposal}))}catch{}
  const toast=document.getElementById('rc-toast');if(toast){toast.textContent=`House vote queued for Anarchadia: ${hub.name}.`;toast.hidden=false;setTimeout(()=>{toast.hidden=true},3200)}
  refreshVotes();
}
function onClick(event){
  const target=event.target.closest?.('[data-hub-index],[data-intention-index],[data-advance],[data-screen],[data-house-vote]');if(!target)return;
  if(target.dataset.houseVote){event.preventDefault();event.stopPropagation();requestHouseVote(target.dataset.houseVote);return}
  if(target.dataset.screen){event.preventDefault();setScreen(target.dataset.screen);return}
  if(target.dataset.hubIndex!=null){event.preventDefault();setIndex('hub',target.dataset.hubIndex);return}
  if(target.dataset.intentionIndex!=null){event.preventDefault();setIndex('intention',target.dataset.intentionIndex);return}
  if(target.dataset.advance){event.preventDefault();advance(target.dataset.advance)}
}
function onKey(event){const carousel=event.target.closest?.('[data-carousel]');if(!carousel)return;if(!['ArrowLeft','ArrowRight','Enter',' '].includes(event.key))return;event.preventDefault();const kind=carousel.dataset.carousel;if(event.key==='ArrowLeft')rotate(kind,-1);else if(event.key==='ArrowRight')rotate(kind,1);else advance(kind)}
function onWheel(event){const carousel=event.target.closest?.('[data-carousel]');if(!carousel||state.wheelLock||Math.abs(event.deltaX)+Math.abs(event.deltaY)<8)return;event.preventDefault();state.wheelLock=true;rotate(carousel.dataset.carousel,(event.deltaX||event.deltaY)>0?1:-1);setTimeout(()=>{state.wheelLock=false},180)}
function onTouchStart(event){const carousel=event.target.closest?.('[data-carousel]');if(!carousel||!event.touches?.length)return;state.touchStart={kind:carousel.dataset.carousel,x:event.touches[0].clientX,y:event.touches[0].clientY}}
function onTouchEnd(event){if(!state.touchStart||!event.changedTouches?.length)return;const touch=event.changedTouches[0],dx=touch.clientX-state.touchStart.x,dy=touch.clientY-state.touchStart.y,kind=state.touchStart.kind;state.touchStart=null;if(Math.abs(dx)<36||Math.abs(dx)<Math.abs(dy))return;rotate(kind,dx<0?1:-1)}
function onStorage(event){if([INTENTIONS_KEY,DISCOVERY_KEY,MESH_KEY,HOUSE_KEY,HOUSE_VOTE_KEY,VOTE_INDEX_KEY].includes(event.key)){state.hubs=discoveredHubs();state.hubIndex=clamp(state.hubIndex,0,Math.max(0,state.hubs.length-1));state.intentionIndex=0;state.votes=localVotes();renderSurface()}}
function boot(){
  state.hubs=discoveredHubs();state.votes=localVotes();
  document.addEventListener('click',onClick,true);document.addEventListener('keydown',onKey,true);document.addEventListener('wheel',onWheel,{capture:true,passive:false});document.addEventListener('touchstart',onTouchStart,{capture:true,passive:true});document.addEventListener('touchend',onTouchEnd,{capture:true,passive:true});addEventListener('storage',onStorage);
  state.observer=new MutationObserver(()=>{if(state.rendering)return;const shell=document.querySelector('#rc-app .rc-shell');if(shell!==state.shell||(shouldOwnSurface()&&!document.getElementById(ROOT_ID))){state.shell=shell;renderSurface()}else addReturnLink()});state.observer.observe(document.getElementById('rc-app')||document.body,{childList:true,subtree:true});
  renderSurface();refreshVotes();
  const api=Object.freeze({version:VERSION,houses:HOUSES,paths:PATHS,refresh(){state.hubs=discoveredHubs();state.votes=localVotes();renderSurface();refreshVotes()},houseForHub:hub=>houseFor(hub),requestHouseVote});
  globalThis.CivweaveCerbanimoIntentionLandscapeV1=api;
  try{dispatchEvent(new CustomEvent('civweave:cerbanimo-intention-landscape-ready',{detail:{version:VERSION,houses:HOUSES.map(item=>item.id)}}))}catch{}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
