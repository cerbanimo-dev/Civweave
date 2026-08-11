(()=>{
'use strict';
const VERSION='1.3.1-cerbanimo-learning-packs-v1-lazy-boot';
const RUNTIME='/app/shared/learning-pack-runtime-v1.mjs?v=learning-packs-v1';
const RESOLVER='/app/shared/learning-pack-resolver-v1.mjs?v=learning-packs-v1';
const SHELF='/app/shared/learning-pack-shelf-v1.mjs?v=learning-pack-shelf-v1';
const SHELF_CSS='/app/shared/learning-pack-shelf-v1.css?v=learning-pack-shelf-v1';
const CROSSWALK='/app/shared/skill-crosswalk-v1.mjs?v=esco-crosswalk-v1';
let runtimePromise=null,resolverPromise=null,shelfPromise=null,crosswalkPromise=null,readyPromise=null,shelfUi=null,shelfOpenPromise=null;
const clean=(value,max=1200)=>String(value??'').trim().slice(0,max);
function runtime(){if(!runtimePromise)runtimePromise=import(RUNTIME);return runtimePromise}
function resolver(){if(!resolverPromise)resolverPromise=import(RESOLVER);return resolverPromise}
function shelf(){if(!shelfPromise)shelfPromise=import(SHELF);return shelfPromise}
function crosswalk(){if(!crosswalkPromise)crosswalkPromise=import(CROSSWALK);return crosswalkPromise}
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
async function skillCrosswalkStatus(){const bridge=await crosswalk();return bridge.status()}
async function installSkillCrosswalk(){const bridge=await crosswalk();return bridge.install()}
async function removeSkillCrosswalk(){const bridge=await crosswalk();return bridge.remove()}
async function normalizeSkills(skillRefs,options={}){const bridge=await crosswalk();return bridge.normalizeSkillRefs(skillRefs,{includeUris:false,...options})}
async function mapOnetOccupation(onetCode,options={}){const bridge=await crosswalk();return bridge.mapOnetOccupation(onetCode,options)}
async function enrichPackMetadata(input){
  const skillRefs=input?.packMetadata?.skillRefs||[];if(!skillRefs.length)return input;
  try{
    const bridge=await crosswalk(),normalized=await bridge.normalizeSkillRefs(skillRefs,{stage:false,includeUris:false}),accepted=normalized.resolved.filter(row=>row.canonical);
    if(!accepted.length)return input;
    input.packMetadata={...input.packMetadata,normalizedSkillRefs:normalized.refs,skillCrosswalk:accepted.map(row=>({from:row.id,to:`esco-skill:${row.canonical.id}`,uri:row.canonical.uri,label:row.canonical.label,confidence:row.matches?.[0]?.confidence??null}))};
  }catch(error){console.warn('[Cerbanimo skill crosswalk]',error)}
  return input;
}
async function templateToQuest(templateId,overrides={}){
  const packs=await ready(),input=await enrichPackMetadata(packs.compileTaskTemplate(templateId,overrides));
  if(input.packMetadata?.requiresAdaptation&&!overrides.allowReferenceDraft)throw new Error('This labor reference must be adapted into a reviewed task template before Cerbanimo can create executable work from it.');
  if(!input.steps?.length)throw new Error('This reference does not contain executable work steps. Adapt it through an expert pack first.');
  return input;
}
async function createQuest(templateId,overrides={}){
  const input=await templateToQuest(templateId,overrides),engine=globalThis.CivweaveCerbanimoQuestV144;
  if(!engine?.createQuestFromInput||!engine?.addQuest)throw new Error('Cerbanimo quest engine is unavailable.');
  const quest=engine.createQuestFromInput(input),result=engine.addQuest(quest,{activate:overrides.activate!==false});
  if(result?.ok===false)throw new Error(result.error||'Cerbanimo could not add the learning-pack quest.');
  try{dispatchEvent(new CustomEvent('civweave:cerbanimo-learning-pack-quest-created',{detail:{packTemplateId:templateId,questId:quest.id,title:quest.title,skillRefs:input.packMetadata?.skillRefs||[],normalizedSkillRefs:input.packMetadata?.normalizedSkillRefs||input.packMetadata?.skillRefs||[]}}))}catch{}
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
  const draft=packs.laborTaskDraft(found.item,taskId,{packId:found.packId}),occupationMappings=found.item?.occupationCode?await mapOnetOccupation(found.item.occupationCode,{stage:false}).catch(()=>[]):[];
  return{...draft,occupationMappings};
}
async function openShelf(){
  if(shelfUi){await shelfUi.open?.();return shelfUi}
  if(!shelfOpenPromise)shelfOpenPromise=(async()=>{
    const ui=await shelf();
    shelfUi=ui.mountLearningPackShelf({audience:'cerbanimo',adapter:api});
    document.querySelector('[data-cw-cerbanimo-pack-launcher]')?.remove();
    await shelfUi.open?.();
    return shelfUi;
  })().catch(error=>{shelfOpenPromise=null;throw error});
  return shelfOpenPromise;
}
function installLazyLauncher(){
  if(typeof document==='undefined'||document.querySelector('[data-cw-cerbanimo-pack-launcher]')||document.querySelector('.cw-pack-shelf-launcher'))return;
  if(!document.querySelector(`link[href^="${SHELF_CSS.split('?')[0]}"]`)){const link=document.createElement('link');link.rel='stylesheet';link.href=SHELF_CSS;document.head.append(link)}
  const launcher=document.createElement('button');launcher.type='button';launcher.className='cw-pack-shelf-launcher';launcher.dataset.cwCerbanimoPackLauncher='';launcher.textContent='Learning packs';launcher.setAttribute('aria-haspopup','dialog');launcher.addEventListener('click',async()=>{launcher.disabled=true;try{await openShelf()}catch(error){console.warn('[Cerbanimo learning packs]',error);launcher.disabled=false}});document.body.append(launcher);
}
const api=Object.freeze({version:VERSION,ready,catalog,status,stage,remove,search,find,recommendPacks,resolve,skillCrosswalkStatus,installSkillCrosswalk,removeSkillCrosswalk,normalizeSkills,mapOnetOccupation,templateToQuest,createQuest,createRecommendedQuest,laborTaskDraft,openShelf});
globalThis.CivweaveCerbanimoLearningPacksV1=api;
if(typeof document!=='undefined'){document.readyState==='loading'?addEventListener('DOMContentLoaded',installLazyLauncher,{once:true}):installLazyLauncher()}
})();
