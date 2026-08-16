(()=>{
'use strict';

const VERSION='1.0.75-civweave-map-service-v275-guild-directory-view';
const VIEW=new URLSearchParams(location.search).get('view')||'';
const GUILD_DIRECTORY_VIEW=VIEW==='hub-nodes';
const BUNDLED='/app/federation-finder-data/federation-seed-v269.json';
const ATLAS='/app/federation-finder-data/atlas-v274/manifest.json';
const NODE_KEY='federation-finder.physical-node-endpoint';
const MESH_KEY='federation-finder.mesh-nodes.v1';
const GEOCODE_CACHE_KEY='civweave.map.geocode-cache.v1';
const PROVIDER_KEY='civweave.map.provider.v1';
const THEME_KEY='civweave.map.theme.v1';
const OPENFREEMAP={
  name:'OpenFreeMap',
  styles:{
    weave:'https://tiles.openfreemap.org/styles/liberty',
    midnight:'https://tiles.openfreemap.org/styles/dark',
    parchment:'https://tiles.openfreemap.org/styles/positron'
  },
  attribution:'OpenFreeMap · OpenStreetMap contributors'
};
const DEFAULT_GEOCODER='https://nominatim.openstreetmap.org';
const ids=['map','status','search','searchButton','results','detail','featureCount','nodeCount','atlasCount','locate','locationStatus','nodeEndpoint','syncNode','openNode','theme','provider','modeAll','modeFederations','modeNodes','back'];
const els=Object.fromEntries(ids.map(id=>[id,document.getElementById(id)]));
const state={
  map:null,
  features:new Map(),
  edges:[],
  hubIds:new Set(),
  nodes:new Map(),
  atlasManifest:null,
  source:GUILD_DIRECTORY_VIEW?'guild-directory':'bootstrap',
  mode:GUILD_DIRECTORY_VIEW?'nodes':'all',
  query:'',
  selectedId:null,
  userLocation:null,
  searchMarker:null,
  userMarker:null,
  theme:localStorage.getItem(THEME_KEY)||'weave',
  geocodeCache:loadJson(GEOCODE_CACHE_KEY,{}),
  lastGeocodeAt:0,
  styleReady:false
};

function loadJson(key,fallback){try{const v=JSON.parse(localStorage.getItem(key)||'null');return v??fallback}catch{return fallback}}
function saveJson(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{}}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]))}
function norm(v){return String(v??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
function validCoords(value){return Array.isArray(value)&&Number.isFinite(Number(value[0]))&&Number.isFinite(Number(value[1]))?[Number(value[0]),Number(value[1])]:null}
function setStatus(text){if(els.status)els.status.textContent=text}
function setLocationStatus(text){if(els.locationStatus)els.locationStatus.textContent=text}
function safeHttp(value=''){try{const raw=String(value||'').trim();if(!raw)return'';const u=new URL(/^https?:\/\//i.test(raw)?raw:`https://${raw}`);return ['http:','https:'].includes(u.protocol)?u.href:''}catch{return''}}
function isGuildDirectoryFeature(row){return Boolean(row?.raw?._civweaveHubMap)}
function normalizeFeature(feature,source='public'){
  const p={...(feature?.properties||{})};
  const coords=validCoords(feature?.geometry?.coordinates);
  const id=String(p.id||feature?.id||p.nodeId||'').trim();
  if(!id||!coords)return null;
  const name=String(p.n||p.name||p.label||id);
  const framework=String(p.f||p.framework_area||p.framework||'');
  const country=String(p.cc||p.country_code||p.country||'');
  const city=String(p.ci||p.city||'');
  const region=String(p.st||p.state||p.region||'');
  const model=String(p.m||p.model||p.type||'');
  const website=String(p.w||p.website||p.url||'');
  const email=String(p.e||p.email||'');
  const description=String(p.d||p.description||'');
  const search=norm([name,framework,country,city,region,model,email,description].filter(Boolean).join(' '));
  const hub=/federation|federated|network|union|coalition|alliance|cooperative network/i.test(`${model} ${framework}`);
  return {id,name,coords,framework,country,city,region,model,website,email,description,search,source,hub,raw:p};
}
function addFeature(feature,source='public'){
  const row=normalizeFeature(feature,source);
  if(row)state.features.set(row.id,row);
  return row;
}
function addNode(row,source='node'){
  const loc=row?.location||row?.publicLocation||{};
  const coords=validCoords(row?.coords)||validCoords(row?.coordinates)||validCoords([loc.lon??loc.longitude??row?.lon,row?.lat??loc.lat??loc.latitude]);
  if(!coords)return null;
  const rawId=String(row.nodeId||row.hubId||row.id||row.name||Math.random().toString(36).slice(2));
  const id=`${source}:${rawId}`;
  const feature={type:'Feature',id,geometry:{type:'Point',coordinates:coords},properties:{id,name:row.name||row.label||rawId,f:'Civweave node',m:'mesh node',url:row.endpoint||row.url||'',description:row.description||''}};
  const normalized=addFeature(feature,source);
  if(normalized)state.nodes.set(id,{...row,id,coords});
  return normalized;
}
function loadSavedNodes(){
  const raw=loadJson(MESH_KEY,[]);
  const rows=Array.isArray(raw)?raw:Object.values(raw||{});
  for(const row of rows)addNode(row,'local');
}
function parseCsv(text){
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<String(text||'').length;i++){
    const c=text[i];
    if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}
    else if(c===','&&!quoted){row.push(cell);cell=''}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(Boolean))rows.push(row);row=[];cell=''}
    else cell+=c;
  }
  if(cell||row.length){row.push(cell);rows.push(row)}
  return rows;
}
function parseRelationships(text){
  const rows=parseCsv(text);if(rows.length<2)return[];
  const h=rows[0].map(x=>x.trim().toLowerCase());
  const idx=(...names)=>names.map(n=>h.indexOf(n)).find(i=>i>=0)??-1;
  const si=idx('source_id','source','from'),ti=idx('target_id','target','to'),ri=idx('relationship_type','type','relationship');
  return rows.slice(1).map(r=>({source:String(r[si]||''),target:String(r[ti]||''),type:String(r[ri]||'relationship')})).filter(e=>e.source&&e.target);
}
function normalizeEdge(raw){
  const source=raw?.source_id??raw?.sourceId??raw?.source??raw?.from??raw?.a??raw?.src;
  const target=raw?.target_id??raw?.targetId??raw?.target??raw?.to??raw?.b??raw?.dst;
  if(source==null||target==null)return null;
  return {source:String(source),target:String(target),type:String(raw?.type??raw?.relationship??raw?.kind??raw?.label??'connection')};
}
function mergeEdges(rows=[]){
  const seen=new Set(state.edges.map(e=>`${e.source}\0${e.target}\0${e.type}`));
  for(const raw of rows){const e=normalizeEdge(raw);if(!e)continue;const k=`${e.source}\0${e.target}\0${e.type}`;if(seen.has(k))continue;seen.add(k);state.edges.push(e)}
}
async function fetchJson(url,options){const r=await fetch(url,options);if(!r.ok)throw new Error(`${url} → HTTP ${r.status}`);return r.json()}
async function fetchText(url,options){const r=await fetch(url,options);if(!r.ok)throw new Error(`${url} → HTTP ${r.status}`);return r.text()}
async function loadBundled(){
  const snapshot=await fetchJson(BUNDLED,{cache:'no-store'});
  for(const feature of snapshot?.map?.features||[])addFeature(feature,'bundled');
  for(const id of snapshot?.federationHubIds||[])state.hubIds.add(String(id));
  mergeEdges(parseRelationships(snapshot?.relationshipsCsv||''));
  state.source='bundled';
}
async function loadAtlas(){
  try{
    const manifest=await fetchJson(ATLAS,{cache:'no-store'});
    if(!Array.isArray(manifest?.featureChunks)||!manifest.featureChunks.length)return false;
    const chunks=await Promise.all(manifest.featureChunks.map(url=>fetchJson(url)));
    state.features.clear();
    for(const chunk of chunks)for(const feature of chunk?.features||[])addFeature(feature,'atlas');
    const edgeChunks=await Promise.all((manifest.edgeChunks||[]).map(url=>fetchJson(url).catch(()=>null)));
    state.edges=[];
    for(const chunk of edgeChunks)mergeEdges(chunk?.edges||[]);
    if(manifest.relationships){try{mergeEdges(parseRelationships(await fetchText(manifest.relationships)))}catch{}}
    state.atlasManifest=manifest;
    state.source='offline atlas';
    return true;
  }catch{return false}
}
function featureCollection(){
  const features=[];
  for(const f of state.features.values()){
    if(GUILD_DIRECTORY_VIEW&&!isGuildDirectoryFeature(f))continue;
    if(!GUILD_DIRECTORY_VIEW&&state.mode==='federations'&&!state.hubIds.has(f.id)&&!f.hub)continue;
    if(!GUILD_DIRECTORY_VIEW&&state.mode==='nodes'&&!['local','node'].includes(f.source))continue;
    if(state.query&&!f.search.includes(state.query))continue;
    features.push({type:'Feature',id:f.id,geometry:{type:'Point',coordinates:f.coords},properties:{id:f.id,name:f.name,city:f.city,region:f.region,country:f.country,framework:f.framework,model:f.model,source:f.source,hub:state.hubIds.has(f.id)||f.hub}});
  }
  return {type:'FeatureCollection',features};
}
function edgeCollection(){
  if(GUILD_DIRECTORY_VIEW)return{type:'FeatureCollection',features:[]};
  const features=[];
  for(const e of state.edges){
    const a=state.features.get(e.source),b=state.features.get(e.target);
    if(!a||!b)continue;
    features.push({type:'Feature',geometry:{type:'LineString',coordinates:[a.coords,b.coords]},properties:{type:e.type,hub:state.hubIds.has(a.id)||state.hubIds.has(b.id)||a.hub||b.hub}});
  }
  return {type:'FeatureCollection',features};
}
function visibleFeatureCount(){return GUILD_DIRECTORY_VIEW?[...state.features.values()].filter(isGuildDirectoryFeature).length:state.features.size}
function updateStats(){
  const visible=visibleFeatureCount();
  if(els.featureCount)els.featureCount.textContent=visible.toLocaleString();
  if(els.nodeCount)els.nodeCount.textContent=(GUILD_DIRECTORY_VIEW?visible:state.nodes.size).toLocaleString();
  if(els.atlasCount)els.atlasCount.textContent=Number(GUILD_DIRECTORY_VIEW?visible:(state.atlasManifest?.featureCount||state.features.size)).toLocaleString();
}
function updateMapData(){
  updateStats();
  if(!state.map||!state.styleReady)return;
  const contacts=state.map.getSource('civweave-contacts');if(contacts)contacts.setData(featureCollection());
  const edges=state.map.getSource('civweave-edges');if(edges)edges.setData(edgeCollection());
}
function applyCivweaveTheme(){
  if(!state.map||!state.styleReady)return;
  const theme=state.theme;
  const palette=theme==='parchment'
    ?{bg:'#efe5ca',water:'#9dc8cb',land:'#e9d7b2',park:'#bfd3a7',road:'#a88765',roadMajor:'#835f42',label:'#312b27',halo:'#f4ead5'}
    :theme==='midnight'
      ?{bg:'#020711',water:'#071b31',land:'#0b1323',park:'#102b2a',road:'#403d68',roadMajor:'#8771c7',label:'#dbe8f0',halo:'#020711'}
      :{bg:'#07131f',water:'#0b2940',land:'#102b34',park:'#153c36',road:'#4d5968',roadMajor:'#d9ad5b',label:'#eaf7f3',halo:'#07131f'};
  for(const layer of state.map.getStyle()?.layers||[]){
    const id=String(layer.id||'').toLowerCase();
    try{
      if(layer.type==='background')state.map.setPaintProperty(layer.id,'background-color',palette.bg);
      else if(layer.type==='fill'){
        if(/water|ocean/.test(id))state.map.setPaintProperty(layer.id,'fill-color',palette.water);
        else if(/park|wood|forest|grass|landcover/.test(id))state.map.setPaintProperty(layer.id,'fill-color',palette.park);
        else if(/land|building|residential/.test(id))state.map.setPaintProperty(layer.id,'fill-color',palette.land);
      }else if(layer.type==='line'){
        if(/water|river|stream/.test(id))state.map.setPaintProperty(layer.id,'line-color',palette.water);
        else if(/motorway|trunk|primary|major/.test(id))state.map.setPaintProperty(layer.id,'line-color',palette.roadMajor);
        else if(/road|street|highway|path|rail/.test(id))state.map.setPaintProperty(layer.id,'line-color',palette.road);
      }else if(layer.type==='symbol'&&/label|place|poi|road|boundary/.test(id)){
        state.map.setPaintProperty(layer.id,'text-color',palette.label);
        try{state.map.setPaintProperty(layer.id,'text-halo-color',palette.halo)}catch{}
      }
    }catch{}
  }
}
function addOverlaySources(){
  if(!state.map)return;
  if(!state.map.getSource('civweave-edges'))state.map.addSource('civweave-edges',{type:'geojson',data:edgeCollection()});
  if(!state.map.getLayer('civweave-edges'))state.map.addLayer({id:'civweave-edges',type:'line',source:'civweave-edges',minzoom:2.5,paint:{'line-color':['case',['boolean',['get','hub'],false],'#f0c96a','#73e6e0'],'line-opacity':0.34,'line-width':['interpolate',['linear'],['zoom'],2,0.6,8,1.8]}});
  if(!state.map.getSource('civweave-contacts'))state.map.addSource('civweave-contacts',{type:'geojson',data:featureCollection(),cluster:true,clusterRadius:44,clusterMaxZoom:11});
  if(!state.map.getLayer('civweave-clusters'))state.map.addLayer({id:'civweave-clusters',type:'circle',source:'civweave-contacts',filter:['has','point_count'],paint:{'circle-color':'#b99cff','circle-opacity':0.86,'circle-radius':['step',['get','point_count'],14,25,18,100,23,500,29],'circle-stroke-color':'#07131f','circle-stroke-width':2}});
  if(!state.map.getLayer('civweave-cluster-count'))state.map.addLayer({id:'civweave-cluster-count',type:'symbol',source:'civweave-contacts',filter:['has','point_count'],layout:{'text-field':['get','point_count_abbreviated'],'text-size':11},paint:{'text-color':'#ffffff'}});
  if(!state.map.getLayer('civweave-points'))state.map.addLayer({id:'civweave-points',type:'circle',source:'civweave-contacts',filter:['!',['has','point_count']],paint:{'circle-color':['case',['==',['get','source'],'node'],'#ff73bd',['==',['get','source'],'local'],'#ff73bd',['boolean',['get','hub'],false],'#f0c96a','#73e6e0'],'circle-radius':['interpolate',['linear'],['zoom'],2,3.2,8,5.2,13,8],'circle-stroke-color':'#07131f','circle-stroke-width':1.4}});
  state.map.on('click','civweave-clusters',e=>{
    const feature=e.features?.[0];if(!feature)return;
    const clusterId=feature.properties.cluster_id;
    const source=state.map.getSource('civweave-contacts');
    source.getClusterExpansionZoom(clusterId).then(zoom=>state.map.easeTo({center:feature.geometry.coordinates,zoom})).catch(()=>{});
  });
  state.map.on('click','civweave-points',e=>{
    const id=String(e.features?.[0]?.properties?.id||'');if(id)selectFeature(id,true);
  });
  for(const layer of ['civweave-clusters','civweave-points']){
    state.map.on('mouseenter',layer,()=>{state.map.getCanvas().style.cursor='pointer'});
    state.map.on('mouseleave',layer,()=>{state.map.getCanvas().style.cursor=''});
  }
}
function styleUrl(){return OPENFREEMAP.styles[state.theme]||OPENFREEMAP.styles.weave}
function initMap(){
  if(!window.maplibregl)throw new Error('MapLibre failed to load');
  state.map=new maplibregl.Map({container:'map',style:styleUrl(),center:[-78,42],zoom:3.25,minZoom:1.5,maxZoom:18,attributionControl:true,cooperativeGestures:false});
  state.map.addControl(new maplibregl.NavigationControl({showCompass:true,visualizePitch:true}),'top-right');
  state.map.addControl(new maplibregl.ScaleControl({maxWidth:120,unit:'imperial'}),'bottom-right');
  state.map.on('style.load',()=>{
    state.styleReady=true;
    applyCivweaveTheme();
    addOverlaySources();
    updateMapData();
  });
  state.map.on('error',e=>{if(e?.error)console.warn('[CivweaveMap]',e.error)});
}
function resultLabel(f){return [f.city,f.region,f.country].filter(Boolean).join(', ')}
function selectFeature(id,fly=false){
  const f=state.features.get(id);if(!f)return;
  if(GUILD_DIRECTORY_VIEW&&!isGuildDirectoryFeature(f))return;
  state.selectedId=id;
  if(fly&&state.map)state.map.flyTo({center:f.coords,zoom:Math.max(state.map.getZoom(),8),essential:true});
  if(els.detail)els.detail.innerHTML=`<strong>${esc(f.name)}</strong><small>${esc(resultLabel(f)||f.framework||f.model||'Mapped Civweave contact')}</small>${f.description?`<p>${esc(f.description)}</p>`:''}${f.website?`<a href="${esc(safeHttp(f.website))}" target="_blank" rel="noopener">Open website ↗</a>`:''}<div class="coord">${f.coords[1].toFixed(4)}, ${f.coords[0].toFixed(4)}</div>`;
}
function renderResults(rows,heading='Results'){
  if(!els.results)return;
  if(!rows.length){els.results.innerHTML='<div class="empty">No local matches.</div>';return}
  els.results.innerHTML=`<div class="results-heading">${esc(heading)}</div>`+rows.slice(0,40).map(row=>`<button type="button" data-result-id="${esc(row.id)}"><strong>${esc(row.name)}</strong><small>${esc(resultLabel(row)||row.framework||row.model||'Mapped contact')}</small></button>`).join('');
  els.results.querySelectorAll('[data-result-id]').forEach(button=>button.addEventListener('click',()=>selectFeature(button.dataset.resultId,true)));
}
function localSearch(q){
  const nq=norm(q);if(!nq)return[];
  const exact=[],prefix=[],contains=[];
  for(const f of state.features.values()){
    if(GUILD_DIRECTORY_VIEW&&!isGuildDirectoryFeature(f))continue;
    if(!GUILD_DIRECTORY_VIEW&&state.mode==='federations'&&!state.hubIds.has(f.id)&&!f.hub)continue;
    if(!GUILD_DIRECTORY_VIEW&&state.mode==='nodes'&&!['local','node'].includes(f.source))continue;
    const name=norm(f.name),place=norm([f.city,f.region,f.country].filter(Boolean).join(' '));
    if(name===nq||place===nq)exact.push(f);
    else if(name.startsWith(nq)||place.startsWith(nq))prefix.push(f);
    else if(f.search.includes(nq))contains.push(f);
  }
  return [...exact,...prefix,...contains].slice(0,80);
}
function parseCoordinateQuery(q){
  const m=String(q||'').trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if(!m)return null;
  const lat=Number(m[1]),lon=Number(m[2]);
  return Math.abs(lat)<=90&&Math.abs(lon)<=180?[lon,lat]:null;
}
function cacheGeocode(key,value){state.geocodeCache[key]={savedAt:Date.now(),value};saveJson(GEOCODE_CACHE_KEY,state.geocodeCache)}
async function waitForGeocodeSlot(){const elapsed=Date.now()-state.lastGeocodeAt;if(elapsed<1100)await new Promise(r=>setTimeout(r,1100-elapsed));state.lastGeocodeAt=Date.now()}
async function geocodePlace(query){
  const coords=parseCoordinateQuery(query);
  if(coords)return [{id:`coords:${coords.join(',')}`,name:`${coords[1].toFixed(5)}, ${coords[0].toFixed(5)}`,coords,displayName:'Coordinates'}];
  const key=`search:${norm(query)}`;
  const cached=state.geocodeCache[key];
  if(cached?.value?.length)return cached.value;
  await waitForGeocodeSlot();
  const base=String(window.CIVWEAVE_GEOCODER_ENDPOINT||DEFAULT_GEOCODER).replace(/\/$/,'');
  const url=new URL(`${base}/search`);url.searchParams.set('format','jsonv2');url.searchParams.set('q',query);url.searchParams.set('limit','8');url.searchParams.set('addressdetails','1');
  const response=await fetch(url,{headers:{Accept:'application/json'}});
  if(!response.ok)throw new Error(`Place search failed: HTTP ${response.status}`);
  const rows=(await response.json()).map((r,i)=>({id:`place:${r.osm_type||'x'}:${r.osm_id||i}`,name:r.name||String(r.display_name||'').split(',')[0]||query,displayName:r.display_name||query,coords:[Number(r.lon),Number(r.lat)],type:r.type||r.category||'place',address:r.address||{},bbox:r.boundingbox})).filter(r=>validCoords(r.coords));
  cacheGeocode(key,rows);
  return rows;
}
function renderPlaceResults(rows){
  if(!els.results)return;
  if(!rows.length){els.results.innerHTML='<div class="empty">No place matches.</div>';return}
  els.results.innerHTML='<div class="results-heading">Place matches</div>'+rows.map((r,i)=>`<button type="button" data-place-index="${i}"><strong>${esc(r.name)}</strong><small>${esc(r.displayName)}</small></button>`).join('');
  els.results.querySelectorAll('[data-place-index]').forEach(button=>button.addEventListener('click',()=>showPlace(rows[Number(button.dataset.placeIndex)])));
}
function showPlace(place){
  if(!state.map||!validCoords(place.coords))return;
  state.map.flyTo({center:place.coords,zoom:12,essential:true});
  if(state.searchMarker)state.searchMarker.remove();
  state.searchMarker=new maplibregl.Marker({color:'#f0c96a'}).setLngLat(place.coords).setPopup(new maplibregl.Popup({offset:18}).setHTML(`<strong>${esc(place.name)}</strong><br><small>${esc(place.displayName||'')}</small>`)).addTo(state.map);
  state.searchMarker.togglePopup();
  setLocationStatus(place.displayName||place.name);
}
async function search(){
  const query=String(els.search?.value||'').trim();
  state.query=norm(query);
  updateMapData();
  if(!query){renderResults([]);return}
  const local=localSearch(query);
  if(local.length){renderResults(local,GUILD_DIRECTORY_VIEW?`Guild matches · ${local.length}`:`Civweave matches · ${local.length}`);if(local.length===1)selectFeature(local[0].id,true);return}
  setStatus(`Searching locality data for “${query}”…`);
  try{const places=await geocodePlace(query);renderPlaceResults(places);if(places[0])showPlace(places[0]);setStatus(`${OPENFREEMAP.name} map · locality search ready`)}
  catch(error){console.warn(error);renderResults([]);setStatus('Map online · locality search temporarily unavailable')}
}
function distanceKm(a,b){
  const R=6371,toRad=x=>x*Math.PI/180;
  const dLat=toRad(b[1]-a[1]),dLon=toRad(b[0]-a[0]),lat1=toRad(a[1]),lat2=toRad(b[1]);
  const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}
function renderNearby(coords){
  const rows=[...state.features.values()].filter(f=>!GUILD_DIRECTORY_VIEW||isGuildDirectoryFeature(f)).map(f=>({f,d:distanceKm(coords,f.coords)})).sort((a,b)=>a.d-b.d).slice(0,24).map(x=>({...x.f,distance:x.d}));
  if(!els.results)return;
  els.results.innerHTML=`<div class="results-heading">${GUILD_DIRECTORY_VIEW?'Nearest Guilds':'Nearest mapped contacts'}</div>`+rows.map(row=>`<button type="button" data-result-id="${esc(row.id)}"><strong>${esc(row.name)}</strong><small>${row.distance<1?`${Math.round(row.distance*1000)} m`:`${row.distance.toFixed(1)} km`} · ${esc(resultLabel(row)||row.framework||'')}</small></button>`).join('');
  els.results.querySelectorAll('[data-result-id]').forEach(button=>button.addEventListener('click',()=>selectFeature(button.dataset.resultId,true)));
}
function locate(){
  if(!navigator.geolocation){setLocationStatus('Device location is unavailable in this browser.');return}
  setLocationStatus('Requesting device location…');
  navigator.geolocation.getCurrentPosition(position=>{
    const coords=[position.coords.longitude,position.coords.latitude];state.userLocation=coords;
    if(state.userMarker)state.userMarker.remove();
    state.userMarker=new maplibregl.Marker({color:'#9bdd91'}).setLngLat(coords).setPopup(new maplibregl.Popup({offset:18}).setText('Your device location')).addTo(state.map);
    state.map.flyTo({center:coords,zoom:10,essential:true});renderNearby(coords);setLocationStatus(`Located to ±${Math.round(position.coords.accuracy)} m. Precise coordinates are not persisted.`);
  },error=>setLocationStatus(`Location unavailable: ${error.message}`),{enableHighAccuracy:false,timeout:12000,maximumAge:300000});
}
async function syncNode(){
  if(GUILD_DIRECTORY_VIEW){setStatus('Guild discovery comes from the signed Guild directory.');return}
  const endpoint=safeHttp(els.nodeEndpoint?.value||localStorage.getItem(NODE_KEY)||'');
  if(!endpoint){setStatus('Enter a Node Host endpoint first.');return}
  localStorage.setItem(NODE_KEY,endpoint);setStatus('Reading node finder status…');
  try{
    const url=new URL('/api/finder-status',endpoint);
    const status=await fetchJson(url,{cache:'no-store'});
    const candidate=status?.node||status?.finder||status;
    const row={...candidate,endpoint,name:candidate?.name||candidate?.nodeName||candidate?.nodeId||new URL(endpoint).host};
    const added=addNode(row,'node');
    if(!added)throw new Error('Node responded without public location coordinates');
    updateMapData();selectFeature(added.id,true);setStatus(`Discovered node ${added.name}`);
  }catch(error){setStatus(`Node discovery failed · ${error.message}`)}
}
function changeMode(mode){
  if(GUILD_DIRECTORY_VIEW)mode='nodes';
  state.mode=mode;
  for(const [name,el] of [['all',els.modeAll],['federations',els.modeFederations],['nodes',els.modeNodes]])el?.classList.toggle('active',name===mode);
  state.query='';if(els.search)els.search.value='';updateMapData();renderResults([]);
}
function changeTheme(theme){
  if(!OPENFREEMAP.styles[theme])return;
  state.theme=theme;localStorage.setItem(THEME_KEY,theme);state.styleReady=false;state.map.setStyle(styleUrl());
}
function bind(){
  els.searchButton?.addEventListener('click',search);
  els.search?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();search()}});
  els.locate?.addEventListener('click',locate);
  els.syncNode?.addEventListener('click',syncNode);
  els.openNode?.addEventListener('click',()=>{if(GUILD_DIRECTORY_VIEW)return;const endpoint=safeHttp(els.nodeEndpoint?.value||localStorage.getItem(NODE_KEY)||'');if(endpoint)window.open(endpoint,'_blank','noopener')});
  els.modeAll?.addEventListener('click',()=>changeMode('all'));
  els.modeFederations?.addEventListener('click',()=>changeMode('federations'));
  els.modeNodes?.addEventListener('click',()=>changeMode('nodes'));
  els.theme?.addEventListener('change',()=>changeTheme(els.theme.value));
  els.back?.addEventListener('click',()=>{location.href='/app/installed-entry-v146.html?system=civweave'});
  if(els.nodeEndpoint)els.nodeEndpoint.value=localStorage.getItem(NODE_KEY)||'';
  if(els.theme)els.theme.value=state.theme;
  if(els.provider)els.provider.textContent=`${OPENFREEMAP.name} vector tiles · MapLibre renderer`;
}
async function boot(){
  bind();setStatus(GUILD_DIRECTORY_VIEW?'Loading Civweave Guild Map…':'Loading Civweave locality map…');
  let atlas=false;
  if(!GUILD_DIRECTORY_VIEW){
    try{await loadBundled()}catch(error){console.warn('[CivweaveMap] bundled seed failed',error)}
    loadSavedNodes();
  }
  try{initMap()}catch(error){setStatus(error.message);return}
  updateStats();
  if(!GUILD_DIRECTORY_VIEW){
    atlas=await loadAtlas();
    loadSavedNodes();
  }
  updateMapData();
  setStatus(GUILD_DIRECTORY_VIEW?`${OPENFREEMAP.name} Guild Map ready`:`${atlas?'Offline federation atlas':'Bundled federation seed'} + ${OPENFREEMAP.name} locality map ready`);
  window.CivweaveMapService={version:VERSION,state,search,locate,syncNode,selectFeature,changeTheme,updateMapData,provider:OPENFREEMAP,guildDirectoryView:GUILD_DIRECTORY_VIEW};
}

boot().catch(error=>{console.error('[CivweaveMap] boot failed',error);setStatus(`Map failed · ${error.message}`)});
})();
