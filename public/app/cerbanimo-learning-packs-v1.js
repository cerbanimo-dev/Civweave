(()=>{
'use strict';
const VERSION='1.0.0-cerbanimo-learning-packs-v1';
const RUNTIME='/app/shared/learning-pack-runtime-v1.mjs?v=learning-packs-v1';
let runtimePromise=null,readyPromise=null;
const clean=(value,max=1200)=>String(value??'').trim().slice(0,max);
function runtime(){if(!runtimePromise)runtimePromise=import(RUNTIME);return runtimePromise}
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
async function status(){const packs=await runtime();return packs.status()}
async function catalog(){const packs=await runtime();return packs.catalog()}
async function search(query,options={}){const packs=await ready();return packs.search(query,options)}
async function find(itemId,options={}){const packs=await ready();return packs.findItem(itemId,options)}
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
async function laborTaskDraft(referenceId,taskId,options={}){
  const packs=await ready(),found=packs.findItem(referenceId,{packId:options.packId||'',kind:'labor-reference'});
  if(!found)throw new Error(`Labor reference ${clean(referenceId,180)} is not loaded.`);
  return packs.laborTaskDraft(found.item,taskId,{packId:found.packId});
}
globalThis.CivweaveCerbanimoLearningPacksV1=Object.freeze({version:VERSION,ready,catalog,status,stage,search,find,templateToQuest,createQuest,laborTaskDraft});
queueMicrotask(()=>ready().catch(error=>console.warn('[Cerbanimo learning packs]',error)));
})();
