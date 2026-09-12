const VERSION='knowledge-library-tiers-v1.0';
const MANIFEST_URL='/downloads/knowledge-schools/tiers.json';
const CACHE_NAME='cwknowledge-library-tiers-v1';
const RECEIPT_KEY='civweave.knowledge-library-tiers.v1';
const MAX_PACK_BYTES=24*1024*1024;
let manifestPromise=null;
const catalogPromises=new Map();

const clean=(value,max=6000)=>String(value??'').trim().slice(0,max);
const unique=values=>[...new Set((values||[]).map(value=>clean(value,180)).filter(Boolean))];
const absolute=value=>new URL(value,location.origin).href;
const hex=bytes=>Array.from(new Uint8Array(bytes),value=>value.toString(16).padStart(2,'0')).join('');
const humanBytes=value=>{const units=['B','KiB','MiB','GiB'];let amount=Number(value)||0,index=0;while(amount>=1024&&index<units.length-1){amount/=1024;index++}return`${amount.toFixed(index?2:0)} ${units[index]}`};
function assertStorage(){if(!('caches'in globalThis))throw new Error('This browser cannot save optional knowledge-library packs offline.');if(!globalThis.crypto?.subtle)throw new Error('This browser cannot verify knowledge-library pack checksums.');}
function readReceipt(){try{const value=JSON.parse(localStorage.getItem(RECEIPT_KEY)||'{}');return value?.schema==='civweave.knowledge-library-tier-receipt.v1'?value:{schema:'civweave.knowledge-library-tier-receipt.v1',packs:{}}}catch{return{schema:'civweave.knowledge-library-tier-receipt.v1',packs:{}}}}
function writeReceipt(receipt){try{localStorage.setItem(RECEIPT_KEY,JSON.stringify({...receipt,schema:'civweave.knowledge-library-tier-receipt.v1',updatedAt:new Date().toISOString()}))}catch{}}
async function sha256(buffer){return hex(await crypto.subtle.digest('SHA-256',buffer))}
async function fetchJson(url,{refresh=false}={}){const response=await fetch(url,{cache:refresh?'reload':'no-store'});if(!response.ok)throw new Error(`${new URL(url,location.origin).pathname} returned ${response.status}.`);return response.json()}

