import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const source=await readFile(new URL('public/app/local-ai/gemma4-weave-draft-pipeline-v1.js',root),'utf8');
assert.match(source,/E2B intake -> E4B free Weave Draft -> E4B JSON compile -> deterministic validation -> one E4B targeted repair/);
assert.match(source,/constrainedToolRequired:false/);
assert.match(source,/privateChainOfThoughtExposed:false/);
assert.match(source,/resourceManifestRequired:true/);
assert.match(source,/anarchadiaVotingGatesMandatory:true/);

const storage=new Map();
const localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)};
const calls=[];
let currentKind='learning';

const learningSchema={
  type:'object',required:['title','capability','level','proof','modules','assumptions'],properties:{
    title:{type:'string'},capability:{type:'string'},level:{type:'string',enum:['beginner','intermediate','advanced']},proof:{type:'string'},assumptions:{type:'array',items:{type:'string'}},
    modules:{type:'array',minItems:3,maxItems:8,items:{type:'object',required:['title','focus','outcome'],properties:{title:{type:'string'},focus:{type:'string'},outcome:{type:'string'}}}}
  }
};
const questSchema={
  type:'object',required:['title','wish','outcome','assumptions','paths'],properties:{
    title:{type:'string'},wish:{type:'string'},outcome:{type:'string'},assumptions:{type:'array',minItems:1,items:{type:'string'}},
    paths:{type:'array',minItems:1,maxItems:4,items:{type:'object',required:['type','realm','title','purpose','steps','completionCriteria','evidence'],properties:{
      type:{type:'string',enum:['learning','skilled-labor','material-acquirement','civic-governance']},realm:{type:'string',enum:['living-school','cerbanimo','fellowfare','anarchadia']},title:{type:'string'},purpose:{type:'string'},steps:{type:'array',minItems:1,items:{type:'string'}},completionCriteria:{type:'string'},evidence:{type:'array',minItems:1,items:{type:'string'}}
    }}}
  }
};

async function controlledFastRun(args,model,label){
  calls.push({model,label,structuredTool:args.structuredTool,maxNewTokens:args.maxNewTokens});
  assert.equal(model,'gemma4-e4b-it-litert-web');
  assert.equal(args.structuredTool,null,'E4B draft/compile/repair must use free text generation, never constrained tools');
  if(label==='E4B Weave Draft'){
    const text=currentKind==='learning'
      ? 'Build tarot recall through card families, imagery anchors, spaced retrieval, comparison practice, and live interpretation. Resources include a tarot deck and a spaced-repetition system. No licensed specialist is required. No collective vote is required.'
      : 'Create a community garden. Secure materials and site access. A licensed electrician is required only if permanent powered infrastructure is installed. The group must vote on the final shared site before construction; construction is blocked until that vote passes.';
    args.onToken?.({text:text.slice(0,Math.ceil(text.length/2))});args.onToken?.({text:text.slice(Math.ceil(text.length/2))});
    return{status:'success',outputText:text};
  }
  if(label==='E4B JSON Compile'&&currentKind==='learning'){
    const bad={title:'Tarot Recall',capability:'memorize and reliably recall tarot card meanings',level:'beginner',proof:'Interpret a shuffled spread from memory',modules:[{title:'Card Families',focus:'organize the deck',outcome:'sort and explain families'}],assumptions:[],resourceManifest:[{name:'Tarot deck',category:'materials'}],specialistWork:[],decisionGates:[]};
    return{status:'success',outputText:JSON.stringify(bad)};
  }
  if(label==='E4B Targeted Repair'&&currentKind==='learning'){
    const repaired={title:'Tarot Recall',capability:'memorize and reliably recall tarot card meanings',level:'beginner',mode:'guided',proof:'Interpret a shuffled spread from memory and explain the associations used.',modules:[
      {title:'Map the Deck',focus:'organize suits, ranks, and Major Arcana',outcome:'reconstruct the deck structure from memory'},
      {title:'Build Image Anchors',focus:'link each card to memorable visual and conceptual anchors',outcome:'recall core meanings from card imagery'},
      {title:'Retrieve and Compare',focus:'use spaced retrieval and contrast similar cards',outcome:'recall meanings without prompts and distinguish close concepts'},
      {title:'Read in Context',focus:'combine cards into small spreads',outcome:'interpret unfamiliar draws while explaining the remembered associations'}
    ],assumptions:['A standard 78-card tarot deck is being used.'],resourceManifest:[{name:'Tarot deck',category:'materials',why:'physical recall practice'},{name:'Spaced-repetition system',category:'software',why:'scheduled retrieval'}],specialistWork:[],decisionGates:[]};
    return{status:'success',outputText:JSON.stringify(repaired)};
  }
  if(label==='E4B JSON Compile'&&currentKind==='quest'){
    const quest={title:'Community Garden Quest',wish:'create a community garden',outcome:'open a functioning shared garden',assumptions:['The site must be chosen with the group.'],paths:[
      {type:'material-acquirement',realm:'fellowfare',title:'Garden Resources',purpose:'Acquire the garden inputs.',steps:['List required materials','Acquire soil, beds, tools, and water access'],completionCriteria:'Core materials are available.',evidence:['Resource receipts or contribution records']},
      {type:'skilled-labor',realm:'cerbanimo',title:'Site Build',purpose:'Prepare and construct the garden.',steps:['Prepare the approved site','Build beds and shared infrastructure'],completionCriteria:'The garden is safely built.',evidence:['Build inspection and photos']}
    ],resourceManifest:[{name:'Raised-bed materials',category:'materials'},{name:'Water access',category:'infrastructure'}],specialistWork:[{role:'Licensed electrician',why:'Only if permanent powered infrastructure is installed',licensedOrRegulated:true,blockingBeat:'Install powered infrastructure'}],decisionGates:[{decision:'Choose the final shared garden site',why:'The group will share and maintain the site',options:['Site A','Site B'],prerequisites:['Confirm access and basic feasibility'],blockingBeat:'Prepare the approved site',voteRequired:true}]};
    return{status:'success',outputText:JSON.stringify(quest)};
  }
  throw new Error(`Unexpected test stage: ${label} ${currentKind}`);
}

