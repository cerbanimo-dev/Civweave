(()=>{
'use strict';

const VERSION='civweave-map-v1-bridge-1.0.0';
const GATEWAY_KEY='civweave.map-mesh.gateway.v1';
const NODE_STALE_MS=6*60*60*1000;
const NODE_EXPIRES_MS=24*60*60*1000;
const RUNTIMES=[
  ['/app/civweave-map-storage-v1.js','CivweaveMapStorageV1'],
  ['/app/civweave-map-bootstrap-v1.js','CivweaveMapBootstrapV1'],
  ['/app/civweave-map-offline-v1.js','CivweaveMapOfflineV1'],
  ['/app/civweave-map-coverage-v277.js','CivweaveMapCoverageV277'],
  ['/app/civweave-map-ui-v1.js','CivweaveMapUIV1'],
  ['/app/cw-hub-peer-mesh-v1.js','CivweaveHubPeerMeshV1'],
  ['/app/cw-hub-peer-bootstrap-v1.js','CivweaveHubPeerBootstrapV1']
];
let appliedIds=new Set(),applying=false,publishTimer=null;
const runtimePromises=new Map();
const now=()=>new Date().toISOString();
const clean=(value,max=1000)=>String(value??'').trim().slice(0,max);
const norm=value=>String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
function gateway(){const mapStored=parse(localStorage.getItem(GATEWAY_KEY),''),aiBase=globalThis.CivweaveNodeAIMeshV1?.status?.()?.baseUrl||'';return clean(mapStored||aiBase||location.origin,4000)}
function ensureRuntime(path,globalName){
  if(globalThis[globalName])return Promise.resolve(globalThis[globalName]);if(runtimePromises.has(path))return runtimePromises.get(path);
  const promise=new Promise((resolve,reject)=>{
    const existing=[...document.scripts].find(script=>script.src&&new URL(script.src,location.href).pathname===path);
    if(existing){let ticks=0;const timer=setInterval(()=>{if(globalThis[globalName]){clearInterval(timer);resolve(globalThis[globalName])}else if(++ticks>200){clearInterval(timer);reject(new Error(`${globalName} did not become ready.`))}},40);return}
    const script=document.createElement('script');script.src=`${path}?v=map-v1`;script.async=false;script.onload=()=>globalThis[globalName]?resolve(globalThis[globalName]):reject(new Error(`${globalName} loaded without its API.`));script.onerror=()=>reject(new Error(`Could not load ${path}.`));document.head.append(script);
  }).catch(error=>{runtimePromises.delete(path);throw error});runtimePromises.set(path,promise);return promise;
}
function ageText(value){const time=Date.parse(value||0);if(!Number.isFinite(time))return'';const ms=Math.max(0,Date.now()-time);if(ms<60000)return'just now';if(ms<3600000)return`${Math.floor(ms/60000)}m ago`;if(ms<86400000)return`${Math.floor(ms/3600000)}h ago`;return`${Math.floor(ms/86400000)}d ago`}
function mapRow(feature,index=0){
  const coords=feature?.geometry?.coordinates;if(!Array.isArray(coords)||coords.length<2)return null;const lon=Number(coords[0]),lat=Number(coords[1]);if(!Number.isFinite(lon)||!Number.isFinite(lat))return null;
  const p={...(feature.properties||{})},baseId=clean(feature.id||p.id||p.nodeId||`${p._civweaveMeshDataset||'locality'}:${index}`,400),id=`mesh:${p._civweaveMeshOrigin||'peer'}:${baseId}`;
  const name=clean(p.n||p.name||p.label||p.nodeName||p.nodeId||baseId,500),framework=clean(p.f||p.framework_area||p.framework||'',500),country=clean(p.cc||p.country_code||p.country||'',300),city=clean(p.ci||p.city||'',300),region=clean(p.st||p.state||p.region||'',300),model=clean(p.m||p.model||p.type||p.kind||'',300),website=clean(p.w||p.website||p.url||p.endpoint||'',1000),email=clean(p.e||p.email||'',500);
  const isNode=Boolean(p.nodeId)||/civweave\s+node|mesh\s+node|node\s+host/i.test(`${model} ${framework}`),hub=/federation|federated|network|union|coalition|alliance|cooperative network/i.test(`${model} ${framework}`);
  const lastSeenAt=clean(p.lastSeenAt||p.observedAt||p.updatedAt||p._civweaveMeshCreatedAt||p._civweaveMeshReceivedAt||'',100),seenMs=Date.parse(lastSeenAt||0),stale=Boolean(isNode&&Number.isFinite(seenMs)&&Date.now()-seenMs>NODE_STALE_MS);
  const baseDescription=clean(p.d||p.description||'',1000),freshness=isNode&&lastSeenAt?`${stale?'Stale node status':'Last seen'} ${ageText(lastSeenAt)}`:'',description=clean([baseDescription,freshness].filter(Boolean).join(' · '),1200);
  return{id,name,coords:[lon,lat],framework,country,city,region,model,website,email,description,search:norm([name,framework,country,city,region,model,email,description].filter(Boolean).join(' ')),source:isNode?'node':'mesh',hub,stale,lastSeenAt,raw:{...p,_civweaveMesh:true,_civweaveStale:stale,_civweaveLastSeenAt:lastSeenAt}};
}
async function apply(){
  if(applying)return{applied:0,packs:0,staleNodes:0};const mesh=globalThis.CivweaveMapMeshV276,service=globalThis.CivweaveMapService;if(!mesh||!service?.state?.features)return{applied:0,packs:0,staleNodes:0};applying=true;
  try{
    for(const id of appliedIds){service.state.features.delete(id);service.state.nodes?.delete?.(id)}appliedIds=new Set();let staleNodes=0;const features=await mesh.localityFeatures();
    features.forEach((feature,index)=>{const row=mapRow(feature,index);if(!row)return;service.state.features.set(row.id,row);appliedIds.add(row.id);if(row.source==='node'){if(row.stale)staleNodes++;service.state.nodes?.set?.(row.id,{id:row.id,nodeId:row.raw.nodeId||row.name,name:row.name,coords:row.coords,endpoint:row.website,source:'www-mesh',lastSeenAt:row.lastSeenAt,stale:row.stale})}});
    service.updateMapData?.();const packs=await mesh.listMapPacks(),status=document.getElementById('status');if(status){const base=status.textContent.replace(/\s*·\s*WWW mesh:.*$/,'');status.textContent=`${base} · WWW mesh: ${features.length.toLocaleString()} places, ${packs.length.toLocaleString()} packs${staleNodes?`, ${staleNodes} stale nodes`:''}`}
    dispatchEvent(new CustomEvent('civweave:map-mesh-applied',{detail:{features:features.length,packs:packs.length,staleNodes,at:now()}}));return{applied:features.length,packs:packs.length,staleNodes};
  }finally{applying=false}
}
async function publishSelectedPublicNode(){
  const mesh=globalThis.CivweaveMapMeshV276,service=globalThis.CivweaveMapService;if(!mesh||!service?.state)return false;const row=service.state.features?.get?.(service.state.selectedId);if(!row||row.source!=='node'||!Array.isArray(row.coords))return false;
  const endpoint=clean(row.website||row.raw?.url||row.raw?.endpoint||'',1000),nodeId=clean(row.raw?.nodeId||row.raw?.id||row.id.replace(/^node:/,''),220),observed=now(),expiresAt=new Date(Date.now()+NODE_EXPIRES_MS).toISOString();
  await mesh.publishLocalityBatch({datasetId:`public-node-status:${nodeId}`,title:`Public Civweave node · ${row.name}`,features:[{type:'Feature',id:nodeId,geometry:{type:'Point',coordinates:row.coords},properties:{id:nodeId,nodeId,name:row.name,city:row.city,region:row.region,country:row.country,model:'Civweave node host',endpoint,description:row.description||'',visibility:'public',source:'public /api/finder-status',lastSeenAt:observed}}],source:'Civweave public node finder status',sourceUrl:endpoint,license:'Node-published public metadata',attribution:'Published by the originating Civweave node',expiresAt});await mesh.sync(gateway()).catch(()=>{});return true;
}
async function start(){
  const mesh=globalThis.CivweaveMapMeshV276;if(!mesh)return false;await mesh.start({baseUrl:gateway(),intervalMs:120000});await apply();
  const runtimes={};for(const [path,name] of RUNTIMES){try{runtimes[name]=await ensureRuntime(path,name)}catch(error){console.warn('[Civweave Map v1]',error)}}
  try{await runtimes.CivweaveMapBootstrapV1?.start?.()}catch{}try{await runtimes.CivweaveMapOfflineV1?.start?.()}catch{}try{await runtimes.CivweaveMapCoverageV277?.start?.()}catch{}try{await runtimes.CivweaveMapUIV1?.mount?.()}catch{}try{await runtimes.CivweaveHubPeerBootstrapV1?.sync?.()}catch{}try{runtimes.CivweaveHubPeerMeshV1?.installMapSurface?.()}catch{}
  addEventListener('civweave:map-knowledge-changed',()=>apply().catch(()=>{}));addEventListener('civweave:map-pack-published',()=>apply().catch(()=>{}));const syncButton=document.getElementById('syncNode');syncButton?.addEventListener('click',()=>{if(publishTimer)clearTimeout(publishTimer);publishTimer=setTimeout(()=>publishSelectedPublicNode().catch(()=>{}),1600)});return true;
}
function boot(){if(globalThis.CivweaveMapMeshV276&&globalThis.CivweaveMapService)return start().catch(()=>{});let ticks=0;const timer=setInterval(()=>{if(globalThis.CivweaveMapMeshV276&&globalThis.CivweaveMapService){clearInterval(timer);start().catch(()=>{})}else if(++ticks>240)clearInterval(timer)},50)}

globalThis.CivweaveMapMeshBridgeV276=Object.freeze({version:VERSION,NODE_STALE_MS,NODE_EXPIRES_MS,apply,publishSelectedPublicNode,ensureRuntime,start,gateway});document.readyState==='loading'?addEventListener('DOMContentLoaded',boot,{once:true}):queueMicrotask(boot);
})();