export async function loadTierManifest({refresh=false}={}){
  if(refresh)manifestPromise=null;
  if(manifestPromise)return manifestPromise;
  manifestPromise=fetchJson(MANIFEST_URL,{refresh}).then(value=>{if(value?.schema!=='civweave.knowledge-library-tiers.v1'||!Array.isArray(value.layers))throw new Error('Knowledge-library tier manifest is incompatible.');return value}).catch(error=>{manifestPromise=null;throw error});
  return manifestPromise;
}
export async function layerRecord(layer){const manifest=await loadTierManifest();return manifest.layers.find(record=>record.slug===layer)||null}
export async function loadLayerCatalog(layer,{refresh=false}={}){
  const record=await layerRecord(layer);if(!record)throw new Error(`Unknown knowledge-library layer: ${layer}`);
  if(layer==='foundation')throw new Error('Foundation uses the existing Knowledge Schools catalog.');
  if(record.availability!=='ready')return null;
  if(refresh)catalogPromises.delete(layer);
  if(catalogPromises.has(layer))return catalogPromises.get(layer);
  const promise=fetchJson(record.catalog_url,{refresh}).then(value=>{if(value?.schema!=='civweave.knowledge-layer-catalog.v1'||value.layer!==layer||!Array.isArray(value.schools))throw new Error(`${record.name} catalog is incompatible.`);return value}).catch(error=>{catalogPromises.delete(layer);throw error});
  catalogPromises.set(layer,promise);return promise;
}
function packUrl(pack,catalog){const direct=clean(pack.download_url,2400);if(direct)return absolute(direct);const base=clean(catalog?.base_url,2400)||new URL('.',absolute(catalog?.catalog_url||location.href)).href;return new URL(clean(pack.zip_file,1200),base).href}
function packId(layer,school,pack,index){return clean(pack.pack_id,320)||`${layer}:${school.school_slug}:${String(index+1).padStart(3,'0')}`}
function normalizedPacks(layer,school,catalog){const packs=Array.isArray(school.packs)?school.packs:[];return packs.map((pack,index)=>({...pack,pack_id:packId(layer,school,pack,index),url:packUrl(pack,catalog),school_slug:school.school_slug,school_name:school.school_name,layer}))}
function cachedCurrent(response,pack,receipt){if(!response)return false;const expectedBytes=Number(pack.zip_bytes||0),expectedSha=clean(pack.zip_sha256,128).toLowerCase();const bytes=Number(response.headers.get('content-length')||receipt?.zip_bytes||0),sha=clean(response.headers.get('x-civweave-sha256')||receipt?.zip_sha256,128).toLowerCase();return Boolean(expectedBytes&&expectedSha&&bytes===expectedBytes&&sha===expectedSha)}
async function packStatus(pack,cache,receipt){const response=await cache.match(pack.url),saved=receipt.packs?.[pack.pack_id]||{};return{...pack,staged:Boolean(response),current:cachedCurrent(response,pack,saved),needs_update:Boolean(response)&&!cachedCurrent(response,pack,saved),staged_at:saved.staged_at||null}}
export async function layerStatus(layer){
  assertStorage();const catalog=await loadLayerCatalog(layer);if(!catalog)return{layer,ready:false,schools:[]};
  const cache=await caches.open(CACHE_NAME),receipt=readReceipt(),schools=[];
  for(const school of catalog.schools){const packs=normalizedPacks(layer,school,catalog),states=[];for(const pack of packs)states.push(await packStatus(pack,cache,receipt));schools.push({layer,school_slug:school.school_slug,school_name:school.school_name,article_count:Number(school.article_count||0),pack_count:packs.length,zip_bytes:packs.reduce((sum,pack)=>sum+Number(pack.zip_bytes||0),0),current:packs.length>0&&states.every(pack=>pack.current),staged:states.some(pack=>pack.staged),packs:states})}
  return{layer,ready:true,catalog,schools};
}
export async function allLayerStatus(){const manifest=await loadTierManifest(),out=[];for(const record of manifest.layers.filter(item=>item.slug!=='foundation')){try{out.push(await layerStatus(record.slug))}catch(error){out.push({layer:record.slug,ready:false,schools:[],error:error?.message||String(error)})}}return out}

