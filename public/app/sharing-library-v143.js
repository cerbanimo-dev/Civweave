(()=>{
'use strict';
const PLATFORM_KEY='civweave.platform-settings.v143';
const REALM_STORE_KEY='civweave.realm-console.v140';
const LIBRARY_CACHE_KEY='civweave.learning-library.cache.v143';
const parse=(value,fallback)=>{try{const parsed=JSON.parse(value);return parsed==null?fallback:parsed}catch{return fallback}};
const clean=(value,max=8000)=>String(value??'').trim().slice(0,max);
function platform(){return{sharedNode:'',shareLearningLibrary:true,...parse(localStorage.getItem(PLATFORM_KEY),{})}}
function mesh(){return globalThis.CivweaveLocalMeshV146}
function status(message){const output=document.querySelector('#cw143-realm-surface [data-cw143-status]');if(output)output.textContent=message}
function localLearnings(){const records=parse(localStorage.getItem(REALM_STORE_KEY),{records:{}}).records||{},rows=[];for(const id of['living-school.generate-curriculum','living-school.start-path','living-school.create-practicum'])for(const record of records[id]||[]){const data=record.data||{};rows.push({id:record.id,title:clean(data.title||data.topic||record.label||'Untitled learning',160),description:clean(data.objective||data.topic||data.work||data.assessment||'Generated on this device.',500),content:clean(data.sources||data.milestones||data.proof||'',4000),updatedAt:record.updatedAt||record.createdAt||new Date().toISOString()})}return rows}
async function localSharedItems(){const runtime=mesh();if(!runtime)return[];const objects=await runtime.listObjects();return objects.filter(item=>item.kind==='learning-library.record').map(item=>({...item.payload,communityObjectId:item.id,revisionHash:item.revisionHash,sharedAt:item.createdAt,sourceNode:item.origin?.nodeId}))}
async function refresh(){
  const p=platform(),runtime=mesh();
  if(!p.shareLearningLibrary)return status('Shared learning-library access is disabled in Civweave settings.');
  status('Reading the local learning-object library…');
  let transportMessage='Local library loaded.';
  if(runtime&&p.sharedNode){try{const result=await runtime.syncGateway(p.sharedNode);transportMessage=`Gateway exchange: ${result.sent} sent, ${result.received} received.`}catch(error){transportMessage=`Gateway unavailable; local library remains active: ${error.message}`}}
  const items=await localSharedItems();
  localStorage.setItem(LIBRARY_CACHE_KEY,JSON.stringify({items,refreshedAt:new Date().toISOString(),node:p.sharedNode||'local-device'}));
  globalThis.CivweaveCabinetSurfacesV143?.render?.();
  status(`${items.length} local/shared learning record${items.length===1?'':'s'} loaded. ${transportMessage}`);
}
async function publish(id){
  const p=platform(),runtime=mesh(),item=localLearnings().find(row=>row.id===id);
  if(!item)return status('That local learning record could not be found.');
  if(!p.shareLearningLibrary)return status('Publishing is disabled in Civweave settings.');
  if(!runtime)return status('The local community-object runtime is unavailable. Reload the installed device package.');
  status(`Signing and queuing “${item.title}” on this device…`);
  try{
    const object=await runtime.createObject({id:`learning:${item.id}`,kind:'learning-library.record',purpose:'Share a learning resource with the Civweave learning library.',consent:'federated',audience:['*'],payload:item,publish:true});
    let delivery='Queued locally. It will remain available for peer, companion, or gateway delivery.';
    if(p.sharedNode){try{const result=await runtime.syncGateway(p.sharedNode);delivery=`Queued locally; gateway exchange sent ${result.sent} and received ${result.received}.`}catch(error){delivery=`Queued locally. Gateway delivery will retry later: ${error.message}`}}
    status(`Learning object ${object.id} created. ${delivery}`);
    await refresh();
  }catch(error){status(`Local publication failed before anything left the device: ${error.message}`)}
}
document.addEventListener('click',event=>{const refreshButton=event.target.closest('[data-refresh-library]');if(refreshButton){event.preventDefault();event.stopImmediatePropagation();refresh();return}const publishButton=event.target.closest('[data-publish-learning]');if(publishButton){event.preventDefault();event.stopImmediatePropagation();publish(publishButton.dataset.publishLearning)}},true);
navigator.serviceWorker?.addEventListener?.('message',event=>{if(event.data?.type==='CIVWEAVE_OUTBOX_SYNC_REQUESTED'){const p=platform();if(p.sharedNode)mesh()?.syncGateway?.(p.sharedNode).catch(()=>{})}});
globalThis.CivweaveSharingLibraryV143={refresh,publish,localSharedItems};
})();