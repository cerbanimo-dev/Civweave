(()=>{
'use strict';

const VERSION='civweave-hub-map-v1.5.0-public-mobile-directory';
const DIRECTORY_ENDPOINT='/api/hub-map-nodes';
const DIRECTORY_REGISTER_ENDPOINT='/api/guild-directory-register';
const DIRECTORY_CACHE_KEY='civweave.hub-map.directory.v1';
const DIRECTORY_BURST_KEY='civweave.hub-map.directory-burst-at.v1';
const HOST_ENDPOINT_KEY='federation-finder.physical-node-endpoint';
const HOST_SELECTION_KEY='civweave.host-node.selection.v1';
const RALLY_CACHE_KEY='civweave.guild-rally-point.selected.v1';
const MOBILE_GUILD_KEY='civweave.mobile-guild.v1';
const LOCATION_KEY='civweave.hub-location-claim.v1';
const LOCATION_STATE_KEY='civweave.hub-location-sync.v1';
const STEWARD_KEY='civweave.host-steward.v1';
const REFRESH_MS=60*60*1000;
let directory={schema:'civweave.hub-map-directory.v1',nodes:[]};
let proximityEnabled=false;
let watchId=null;
let refreshTimer=null;
let detailObserver=null;
let renderingDetail=false;
let booted=false;

const now=()=>new Date().toISOString();
const clean=(value,max=1000)=>String(value??'').trim().slice(0,max);
const esc=value=>clean(value,5000).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[char]));
const norm=value=>String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const loadCache=()=>{try{return parse(localStorage.getItem(DIRECTORY_CACHE_KEY),null)}catch{return null}};
const saveCache=value=>{try{localStorage.setItem(DIRECTORY_CACHE_KEY,JSON.stringify(value))}catch{}};
const lastBurstAt=()=>{try{return Number(localStorage.getItem(DIRECTORY_BURST_KEY))||0}catch{return 0}};
function claimDirectoryBurst(){
  const startedAt=Date.now();try{const previous=lastBurstAt();if(previous&&startedAt-previous<REFRESH_MS)return false;localStorage.setItem(DIRECTORY_BURST_KEY,String(startedAt));return true}catch{return true}
}
const service=()=>globalThis.CivweaveMapService;
const gossip=()=>globalThis.CivweaveLocalityGossipV1;
const session=()=>globalThis.CivweaveHostNodeSessionV1;
function nodeById(nodeId){return (directory.nodes||[]).find(node=>node?.nodeId===nodeId)||null}
function rowNodeId(row){return clean(row?.raw?.nodeId||row?.nodeId||row?.id?.replace(/^hub:/,''),180)}
function setStatus(text){const el=document.getElementById('status');if(el)el.textContent=clean(text,800)}
function setGossipStatus(text){const el=document.getElementById('hubGossipStatus');if(el)el.textContent=clean(text,900)}
function rallyPointFor(node){const point=node?.location?.rallyPoint||node?.publicLocation?.rallyPoint||node?.rallyPoint||null;return point?.schema==='civweave.guild-rally-point.v1'&&clean(point.name,180)?point:null}
function selectedRallyPoint(){try{return parse(localStorage.getItem(RALLY_CACHE_KEY),null)}catch{return null}}
function mobileGuildState(){try{return parse(localStorage.getItem(MOBILE_GUILD_KEY),null)}catch{return null}}
function desktopLocationState(){try{return parse(localStorage.getItem(LOCATION_STATE_KEY),null)}catch{return null}}
function desktopLocationKey(){try{return clean(localStorage.getItem(LOCATION_KEY),240)}catch{return''}}
function guildkeeperBrowser(){try{return localStorage.getItem(STEWARD_KEY)==='1'}catch{return false}}
function validLocation(value){const lat=Number(value?.latitude),lon=Number(value?.longitude);return Number.isFinite(lat)&&lat>=-90&&lat<=90&&Number.isFinite(lon)&&lon>=-180&&lon<=180}
function mobileNodeIds(state=mobileGuildState()){const ids=(state?.cloudFabric?.starterNodes||[]).map(node=>clean(node?.nodeId,180)).filter(Boolean);if(state?.guildId&&!ids.includes(clean(state.guildId,180)))ids.push(clean(state.guildId,180));return ids}
function ownedGuildkeeperForNode(node){
  if(!guildkeeperBrowser()||!node)return null;const nodeId=clean(node.nodeId,180);
  const mobile=mobileGuildState(),mobileIds=mobileNodeIds(mobile);if(mobile?.guildId&&mobile?.membershipKey&&validLocation(mobile.location)&&(mobileIds.includes(nodeId)||clean(node.guildId,180)===clean(mobile.guildId,180)||node.localOwnedMobile===true))return{route:'mobile',state:mobile,nodeIds:mobileIds};
  const desktop=desktopLocationState(),key=desktopLocationKey(),desktopIds=Array.isArray(desktop?.nodeIds)?desktop.nodeIds.map(id=>clean(id,180)).filter(Boolean):[];if(key&&desktop?.workerOrigin&&desktopIds.includes(nodeId))return{route:'desktop',state:desktop,nodeIds:desktopIds,key};
  return null;
}
function mergeOwnedLocations(packet){
  if(!packet||!Array.isArray(packet.nodes))return packet;
  const mobile=mobileGuildState(),mobileIds=mobileNodeIds(mobile),desktop=desktopLocationState(),desktopIds=Array.isArray(desktop?.nodeIds)?desktop.nodeIds.map(id=>clean(id,180)).filter(Boolean):[];
  let mobileFound=false;
  const nodes=packet.nodes.map(node=>{
    const nodeId=clean(node?.nodeId,180);
    if(mobile?.guildId&&validLocation(mobile.location)&&(mobileIds.includes(nodeId)||clean(node?.guildId,180)===clean(mobile.guildId,180))){mobileFound=true;return{...node,guildId:mobile.guildId,displayName:mobile.displayName||node.displayName,location:{...(node.location||{}),...mobile.location},localOwnedMobile:true,updatedAt:mobile.updatedAt||mobile.location.syncedAt||node.updatedAt}}
    if(validLocation(desktop)&&desktopIds.includes(nodeId))return{...node,location:{...(node.location||{}),...desktop},localOwnedDesktop:true,updatedAt:desktop.updatedAt||desktop.syncedAt||node.updatedAt};
    return node;
  });
  if(mobile?.guildId&&validLocation(mobile.location)&&!mobileFound){
    const starter=mobile?.cloudFabric?.starterNodes?.[0]||null,nodeId=clean(mobile.guildId||starter?.nodeId,180),publicOrigin=clean(mobile.primaryOrigin||starter?.publicOrigin,1000);
    if(nodeId)nodes.push({schema:'civweave.hub-map-node.v1',nodeId,guildId:mobile.guildId,displayName:clean(mobile.displayName||mobile.guildId,180),publicOrigin,runtime:mobile.cloudAttached?'cloudflare-mobile-guild-edge':'pocket-guild-node',status:'active',capabilities:['guild-map-location','pocket-node'],location:{...mobile.location},updatedAt:mobile.updatedAt||mobile.location.syncedAt||now(),localOwnedMobile:true});
  }
  return{...packet,nodes};
}
async function registerOwnedMobileGuild(){
  const mobile=mobileGuildState();if(!mobile?.cloudAttached||!mobile?.primaryOrigin||!validLocation(mobile.location)||navigator.onLine===false)return false;
  try{
    const response=await fetch(DIRECTORY_REGISTER_ENDPOINT,{method:'POST',cache:'no-store',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify({publicOrigin:mobile.primaryOrigin})}),payload=await response.json().catch(()=>({}));
    if(!response.ok||payload?.ok!==true)throw new Error(payload?.error||payload?.message||`HTTP ${response.status}`);
    try{localStorage.removeItem(DIRECTORY_BURST_KEY)}catch{}
    return true;
  }catch(error){setGossipStatus(`This Guild is local and online, but public directory registration is pending · ${error?.message||error}`);return false}
}
function cacheSelectedRallyPoint(node){
  const point=rallyPointFor(node);let selected={};try{selected=parse(localStorage.getItem(HOST_SELECTION_KEY),{})}catch{}
  if(!node?.nodeId||selected?.nodeId!==node.nodeId)return null;
  try{
    if(!point){localStorage.removeItem(RALLY_CACHE_KEY);return null}
    const cached={schema:'civweave.guild-rally-point.selected.v1',nodeId:node.nodeId,displayName:clean(node.displayName||node.name||node.nodeId,180),rallyPoint:{...point},cachedAt:now()};
    localStorage.setItem(RALLY_CACHE_KEY,JSON.stringify(cached));
    dispatchEvent(new CustomEvent('civweave:guild-rally-point-updated',{detail:cached}));
    return cached;
  }catch{return null}
}
function refreshSelectedRallyCache(){let selected={};try{selected=parse(localStorage.getItem(HOST_SELECTION_KEY),{})}catch{}const node=nodeById(selected?.nodeId);if(node)cacheSelectedRallyPoint(node)}

