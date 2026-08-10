(()=>{
'use strict';

const VERSION='civweave-map-v1-coverage-1.0.0';
const SCORING_URL='/app/shared/civweave-map-coverage-scoring-v1.mjs';
const AUTO_KEY='civweave.map-coverage.auto.v1';
const BUDGET_KEY='civweave.map-coverage.max-auto-bytes.v1';
const HISTORY_KEY='civweave.map-coverage.need-history.v1';
const TELEMETRY_KEY='civweave.map-coverage.telemetry.v1';
const FAILURE_KEY='civweave.map-coverage.failures.v1';
const TRUST_KEY='civweave.map.trusted-origins.v1';
const DEFAULT_MAX_BYTES=96*1024*1024;
const MIN_AUTO_ZOOM=5;
const NEED_COOLDOWN_MS=10*60*1000;
const MAX_FAILURE_BACKOFF_MS=6*60*60*1000;
let scoringPromise=null,timer=null,followupTimer=null,inFlight=null,lastNeed=null,lastResult=null,started=false;

const now=()=>new Date().toISOString();
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}};
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};
const finite=value=>Number.isFinite(Number(value))?Number(value):null;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const clean=(value,max=300)=>String(value??'').trim().slice(0,max);
async function scoring(){return scoringPromise||(scoringPromise=import(SCORING_URL).catch(error=>{scoringPromise=null;throw error}))}
function autoEnabled(){return localStorage.getItem(AUTO_KEY)!=='0'}
function setAutoEnabled(value){localStorage.setItem(AUTO_KEY,value?'1':'0');updateToggle();schedule('preference',100);return autoEnabled()}
function updateToggle(){const button=document.getElementById('coverageToggle');if(button){button.textContent=`Auto coverage ${autoEnabled()?'on':'paused'}`;button.classList.toggle('active',autoEnabled())}}
function setCoverageStatus(message){const text=clean(message,700),el=document.getElementById('coverageStatus');if(el)el.textContent=text;dispatchEvent(new CustomEvent('civweave:map-coverage-status',{detail:{message:text,at:now()}}))}
function connectionBudget(){
  const override=Math.max(0,Math.trunc(finite(localStorage.getItem(BUDGET_KEY))||0));if(override)return override;
  const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;if(connection?.saveData)return 0;const type=String(connection?.effectiveType||'').toLowerCase();if(type==='slow-2g'||type==='2g')return 8*1024*1024;if(type==='3g')return 32*1024*1024;return DEFAULT_MAX_BYTES;
}
function map(){return globalThis.CivweaveMapService?.state?.map||null}
function currentNeed(){
  const instance=map();if(!instance?.getBounds||!instance?.getZoom)return null;const bounds=instance.getBounds(),zoom=Math.max(0,Math.floor(Number(instance.getZoom())||0));let west=Number(bounds.getWest()),east=Number(bounds.getEast()),south=Number(bounds.getSouth()),north=Number(bounds.getNorth());if(![west,east,south,north].every(Number.isFinite))return null;south=clamp(south,-85,85);north=clamp(north,-85,85);if(west>east){west=-180;east=180}west=clamp(west,-180,180);east=clamp(east,-180,180);if(west>=east||south>=north)return null;const q=value=>Math.round(value*4)/4,bbox=[q(west),q(south),q(east),q(north)],needId=`viewport:z${zoom}:${bbox.map(value=>value.toFixed(2)).join(',')}`;return{needId,region:`viewport z${zoom}`,bbox,minZoom:zoom,maxZoom:zoom,formats:['pmtiles'],maxBytes:connectionBudget()};
}
async function cachedRows(){const store=globalThis.CivweaveMapStorageV1;if(!store?.listPacks)return[];return(await store.listPacks()).filter(row=>row.status==='ready'&&row.packId)}
function trustedOrigins(){const raw=read(TRUST_KEY,[]);return new Set(Array.isArray(raw)?raw:Object.keys(raw||{}).filter(key=>raw[key]))}
function telemetryFor(packs){const metrics=read(TELEMETRY_KEY,{}),trusted=trustedOrigins(),out={};for(const pack of packs){const metric=metrics[pack.packId]||metrics[pack.originNodeId]||{};out[pack.packId]={...metric,trusted:Boolean(trusted.has(pack.originFingerprint)||trusted.has(pack.originNodeId))}}return out}
function needRecentlyPublished(needId){const history=read(HISTORY_KEY,{}),at=Date.parse(history[needId]||0);return Number.isFinite(at)&&Date.now()-at<NEED_COOLDOWN_MS}
function markNeedPublished(needId){const history=read(HISTORY_KEY,{});history[needId]=now();const entries=Object.entries(history).sort((a,b)=>Date.parse(b[1])-Date.parse(a[1])).slice(0,80);write(HISTORY_KEY,Object.fromEntries(entries))}
function failureState(packId){return read(FAILURE_KEY,{})[packId]||null}
function failureBlocked(packId){const row=failureState(packId);if(!row?.count||!row.at)return false;const delay=Math.min(MAX_FAILURE_BACKOFF_MS,5*60*1000*(2**Math.max(0,Number(row.count)-1)));return Date.now()-Date.parse(row.at)<delay}
function recordFailure(packId,error){const all=read(FAILURE_KEY,{}),previous=all[packId]||{};all[packId]={count:Math.min(12,Number(previous.count||0)+1),at:now(),error:clean(error?.message||error,500)};write(FAILURE_KEY,all);const metrics=read(TELEMETRY_KEY,{}),metric=metrics[packId]||{};metrics[packId]={...metric,failures:Number(metric.failures||0)+1,lastFailureAt:now()};write(TELEMETRY_KEY,metrics)}
function recordSuccess(pack,latencyMs){const failures=read(FAILURE_KEY,{});delete failures[pack.packId];write(FAILURE_KEY,failures);const all=read(TELEMETRY_KEY,{}),previous=all[pack.packId]||{},prior=finite(previous.latencyMs);all[pack.packId]={...previous,latencyMs:prior==null?Math.round(latencyMs):Math.round(prior*0.65+latencyMs*0.35),successes:Number(previous.successes||0)+1,lastSuccessAt:now(),originNodeId:pack.originNodeId||null};write(TELEMETRY_KEY,all)}
async function cachedCoverage(need){const scorer=await scoring(),rows=await cachedRows();return rows.filter(pack=>scorer.cachedPackSatisfies(need,pack)).sort((a,b)=>Number(Boolean(b.verified))-Number(Boolean(a.verified))||Number(Boolean(b.pinned))-Number(Boolean(a.pinned))||Date.parse(b.cachedAt||0)-Date.parse(a.cachedAt||0))}
async function publishNeed(mesh,need){if(needRecentlyPublished(need.needId))return false;await mesh.publishRegionNeed({needId:need.needId,region:need.region,bbox:need.bbox,minZoom:need.minZoom,maxZoom:need.maxZoom,formats:need.formats,expiresAt:new Date(Date.now()+6*60*60*1000).toISOString()});markNeedPublished(need.needId);return true}
async function rankCandidates(mesh,need){const scorer=await scoring(),packs=await mesh.listMapPacks(),cached=new Set((await cachedRows()).map(row=>row.packId)),candidates=packs.filter(pack=>pack.format==='pmtiles'&&!cached.has(pack.packId)&&!failureBlocked(pack.packId));return scorer.rankPacks(need,candidates,telemetryFor(candidates))}
async function pullBest(mesh,need,ranked){
  const best=ranked.find(row=>row.eligible);if(!best)return null;if(!autoEnabled())return{status:'paused',best};const budget=connectionBudget();if(!budget){setCoverageStatus('Automatic map downloads are paused by Data Saver or the current network budget.');return{status:'network-budget',best}}const bytes=Math.max(0,Number(best.pack.bytes)||0);if(!bytes||bytes>budget){setCoverageStatus(`A matching map pack exists, but ${bytes?`${Math.round(bytes/1048576)} MiB`:'its size'} exceeds the current automatic download budget.`);return{status:'network-budget',best}}
  const began=performance.now();setCoverageStatus(`Offline coverage: streaming ${best.pack.title||best.pack.packId} into local map storage…`);
  try{const cached=await mesh.pullMapPack(best.pack,{maxBytes:budget,verify:true});recordSuccess(best.pack,performance.now()-began);dispatchEvent(new CustomEvent('civweave:map-offline-coverage-ready',{detail:{need,pack:best.pack,cached,score:best.score,at:now()}}));setCoverageStatus(`Offline coverage healed: ${best.pack.title||best.pack.packId} is stored, SHA-256 verified, and renderable offline.`);return{status:'cached',best,cached}}
  catch(error){recordFailure(best.pack.packId,error);setCoverageStatus(`Offline coverage candidate failed: ${clean(error.message,240)}. Another peer can be tried after backoff.`);return{status:'failed',best,error:error.message}}
}
async function negotiate({reason='viewport',force=false}={}){
  if(inFlight)return inFlight;inFlight=(async()=>{const mesh=globalThis.CivweaveMapMeshV276,need=currentNeed();lastNeed=need;if(!mesh||!need){lastResult={status:'unavailable',reason};return lastResult}if(need.minZoom<MIN_AUTO_ZOOM){setCoverageStatus('Offline coverage: zoom in to a local area to request a compact map pack.');lastResult={status:'too-broad',need};return lastResult}const local=await cachedCoverage(need);if(local.length){setCoverageStatus(`Offline coverage ready: ${local[0].title||local[0].packId} covers this view.`);lastResult={status:'covered',need,pack:local[0]};return lastResult}if(!autoEnabled()&&!force){setCoverageStatus('Offline coverage automation is paused.');lastResult={status:'paused',need};return lastResult}const published=await publishNeed(mesh,need).catch(()=>false);if(navigator.onLine!==false)await mesh.sync().catch(()=>{});const ranked=await rankCandidates(mesh,need),best=ranked[0]||null;if(!best?.eligible){setCoverageStatus(published?'Offline coverage requested from connected Civweave nodes.':'Offline coverage still awaiting a matching peer pack.');if(published&&navigator.onLine!==false){if(followupTimer)clearTimeout(followupTimer);followupTimer=setTimeout(()=>negotiate({reason:'peer-followup',force:true}).catch(()=>{}),4500)}lastResult={status:'requested',need,published,ranked:ranked.slice(0,5)};return lastResult}const result=await pullBest(mesh,need,ranked);lastResult={...result,need,ranked:ranked.slice(0,5)};return lastResult})().finally(()=>{inFlight=null});return inFlight;
}
function schedule(reason='viewport',delay=900){if(timer)clearTimeout(timer);timer=setTimeout(()=>negotiate({reason}).catch(()=>{}),delay)}
async function start(){if(started)return status();const instance=map();if(!instance)return false;started=true;updateToggle();instance.on?.('moveend',()=>schedule('moveend'));instance.on?.('zoomend',()=>schedule('zoomend'));addEventListener('civweave:map-knowledge-changed',()=>schedule('peer-update',250));addEventListener('civweave:map-pack-published',()=>schedule('pack-advert',250));addEventListener('online',()=>schedule('online',150));schedule('startup',250);return status()}
function status(){return{version:VERSION,started,auto:autoEnabled(),budgetBytes:connectionBudget(),minAutoZoom:MIN_AUTO_ZOOM,lastNeed,lastResult,storage:'indexeddb-chunks'}}
function boot(){if(globalThis.CivweaveMapMeshV276&&map())return start().catch(()=>{});let ticks=0;const poll=setInterval(()=>{if(globalThis.CivweaveMapMeshV276&&map()){clearInterval(poll);start().catch(()=>{})}else if(++ticks>300)clearInterval(poll)},50)}

globalThis.CivweaveMapCoverageV277=Object.freeze({version:VERSION,start,negotiate,schedule,currentNeed,connectionBudget,autoEnabled,setAutoEnabled,status});document.readyState==='loading'?addEventListener('DOMContentLoaded',boot,{once:true}):queueMicrotask(boot);
})();
