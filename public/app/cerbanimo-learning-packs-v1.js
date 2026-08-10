(()=>{
'use strict';
const VERSION='1.2.0-cerbanimo-learning-packs-v1';
const RUNTIME='/app/shared/learning-pack-runtime-v1.mjs?v=learning-packs-v1';
const RESOLVER='/app/shared/learning-pack-resolver-v1.mjs?v=learning-packs-v1';
const SHELF='/app/shared/learning-pack-shelf-v1.mjs?v=learning-pack-shelf-v1';
let runtimePromise=null,resolverPromise=null,shelfPromise=null,readyPromise=null;
const clean=(value,max=1200)=>String(value??'').trim().slice(0,max);
function runtime(){if(!runtimePromise)runtimePromise=import(RUNTIME);return runtimePromise}
function resolver(){if(!resolverPromise)resolverPromise=import(RESOLVER);return resolverPromise}
function shelf(){if(!shelfPromise)shelfPromise=import(SHELF);return shelfPromise}
async function ready(){
  if(!readyPromise)readyPromise=(async()=>{
    const packs=await runtime();
    const ids=await packs.bootstrapCore();
    try{dispatchEvent(new CustomEvent('civweave:cerbanimo-learning-packs-ready',{detail:{version:VERSION,packIds:ids}}))}catch{}
    return packs;
  })().catch(error=>{readyPromise=null;throw error});
  return readyPromise;
}
async function stage(packIds,options={}){const packs=await runtime();return packs.stage(packIds,options)}
async function remove(packIds){const packs=await runtime();return packs.remove(packIds)}
async function status(){const packs=await runtime();return packs.status()}
async function catalog(){const packs=await runtime();return packs.catalog()}
async function search(query,options={}){const packs=await ready();return packs.search(query,options)}
async function find(itemId,options={}){const packs=await ready();return packs.findItem(itemId,options)}
async function recommendPacks(query,options={}){const picker=await resolver();return picker.recommendPacks(query,{...options,audience:'cerbanimo'})}
async function resolve(query,options={}){const picker=await resolver();return picker.resolve(query,{packLimit:2,resultLimit:20,...options,audience:'cerbanimo'})}
async function templateToQuest(templateId,overrides={}){
  const packs=await ready(),input=packs.compileTaskTemplate(templateId,overrides);
  if(input.packMetadata?.requiresAdaptation&&!overrides.allowReferenceDraft)throw new Error('This labor reference must be adapted into a reviewed task template before Cerbanimo can create executable work from it.');
  if(!input.steps?.length)throw new Error('This reference does not contain executable work steps. Adapt it through an expert pack first.');
  return input;
}
async function createQuest(templateId,overrides={}){
  const input=await templateToQuest(templateId,overrides),engine=globalThis.CivweaveCerbanimoQuestV144;
  if(!engine?.createQuestFromInput||!engine?.addQuest)throw new Error('Cerbanimo quest engine is unavailable.');
  const quest=engine.createQuestFromInput(input),result=engine.addQuest(quest,{activate:overrides.activate!==false});
  if(result?.ok===false)throw new Error(result.error||'Cerbanimo could not add the learning-pack quest.');
  try{dispatchEvent(new CustomEvent('civweave:cerbanimo-learning-pack-quest-created',{detail:{packTemplateId:templateId,questId:quest.id,title:quest.title,skillRefs:input.packMetadata?.skillRefs||[]}}))}catch{}
  return{ok:true,quest:result?.quest||quest,input};
}
async function createRecommendedQuest(query,overrides={}){
  const resolution=await resolve(query,{kinds:['task-template'],includeLaborReferences:false,packLimit:Number(overrides.packLimit||2)});
  const match=resolution.results.find(row=>row.kind==='task-template');
  if(!match)throw new Error(`No executable learning-pack task template matched “${clean(query,300)}”.`);
  const created=await createQuest(match.id,{...overrides,packId:match.packId});
  return{...created,resolution,match};
}
async function laborTaskDraft(referenceId,taskId,options={}){
  const packs=await ready(),found=packs.findItem(referenceId,{packId:options.packId||'',kind:'labor-reference'});
  if(!found)throw new Error(`Labor reference ${clean(referenceId,180)} is not loaded.`);
  return packs.laborTaskDraft(found.item,taskId,{packId:found.packId});
}
const api=Object.freeze({version:VERSION,ready,catalog,status,stage,remove,search,find,recommendPacks,resolve,templateToQuest,createQuest,createRecommendedQuest,laborTaskDraft});
globalThis.CivweaveCerbanimoLearningPacksV1=api;
queueMicrotask(()=>ready().then(async()=>{const ui=await shelf();ui.mountLearningPackShelf({audience:'cerbanimo',adapter:api})}).catch(error=>console.warn('[Cerbanimo learning packs]',error)));
})();
