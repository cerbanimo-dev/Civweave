const REVISION='civweave-open-learning-media-cache-v1';
const LOOKUP_URL='/downloads/knowledge-schools/open-learning-media/lookup.json';
const POLICY_URL='/downloads/knowledge-schools/open-learning-media/harvest-policy.json';
const CACHE_NAME='cw-open-learning-media-v1';
const META_CACHE_NAME='cw-open-learning-media-meta-v1';
const DB_NAME='civweave-open-learning-media-v1';
const DB_VERSION=1;
const MAX_CATALOG_AGE_MS=30*24*60*60*1000;
const AUTOMATIC_ITEM_MAX_BYTES=48*1024*1024;
const CHUNK_BYTES=32*1024;
const ALLOWED_LICENSES=new Set(['PUBLIC-DOMAIN','CC0','CC-BY','CC-BY-SA']);
const POLICY_PRESETS=Object.freeze({
  minimal:{label:'Minimal',budgetBytes:96*1024*1024,autoPrefetch:false,maxAutomaticItemBytes:16*1024*1024},
  'learning-path':{label:'Learning Path',budgetBytes:384*1024*1024,autoPrefetch:true,maxAutomaticItemBytes:48*1024*1024},
  'outage-ready':{label:'Outage Ready',budgetBytes:1024*1024*1024,autoPrefetch:true,maxAutomaticItemBytes:96*1024*1024},
  archive:{label:'Archive',budgetBytes:3*1024*1024*1024,autoPrefetch:true,maxAutomaticItemBytes:256*1024*1024},
});
const FOCUS_TOPICS=['vibe-coding','prompt-engineering','pseudocoding','critical-thinking','logical-frameworks'];
const TOPIC_HINTS=Object.freeze({
  'vibe-coding':['vibe coding','ai coding','coding assistant','claude code','copilot','cursor','code generation','agentic coding'],
  'prompt-engineering':['prompt engineering','prompt design','prompt pattern','few shot','zero shot','prompting'],
  pseudocoding:['pseudocode','pseudo code','algorithm design','computational thinking','flowchart'],
  'critical-thinking':['critical thinking','media literacy','information literacy','source evaluation','fact checking','evidence'],
  'logical-frameworks':['formal logic','logical reasoning','logical fallacy','systems thinking','decision framework','decision tree','syllogism','deductive','inductive','abductive'],
});

const listeners=new Set();
const objectUrls=new Map();
const attachedChannels=new WeakSet();
const peerInventory=new Map();
const incomingTransfers=new Map();
const transferWaiters=new Map();
let lookupPromise=null;
let policyPromise=null;
let meshTimer=0;
let warmPromise=null;

const now=()=>new Date().toISOString();
const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const bytesLabel=value=>{const n=Math.max(0,Number(value)||0);if(n<1024)return`${n} B`;if(n<1024**2)return`${(n/1024).toFixed(1)} KiB`;if(n<1024**3)return`${(n/1024**2).toFixed(1)} MiB`;return`${(n/1024**3).toFixed(2)} GiB`};
const emit=(type,detail={})=>{const packet={type,detail,at:now()};for(const listener of listeners)try{listener(packet)}catch{};try{globalThis.dispatchEvent?.(new CustomEvent('civweave:open-learning-media',{detail:packet}))}catch{}};
const req=request=>new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});

function openDb(){
  if(!globalThis.indexedDB)throw new Error('IndexedDB is unavailable.');
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,DB_VERSION);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains('records')){
        const store=db.createObjectStore('records',{keyPath:'recordKey'});
        store.createIndex('hash','contentHash',{unique:false});
        store.createIndex('lastAccessAt','lastAccessAt',{unique:false});
        store.createIndex('topicSlug','topicSlug',{unique:false});
      }
      if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta',{keyPath:'key'});
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}
async function tx(storeNames,mode,work){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const transaction=db.transaction(storeNames,mode);
    const stores=Object.fromEntries(storeNames.map(name=>[name,transaction.objectStore(name)]));
    let result;
    try{result=work(stores,transaction)}catch(error){transaction.abort();reject(error);return}
    transaction.oncomplete=()=>resolve(result);
    transaction.onerror=()=>reject(transaction.error);
    transaction.onabort=()=>reject(transaction.error||new Error('Open media storage transaction aborted.'));
  });
}
async function metaGet(key){return tx(['meta'],'readonly',stores=>req(stores.meta.get(key)))}
async function metaPut(key,value){return tx(['meta'],'readwrite',stores=>stores.meta.put({key,value,updatedAt:now()}))}
async function recordGet(recordKey){return tx(['records'],'readonly',stores=>req(stores.records.get(recordKey)))}
async function recordByHash(hash){return tx(['records'],'readonly',stores=>req(stores.records.index('hash').get(hash)))}
async function recordPut(record){return tx(['records'],'readwrite',stores=>stores.records.put(record))}
async function recordDelete(recordKey){return tx(['records'],'readwrite',stores=>stores.records.delete(recordKey))}
async function recordsAll(){return tx(['records'],'readonly',stores=>req(stores.records.getAll()))}