function normalizeDirectoryNode(node){
  const nodeId=clean(node?.nodeId,180),location=node?.location||{};
  const lat=Number(location.latitude),lon=Number(location.longitude);if(!nodeId||!Number.isFinite(lat)||!Number.isFinite(lon))return null;
  const publicOrigin=clean(node.publicOrigin,1000),precision=Number(location.precisionMeters),rally=rallyPointFor(node);
  return{
    id:`hub:${nodeId}`,name:clean(node.displayName||nodeId,300),coords:[lon,lat],framework:'Civweave Guild',country:'',city:'',region:'',model:'Civweave Guild',website:publicOrigin,email:'',
    description:`${node.status==='active'?'Active':'Guild'}${Number.isFinite(precision)?` · public site precision ±${Math.round(precision)} m`:''}${rally?` · Rally Point: ${clean(rally.name,180)}`:''}`,
    search:norm([node.displayName,nodeId,'Civweave Guild',node.status,rally?.name].filter(Boolean).join(' ')),source:'node',hub:true,stale:node.status==='offline',lastSeenAt:node.updatedAt||location.syncedAt||'',
    raw:{...node,nodeId,endpoint:publicOrigin,publicLocation:{lat,lon,precisionMeters:Number.isFinite(precision)?precision:null,rallyPoint:rally?{...rally}:null},_civweaveHubMap:true},
  }
}
function installNodes(packet){
  const s=service();if(!s?.state?.features)return 0;
  for(const [id,row] of [...s.state.features.entries()])if(row?.raw?._civweaveHubMap)s.state.features.delete(id);
  for(const [id,row] of [...(s.state.nodes?.entries?.()||[])])if(row?.source==='hub-map-directory')s.state.nodes.delete(id);
  let count=0;
  for(const node of packet?.nodes||[]){const row=normalizeDirectoryNode(node);if(!row)continue;s.state.features.set(row.id,row);s.state.nodes?.set?.(row.id,{id:row.id,nodeId:node.nodeId,name:row.name,coords:row.coords,endpoint:node.publicOrigin,source:'hub-map-directory',location:node.location});count++}
  s.state.mode='nodes';s.updateMapData?.();activateNodeMode();focusHubView();refreshSelectedRallyCache();return count
}
function activateNodeMode(){
  const ids=['modeAll','modeFederations','modeNodes'];for(const id of ids)document.getElementById(id)?.classList.toggle('active',id==='modeNodes');
  const button=document.getElementById('modeNodes');if(button)button.textContent='Guilds';
}
function focusHubView(){
  const s=service(),map=s?.state?.map;if(!map)return;
  let selected=null;try{const saved=parse(localStorage.getItem(HOST_SELECTION_KEY),{});selected=nodeById(saved?.nodeId)}catch{}
  if(selected?.location){map.flyTo({center:[selected.location.longitude,selected.location.latitude],zoom:10,essential:true});return}
  const points=(directory.nodes||[]).map(node=>[Number(node?.location?.longitude),Number(node?.location?.latitude)]).filter(pair=>pair.every(Number.isFinite));if(!points.length)return;
  if(points.length===1){map.flyTo({center:points[0],zoom:9,essential:true});return}
  try{const bounds=points.reduce((box,point)=>box.extend(point),new maplibregl.LngLatBounds(points[0],points[0]));map.fitBounds(bounds,{padding:70,maxZoom:8,duration:500})}catch{}
}
async function loadDirectory({network=true,force=false}={}){
  const cached=loadCache();if(cached?.schema==='civweave.hub-map-directory.v1'&&Array.isArray(cached.nodes)){directory=mergeOwnedLocations(cached);installNodes(directory);setStatus(`Guild Map · ${directory.nodes.length} cached Guild${directory.nodes.length===1?'':'s'}`)}
  if(!network||navigator.onLine===false||(!force&&!claimDirectoryBurst()))return directory;
  if(force)claimDirectoryBurst();
  try{const response=await fetch(DIRECTORY_ENDPOINT,{cache:'no-store',headers:{accept:'application/json'}}),packet=await response.json().catch(()=>({}));if(!response.ok||packet?.ok!==true||!Array.isArray(packet.nodes))throw new Error(packet?.error||`HTTP ${response.status}`);saveCache(packet);directory=mergeOwnedLocations(packet);const count=installNodes(directory);setStatus(`Guild Map · ${count} Guildkeeper-placed Guild${count===1?'':'s'} · hourly directory sync`);dispatchEvent(new CustomEvent('civweave:hub-map-directory',{detail:{count,at:now()}}));return directory}catch(error){if(!cached)setStatus(`Guild Map directory unavailable · ${error.message}`);return directory}
}
function selectedHubRow(){const s=service();return s?.state?.features?.get?.(s?.state?.selectedId)||null}
function selectedHubNode(){const row=selectedHubRow(),nodeId=rowNodeId(row);return nodeById(nodeId)||(row?.raw?._civweaveHubMap?row.raw:null)}

