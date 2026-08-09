(()=>{
'use strict';

const VERSION='1.0.68-civweave-atlas-v269';
const DATA_KEYS=['civweave.atlas.data.v1','commonweave.atlas.data.v1','commonweave.public-map.v1'];
const PAIRED_KEY='civweave.atlas.paired.v1';
const FAVORITES_KEY='civweave.atlas.favorites.v1';
const VIEW_KEY='civweave.atlas.view.v1';
const CAMPUS='/app/working-campus-v156.html?installed=1&source=atlas';
const KIND_LABELS={federation:'Federation',org:'Public organization',node:'Civweave node',resource:'Resource',archive:'Archive'};
const KIND_ICONS={federation:'⌘',org:'▣',node:'✿',resource:'❧',archive:'◌',you:'●'};
const THREAD_CLASS={federation:'gold',knowledge:'cyan',node:'pink',resource:'green',archive:'silver',gold:'gold',cyan:'cyan',pink:'pink',green:'green',silver:'silver'};
const STARTER_DATA={
  schema:'civweave.atlas.v1',
  source:'starter',
  nodes:[
    {id:'fed-northstar',name:'Northstar Federation',kind:'federation',x:31,y:25,status:'active',summary:'A federation hub connecting public organizations, neighbor groups, and shared projects.',tags:['governance','mutual aid','education'],members:84,links:11,exchanges:6},
    {id:'fed-harbor',name:'Harbor Commons Federation',kind:'federation',x:67,y:49,status:'active',summary:'A civic coordination hub for local services, public information, and reciprocal support.',tags:['public commons','coordination'],members:126,links:15,exchanges:10},
    {id:'org-library',name:'Community Library',kind:'org',x:71,y:29,status:'public',summary:'Public knowledge, meeting space, and local reference access.',tags:['education','public info'],links:7},
    {id:'org-clinic',name:'Neighborhood Clinic',kind:'org',x:18,y:42,status:'public',summary:'Public-facing health and care contact point.',tags:['care','public service'],links:5},
    {id:'node-willow',name:'Willow Local Node',kind:'node',x:16,y:60,status:'pairing-ready',summary:'A nearby-ready Civweave node publishing a local discovery beacon.',tags:['local node','pairing'],links:4},
    {id:'node-workshop',name:'Workshop Relay',kind:'node',x:64,y:72,status:'pairing-ready',summary:'A Civweave node focused on skills, repair, and task exchange.',tags:['skills','repair','pairing'],links:8},
    {id:'resource-tools',name:'Toolshare',kind:'resource',x:84,y:67,status:'available',summary:'Shared tools and practical support published to the local atlas.',tags:['tools','borrow','repair'],exchanges:12},
    {id:'resource-garden',name:'Community Garden',kind:'resource',x:80,y:18,status:'available',summary:'Seasonal food, seed, and volunteer resource listing.',tags:['food','garden','volunteer'],exchanges:7},
    {id:'archive-relay',name:'Archive Relay',kind:'archive',x:38,y:72,status:'dormant',summary:'A known relay that has not announced recent activity.',tags:['archive','dormant'],links:2}
  ],
  threads:[
    {from:'fed-northstar',to:'fed-harbor',kind:'federation'},
    {from:'fed-northstar',to:'org-clinic',kind:'knowledge'},
    {from:'fed-northstar',to:'org-library',kind:'knowledge'},
    {from:'fed-northstar',to:'node-willow',kind:'node'},
    {from:'fed-harbor',to:'node-workshop',kind:'node'},
    {from:'node-willow',to:'node-workshop',kind:'node'},
    {from:'org-library',to:'resource-garden',kind:'resource'},
    {from:'node-workshop',to:'resource-tools',kind:'resource'},
    {from:'archive-relay',to:'fed-harbor',kind:'archive'},
    {from:'archive-relay',to:'node-willow',kind:'archive'}
  ]
};

const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const clean=value=>String(value??'').trim();
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const safeGet=key=>{try{return localStorage.getItem(key)}catch{return null}};
const safeSet=(key,value)=>{try{localStorage.setItem(key,value);return true}catch{return false}};
const markerLayer=$('#markerLayer');
const svg=$('#threadSvg');
const viewport=$('#mapViewport');
const world=$('#mapWorld');
const detailCard=$('#detailCard');
const sourceNote=$('#dataSourceNote');
const toastNode=$('#atlasToast');
let activeFilter='all';
let query='';
let selectedId='';
let userMarker=null;
let pointerState=null;
let view=parse(safeGet(VIEW_KEY),{scale:1,tx:0,ty:0});
view.scale=clamp(Number(view.scale)||1,.7,2.8);view.tx=Number(view.tx)||0;view.ty=Number(view.ty)||0;
let data=loadData();

function normalizeKind(value){
  const text=clean(value).toLowerCase();
  if(['federation','federations','hub'].includes(text))return'federation';
  if(['org','organization','public-org','public_organization','public organization'].includes(text))return'org';
  if(['node','civweave-node','civweave node','peer'].includes(text))return'node';
  if(['resource','resources','support','offer'].includes(text))return'resource';
  if(['archive','dormant'].includes(text))return'archive';
  return'org';
}
function deterministicPosition(id,index,total){
  let hash=2166136261;for(const char of String(id||index)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619)}
  const angle=((hash>>>0)%360)*Math.PI/180,indexAngle=(index/Math.max(1,total))*Math.PI*2;
  const radius=20+((hash>>>9)%24);
  return{x:50+Math.cos(angle+indexAngle)*radius,y:49+Math.sin(angle+indexAngle)*radius*.73};
}
function normalizeNode(node,index,total){
  const id=clean(node?.id||node?.nodeId||node?.slug||`atlas-node-${index}`);
  const fallback=deterministicPosition(id,index,total);
  const x=Number.isFinite(Number(node?.x))?clamp(Number(node.x),5,95):fallback.x;
  const y=Number.isFinite(Number(node?.y))?clamp(Number(node.y),7,93):fallback.y;
  const lat=Number(node?.lat??node?.latitude),lon=Number(node?.lon??node?.lng??node?.longitude);
  return{
    ...node,
    id,
    name:clean(node?.name||node?.title||node?.label||`Atlas point ${index+1}`),
    kind:normalizeKind(node?.kind||node?.type||node?.category),
    x,y,
    status:clean(node?.status||node?.state||'listed'),
    summary:clean(node?.summary||node?.description||node?.about||'Published atlas entry.'),
    tags:Array.isArray(node?.tags)?node.tags.map(clean).filter(Boolean).slice(0,8):[],
    lat:Number.isFinite(lat)?lat:null,
    lon:Number.isFinite(lon)?lon:null,
    url:clean(node?.url||node?.site||node?.website||''),
    members:Number(node?.members)||0,
    links:Number(node?.links)||0,
    exchanges:Number(node?.exchanges)||0
  };
}
function normalizeThread(thread,index,nodes){
  const from=clean(thread?.from||thread?.source||thread?.a),to=clean(thread?.to||thread?.target||thread?.b);
  if(!from||!to||!nodes.has(from)||!nodes.has(to))return null;
  return{id:clean(thread?.id||`thread-${index}`),from,to,kind:clean(thread?.kind||thread?.type||'knowledge').toLowerCase()};
}
function normalizeData(raw,source){
  const rows=Array.isArray(raw)?raw:Array.isArray(raw?.nodes)?raw.nodes:Array.isArray(raw?.places)?raw.places:Array.isArray(raw?.entries)?raw.entries:[];
  if(!rows.length)return null;
  const nodes=rows.map((node,index)=>normalizeNode(node,index,rows.length));
  const index=new Set(nodes.map(node=>node.id));
  const rawThreads=Array.isArray(raw?.threads)?raw.threads:Array.isArray(raw?.links)?raw.links:[];
  const threads=rawThreads.map((thread,i)=>normalizeThread(thread,i,index)).filter(Boolean);
  return{schema:clean(raw?.schema||'civweave.atlas.v1'),source,nodes,threads};
}
function loadData(){
  for(const key of DATA_KEYS){const raw=parse(safeGet(key),null),normalized=raw&&normalizeData(raw,key);if(normalized)return normalized}
  return normalizeData(STARTER_DATA,'starter');
}
function pairedIds(){const value=parse(safeGet(PAIRED_KEY),[]);return new Set(Array.isArray(value)?value.map(String):[])}
function favoriteIds(){const value=parse(safeGet(FAVORITES_KEY),[]);return new Set(Array.isArray(value)?value.map(String):[])}
function persistSet(key,set){safeSet(key,JSON.stringify([...set]))}
function toast(message){toastNode.textContent=message;toastNode.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>{toastNode.hidden=true},3200)}
function visible(node){
  if(activeFilter!=='all'&&node.kind!==activeFilter)return false;
  if(!query)return true;
  const haystack=[node.name,node.summary,node.status,...node.tags].join(' ').toLowerCase();
  return haystack.includes(query);
}
function filteredNodes(){return data.nodes.filter(visible)}
function nodeById(id){return data.nodes.find(node=>node.id===id)||null}
function svgPoint(node){return{x:node.x*10,y:node.y*7.2}}
function curvedPath(a,b,index){
  const p1=svgPoint(a),p2=svgPoint(b),mx=(p1.x+p2.x)/2,my=(p1.y+p2.y)/2;
  const bend=((index%3)-1)*24,dx=p2.x-p1.x,dy=p2.y-p1.y,len=Math.hypot(dx,dy)||1;
  const cx=mx-dy/len*bend,cy=my+dx/len*bend;
  return`M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
}
function renderThreads(){
  const shown=new Set(filteredNodes().map(node=>node.id));
  svg.innerHTML=data.threads.map((thread,index)=>{
    if(!shown.has(thread.from)||!shown.has(thread.to))return'';
    const a=nodeById(thread.from),b=nodeById(thread.to);if(!a||!b)return'';
    const cls=THREAD_CLASS[thread.kind]||'cyan';
    return`<path class="thread ${cls}" d="${curvedPath(a,b,index)}"></path>`;
  }).join('');
}
function renderMarkers(){
  const favorites=favoriteIds(),paired=pairedIds();
  markerLayer.innerHTML=filteredNodes().map(node=>{
    const icon=KIND_ICONS[node.kind]||'•',suffix=paired.has(node.id)?' · paired':favorites.has(node.id)?' · saved':'';
    return`<button class="marker ${esc(node.kind)}${selectedId===node.id?' selected':''}" type="button" data-node="${esc(node.id)}" style="left:${node.x}%;top:${node.y}%" aria-label="${esc(node.name)}, ${esc(KIND_LABELS[node.kind]||node.kind)}${esc(suffix)}"><span class="marker-core" aria-hidden="true">${icon}</span><span class="marker-label">${esc(node.name)}</span></button>`;
  }).join('')+(userMarker?`<button class="marker you" type="button" data-user-marker style="left:${userMarker.x}%;top:${userMarker.y}%" aria-label="Your locally captured position"><span class="marker-core">●</span><span class="marker-label">You are here</span></button>`:'');
  $$('[data-node]').forEach(button=>button.addEventListener('click',event=>{event.stopPropagation();selectNode(button.dataset.node)}));
  $('[data-user-marker]')?.addEventListener('click',event=>{event.stopPropagation();renderUserDetail()});
}
function renderDetail(node){
  if(!node){detailCard.innerHTML='<h2>Atlas selection</h2><p>Select a federation, public organization, Civweave node, or resource to inspect its locally available details.</p><p class="empty-note">Search and filters work entirely on-device. Imported Commonweave data is read from local storage when available.</p>';return}
  const favorites=favoriteIds(),paired=pairedIds(),isFavorite=favorites.has(node.id),isPaired=paired.has(node.id),canPair=node.kind==='node',canDirections=Number.isFinite(node.lat)&&Number.isFinite(node.lon);
  const stats=[['Members',node.members],['Links',node.links],['Exchanges',node.exchanges]].filter(([,value])=>value>0);
  detailCard.innerHTML=`<div class="detail-head"><div class="detail-icon" aria-hidden="true">${KIND_ICONS[node.kind]||'•'}</div><div><h2>${esc(node.name)}</h2><span class="eyebrow">${esc(KIND_LABELS[node.kind]||node.kind)} · ${esc(node.status||'listed')}</span></div><button class="detail-fav" id="favoriteNode" type="button" aria-label="${isFavorite?'Remove from saved':'Save this atlas entry'}">${isFavorite?'♥':'♡'}</button></div><p>${esc(node.summary)}</p>${node.tags.length?`<div class="tags">${node.tags.map(tag=>`<span class="tag">${esc(tag)}</span>`).join('')}</div>`:''}${stats.length?`<div class="stats">${stats.map(([label,value])=>`<div class="stat"><strong>${value}</strong>${label}</div>`).join('')}</div>`:''}<div class="detail-actions">${canPair?`<button class="primary" id="pairNode" type="button">${isPaired?'Paired locally':'Pair node'}</button>`:''}<button id="directionsNode" type="button" ${canDirections?'':'disabled'}>${canDirections?'Directions':'No coordinates'}</button>${node.url?'<button id="openSite" type="button">Open public site</button>':''}</div>`;
  $('#favoriteNode')?.addEventListener('click',()=>toggleFavorite(node.id));
  $('#pairNode')?.addEventListener('click',()=>pairNode(node));
  $('#directionsNode')?.addEventListener('click',()=>openDirections(node));
  $('#openSite')?.addEventListener('click',()=>openSite(node));
}
function renderUserDetail(){
  detailCard.innerHTML='<div class="detail-head"><div class="detail-icon">●</div><div><h2>Your position</h2><span class="eyebrow">LOCAL DEVICE LOCATION</span></div></div><p>Your location was captured only for this Atlas session. Civweave does not publish it as a node just because you located yourself.</p>';
}
function selectNode(id){selectedId=id;renderMarkers();renderDetail(nodeById(id))}
function toggleFavorite(id){const set=favoriteIds();set.has(id)?set.delete(id):set.add(id);persistSet(FAVORITES_KEY,set);renderMarkers();renderDetail(nodeById(id));toast(set.has(id)?'Saved to this device.':'Removed from saved atlas entries.')}
function pairNode(node){
  const set=pairedIds();
  if(set.has(node.id)){toast(`${node.name} is already paired on this device.`);return}
  const detail={schema:'civweave.atlas-pair-request.v1',node:{id:node.id,name:node.name,url:node.url,status:node.status},requestedAt:new Date().toISOString(),handled:false};
  const event=new CustomEvent('civweave:atlas-pair-request',{detail,cancelable:true});
  dispatchEvent(event);
  set.add(node.id);persistSet(PAIRED_KEY,set);
  renderMarkers();renderDetail(node);
  toast(detail.handled?'Pairing request handed to the local Civweave runtime.':'Node saved as paired locally. A mesh runtime can claim the pairing event when available.')
}
function openDirections(node){
  if(!Number.isFinite(node.lat)||!Number.isFinite(node.lon))return;
  location.href=`geo:${node.lat},${node.lon}?q=${node.lat},${node.lon}(${encodeURIComponent(node.name)})`;
}
function openSite(node){
  try{const url=new URL(node.url,location.href);if(!['http:','https:'].includes(url.protocol))throw new Error('Unsupported URL');window.open(url.href,'_blank','noopener,noreferrer')}catch{toast('This atlas entry does not contain a safe public web address.')}
}
function renderSource(){
  if(data.source==='starter'){sourceNote.textContent='Using the built-in offline starter layer until Commonweave or a local node supplies map data.';return}
  sourceNote.textContent=`Local atlas data loaded from ${data.source}. ${data.nodes.length} places and nodes are available on this device.`;
}
function render(){renderThreads();renderMarkers();renderDetail(selectedId?nodeById(selectedId):null);renderSource();applyView()}
function setFilter(value){activeFilter=value;$$('[data-filter]').forEach(button=>button.classList.toggle('active',button.dataset.filter===value));selectedId='';render()}
function applyView(){world.style.transform=`translate(${view.tx}px,${view.ty}px) scale(${view.scale})`;safeSet(VIEW_KEY,JSON.stringify(view))}
function zoomBy(amount,origin=null){
  const old=view.scale,next=clamp(old+amount,.7,2.8);if(next===old)return;
  if(origin){const rect=viewport.getBoundingClientRect(),ox=origin.x-rect.left-rect.width/2,oy=origin.y-rect.top-rect.height/2,ratio=next/old;view.tx=ox-(ox-view.tx)*ratio;view.ty=oy-(oy-view.ty)*ratio}
  view.scale=next;applyView()
}
function resetView(){view={scale:1,tx:0,ty:0};applyView()}
function locate(){
  if(!navigator.geolocation){toast('This device does not expose browser location to the Atlas.');return}
  const button=$('#locateButton');button.disabled=true;button.textContent='…';
  navigator.geolocation.getCurrentPosition(position=>{
    button.disabled=false;button.textContent='⌾';
    userMarker={x:50,y:53,lat:position.coords.latitude,lon:position.coords.longitude,accuracy:position.coords.accuracy};
    renderMarkers();renderUserDetail();toast(`Location captured locally${Number.isFinite(position.coords.accuracy)?` · accuracy about ${Math.round(position.coords.accuracy)} m`:''}.`)
  },error=>{button.disabled=false;button.textContent='⌾';toast(error.code===1?'Location permission was not granted.':'Civweave could not read device location right now.')},{enableHighAccuracy:false,timeout:9000,maximumAge:300000})
}
function updateStatus(){
  const dot=$('#statusDot'),label=$('#atlasStatus');
  if(navigator.onLine){dot.classList.remove('offline');label.textContent=data.source==='starter'?'Local atlas ready · starter layer':'Local atlas ready · Commonweave data loaded'}
  else{dot.classList.add('offline');label.textContent='Offline · local atlas ready'}
}
function reloadData(){const next=loadData();if(next.source===data.source&&next.nodes.length===data.nodes.length)return;data=next;selectedId='';render();updateStatus();toast('Atlas data refreshed from local storage.')}
function setPairedFilter(){
  const paired=pairedIds();query='';$('#atlasSearch').value='';activeFilter='all';$$('[data-filter]').forEach(button=>button.classList.toggle('active',button.dataset.filter==='all'));
  const original=visible;void original;
  markerLayer.innerHTML='';
  const nodes=data.nodes.filter(node=>paired.has(node.id));
  const savedData=data;data={...data,nodes,threads:data.threads.filter(thread=>paired.has(thread.from)&&paired.has(thread.to))};selectedId='';render();data=savedData;
  if(!nodes.length)toast('No paired Civweave nodes are stored on this device yet.')
}
function showThreads(){activeFilter='all';query='';$('#atlasSearch').value='';$$('[data-filter]').forEach(button=>button.classList.toggle('active',button.dataset.filter==='all'));render();$('#legendCard').scrollIntoView({behavior:'smooth',block:'nearest'})}
function showHelp(){toast('Atlas stays useful offline. Search or filter locally, drag to roam, zoom with the controls, and select pink Civweave nodes to pair them on this device.')}

$('#atlasBack')?.addEventListener('click',()=>{if(history.length>1)history.back();else location.assign(CAMPUS)});
$('#atlasHelp')?.addEventListener('click',showHelp);
$('#clearSearch')?.addEventListener('click',()=>{$('#atlasSearch').value='';query='';render();$('#atlasSearch').focus()});
$('#atlasSearch')?.addEventListener('input',event=>{query=clean(event.target.value).toLowerCase();selectedId='';render()});
$$('[data-filter]').forEach(button=>button.addEventListener('click',()=>setFilter(button.dataset.filter)));
$('#zoomIn')?.addEventListener('click',()=>zoomBy(.2));
$('#zoomOut')?.addEventListener('click',()=>zoomBy(-.2));
$('#resetMap')?.addEventListener('click',resetView);
$('#recenterButton')?.addEventListener('click',resetView);
$('#locateButton')?.addEventListener('click',locate);
viewport?.addEventListener('wheel',event=>{event.preventDefault();zoomBy(event.deltaY<0?.12:-.12,{x:event.clientX,y:event.clientY})},{passive:false});
viewport?.addEventListener('pointerdown',event=>{if(event.target.closest?.('.marker,.map-controls'))return;pointerState={id:event.pointerId,x:event.clientX,y:event.clientY,tx:view.tx,ty:view.ty};viewport.setPointerCapture?.(event.pointerId);viewport.classList.add('dragging')});
viewport?.addEventListener('pointermove',event=>{if(!pointerState||event.pointerId!==pointerState.id)return;view.tx=pointerState.tx+(event.clientX-pointerState.x);view.ty=pointerState.ty+(event.clientY-pointerState.y);applyView()});
const endPointer=event=>{if(!pointerState||event.pointerId!==pointerState.id)return;pointerState=null;viewport.classList.remove('dragging')};
viewport?.addEventListener('pointerup',endPointer);viewport?.addEventListener('pointercancel',endPointer);
$$('[data-atlas-nav]').forEach(button=>button.addEventListener('click',()=>{
  const nav=button.dataset.atlasNav;
  if(nav==='campus'){location.assign(CAMPUS);return}
  if(nav==='paired'){setPairedFilter();return}
  if(nav==='threads'){showThreads();return}
  setFilter('all')
}));
addEventListener('online',updateStatus);addEventListener('offline',updateStatus);
addEventListener('storage',event=>{if(DATA_KEYS.includes(event.key))reloadData();if([PAIRED_KEY,FAVORITES_KEY].includes(event.key))render()});
addEventListener('commonweave:atlas-data',event=>{
  const normalized=normalizeData(event.detail?.data||event.detail,'commonweave:event');if(!normalized)return;
  safeSet('commonweave.atlas.data.v1',JSON.stringify(event.detail?.data||event.detail));data=normalized;selectedId='';render();updateStatus()
});

render();updateStatus();
globalThis.CivweaveAtlasV269=Object.freeze({version:VERSION,reload:reloadData,reset:resetView,select:selectNode,open:()=>location.assign('/app/civweave-atlas-v269.html'),data:()=>structuredClone?structuredClone(data):JSON.parse(JSON.stringify(data))});
dispatchEvent(new CustomEvent('civweave:atlas-ready',{detail:{version:VERSION,source:data.source,nodeCount:data.nodes.length}}));
})();
