import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {fileURLToPath,pathToFileURL} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const OUT_DIR=path.join(ROOT,'public','downloads','learning-packs');
const CATALOG=path.join(OUT_DIR,'catalog.json');
const PACK_ID='esco-skill-crosswalk-v1';
const FILE='esco-skill-crosswalk-v1.json.gz';
const ESCO_API='https://ec.europa.eu/esco/api/search';
const CLASSIFICATION_RELEASE='1.2.1';
const EXPLICIT_API_VERSION=String(process.env.ESCO_VERSION||'').trim();
const ONET_CROSSWALK='https://esco.ec.europa.eu/system/files/2023-08/ONET_%28Occupations%29_0_updated.csv';
const ATTRIBUTION='This service uses the ESCO classification of the European Commission.';
const USER_AGENT='Civweave ESCO crosswalk builder/1.0';

const clean=(value,max=4000)=>String(value??'').trim().slice(0,max);
const normalized=value=>clean(value,600).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
const tokens=value=>new Set(normalized(value).split(' ').filter(token=>token.length>1));
const jaccard=(a,b)=>{const aa=tokens(a),bb=tokens(b);if(!aa.size||!bb.size)return 0;let intersection=0;for(const token of aa)if(bb.has(token))intersection++;return intersection/(aa.size+bb.size-intersection)};
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function collectPackExports(module){
  const found=[];
  for(const value of Object.values(module))if(value&&typeof value==='object'&&value.schema==='civweave.learning-pack.v1')found.push(value);
  return found;
}
function mergeSkills(packs){
  const byId=new Map();
  for(const pack of packs)for(const row of Array.isArray(pack.skills)?pack.skills:[]){
    const id=clean(row?.id,180);if(!id)continue;
    const current=byId.get(id)||{id,label:clean(row?.label||row?.title,300)||id,aliases:new Set(),packIds:new Set()};
    for(const alias of Array.isArray(row?.aliases)?row.aliases:[])if(clean(alias,300))current.aliases.add(clean(alias,300));
    current.packIds.add(pack.id);byId.set(id,current);
  }
  return [...byId.values()].map(row=>({id:row.id,label:row.label,aliases:[...row.aliases],packIds:[...row.packIds]})).sort((a,b)=>a.id.localeCompare(b.id));
}
function deepCandidates(value,output=[],seen=new Set()){
  if(!value||typeof value!=='object'||seen.has(value))return output;seen.add(value);
  if(!Array.isArray(value)){
    const uri=clean(value.uri||value.href||value._links?.self?.href,1200);
    if(/data\.europa\.eu\/esco\/skill\//i.test(uri))output.push(value);
  }
  for(const child of Array.isArray(value)?value:Object.values(value))if(child&&typeof child==='object')deepCandidates(child,output,seen);
  return output;
}
function labelValues(value){
  const output=[];
  const add=input=>{if(typeof input==='string'&&clean(input,500))output.push(clean(input,500));else if(Array.isArray(input))for(const row of input)add(row);else if(input&&typeof input==='object')for(const row of Object.values(input))add(row)};
  add(value?.title);add(value?.preferredLabel);add(value?.prefLabel);add(value?.labels);add(value?._links?.self?.title);
  return [...new Set(output)];
}
function candidateRecord(raw){
  const uri=clean(raw?.uri||raw?.href||raw?._links?.self?.href,1200);if(!uri)return null;
  const labels=labelValues(raw),label=labels[0]||clean(raw?.title,300)||uri.split('/').at(-1),id=uri.split('/').filter(Boolean).at(-1);
  return{id,uri,label,labels};
}
async function fetchJson(url,label){
  let lastError=null;
  for(let attempt=0;attempt<3;attempt++){
    try{
      const response=await fetch(url,{headers:{'user-agent':USER_AGENT,'accept':'application/json'}});
      if(response.ok)return response.json();
      lastError=new Error(`${label} request failed (${response.status}).`);
      if(response.status<500&&response.status!==429)break;
    }catch(error){lastError=error}
    await sleep(250*(attempt+1));
  }
  throw lastError||new Error(`${label} request failed.`);
}
function escoSearchUrl(query,{limit=12}={}){
  const url=new URL(ESCO_API);url.searchParams.set('text',query);url.searchParams.set('language','en');url.searchParams.set('limit',String(limit));url.searchParams.set('full','true');url.searchParams.set('viewObsolete','false');
  if(EXPLICIT_API_VERSION)url.searchParams.set('selectedVersion',EXPLICIT_API_VERSION);
  return url;
}
async function resolveApiSelection(){
  const selection=EXPLICIT_API_VERSION||'latest-default',json=await fetchJson(escoSearchUrl('communication',{limit:5}),`ESCO ${selection} probe`);
  if(!deepCandidates(json).length)throw new Error(`ESCO ${selection} probe returned no skill concepts.`);
  return selection;
}
async function searchEsco(query,apiSelection,cache){
  const key=normalized(query);if(!key)return[];if(cache.has(key))return cache.get(key);
  const json=await fetchJson(escoSearchUrl(query),`ESCO skill search for ${query}`),rows=[];
  for(const raw of deepCandidates(json)){const row=candidateRecord(raw);if(row&&!rows.some(existing=>existing.uri===row.uri))rows.push(row)}
  cache.set(key,rows);await sleep(35);return rows;
}
function scoreCandidate(skill,candidate){
  const targets=[{value:skill.label,kind:'label'},...skill.aliases.map(value=>({value,kind:'alias'}))],candidateLabels=candidate.labels.length?candidate.labels:[candidate.label];
  let best={score:0,kind:'none',target:'',candidateLabel:candidate.label,exact:false};
  for(const target of targets)for(const label of candidateLabels){
    const exact=normalized(target.value)===normalized(label),score=exact?1:jaccard(target.value,label);
    if(score>best.score)best={score,kind:target.kind,target:target.value,candidateLabel:label,exact};
  }
  return best;
}
async function buildSkillMappings(skills,apiSelection){
  const cache=new Map(),accepted=[],review=[],unresolved=[];
  for(let index=0;index<skills.length;index++){
    const skill=skills[index],queries=[skill.label,...skill.aliases].filter(Boolean).slice(0,3),candidateMap=new Map();
    for(const query of queries)for(const row of await searchEsco(query,apiSelection,cache))candidateMap.set(row.uri,row);
    const ranked=[...candidateMap.values()].map(candidate=>({candidate,match:scoreCandidate(skill,candidate)})).sort((a,b)=>b.match.score-a.match.score);
    const exact=ranked.find(row=>row.match.exact);
    if(exact){
      const confidence=exact.match.kind==='label'?1:.98;
      accepted.push({from:{scheme:'civweave',id:skill.id,label:skill.label},to:{scheme:'esco-skill',id:exact.candidate.id,uri:exact.candidate.uri,label:exact.candidate.label},relation:'exact',confidence,status:'accepted',provenance:{source:'esco-web-service-api',method:exact.match.kind==='label'?'normalized-label-exact':'normalized-alias-exact',query:exact.match.target,apiSelectedVersion:apiSelection,classificationRelease:CLASSIFICATION_RELEASE,officialConcept:true,officialMapping:false,humanValidated:false,usDolValidated:false}});
    }else if(ranked[0]&&ranked[0].match.score>=.45){
      const best=ranked[0];review.push({from:{scheme:'civweave',id:skill.id,label:skill.label},to:{scheme:'esco-skill',id:best.candidate.id,uri:best.candidate.uri,label:best.candidate.label},relation:'close',confidence:Number(Math.min(.89,.5+best.match.score*.39).toFixed(3)),status:'review',provenance:{source:'esco-web-service-api',method:'lexical-candidate',query:best.match.target,tokenJaccard:Number(best.match.score.toFixed(3)),apiSelectedVersion:apiSelection,classificationRelease:CLASSIFICATION_RELEASE,officialConcept:true,officialMapping:false,humanValidated:false,usDolValidated:false}});
    }else unresolved.push({id:skill.id,label:skill.label,aliases:skill.aliases,packIds:skill.packIds});
    process.stdout.write(`\rESCO skills ${index+1}/${skills.length}`);
  }
  process.stdout.write('\n');return{accepted,review,unresolved};
}
function parseCsv(text){
  const rows=[],row=[];let field='',quoted=false;
  for(let index=0;index<text.length;index++){
    const char=text[index];
    if(quoted){if(char==='"'&&text[index+1]==='"'){field+='"';index++}else if(char==='"')quoted=false;else field+=char;continue}
    if(char==='"'){quoted=true;continue}if(char===','){row.push(field);field='';continue}if(char==='\n'){row.push(field.replace(/\r$/,''));rows.push(row.splice(0));field='';continue}field+=char;
  }
  if(field||row.length){row.push(field.replace(/\r$/,''));rows.push(row)}return rows.filter(values=>values.some(value=>clean(value)));
}
const headerKey=value=>normalized(value).replace(/ /g,'');
function rowObject(headers,values){return Object.fromEntries(headers.map((header,index)=>[headerKey(header)||`column${index}`,clean(values[index],2400)]))}
function pick(object,predicate){for(const [key,value] of Object.entries(object))if(value&&predicate(key,value))return value;return''}
function relationFrom(object){
  const raw=pick(object,(key,value)=>key.includes('relation')||key.includes('match')||['exact','narrow','broad','close','related'].some(term=>normalized(value).includes(term)));
  const value=normalized(raw);for(const relation of ['exact','narrow','broad','close','related'])if(value.includes(relation))return relation;return'close';
}
async function buildOccupationMappings(){
  const response=await fetch(ONET_CROSSWALK,{headers:{'user-agent':USER_AGENT,'accept':'text/csv,*/*'}});if(!response.ok)throw new Error(`Official ESCO-O*NET crosswalk request failed (${response.status}).`);
  const table=parseCsv(await response.text());if(table.length<2)throw new Error('Official ESCO-O*NET crosswalk returned no data rows.');
  const headers=table[0],mappings=[],rejected=[];
  for(const values of table.slice(1)){
    const object=rowObject(headers,values);
    const onetCode=pick(object,(key,value)=>(key.includes('onet')&&key.includes('code'))||/^\d{2}-\d{4}\.\d{2}$/.test(value));
    const escoUri=pick(object,(_key,value)=>/data\.europa\.eu\/esco\/occupation\//i.test(value));
    if(!onetCode||!escoUri){rejected.push(values);continue}
    const relation=relationFrom(object),accepted=relation!=='related';
    const onetLabel=pick(object,(key,_value)=>key.includes('onet')&&(key.includes('title')||key.includes('label')||key.includes('name')));
    const escoLabel=pick(object,(key,_value)=>key.includes('esco')&&(key.includes('title')||key.includes('label')||key.includes('name'))&&!key.includes('uri'));
    const escoId=escoUri.split('/').filter(Boolean).at(-1),confidence={exact:1,narrow:.95,broad:.95,close:.9,related:.6}[relation]||.9;
    mappings.push({from:{scheme:'onet',id:onetCode,label:onetLabel},to:{scheme:'esco-occupation',id:escoId,uri:escoUri,label:escoLabel||escoId},relation,confidence,status:accepted?'accepted':'review',provenance:{source:'esco-official-onet-crosswalk',method:'official-crosswalk',officialConcept:true,officialMapping:true,humanValidated:accepted,qualityAssured:accepted,usDolValidated:accepted,classificationRelease:CLASSIFICATION_RELEASE,note:accepted?'Official ESCO-O*NET crosswalk relation retained.':'Related matches are retained for review because the ESCO documentation distinguishes them from the fully quality-assured mapping set.'}});
  }
  if(mappings.length<100)throw new Error(`Official ESCO-O*NET crosswalk parser found only ${mappings.length} mappings; expected a substantial mapping table.`);
  return{mappings,rejectedRows:rejected.length,headers};
}

await fs.mkdir(OUT_DIR,{recursive:true});
const [coreModule,expertModule]=await Promise.all([
  import(pathToFileURL(path.join(ROOT,'public','app','shared','core-practice-pack-v1.mjs')).href),
  import(pathToFileURL(path.join(ROOT,'public','app','shared','expert-pack-library-v1.mjs')).href)
]);
const authoredPacks=[...collectPackExports(coreModule),...collectPackExports(expertModule)],authoredSkills=mergeSkills(authoredPacks);
if(authoredSkills.length<20)throw new Error(`Only ${authoredSkills.length} authored Civweave skills were discovered.`);
const apiSelectedVersion=await resolveApiSelection();
console.log(`Using ESCO API ${apiSelectedVersion} semantics for ${authoredSkills.length} authored Civweave skills.`);
const skillResult=await buildSkillMappings(authoredSkills,apiSelectedVersion),occupationResult=await buildOccupationMappings();
const skillMappings=[...skillResult.accepted,...skillResult.review];
const escoSkills=[...new Map(skillMappings.map(row=>[row.to.id,{id:`esco-skill:${row.to.id}`,label:row.to.label,aliases:[],externalRefs:[{scheme:'esco',id:row.to.id,uri:row.to.uri}]}])).values()];
const generatedAt=new Date().toISOString();
const pack={
  schema:'civweave.learning-pack.v1',id:PACK_ID,version:'1.0.0',title:'ESCO Skill & O*NET Crosswalk',packType:'reference',audience:['cerbanimo','living-school'],
  summary:`Optional interoperability bridge from ${authoredSkills.length} authored Civweave skill identities to ESCO skills plus the official ESCO-O*NET occupation crosswalk. Exact Civweave-to-ESCO label or alias matches may be accepted automatically; non-exact candidates remain review-only.`,
  sourceRelease:`ESCO classification ${CLASSIFICATION_RELEASE}; API ${apiSelectedVersion}`,generatedAt,
  license:{id:'EC-REUSE/CC-BY-4.0',name:'European Commission reuse / CC BY 4.0 where applicable',url:'https://commission.europa.eu/legal-notice_en',attribution:ATTRIBUTION,modifications:'Civweave queries official ESCO skill concepts, generates separately identified Civweave-to-ESCO lexical mappings, and restructures the official ESCO-O*NET occupation crosswalk into a local interoperability pack. Generated Civweave skill mappings are not European Commission or U.S. Department of Labor validations.'},
  sources:[
    {id:'esco-web-service-api',title:'ESCO Web Services API',kind:'official-api',url:'https://ec.europa.eu/esco/api',license:'European Commission reuse',note:`Queried in English using ${apiSelectedVersion==='latest-default'?'the API default latest dataset':'selectedVersion='+apiSelectedVersion}. ESCO concept URIs are preserved as external identifiers.`},
    {id:'esco-official-onet-crosswalk',title:'Official O*NET-ESCO Occupation Crosswalk',kind:'official-crosswalk',url:ONET_CROSSWALK,license:'European Commission reuse',note:'Official occupation mappings are retained with their relation type. Related matches remain review-only in Civweave.'}
  ],
  skills:escoSkills,expertGuides:[],taskTemplates:[],learningUnits:[],laborReferences:[],
  crosswalks:{schema:'civweave.skill-crosswalk.v1',version:'1.0.0',canonicalSchemes:{civweave:'Civweave authored skill ID',escoSkill:'ESCO skill URI',onet:'O*NET-SOC code',escoOccupation:'ESCO occupation URI'},skillMappings,occupationMappings:occupationResult.mappings,unresolvedCivweaveSkills:skillResult.unresolved,provenancePolicy:{acceptedSkillMapping:'Normalized exact preferred-label or authored-alias match only.',reviewSkillMapping:'Lexical candidates never become canonical by default.',officialOccupationMapping:'Retained from the European Commission ESCO-O*NET occupation crosswalk.',relatedOccupationMapping:'Retained as review-only.'}}
};
const json=Buffer.from(`${JSON.stringify(pack)}\n`,'utf8'),gz=gzipSync(json,{level:9}),hash=sha256(gz);
await fs.writeFile(path.join(OUT_DIR,FILE),gz);
const catalog=JSON.parse(await fs.readFile(CATALOG,'utf8')),record=catalog.packs.find(row=>row.id===PACK_ID);
if(!record)throw new Error(`Catalog has no ${PACK_ID} record.`);
Object.assign(record,{file:FILE,contentType:'application/gzip',bytes:gz.byteLength,sha256:hash,available:true,generated:true,sourceRelease:pack.sourceRelease,generatedAt,counts:{authoredCivweaveSkills:authoredSkills.length,acceptedSkillMappings:skillResult.accepted.length,reviewSkillMappings:skillResult.review.length,unresolvedCivweaveSkills:skillResult.unresolved.length,occupationMappings:occupationResult.mappings.length,occupationRejectedRows:occupationResult.rejectedRows}});
catalog.updated=generatedAt;await fs.writeFile(CATALOG,`${JSON.stringify(catalog,null,2)}\n`);
console.log(JSON.stringify({packId:PACK_ID,file:FILE,bytes:gz.byteLength,sha256:hash,apiSelectedVersion,authoredCivweaveSkills:authoredSkills.length,acceptedSkillMappings:skillResult.accepted.length,reviewSkillMappings:skillResult.review.length,unresolvedCivweaveSkills:skillResult.unresolved.length,occupationMappings:occupationResult.mappings.length,occupationRejectedRows:occupationResult.rejectedRows,occupationHeaders:occupationResult.headers},null,2));