function installPanel(){
  const panel=document.getElementById('panel');if(!panel||document.getElementById('hubMapLedger'))return;
  const section=document.createElement('section');section.id='hubMapLedger';section.innerHTML=`<h3>Guild locality ledger</h3><p>Connected Guild members automatically carry a Region: their home Guild plus the six nearest mapped Guilds. That signed gossip stays available offline, while any other Guild on the map can still be visited and exchanged with manually.</p><div class="row"><button id="hubLedgerRefresh" class="btn primary" type="button">Refresh selected Guild</button><button id="hubLedgerHome" class="btn" type="button">My Guild</button></div><p id="hubGossipStatus">Select a Guild to explore its cached neighborhood ledger.</p><div id="hubLedgerList" class="results"><div class="empty">No Guild selected yet.</div></div>`;
  const detail=document.getElementById('detail');detail?.parentNode?.insertBefore(section,detail.nextSibling);
  document.getElementById('hubLedgerRefresh')?.addEventListener('click',()=>refreshSelectedHub(true));
  document.getElementById('hubLedgerHome')?.addEventListener('click',focusMyHub);
}
function ledgerLabel(row){return row.type==='need'?'Need':row.type==='offering'?'Offering':'Idea'}
function renderLedger(summary){
  const list=document.getElementById('hubLedgerList');if(!list)return;const rows=summary?.entries||[];
  if(!rows.length){list.innerHTML='<div class="empty">No relevant Needs, Offerings, or Ideas are in this device’s offline ledger yet. Passing nearby or refreshing through a Guild can bring the latest signed copies in.</div>';return}
  list.innerHTML=rows.slice(0,40).map(row=>`<article class="card"><strong>${esc(ledgerLabel(row))} · ${esc(row.title||'Untitled')}</strong><small>${esc(row.relevance||'ledger')} · ${esc(row.updatedAt?new Date(row.updatedAt).toLocaleString():'cached')}</small>${row.summary?`<p>${esc(row.summary)}</p>`:''}</article>`).join('')
}
async function showLedgerFor(node){
  const g=gossip();if(!g||!node?.nodeId)return;try{const summary=await g.summaryForHub(node.nodeId,{limit:80});renderLedger(summary);setGossipStatus(`${summary.entries.length} cached items · ${summary.counts.need} needs · ${summary.counts.offering} offerings · ${summary.counts.idea} ideas`)}catch(error){setGossipStatus(`Ledger unavailable · ${error.message}`)}
}
async function refreshSelectedHub(virtual=false){const node=selectedHubNode();if(!node){setGossipStatus('Select a Guild first.');return}try{setGossipStatus(virtual?'Passing by this Guild through the mesh…':'Reading cached locality ledger…');if(virtual)await gossip()?.passByHub?.(node,{physical:false});await showLedgerFor(node)}catch(error){setGossipStatus(`Guild refresh failed · ${error.message}`)}}
function focusMyHub(){
  try{const selected=parse(localStorage.getItem(HOST_SELECTION_KEY),{}),row=service()?.state?.features?.get?.(`hub:${selected.nodeId}`);if(row){service().state.selectedId=row.id;service().state.map?.flyTo?.({center:row.coords,zoom:10,essential:true});cacheSelectedRallyPoint(nodeById(selected.nodeId));augmentDetail();return}const mobile=mobileGuildState(),mobileId=clean(mobile?.guildId,180)||mobileNodeIds(mobile)[0],mobileRow=mobileId?service()?.state?.features?.get?.(`hub:${mobileId}`):null;if(mobileRow){service().state.selectedId=mobileRow.id;service().state.map?.flyTo?.({center:mobileRow.coords,zoom:10,essential:true});service()?.selectFeature?.(mobileRow.id,true);augmentDetail();return}setGossipStatus('This device does not have a mapped selected Guild yet.')}catch{setGossipStatus('No selected Guild is stored on this device.')}
}
async function ensureSessionRuntime(){
  if(session())return session();await new Promise((resolve,reject)=>{const path='/app/host-node-session-v1.js',existing=[...document.scripts].find(script=>script.src&&new URL(script.src,location.href).pathname===path);if(existing){let ticks=0;const timer=setInterval(()=>{if(session()){clearInterval(timer);resolve()}else if(++ticks>200){clearInterval(timer);reject(new Error('Guild session runtime did not become ready.'))}},40);return}const script=document.createElement('script');script.src=`${path}?v=hub-map-v1`;script.async=false;script.onload=resolve;script.onerror=()=>reject(new Error('Could not load Guild session runtime.'));document.head.append(script)});if(!session())throw new Error('Guild session runtime is unavailable.');return session()
}
async function joinSelectedHub(){
  const node=selectedHubNode();if(!node)return;const origin=node.publicOrigin||node.endpoint;if(!origin){setGossipStatus('This Guild does not advertise a join origin.');return}
  try{setGossipStatus(`Joining ${node.displayName||node.nodeId}…`);const runtime=await ensureSessionRuntime(),packet=await runtime.join(origin,{createCredential:true,nodeId:node.nodeId});const selection={schema:'civweave.host-node-selection.v1',origin:packet?.session?.origin||origin,nodeId:packet?.session?.nodeId||node.nodeId,displayName:node.displayName||node.nodeId,selectedAt:now(),source:VERSION};localStorage.setItem(HOST_ENDPOINT_KEY,selection.origin);localStorage.setItem(HOST_SELECTION_KEY,JSON.stringify(selection));cacheSelectedRallyPoint(node);gossip()?.rememberHub?.(node,'joined');dispatchEvent(new CustomEvent('civweave:host-node-selected',{detail:selection}));setGossipStatus(`Joined ${selection.displayName}. This Guild is now the selected Guild for this device.${rallyPointFor(node)?' Its Rally Point is cached for offline reconnection.':''}`);augmentDetail()}catch(error){setGossipStatus(`Could not join Guild · ${error.message}`)}
}
function bestGuildPosition(){
  return new Promise((resolve,reject)=>{
    if(!isSecureContext)return reject(new Error('Guild location updates require this HTTPS Guild Map.'));if(!navigator.geolocation)return reject(new Error('This device cannot provide a Guild location.'));
    let best=null,finished=false,watchId=null;const finish=(error=null)=>{if(finished)return;finished=true;if(watchId!==null)navigator.geolocation.clearWatch(watchId);clearTimeout(timer);if(best)return resolve(best);reject(error||new Error('No Guild location reading was available.'))};
    const timer=setTimeout(()=>finish(new Error('The Guild location did not settle. Move outdoors or near a window and try again.')),15000);
    watchId=navigator.geolocation.watchPosition(position=>{if(!best||position.coords.accuracy<best.coords.accuracy)best=position;setGossipStatus(`Locating this Guild… current accuracy ±${Math.round(best.coords.accuracy)} m.`);if(best.coords.accuracy<=50)finish()},error=>finish(new Error(error.code===1?'Location permission was not granted. Enable it for Civweave to move this Guild.':'The Guild location could not be read. Move outdoors or near a window and try again.')),{enableHighAccuracy:true,maximumAge:0,timeout:14000});
  });
}
async function updateDesktopGuildLocation(owner,position){
  const state=owner.state,key=owner.key,precise=Number(state.coordinateDecimals||3)>=5,coordinateDecimals=precise?6:3;if(!state.workerOrigin||!owner.nodeIds.length||!key)throw new Error('This browser no longer has the desktop Guildkeeper location credential.');if(precise&&position.coords.accuracy>250)throw new Error('This Guild uses a precise public pin. Move outdoors or near a window until accuracy is within 250 meters.');
  const payload={nodeIds:owner.nodeIds,latitude:Number(position.coords.latitude.toFixed(coordinateDecimals)),longitude:Number(position.coords.longitude.toFixed(coordinateDecimals)),accuracyMeters:Math.max(1,position.coords.accuracy),publicPrecision:precise?'precise':'rounded',capturedAt:new Date(position.timestamp||Date.now()).toISOString()};
  const response=await fetch(`${String(state.workerOrigin).replace(/\/+$/,'')}/api/fabric/location`,{method:'POST',headers:{'content-type':'application/json','x-civweave-location-key':key},body:JSON.stringify(payload)}),result=await response.json().catch(()=>({}));if(!response.ok||result?.ok!==true)throw new Error(result?.error||`Guild location mesh returned HTTP ${response.status}`);
  const location=result.location||{},next={...state,...location,schema:'civweave.hub-location-sync.v1',syncedAt:location.syncedAt||now(),precisionMeters:location.precisionMeters||state.precisionMeters||100,coordinateDecimals:location.coordinateDecimals??coordinateDecimals,nodeIds:Array.isArray(result.nodeIds)?result.nodeIds:owner.nodeIds,nodeCount:Array.isArray(result.nodeIds)?result.nodeIds.length:owner.nodeIds.length,workerOrigin:state.workerOrigin,updatedAt:now()};localStorage.setItem(LOCATION_STATE_KEY,JSON.stringify(next));return next;
}
async function updateMobileGuildLocation(owner,position){
  const precise=Number(owner.state?.location?.coordinateDecimals||3)>=5,module=await import('/app/mobile-guild-create-v1.mjs?v=guild-map-location-public-v1');if(typeof module.updateMobileGuildLocation!=='function')throw new Error('Mobile Guild location updater is unavailable.');const updated=await module.updateMobileGuildLocation({position,precise});return updated.location;
}
function refreshOwnedLocationOnMap(nodeId){
  const mobile=mobileGuildState(),resolvedNodeId=clean(mobile?.guildId,180)||nodeId,selectedId=`hub:${resolvedNodeId}`,s=service();directory=mergeOwnedLocations(directory);installNodes(directory);if(s?.state?.features?.has?.(selectedId)){s.state.selectedId=selectedId;s.selectFeature?.(selectedId,true);const row=s.state.features.get(selectedId);if(row?.coords)s.state.map?.flyTo?.({center:row.coords,zoom:11,essential:true})}queueMicrotask(augmentDetail)
}
async function updateSelectedGuildLocation(){
  const node=selectedHubNode(),owner=ownedGuildkeeperForNode(node);if(!node||!owner){setGossipStatus('Only the logged-in Guildkeeper for this Guild can update its map location.');return}
  try{setGossipStatus(`Updating ${node.displayName||node.nodeId} from this device…`);const position=await bestGuildPosition();if(owner.route==='mobile')await updateMobileGuildLocation(owner,position);else await updateDesktopGuildLocation(owner,position);if(owner.route==='mobile')await registerOwnedMobileGuild();refreshOwnedLocationOnMap(node.nodeId);setGossipStatus(`${node.displayName||'Guild'} location updated. The Guild Map now uses the new Guildkeeper-published position.`)}catch(error){setGossipStatus(`Guild location update failed · ${error?.message||error}`)}
}
function augmentDetail(){
  if(renderingDetail)return;const detail=document.getElementById('detail'),row=selectedHubRow(),node=selectedHubNode();if(!detail||!row||!node?.nodeId)return;
  const nodeId=clean(node.nodeId,180),existingActions=detail.querySelector('[data-hub-map-actions]');
  if(detail.dataset.civweaveGuildDetailNodeId===nodeId&&existingActions)return;
  renderingDetail=true;detailObserver?.disconnect();try{
    detail.querySelector('[data-hub-map-actions]')?.remove();detail.querySelector('[data-guild-rally-point]')?.remove();
    const rally=rallyPointFor(node);
    if(rally){const card=document.createElement('div');card.dataset.guildRallyPoint='1';card.className='card';card.style.marginTop='9px';card.innerHTML=`<strong>Guild Rally Point · ${esc(rally.name)}</strong><small>Public offline reconnection place · cached with the Guild Map</small>${rally.directions?`<p>${esc(rally.directions)}</p>`:''}<p><small>${Number(rally.latitude).toFixed(6)}, ${Number(rally.longitude).toFixed(6)}${Number.isFinite(Number(rally.precisionMeters))?` · ±${Math.round(Number(rally.precisionMeters))} m`:''}</small></p>`;detail.append(card)}
    const owner=ownedGuildkeeperForNode(node),actions=document.createElement('div');actions.dataset.hubMapActions='1';actions.className='row';actions.style.marginTop='9px';actions.innerHTML=`<button type="button" class="btn primary" data-hub-join>Join Guild</button><button type="button" class="btn" data-hub-explore>Explore ledger</button><button type="button" class="btn" data-hub-pass>Pass by</button>${owner?'<button type="button" class="btn primary" data-hub-update-location>Update Guild location</button>':''}${node.publicOrigin?`<a class="btn" href="${esc(node.publicOrigin)}" target="_blank" rel="noopener">Open Guild ↗</a>`:''}`;detail.append(actions);
    detail.dataset.civweaveGuildDetailNodeId=nodeId;
    actions.querySelector('[data-hub-join]')?.addEventListener('click',joinSelectedHub);actions.querySelector('[data-hub-explore]')?.addEventListener('click',()=>showLedgerFor(node));actions.querySelector('[data-hub-pass]')?.addEventListener('click',()=>refreshSelectedHub(true));actions.querySelector('[data-hub-update-location]')?.addEventListener('click',updateSelectedGuildLocation);gossip()?.rememberHub?.(node,'map-select');showLedgerFor(node).catch(()=>{});
  }finally{if(detailObserver)detailObserver.observe(detail,{childList:true});renderingDetail=false}
}
function observeDetail(){
  const detail=document.getElementById('detail');if(!detail||detailObserver)return;
  detailObserver=new MutationObserver(()=>{
    if(renderingDetail)return;const node=selectedHubNode();if(!node?.nodeId)return;
    const nodeId=clean(node.nodeId,180);if(detail.dataset.civweaveGuildDetailNodeId===nodeId&&detail.querySelector('[data-hub-map-actions]'))return;
    queueMicrotask(augmentDetail)
  });
  detailObserver.observe(detail,{childList:true})
}

