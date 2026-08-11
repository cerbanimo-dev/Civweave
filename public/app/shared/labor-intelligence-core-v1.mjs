import * as packs from './learning-pack-runtime-v1.mjs?v=learning-packs-v1';
import * as skillCrosswalk from './skill-crosswalk-v1.mjs?v=esco-crosswalk-v1';

const VERSION='1.0.0-labor-intelligence-core-v1';
export const ATLAS_ID='onet-labor-atlas-30-3';
export const CROSSWALK_ID='esco-skill-crosswalk-v1';
const LABOR_HINT=/\b(work|job|labor|worker|shift|gig|hire|occupation|career|trade|technician|operator|installer|repair|maintenance|construction|warehouse|inventory|packing|shipping|delivery|driver|carpentry|fabrication|assembly|care work|cleaning|landscap|food service|cook|baker|electric|plumb|weld|machin|mechanic)\b/i;
let atlasPromise=null;

const clean=(value,max=4000)=>String(value??'').trim().slice(0,max);
const list=value=>Array.isArray(value)?value:[];
const copy=value=>globalThis.structuredClone?globalThis.structuredClone(value):JSON.parse(JSON.stringify(value));

export function isLaborQuery(value){return LABOR_HINT.test(clean(value,12000));}

async function recordStatus(id){
  const [catalog,status]=await Promise.all([packs.catalog(),packs.status()]);
  const record=list(catalog?.packs).find(row=>row.id===id)||null;
  const device=list(status).find(row=>row.id===id)||null;
  return{record,device,available:Boolean(record&&(record.available!==false||record.module)),staged:Boolean(device?.staged),current:Boolean(device?.current)};
}

export async function status(){
  const [atlas,crosswalk]=await Promise.all([recordStatus(ATLAS_ID),skillCrosswalk.status()]);
  return{
    version:VERSION,
    authority:'reference-only',
    lazy:true,
    atlas:{packId:ATLAS_ID,available:atlas.available,staged:atlas.staged,current:atlas.current,bytes:Number(atlas.record?.bytes||atlas.device?.bytes||0)},
    crosswalk:{...crosswalk,packId:CROSSWALK_ID}
  };
}

export async function ensureCrosswalk(){
  const current=await skillCrosswalk.status();
  if(!current.available)return{ok:false,reason:'crosswalk-unavailable',status:current};
  if(!current.staged||!current.current||!current.loaded)await skillCrosswalk.load({stage:true,force:!current.current});
  return{ok:true,status:await skillCrosswalk.status()};
}

export async function ensureAtlas(){
  if(atlasPromise)return atlasPromise;
  atlasPromise=(async()=>{
    const current=await recordStatus(ATLAS_ID);
    if(!current.available)return{ok:false,reason:'atlas-unavailable',status:current};
    if(!current.staged||!current.current)await packs.stage([ATLAS_ID]);
    else await packs.loadPack(ATLAS_ID,{force:false}).catch(async()=>packs.loadPack(ATLAS_ID,{force:true}));
    return{ok:true,status:await recordStatus(ATLAS_ID)};
  })().finally(()=>{atlasPromise=null});
  return atlasPromise;
}

export async function normalizeSkills(skillRefs,options={}){
  const refs=list(skillRefs).filter(Boolean);
  if(!refs.length)return{refs:[],resolved:[],available:false};
  const installed=await ensureCrosswalk().catch(()=>({ok:false}));
  if(!installed.ok)return{refs:[...new Set(refs.map(value=>typeof value==='string'?value:value?.id).filter(Boolean))],resolved:[],available:false};
  const normalized=await skillCrosswalk.normalizeSkillRefs(refs,{stage:false,includeUris:Boolean(options.includeUris),minConfidence:options.minConfidence??.9});
  return{...normalized,available:true};
}

export async function mapOnetOccupation(onetCode,options={}){
  const installed=await ensureCrosswalk().catch(()=>({ok:false}));
  if(!installed.ok)return[];
  return skillCrosswalk.mapOnetOccupation(onetCode,{stage:false,minConfidence:options.minConfidence??.7,includeReview:Boolean(options.includeReview)});
}

export async function searchOccupations(query,{limit=5}={}){
  const text=clean(query,12000);if(!text)return[];
  const atlas=await ensureAtlas().catch(()=>({ok:false}));
  if(!atlas.ok)return[];
  return packs.search(text,{kinds:['labor-reference'],packIds:[ATLAS_ID],limit:Math.max(1,Math.min(12,Number(limit)||5))});
}

function compactOccupation(row,mappings=[]){
  const item=row?.item||{};
  return{
    referenceId:clean(row?.id,180),
    title:clean(row?.title||item.title,300),
    occupationCode:clean(item.occupationCode,80),
    description:clean(item.description,1000),
    score:Number(row?.score)||0,
    essentialSkills:list(item.essentialSkills).slice(0,16).map(skill=>({id:clean(skill.id,160),label:clean(skill.label,240),scale:clean(skill.scale,80),value:Number.isFinite(Number(skill.value))?Number(skill.value):null})),
    taskExamples:list(item.taskStatements).slice(0,6).map(task=>({id:clean(task.id,120),text:clean(task.text,700),dwaRefs:list(task.dwaRefs).slice(0,8)})),
    escoOccupations:list(mappings).slice(0,8).map(mapping=>({id:clean(mapping.to?.id,180),label:clean(mapping.to?.label,300),uri:clean(mapping.to?.uri,1000),relation:clean(mapping.relation,80),confidence:Number(mapping.confidence)||0,status:clean(mapping.status,40)}))
  };
}

export async function enrichWorkContext(query,{skillRefs=[],occupationLimit=3,forceOccupations=false}={}){
  const text=clean(query,12000),normalized=await normalizeSkills(skillRefs).catch(()=>({refs:list(skillRefs),resolved:[],available:false}));
  const useAtlas=Boolean(text&&(forceOccupations||isLaborQuery(text)));
  const matches=useAtlas?await searchOccupations(text,{limit:occupationLimit}).catch(()=>[]):[];
  const occupations=[];
  for(const row of matches){
    const code=clean(row?.item?.occupationCode,80),mappings=code?await mapOnetOccupation(code).catch(()=>[]):[];
    occupations.push(compactOccupation(row,mappings));
  }
  const state=await status().catch(()=>null);
  return{
    schema:'civweave.labor-context.v1',
    authority:'reference-only-no-procedures',
    source:'core-labor-intelligence',
    query:text,
    laborRelevant:useAtlas,
    normalizedSkillRefs:normalized.refs||list(skillRefs),
    skillMappings:list(normalized.resolved).filter(row=>row?.canonical).map(row=>({from:row.id,to:`esco-skill:${row.canonical.id}`,label:row.canonical.label,uri:row.canonical.uri,confidence:row.matches?.[0]?.confidence??null})),
    occupations,
    atlasAvailable:Boolean(state?.atlas?.available),
    crosswalkAvailable:Boolean(state?.crosswalk?.available),
    requiresAdaptation:true,
    note:'O*NET task statements and ESCO mappings are descriptive reference context. They do not create executable work steps or prove qualification.'
  };
}

const api=Object.freeze({version:VERSION,atlasId:ATLAS_ID,crosswalkId:CROSSWALK_ID,isLaborQuery,status,ensureAtlas,ensureCrosswalk,normalizeSkills,mapOnetOccupation,searchOccupations,enrichWorkContext});
try{globalThis.CivweaveLaborIntelligenceCoreV1=api}catch{}
export const version=VERSION;
export default api;
