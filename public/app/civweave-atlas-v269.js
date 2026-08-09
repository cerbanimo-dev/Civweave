(()=>{
'use strict';

const VERSION='1.0.68-civweave-atlas-v269-commonweave';
const DATA_KEYS=['civweave.atlas.data.v1','commonweave.atlas.data.v1','commonweave.public-map.v1'];
const PAIRED_KEY='civweave.atlas.paired.v1';
const FAVORITES_KEY='civweave.atlas.favorites.v1';
const VIEW_KEY='civweave.atlas.view.v1';
const COMMONWEAVE_SYNC_KEY='civweave.atlas.commonweave.synced-at.v1';
const COMMONWEAVE_CACHE='civweave-atlas-commonweave-v1';
const COMMONWEAVE_REFRESH_MS=24*60*60*1000;
const COMMONWEAVE_POINTS_URLS=[
  'https://commonweave.earth/data/map/orgs.geojson',
  'https://raw.githubusercontent.com/simonlpaige/commonweave/master/data/map/orgs.geojson'
];
const COMMONWEAVE_EDGES_URLS=[
  'https://commonweave.earth/data/map/edges.json',
  'https://raw.githubusercontent.com/simonlpaige/commonweave/master/data/map/edges.json'
];
const CAMPUS='/app/working-campus-v156.html?installed=1&source=atlas';
const KIND_LABELS={federation:'Federation',org:'Public organization',node:'Civweave node',resource:'Resource',archive:'Archive'};
const KIND_ICONS={federation:'⌘',org:'▣',node:'✿',resource:'❧',archive:'◌',you:'●'};
const THREAD_CLASS={federation:'gold',knowledge:'cyan',node:'pink',resource:'green',archive:'silver',gold:'gold',cyan:'cyan',pink:'pink',green:'green',silver:'silver'};
const COMMONWEAVE_AREA_LABELS={democracy:'Democracy',cooperatives:'Cooperatives',healthcare:'Healthcare',food:'Food',education:'Education',housing_land:'Housing & land',conflict:'Conflict resolution',energy_digital:'Energy & digital commons',recreation_arts:'Recreation & arts',ecology:'Ecology',unknown:'Unclassified'};
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
const publicCanvas=$('#publicPointCanvas');
const publicCtx=publicCanvas?.getContext('2d')||null;
const viewport=$('#mapViewport');
const world=$('#mapWorld');
const detailCard=$('#detailCard');
const sourceNote=$('#dataSourceNote');
const mapCount=$('#mapCount');
const toastNode=$('#atlasToast');
let activeFilter='all';
let pairedOnly=false;
let query='';
let selectedId='';
let selectedThreads=[];
let commonweaveEdges=null;
let commonweaveEdgesPromise=null;
let userMarker=null;
let pointerState=null;
let syncInProgress=false;
let view=parse(safeGet(VIEW_KEY),{scale:1,tx:0,ty:0});
view.scale=clamp(Number(view.scale)||1,.7,3.8);view.tx=Number(view.tx)||0;view.ty=Number(view.ty)||0;
let localData=loadLocalData();
let commonweaveData=null;
let data=composeData();
let nodeIndex=new Map();
rebuildIndex();

function normalizeKind(value){
  const text=clean(value).toLowerCase();
  if(['federation','federations','hub'].includes(text))return'federation';
  if(['org','organization','public-org','public_organization','public organization','nonprofit','cooperative','foundation','government','research','education_inst','mutual_aid'].includes(text))return'org';
  if(['node','civweave-node','civweave node','peer'].includes(text))return'node';
  if(['resource','resources','support','offer'].includes(text))return'resource';
  if(['archive','dormant'].includes(text))return'archive';
  return'org';
}
function projectLonLat(lon,lat){
  const longitude=clamp(Number(lon),-180,180),latitude=clamp(Number(lat),-85,85);
  const x=5+((longitude+180)/360)*90;
  const radians=latitude*Math.PI/180;
  const mercator=(1-Math.asinh(Math.tan(radians))/Math.PI)/2;
  const y=7+mercator*86;
  return{x:clamp(x,5,95),y:clamp(y,7,93)};
}
function deterministicPosition(id,index,total){
  let hash=2166136261;for(const char of String(id||index)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619)}
  const angle=((hash>>>0)%360)*Math.PI/180,indexAngle=(index/Math.max(1,total))*Math.PI*2;
  const radius=20+((hash>>>9)%24);
  return{x:50+Math.cos(angle+indexAngle)*radius,y:49+Math.sin(angle+indexAngle)*radius*.73};
}
function normalizeNode(node,index,total,source='local'){
  const id=clean(node?.id||node?.nodeId||node?.slug||`atlas-node-${index}`);
  const lat=Number(node?.lat??node?.latitude??node?.la),lon=Number(node?.lon??node?.lng??node?.longitude??node?.lo);
  const projected=Number.isFinite(lat)&&Number.isFinite(lon)?projectLonLat(lon,lat):null;
  const fallback=deterministicPosition(id,index,total);
  const x=Number.isFinite(Number(node?.x))?clamp(Number(node.x),5,95):projected?.x??fallback.x;
  const y=Number.isFinite(Number(node?.y))?clamp(Number(node.y),7,93):projected?.y??fallback.y;
  const modelType=clean(node?.modelType||node?.model_type||node?.m||'');
  const frameworkArea=clean(node?.frameworkArea||node?.framework_area||node?.f||'');
  const qualityTier=clean(node?.qualityTier||node?.quality_tier||node?.tier||node?.t||'');
  const country=clean(node?.country||node?.country_code||node?.cc||'');
  const state=clean(node?.state||node?.st||'');
  const city=clean(node?.city||node?.ci||'');
  const inferredKind=modelType.toLowerCase()==='federation'?'federation':normalizeKind(node?.kind||node?.type||node?.category||modelType);
  const tags=Array.isArray(node?.tags)?node.tags.map(clean).filter(Boolean):[];
  for(const tag of [frameworkArea,modelType,country,qualityTier])if(tag&&!tags.includes(tag))tags.push(tag);
  const summary=clean(node?.summary||node?.description||node?.about||node?.d||'')||[COMMONWEAVE_AREA_LABELS[frameworkArea]||frameworkArea,modelType&&modelType.replace(/_/g,' ')].filter(Boolean).join(' · ')||'Published atlas entry.';
  return{
    ...node,id,
    name:clean(node?.name||node?.title||node?.label||node?.n||`Atlas point ${index+1}`),
    kind:inferredKind,x,y,
    status:clean(node?.status||node?.stateLabel||node?.state_status||qualityTier||'listed'),
    summary,tags:tags.slice(0,10),
    lat:Number.isFinite(lat)?lat:null,lon:Number.isFinite(lon)?lon:null,
    url:clean(node?.url||node?.site||node?.website||node?.w||''),
    contactUrl:clean(node?.contactUrl||node?.contact_url||node?.cu||''),
    members:Number(node?.members)||0,links:Number(node?.links)||0,exchanges:Number(node?.exchanges)||0,
    modelType,frameworkArea,qualityTier,country,state,city,
    sourceLabel:clean(node?.sourceLabel||node?.source||node?.src||source),
    geoSource:clean(node?.geoSource||node?.geo_source||node?.gs||''),
    origin:source
  };
}
function normalizeCommonweaveFeature(feature,index,total){
  const props=feature?.properties||{};
  const coords=Array.isArray(feature?.geometry?.coordinates)?feature.geometry.coordinates:[];
  return normalizeNode({...props,id:props.id||feature?.id,lon:coords[0],lat:coords[1]},index,total,'commonweave');
}
function normalizeThread(thread,index,nodes){
  const from=clean(thread?.from||thread?.source||thread?.a||thread?.source_id),to=clean(thread?.to||thread?.target||thread?.b||thread?.target_id);
  if(!from||!to||!nodes.has(from)||!nodes.has(to))return null;
  return{id:clean(thread?.id||`thread-${index}`),from,to,kind:clean(thread?.kind||thread?.type||thread?.edge_type||'knowledge').toLowerCase(),weight:Number(thread?.weight??thread?.w)||0};
}
function normalizeData(raw,source){
  if(raw?.type==='FeatureCollection'&&Array.isArray(raw.features)){
    const nodes=raw.features.map((feature,index)=>normalizeCommonweaveFeature(feature,index,raw.features.length));
    return{schema:'commonweave.map.geojson',source,nodes,threads:[]};
  }
  const rows=Array.isArray(raw)?raw:Array.isArray(raw?.nodes)?raw.nodes:Array.isArray(raw?.places)?raw.places:Array.isArray(raw?.entries)?raw.entries:[];
  if(!rows.length)return null;
  const nodes=rows.map((node,index)=>normalizeNode(node,index,rows.length,source));
  const index=new Set(nodes.map(node=>node.id));
  const rawThreads=Array.isArray(raw?.threads)?raw.threads:Array.isArray(raw?.links)?raw.links:[];
  const threads=rawThreads.map((thread,i)=>normalizeThread(thread,i,index)).filter(Boolean);
  return{schema:clean(raw?.schema||'civweave.atlas.v1'),source,nodes,threads};
}
function loadLocalData(){
  for(const key of DATA_KEYS){const raw=parse(safeGet(key),null),normalized=raw&&normalizeData(raw,key);if(normalized)return normalized}
  return null;
}
function starterData(){return normalizeData(STARTER_DATA,'starter')}
function composeData(){
  if(!commonweaveData)return localData||starterData();
  const extra=localData?.nodes||[];
  const seen=new Set(commonweaveData.nodes.map(node=>node.id));
  const nodes=commonweaveData.nodes.concat(extra.filter(node=>!seen.has(node.id)));
  return{schema:'civweave.atlas.composite.v1',source:commonweaveData.source,nodes,threads:localData?.threads||[]};
}
function rebuildIndex(){nodeIndex=new Map(data.nodes.map(node=>[node.id,node]))}
function nodeById(id){return nodeIndex.get(id)||null}
function pairedIds(){const value=parse(safeGet(PAIRED_KEY),[]);return new Set(Array.isArray(value)?value.map(String):[])}
function favoriteIds(){const value=parse(safeGet(FAVORITES_KEY),[]);return new Set(Array.isArray(value)?value.map(String):[])}
function persistSet(key,set){safeSet(key,JSON.stringify([...set]))}
function toast(message){toastNode.textContent=message;toastNode.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>{toastNode.hidden=true},3400)}
function visible(node){
  if(pairedOnly&&!pairedIds().has(node.id))return false;
  if(activeFilter!=='all'&&node.kind!==activeFilter)return false;
  if(!query)return true;
  const haystack=[node.name,node.summary,node.status,node.country,node.state,node.city,node.frameworkArea,node.modelType,node.sourceLabel,...node.tags].join(' ').toLowerCase();
  return haystack.includes(query);
}
function filteredNodes(){return data.nodes.filter(visible)}
function svgPoint(node){return{x:node.x*10,y:node.y*7.2}}
function curvedPath(a,b,index){
  const p1=svgPoint(a),p2=svgPoint(b),mx=(p1.x+p2.x)/2,my=(p1.y+p2.y)/2;
  const bend=((index%3)-1)*24,dx=p2.x-p1.x,dy=p2.y-p1.y,len=Math.hypot(dx,dy)||1;
  const cx=mx-dy/len*bend,cy=my+dx/len*bend;
  return`M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
}
function renderThreads(){
  const shown=new Set(filteredNodes().map(node=>node.id));
  const threads=[...(data.threads||[]),...selectedThreads];
  svg.innerHTML=threads.map((thread,index)=>{
    if(!shown.has(thread.from)||!shown.has(thread.to))return'';
    const a=nodeById(thread.from),b=nodeById(thread.to);if(!a||!b)return'';
    const rawKind=thread.kind.includes?.('federation')?'federation':thread.kind;
    const cls=THREAD_CLASS[rawKind]||'cyan';
    const width=thread.weight?Math.min(4,1.5+thread.weight*2.5):2.2;
    return`<path class="thread ${cls}" style="stroke-width:${width}" d="${curvedPath(a,b,index)}"></path>`;
  }).join('');
}
function qualityOpacity(node){
  const tier=node.qualityTier.toUpperCase();
  if(tier==='A')return.95;if(tier==='B')return.82;if(tier==='C')return.42;
  if(tier==='CANDIDATE'||tier==='D')return.22;return.58;
}
function renderPublicPoints(){
  if(!publicCtx)return;
  publicCtx.clearRect(0,0,publicCanvas.width,publicCanvas.height);
  const nodes=filteredNodes().filter(node=>node.origin==='commonweave');
  publicCtx.save();
  for(const node of nodes){
    const x=node.x*10,y=node.y*7.2;
    publicCtx.globalAlpha=qualityOpacity(node);
    publicCtx.fillStyle=node.kind==='federation'?'#d8b766':'#79d9d6';
    const radius=node.id===selectedId?4.8:node.kind==='federation'?3.2:node.qualityTier.toUpperCase()==='B'?2.0:1.35;
    publicCtx.beginPath();publicCtx.arc(x,y,radius,0,Math.PI*2);publicCtx.fill();
    if(node.id===selectedId){publicCtx.globalAlpha=.95;publicCtx.strokeStyle='#f1d991';publicCtx.lineWidth=1.5;publicCtx.beginPath();publicCtx.arc(x,y,7,0,Math.PI*2);publicCtx.stroke()}
  }
  publicCtx.restore();
  const total=nodes.length;
  mapCount.textContent=commonweaveData?`${total.toLocaleString()} visible`:(total?`${total.toLocaleString()} visible`:'Local layer');
}
function markerCandidates(){
  const visibleNodes=filteredNodes();
  const local=visibleNodes.filter(node=>node.origin!=='commonweave');
  const publicNodes=visibleNodes.filter(node=>node.origin==='commonweave');
  const picks=[...local];
  if(query)picks.push(...publicNodes.slice(0,90));
  else if(activeFilter==='federation')picks.push(...publicNodes.slice(0,120));
  const selected=selectedId?nodeById(selectedId):null;
  if(selected&&selected.origin==='commonweave'&&!picks.some(node=>node.id===selected.id))picks.push(selected);
  const seen=new Set();return picks.filter(node=>!seen.has(node.id)&&seen.add(node.id));
}
function renderMarkers(){
  const favorites=favoriteIds(),paired=pairedIds();
  markerLayer.innerHTML=markerCandidates().map(node=>{
    const icon=KIND_ICONS[node.kind]||'•',suffix=paired.has(node.id)?' · paired':favorites.has(node.id)?' · saved':'';
    return`<button class="marker ${esc(node.kind)}${selectedId===node.id?' selected':''}" type="button" data-node="${esc(node.id)}" style="left:${node.x}%;top:${node.y}%" aria-label="${esc(node.name)}, ${esc(KIND_LABELS[node.kind]||node.kind)}${esc(suffix)}"><span class="marker-core" aria-hidden="true">${icon}</span><span class="marker-label">${esc(node.name)}</span></button>`;
  }).join('')+(userMarker?`<button class="marker you" type="button" data-user-marker style="left:${userMarker.x}%;top:${userMarker.y}%" aria-label="Your locally captured position"><span class="marker-core">●</span><span class="marker-label">You are here</span></button>`:'');
  $$('[data-node]').forEach(button=>button.addEventListener('click',event=>{event.stopPropagation();selectNode(button.dataset.node)}));
  $('[data-user-marker]')?.addEventListener('click',event=>{event.stopPropagation();renderUserDetail()});
}
function locationText(node){return [node.city,node.state,node.country].filter(Boolean).join(', ')}
function renderDetail(node){
  if(!node){detailCard.innerHTML=`<h2>Atlas selection</h2><p>Select a federation, public organization, Civweave node, or resource to inspect its locally available details.</p><p class="empty-note">${commonweaveData?'Commonweave public map points are drawn directly on the atlas. Tap a glowing point to inspect it.':'The offline starter layer remains available until a cached or live Commonweave snapshot can be loaded.'}</p>`;return}
  const favorites=favoriteIds(),paired=pairedIds(),isFavorite=favorites.has(node.id),isPaired=paired.has(node.id),canPair=node.kind==='node',canDirections=Number.isFinite(node.lat)&&Number.isFinite(node.lon),isCommonweave=node.origin==='commonweave';
  const stats=[['Members',node.members],['Links',node.links],['Exchanges',node.exchanges]];
  if(isCommonweave&&node.qualityTier)stats.unshift(['Tier',node.qualityTier]);
  if(selectedThreads.length&&isCommonweave)stats.push(['Threads',selectedThreads.length]);
  const shownStats=stats.filter(([,value])=>value!==0&&value!=='');
  const metaTags=[...node.tags];const loc=locationText(node);if(loc&&!metaTags.includes(loc))metaTags.push(loc);
  detailCard.innerHTML=`<div class="detail-head"><div class="detail-icon" aria-hidden="true">${KIND_ICONS[node.kind]||'•'}</div><div><h2>${esc(node.name)}</h2><span class="eyebrow">${esc(KIND_LABELS[node.kind]||node.kind)} · ${esc(node.status||'listed')}</span></div><button class="detail-fav" id="favoriteNode" type="button" aria-label="${isFavorite?'Remove from saved':'Save this atlas entry'}">${isFavorite?'♥':'♡'}</button></div><p>${esc(node.summary)}</p>${metaTags.length?`<div class="tags">${metaTags.slice(0,8).map(tag=>`<span class="tag">${esc(COMMONWEAVE_AREA_LABELS[tag]||tag.replace?.(/_/g,' ')||tag)}</span>`).join('')}</div>`:''}${shownStats.length?`<div class="stats">${shownStats.slice(0,3).map(([label,value])=>`<div class="stat"><strong>${esc(value)}</strong>${label}</div>`).join('')}</div>`:''}${isCommonweave?`<p class="empty-note">Commonweave source: ${esc(node.sourceLabel||'public map')} ${node.geoSource?`· location precision: ${esc(node.geoSource)}`:''}</p>`:''}<div class="detail-actions">${canPair?`<button class="primary" id="pairNode" type="button">${isPaired?'Paired locally':'Pair node'}</button>`:''}<button id="directionsNode" type="button" ${canDirections?'':'disabled'}>${canDirections?'Directions':'No coordinates'}</button>${node.url?'<button id="openSite" type="button">Open public site</button>':''}${node.contactUrl?'<button id="openContact" type="button">Contact</button>':''}${isCommonweave?`<button id="loadThreads" type="button">${commonweaveEdges?`${selectedThreads.length} threads loaded`:'Load threads'}</button>`:''}</div>`;
  $('#favoriteNode')?.addEventListener('click',()=>toggleFavorite(node.id));
  $('#pairNode')?.addEventListener('click',()=>pairNode(node));
  $('#directionsNode')?.addEventListener('click',()=>openDirections(node));
  $('#openSite')?.addEventListener('click',()=>openSafeUrl(node.url));
  $('#openContact')?.addEventListener('click',()=>openSafeUrl(node.contactUrl));
  $('#loadThreads')?.addEventListener('click',()=>loadSelectedThreads(node));
}
function haversineKm(aLat,aLon,bLat,bLon){
  const r=6371,toRad=value=>value*Math.PI/180,dLat=toRad(bLat-aLat),dLon=toRad(bLon-aLon),lat1=toRad(aLat),lat2=toRad(bLat);
  const x=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;return 2*r*Math.asin(Math.sqrt(x));
}
function nearestCommonweave(lat,lon,count=5){
  if(!commonweaveData)return[];
  const rows=[];
  for(const node of commonweaveData.nodes){if(!Number.isFinite(node.lat)||!Number.isFinite(node.lon))continue;rows.push({node,distance:haversineKm(lat,lon,node.lat,node.lon)})}
  rows.sort((a,b)=>a.distance-b.distance);return rows.slice(0,count);
}
function renderUserDetail(){
  const nearby=userMarker?nearestCommonweave(userMarker.lat,userMarker.lon,5):[];
  detailCard.innerHTML=`<div class="detail-head"><div class="detail-icon">●</div><div><h2>Your position</h2><span class="eyebrow">LOCAL DEVICE LOCATION</span></div></div><p>Your location was captured only for this Atlas session. Civweave does not publish it as a node just because you located yourself.</p>${nearby.length?`<div class="nearby-list"><span class="eyebrow">Nearest mapped public organizations</span>${nearby.map(({node,distance})=>`<button class="nearby-row" type="button" data-nearby-id="${esc(node.id)}"><strong>${esc(node.name)}</strong><small>${distance<10?distance.toFixed(1):Math.round(distance)} km</small></button>`).join('')}</div>`:'<p class="empty-note">No Commonweave map snapshot is available yet, so nearby public organizations cannot be ranked offline.</p>'}`;
  $$('[data-nearby-id]').forEach(button=>button.addEventListener('click',()=>{selectNode(button.dataset.nearbyId);centerOnNode(nodeById(button.dataset.nearbyId),2.7)}));
}
function selectNode(id){selectedId=id;selectedThreads=[];renderPublicPoints();renderMarkers();renderThreads();renderDetail(nodeById(id))}
function toggleFavorite(id){const set=favoriteIds();set.has(id)?set.delete(id):set.add(id);persistSet(FAVORITES_KEY,set);renderMarkers();renderDetail(nodeById(id));toast(set.has(id)?'Saved to this device.':'Removed from saved atlas entries.')}
function pairNode(node){
  const set=pairedIds();if(set.has(node.id)){toast(`${node.name} is already paired on this device.`);return}
  const detail={schema:'civweave.atlas-pair-request.v1',node:{id:node.id,name:node.name,url:node.url,status:node.status,lat:node.lat,lon:node.lon},requestedAt:new Date().toISOString(),handled:false};
  dispatchEvent(new CustomEvent('civweave:atlas-pair-request',{detail,cancelable:true}));
  set.add(node.id);persistSet(PAIRED_KEY,set);renderMarkers();renderDetail(node);
  toast(detail.handled?'Pairing request handed to the local Civweave runtime.':'Node saved as paired locally. A mesh runtime can claim the pairing event when available.')
}
function openDirections(node){if(!Number.isFinite(node.lat)||!Number.isFinite(node.lon))return;location.href=`geo:${node.lat},${node.lon}?q=${node.lat},${node.lon}(${encodeURIComponent(node.name)})`}
function openSafeUrl(value){
  try{const url=new URL(value,location.href);if(!['http:','https:'].includes(url.protocol))throw new Error('unsupported');window.open(url.href,'_blank','noopener,noreferrer')}catch{toast('This atlas entry does not contain a safe public web address.')}
}
async function openAtlasCache(){if(!('caches'in globalThis))return null;try{return await caches.open(COMMONWEAVE_CACHE)}catch{return null}}
async function readCachedJson(urls){
  const cache=await openAtlasCache();if(!cache)return null;
  for(const url of urls){try{const response=await cache.match(url);if(response)return await response.clone().json()}catch{}}
  return null;
}
async function fetchAndCacheJson(urls){
  const cache=await openAtlasCache();let lastError=null;
  for(const url of urls){
    try{
      const response=await fetch(url,{mode:'cors',cache:'no-store',credentials:'omit'});if(!response.ok)throw new Error(`HTTP ${response.status}`);
      if(cache)try{await cache.put(url,response.clone())}catch{}
      return await response.json();
    }catch(error){lastError=error}
  }
  throw lastError||new Error('No Commonweave source responded.');
}
function applyCommonweave(raw,source){
  const normalized=normalizeData(raw,source);if(!normalized||!normalized.nodes.length)return false;
  normalized.nodes.forEach(node=>{node.origin='commonweave'});commonweaveData=normalized;data=composeData();rebuildIndex();selectedId='';selectedThreads=[];render();updateStatus();return true;
}
function setSyncStatus(message){syncInProgress=true;const dot=$('#statusDot'),label=$('#atlasStatus');dot.classList.remove('offline');dot.classList.add('syncing');label.textContent=message}
async function hydrateCommonweave(force=false){
  if(syncInProgress)return false;setSyncStatus('Checking Commonweave map data…');let loaded=false;
  try{
    const cached=await readCachedJson(COMMONWEAVE_POINTS_URLS);if(cached)loaded=applyCommonweave(cached,'commonweave-cache')||loaded;
    const last=Number(safeGet(COMMONWEAVE_SYNC_KEY))||0;const stale=Date.now()-last>COMMONWEAVE_REFRESH_MS;
    if(navigator.onLine&&(force||!cached||stale)){
      try{const fresh=await fetchAndCacheJson(COMMONWEAVE_POINTS_URLS);if(applyCommonweave(fresh,'commonweave-live')){safeSet(COMMONWEAVE_SYNC_KEY,String(Date.now()));loaded=true;toast(`Commonweave map data refreshed · ${commonweaveData.nodes.length.toLocaleString()} mapped entries.`)}}catch(error){console.warn('[Civweave Atlas] Commonweave refresh failed.',error);if(!loaded)toast('Commonweave map data is unreachable right now. The Atlas remains usable with local data.')}
    }
  }finally{syncInProgress=false;updateStatus()}
  return loaded;
}
async function loadCommonweaveEdges(){
  if(commonweaveEdges)return commonweaveEdges;if(commonweaveEdgesPromise)return commonweaveEdgesPromise;
  commonweaveEdgesPromise=(async()=>{
    let raw=await readCachedJson(COMMONWEAVE_EDGES_URLS);
    if(!raw&&navigator.onLine)raw=await fetchAndCacheJson(COMMONWEAVE_EDGES_URLS);
    const rows=Array.isArray(raw)?raw:Array.isArray(raw?.edges)?raw.edges:[];
    commonweaveEdges=rows;return rows;
  })().catch(error=>{console.warn('[Civweave Atlas] Commonweave edge load failed.',error);commonweaveEdges=[];return[]}).finally(()=>{commonweaveEdgesPromise=null});
  return commonweaveEdgesPromise;
}
async function loadSelectedThreads(node){
  if(node?.origin!=='commonweave')return;const button=$('#loadThreads');if(button){button.disabled=true;button.textContent='Loading threads…'}
  const edges=await loadCommonweaveEdges();
  const related=edges.filter(edge=>clean(edge?.source_id||edge?.source||edge?.a)===node.id||clean(edge?.target_id||edge?.target||edge?.b)===node.id).sort((a,b)=>(Number(b?.weight??b?.w)||0)-(Number(a?.weight??a?.w)||0)).slice(0,24);
  selectedThreads=related.map((edge,index)=>normalizeThread(edge,index,new Set(nodeIndex.keys()))).filter(Boolean);renderThreads();renderDetail(node);
  toast(selectedThreads.length?`${selectedThreads.length} Commonweave connections woven onto the Atlas.`:'No published Commonweave edges were found for this entry.')
}
function renderSource(){
  const localCount=localData?.nodes?.length||0;
  if(commonweaveData){sourceNote.textContent=`Commonweave public map snapshot · ${commonweaveData.nodes.length.toLocaleString()} mapped entries. ${localCount?`${localCount.toLocaleString()} local Civweave entries are layered on top.`:'Civweave local nodes and resources can be layered on top as they are discovered.'}`;return}
  if(localData){sourceNote.textContent=`Using ${localCount.toLocaleString()} locally stored Civweave atlas entries. Commonweave public data will join them when a cached or online snapshot is available.`;return}
  sourceNote.textContent='Using the built-in offline starter layer while the Commonweave public map snapshot is unavailable.';
}
function render(){renderPublicPoints();renderThreads();renderMarkers();renderDetail(selectedId?nodeById(selectedId):null);renderSource();applyView()}
function setFilter(value){activeFilter=value;pairedOnly=false;$$('[data-filter]').forEach(button=>button.classList.toggle('active',button.dataset.filter===value));selectedId='';selectedThreads=[];render()}
function applyView(){world.style.transform=`translate(${view.tx}px,${view.ty}px) scale(${view.scale})`;safeSet(VIEW_KEY,JSON.stringify(view))}
function zoomBy(amount,origin=null){
  const old=view.scale,next=clamp(old+amount,.7,3.8);if(next===old)return;
  if(origin){const rect=viewport.getBoundingClientRect(),ox=origin.x-rect.left-rect.width/2,oy=origin.y-rect.top-rect.height/2,ratio=next/old;view.tx=ox-(ox-view.tx)*ratio;view.ty=oy-(oy-view.ty)*ratio}
  view.scale=next;applyView()
}
function resetView(){view={scale:1,tx:0,ty:0};applyView()}
function centerOn(x,y,scale=Math.max(view.scale,2.2)){
  const rect=viewport.getBoundingClientRect(),next=clamp(scale,.7,3.8),px=x/100*rect.width,py=y/100*rect.height,cx=rect.width/2,cy=rect.height/2;
  view.scale=next;view.tx=-(px-cx)*next;view.ty=-(py-cy)*next;applyView()
}
function centerOnNode(node,scale){if(node)centerOn(node.x,node.y,scale)}
function locate(){
  if(!navigator.geolocation){toast('This device does not expose browser location to the Atlas.');return}
  const button=$('#locateButton');button.disabled=true;button.textContent='…';
  navigator.geolocation.getCurrentPosition(position=>{
    button.disabled=false;button.textContent='⌾';const projected=projectLonLat(position.coords.longitude,position.coords.latitude);
    userMarker={...projected,lat:position.coords.latitude,lon:position.coords.longitude,accuracy:position.coords.accuracy};renderMarkers();renderUserDetail();centerOn(userMarker.x,userMarker.y,2.6);toast(`Location captured locally${Number.isFinite(position.coords.accuracy)?` · accuracy about ${Math.round(position.coords.accuracy)} m`:''}.`)
  },error=>{button.disabled=false;button.textContent='⌾';toast(error.code===1?'Location permission was not granted.':'Civweave could not read device location right now.')},{enableHighAccuracy:false,timeout:9000,maximumAge:300000})
}
function updateStatus(){
  if(syncInProgress)return;const dot=$('#statusDot'),label=$('#atlasStatus');dot.classList.remove('syncing');
  if(!navigator.onLine){dot.classList.add('offline');label.textContent=commonweaveData?'Offline · cached Commonweave atlas ready':'Offline · local atlas ready';return}
  dot.classList.remove('offline');label.textContent=commonweaveData?`Commonweave snapshot · ${commonweaveData.nodes.length.toLocaleString()} mapped`:(localData?'Local atlas ready · Commonweave available on refresh':'Local atlas ready · loading public map data')
}
function reloadLocalData(){localData=loadLocalData();data=composeData();rebuildIndex();selectedId='';selectedThreads=[];render();updateStatus()}
function setPairedFilter(){pairedOnly=true;activeFilter='all';query='';$('#atlasSearch').value='';$$('[data-filter]').forEach(button=>button.classList.toggle('active',button.dataset.filter==='all'));selectedId='';selectedThreads=[];render();if(!filteredNodes().length)toast('No paired Civweave nodes are stored on this device yet.')}
function showThreads(){pairedOnly=false;activeFilter='all';query='';$('#atlasSearch').value='';$$('[data-filter]').forEach(button=>button.classList.toggle('active',button.dataset.filter==='all'));render();$('#legendCard').scrollIntoView({behavior:'smooth',block:'nearest'})}
function showHelp(){toast('The Civweave Atlas is local-first. Commonweave public map points are cached when possible, pink Civweave nodes can pair locally, and your location is never published just because you use Nearby.')}
function worldPointFromClient(clientX,clientY){
  const rect=viewport.getBoundingClientRect(),cx=rect.width/2,cy=rect.height/2,sx=clientX-rect.left,sy=clientY-rect.top;
  return{x:(((sx-cx-view.tx)/view.scale)+cx)/rect.width*100,y:(((sy-cy-view.ty)/view.scale)+cy)/rect.height*100};
}
function selectNearestAt(clientX,clientY){
  const point=worldPointFromClient(clientX,clientY),rect=viewport.getBoundingClientRect(),rx=20/view.scale/rect.width*100,ry=20/view.scale/rect.height*100;
  let nearest=null,best=Infinity;
  for(const node of filteredNodes()){
    if(node.origin!=='commonweave')continue;const dx=(node.x-point.x)/rx,dy=(node.y-point.y)/ry,score=dx*dx+dy*dy;
    if(score<best){best=score;nearest=node}
  }
  if(nearest&&best<=1.6){selectNode(nearest.id);return true}return false;
}

$('#atlasBack')?.addEventListener('click',()=>{if(history.length>1)history.back();else location.assign(CAMPUS)});
$('#atlasHelp')?.addEventListener('click',showHelp);
$('#clearSearch')?.addEventListener('click',()=>{$('#atlasSearch').value='';query='';pairedOnly=false;render();$('#atlasSearch').focus()});
let searchTimer=null;$('#atlasSearch')?.addEventListener('input',event=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{query=clean(event.target.value).toLowerCase();pairedOnly=false;selectedId='';selectedThreads=[];render()},70)});
$$('[data-filter]').forEach(button=>button.addEventListener('click',()=>setFilter(button.dataset.filter)));
$('#zoomIn')?.addEventListener('click',()=>zoomBy(.25));$('#zoomOut')?.addEventListener('click',()=>zoomBy(-.25));$('#resetMap')?.addEventListener('click',resetView);$('#recenterButton')?.addEventListener('click',()=>userMarker?centerOn(userMarker.x,userMarker.y,2.6):resetView());$('#locateButton')?.addEventListener('click',locate);
viewport?.addEventListener('wheel',event=>{event.preventDefault();zoomBy(event.deltaY<0?.14:-.14,{x:event.clientX,y:event.clientY})},{passive:false});
viewport?.addEventListener('pointerdown',event=>{if(event.target.closest?.('.marker,.map-controls'))return;pointerState={id:event.pointerId,x:event.clientX,y:event.clientY,tx:view.tx,ty:view.ty,moved:false};viewport.setPointerCapture?.(event.pointerId);viewport.classList.add('dragging')});
viewport?.addEventListener('pointermove',event=>{if(!pointerState||event.pointerId!==pointerState.id)return;const dx=event.clientX-pointerState.x,dy=event.clientY-pointerState.y;if(Math.hypot(dx,dy)>5)pointerState.moved=true;view.tx=pointerState.tx+dx;view.ty=pointerState.ty+dy;applyView()});
const endPointer=event=>{if(!pointerState||event.pointerId!==pointerState.id)return;const state=pointerState;pointerState=null;viewport.classList.remove('dragging');if(!state.moved)selectNearestAt(event.clientX,event.clientY)};
viewport?.addEventListener('pointerup',endPointer);viewport?.addEventListener('pointercancel',event=>{if(pointerState?.id===event.pointerId){pointerState=null;viewport.classList.remove('dragging')}});
$$('[data-atlas-nav]').forEach(button=>button.addEventListener('click',()=>{const nav=button.dataset.atlasNav;if(nav==='campus'){location.assign(CAMPUS);return}if(nav==='paired'){setPairedFilter();return}if(nav==='threads'){showThreads();return}setFilter('all')}));
addEventListener('online',()=>{updateStatus();hydrateCommonweave(false)});addEventListener('offline',updateStatus);
addEventListener('storage',event=>{if(DATA_KEYS.includes(event.key))reloadLocalData();if([PAIRED_KEY,FAVORITES_KEY].includes(event.key))render()});
addEventListener('commonweave:atlas-data',event=>{const raw=event.detail?.data||event.detail,normalized=normalizeData(raw,'commonweave-event');if(!normalized)return;if(raw?.type==='FeatureCollection'){commonweaveData=normalized;commonweaveData.nodes.forEach(node=>{node.origin='commonweave'})}else{localData=normalized}data=composeData();rebuildIndex();selectedId='';selectedThreads=[];render();updateStatus()});

render();updateStatus();queueMicrotask(()=>hydrateCommonweave(false));
globalThis.CivweaveAtlasV269=Object.freeze({version:VERSION,reload:reloadLocalData,refreshCommonweave:()=>hydrateCommonweave(true),reset:resetView,select:selectNode,locate,open:()=>location.assign('/app/civweave-atlas-v269.html'),data:()=>typeof structuredClone==='function'?structuredClone(data):JSON.parse(JSON.stringify(data))});
dispatchEvent(new CustomEvent('civweave:atlas-ready',{detail:{version:VERSION,source:data.source,nodeCount:data.nodes.length,commonweaveSync:true}}));
})();
