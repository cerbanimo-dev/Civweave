const VERSION='knowledge-library-upstream-v1.0';
const INDEX_URL='/downloads/knowledge-schools/upstream/v1/index.json';
const DB_NAME='civweave-living-library-upstream-v1';
const DB_VERSION=1;
const ARTICLE_STORE='articles';
const CATALOG_STORE='catalog';
const API_BASE='https://en.wikipedia.org/w/rest.php/v1';
const API_USER_AGENT='CivweaveLivingLibrary/1.0 (https://civweave.cc)';
const REQUEST_GAP_MS=250;
let indexPromise=null;
let dbPromise=null;
let lastRequestAt=0;

const clean=(value,max=10000000)=>String(value??'').trim().slice(0,max);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const keyFor=(layer,school,title)=>`${clean(layer,40)}|${clean(school,180)}|${clean(title,500).toLocaleLowerCase('en-US')}`;
const canonicalUrl=title=>`https://en.wikipedia.org/wiki/${encodeURIComponent(clean(title,500).replaceAll(' ','_')).replaceAll('%2F','/')}`;
const requestUrl=title=>`${API_BASE}/page/${encodeURIComponent(clean(title,500).replaceAll(' ','_'))}/with_html`;

function assertIdb(){if(!('indexedDB'in globalThis))throw new Error('This browser cannot store the larger Living Library locally.');}
function requestValue(request){return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error('IndexedDB request failed.'))})}
function transactionDone(transaction){return new Promise((resolve,reject)=>{transaction.oncomplete=resolve;transaction.onabort=()=>reject(transaction.error||new Error('IndexedDB transaction aborted.'));transaction.onerror=()=>reject(transaction.error||new Error('IndexedDB transaction failed.'))})}
function openDb(){
  assertIdb();
  if(dbPromise)return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,DB_VERSION);
    request.onupgradeneeded=()=>{
      const db=request.result;
      for(const name of [ARTICLE_STORE,CATALOG_STORE]){
        const store=db.objectStoreNames.contains(name)?request.transaction.objectStore(name):db.createObjectStore(name,{keyPath:'key'});
        if(!store.indexNames.contains('layer'))store.createIndex('layer','layer',{unique:false});
        if(!store.indexNames.contains('school'))store.createIndex('school','school_slug',{unique:false});
        if(!store.indexNames.contains('layerSchool'))store.createIndex('layerSchool',['layer','school_slug'],{unique:false});
        if(!store.indexNames.contains('title'))store.createIndex('title','title',{unique:false});
      }
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>{dbPromise=null;reject(request.error||new Error('Could not open Living Library storage.'))};
  });
  return dbPromise;
}

async function fetchJson(url,{refresh=false}={}){const response=await fetch(url,{cache:refresh?'reload':'no-store'});if(!response.ok)throw new Error(`${new URL(url,location.origin).pathname} returned ${response.status}.`);return response.json()}
export async function loadIndex({refresh=false}={}){
  if(refresh)indexPromise=null;
  if(indexPromise)return indexPromise;
  indexPromise=fetchJson(INDEX_URL,{refresh}).then(value=>{if(value?.schema!=='civweave.knowledge-upstream-index.v1'||!Array.isArray(value.layers))throw new Error('Living Library upstream index is incompatible.');return value}).catch(error=>{indexPromise=null;throw error});
  return indexPromise;
}
export async function layerRecord(layer){return (await loadIndex()).layers.find(record=>record.slug===layer)||null}
export async function schoolRecord(layer,schoolSlug){return (await layerRecord(layer))?.schools?.find(record=>record.school_slug===schoolSlug)||null}
export async function loadSchoolManifest(layer,schoolSlug,{refresh=false}={}){const record=await schoolRecord(layer,schoolSlug);if(!record)throw new Error(`Unknown ${layer} Knowledge School: ${schoolSlug}`);const value=await fetchJson(record.manifest_url,{refresh});if(value?.schema!=='civweave.knowledge-upstream-school.v1'||value.layer!==layer||value.school_slug!==schoolSlug||!Array.isArray(value.articles))throw new Error(`${record.school_name} ${layer} manifest is incompatible.`);return value}

