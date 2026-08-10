(()=>{
'use strict';

const VERSION='civweave-map-v1-offline-1.0.0';
const PMTILES_VENDOR='/app/vendor/pmtiles-v4.4.1/pmtiles.js';
const MODE_KEY='civweave.map.basemap-mode.v1';
const ACTIVE_KEY='civweave.map.active-offline-pack.v1';
const MODES=new Set(['auto','online','offline']);
let pmtilesPromise=null;
let started=false;
let activePackId='';
let activeArchive=null;
let protocol=null;

const now=()=>new Date().toISOString();
const clean=(value,max=1000)=>String(value??'').trim().slice(0,max);
const finite=value=>Number.isFinite(Number(value))?Number(value):null;
function service(){return globalThis.CivweaveMapService||null}
function storage(){return globalThis.CivweaveMapStorageV1||null}
function mode(){const value=localStorage.getItem(MODE_KEY)||'auto';return MODES.has(value)?value:'auto'}
function setProvider(text){const el=document.getElementById('provider');if(el)el.textContent=clean(text,700)}
function setCoverage(text){const el=document.getElementById('coverageStatus');if(el)el.textContent=clean(text,700)}
function palette(theme='weave'){
  if(theme==='parchment')return{bg:'#efe5ca',earth:'#e9d7b2',land:'#d7c29c',landuse:'#c9c99b',water:'#9dc8cb',waterway:'#74aeb4',building:'#c3a77f',minor:'#aa8f72',major:'#835f42',boundary:'#9b6b65',place:'#5f4f42'};
  if(theme==='midnight')return{bg:'#020711',earth:'#0b1323',land:'#102b2a',landuse:'#122621',water:'#071b31',waterway:'#20496b',building:'#1c2534',minor:'#403d68',major:'#8771c7',boundary:'#78566f',place:'#dbe8f0'};
  return{bg:'#07131f',earth:'#102b34',land:'#153c36',landuse:'#183833',water:'#0b2940',waterway:'#24516a',building:'#273a40',minor:'#4d5968',major:'#d9ad5b',boundary:'#9b6a78',place:'#eaf7f3'};
}
function vectorLayerNames(metadata){
  let rows=metadata?.vector_layers||metadata?.vectorLayers||[];
  if(typeof rows==='string'){try{rows=JSON.parse(rows)}catch{rows=[]}}
  return new Set((Array.isArray(rows)?rows:[]).map(row=>String(row?.id||row?.name||'')).filter(Boolean));
}
function layerAvailable(names,id){return !names.size||names.has(id)}
function offlineStyle(pack,header,metadata,sourceUrl){
  const p=palette(service()?.state?.theme||'weave');
  const attribution=clean(pack.attribution||metadata?.attribution||'© OpenStreetMap contributors',1000);
  const tileType=Number(header?.tileType||header?.tile_type||0);
  const minzoom=Math.max(0,finite(pack.minZoom)??finite(header?.minZoom)??0);
  const maxzoom=Math.min(22,finite(pack.maxZoom)??finite(header?.maxZoom)??14);
  const source={url:sourceUrl,attribution,minzoom,maxzoom};
  const layers=[{id:'cw-offline-background',type:'background',paint:{'background-color':p.bg}}];
  if([2,3,4,5].includes(tileType)){
    return{version:8,name:`Civweave offline · ${pack.title||pack.packId}`,sources:{'civweave-offline-basemap':{type:'raster',...source,tileSize:256}},layers:[...layers,{id:'cw-offline-raster',type:'raster',source:'civweave-offline-basemap',paint:{'raster-opacity':1}}]};
  }
  if(tileType&&tileType!==1)throw new Error(`Cached PMTiles tile type ${tileType} is not supported by Civweave Map v1.`);
  const names=vectorLayerNames(metadata),sourceId='civweave-offline-basemap';
  const add=(id,type,sourceLayer,paint,extra={})=>{if(layerAvailable(names,sourceLayer))layers.push({id,type,source:sourceId,'source-layer':sourceLayer,paint,...extra})};
  add('cw-offline-earth','fill','earth',{'fill-color':p.earth});
  add('cw-offline-landcover','fill','landcover',{'fill-color':p.land,'fill-opacity':0.68});
  add('cw-offline-landuse','fill','landuse',{'fill-color':p.landuse,'fill-opacity':0.58});
  add('cw-offline-water','fill','water',{'fill-color':p.water});
  add('cw-offline-waterway','line','waterway',{'line-color':p.waterway,'line-width':['interpolate',['linear'],['zoom'],5,0.4,13,1.8]});
  add('cw-offline-buildings','fill','buildings',{'fill-color':p.building,'fill-opacity':0.7}, {minzoom:12});
  add('cw-offline-boundaries','line','boundaries',{'line-color':p.boundary,'line-width':['interpolate',['linear'],['zoom'],3,0.5,10,1.4],'line-dasharray':[2,2]});
  add('cw-offline-roads-minor','line','roads',{'line-color':p.minor,'line-width':['interpolate',['linear'],['zoom'],6,0.35,15,2.2]}, {filter:['!', ['match',['get','kind'],['highway','major_road'],true,false]]});
  add('cw-offline-roads-major','line','roads',{'line-color':p.major,'line-width':['interpolate',['linear'],['zoom'],4,0.55,15,3.2]}, {filter:['match',['get','kind'],['highway','major_road'],true,false]});
  add('cw-offline-places','circle','places',{'circle-color':p.place,'circle-opacity':0.8,'circle-radius':['interpolate',['linear'],['zoom'],3,1.4,10,3.3]}, {minzoom:3});
  return{version:8,name:`Civweave offline · ${pack.title||pack.packId}`,sources:{[sourceId]:{type:'vector',...source}},layers};
}
function ensurePmtiles(){
  if(globalThis.pmtiles?.PMTiles&&globalThis.pmtiles?.Protocol)return Promise.resolve(globalThis.pmtiles);
  if(pmtilesPromise)return pmtilesPromise;
  pmtilesPromise=new Promise((resolve,reject)=>{
    const existing=[...document.scripts].find(script=>script.src&&new URL(script.src,location.href).pathname===PMTILES_VENDOR);
    if(existing){let ticks=0;const timer=setInterval(()=>{if(globalThis.pmtiles?.PMTiles){clearInterval(timer);resolve(globalThis.pmtiles)}else if(++ticks>200){clearInterval(timer);reject(new Error('PMTiles runtime did not become ready.'))}},40);return}
    const script=document.createElement('script');script.src=PMTILES_VENDOR;script.async=false;script.onload=()=>globalThis.pmtiles?.PMTiles?resolve(globalThis.pmtiles):reject(new Error('PMTiles runtime loaded without its API.'));script.onerror=()=>reject(new Error('Packaged PMTiles runtime is unavailable.'));document.head.append(script);
  }).catch(error=>{pmtilesPromise=null;throw error});return pmtilesPromise;
}
async function ensureProtocol(){
  const lib=await ensurePmtiles();if(!globalThis.maplibregl?.addProtocol)throw new Error('MapLibre protocol API is unavailable.');
  if(globalThis.__CivweaveMapPmtilesProtocolV1){protocol=globalThis.__CivweaveMapPmtilesProtocolV1;return protocol}
  protocol=new lib.Protocol({metadata:true});globalThis.maplibregl.addProtocol('pmtiles',protocol.tile);globalThis.__CivweaveMapPmtilesProtocolV1=protocol;return protocol;
}
function boundsNeed(){
  const map=service()?.state?.map;if(!map?.getBounds)return null;const b=map.getBounds(),zoom=Math.floor(Number(map.getZoom?.())||0);
  const west=Number(b.getWest()),east=Number(b.getEast()),south=Number(b.getSouth()),north=Number(b.getNorth());if(![west,east,south,north].every(Number.isFinite)||west>east)return null;
  return{bbox:[west,south,east,north],zoom};
}
function covers(pack,need){
  const box=pack?.bbox;if(!need||!Array.isArray(box)||box.length!==4)return false;
  const min=finite(pack.minZoom),max=finite(pack.maxZoom);if(min!=null&&need.zoom<min)return false;if(max!=null&&need.zoom>max)return false;
  return box[0]<=need.bbox[0]&&box[1]<=need.bbox[1]&&box[2]>=need.bbox[2]&&box[3]>=need.bbox[3];
}
async function bestPackForView(){
  const s=storage(),need=boundsNeed();if(!s||!need)return null;const rows=(await s.listPacks()).filter(row=>row.status==='ready'&&covers(row,need));
  return rows.sort((a,b)=>Number(Boolean(b.verified))-Number(Boolean(a.verified))||Number(Boolean(b.pinned))-Number(Boolean(a.pinned))||Date.parse(b.cachedAt||0)-Date.parse(a.cachedAt||0))[0]||null;
}
async function activate(packOrId,{reason='manual'}={}){
  const s=storage(),svc=service();if(!s||!svc?.state?.map)throw new Error('Civweave map storage or renderer is unavailable.');
  const pack=typeof packOrId==='string'?await s.getPack(packOrId):packOrId;if(!pack?.packId||pack.status!=='ready')throw new Error('Cached map pack is unavailable.');
  const lib=await ensurePmtiles(),p=await ensureProtocol(),source=s.openSource(pack.packId);activeArchive=new lib.PMTiles(source);p.add(activeArchive);
  const [header,metadata]=await Promise.all([activeArchive.getHeader(),activeArchive.getMetadata().catch(()=>({}))]);
  const sourceUrl=`pmtiles://${source.getKey()}`;const style=offlineStyle(pack,header,metadata,sourceUrl);
  svc.state.styleReady=false;svc.state.map.setStyle(style);activePackId=pack.packId;localStorage.setItem(ACTIVE_KEY,pack.packId);s.touch(pack.packId).catch(()=>{});
  const attribution=clean(pack.attribution||metadata?.attribution||'OpenStreetMap contributors',320);setProvider(`Offline · ${pack.title||pack.packId} · ${attribution}`);setCoverage(`Offline coverage active: ${pack.title||pack.packId}.`);
  dispatchEvent(new CustomEvent('civweave:map-basemap-changed',{detail:{mode:'offline',packId:pack.packId,reason,attribution,at:now()}}));return{pack,header,metadata};
}
async function restoreOnline({reason='manual'}={}){
  const svc=service();if(!svc?.changeTheme)return false;activePackId='';activeArchive=null;localStorage.removeItem(ACTIVE_KEY);svc.changeTheme(svc.state.theme||'weave');setProvider('OpenFreeMap vector tiles · MapLibre renderer');
  dispatchEvent(new CustomEvent('civweave:map-basemap-changed',{detail:{mode:'online',reason,at:now()}}));return true;
}
async function reconcile(reason='state'){
  const preference=mode();
  if(preference==='online')return restoreOnline({reason});
  const pack=await bestPackForView();
  if(preference==='offline'){
    if(pack)return activate(pack,{reason});setCoverage('Offline basemap requested, but no downloaded pack covers this view.');return false;
  }
  if(navigator.onLine===false){if(pack)return activate(pack,{reason});setCoverage('Offline: no downloaded basemap covers this view yet.');return false}
  if(activePackId)return restoreOnline({reason});return true;
}
function setMode(value){const next=MODES.has(value)?value:'auto';localStorage.setItem(MODE_KEY,next);const select=document.getElementById('basemapMode');if(select)select.value=next;reconcile('preference').catch(error=>setCoverage(error.message));return next}
async function selfTest(){
  const checks={maplibre:Boolean(globalThis.maplibregl?.Map),indexedDb:Boolean(globalThis.indexedDB),storage:Boolean(storage()),pmtiles:false,serviceWorker:Boolean(navigator.serviceWorker),online:navigator.onLine!==false};
  try{await ensurePmtiles();checks.pmtiles=Boolean(globalThis.pmtiles?.PMTiles);await ensureProtocol();checks.protocol=true}catch(error){checks.pmtilesError=error.message}
  try{const stats=await storage()?.status?.();checks.storageStats=stats}catch(error){checks.storageError=error.message}
  checks.ready=Boolean(checks.maplibre&&checks.indexedDb&&checks.storage&&checks.pmtiles&&checks.protocol);dispatchEvent(new CustomEvent('civweave:map-v1-self-test',{detail:{...checks,at:now()}}));return checks;
}
async function start(){
  if(started)return status();started=true;await ensurePmtiles().catch(()=>{});const map=service()?.state?.map;
  map?.on?.('moveend',()=>{if(mode()!=='online'&&navigator.onLine===false)reconcile('moveend').catch(()=>{})});
  addEventListener('offline',()=>reconcile('offline').catch(()=>{}));addEventListener('online',()=>reconcile('online').catch(()=>{}));
  addEventListener('civweave:map-offline-coverage-ready',event=>{const pack=event.detail?.pack;if((navigator.onLine===false||mode()==='offline')&&pack?.packId)activate(pack.packId,{reason:'coverage-healed'}).catch(()=>{})});
  addEventListener('civweave:map-pack-removed',event=>{if(event.detail?.packId===activePackId)reconcile('active-pack-removed').catch(()=>{})});
  queueMicrotask(()=>reconcile('startup').catch(()=>{}));return status();
}
function status(){return{version:VERSION,started,mode:mode(),activePackId:activePackId||null,online:navigator.onLine!==false,pmtilesVendor:PMTILES_VENDOR}}

const api=Object.freeze({version:VERSION,PMTILES_VENDOR,ensurePmtiles,ensureProtocol,offlineStyle,bestPackForView,activate,restoreOnline,reconcile,mode,setMode,selfTest,start,status});globalThis.CivweaveMapOfflineV1=api;dispatchEvent(new CustomEvent('civweave:map-offline-runtime-ready',{detail:status()}));
})();
