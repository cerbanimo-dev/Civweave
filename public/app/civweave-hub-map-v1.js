(()=>{
'use strict';

const VERSION='civweave-hub-map-v1.1.0-region-gossip';
const DIRECTORY_ENDPOINT='/api/hub-map-nodes';
const DIRECTORY_CACHE_KEY='civweave.hub-map.directory.v1';
const HOST_ENDPOINT_KEY='federation-finder.physical-node-endpoint';
const HOST_SELECTION_KEY='civweave.host-node.selection.v1';
const REFRESH_MS=2*60*1000;
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
const service=()=>globalThis.CivweaveMapService;
const gossip=()=>globalThis.CivweaveLocalityGossipV1;
const session=()=>globalThis.CivweaveHostNodeSessionV1;
function nodeById(nodeId){return (directory.nodes||[]).find(node=>node?.nodeId===nodeId)||null}
function rowNodeId(row){return clean(row?.raw?.nodeId||row?.nodeId||row?.id?.replace(/^hub:/,''),180)}
function setStatus(text){const el=document.getElementById('status');if(el)el.textContent=clean(text,800)}
function setGossipStatus(text){const el=document.getElementById('hubGossipStatus');if(el)el.textContent=clean(text,900)}

function normalizeDirectoryNode(node){
  const nodeId=clean(node?.nodeId,180),location=node?.location||{};
  const lat=Number(location.latitude),lon=Number(location.longitude);if(!nodeId||!Number.isFinite(lat)||!Number.isFinite(lon))return null;
  const publicOrigin=clean(node.publicOrigin,1000),precision=Number(location.precisionMeters);
  return{
    id:`hub:${nodeId}`,name:clean(node.displayName||nodeId,300),coords:[lon,lat],framework:'Civweave Hub Node',country:'',city:'',region:'',model:'Civweave Hub Node',website:publicOrigin,email:'',
    description:`${node.status==='active'?'Active':'Hub'} node${Number.isFinite(precision)?` · public site precision ±${Math.round(precision)} m`:''}`,
    search:norm([node.displayName,nodeId,'Civweave Hub Node',node.status].filter(Boolean).join(' ')),source:'node',hub:true,stale:node.status==='offline',lastSeenAt:node.updatedAt||location.syncedAt||'',
    raw:{...node,nodeId,endpoint:publicOrigin,publicLocation:{lat,lon,precisionMeters:Number.isFinite(precision)?precision:null},_civweaveHubMap:true},
  }
}
function installNodes(packet){
  const s=service();if(!s?.state?.features)return 0;
  for(const [id,row] of [...s.state.features.entries()])if(row?.raw?._civweaveHubMap)s.state.features.delete(id);
  for(const [id,row] of [...(s.state.nodes?.entries?.()||[])])if(row?.source==='hub-map-directory')s.state.nodes.delete(id);
  let count=0;
  for(const node of packet?.nodes||[]){const row=normalizeDirectoryNode(node);if(!row)continue;s.state.features.set(row.id,row);s.state.nodes?.set?.(row.id,{id:row.id,nodeId:node.nodeId,name:row.name,coords:row.coords,endpoint:node.publicOrigin,source:'hub-map-directory',location:node.location});count++}
  s.state.mode='nodes';s.updateMapData?.();activateNodeMode();focusHubView();return count
}
function activateNodeMode(){
  const ids=['modeAll','modeFederations','modeNodes'];for(const id of ids)document.getElementById(id)?.classList.toggle('active',id==='modeNodes');
  const button=document.getElementById('modeNodes');if(button)button.textContent='Hub nodes';
}
function focusHubView(){
  const s=service(),map=s?.state?.map;if(!map)return;
  let selected=null;try{const saved=parse(localStorage.getItem(HOST_SELECTION_KEY),{});selected=nodeById(saved?.nodeId)}catch{}
  if(selected?.location){map.flyTo({center:[selected.location.longitude,selected.location.latitude],zoom:10,essential:true});return}
  const points=(directory.nodes||[]).map(node=>[Number(node?.location?.longitude),Number(node?.location?.latitude)]).filter(pair=>pair.every(Number.isFinite));if(!points.length)return;
  if(points.length===1){map.flyTo({center:points[0],zoom:9,essential:true});return}
  try{const bounds=points.reduce((box,point)=>box.extend(point),new maplibregl.LngLatBounds(points[0],points[0]));map.fitBounds(bounds,{padding:70,maxZoom:8,duration:500})}catch{}
}
async function loadDirectory({network=true}={}){
  const cached=loadCache();if(cached?.schema==='civweave.hub-map-directory.v1'&&Array.isArray(cached.nodes)){directory=cached;installNodes(directory);setStatus(`Hub Map · ${cached.nodes.length} cached Hub node${cached.nodes.length===1?'':'s'}`)}
  if(!network||navigator.onLine===false)return directory;
  try{const response=await fetch(DIRECTORY_ENDPOINT,{cache:'no-store',headers:{accept:'application/json'}}),packet=await response.json().catch(()=>({}));if(!response.ok||packet?.ok!==true||!Array.isArray(packet.nodes))throw new Error(packet?.error||`HTTP ${response.status}`);directory=packet;saveCache(packet);const count=installNodes(packet);setStatus(`Hub Map · ${count} steward-placed Hub node${count===1?'':'s'} · live directory`);dispatchEvent(new CustomEvent('civweave:hub-map-directory',{detail:{count,at:now()}}));return packet}catch(error){if(!cached)setStatus(`Hub Map directory unavailable · ${error.message}`);return directory}
}
function selectedHubRow(){const s=service();return s?.state?.features?.get?.(s?.state?.selectedId)||null}
function selectedHubNode(){const row=selectedHubRow(),nodeId=rowNodeId(row);return nodeById(nodeId)||(row?.raw?._civweaveHubMap?row.raw:null)}

function installPanel(){
  const panel=document.getElementById('panel');if(!panel||document.getElementById('hubMapLedger'))return;
  const section=document.createElement('section');section.id='hubMapLedger';section.innerHTML=`<h3>Hub locality ledger</h3><p>Connected Hub members automatically carry a Region: their home Hub plus the six nearest mapped Hubs. That signed gossip stays available offline, while any other Hub on the map can still be visited and exchanged with manually.</p><div class="row"><button id="hubLedgerRefresh" class="btn primary" type="button">Refresh selected Hub</button><button id="hubLedgerHome" class="btn" type="button">My Hub</button></div><p id="hubGossipStatus">Select a Hub node to explore its cached neighborhood ledger.</p><div id="hubLedgerList" class="results"><div class="empty">No Hub selected yet.</div></div>`;
  const detail=document.getElementById('detail');detail?.parentNode?.insertBefore(section,detail.nextSibling);
  document.getElementById('hubLedgerRefresh')?.addEventListener('click',()=>refreshSelectedHub(true));
  document.getElementById('hubLedgerHome')?.addEventListener('click',focusMyHub);
}
function ledgerLabel(row){return row.type==='need'?'Need':row.type==='offering'?'Offering':'Idea'}
function renderLedger(summary){
  const list=document.getElementById('hubLedgerList');if(!list)return;const rows=summary?.entries||[];
  if(!rows.length){list.innerHTML='<div class="empty">No relevant Needs, Offerings, or Ideas are in this device’s offline ledger yet. Passing nearby or refreshing through a Hub can bring the latest signed copies in.</div>';return}
  list.innerHTML=rows.slice(0,40).map(row=>`<article class="card"><strong>${esc(ledgerLabel(row))} · ${esc(row.title||'Untitled')}</strong><small>${esc(row.relevance||'ledger')} · ${esc(row.updatedAt?new Date(row.updatedAt).toLocaleString():'cached')}</small>${row.summary?`<p>${esc(row.summary)}</p>`:''}</article>`).join('')
}
async function showLedgerFor(node){
  const g=gossip();if(!g||!node?.nodeId)return;try{const summary=await g.summaryForHub(node.nodeId,{limit:80});renderLedger(summary);setGossipStatus(`${summary.entries.length} cached items · ${summary.counts.need} needs · ${summary.counts.offering} offerings · ${summary.counts.idea} ideas`)}catch(error){setGossipStatus(`Ledger unavailable · ${error.message}`)}
}
async function refreshSelectedHub(virtual=false){const node=selectedHubNode();if(!node){setGossipStatus('Select a Hub node first.');return}try{setGossipStatus(virtual?'Passing by this Hub through the mesh…':'Reading cached locality ledger…');if(virtual)await gossip()?.passByHub?.(node,{physical:false});await showLedgerFor(node)}catch(error){setGossipStatus(`Hub refresh failed · ${error.message}`)}}
function focusMyHub(){
  try{const selected=parse(localStorage.getItem(HOST_SELECTION_KEY),{}),row=service()?.state?.features?.get?.(`hub:${selected.nodeId}`);if(row){service().state.selectedId=row.id;service().state.map?.flyTo?.({center:row.coords,zoom:10,essential:true});augmentDetail();return}setGossipStatus('This device does not have a mapped selected Hub yet.')}catch{setGossipStatus('No selected Hub is stored on this device.')}
}
async function ensureSessionRuntime(){
  if(session())return session();await new Promise((resolve,reject)=>{const path='/app/host-node-session-v1.js',existing=[...document.scripts].find(script=>script.src&&new URL(script.src,location.href).pathname===path);if(existing){let ticks=0;const timer=setInterval(()=>{if(session()){clearInterval(timer);resolve()}else if(++ticks>200){clearInterval(timer);reject(new Error('Hub session runtime did not become ready.'))}},40);return}const script=document.createElement('script');script.src=`${path}?v=hub-map-v1`;script.async=false;script.onload=resolve;script.onerror=()=>reject(new Error('Could not load Hub session runtime.'));document.head.append(script)});if(!session())throw new Error('Hub session runtime is unavailable.');return session()
}
async function joinSelectedHub(){
  const node=selectedHubNode();if(!node)return;const origin=node.publicOrigin||node.endpoint;if(!origin){setGossipStatus('This Hub does not advertise a join origin.');return}
  try{setGossipStatus(`Joining ${node.displayName||node.nodeId}…`);const runtime=await ensureSessionRuntime(),packet=await runtime.join(origin,{createCredential:true,nodeId:node.nodeId});const selection={schema:'civweave.host-node-selection.v1',origin:packet?.session?.origin||origin,nodeId:packet?.session?.nodeId||node.nodeId,displayName:node.displayName||node.nodeId,selectedAt:now(),source:VERSION};localStorage.setItem(HOST_ENDPOINT_KEY,selection.origin);localStorage.setItem(HOST_SELECTION_KEY,JSON.stringify(selection));gossip()?.rememberHub?.(node,'joined');dispatchEvent(new CustomEvent('civweave:host-node-selected',{detail:selection}));setGossipStatus(`Joined ${selection.displayName}. This Hub is now the selected Hub for this device.`);augmentDetail()}catch(error){setGossipStatus(`Could not join Hub · ${error.message}`)}
}
function augmentDetail(){
  if(renderingDetail)return;const detail=document.getElementById('detail'),row=selectedHubRow(),node=selectedHubNode();if(!detail||!row||!node?.nodeId)return;
  renderingDetail=true;try{
    detail.querySelector('[data-hub-map-actions]')?.remove();const actions=document.createElement('div');actions.dataset.hubMapActions='1';actions.className='row';actions.style.marginTop='9px';actions.innerHTML=`<button type="button" class="btn primary" data-hub-join>Join Hub</button><button type="button" class="btn" data-hub-explore>Explore ledger</button><button type="button" class="btn" data-hub-pass>Pass by</button>${node.publicOrigin?`<a class="btn" href="${esc(node.publicOrigin)}" target="_blank" rel="noopener">Open Hub ↗</a>`:''}`;detail.append(actions);
    actions.querySelector('[data-hub-join]')?.addEventListener('click',joinSelectedHub);actions.querySelector('[data-hub-explore]')?.addEventListener('click',()=>showLedgerFor(node));actions.querySelector('[data-hub-pass]')?.addEventListener('click',()=>refreshSelectedHub(true));gossip()?.rememberHub?.(node,'map-select');showLedgerFor(node).catch(()=>{});
  }finally{renderingDetail=false}
}
function observeDetail(){const detail=document.getElementById('detail');if(!detail||detailObserver)return;detailObserver=new MutationObserver(()=>queueMicrotask(augmentDetail));detailObserver.observe(detail,{childList:true,subtree:true})}

async function proximityReading(position){if(!proximityEnabled)return;const hits=await gossip()?.proximityUpdate?.(position,directory.nodes||[],{radiusMeters:750});if(hits?.length){const closest=hits.sort((a,b)=>a.distanceMeters-b.distanceMeters)[0];setGossipStatus(`Local gossip exchanged near ${nodeById(closest.nodeId)?.displayName||closest.nodeId} · ${closest.distanceMeters} m away`)}}
function startProximity(){
  proximityEnabled=true;if(watchId!=null||!navigator.geolocation)return;
  watchId=navigator.geolocation.watchPosition(position=>proximityReading(position).catch(()=>{}),()=>{}, {enableHighAccuracy:false,maximumAge:30000,timeout:15000});setGossipStatus('Local gossip is active while this Hub Map stays open. Roaming coordinates are not stored.')
}
function stopProximity(){if(watchId!=null){navigator.geolocation.clearWatch(watchId);watchId=null}}
async function virtualMemberRefresh(){
  if(navigator.onLine===false)return;const active=session()?.publicStatus?.()?.sessions?.filter(item=>item.active)||[];if(!active.length)return;
  try{return await gossip()?.syncRegion?.({nodes:directory.nodes||[],networkDirectory:false})}catch{return null}
}
function bind(){
  document.getElementById('locate')?.addEventListener('click',startProximity,{capture:true});addEventListener('online',()=>{loadDirectory({network:true}).then(()=>virtualMemberRefresh()).catch(()=>{})});addEventListener('civweave:map-mesh-applied',()=>{activateNodeMode();augmentDetail()});addEventListener('civweave:locality-ledger-changed',()=>refreshSelectedHub(false).catch(()=>{}));addEventListener('visibilitychange',()=>{if(document.hidden)stopProximity();else if(proximityEnabled)startProximity()});addEventListener('pagehide',()=>{stopProximity();if(refreshTimer)clearInterval(refreshTimer)},{once:true});
}
async function boot(){
  if(booted)return true;let ticks=0;while((!service()?.state?.map||!document.getElementById('panel'))&&ticks++<240)await new Promise(resolve=>setTimeout(resolve,50));if(!service()?.state?.map)return false;booted=true;installPanel();activateNodeMode();observeDetail();bind();await loadDirectory({network:true});await gossip()?.ensureMesh?.().catch(()=>{});virtualMemberRefresh().catch(()=>{});refreshTimer=setInterval(()=>loadDirectory({network:navigator.onLine!==false}).catch(()=>{}),REFRESH_MS);dispatchEvent(new CustomEvent('civweave:hub-map-ready',{detail:{version:VERSION,nodeCount:directory.nodes?.length||0,at:now()}}));return true
}

globalThis.CivweaveHubMapV1=Object.freeze({version:VERSION,boot,loadDirectory,installNodes,focusHubView,joinSelectedHub,refreshSelectedHub,startProximity,stopProximity,get directory(){return cloneDirectory()}});function cloneDirectory(){return typeof structuredClone==='function'?structuredClone(directory):parse(JSON.stringify(directory),directory)}document.readyState==='loading'?addEventListener('DOMContentLoaded',()=>boot().catch(()=>{}),{once:true}):queueMicrotask(()=>boot().catch(()=>{}));
})();