import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=path=>fs.readFileSync(new URL(`../public/app/${path}`,import.meta.url),'utf8');
const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const stripModules=source=>source.replace(/^export \* from[^\n]+\r?\n/gm,'').replace(/^import[\s\S]*?from\s*['"][^'"]+['"];\r?\n/gm,'').replace(/export (async )?function /g,'$1function ').replace(/export const /g,'const ');
const source={id:'qa-temperature-source',title:'QA temperature scale reference',url:'https://example.test/temperature',notes:'A Celsius reading is multiplied by nine fifths before adding thirty two to obtain Fahrenheit.',provenance:'manual',provenanceFlag:'MANUALLY SUPPLIED SOURCES'};
const data={title:'QA conversion journey',capability:'Convert Celsius and Fahrenheit readings',level:'intermediate',mode:'self-directed',proof:'Show both conversion directions using a weather log.'};
const text=request=>request.messages.map(message=>message.content||'').join('\n');
function fixture(generate){
  const current={sources:[source],research:{mode:'manual-sources',summary:'QA reference points compare the zero points and interval sizes.',synthesis:{sourceBriefs:[{sourceId:source.id,teachingPoints:['Subtract the offset before applying the inverse interval multiplier.']}]}}};
  const context=vm.createContext({console,URL,Date,Math,JSON,Object,Array,String,Number,Boolean,RegExp,Promise,Set,Map,structuredClone,clean,now:()=>new Date().toISOString(),state:()=>current,assertGenerationActive(){},generationCancelled:()=>false,addEventListener(){},dispatchEvent(){},CustomEvent:class{},CivweaveFamilyAILoaderV105:{ensure:async()=>{}},CivweaveModelRuntime:{generate}});
  vm.runInContext(stripModules(read('cabinets/living-school/living-school-cleanroom-core-v218.mjs'))+'\nglobalThis.__design=generateDesignPacket;globalThis.__structure=structureBatch;',context);
  return context;
}
async function installGuard(context){
  const guard=read('living-school-generation-guard-v262.mjs').replace(/^import safeMode[^\n]+\r?\n/,'const safeMode={read:()=>({enabled:false})};\n').replace('export async function installLivingSchoolGenerationGuard','async function installLivingSchoolGenerationGuard');
  vm.runInContext('(()=>{'+guard+';globalThis.__installGuard=installLivingSchoolGenerationGuard;})()',context);
  await context.__installGuard();
}

test('the existing guarded design call transports source passages and synthesis to the selected provider',async()=>{
  let request;
  const context=fixture(async value=>{request=value;return{status:'success',outputText:'## Module 1: Temperature intervals\nUse the supplied reference points.'}});
  await installGuard(context);
  await context.__design(context.CivweaveModelRuntime,{provider:'ollama',model:'qa-local'},data,1,[source]);
  const transmitted=text(request);
  assert.match(transmitted,/CURRICULUM SOURCE MATERIAL/);
  assert.match(transmitted,/qa-temperature-source/);
  assert.match(transmitted,/A Celsius reading is multiplied by nine fifths before adding thirty two/);
  assert.match(transmitted,/https:\/\/example\.test\/temperature/);
  assert.match(transmitted,/Subtract the offset before applying the inverse interval multiplier/);
  assert.equal(request.context.sourceMaterialInjected,true);
});

test('the formatter transports the design, requested learning contract, and source mappings alongside its complete schema',async()=>{
  let request;
  const context=fixture(async value=>{request=value;return{status:'error',error:{message:'Transport inspection only'}}});
  const design={content:'## Module 2: Inverse temperature conversion\nSubtract thirty two, then multiply by five ninths. SOURCE_ID qa-temperature-source'};
  await context.__structure(context.CivweaveModelRuntime,{provider:'ollama',model:'qa-local'},data,3,design,[source],[1]);
  const transmitted=text(request);
  assert.match(transmitted,/Subtract thirty two, then multiply by five ninths/,'Provider messages must carry the instructional authority, not only context.designPacket.');
  assert.match(transmitted,/Show both conversion directions using a weather log/);
  assert.match(transmitted,/intermediate/);
  assert.match(transmitted,/self-directed/);
  assert.match(transmitted,/qa-temperature-source/);
  assert.match(transmitted,/A Celsius reading is multiplied by nine fifths/);
  assert.match(transmitted,/Do not include a video URL/,'Existing construction constraints must reach the HTTP provider.');
  assert.deepEqual(Array.from(request.schema.required),['moduleIndex','module']);
  assert.ok(request.schema.properties.module.required.includes('lessonBlocks'));
  assert.ok(request.schema.properties.module.required.includes('quiz'));
  assert.equal(request.schema.properties.moduleIndex.enum[0],2);
});

test('formatter instructional messages remain within the shared transport character limit',async()=>{
  let request;
  const context=fixture(async value=>{request=value;return{status:'error'}});
  const sources=Array.from({length:16},(_,index)=>({...source,id:`qa-source-${index}`,notes:'reference passage '.repeat(800)}));
  await context.__structure(context.CivweaveModelRuntime,{provider:'ollama'},data,3,{content:'DESIGN_AUTHORITY '+('Detailed subject instruction. '.repeat(2000))},sources,[0]);
  assert.ok(request.messages.every(message=>message.content.length<=48000),'The shared runtime clips each individual message at 48,000 characters.');
  assert.match(text(request),/DESIGN_AUTHORITY/);
});
