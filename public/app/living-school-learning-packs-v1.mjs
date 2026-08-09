import * as packs from './shared/learning-pack-runtime-v1.mjs?v=learning-packs-v1';

const VERSION='1.0.0-living-school-learning-packs-v1';
let readyPromise=null;
const clean=(value,max=1200)=>String(value??'').trim().slice(0,max);

async function ready(){
  if(!readyPromise)readyPromise=(async()=>{
    const ids=await packs.bootstrapCore();
    try{dispatchEvent(new CustomEvent('civweave:living-school-learning-packs-ready',{detail:{version:VERSION,packIds:ids}}))}catch{}
    return ids;
  })().catch(error=>{readyPromise=null;throw error});
  return readyPromise;
}
export async function catalog(){return packs.catalog()}
export async function status(){return packs.status()}
export async function stage(packIds,options={}){return packs.stage(packIds,options)}
export async function search(query,options={}){await ready();return packs.search(query,options)}
export async function find(itemId,options={}){await ready();return packs.findItem(itemId,options)}
export async function curriculumInput(learningUnitId,overrides={}){await ready();return packs.compileLearningUnit(learningUnitId,overrides)}
export async function generateCurriculum(learningUnitId,overrides={}){
  const input=await curriculumInput(learningUnitId,overrides),workbench=globalThis.LivingSchoolCleanroomV218;
  if(!workbench?.generateCurriculumFromChat)throw new Error('Living School curriculum workbench is unavailable.');
  const result=await workbench.generateCurriculumFromChat(input);
  try{dispatchEvent(new CustomEvent('civweave:living-school-pack-curriculum-generated',{detail:{learningUnitId:clean(learningUnitId,180),schoolId:result?.school?.id||'',title:result?.school?.title||input.title,skillRefs:input.packMetadata?.skillRefs||[]}}))}catch{}
  return{...result,packInput:input};
}
const api=Object.freeze({version:VERSION,ready,catalog,status,stage,search,find,curriculumInput,generateCurriculum});
globalThis.CivweaveLivingSchoolLearningPacksV1=api;
queueMicrotask(()=>ready().catch(error=>console.warn('[Living School learning packs]',error)));
export default api;
