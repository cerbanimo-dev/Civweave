(()=>{
'use strict';
const VERSION='1.0.0-gemma4-opfs-storage-v1';
const GENERATIVE_CACHE='civweave-model-generative-v266';
const OPFS_ROOT='civweave-models-v1';
const WORKER_SRC='/app/local-ai/browser-pack-import-worker-v2.js?v=2.0.0-opfs';
const BRIDGE_SRC='/app/local-ai/browser-pack-download-v1.js?v=1.3.1-worker-import';
const MODELS=Object.freeze({
  'gemma-4-E2B-it-web.litertlm':Object.freeze({id:'gemma4-e2b-it-litert-web',minBytes:2_000_000_000,label:'Gemma 4 E2B LiteRT'}),
  'gemma-4-E4B-it-web.litertlm':Object.freeze({id:'gemma4-e4b-it-litert-web',minBytes:2_950_000_000,label:'Gemma 4 E4B LiteRT'})
});
if(globalThis.CivweaveGemma4OPFSStorageV1?.version===VERSION)return;
const parse=(value,fallback={})=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const now=()=>new Date().toISOString();
const basename=value=>{try{return decodeURIComponent(String(value||'').split('/').pop()||'model-file')}catch{return String(value||'').split('/').pop()||'model-file'}};
const normalizeFilename=name=>String(name||'').replace(/\s*\(\d+\)(?=\.[^.]+$|$)/,'').replace(/\s+-\s+copy(?=\.[^.]+$|$)/i,'');
const safePart=(value,max=180)=>{const input=String(value??'').split('/').pop()||'model-file';return input.replace(/[^A-Za-z0-9._-]+/g,'_').replace(/^\.+/,'_').slice(0,max)||'model-file'};
const infoForPath=path=>MODELS[basename(path)]||null;
const recordInfo=record=>infoForPath(record?.path||record?.basename||record?.url||'');
const bridge=()=>globalThis.CivweaveBrowserPackDownloadV1;
let bridgePromise=null,installedBridge=null,cacheFacadeInstalled=false;

async function opfsModelDir(modelId,{create=false}={}){
  if(!navigator.storage?.getDirectory)throw new Error('Origin-private file storage is unavailable in this browser.');
  const root=await navigator.storage.getDirectory(),store=await root.getDirectoryHandle(OPFS_ROOT,{create});
  return store.getDirectoryHandle(safePart(modelId),{create});
}
async function opfsFile(modelId,path,{create=false}={}){const dir=await opfsModelDir(modelId,{create});return dir.getFileHandle(safePart(path),{create})}
async function opfsStatus(modelId,path,minBytes=0){
  try{const handle=await opfsFile(modelId,path),file=await handle.getFile(),bytes=Number(file.size||0);return{ok:(!minBytes||bytes>=Number(minBytes)*.97),bytes,file,handle,backend:'opfs'}}catch{return{ok:false,bytes:0,file:null,handle:null,backend:'opfs'}}
}
async function removeOpfs(modelId,path=''){
  try{const dir=await opfsModelDir(modelId);if(path){await dir.removeEntry(safePart(path));return true}const root=await navigator.storage.getDirectory(),store=await root.getDirectoryHandle(OPFS_ROOT);await store.removeEntry(safePart(modelId),{recursive:true});return true}catch{return false}
}
function requestInfo(request){
  try{const url=new URL(typeof request==='string'?request:request?.url,location.href),name=basename(url.pathname),info=MODELS[name];return info?{...info,name,url}:null}catch{return null}
}
async function opfsResponse(info){
  const state=await opfsStatus(info.id,info.name,info.minBytes);if(!state.ok||!state.file)return null;
  return new Response(state.file.stream(),{status:200,headers:{'content-type':'application/octet-stream','content-length':String(state.bytes),'x-civweave-storage':'opfs','x-civweave-model-id':info.id}})
}
function wrapCache(cache){
  return new Proxy(cache,{get(target,prop){
    if(prop==='match')return async(request,options)=>{const info=requestInfo(request);if(info){const response=await opfsResponse(info);if(response)return response}return target.match(request,options)};
    if(prop==='delete')return async(request,options)=>{const info=requestInfo(request);let removed=false;if(info)removed=await removeOpfs(info.id,info.name);const cached=await target.delete(request,options).catch(()=>false);return removed||cached};
    if(prop==='put')return async(request,response)=>{const info=requestInfo(request);if(info)throw new Error(`${info.label} uses origin-private file storage. Import the browser-downloaded .litertlm file instead of writing it to Cache Storage.`);return target.put(request,response)};
    const value=Reflect.get(target,prop,target);return typeof value==='function'?value.bind(target):value;
  }});
}
function installCacheFacade(){
  if(cacheFacadeInstalled)return true;
  const proto=globalThis.CacheStorage?.prototype;if(!proto?.open)return false;
  if(proto.open?.__civweaveGemma4Opfs===VERSION){cacheFacadeInstalled=true;return true}
  const nativeOpen=proto.open;
  const wrapped=function(name){return Promise.resolve(nativeOpen.call(this,name)).then(cache=>String(name)===GENERATIVE_CACHE?wrapCache(cache):cache)};
  Object.defineProperty(wrapped,'__civweaveGemma4Opfs',{value:VERSION});
  try{Object.defineProperty(proto,'open',{configurable:true,writable:true,value:wrapped})}catch{try{proto.open=wrapped}catch{return false}}
  cacheFacadeInstalled=true;return true;
}
function selectedLiteRTMatches(files,records){
  const remaining=[...(records||[])].filter(record=>recordInfo(record)),matches=[],used=new Set();
  for(const record of remaining){
    const target=normalizeFilename(record.basename||basename(record.path));let best=-1;
    for(let index=0;index<files.length;index++){
      if(used.has(index))continue;const file=files[index];if(normalizeFilename(file.name)!==target)continue;
      const exact=Number(record.sizeBytes||record.exactBytes||record.expectedBytes||0),min=Number(record.minBytes||0),bytes=Number(file.size||0);if(min&&bytes<min*.97)continue;if(exact&&Math.abs(bytes-exact)/Math.max(1,exact)>.12)continue;best=index;break;
    }
    if(best>=0){used.add(best);matches.push({record,file:files[best],fileIndex:best})}
  }
  return{matches,otherFiles:files.filter((_,index)=>!used.has(index))};
}
function workerImport(record,file,onProgress){
  return new Promise((resolve,reject)=>{
    if(typeof Worker!=='function'){reject(new Error('Dedicated workers are unavailable for large-model import.'));return}
    const id=`opfs-${Date.now()}-${Math.random().toString(36).slice(2)}`,info=recordInfo(record);if(!info){reject(new Error('This is not a supported LiteRT OPFS record.'));return}
    let worker,settled=false;const finish=(fn,value)=>{if(settled)return;settled=true;try{worker?.terminate()}catch{}fn(value)};
    try{worker=new Worker(WORKER_SRC,{name:'civweave-gemma4-opfs-import'})}catch(error){finish(reject,error);return}
    worker.addEventListener('message',event=>{const packet=event.data||{};if(packet.id!==id)return;if(packet.type==='progress'){try{onProgress?.(Number(packet.copied||0),Number(packet.total||file.size||0),Boolean(packet.force))}catch{};return}if(packet.type==='done'){finish(resolve,packet);return}if(packet.type==='error')finish(reject,new Error(packet.message||'Origin-private model import failed.'))});
    worker.addEventListener('error',event=>finish(reject,new Error(event?.message||'Origin-private model import worker failed.')),{once:true});
    try{worker.postMessage({type:'CIVWEAVE_BROWSER_PACK_IMPORT_FILE_V2',id,storageBackend:'opfs',componentId:record.componentId||info.id,modelId:info.id,path:record.path||record.basename||info.name,basename:record.basename||info.name,minBytes:Number(record.minBytes||info.minBytes||0),file})}catch(error){finish(reject,error)}
  });
}
function saveReceipt(base,packId,receipt){
  const key=base.pendingKey||'civweave.ai-pack.browser-downloads.v1',map=parse(localStorage.getItem(key),{});map[packId]=receipt;localStorage.setItem(key,JSON.stringify(map));return base.pending?.(packId)||receipt;
}
function savePackState(base,packId,patch){
  const key=base.packStateKey||'civweave.local-ai.packs.v1',map=parse(localStorage.getItem(key),{}),previous=map[packId]||{},next={...previous,...patch,downloadMode:'browser',storageBackend:'opfs+cache',error:'',updatedAt:now()};map[packId]=next;localStorage.setItem(key,JSON.stringify(map));try{dispatchEvent(new CustomEvent('civweave:local-model-pack-progress',{detail:{version:VERSION,id:packId,state:{...next}}}))}catch{}return next
}
async function cachedRecord(record){
  const info=recordInfo(record);if(info)return(await opfsStatus(info.id,record.path||record.basename||info.name,record.minBytes||info.minBytes)).ok;
  const cacheName=record.kind==='specialized'?'civweave-specialized-model-packs-v1':GENERATIVE_CACHE,cache=await caches.open(cacheName),response=await cache.match(record.url);if(!response?.ok)return false;const bytes=Number(response.headers.get('content-length')||0);return !bytes||bytes>=Number(record.minBytes||0)*.97;
}
async function fetchSmall(record){
  if(await cachedRecord(record))return true;const response=await fetch(record.url,{cache:'no-store',redirect:'follow'});if(!response.ok)throw new Error(`${record.label} · ${record.path} returned HTTP ${response.status}.`);const type=String(response.headers.get('content-type')||'').toLowerCase();if(type.includes('text/html'))throw new Error(`${record.label} · ${record.path} returned HTML instead of model data.`);const declared=Number(response.headers.get('content-length')||0);if(declared&&declared<Number(record.minBytes||0)*.97)throw new Error(`${record.label} · ${record.path} was incomplete.`);if(/\.json$/i.test(record.path)){try{JSON.parse(await response.clone().text())}catch{throw new Error(`${record.label} · ${record.path} was not valid JSON.`)}}const cache=await caches.open(record.kind==='specialized'?'civweave-specialized-model-packs-v1':GENERATIVE_CACHE);await cache.put(record.url,response);return true
}
async function finalizePack(base,packId,receipt,{onProgress}={}){
  const packs=globalThis.CivweaveLocalModelPacksV1,pack=packs?.byId?.(packId);if(!pack)throw new Error('AI pack catalogue is unavailable while finalizing the import.');
  const all=base.recordsFor(pack),small=all.filter(record=>!record.large);
  for(let index=0;index<small.length;index++){try{onProgress?.({pack,phase:'finishing-small',completed:index+1,total:small.length,record:small[index],percent:99,message:`Large files imported · finishing support files ${index+1}/${small.length}`})}catch{}await fetchSmall(small[index])}
  const incomplete=[];for(const record of all)if(!(await cachedRecord(record)))incomplete.push(record);if(incomplete.length)throw new Error(`${incomplete.length} pack file${incomplete.length===1?' is':'s are'} still missing after import: ${incomplete.slice(0,2).map(row=>`${row.label} · ${row.basename}`).join('; ')}.`);
  const installedBytes=all.reduce((sum,row)=>sum+Number(row.expectedBytes||row.sizeBytes||row.minBytes||0),0),completed=saveReceipt(base,packId,{...receipt,startedKeys:[],completed:true,completedAt:now()});
  const state=savePackState(base,packId,{status:'ready',phase:'ready',percent:100,browserExpectedFiles:completed.large?.length||0,browserStartedFiles:0,browserImportedFiles:completed.importedKeys?.length||0,browserRemainingToStart:0,browserRemainingFiles:0,browserLargeBytes:Number(completed.largeBytes||0),completedBytes:installedBytes||pack.estimatedBytes,totalBytes:installedBytes||pack.estimatedBytes,installedBytes:installedBytes||pack.estimatedBytes,installedAt:now(),errorCode:''});
  try{dispatchEvent(new CustomEvent('civweave:local-model-pack-installed',{detail:{version:VERSION,id:pack.id,label:pack.label,source:'browser-import-opfs'}}))}catch{}try{onProgress?.({pack,phase:'ready',completed:all.length,total:all.length,state,percent:100,message:`${pack.label} is installed in Civweave local storage.`})}catch{}return{pack,receipt:completed,state,partial:false,available:true,installedBytes,importedTotal:completed.importedKeys?.length||0,storageBackend:'opfs+cache'}
}
async function importFilesOpfs(base,packId,files,{onProgress}={}){
  let receipt=base.pending?.(packId);if(!receipt?.large?.length)return base.importFiles(packId,files,{onProgress});const selected=[...(files||[])];if(!selected.length)return{cancelled:true,packId};
  const imported=new Set(receipt.importedKeys||[]),remaining=receipt.large.filter(row=>!imported.has(row.key)),{matches,otherFiles}=selectedLiteRTMatches(selected,remaining);if(!matches.length)return base.importFiles(packId,selected,{onProgress});
  let importedNow=0,byteSizes={...(receipt.importedByteSizes||{})};
  for(const match of matches){const completedBefore=imported.size,totalFiles=receipt.large.length;await workerImport(match.record,match.file,(currentBytes,currentTotal)=>{const fraction=currentTotal?Math.max(0,Math.min(1,currentBytes/currentTotal)):0,overall=Math.max(0,Math.min(99,Math.floor((completedBefore+fraction)/Math.max(1,totalFiles)*100)));try{onProgress?.({phase:'copying-large',completed:completedBefore,total:totalFiles,record:match.record,currentBytes,currentTotal,percent:overall,storageBackend:'opfs',message:`Importing ${match.record.label} · ${match.record.basename} · ${Math.floor(fraction*100)}% · OPFS`})}catch{}});imported.add(match.record.key);importedNow+=1;byteSizes[match.record.key]=Number(match.file.size||match.record.expectedBytes||0);receipt=saveReceipt(base,packId,{...receipt,importedKeys:[...imported],startedKeys:(receipt.startedKeys||[]).filter(key=>key!==match.record.key),importedByteSizes:byteSizes,lastImportedAt:now(),lastImportedKey:match.record.key,storageBackend:'opfs+cache'});try{onProgress?.({phase:'importing-large',completed:imported.size,total:receipt.large.length,record:match.record,percent:Math.floor(imported.size/Math.max(1,receipt.large.length)*100),storageBackend:'opfs',message:`Imported ${match.record.label} into origin-private model storage.`})}catch{}}
  if(otherFiles.length)return base.importFiles(packId,otherFiles,{onProgress});
  const missing=base.unimportedRecords?.(receipt)||[];
  if(missing.length){const percent=Math.floor(imported.size/Math.max(1,receipt.large.length)*100),state=savePackState(base,packId,{status:'browser-partial',phase:'waiting-for-browser-downloads',percent,browserExpectedFiles:receipt.large.length,browserStartedFiles:receipt.startedKeys?.length||0,browserImportedFiles:imported.size,browserRemainingFiles:missing.length,browserLargeBytes:Number(receipt.largeBytes||0),completedBytes:Object.values(byteSizes).reduce((sum,value)=>sum+Number(value||0),0),totalBytes:Number(receipt.largeBytes||0),errorCode:''});return{packId,receipt,state,partial:true,available:false,importedNow,importedTotal:imported.size,missing,unused:[],storageBackend:'opfs+cache'}}
  return finalizePack(base,packId,receipt,{onProgress});
}
function wrapBridge(base){
  if(!base?.importFiles)return null;if(base.__civweaveGemma4Opfs===VERSION)return base;const wrapped=Object.freeze({...base,version:'1.3.2-browser-pack-opfs-overlay',importFiles:(packId,files,options)=>importFilesOpfs(base,packId,files,options||{}),opfsLiteRT:true,opfsRoot:OPFS_ROOT,importWorkerSrc:WORKER_SRC,__civweaveGemma4Opfs:VERSION});
  try{globalThis.CivweaveBrowserPackDownloadV1=wrapped;installedBridge=wrapped;return wrapped}catch{return null}
}
function ensureBridge(){
  installCacheFacade();const current=bridge();if(current?.__civweaveGemma4Opfs===VERSION)return Promise.resolve(current);if(current?.importFiles)return Promise.resolve(wrapBridge(current));if(bridgePromise)return bridgePromise;
  bridgePromise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=BRIDGE_SRC;script.async=false;script.dataset.civweaveGemma4OpfsBaseBridge='';script.onload=()=>{const wrapped=wrapBridge(bridge());wrapped?resolve(wrapped):reject(new Error('The browser-pack bridge loaded without its import API.'))};script.onerror=()=>reject(new Error('The browser-pack bridge could not load.'));document.head?.append(script)}).finally(()=>{bridgePromise=null});return bridgePromise
}
function install(){installCacheFacade();void ensureBridge().catch(()=>null);return true}
install();
for(const name of ['civweave:model-settings-opened','civweave:settings-local-route-ready','civweave:gemma4-litert-fast-extension-ready'])addEventListener(name,()=>{if(globalThis.CivweaveModelSettingsControllerV173?.gemma4PassivePreload===false)void ensureBridge().catch(()=>null)});
globalThis.CivweaveGemma4OPFSStorageV1=Object.freeze({version:VERSION,root:OPFS_ROOT,workerSrc:WORKER_SRC,ensureBridge,installCacheFacade,opfsStatus,removeOpfs,modelIds:Object.freeze(Object.values(MODELS).map(row=>row.id)),cacheFacade:true,opfsLargeModels:true,settingsPassive:true,cacheStorageLargePutBlocked:true});
})();
