import * as packs from './learning-pack-runtime-v1.mjs?v=learning-packs-v1';

const VERSION='1.0.0-skill-crosswalk-v1';
const PACK_ID='esco-skill-crosswalk-v1';
const DEFAULT_MIN_CONFIDENCE=.9;
let state={loaded:false,available:null,pack:null,skillByFrom:new Map(),skillByTo:new Map(),occupationByOnet:new Map(),meta:null};
let loadPromise=null;
const clean=(value,max=2400)=>String(value??'').trim().slice(0,max);
const list=value=>Array.isArray(value)?value:[];
const copy=value=>globalThis.structuredClone?globalThis.structuredClone(value):JSON.parse(JSON.stringify(value));
const clamp=value=>Math.max(0,Math.min(1,Number(value)||0));

async function rawPackResponse(){
  const store=globalThis.CivweaveLearningPackSeedsV1;
  if(!store?.openPack){await packs.bootstrapCore();}
  const active=globalThis.CivweaveLearningPackSeedsV1;
  return active?.openPack?active.openPack(PACK_ID):null;
}
async function responseText(response){
  if(!response)return'';
  const encoding=clean(response.headers.get('content-encoding'),80).toLowerCase();
  const file=clean(response.headers.get('x-civweave-pack-file'),500).toLowerCase();
  if(encoding==='gzip'||file.endsWith('.gz')){
    if(typeof DecompressionStream!=='function')throw new Error('This browser cannot unpack the ESCO crosswalk offline.');
    return new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).text();
  }
  return response.text();
}
function mappingValid(row){return row&&row.from?.scheme&&row.from?.id&&row.to?.scheme&&row.to?.id}
function addMulti(map,key,value){if(!key)return;const rows=map.get(key)||[];rows.push(value);map.set(key,rows)}
function indexPack(pack){
  const crosswalks=pack?.crosswalks||{};
  const skillMappings=list(crosswalks.skillMappings).filter(mappingValid).map(row=>({...row,confidence:clamp(row.confidence)}));
  const occupationMappings=list(crosswalks.occupationMappings).filter(mappingValid).map(row=>({...row,confidence:clamp(row.confidence)}));
  const skillByFrom=new Map(),skillByTo=new Map(),occupationByOnet=new Map();
  for(const row of skillMappings){addMulti(skillByFrom,clean(row.from.id,220),row);addMulti(skillByTo,clean(row.to.id,220),row);if(row.to.uri)addMulti(skillByTo,clean(row.to.uri,1000),row)}
  for(const row of occupationMappings){
    const onet=row.from?.scheme==='onet'?row.from:row.to?.scheme==='onet'?row.to:null;
    if(onet)addMulti(occupationByOnet,clean(onet.id,160),row);
  }
  state={loaded:true,available:true,pack,skillByFrom,skillByTo,occupationByOnet,meta:{schema:crosswalks.schema||'',sourceRelease:pack.sourceRelease||'',generatedAt:pack.generatedAt||'',skillMappings:skillMappings.length,occupationMappings:occupationMappings.length}};
  return state.meta;
}
export async function status(){
  const catalog=await packs.catalog(),record=list(catalog?.packs).find(row=>row.id===PACK_ID);
  const device=list(await packs.status()).find(row=>row.id===PACK_ID)||null;
  return{packId:PACK_ID,available:Boolean(record&&(record.available!==false||record.module)),staged:Boolean(device?.staged),current:Boolean(device?.current),needsUpdate:Boolean(device?.needs_update),bytes:Number(record?.bytes||device?.bytes||0),sourceRelease:record?.sourceRelease||'',generatedAt:record?.generatedAt||'',loaded:state.loaded};
}
export async function load({stage=false,force=false}={}){
  if(state.loaded&&!force)return state.meta;
  if(loadPromise&&!force)return loadPromise;
  loadPromise=(async()=>{
    const current=await status();state.available=current.available;
    if(!current.available)return null;
    if(!current.staged){if(!stage)return null;await packs.stage([PACK_ID]);}
    const response=await rawPackResponse();if(!response)return null;
    const pack=JSON.parse(await responseText(response));
    if(pack?.id!==PACK_ID||pack?.crosswalks?.schema!=='civweave.skill-crosswalk.v1')throw new Error('The installed ESCO bridge is not a compatible Civweave skill crosswalk.');
    return indexPack(pack);
  })().finally(()=>{loadPromise=null});
  return loadPromise;
}
function accepted(row,{minConfidence=DEFAULT_MIN_CONFIDENCE,includeReview=false}={}){
  if(!row)return false;
  if(!includeReview&&clean(row.status,40)!=='accepted')return false;
  return clamp(row.confidence)>=Math.max(0,Math.min(1,Number(minConfidence)||0));
}
function order(rows){return [...rows].sort((a,b)=>clamp(b.confidence)-clamp(a.confidence)||String(a.to?.label||'').localeCompare(String(b.to?.label||'')))}
export async function resolveSkill(skillRef,options={}){
  await load({stage:options.stage===true});
  const id=clean(typeof skillRef==='string'?skillRef:skillRef?.id,220);if(!id)return null;
  const candidates=order(state.skillByFrom.get(id)||[]),matches=candidates.filter(row=>accepted(row,options));
  return{id,label:clean(typeof skillRef==='object'?skillRef?.label:'',300),canonical:matches[0]?copy(matches[0].to):null,matches:copy(matches),candidates:copy(options.includeCandidates===false?matches:candidates),source:state.meta?copy(state.meta):null};
}
export async function resolveSkills(skillRefs,options={}){
  await load({stage:options.stage===true});
  const output=[];for(const value of list(skillRefs)){const resolved=await resolveSkill(value,{...options,stage:false});if(resolved)output.push(resolved)}return output;
}
export async function normalizeSkillRefs(skillRefs,options={}){
  const resolved=await resolveSkills(skillRefs,options),refs=[];
  for(const row of resolved){refs.push(row.id);if(row.canonical?.id)refs.push(row.canonical.id);if(options.includeUris&&row.canonical?.uri)refs.push(row.canonical.uri)}
  return{refs:[...new Set(refs)],resolved};
}
export async function mapOnetOccupation(onetCode,options={}){
  await load({stage:options.stage===true});
  const code=clean(onetCode,120),rows=order(state.occupationByOnet.get(code)||[]).filter(row=>accepted(row,{minConfidence:options.minConfidence??.7,includeReview:options.includeReview===true}));
  return copy(rows);
}
export async function graph(skillRefs,options={}){
  const resolved=await resolveSkills(skillRefs,{...options,includeCandidates:true}),nodes=new Map(),edges=[];
  for(const row of resolved){nodes.set(`civweave:${row.id}`,{scheme:'civweave',id:row.id,label:row.label||row.id});for(const mapping of row.candidates){const to=mapping.to;nodes.set(`${to.scheme}:${to.id}`,copy(to));edges.push({from:copy(mapping.from),to:copy(to),relation:mapping.relation,confidence:mapping.confidence,status:mapping.status,provenance:copy(mapping.provenance||{})})}}
  return{nodes:[...nodes.values()],edges,source:state.meta?copy(state.meta):null};
}
export async function install(){await load({stage:true,force:true});return status()}
export async function remove(){await packs.remove([PACK_ID]);state={loaded:false,available:null,pack:null,skillByFrom:new Map(),skillByTo:new Map(),occupationByOnet:new Map(),meta:null};return status()}

export const packId=PACK_ID;
export const version=VERSION;
export default Object.freeze({version:VERSION,packId:PACK_ID,status,load,install,remove,resolveSkill,resolveSkills,normalizeSkillRefs,mapOnetOccupation,graph});