export async function stageLayerSchools(layer,slugs,{onProgress}={}){
  assertStorage();const catalog=await loadLayerCatalog(layer);if(!catalog)throw new Error(`${layer} knowledge is not materialized in this release yet.`);
  const selected=new Set(unique(slugs)),schools=catalog.schools.filter(school=>selected.has(school.school_slug));if(!schools.length)throw new Error('Select at least one knowledge school.');
  const packs=schools.flatMap(school=>normalizedPacks(layer,school,catalog));for(const pack of packs){if(Number(pack.zip_bytes||0)>MAX_PACK_BYTES)throw new Error(`${pack.pack_id} exceeds the 24 MiB optional-asset boundary.`)}
  const cache=await caches.open(CACHE_NAME),receipt=readReceipt();let completed=0,completedBytes=0;const totalBytes=packs.reduce((sum,pack)=>sum+Number(pack.zip_bytes||0),0);
  for(const pack of packs){const saved=receipt.packs?.[pack.pack_id]||{},existing=await cache.match(pack.url);if(cachedCurrent(existing,pack,saved)){completed++;completedBytes+=Number(pack.zip_bytes||0);onProgress?.({phase:'cached',layer,pack,completed,total:packs.length,completedBytes,totalBytes});continue}
    onProgress?.({phase:'fetching',layer,pack,completed,total:packs.length,completedBytes,totalBytes});const response=await fetch(pack.url,{cache:'no-store'});if(!response.ok)throw new Error(`${pack.school_name} ${layer} pack download failed (${response.status}).`);const buffer=await response.arrayBuffer();if(buffer.byteLength!==Number(pack.zip_bytes))throw new Error(`${pack.pack_id} size mismatch.`);onProgress?.({phase:'verifying',layer,pack,completed,total:packs.length,completedBytes,totalBytes});const digest=await sha256(buffer);if(digest!==clean(pack.zip_sha256,128).toLowerCase())throw new Error(`${pack.pack_id} checksum mismatch.`);const stored=new Response(buffer,{headers:{'Content-Type':'application/zip','Content-Length':String(buffer.byteLength),'X-Civweave-SHA256':digest,'X-Civweave-Knowledge-Layer':layer,'X-Civweave-School':pack.school_slug,'X-Civweave-Pack':pack.pack_id}});await cache.put(pack.url,stored);receipt.packs[pack.pack_id]={staged_at:new Date().toISOString(),zip_sha256:digest,zip_bytes:buffer.byteLength,url:pack.url,layer,school_slug:pack.school_slug};writeReceipt(receipt);completed++;completedBytes+=buffer.byteLength;onProgress?.({phase:'stored',layer,pack,completed,total:packs.length,completedBytes,totalBytes});
  }
  try{await navigator.storage?.persist?.()}catch{}
  return layerStatus(layer)
}
export async function stageCumulative(layer,slugs,{onProgress}={}){
  const selected=unique(slugs),record=await layerRecord(layer);if(!record)throw new Error(`Unknown knowledge-library layer: ${layer}`);
  if(record.dependencies?.includes('foundation')){const foundation=globalThis.CivweaveKnowledgeSchools;if(!foundation?.stage)throw new Error('Foundation Knowledge Schools runtime is unavailable.');await foundation.stage(selected,{onProgress:progress=>onProgress?.({...progress,layer:'foundation'})})}
  if(layer==='deep'){const expanded=await layerRecord('expanded');if(expanded?.availability==='ready')await stageLayerSchools('expanded',selected,{onProgress});else throw new Error('Deep knowledge requires the Expanded layer, which is not materialized in this release yet.')}
  if(layer!=='foundation')return stageLayerSchools(layer,selected,{onProgress});
  return globalThis.CivweaveKnowledgeSchools.status()
}
export async function removeLayerSchools(layer,slugs){const catalog=await loadLayerCatalog(layer);if(!catalog)return layerStatus(layer);const selected=new Set(unique(slugs)),cache=await caches.open(CACHE_NAME),receipt=readReceipt();for(const school of catalog.schools.filter(record=>selected.has(record.school_slug)))for(const pack of normalizedPacks(layer,school,catalog)){await cache.delete(pack.url);delete receipt.packs[pack.pack_id]}writeReceipt(receipt);return layerStatus(layer)}

function routingScore(pack,tokens){const terms=new Set((pack.routing_terms||[]).map(value=>clean(value,80).toLowerCase()));if(!terms.size)return 0;return unique(tokens).reduce((score,token)=>score+(terms.has(String(token).toLowerCase())?1:0),0)}
export async function openSchoolPacks(layer,schoolSlug,{tokens=[],maxPacks=3}={}){
  const catalog=await loadLayerCatalog(layer);if(!catalog)return[];const school=catalog.schools.find(record=>record.school_slug===schoolSlug);if(!school)return[];const cache=await caches.open(CACHE_NAME),receipt=readReceipt();let packs=normalizedPacks(layer,school,catalog);const tokenList=unique(tokens);if(tokenList.length&&packs.some(pack=>Array.isArray(pack.routing_terms)&&pack.routing_terms.length))packs=packs.map(pack=>({pack,score:routingScore(pack,tokenList)})).sort((a,b)=>b.score-a.score).filter((row,index)=>row.score>0||index<Math.min(2,maxPacks)).slice(0,maxPacks).map(row=>row.pack);else packs=packs.slice(0,maxPacks);const out=[];for(const pack of packs){const response=await cache.match(pack.url),saved=receipt.packs?.[pack.pack_id]||{};if(cachedCurrent(response,pack,saved))out.push({layer,school,pack,response})}return out}
export function formatTierBytes(value){return humanBytes(value)}
export const version=VERSION;
