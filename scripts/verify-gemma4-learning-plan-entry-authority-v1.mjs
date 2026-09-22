import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile('public/app/local-ai/gemma4-learning-plan-entry-authority-v1.js','utf8');
let intakeCalls=0,pipelineCalls=0,legacyCalls=0,ensureCalls=0;
const legacyGenerate=async()=>{legacyCalls+=1;throw Object.assign(new Error('The provider response did not satisfy the requested JSON contract.'),{code:'INVALID_STRUCTURED_OUTPUT'})};
const sandbox={
  console,
  CustomEvent:class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail}},
  dispatchEvent:()=>true,
  addEventListener:()=>{},
  queueMicrotask:fn=>fn(),
  setTimeout:()=>0,
  clearTimeout:()=>{},
  CivweaveModelRuntime:{generate:legacyGenerate},
  CivweaveGemma4WeaveDraftPipelineV1:{
    install:()=>true,
    parseJsonLoose:text=>JSON.parse(text),
    weaveTransport:async()=>{pipelineCalls+=1;const text=JSON.stringify({title:'Tarot Reading',capability:'Read and remember tarot cards',level:'beginner',proof:'Give an independent reading',modules:[{title:'Structure',focus:'Deck structure',outcome:'Identify deck structure'},{title:'Meanings',focus:'Card meanings',outcome:'Recall core meanings'},{title:'Reading',focus:'Card combinations',outcome:'Interpret a spread'}],assumptions:[],resourceManifest:[],specialistWork:[],decisionGates:[]});return{text,payload:{text},diagnostics:[]}}
  },
  CivweaveGemma4LiteRTRequestAuthorityV1:{ensure:async()=>{ensureCalls+=1;return true}},
  CivweaveFamilyAILoaderV105:{ensure:async()=>{sandbox.CivweaveModelRuntime={generate:legacyGenerate};return true}},
  CivweaveUnifiedChatSystemV1:{
    version:'test-unified',
    generateLivingSchoolPlan:async options=>{
      await sandbox.CivweaveFamilyAILoaderV105.ensure();
      const result=await sandbox.CivweaveModelRuntime.generate({purpose:'living-school-learning-plan-review-v2',config:{provider:'downloaded-local',route:'downloaded-local',model:'gemma4-e2b-it-litert-web'},schema:{type:'object'},messages:[{role:'user',content:options.text}]});
      return{response:{answer:result.outputJson.title},provider:result.actual.provider,model:result.actual.model,options};
    }
  }
};
sandbox.globalThis=sandbox;
sandbox.CivweaveGemma4FirstRequestIntakeBridgeV1={
  selectedGemma:()=>true,
  directIntake:async args=>{
    intakeCalls+=1;
    const result=await sandbox.CivweaveUnifiedChatSystemV1.generateLivingSchoolPlan({...args,systemId:'living-school',sourceSystemId:'civweave',__civweaveE2BIntakeCompleted:true});
    return{handled:true,result};
  }
};
vm.runInNewContext(source,sandbox,{filename:'gemma4-learning-plan-entry-authority-v1.js'});
const api=sandbox.CivweaveGemma4LearningPlanEntryAuthorityV1;
assert(api?.mandatoryE2BIntake===true,'entry authority did not install');
api.install();
const result=await sandbox.CivweaveUnifiedChatSystemV1.generateLivingSchoolPlan({text:'Can you teach me how to read and memorize the tarot?',systemId:'living-school',history:[]});
assert.equal(intakeCalls,1,'Learning Journey did not pass through E2B intake exactly once');
assert.equal(pipelineCalls,1,'Learning Journey did not enter explicit E4B Weave transport exactly once');
assert.equal(legacyCalls,0,'legacy strict-JSON generator was still reachable');
assert(ensureCalls>=1,'LiteRT request authority was not ensured before E4B handoff');
assert.equal(result.provider,'downloaded-local');
assert.equal(result.model,'gemma4-e4b-it-litert-web');
assert.equal(result.response.answer,'Tarot Reading');
console.log('PASS: local Gemma Learning Journey requests cannot reach the legacy strict-JSON generator; E2B intake hands directly to the E4B Weave transport even after FamilyAILoader replaces the runtime.');