const baseRequests=[];
const baseGenerate=async request=>{
  baseRequests.push(request);
  if(typeof request.transport!=='function')return{status:'success',outputText:'ordinary'};
  const transported=await request.transport({config:request.config,messages:request.messages||[],schema:request.schema,emit:()=>{}});
  return{status:'success',outputText:transported.text,actual:{provider:transported.provider,model:transported.model}};
};
const oldStructured=async request=>baseGenerate(request);
oldStructured.__civweaveStructuredTaskAuthorityV1='1.2.0-old';
oldStructured.__prior=baseGenerate;

const sandbox={
  console,Date,Promise,Error,Object,Boolean,Number,String,Math,JSON,Map,Set,RegExp,structuredClone:globalThis.structuredClone,
  localStorage,
  CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},
  dispatchEvent:()=>true,addEventListener:()=>{},queueMicrotask:fn=>fn(),setTimeout:()=>0,
  CivweaveGemma4StructuredTaskAuthorityV1:{
    requireDeepModel:async()=>true,
    controlledFastRun,
    paintPending:()=>true,
    taskTimeoutMs:600000
  },
  CivweaveLiteRTGemma4FastRuntimeV1:{runFast:controlledFastRun},
  CivweaveModelRuntime:{generate:oldStructured}
};
sandbox.globalThis=sandbox;
vm.runInNewContext(source,sandbox,{filename:'gemma4-weave-draft-pipeline-v1.js'});
const api=sandbox.CivweaveGemma4WeaveDraftPipelineV1;
assert.ok(api);
assert.equal(api.deepModel,'gemma4-e4b-it-litert-web');
assert.equal(api.constrainedToolRequired,false);
assert.equal(api.privateChainOfThoughtExposed,false);

currentKind='learning';calls.length=0;baseRequests.length=0;
let result=await sandbox.CivweaveModelRuntime.generate({purpose:'living-school-learning-plan-review-v2',config:{provider:'downloaded-local',model:'gemma4-e2b-it-litert-web',maxTokens:900},schema:learningSchema,messages:[{role:'user',content:'Teach me how to learn and memorize the tarot.'}]});
assert.equal(result.status,'success');
let parsed=JSON.parse(result.outputText);
assert.equal(parsed.modules.length,4);
assert.equal(parsed.resourceManifest.length,2);
assert.equal(parsed.specialistWork.length,0);
assert.equal(parsed.decisionGates.length,0);
assert.deepEqual(calls.map(call=>call.label),['E4B Weave Draft','E4B JSON Compile','E4B Targeted Repair']);
assert.ok(calls.every(call=>call.model==='gemma4-e4b-it-litert-web'));
assert.ok(calls.every(call=>call.structuredTool===null));
assert.equal(baseRequests.at(-1).config.model,'gemma4-e4b-it-litert-web');

currentKind='quest';calls.length=0;baseRequests.length=0;
result=await sandbox.CivweaveModelRuntime.generate({purpose:'civweave-weaveling-intention-json-v190',config:{provider:'downloaded-local',model:'gemma4-e2b-it-litert-web',maxTokens:1200},schema:questSchema,messages:[{role:'user',content:'Help us create a community garden.'}]});
assert.equal(result.status,'success');
parsed=JSON.parse(result.outputText);
assert.equal(parsed.decisionGates.length,1);
assert.equal(parsed.specialistWork.length,1);
const civic=parsed.paths.find(path=>path.realm==='anarchadia'&&path.type==='civic-governance');
assert.ok(civic,'vote-required gate must create an Anarchadia civic-governance path');
assert.ok(civic.steps.some(step=>/Mandatory vote:/i.test(step)),'Anarchadia path must contain the mandatory vote beat');
assert.ok(civic.steps.some(step=>/block/i.test(step)),'vote beat must identify blocked downstream work');
assert.deepEqual(calls.map(call=>call.label),['E4B Weave Draft','E4B JSON Compile']);
assert.ok(calls.every(call=>call.model==='gemma4-e4b-it-litert-web'));
assert.ok(calls.every(call=>call.structuredTool===null));

const artifact=api.readArtifact('quest');
assert.equal(artifact.state,'complete');
assert.equal(artifact.resourceManifest.length,2);
assert.equal(artifact.specialistWork.length,1);
assert.equal(artifact.decisionGates.length,1);

console.log('E4B Weave Draft -> compile -> validate/repair pipeline regression passed.');