export function licenseAllowed(license){return ALLOWED_LICENSES.has(clean(license?.spdx||license,80).toUpperCase())}
export function recordKey(record){return`${clean(record?.provider,80)}:${clean(record?.provider_id,300)}`}
function isRedistributable(record){return record?.cache_policy==='MESH_REDISTRIBUTABLE'&&licenseAllowed(record?.license)&&Array.isArray(record?.files)&&record.files.length>0}
function fileMime(file){const explicit=clean(file?.mime,120);if(explicit)return explicit;const url=clean(file?.url,1200).toLowerCase();if(url.includes('.webm'))return'video/webm';if(url.includes('.mp4'))return'video/mp4';if(url.includes('.ogv')||url.includes('.ogg'))return'video/ogg';return'application/octet-stream'}
function playableFile(file){const mime=fileMime(file);return mime.startsWith('video/')&&!/\.m3u8(?:$|\?)/i.test(clean(file?.url,1200))}
export function chooseFile(record,{maxBytes=Infinity,preferSmall=true}={}){
  const files=(Array.isArray(record?.files)?record.files:[]).filter(file=>file?.url&&playableFile(file));
  if(!files.length)return null;
  const eligible=files.filter(file=>!Number(file?.bytes)||Number(file.bytes)<=maxBytes);
  const pool=eligible.length?eligible:files;
  return [...pool].sort((a,b)=>{
    const ab=Number(a?.bytes)||Number.MAX_SAFE_INTEGER,bb=Number(b?.bytes)||Number.MAX_SAFE_INTEGER;
    return preferSmall?ab-bb:bb-ab;
  })[0]||null;
}
function words(value){return clean(value,16000).toLowerCase().split(/[^a-z0-9]+/).filter(word=>word.length>2)}
function topicHintScore(query,slug){const hay=clean(query,4000).toLowerCase();let score=0;for(const hint of TOPIC_HINTS[slug]||[])if(hay.includes(hint))score+=hint.includes(' ')?8:3;return score}
export function scoreRecord(record,query,topicSlug=''){
  const queryWords=[...new Set(words(query))].slice(0,32);if(!queryWords.length)return topicSlug?30:0;
  const title=new Set(words(record?.title)),body=new Set(words(`${record?.description||''} ${record?.attribution?.creator||''}`));
  let score=topicSlug?topicHintScore(query,topicSlug)+8:0;
  for(const word of queryWords){if(title.has(word))score+=6;else if(body.has(word))score+=2}
  score+=Math.min(10,Math.round((Number(record?.quality_score)||0)/10));
  return score;
}