async function proximityReading(position){if(!proximityEnabled)return;const hits=await gossip()?.proximityUpdate?.(position,directory.nodes||[],{radiusMeters:750});if(hits?.length){const closest=hits.sort((a,b)=>a.distanceMeters-b.distanceMeters)[0];setGossipStatus(`Local gossip exchanged near ${nodeById(closest.nodeId)?.displayName||closest.nodeId} · ${closest.distanceMeters} m away`)}}
function startProximity(){
  proximityEnabled=true;if(watchId!=null||!navigator.geolocation)return;
  watchId=navigator.geolocation.watchPosition(position=>proximityReading(position).catch(()=>{}),()=>{}, {enableHighAccuracy:false,maximumAge:30000,timeout:15000});setGossipStatus('Local gossip is active while this Guild Map stays open. Roaming coordinates are not stored.')
}
function stopProximity(){if(watchId!=null){navigator.geolocation.clearWatch(watchId);watchId=null}}
async function virtualMemberRefresh(){
  if(navigator.onLine===false)return;const active=session()?.publicStatus?.()?.sessions?.filter(item=>item.active)||[];if(!active.length)return;
  try{return await gossip()?.syncRegion?.({nodes:directory.nodes||[],networkDirectory:false})}catch{return null}
}
function applyCachedDirectory(){return loadDirectory({network:false}).catch(()=>directory)}
async function registerAndReload(){await registerOwnedMobileGuild();return loadDirectory({network:true,force:true})}
function bind(){
  document.getElementById('locate')?.addEventListener('click',startProximity,{capture:true});addEventListener('online',()=>{registerAndReload().then(()=>virtualMemberRefresh()).catch(()=>{})});addEventListener('storage',event=>{if([DIRECTORY_CACHE_KEY,MOBILE_GUILD_KEY,LOCATION_STATE_KEY,LOCATION_KEY,STEWARD_KEY].includes(event.key))applyCachedDirectory()});addEventListener('civweave:mobile-guild-created',()=>applyCachedDirectory());addEventListener('civweave:mobile-guild-cloud-attached',()=>registerAndReload().catch(()=>{}));addEventListener('civweave:mobile-guild-location-updated',()=>registerAndReload().catch(()=>{}));addEventListener('civweave:map-mesh-applied',()=>{applyCachedDirectory();activateNodeMode();augmentDetail()});addEventListener('civweave:locality-ledger-changed',()=>refreshSelectedHub(false).catch(()=>{}));addEventListener('visibilitychange',()=>{if(document.hidden)stopProximity();else if(proximityEnabled)startProximity()});addEventListener('pagehide',()=>{stopProximity();if(refreshTimer)clearInterval(refreshTimer)},{once:true});
}
async function boot(){
  if(booted)return true;let ticks=0;while((!service()?.state?.map||!document.getElementById('panel'))&&ticks++<240)await new Promise(resolve=>setTimeout(resolve,50));if(!service()?.state?.map)return false;booted=true;installPanel();activateNodeMode();observeDetail();bind();await registerOwnedMobileGuild();await loadDirectory({network:true,force:true});await gossip()?.ensureMesh?.().catch(()=>{});virtualMemberRefresh().catch(()=>{});refreshTimer=setInterval(()=>loadDirectory({network:navigator.onLine!==false}).catch(()=>{}),REFRESH_MS);dispatchEvent(new CustomEvent('civweave:hub-map-ready',{detail:{version:VERSION,nodeCount:directory.nodes?.length||0,at:now()}}));return true
}

globalThis.CivweaveHubMapV1=Object.freeze({version:VERSION,boot,loadDirectory,installNodes,focusHubView,joinSelectedHub,refreshSelectedHub,registerOwnedMobileGuild,updateSelectedGuildLocation,startProximity,stopProximity,selectedRallyPoint,get directory(){return cloneDirectory()}});function cloneDirectory(){return typeof structuredClone==='function'?structuredClone(directory):parse(JSON.stringify(directory),directory)}document.readyState==='loading'?addEventListener('DOMContentLoaded',()=>boot().catch(()=>{}),{once:true}):queueMicrotask(()=>boot().catch(()=>{}));
})();