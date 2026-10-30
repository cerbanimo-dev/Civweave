#!/usr/bin/env node
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync('public/app/local-ai/gemma4-weave-draft-pipeline-v1.js','utf8');
const records=new Map(),events=[],calls=[];
const localStorage={
  getItem:key=>records.get(key)??null,
  setItem:(key,value)=>records.set(key,String(value)),
  removeItem:key=>records.delete(key)
};
const sections=[
  'Energy first: measure critical loads, test one safe portable panel and battery, then size modular generation for actual winter needs.\n[END SECTION]',
  'Resources: load meter, solar panel, certified controller and LiFePO4 pack. Seek an electrician for permanent wiring. Do not assume land ownership or roof rights.\n[END SECTION]',
  'Proof: record watt-hours supplied, days of reserve, and safe installation signoff before expansion. Continue to food, water, shelter and waste independence after energy.\n[END SECTION]'
];
const compiled={
  title:'Modular energy independence',
  wish:'Build resource sovereignty starting with electricity',
  outcome:'Produce and store adequate measured electricity and expand toward sustainable essentials',
  assumptions:['Current shelter and water access are temporary; power demand and site rights remain unknown.'],
  paths:[{type:'skilled-labor',realm:'cerbanimo',title:'Energy foundation',purpose:'Measure, test and safely expand power',steps:['Measure loads','Pilot portable solar','Review safe permanent installation'],completionCriteria:'Measured loads and sustained generation meet agreed goals',evidence:['Meter log','Electrical inspection if required']}],
  resourceManifest:[{name:'Solar panel',why:'Pilot generation'}],
  specialistWork:[{role:'Electrician',why:'Permanent electrical installation'}],
  decisionGates:[]
};
const schema={type:'object',required:['title','wish','outcome','assumptions','paths'],
  properties:{title:{type:'string'},wish:{type:'string'},outcome:{type:'string'},assumptions:{type:'array',minItems:1,items:{type:'string'}},paths:{type:'array',minItems:1,items:{type:'object'}}}};
let failingPart=0,missingEndPart=0,compilerCalls=0,draftCalls=0;
const sandbox={
  console,Date,Promise,JSON,Math,Map,Set,Array,Object,Number,String,Boolean,
  localStorage,addEventListener(){},setTimeout(){return 1},queueMicrotask(){},
  CustomEvent:class {constructor(type,{detail}={}){this.type=type;this.detail=detail}},
  dispatchEvent:event=>events.push(event),
  CivweaveLocalGenerationModelPolicyV1:{resolve:()=> 'qwen35-4b-litert-web',display:id=>id},
  CivweaveLocalModelDownloadV266:{selection:()=>({id:'qwen35-4b-litert-web'})},
  CivweaveLocalModelRegistryV266:{byId:()=>({runtime:'litert-lm-web'})},
  CivweaveGemma4StructuredTaskAuthorityV1:{
    requireDeepModel:async()=>{},
    taskTimeoutMs:240000,
    controlledFastRun:async(args,model,label)=>{
      calls.push({label,maxNewTokens:args.maxNewTokens,systemPrompt:args.systemPrompt,content:args.messages.at(-1)?.content});
      if(label.startsWith('Local Weave Draft')){
        const part=++draftCalls;
        if(failingPart===part){
          args.onToken?.({text:'Battery storage (Li'});
          throw Object.assign(new Error('Local model stopped mid-stream'),{code:'LOCAL_MODEL_EXECUTION_FAILED',rejectedText:'Battery storage (Li'});
        }
        const text=missingEndPart===part?sections[part-1].replace(/\n\[END SECTION\]/,''):sections[part-1];
        args.onToken?.({text});
        return{outputText:text};
      }
      if(label==='Local JSON Compile'){
        compilerCalls++;
        return{outputText:JSON.stringify(compiled)};
      }
      throw Error('Unexpected stage: '+label);
    }
  }
};
sandbox.globalThis=sandbox;
vm.runInNewContext(source,sandbox,{filename:'gemma4-weave-draft-pipeline-v1.js'});
const api=sandbox.CivweaveGemma4WeaveDraftPipelineV1;
const request={config:{provider:'downloaded-local'},messages:[{role:'user',content:'I have shelter and water for now but none is my own. Build my full plan, starting with energy.'}],schema};
let result=await api.weaveTransport(api.questPurpose,request);
assert.equal(JSON.parse(result.text).title,compiled.title);
assert.equal(draftCalls,3,'quest draft must be built in three bounded sections');
assert.equal(compilerCalls,1,'compiler must run only after all sections finish');
assert(calls.slice(0,3).every(c=>c.maxNewTokens<=420),'each draft stage must have a small output budget');
assert(calls.slice(0,3).every(c=>c.systemPrompt.includes('[END SECTION]')),'sections need a completion marker');
const latest=()=>JSON.parse(records.get('civweave.weave-draft-pipeline.v1.latest'));
assert.equal(latest().draftParts.length,3);
assert(!latest().draft.includes('[END SECTION]'));
assert(latest().draft.includes('winter needs'));
assert(latest().draft.includes('Electrical'));
assert(latest().draft.includes('Meter log')===false);
assert.equal(latest().state,'complete');

failingPart=2;missingEndPart=0;compilerCalls=0;draftCalls=0;records.clear();events.length=0;calls.length=0;
await assert.rejects(()=>api.weaveTransport(api.questPurpose,request),error=>error.code==='LOCAL_MODEL_EXECUTION_FAILED');
assert.equal(compilerCalls,0,'failed part must never be compiled');
assert.equal(latest().draftParts.length,1,'first complete section is checkpointed');
assert(latest().draft.includes('winter needs'));
assert.match(latest().rawStages.draft,/Battery storage \(Li/,'partial failing text remains visible');
assert.equal(latest().state,'failed');

failingPart=0;missingEndPart=1;compilerCalls=0;draftCalls=0;records.clear();events.length=0;calls.length=0;
await assert.rejects(()=>api.weaveTransport(api.questPurpose,request),error=>error.code==='CIVWEAVE_WEAVE_DRAFT_INCOMPLETE');
assert.equal(compilerCalls,0,'unmarked cut-off output must not be silently treated as complete');
assert.equal(latest().state,'failed');

console.log('PASS: bounded local Quest drafts preserve completed sections, reject clipped output, and compile only after section completion.');
