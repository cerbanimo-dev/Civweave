import * as packs from './learning-pack-runtime-v1.mjs?v=learning-packs-v1';

const VERSION='1.0.0-learning-pack-resolver-v1';
const clean=(value,max=4000)=>String(value??'').trim().slice(0,max);
const list=value=>Array.isArray(value)?value:[];
const tokens=value=>[...new Set(clean(value).toLowerCase().replace(/[^a-z0-9]+/g,' ').split(/\s+/).filter(word=>word.length>2))].slice(0,50);
const score=(record,queryTokens)=>{
  const title=clean(record.title,500).toLowerCase();
  const tags=list(record.tags).map(value=>clean(value,120).toLowerCase());
  const body=[record.id,record.title,record.packType,record.summary,...tags].map(value=>clean(value,2000).toLowerCase()).join(' ');
  return queryTokens.reduce((sum,token)=>sum+(tags.includes(token)?18:0)+(title.includes(token)?10:0)+(body.includes(token)?4:0),0);
};

export async function recommendPacks(query,{audience='',limit=3,includeUnavailable=true,packTypes=[]}={}){
  const catalog=await packs.catalog(),queryTokens=tokens(query),wantedTypes=new Set(list(packTypes).map(value=>clean(value,80)));
  const rows=catalog.packs.filter(record=>{
    if(audience&&Array.isArray(record.audience)&&!record.audience.includes(audience))return false;
    if(wantedTypes.size&&!wantedTypes.has(record.packType))return false;
    if(!includeUnavailable&&record.available===false&&!record.module)return false;
    return true;
  }).map(record=>({...record,score:queryTokens.length?score(record,queryTokens):(record.autoStage!==false?1:0)}).filter(record=>record.score>0)
    .sort((a,b)=>b.score-a.score||Number(b.autoStage!==false)-Number(a.autoStage!==false)||String(a.title).localeCompare(String(b.title)));
  return rows.slice(0,Math.max(1,Math.min(12,Number(limit)||3)));
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
  const results=packs.search(query,{kinds:wantedKinds,limit:resultLimit});
  return{query:clean(query),audience,recommended,staged,results,loadedPacks:packs.loadedPacks().map(pack=>({id:pack.id,title:pack.title,packType:pack.packType}))};
}

export const version=VERSION;
export default Object.freeze({version:VERSION,recommendPacks,resolve});
