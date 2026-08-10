import * as packs from './shared/learning-pack-runtime-v1.mjs?v=learning-packs-v1';
import * as resolver from './shared/learning-pack-resolver-v1.mjs?v=learning-packs-v1';
import * as skillCrosswalk from './shared/skill-crosswalk-v1.mjs?v=esco-crosswalk-v1';
import {mountLearningPackShelf} from './shared/learning-pack-shelf-v1.mjs?v=learning-pack-shelf-v1';

const VERSION='1.3.0-living-school-learning-packs-v1';
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
export async function remove(packIds){return packs.remove(packIds)}
export async function search(query,options={}){await ready();return packs.search(query,options)}
export async function find(itemId,options={}){await ready();return packs.findItem(itemId,options)}
export async function recommendPacks(query,options={}){return resolver.recommendPacks(query,{...options,audience:'living-school'})}
export async function resolve(query,options={}){return resolver.resolve(query,{packLimit:2,resultLimit:20,...options,audience:'living-school'})}
export async function skillCrosswalkStatus(){return skillCrosswalk.status()}
export async function installSkillCrosswalk(){return skillCrosswalk.install()}
export async function removeSkillCrosswalk(){return skillCrosswalk.remove()}
export async function normalizeSkills(skillRefs,options={}){return skillCrosswalk.normalizeSkillRefs(skillRefs,{includeUris:false,...options})}
export async function mapOnetOccupation(onetCode,options={}){return skillCrosswalk.mapOnetOccupation(onetCode,options)}
async function enrichPackMetadata(input){
  const skillRefs=input?.packMetadata?.skillRefs||[];if(!skillRefs.length)return input;
  try{
    const normalized=await skillCrosswalk.normalizeSkillRefs(skillRefs,{stage:false,includeUris:false}),accepted=normalized.resolved.filter(row=>row.canonical);
    if(!accepted.length)return input;
    input.packMetadata={...input.packMetadata,normalizedSkillRefs:normalized.refs,skillCrosswalk:accepted.map(row=>({from:row.id,to:`esco-skill:${row.canonical.id}`,uri:row.canonical.uri,label:row.canonical.label,confidence:row.matches?.[0]?.confidence??null}))};
  }catch(error){console.warn('[Living School skill crosswalk]',error)}
  return input;
}
export async function curriculumInput(learningUnitId,overrides={}){await ready();return enrichPackMetadata(packs.compileLearningUnit(learningUnitId,overrides))}
export async function generateCurriculum(learningUnitId,overrides={}){
  const input=await curriculumInput(learningUnitId,overrides),workbench=globalThis.LivingSchoolCleanroomV218;
  if(!workbench?.generateCurriculumFromChat)throw new Error('Living School curriculum workbench is unavailable.');
  const result=await workbench.generateCurriculumFromChat(input);
  try{dispatchEvent(new CustomEvent('civweave:living-school-pack-curriculum-generated',{detail:{learningUnitId:clean(learningUnitId,180),schoolId:result?.school?.id||'',title:result?.school?.title||input.title,skillRefs:input.packMetadata?.skillRefs||[],normalizedSkillRefs:input.packMetadata?.normalizedSkillRefs||input.packMetadata?.skillRefs||[]}}))}catch{}
  return{...result,packInput:input};
}
export async function generateRecommendedCurriculum(query,overrides={}){
  const resolution=await resolve(query,{kinds:['learning-unit'],includeLaborReferences:false,packLimit:Number(overrides.packLimit||2)});
  const match=resolution.results.find(row=>row.kind==='learning-unit');
  if(!match)throw new Error(`No learning-pack curriculum unit matched “${clean(query,300)}”.`);
  const generated=await generateCurriculum(match.id,{...overrides,packId:match.packId});
  return{...generated,resolution,match};
}
const api=Object.freeze({version:VERSION,ready,catalog,status,stage,remove,search,find,recommendPacks,resolve,skillCrosswalkStatus,installSkillCrosswalk,removeSkillCrosswalk,normalizeSkills,mapOnetOccupation,curriculumInput,generateCurriculum,generateRecommendedCurriculum});
globalThis.CivweaveLivingSchoolLearningPacksV1=api;
queueMicrotask(()=>ready().then(()=>mountLearningPackShelf({audience:'living-school',adapter:api})).catch(error=>console.warn('[Living School learning packs]',error)));
export default api;
