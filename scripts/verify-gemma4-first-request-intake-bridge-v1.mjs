import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile('public/app/local-ai/gemma4-first-request-intake-bridge-v1.js','utf8');
assert.match(source,/1\.0\.1-gemma4-first-request-intake-bridge-v1-living-school-intake/);
assert.match(source,/livingSchoolLearningIntake:true/);
const order=[];
let priorCalls=0;
let intakeArgsSeen=null;
const runtimeGenerate=async()=>({status:'success'});
const context={
  console,
  setTimeout:(fn)=>{fn();return 1},
  clearTimeout:()=>{},
  queueMicrotask:fn=>fn(),
  addEventListener:()=>{},
  dispatchEvent:()=>true,
  CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},
  CivweaveModelRuntime:{generate:runtimeGenerate},
  CivweaveGuideGenerationTrackerV1:{install:()=>order.push('tracker-install')},
  CivweaveLocalModelDownloadV266:{selection:()=>({active:true,id:'gemma4-e2b-it-litert-web'})},
  CivweaveUnifiedChatSystemV1:{
    learningJourneyIntent:(text)=>/\b(?:teach|learn|memorize|study|master)\b/i.test(String(text||''))
  }
};
context.globalThis=context;
context.CivweaveGemma4WeaveDraftPipelineV1={
  version:'1.0.0-gemma4-weave-draft-pipeline-v1-plan-compile-repair',
  install(){order.push('pipeline-install');const prior=context.CivweaveModelRuntime.generate;const generate=async request=>prior(request);generate.__civweaveWeaveDraftPipelineV1=this.version;generate.__prior=prior;context.CivweaveModelRuntime.generate=generate;return true},
  installRuntime(){return this.install()}
};
context.CivweaveGemma4LiteRTRequestAuthorityV1={
  selectedFast:()=>true,
  ensure:async()=>{order.push('ensure');context.CivweaveGemma4WeaveDraftPipelineV1.install();return true},
  installFamilyLoaderWeaveRebind:()=>{order.push('family-loader-rebind');return true}
};
const expected={provider:'downloaded-local',model:'gemma4-e4b-it-litert-web',response:{answer:'Learning Journey ready'}};
context.CivweaveGemma4StructuredTaskAuthorityV1={
  intakeFirst:true,
  intakeEligible:args=>args?.systemId==='civweave'&&Boolean(args?.text),
  intakeRespond:async args=>{intakeArgsSeen=args;order.push('intake');return expected},
  syncStopButton:()=>order.push('stop-ui')
};
context.CivweaveAssistantV141={respond:async args=>{priorCalls+=1;return{provider:'downloaded-local',model:'gemma4-e2b-it-litert-web',response:{answer:`legacy:${args?.text||''}`}}}};

vm.createContext(context);
vm.runInContext(source,context,{filename:'gemma4-first-request-intake-bridge-v1.js'});
assert.equal(context.CivweaveGemma4FirstRequestIntakeBridgeV1.install(),true);

const result=await context.CivweaveAssistantV141.respond({systemId:'civweave',text:'Can you teach me how to learn and memorize the tarot?'});
assert.deepEqual(JSON.parse(JSON.stringify(result)),expected);
assert.equal(priorCalls,0,'eligible local Weaveling request fell through to the stale selected-model path');
assert.ok(order.indexOf('ensure')>=0,'first-request authority was not ensured');
assert.ok(order.indexOf('pipeline-install')>order.indexOf('ensure'),'Weave pipeline was not installed after first-request bootstrap');
assert.ok(order.indexOf('intake')>order.indexOf('pipeline-install'),'E2B intake started before the Weave runtime was authoritative');
assert.equal(context.CivweaveGemma4FirstRequestIntakeBridgeV1.state().pipelineActive,true,'Weave pipeline is not visible in the runtime chain');

const ordinary=await context.CivweaveAssistantV141.respond({systemId:'living-school',text:'hello'});
assert.equal(ordinary.response.answer,'legacy:hello');
assert.equal(priorCalls,1,'ordinary Living School chat did not preserve the prior assistant path');

intakeArgsSeen=null;
const mossLearning=await context.CivweaveAssistantV141.respond({systemId:'living-school',text:'Can you teach me how to read and memorize the tarot?'});
assert.deepEqual(JSON.parse(JSON.stringify(mossLearning)),expected);
assert.equal(priorCalls,1,'Living School learning intent fell through to the old direct strict-JSON path');
assert.equal(intakeArgsSeen?.systemId,'civweave','Living School learning intent was not normalized into the mandatory Weaveling E2B intake route');
assert.equal(intakeArgsSeen?.sourceSystemId,'living-school','Living School source system was not preserved across intake normalization');
assert.equal(intakeArgsSeen?.sourceGuide,'Moss','Moss source identity was not preserved across intake normalization');
assert.equal(context.CivweaveGemma4FirstRequestIntakeBridgeV1.livingSchoolLearningIntake,true);

console.log('PASS: local Gemma learning intent from both Weaveling and Moss enters E2B intake before E4B Weave generation, while ordinary Living School chat keeps its prior route.');