async function cacheJson(url,payload){if(!globalThis.caches)return;try{const cache=await caches.open(META_CACHE_NAME);await cache.put(url,new Response(JSON.stringify(payload),{headers:{'content-type':'application/json'}}))}catch{}}
async function cachedJson(url){if(!globalThis.caches)return null;try{const cache=await caches.open(META_CACHE_NAME);const response=await cache.match(url);return response?.ok?await response.json():null}catch{return null}}
async function fetchJson(url){const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error(`${url} returned ${response.status}`);return response.json()}
function validLookup(data){return data?.schema==='civweave.open-learning-media-lookup.v1'&&data?.topics&&typeof data.topics==='object'}
function validPolicy(data){return data?.schema==='civweave.open-learning-media-harvest-policy.v1'||Array.isArray(data?.accepted_default_licenses)}
export async function loadLookup({force=false}={}){
  if(lookupPromise&&!force)return lookupPromise;
  lookupPromise=(async()=>{
    let data=null;
    if(globalThis.navigator?.onLine!==false){try{const network=await fetchJson(LOOKUP_URL);if(validLookup(network)){data=network;await cacheJson(LOOKUP_URL,network)}}catch{}}
    if(!data)data=await cachedJson(LOOKUP_URL);
    if(!validLookup(data))throw new Error('Open Learning Media lookup is unavailable.');
    return data;
  })();
  return lookupPromise;
}
export async function loadHarvestPolicy({force=false}={}){
  if(policyPromise&&!force)return policyPromise;
  policyPromise=(async()=>{
    let data=null;
    if(globalThis.navigator?.onLine!==false){try{const network=await fetchJson(POLICY_URL);if(validPolicy(network)){data=network;await cacheJson(POLICY_URL,network)}}catch{}}
    if(!data)data=await cachedJson(POLICY_URL);
    return data||{accepted_default_licenses:[...ALLOWED_LICENSES]};
  })();
  return policyPromise;
}
export function catalogAgeMs(lookup){const built=Date.parse(lookup?.built_at||'');return Number.isFinite(built)?Math.max(0,Date.now()-built):Infinity}
export function catalogFresh(lookup){return catalogAgeMs(lookup)<=MAX_CATALOG_AGE_MS}
function flattenLookup(lookup){const out=[];for(const [topicSlug,records] of Object.entries(lookup?.topics||{}))for(const record of records||[])out.push({...record,topicSlug,recordKey:recordKey(record)});const seen=new Set();return out.filter(record=>{if(!record.recordKey||seen.has(record.recordKey))return false;seen.add(record.recordKey);return true})}
async function getPolicyName(){return clean((await metaGet('storage-policy'))?.value,40)||'learning-path'}
export async function setStoragePolicy(name){const key=POLICY_PRESETS[name]?name:'learning-path';await metaPut('storage-policy',key);emit('policy-changed',{name:key,policy:POLICY_PRESETS[key]});return key}
export async function storagePolicy(){const name=await getPolicyName();return{name,...POLICY_PRESETS[name]}}
export async function effectiveBudgetBytes(){const policy=await storagePolicy();let budget=policy.budgetBytes;try{const estimate=await navigator.storage?.estimate?.();const quota=Number(estimate?.quota)||0;if(quota>0)budget=Math.min(budget,Math.max(64*1024*1024,Math.floor(quota*0.45)))}catch{}return budget}
async function currentBytes(){return(await recordsAll()).reduce((sum,row)=>sum+(Number(row?.bytes)||0),0)}
async function storageHeadroom(){const budget=await effectiveBudgetBytes(),used=await currentBytes();return{budget,used,remaining:Math.max(0,budget-used)}}
function syntheticRequest(recordKeyValue){const origin=globalThis.location?.origin||'https://civweave.invalid';return new Request(`${origin}/__civweave_open_media__/${encodeURIComponent(recordKeyValue)}`)}
async function mediaCache(){if(!globalThis.caches)throw new Error('Cache Storage is unavailable.');return caches.open(CACHE_NAME)}

class Sha256{
  constructor(){this.h=new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);this.buffer=new Uint8Array(64);this.bufferLength=0;this.bytesHashed=0;this.finished=false;this.w=new Uint32Array(64)}
  update(data){if(this.finished)throw new Error('SHA-256 already finalized');const bytes=data instanceof Uint8Array?data:new Uint8Array(data);let pos=0;this.bytesHashed+=bytes.length;while(pos<bytes.length){const take=Math.min(bytes.length-pos,64-this.bufferLength);this.buffer.set(bytes.subarray(pos,pos+take),this.bufferLength);this.bufferLength+=take;pos+=take;if(this.bufferLength===64){this._compress(this.buffer);this.bufferLength=0}}return this}
  _compress(chunk){const w=this.w;for(let i=0;i<16;i++){const j=i*4;w[i]=((chunk[j]<<24)|(chunk[j+1]<<16)|(chunk[j+2]<<8)|chunk[j+3])>>>0}for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2],s0=((a>>>7)|(a<<25))^((a>>>18)|(a<<14))^(a>>>3),s1=((b>>>17)|(b<<15))^((b>>>19)|(b<<13))^(b>>>10);w[i]=(w[i-16]+s0+w[i-7]+s1)>>>0}let[a,b,c,d,e,f,g,h]=this.h;for(let i=0;i<64;i++){const S1=((e>>>6)|(e<<26))^((e>>>11)|(e<<21))^((e>>>25)|(e<<7)),ch=(e&f)^(~e&g),t1=(h+S1+ch+K[i]+w[i])>>>0,S0=((a>>>2)|(a<<30))^((a>>>13)|(a<<19))^((a>>>22)|(a<<10)),maj=(a&b)^(a&c)^(b&c),t2=(S0+maj)>>>0;h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0}this.h[0]=(this.h[0]+a)>>>0;this.h[1]=(this.h[1]+b)>>>0;this.h[2]=(this.h[2]+c)>>>0;this.h[3]=(this.h[3]+d)>>>0;this.h[4]=(this.h[4]+e)>>>0;this.h[5]=(this.h[5]+f)>>>0;this.h[6]=(this.h[6]+g)>>>0;this.h[7]=(this.h[7]+h)>>>0}
  digestHex(){if(!this.finished){const bits=this.bytesHashed*8;this.buffer[this.bufferLength++]=0x80;if(this.bufferLength>56){while(this.bufferLength<64)this.buffer[this.bufferLength++]=0;this._compress(this.buffer);this.bufferLength=0}while(this.bufferLength<56)this.buffer[this.bufferLength++]=0;const hi=Math.floor(bits/0x100000000),lo=bits>>>0;for(let i=3;i>=0;i--)this.buffer[this.bufferLength++]=(hi>>>(i*8))&255;for(let i=3;i>=0;i--)this.buffer[this.bufferLength++]=(lo>>>(i*8))&255;this._compress(this.buffer);this.finished=true}return[...this.h].map(value=>value.toString(16).padStart(8,'0')).join('')}
}
const K=new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
export function sha256HexForBytes(bytes){return new Sha256().update(bytes).digestHex()}