function readableText(html){
  if(typeof DOMParser!=='function')return clean(html,8_000_000).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  const doc=new DOMParser().parseFromString(clean(html,8_000_000),'text/html');
  doc.querySelectorAll('script,style,noscript,template,sup.reference,.mw-editsection,.mw-references-wrap,ol.references,.navbox,.vertical-navbox,.metadata,.ambox').forEach(node=>node.remove());
  const blocks=[...doc.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,dt,dd,blockquote,pre,figcaption')].map(node=>clean(node.textContent,100000)).filter(Boolean);
  const text=blocks.join('\n\n').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  return text||clean(doc.body?.textContent,8_000_000).replace(/\s+/g,' ').trim();
}
function licenseFrom(payload){const license=payload?.license;return clean(typeof license==='string'?license:license?.title||license?.name||license?.url,500)}
function revisionFrom(payload){return clean(payload?.latest?.id||payload?.latest?.timestamp||payload?.revision||payload?.version,200)}
async function politeFetch(title,signal){
  const gap=Math.max(0,REQUEST_GAP_MS-(Date.now()-lastRequestAt));if(gap)await sleep(gap);
  let lastError=null;
  for(let attempt=0;attempt<4;attempt++){
    if(signal?.aborted)throw new DOMException('Living Library download cancelled.','AbortError');
    lastRequestAt=Date.now();
    try{
      const response=await fetch(requestUrl(title),{cache:'no-store',redirect:'follow',signal,headers:{Accept:'application/json','Api-User-Agent':API_USER_AGENT}});
      if(response.status===429||response.status>=500){const retry=Math.min(15000,Number(response.headers.get('retry-after')||0)*1000||1000*(attempt+1));lastError=new Error(`Wikimedia returned ${response.status}.`);await sleep(retry);continue}
      if(!response.ok)throw new Error(`Wikimedia returned ${response.status} for ${title}.`);
      return response.json();
    }catch(error){if(error?.name==='AbortError')throw error;lastError=error;if(attempt<3)await sleep(750*(attempt+1))}
  }
  throw lastError||new Error(`Could not download ${title} from Wikimedia.`);
}
async function existing(key){const db=await openDb(),tx=db.transaction(CATALOG_STORE,'readonly');return requestValue(tx.objectStore(CATALOG_STORE).get(key))}
async function storeArticle(record){const db=await openDb(),tx=db.transaction([ARTICLE_STORE,CATALOG_STORE],'readwrite');tx.objectStore(ARTICLE_STORE).put(record);tx.objectStore(CATALOG_STORE).put({key:record.key,layer:record.layer,school_slug:record.school_slug,school_name:record.school_name,title:record.title,canonical_url:record.canonical_url,revision:record.revision,license:record.license,downloaded_at:record.downloaded_at,bytes:record.bytes,snippet:record.snippet});await transactionDone(tx)}

export async function downloadSchool(layer,schoolSlug,{onProgress,signal}={}){
  const manifest=await loadSchoolManifest(layer,schoolSlug),total=manifest.articles.length;let completed=0,stored=0,cached=0,failed=0,bytes=0;
  for(const item of manifest.articles){
    const title=clean(item.title,500),key=keyFor(layer,schoolSlug,title),prior=await existing(key);
    if(prior){completed++;cached++;bytes+=Number(prior.bytes||0);onProgress?.({phase:'cached',layer,school:manifest,title,completed,total,stored,cached,failed,bytes});continue}
    onProgress?.({phase:'fetching',layer,school:manifest,title,completed,total,stored,cached,failed,bytes,provider:'Wikimedia'});
    try{
      const payload=await politeFetch(title,signal),resolvedTitle=clean(payload?.title||title,500),text=readableText(payload?.html||''),canonical=clean(item.canonical_url,2000)||canonicalUrl(resolvedTitle);
      if(!text)throw new Error(`Wikimedia returned no readable article text for ${title}.`);
      const record={key,layer,school_slug:schoolSlug,school_name:manifest.school_name,title:resolvedTitle,canonical_url:canonical,text,snippet:text.slice(0,700),revision:revisionFrom(payload),license:licenseFrom(payload),source:'Wikimedia · English Wikipedia',source_api:API_BASE,downloaded_at:new Date().toISOString(),bytes:new Blob([text]).size};
      await storeArticle(record);stored++;bytes+=record.bytes;
    }catch(error){if(error?.name==='AbortError')throw error;failed++;console.warn('[Living Library Wikimedia]',title,error)}
    completed++;onProgress?.({phase:'stored',layer,school:manifest,title,completed,total,stored,cached,failed,bytes});
  }
  try{await navigator.storage?.persist?.()}catch{}
  return{layer,school_slug:schoolSlug,total,completed,stored,cached,failed,bytes,complete:failed===0&&completed===total};
}
export async function downloadCumulative(layer,schoolSlug,options={}){
  if(layer==='deep')await downloadSchool('expanded',schoolSlug,{...options,onProgress:progress=>options.onProgress?.({...progress,dependency:'expanded'})});
  return downloadSchool(layer,schoolSlug,options);
}

async function countFor(layer,schoolSlug){const db=await openDb(),tx=db.transaction(CATALOG_STORE,'readonly'),index=tx.objectStore(CATALOG_STORE).index('layerSchool');return requestValue(index.count(IDBKeyRange.only([layer,schoolSlug])))}
export async function schoolStatus(layer,schoolSlug){const record=await schoolRecord(layer,schoolSlug);if(!record)return null;const downloaded=await countFor(layer,schoolSlug);return{...record,layer,downloaded,current:downloaded===Number(record.article_count||0)&&downloaded>0,partial:downloaded>0&&downloaded<Number(record.article_count||0)}}
export async function layerStatus(layer){const record=await layerRecord(layer);if(!record)return{layer,ready:false,schools:[]};const schools=[];for(const school of record.schools||[])schools.push(await schoolStatus(layer,school.school_slug));return{layer,ready:true,delivery:'direct-upstream-cache',article_count:Number(record.article_count||0),schools}}
export async function allLayerStatus(){const index=await loadIndex(),out=[];for(const layer of index.layers||[])out.push(await layerStatus(layer.slug));return out}

async function rowsFromStore(storeName,{layer='all',school='all',includeText=false}={}){
  const db=await openDb(),tx=db.transaction(storeName,'readonly'),store=tx.objectStore(storeName),rows=[];
  let source=store,range=null;
  if(layer!=='all'&&school!=='all'){source=store.index('layerSchool');range=IDBKeyRange.only([layer,school])}
  else if(layer!=='all'){source=store.index('layer');range=IDBKeyRange.only(layer)}
  else if(school!=='all'){source=store.index('school');range=IDBKeyRange.only(school)}
  await new Promise((resolve,reject)=>{const request=source.openCursor(range);request.onerror=()=>reject(request.error);request.onsuccess=()=>{const cursor=request.result;if(!cursor)return resolve();const value=cursor.value;rows.push(includeText?value:{...value,text:undefined});cursor.continue()}});
  return rows;
}
export async function listDownloaded({layer='all',school='all'}={}){const rows=await rowsFromStore(CATALOG_STORE,{layer,school});return rows.sort((a,b)=>a.title.localeCompare(b.title,undefined,{sensitivity:'base'}))}
export async function getArticle(key){const db=await openDb(),tx=db.transaction(ARTICLE_STORE,'readonly');return requestValue(tx.objectStore(ARTICLE_STORE).get(key))}

function tokensFor(query){return [...new Set(clean(query,1800).toLocaleLowerCase('en-US').split(/[^\p{L}\p{N}]+/u).filter(token=>token.length>1))]}
function excerpt(text,tokens){const lower=text.toLocaleLowerCase('en-US'),positions=tokens.map(token=>lower.indexOf(token)).filter(pos=>pos>=0),at=positions.length?Math.min(...positions):0,start=Math.max(0,at-220),end=Math.min(text.length,start+900);return`${start?'…':''}${text.slice(start,end).trim()}${end<text.length?'…':''}`}
export async function searchDownloaded(query,{layer='all',school='all',limit=100}={}){
  const tokens=tokensFor(query);if(!tokens.length)return[];const rows=await rowsFromStore(ARTICLE_STORE,{layer,school,includeText:true}),matches=[];
  for(const row of rows){const title=clean(row.title,500).toLocaleLowerCase('en-US'),text=clean(row.text).toLocaleLowerCase('en-US');let score=0,ok=true;for(const token of tokens){const titleHit=title.includes(token),textHit=text.includes(token);if(!titleHit&&!textHit){ok=false;break}score+=titleHit?12:2}if(!ok)continue;matches.push({...row,score,notes:excerpt(row.text,tokens)});}
  return matches.sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title)).slice(0,Math.max(1,Number(limit)||100));
}

async function deleteRange(store,layer,schoolSlug){const index=store.index('layerSchool'),range=IDBKeyRange.only([layer,schoolSlug]);await new Promise((resolve,reject)=>{const request=index.openKeyCursor(range);request.onerror=()=>reject(request.error);request.onsuccess=()=>{const cursor=request.result;if(!cursor)return resolve();store.delete(cursor.primaryKey);cursor.continue()}})}
export async function removeSchool(layer,schoolSlug){const db=await openDb(),tx=db.transaction([ARTICLE_STORE,CATALOG_STORE],'readwrite');await deleteRange(tx.objectStore(ARTICLE_STORE),layer,schoolSlug);await deleteRange(tx.objectStore(CATALOG_STORE),layer,schoolSlug);await transactionDone(tx);return schoolStatus(layer,schoolSlug)}
export async function removeLayer(layer){const record=await layerRecord(layer);if(!record)return;for(const school of record.schools||[])await removeSchool(layer,school.school_slug)}

export const version=VERSION;
export const indexUrl=INDEX_URL;
export const provider='Wikimedia';
