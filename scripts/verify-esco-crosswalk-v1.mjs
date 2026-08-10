import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath,pathToFileURL} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ARTIFACT=path.join(ROOT,'public','downloads','learning-packs','esco-skill-crosswalk-v1.json.gz');
const CATALOG=path.join(ROOT,'public','downloads','learning-packs','catalog.json');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const clean=value=>String(value??'').trim();
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function collectPacks(module){return Object.values(module).filter(value=>value&&typeof value==='object'&&value.schema==='civweave.learning-pack.v1')}

const bytes=await fs.readFile(ARTIFACT),pack=JSON.parse(gunzipSync(bytes).toString('utf8')),catalog=JSON.parse(await fs.readFile(CATALOG,'utf8'));
assert(pack.schema==='civweave.learning-pack.v1','ESCO bridge must remain a learning-pack artifact.');
assert(pack.id==='esco-skill-crosswalk-v1','Unexpected ESCO bridge pack id.');
assert(pack.packType==='reference','ESCO bridge must be a reference pack, never an executable task pack.');
assert(pack.crosswalks?.schema==='civweave.skill-crosswalk.v1','Missing skill-crosswalk schema.');
assert(clean(pack.license?.attribution).includes('This service uses the ESCO classification of the European Commission.'),'Required ESCO attribution is missing.');

const skillMappings=pack.crosswalks.skillMappings||[],occupationMappings=pack.crosswalks.occupationMappings||[],unresolved=pack.crosswalks.unresolvedCivweaveSkills||[];
assert(skillMappings.length>0,'ESCO bridge produced no Civweave skill mappings.');
assert(occupationMappings.length>100,'ESCO bridge produced too few official occupation mappings.');
for(const row of skillMappings){
  assert(row.from?.scheme==='civweave','Generated skill mapping must originate from a Civweave skill identity.');
  assert(row.to?.scheme==='esco-skill'&&/data\.europa\.eu\/esco\/skill\//i.test(row.to?.uri||''),'Generated skill mapping must target an ESCO skill URI.');
  assert(Number(row.confidence)>=0&&Number(row.confidence)<=1,'Skill mapping confidence must be normalized.');
  assert(row.provenance?.officialConcept===true,'ESCO target must be marked as an official concept.');
  assert(row.provenance?.officialMapping===false,'Generated Civweave-to-ESCO skill links must never claim to be an official ESCO mapping.');
  assert(row.provenance?.humanValidated===false&&row.provenance?.usDolValidated===false,'Generated skill mappings must not claim external human or U.S. DOL validation.');
  if(row.status==='accepted'){
    assert(row.relation==='exact','Automatically accepted skill mappings must be exact.');
    assert(Number(row.confidence)>=.9,'Automatically accepted skill mappings require high confidence.');
    assert(['normalized-label-exact','normalized-alias-exact'].includes(row.provenance?.method),'Automatically accepted skill mappings require an exact label/alias method.');
  }else{
    assert(row.status==='review','Non-accepted generated skill mappings must remain review-only.');
    assert(Number(row.confidence)<.9,'Review skill candidates must stay below the canonical acceptance threshold.');
  }
}
for(const row of occupationMappings){
  assert(row.from?.scheme==='onet'&&/^\d{2}-\d{4}\.\d{2}$/.test(row.from?.id||''),'Official occupation mapping must originate from an O*NET-SOC code.');
  assert(row.to?.scheme==='esco-occupation'&&/data\.europa\.eu\/esco\/occupation\//i.test(row.to?.uri||''),'Official occupation mapping must target an ESCO occupation URI.');
  assert(row.provenance?.source==='esco-official-onet-crosswalk'&&row.provenance?.officialMapping===true,'Occupation mappings must retain official ESCO-O*NET provenance.');
  if(row.relation==='related')assert(row.status==='review'&&!row.provenance?.usDolValidated,'Related occupation matches must remain review-only.');
  else assert(row.status==='accepted'&&row.provenance?.humanValidated===true&&row.provenance?.qualityAssured===true&&row.provenance?.usDolValidated===true,'Quality-assured official occupation mappings must retain validation provenance.');
}

const [coreModule,expertModule]=await Promise.all([
  import(pathToFileURL(path.join(ROOT,'public','app','shared','core-practice-pack-v1.mjs')).href),
  import(pathToFileURL(path.join(ROOT,'public','app','shared','expert-pack-library-v1.mjs')).href)
]);
const authored=new Set([...collectPacks(coreModule),...collectPacks(expertModule)].flatMap(pack=>pack.skills||[]).map(row=>row.id));
const accounted=new Set([...skillMappings.map(row=>row.from?.id),...unresolved.map(row=>row.id)].filter(Boolean));
for(const id of authored)assert(accounted.has(id),`Authored Civweave skill ${id} is neither mapped nor explicitly unresolved.`);

const record=catalog.packs.find(row=>row.id===pack.id);assert(record,'ESCO bridge is missing from catalog.');
assert(record.available===true,'Built ESCO bridge must become available in the catalog.');
assert(Number(record.bytes)===bytes.byteLength,'ESCO bridge catalog byte count does not match artifact.');
assert(record.sha256===sha256(bytes),'ESCO bridge catalog checksum does not match artifact.');
assert(record.optional===true&&record.bundled===false&&record.autoStage===false,'ESCO bridge must stay optional and non-auto-staged.');

const runtime=await fs.readFile(path.join(ROOT,'public','app','shared','skill-crosswalk-v1.mjs'),'utf8');
assert(runtime.includes("DEFAULT_MIN_CONFIDENCE=.9"),'Runtime canonical threshold must remain explicit.');
assert(runtime.includes("clean(row.status,40)!=='accepted'"),'Runtime must exclude review mappings by default.');
assert(runtime.includes("packs.stage([PACK_ID])"),'Runtime installation must use the existing learning-pack cache.');
assert(runtime.includes("packs.remove([PACK_ID])"),'Runtime removal must use the existing learning-pack cache.');

console.log('ESCO Skill Crosswalk v1 contract passed.',{
  authoredCivweaveSkills:authored.size,
  acceptedSkillMappings:skillMappings.filter(row=>row.status==='accepted').length,
  reviewSkillMappings:skillMappings.filter(row=>row.status==='review').length,
  unresolvedCivweaveSkills:unresolved.length,
  officialOccupationMappings:occupationMappings.length,
  artifactBytes:bytes.byteLength
});
