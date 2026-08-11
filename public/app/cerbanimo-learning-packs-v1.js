(()=>{
'use strict';
const VERSION='1.4.0-cerbanimo-learning-packs-v1-core-labor';
const RUNTIME='/app/shared/learning-pack-runtime-v1.mjs?v=learning-packs-v1';
const RESOLVER='/app/shared/learning-pack-resolver-v1.mjs?v=learning-packs-v1';
const SHELF='/app/shared/learning-pack-shelf-v1.mjs?v=learning-pack-shelf-v1';
const SHELF_CSS='/app/shared/learning-pack-shelf-v1.css?v=learning-pack-shelf-v1';
const LABOR='/app/shared/labor-intelligence-core-v1.mjs?v=core-labor-v1';
let runtimePromise=null,resolverPromise=null,shelfPromise=null,laborPromise=null,readyPromise=null,shelfUi=null,shelfOpenPromise=null;
const clean=(value,max=1200)=>String(value??'').trim().slice(0,max);
function runtime(){if(!runtimePromise)runtimePromise=import(RUNTIME);return runtimePromise}
function resolver(){if(!resolverPromise)resolverPromise=import(RESOLVER);return resolverPromise}
function shelf(){if(!shelfPromise)shelfPromise=import(SHELF);return shelfPromise}
function labor(){if(!laborPromise)laborPromise=import(LABOR);return laborPromise}
async function ready(){
  if(!readyPromise)readyPromise=(async()=>{const packs=await runtime(),ids=await packs.bootstrapCore();try{dispatchEvent(new CustomEvent('civweave:cerbanimo-learning-packs-ready',{detail:{version:VERSION,packIds:ids}}))}catch{}return packs})().catch(error=>{readyPromise=null;throw error});
  return readyPromise;
}
async function stage(packIds,options={}){return(await runtime()).stage(packIds,options)}
async function remove(packIds){return(await runtime()).remove(packIds)}
async function status(){return(await runtime()).status()}
async function catalog(){return(await runtime()).catalog()}
async function search(query,options={}){return(await ready()).search(query,options)}
async function find(itemId,options={}){return(await ready()).findItem(itemId,options)}
async function recommendPacks(query,options={}){return(await resolver()).recommendPacks(query,{...options,audience:'cerbanimo'})}
async function resolve(query,options={}){return(await resolver()).resolve(query,{packLimit:2,resultLimit:20,...options,audience:'cerbanimo'})}
async function skillCrosswalkStatus(){return(await labor()).status()}
async function installSkillCrosswalk(){return(await labor()).ensureCrosswalk()}
async function removeSkillCrosswalk(){const bridge=await import('/app/shared/skill-crosswalk-v1.mjs?v=esco-crosswalk-v1');return bridge.remove()}
async function normalizeSkills(skillRefs,options={}){return(await labor()).normalizeSkills(skillRefs,options)}
async function mapOnetOccupation(onetCode,options={}){return(await labor()).mapOnetOccupation(onetCode,options)}
async function enrichPackMetadata(input,query=''){
  const skillRefs=input?.packMetadata?.skillRefs||[];
  try{
    const bridge=await labor(),text=clean(query||[input?.title,input?.objective,input?.description].filter(Boolean).join(' '),6000),context=await bridge.enrichWorkContext(text,{skillRefs,occupationLimit:3});
    input.packMetadata={...input.packMetadata,normalizedSkillRefs:context.normalizedSkillRefs?.length?context.normalizedSkillRefs:skillRefs,laborContext:context};
    if(context.skillMappings?.length)input.packMetadata.skillCrosswalk=context.skillMappings;
  }catch(error){console.warn('[Cerbanimo core labor intelligence]',error)}
  return input;
}
async function templateToQuest(templateId,overrides={}){
  const packs=await ready(),raw=packs.compileTaskTemplate(templateId,overrides),input=await enrichPackMetadata(raw,overrides.query||'');
  if(input.packMetadata?.requiresAdaptation&&!overrides.allowReferenceDraft)throw new Error('This labor reference must be adapted into a reviewed task template before Cerbanimo can create executable work from it.');
  if(!input.steps?.length)throw new Error('This reference does not contain executable work steps. Adapt it through an expert pack first.');
  return input;
}
async function createQuest(templateId,overrides={}){
  const input=await templateToQuest(templateId,overrides),engine=globalThis.CivweaveCerbanimoQuestV144;
  if(!engine?.createQuestFromInput||!engine?.addQuest)throw new Error('Cerbanimo quest engine is unavailable.');
  const quest=engine.createQuestFromInput(input),result=engine.addQuest(quest,{activate:overrides.activate!==false});
  if(result?.ok===false)throw new Error(result.error||'Cerbanimo could not add the learning-pack quest.');
  try{dispatchEvent(new CustomEvent('civweave:cerbanimo-learning-pack-quest-created',{detail:{packTemplateId:templateId,questId:quest.id,title:quest.title,skillRefs:input.packMetadata?.skillRefs||[],normalizedSkillRefs:input.packMetadata?.normalizedSkillRefs||input.packMetadata?.skillRefs||[],occupationRefs:(input.packMetadata?.laborContext?.occupations||[]).map(row=>row.occupationCode)}}))}catch{}
  return{ok:true,quest:result?.quest||quest,input};
}
async function createRecommendedQuest(query,overrides={}){
  const resolution=await resolve(query,{kinds:['task-template'],includeLaborReferences:false,packLimit:Number(overrides.packLimit||2)}),match=resolution.results.find(row=>row.kind==='task-template');
  if(!match)throw new Error(`No executable learning-pack task template matched “${clean(query,300)}”.`);
  const created=await createQuest(match.id,{...overrides,packId:match.packId,query});
  return{...created,resolution,match};
}
async function laborTaskDraft(referenceId,taskId,options={}){
  const packs=await ready(),bridge=await labor();await bridge.ensureAtlas();
  const found=packs.findItem(referenceId,{packId:options.packId||bridge.ATLAS_ID||'onet-labor-atlas-30-3',kind:'labor-reference'});
  if(!found)throw new Error(`Labor reference ${clean(referenceId,180)} is not loaded.`);
  const draft=packs.laborTaskDraft(found.item,taskId,{packId:found.packId}),occupationMappings=found.item?.occupationCode?await bridge.mapOnetOccupation(found.item.occupationCode).catch(()=>[]):[];
  return{...draft,occupationMappings,laborContext:{authority:'reference-only-no-procedures',requiresAdaptation:true,occupationCode:found.item?.occupationCode||'',occupationMappings}};
}
async function openShelf(){
  if(shelfUi){await shelfUi.open?.();return shelfUi}
  if(!shelfOpenPromise)shelfOpenPromise=(async()=>{const ui=await shelf();shelfUi=ui.mountLearningPackShelf({audience:'cerbanimo',adapter:api});document.querySelector('[data-cw-cerbanimo-pack-launcher]')?.remove();await shelfUi.open?.();return shelfUi})().catch(error=>{shelfOpenPromise=null;throw error});
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