async function streamHash(readable){const hasher=new Sha256();let bytes=0;const reader=readable.getReader();for(;;){const{done,value}=await reader.read();if(done)break;const chunk=value instanceof Uint8Array?value:new Uint8Array(value);bytes+=chunk.byteLength;hasher.update(chunk)}return{hash:hasher.digestHex(),bytes}}
async function touch(record){record.lastAccessAt=now();await recordPut(record);return record}
async function ensureRoom(requiredBytes,excludeKey=''){
  const budget=await effectiveBudgetBytes();let rows=(await recordsAll()).sort((a,b)=>Date.parse(a.lastAccessAt||a.cachedAt||0)-Date.parse(b.lastAccessAt||b.cachedAt||0));let used=rows.reduce((sum,row)=>sum+(Number(row.bytes)||0),0);if(requiredBytes>budget)throw new Error(`Media item ${bytesLabel(requiredBytes)} exceeds the ${bytesLabel(budget)} cache budget.`);
  const cache=await mediaCache();for(const row of rows){if(used+requiredBytes<=budget)break;if(row.recordKey===excludeKey||row.pinned)continue;await cache.delete(syntheticRequest(row.recordKey));await recordDelete(row.recordKey);used-=Number(row.bytes)||0;const old=objectUrls.get(row.recordKey);if(old){URL.revokeObjectURL(old);objectUrls.delete(row.recordKey)}emit('evicted',{recordKey:row.recordKey,bytes:row.bytes})}
  if(used+requiredBytes>budget)throw new Error('Not enough evictable Open Learning Media storage.');return{budget,used}
}
function normalizedStoredRecord(record,file,hash,bytes,mime,extra={}){return{recordKey:recordKey(record),provider:record.provider,providerId:record.provider_id,topicSlug:record.topicSlug||extra.topicSlug||'',title:clean(record.title,320),description:clean(record.description,6000),sourceUrl:clean(record.source_url,1500),fileUrl:clean(file?.url,1800),mime:clean(mime||fileMime(file),160),bytes:Number(bytes)||Number(file?.bytes)||0,contentHash:hash,license:record.license,attribution:record.attribution,cachePolicy:record.cache_policy,qualityScore:Number(record.quality_score)||0,cachedAt:extra.cachedAt||now(),lastAccessAt:now(),origin:extra.origin||'internet',pinned:Boolean(extra.pinned)}}

