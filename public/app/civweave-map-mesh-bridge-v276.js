(()=>{
'use strict';

const VERSION='1.0.75-civweave-map-mesh-bridge-v277';
const GATEWAY_KEY='civweave.map-mesh.gateway.v1';
const COVERAGE_RUNTIME='/app/civweave-map-coverage-v277.js';
let appliedIds=new Set();
let applying=false;
let publishTimer=null;
let coveragePromise=null;

const clean=(value,max=1000)=>String(value??'').trim().slice(0,max);
const norm=value=>String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
function gateway(){
  const mapStored=parse(localStorage.getItem(GATEWAY_KEY),'');
  const aiBase=globalThis.CivweaveNodeAIMeshV1?.status?.()?.baseUrl||'';
  return clean(mapStored||aiBase||location.origin,4000);
}
function ensureCoverageRuntime(){
  if(globalThis.CivweaveMapCoverageV277)return Promise.resolve(globalThis.CivweaveMapCoverageV277);
  if(coveragePromise)return coveragePromise;
  coveragePromise=new Promise((resolve,reject)=>{
    const existing=[...document.scripts].find(script=>script.src&&new URL(script.src,location.href).pathname===COVERAGE_RUNTIME);
    if(existing){let ticks=0;const timer=setInterval(()=>{if(globalThis.CivweaveMapCoverageV277){clearInterval(timer);resolve(globalThis.CivweaveMapCoverageV277)}else if(++ticks>160){clearInterval(timer);reject(new Error('Map coverage runtime did not become ready.'))}},50);return}
    const script=document.createElement('script');script.src=`${COVERAGE_RUNTIME}?v=1.0.75`;script.async=false;script.onload=()=>resolve(globalThis.CivweaveMapCoverageV277);script.onerror=()=>reject(new Error('Could not load automatic map coverage runtime.'));document.head.append(script);
  }).catch(error=>{coveragePromise=null;throw error});
  return coveragePromise;
}
function mapRow(feature,index=0){
  const coords=feature?.geometry?.coordinates;if(!Array.isArray(coords)||coords.length<2)return null;
  const lon=Number(coords[0]),lat=Number(coords[1]);if(!Number.isFinite(lon)||!Number.isFinite(lat))return null;
  const p={...(feature.properties||{})};
  const baseId=clean(feature.id||p.id||p.nodeId||`${p._civweaveMeshDataset||'locality'}:${index}`,400);
  const id=`mesh:${p._civweaveMeshOrigin||'peer'}:${baseId}`;
  const name=clean(p.n||p.name||p.label||p.nodeName||p.nodeId||baseId,500);
  const framework=clean(p.f||p.framework_area||p.framework||'',500);
  const country=clean(p.cc||p.country_code||p.country||'',300);
  const city=clean(p.ci||p.city||'',300);
  const region=clean(p.st||p.state||p.region||'',300);
  const model=clean(p.m||p.model||p.type||p.kind||'',300);
  const website=clean(p.w||p.website||p.url||p.endpoint||'',1000);
  const email=clean(p.e||p.email||'',500);
  const description=clean(p.d||p.description||'',1000);
  const isNode=Boolean(p.nodeId)||/civweave\s+node|mesh\s+node|node\s+host/i.test(`${model} ${framework}`);
  const hub=/federation|federated|network|union|coalition|alliance|cooperative network/i.test(`${model} ${framework}`);
  return {id,name,coords:[lon,lat],framework,country,city,region,model,website,email,description,search:norm([name,framework,country,city,region,model,email,description].filter(Boolean).join(' ')),source:isNode?'node':'mesh',hub,raw:{...p,_civweaveMesh:true}};
}
async function apply(){
  if(applying)return{applied:0,packs:0};
  const mesh=globalThis.CivweaveMapMeshV276,service=globalThis.CivweaveMapService;
  if(!mesh||!service?.state?.features)return{applied:0,packs:0};
  applying=true;
  try{
    for(const id of appliedIds){service.state.features.delete(id);service.state.nodes?.delete?.(id)}
    appliedIds=new Set();
    const features=await mesh.localityFeatures();
    features.forEach((feature,index)=>{
      const row=mapRow(feature,index);if(!row)return;
      service.state.features.set(row.id,row);appliedIds.add(row.id);
      if(row.source==='node')service.state.nodes?.set?.(row.id,{id:row.id,nodeId:row.raw.nodeId||row.name,name:row.name,coords:row.coords,endpoint:row.website,source:'www-mesh'});
    });
    service.updateMapData?.();
    const packs=await mesh.listMapPacks();
    const status=document.getElementById('status');
    if(status){const base=status.textContent.replace(/\s*·\s*WWW mesh:.*$/,'');status.textContent=`${base} · WWW mesh: ${features.length.toLocaleString()} places, ${packs.length.toLocaleString()} packs`}
    dispatchEvent(new CustomEvent('civweave:map-mesh-applied',{detail:{features:features.length,packs:packs.length,at:new Date().toISOString()}}));
    return{applied:features.length,packs:packs.length};
  }finally{applying=false}
}
async function publishSelectedPublicNode(){
  const mesh=globalThis.CivweaveMapMeshV276,service=globalThis.CivweaveMapService;if(!mesh||!service?.state)return false;
  const row=service.state.features?.get?.(service.state.selectedId);if(!row||row.source!=='node'||!Array.isArray(row.coords))return false;
  const endpoint=clean(row.website||row.raw?.url||row.raw?.endpoint||'',1000);
  const nodeId=clean(row.raw?.nodeId||row.raw?.id||row.id.replace(/^node:/,''),220);
  await mesh.publishLocalityBatch({datasetId:`public-node-status:${nodeId}`,title:`Public Civweave node · ${row.name}`,features:[{type:'Feature',id:nodeId,geometry:{type:'Point',coordinates:row.coords},properties:{id:nodeId,nodeId,name:row.name,city:row.city,region:row.region,country:row.country,model:'Civweave node host',endpoint,description:row.description||'',visibility:'public',source:'public /api/finder-status'}}],source:'Civweave public node finder status',sourceUrl:endpoint,license:'Node-published public metadata',attribution:'Published by the originating Civweave node'});
  await mesh.sync(gateway()).catch(()=>{});
  return true;
}
async function start(){
  const mesh=globalThis.CivweaveMapMeshV276;if(!mesh)return false;
  await mesh.start({baseUrl:gateway(),intervalMs:120000});
  await apply();
  await ensureCoverageRuntime().catch(()=>null);
  globalThis.CivweaveMapCoverageV277?.start?.().catch?.(()=>{});
  addEventListener('civweave:map-knowledge-changed',()=>apply().catch(()=>{}));
  addEventListener('civweave:map-pack-published',()=>apply().catch(()=>{}));
  const syncButton=document.getElementById('syncNode');
  syncButton?.addEventListener('click',()=>{if(publishTimer)clearTimeout(publishTimer);publishTimer=setTimeout(()=>publishSelectedPublicNode().catch(()=>{}),1600)});
  return true;
}
function boot(){
  if(globalThis.CivweaveMapMeshV276&&globalThis.CivweaveMapService)return start().catch(()=>{});
  let ticks=0;const timer=setInterval(()=>{if(globalThis.CivweaveMapMeshV276&&globalThis.CivweaveMapService){clearInterval(timer);start().catch(()=>{})}else if(++ticks>240)clearInterval(timer)},50);
}

globalThis.CivweaveMapMeshBridgeV276=Object.freeze({version:VERSION,apply,publishSelectedPublicNode,ensureCoverageRuntime,start,gateway});
document.readyState==='loading'?addEventListener('DOMContentLoaded',boot,{once:true}):queueMicrotask(boot);
})();
