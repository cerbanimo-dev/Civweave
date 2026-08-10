import * as packs from './learning-pack-runtime-v1.mjs?v=learning-packs-v1';

const VERSION='1.2.0-learning-pack-resolver-v1';
const clean=(value,max=4000)=>String(value??'').trim().slice(0,max);
const list=value=>Array.isArray(value)?value:[];
const EXPANSIONS={
  bug:['software','debugging','defect'],defect:['software','debugging'],error:['software','debugging','support'],code:['software','programming'],coding:['software','programming'],feature:['software','product'],api:['software','integration'],deploy:['software','release'],release:['software','project'],
  ui:['design','visual','responsive'],ux:['design','interaction'],image:['design','visual','media'],icon:['design','visual'],poster:['design','visual','media'],layout:['design','visual'],screen:['design','ui'],responsive:['design','ui'],
  research:['research','sources'],source:['research','citations'],sources:['research','citations'],citation:['research','writing'],write:['research','writing'],writing:['research'],brief:['research','writing'],taxonomy:['research','knowledge'],
  workflow:['operations','process'],sop:['operations','workflow'],schedule:['operations','scheduling'],meeting:['operations','scheduling'],procure:['operations','procurement'],vendor:['operations','procurement'],record:['operations','records'],handoff:['operations','project'],
  spreadsheet:['data','analysis','csv'],csv:['data','analysis'],metric:['data','analytics'],dashboard:['data','analytics'],analytics:['data','analysis'],dataset:['data','analysis'],anomaly:['data','analysis'],
  customer:['service','support'],support:['service'],ticket:['service','support'],onboard:['service','onboarding'],onboarding:['service'],feedback:['service','community'],faq:['service','support'],community:['service'],
  learn:['learning','education'],learning:['learning','education'],lesson:['learning','education'],quiz:['learning','assessment'],rubric:['learning','assessment'],course:['learning','curriculum'],curriculum:['learning','education'],teach:['learning','instruction'],assessment:['learning'],
  project:['project','planning'],backlog:['project','product'],dependency:['project','planning'],decision:['project'],milestone:['project','planning'],roadmap:['project','product'],retrospective:['project'],
  warehouse:['labor','logistics','inventory'],inventory:['labor','logistics'],ship:['labor','logistics','packing'],shipping:['labor','logistics','packing'],pack:['labor','logistics'],receiving:['labor','inventory'],assembly:['labor','workplace'],shift:['labor','handoff'],workplace:['labor','safety'],safety:['labor','safety']
};
const tokens=value=>{
  const base=clean(value).toLowerCase().replace(/[^a-z0-9]+/g,' ').split(/\s+/).filter(word=>word.length>2),expanded=[];
  for(const token of base){expanded.push(token,...(EXPANSIONS[token]||[]))}
  return[...new Set(expanded)].slice(0,80);
};
const score=(record,queryTokens)=>{
  const title=clean(record.title,500).toLowerCase();
  const tags=list(record.tags).map(value=>clean(value,120).toLowerCase());
  const body=[record.id,record.title,record.packType,record.summary,...tags].map(value=>clean(value,2000).toLowerCase()).join(' ');
  return queryTokens.reduce((sum,token)=>sum+(tags.includes(token)?18:0)+(title.includes(token)?10:0)+(body.includes(token)?4:0),0);
};

export function expandedQuery(query){return tokens(query).join(' ')}

export function scoreCatalogRecords(catalogRecords,query,{audience='',limit=3,includeUnavailable=true,packTypes=[]}={}){
  const queryTokens=tokens(query),wantedTypes=new Set(list(packTypes).map(value=>clean(value,80)));
  const rows=list(catalogRecords).filter(record=>{
    if(audience&&Array.isArray(record.audience)&&!record.audience.includes(audience))return false;
    if(wantedTypes.size&&!wantedTypes.has(record.packType))return false;
    if(!includeUnavailable&&record.available===false&&!record.module)return false;
    return true;
  }).map(record=>({...record,score:queryTokens.length?score(record,queryTokens):(record.autoStage!==false?1:0)})).filter(record=>record.score>0)
    .sort((a,b)=>b.score-a.score||Number(b.autoStage!==false)-Number(a.autoStage!==false)||String(a.title).localeCompare(String(b.title)));
  return rows.slice(0,Math.max(1,Math.min(12,Number(limit)||3)));
}

export async function recommendPacks(query,options={}){
  const catalog=await packs.catalog();
  return scoreCatalogRecords(catalog.packs,query,options);
}

export async function resolve(query,{audience='',packLimit=2,resultLimit=16,kinds=[],includeLaborReferences=true}={}){
  await packs.bootstrapCore();
  const recommended=await recommendPacks(query,{audience,limit:Math.max(1,packLimit+2),includeUnavailable:true});
  const staged=[];
  for(const record of recommended){
    if(staged.length>=packLimit)break;
    if(record.autoStage!==false)continue;
    if(record.available===false&&!record.module)continue;
    await packs.stage([record.id]);
    staged.push(record.id);
  }
  const wantedKinds=list(kinds).length?list(kinds):(includeLaborReferences?[]:['task-template','learning-unit','expert-guide']);
  const expanded=expandedQuery(query);
  const results=packs.search(expanded,{kinds:wantedKinds,limit:resultLimit});
  return{query:clean(query),expandedQuery:expanded,audience,recommended,staged,results,loadedPacks:packs.loadedPacks().map(pack=>({id:pack.id,title:pack.title,packType:pack.packType}))};
}

export const version=VERSION;
export default Object.freeze({version:VERSION,expandedQuery,scoreCatalogRecords,recommendPacks,resolve});