export async function cacheRecord(record,{automatic=false,pinned=false,force=false}={}){
  await warmup();if(!isRedistributable(record))throw new Error('Media record is not approved for the redistributable cache.');
  const key=recordKey(record),existing=await recordGet(key);if(existing&&!force)return touch(existing);
  const lookup=await loadLookup();if(!catalogFresh(lookup)&&!force)throw new Error('Open Learning Media catalog is stale; refusing a new network download until metadata refreshes.');
  const policy=await storagePolicy();const automaticLimit=Math.min(AUTOMATIC_ITEM_MAX_BYTES,policy.maxAutomaticItemBytes||AUTOMATIC_ITEM_MAX_BYTES);const file=chooseFile(record,{maxBytes:automatic?automaticLimit:Infinity,preferSmall:true});if(!file)throw new Error('No browser-playable direct media file is available.');
  if(automatic&&Number(file.bytes)>automaticLimit)throw new Error(`Automatic cache skipped ${bytesLabel(file.bytes)} item above the ${bytesLabel(automaticLimit)} per-item cap.`);
  await ensureRoom(Number(file.bytes)||0,key);emit('download-start',{recordKey:key,title:record.title,bytes:Number(file.bytes)||0,automatic});
  const response=await fetch(file.url,{cache:'no-store'});if(!response.ok||!response.body)throw new Error(`Media origin returned ${response.status}.`);
  const[cacheStream,hashStream]=response.body.tee();const headers=new Headers(response.headers);if(!headers.get('content-type'))headers.set('content-type',fileMime(file));
  const cache=await mediaCache(),request=syntheticRequest(key);const putPromise=cache.put(request,new Response(cacheStream,{status:200,statusText:'OK',headers}));const hashResult=await streamHash(hashStream);await putPromise;
  const stored=normalizedStoredRecord({...record,topicSlug:record.topicSlug},file,hashResult.hash,hashResult.bytes,headers.get('content-type'),{origin:'internet',pinned});await recordPut(stored);emit('download-complete',{recordKey:key,hash:stored.contentHash,bytes:stored.bytes,title:stored.title});announceSoon();return stored;
}
export async function uncache(recordKeyValue){const row=await recordGet(recordKeyValue);if(!row)return false;const cache=await mediaCache();await cache.delete(syntheticRequest(recordKeyValue));await recordDelete(recordKeyValue);const old=objectUrls.get(recordKeyValue);if(old){URL.revokeObjectURL(old);objectUrls.delete(recordKeyValue)}emit('uncached',{recordKey:recordKeyValue});return true}
export async function clearCache(){const rows=await recordsAll();for(const row of rows)await uncache(row.recordKey);return rows.length}
export async function cachedPlayback(recordKeyValue){const row=await recordGet(recordKeyValue);if(!row)return null;let url=objectUrls.get(recordKeyValue);if(!url){const cache=await mediaCache(),response=await cache.match(syntheticRequest(recordKeyValue));if(!response)return null;url=URL.createObjectURL(await response.blob());objectUrls.set(recordKeyValue,url)}await touch(row);return{kind:'open-media',url,title:row.title,creator:row.attribution?.creator||'',reason:'Playing from the local Open Learning Media cache.',source:'civweave-open-learning-media-cache',mime:row.mime,local:true,recordKey:row.recordKey,contentHash:row.contentHash,license:row.license,attribution:row.attribution}}
function candidatesForQuery(lookup,query,{schoolSlug='',topicSlug=''}={}){let inferred=topicSlug;if(!inferred){let bestSlug='',bestHint=0;for(const slug of Object.keys(lookup.topics||{})){const hint=topicHintScore(query,slug);if(hint>bestHint){bestHint=hint;bestSlug=slug}}if(bestHint>0)inferred=bestSlug}const source=inferred?(lookup.topics?.[inferred]||[]):flattenLookup(lookup);return source.map(record=>({...record,topicSlug:inferred||record.topicSlug,recordKey:recordKey(record),_score:scoreRecord(record,query,inferred)})).filter(record=>isRedistributable(record)).sort((a,b)=>b._score-a._score||Number(b.quality_score||0)-Number(a.quality_score||0))}
async function peerForRecordKey(key){for(const[peerId,manifest]of peerInventory){const item=manifest.items?.find?.(entry=>entry.recordKey===key);if(item)return{peerId,item,sessionId:manifest.sessionId}}return null}
export async function resolveOpenMedia(query,{schoolSlug='',topicSlug='',automaticCache=true}={}){
  const lookup=await loadLookup();const candidates=candidatesForQuery(lookup,query,{schoolSlug,topicSlug});if(!candidates.length)return null;
  for(const candidate of candidates.slice(0,8)){const local=await cachedPlayback(candidate.recordKey);if(local)return{...local,score:candidate._score,topicSlug:candidate.topicSlug}}
  if(globalThis.navigator?.onLine===false){for(const candidate of candidates.slice(0,8)){const peer=await peerForRecordKey(candidate.recordKey);if(peer){try{await fetchFromMesh(peer.item.contentHash,{recordKey:candidate.recordKey,timeoutMs:45000});const local=await cachedPlayback(candidate.recordKey);if(local)return{...local,score:candidate._score,topicSlug:candidate.topicSlug,reason:'Recovered from a Civweave mesh peer for offline playback.'}}catch{}}}return null}
  const best=candidates[0],file=chooseFile(best,{maxBytes:Infinity,preferSmall:true});if(!file)return null;
  if(automaticCache){const policy=await storagePolicy();if(policy.autoPrefetch&&Number(file.bytes||0)<=Number(policy.maxAutomaticItemBytes||AUTOMATIC_ITEM_MAX_BYTES))cacheRecord(best,{automatic:true}).catch(error=>emit('automatic-cache-skipped',{recordKey:best.recordKey,error:error.message}))}
  return{kind:'open-media',url:file.url,title:clean(best.title,320),creator:clean(best.attribution?.creator,180),reason:`Rights-cleared Open Learning Media match${best._score?` · relevance ${best._score}`:''}.`,source:'civweave-open-learning-media',mime:fileMime(file),local:false,recordKey:best.recordKey,contentHash:null,license:best.license,attribution:best.attribution,score:best._score,topicSlug:best.topicSlug};
}
export async function prefetchTopic(topicSlug,{limit=1,pinned=false}={}){const lookup=await loadLookup();const records=(lookup.topics?.[topicSlug]||[]).filter(isRedistributable).map(record=>({...record,topicSlug}));const results=[];for(const record of records){if(results.length>=limit)break;try{results.push({ok:true,record:await cacheRecord(record,{automatic:false,pinned})})}catch(error){results.push({ok:false,recordKey:recordKey(record),error:error.message})}}return results}
export async function prefetchFocusPack({limitPerTopic=1,pinned=false}={}){const results={};for(const slug of FOCUS_TOPICS)results[slug]=await prefetchTopic(slug,{limit:limitPerTopic,pinned});return results}
function safeManifestRecord(row){return{recordKey:row.recordKey,contentHash:row.contentHash,bytes:row.bytes,mime:row.mime,title:row.title,topicSlug:row.topicSlug,license:row.license,attribution:row.attribution}}
async function localManifest(){return(await recordsAll()).filter(row=>row.contentHash&&licenseAllowed(row.license)&&row.cachePolicy==='MESH_REDISTRIBUTABLE').map(safeManifestRecord)}
function sessionEntries(){const mesh=globalThis.CivweaveLocalMeshV146;return mesh?.sessions?[...mesh.sessions.values()]:[]}
async function waitBackpressure(channel){while(channel?.readyState==='open'&&channel.bufferedAmount>1024*1024)await sleep(20)}
function sendJson(channel,payload){if(channel?.readyState==='open')channel.send(JSON.stringify(payload))}
async function sendManifest(session){if(session?.channel?.readyState!=='open')return;sendJson(session.channel,{type:'cw-media-manifest',revision:REVISION,nodeId:await globalThis.CivweaveLocalMeshV146?.deviceId?.(),items:await localManifest()})}
async function sendMedia(session,message){const row=await recordByHash(message.contentHash);if(!row||row.recordKey!==message.recordKey||!licenseAllowed(row.license)||row.cachePolicy!=='MESH_REDISTRIBUTABLE'){sendJson(session.channel,{type:'cw-media-reject',contentHash:message.contentHash,recordKey:message.recordKey,error:'media unavailable or not redistributable'});return}const cache=await mediaCache(),response=await cache.match(syntheticRequest(row.recordKey));if(!response?.body){sendJson(session.channel,{type:'cw-media-reject',contentHash:row.contentHash,recordKey:row.recordKey,error:'cached bytes unavailable'});return}const transferId=`media:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;sendJson(session.channel,{type:'cw-media-start',transferId,record:safeManifestRecord(row)});const reader=response.body.getReader();for(;;){const{done,value}=await reader.read();if(done)break;const bytes=value instanceof Uint8Array?value:new Uint8Array(value);for(let offset=0;offset<bytes.byteLength;offset+=CHUNK_BYTES){const chunk=bytes.subarray(offset,Math.min(bytes.byteLength,offset+CHUNK_BYTES));await waitBackpressure(session.channel);sendJson(session.channel,{type:'cw-media-chunk',transferId,length:chunk.byteLength});session.channel.send(chunk)}}sendJson(session.channel,{type:'cw-media-end',transferId,contentHash:row.contentHash});emit('mesh-sent',{peerId:session.peerId,recordKey:row.recordKey,hash:row.contentHash,bytes:row.bytes})}
async function acceptStart(session,message){const row=message.record||{};if(!row.recordKey||!row.contentHash||!licenseAllowed(row.license))return sendJson(session.channel,{type:'cw-media-reject',recordKey:row.recordKey,contentHash:row.contentHash,error:'license or manifest rejected'});const headroom=await storageHeadroom();if(Number(row.bytes)>headroom.remaining){try{await ensureRoom(Number(row.bytes)||0,row.recordKey)}catch(error){sendJson(session.channel,{type:'cw-media-reject',recordKey:row.recordKey,contentHash:row.contentHash,error:error.message});return}}const stream=new TransformStream(),writer=stream.writable.getWriter(),hasher=new Sha256(),cache=await mediaCache(),request=syntheticRequest(row.recordKey);const headers=new Headers({'content-type':row.mime||'application/octet-stream'});const putPromise=cache.put(request,new Response(stream.readable,{status:200,headers}));incomingTransfers.set(message.transferId,{sessionId:session.id,record:row,writer,hasher,received:0,putPromise,expectedHash:row.contentHash,pendingBinary:false});emit('mesh-receive-start',{peerId:session.peerId,recordKey:row.recordKey,bytes:row.bytes})}
async function finishTransfer(transferId,message){const transfer=incomingTransfers.get(transferId);if(!transfer)return;incomingTransfers.delete(transferId);try{await transfer.writer.close();await transfer.putPromise;const hash=transfer.hasher.digestHex();if(hash!==transfer.expectedHash||hash!==message.contentHash)throw new Error('Mesh media SHA-256 verification failed.');const r=transfer.record;const stored={recordKey:r.recordKey,provider:'mesh',providerId:r.recordKey,topicSlug:r.topicSlug||'',title:r.title||'Open learning media',description:'',sourceUrl:'',fileUrl:'',mime:r.mime||'application/octet-stream',bytes:transfer.received,contentHash:hash,license:r.license,attribution:r.attribution,cachePolicy:'MESH_REDISTRIBUTABLE',qualityScore:0,cachedAt:now(),lastAccessAt:now(),origin:'mesh',pinned:false};await recordPut(stored);emit('mesh-receive-complete',{recordKey:r.recordKey,hash,bytes:transfer.received});resolveTransferWaiter(hash,null,stored);announceSoon()}catch(error){try{const cache=await mediaCache();await cache.delete(syntheticRequest(transfer.record.recordKey))}catch{}resolveTransferWaiter(transfer.expectedHash,error);emit('mesh-receive-error',{recordKey:transfer.record.recordKey,error:error.message})}}
function resolveTransferWaiter(hash,error,value){const waiter=transferWaiters.get(hash);if(!waiter)return;transferWaiters.delete(hash);clearTimeout(waiter.timer);error?waiter.reject(error):waiter.resolve(value)}
function handleBinary(session,data){for(const transfer of incomingTransfers.values()){if(transfer.sessionId!==session.id||!transfer.pendingBinary)continue;const bytes=data instanceof Uint8Array?data:new Uint8Array(data);transfer.pendingBinary=false;transfer.hasher.update(bytes);transfer.received+=bytes.byteLength;transfer.writer.write(bytes).catch(error=>resolveTransferWaiter(transfer.expectedHash,error));return true}return false}
async function handleMediaMessage(session,data){if(typeof data!=='string'){handleBinary(session,data);return}let message;try{message=JSON.parse(data)}catch{return}if(!message?.type?.startsWith?.('cw-media-'))return;if(message.type==='cw-media-manifest'){peerInventory.set(session.peerId||session.id,{sessionId:session.id,at:now(),items:(message.items||[]).filter(item=>item.recordKey&&item.contentHash&&licenseAllowed(item.license))});emit('mesh-manifest',{peerId:session.peerId||session.id,count:message.items?.length||0});return}if(message.type==='cw-media-request'){sendMedia(session,message).catch(error=>sendJson(session.channel,{type:'cw-media-reject',contentHash:message.contentHash,recordKey:message.recordKey,error:error.message}));return}if(message.type==='cw-media-start'){await acceptStart(session,message);return}if(message.type==='cw-media-chunk'){const transfer=incomingTransfers.get(message.transferId);if(transfer&&transfer.sessionId===session.id)transfer.pendingBinary=true;return}if(message.type==='cw-media-end'){await finishTransfer(message.transferId,message);return}if(message.type==='cw-media-reject'){resolveTransferWaiter(message.contentHash,new Error(message.error||'Peer rejected media request'));return}}
function attachSession(session){const channel=session?.channel;if(!channel||attachedChannels.has(channel))return;attachedChannels.add(channel);channel.binaryType='arraybuffer';channel.addEventListener('open',()=>sendManifest(session).catch(()=>{}));channel.addEventListener('message',event=>handleMediaMessage(session,event.data).catch(error=>emit('mesh-protocol-error',{error:error.message})));channel.addEventListener('close',()=>{if(session.peerId)peerInventory.delete(session.peerId)});if(channel.readyState==='open')sendManifest(session).catch(()=>{})}
function scanSessions(){for(const session of sessionEntries())attachSession(session)}
let announceTimer=0;function announceSoon(){clearTimeout(announceTimer);announceTimer=setTimeout(()=>{for(const session of sessionEntries())sendManifest(session).catch(()=>{})},120)}
export async function fetchFromMesh(contentHash,{recordKey:recordKeyValue='',timeoutMs=45000}={}){const existing=await recordByHash(contentHash);if(existing)return existing;let peer=null;for(const manifest of peerInventory.values()){const item=manifest.items?.find?.(entry=>entry.contentHash===contentHash&&(!recordKeyValue||entry.recordKey===recordKeyValue));if(item){peer={...manifest,item};break}}if(!peer)throw new Error('No connected peer advertises this media hash.');const session=sessionEntries().find(entry=>entry.id===peer.sessionId);if(!session?.channel||session.channel.readyState!=='open')throw new Error('Peer media channel is unavailable.');return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{transferWaiters.delete(contentHash);reject(new Error('Peer media transfer timed out.'))},timeoutMs);transferWaiters.set(contentHash,{resolve,reject,timer});sendJson(session.channel,{type:'cw-media-request',contentHash,recordKey:peer.item.recordKey})})}
export async function status(){const rows=await recordsAll(),policy=await storagePolicy(),budget=await effectiveBudgetBytes();let lookup=null;try{lookup=await loadLookup()}catch{};let estimate=null;try{estimate=await navigator.storage?.estimate?.()}catch{}return{revision:REVISION,records:rows.length,bytes:rows.reduce((sum,row)=>sum+(Number(row.bytes)||0),0),budgetBytes:budget,policy,quotaBytes:Number(estimate?.quota)||0,usageBytes:Number(estimate?.usage)||0,catalogBuiltAt:lookup?.built_at||null,catalogFresh:Boolean(lookup&&catalogFresh(lookup)),catalogAgeMs:lookup?catalogAgeMs(lookup):Infinity,meshPeers:peerInventory.size,meshItems:[...peerInventory.values()].reduce((sum,item)=>sum+(item.items?.length||0),0)}}
export function subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener)}
export async function warmup(){if(warmPromise)return warmPromise;warmPromise=(async()=>{try{await Promise.all([loadLookup(),loadHarvestPolicy()])}catch(error){emit('catalog-unavailable',{error:error.message})}try{await openDb()}catch(error){emit('storage-unavailable',{error:error.message})}scanSessions();if(!meshTimer&&typeof setInterval==='function')meshTimer=setInterval(scanSessions,1000);emit('ready',{revision:REVISION,status:await status().catch(()=>null)});return api})();return warmPromise}
export function health(){return status()}
function revokeObjectUrls(){for(const url of objectUrls.values())try{URL.revokeObjectURL(url)}catch{};objectUrls.clear()}
try{globalThis.addEventListener?.('pagehide',revokeObjectUrls,{once:false})}catch{}
const api=Object.freeze({revision:REVISION,LOOKUP_URL,POLICY_URL,CACHE_NAME,DB_NAME,FOCUS_TOPICS,POLICY_PRESETS,licenseAllowed,recordKey,chooseFile,scoreRecord,sha256HexForBytes,loadLookup,loadHarvestPolicy,catalogFresh,storagePolicy,setStoragePolicy,effectiveBudgetBytes,cacheRecord,uncache,clearCache,cachedPlayback,resolveOpenMedia,prefetchTopic,prefetchFocusPack,fetchFromMesh,status,health,subscribe,warmup,bytesLabel});
globalThis.CivweaveOpenLearningMediaCacheV1=api;
if(typeof window!=='undefined'&&typeof document!=='undefined')warmup().catch(error=>emit('startup-error',{error:error.message}));
export default api;
