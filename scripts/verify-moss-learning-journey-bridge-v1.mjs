import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const boundary=fs.readFileSync('public/app/install-boundary-v146.js','utf8');
const unified=fs.readFileSync('public/app/unified-chat-system-v1.js','utf8');

assert.match(boundary,/const UNIFIED_CHAT_SYSTEM='\/app\/unified-chat-system-v1\.js';/,'Install boundary must name the unified chat capability layer explicitly.');
const experienceMatch=boundary.match(/const SYSTEM_EXPERIENCE_SCRIPTS=\[([^;]+)\];/s);
assert.ok(experienceMatch,'System experience script list is missing.');
const experience=experienceMatch[1];
assert.ok(experience.includes('GUIDE_WORKSPACE,UNIFIED_CHAT_SYSTEM'),'Unified capability layer must load immediately after the canonical guide chat surface.');
assert.ok(experience.indexOf('UNIFIED_CHAT_SYSTEM')<experience.indexOf('SHARED_GUIDE_SURFACE'),'Unified capability layer must load before the slower shared-guide dependency chain.');
const compatibilityMatch=boundary.match(/const COMPATIBILITY_SCRIPTS=\[([^;]+)\];/s);
assert.ok(compatibilityMatch?.[1].includes('GUIDE_WORKSPACE,UNIFIED_CHAT_SYSTEM'),'Compatibility surfaces must also load the unified capability layer with chat.');

const persisted=new Map();
const sandbox={
  console,
  URL,
  URLSearchParams,
  Date,
  Math,
  JSON,
  Object,
  Array,
  String,
  Number,
  Boolean,
  RegExp,
  Promise,
  Set,
  Map,
  setTimeout,
  clearTimeout,
  queueMicrotask:callback=>callback(),
  addEventListener:()=>{},
  dispatchEvent:()=>true,
  CustomEvent:function CustomEvent(type,init={}){this.type=type;this.detail=init.detail},
  localStorage:{getItem:key=>persisted.get(key)||null,setItem:(key,value)=>persisted.set(key,value),removeItem:key=>persisted.delete(key)},
  document:{
    readyState:'complete',
    documentElement:{dataset:{}},
    getElementById:()=>null,
    scripts:[],
    head:{append:()=>{}},
    querySelectorAll:()=>[]
  }
};
sandbox.globalThis=sandbox;
vm.runInNewContext(unified,sandbox,{filename:'unified-chat-system-v1.js'});
const api=sandbox.CivweaveUnifiedChatSystemV1;
assert.ok(api,'Unified chat API did not initialize.');
assert.equal(api.learningJourneyIntent('I would like to learn to read Tarot',[]),true,'A direct Moss learning goal must enter Learning Journey planning instead of ordinary dialogue.');
const request=api.curriculumRequest({text:'I would like to learn to read Tarot',history:[]});
assert.equal(request.intent,'new','A direct Moss learning goal must create a new Learning Journey request.');
assert.equal(request.newPath,true,'A direct Moss learning goal must be marked as a new path.');
assert.equal(request.capability.toLowerCase(),'read tarot','The Tarot learning goal must survive intent normalization as the requested capability.');
assert.equal(request.count,4,'A new Moss Learning Journey should retain the default four-module request when no module count is specified.');


// Fail closed if a previous-topic plan or Cloudflare fallback is substituted
// for the currently requested tarot plan while user's Qwen GGUF is selected.
const selectionKey='civweave.mobile.gguf-primary.v2',profileKey='civweave-model-profiles-v1';
const ggufModel='qwen35-4b-imported-gguf';
const ggufConfig={provider:'openai-compatible',route:'openai-compatible',model:ggufModel,endpoint:'http://127.0.0.1:8080/v1'};
persisted.set(selectionKey,JSON.stringify({enabled:true,engine:'wllama',model:ggufModel,importId:'file-test'}));
persisted.set(profileKey,JSON.stringify({interactive:ggufConfig}));
let interactive=ggufConfig,output=null,calls=0;
sandbox.CivweaveFamilyAILoaderV105={ensure:async()=>true};
sandbox.CivweaveAssistantV141={selectedConfig:()=>({provider:'downloaded-local',model:'gemma4-e2b-it-litert-web'})};
sandbox.CivweaveModelRuntime={
  readSharedConfig:()=>interactive,
  generate:async ({config,context,messages,ggufNoGrammar,maxRepairAttempts,responseFormat,schema})=>{
    calls++;
    assert.equal(config.model,interactive.model,'Moss must honor canonical imported browser GGUF over stale Gemma selection.');
    assert.equal(context.request.capability.toLowerCase(),'read and memorize the tarot');
    if(context.request.intent==='new')assert.equal(context.recentConversation.length,0,'New learning goal must not inherit unrelated old chat topics.');
    assert.ok(messages[1].content.includes('tarot'));
    assert.equal(ggufNoGrammar,config.provider==='openai-compatible','Only embedded GGUF draft skips expensive JSON grammar.');
    if(ggufNoGrammar){
      assert.equal(config.maxTokens,512,'Phone GGUF must use a small bound on tokens.');
      assert.equal(maxRepairAttempts,0,'Phone GGUF must not enter another long automatic repair generation.');
      assert.equal(responseFormat,'json');
      assert.ok(schema?.properties?.modules?.items?.required?.includes('outcome'),'Independent schema verification must remain enabled.');
      assert.ok(messages[1].content.length<1700,'Phone GGUF prompt must not include the old multi-KB context packet.');
      assert.ok(messages[1].content.includes('modules'));
    }

    return output;
  }
};
const run=()=>api.generateLivingSchoolPlan({
  text:'Can you teach me how to read and memorize the tarot?',
  history:[{role:'user',text:'Teach me the principles of manifestation and build a web app'}]
});
const offTopic={
  title:'The Principles Of Manifestation And Then Help Me',
  capability:'the principles of manifestation and then help me use that skill to create a web app',
  level:'beginner',mode:'guided',proof:'A web app',
  modules:[
    {title:'Defining the Vision',focus:'manifestation and app goals',outcome:'specification'},
    {title:'Architecting the Application',focus:'app features',outcome:'architecture'},
    {title:'Constructing the Artifact',focus:'build a web app',outcome:'prototype'}
  ],
  assumptions:[]
};
const matching={
  title:'Reading and memorizing tarot',
  capability:'read and memorize the tarot',
  level:'beginner',mode:'guided',proof:'independent three-card reading',
  modules:[
    {title:'Major Arcana',focus:'memorize the tarot archetypes',outcome:'name 22 cards'},
    {title:'Minor Arcana',focus:'learn tarot suits',outcome:'identify 56 cards'},
    {title:'Reading spreads',focus:'interpret tarot combinations',outcome:'complete three-card reading'}
  ],assumptions:[]
};
const manifestKey='civweave.chat.capability.pending.living-school.plan.v1';
output={status:'success',actual:{provider:'cloudflare-workers-ai',model:'@cf/zai-org/glm-4.7-flash'},outputJson:matching};
let answer=await run();
assert.match(answer.response.answer,/selected imported Qwen GGUF was bypassed/i);
assert.equal(persisted.has(manifestKey),false,'Cloudflare fallback must not become an authorized local learning plan.');
output={status:'success',actual:{provider:'openai-compatible',model:ggufModel},outputJson:offTopic,diagnostics:[{code:'BROWSER_GGUF'}]};
answer=await run();
assert.match(answer.response.answer,/different subject/i);
assert.equal(persisted.has(manifestKey),false,'Off-topic GGUF-generated plan must not be persisted.');
output={status:'success',actual:{provider:'openai-compatible',model:ggufModel},outputJson:matching,diagnostics:[{code:'BROWSER_GGUF'}]};
answer=await run();
assert.match(answer.response.answer,/Learning Journey plan:/);
assert.match(answer.response.answer,/Tarot/i);
assert.equal(persisted.has(manifestKey),true,'Correct verified GGUF plan must be saved for review only.');
const stored=JSON.parse(persisted.get(manifestKey));
assert.equal(stored.request.capability.toLowerCase(),'read and memorize the tarot');
assert.equal(stored.authoring.model,ggufModel);
assert.equal(stored.state,'review');
assert.ok(!stored.approvedAt);
assert.equal(calls,3);
// A terse revision must retain the established Learning Journey goal.
output={status:'success',actual:{provider:'openai-compatible',model:ggufModel},outputJson:matching,diagnostics:[{code:'BROWSER_GGUF'}]};
const revision=await api.generateLivingSchoolPlan({text:'Change module two to emphasize reversed Tarot cards',history:[]},stored,'Change module two to emphasize reversed Tarot cards');
assert.match(revision.response.answer,/Tarot/i);
assert.equal(JSON.parse(persisted.get(manifestKey)).request.capability.toLowerCase(),'read and memorize the tarot','Revising a module must preserve the established Learning Journey goal.');
assert.equal(calls,4);
persisted.delete(manifestKey);
// Even when the user elects server-auto, do not silently save a plan
// whose subject changed from tarot to a previous manifestation/web-app task.
interactive={provider:'server-auto',route:'server-auto',model:'civweave-server-auto-v1'};
sandbox.CivweaveAssistantV141={selectedConfig:()=>interactive};
output={status:'success',actual:{provider:'cloudflare-workers-ai',model:'@cf/zai-org/glm-4.7-flash'},outputJson:offTopic};
answer=await run();
assert.match(answer.response.answer,/different subject/i);
assert.equal(persisted.has(manifestKey),false);


// All five avatar guides must route the canonical active browser GGUF instead
// of a stale downloaded-local Gemma selection. Exercise actual source logic.
const assistantSource=fs.readFileSync('public/app/assistant-runtime-v141.js','utf8');
const guideSource=fs.readFileSync('public/app/guide-chat-surface-v350.js','utf8');
const extract=(source,start,end)=>{
  const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,'Selected-provider function source not found: '+start);
  return source.slice(a,b);
};
const assistantFn=extract(assistantSource,'function selectedConfig(){','async function ledger()');
const guideFn=extract(guideSource,'function selectedLocal(){','function voiceState()');
const candidateSettings={provider:'openai-compatible',route:'openai-compatible',model:ggufModel,endpoint:'http://127.0.0.1:8080/v1'};
const candidateStorage=new Map([
  ['civweave.mobile.gguf-primary.v2',JSON.stringify({enabled:true,engine:'wllama',model:ggufModel})],
  ['civweave-model-profiles-v1',JSON.stringify({interactive:candidateSettings})]
]);
const authority=vm.createContext({
  localStorage:{getItem:k=>candidateStorage.get(k)||null},
  runtime:()=>({readSharedConfig:()=>candidateSettings}),
  activeLocal:()=>({active:true,id:'gemma4-e2b-it-litert-web'}),
  SK:'civweave.universal-ai.v127',MINILM_ID:'Xenova/all-MiniLM-L6-v2',
  clean:(v,n=8000)=>String(v??'').trim().slice(0,n),
  low:v=>String(v??'').toLowerCase(),
  parse:(v,d)=>{try{return JSON.parse(v)??d}catch{return d}},
  provider:v=>v,
});
vm.runInContext(assistantFn+'\nthis.evaluateSelected=selectedConfig;',authority);
assert.equal(authority.evaluateSelected().model,ggufModel,'All avatar guides must choose GGUF, not stale Gemma.');
assert.equal(authority.evaluateSelected().provider,'openai-compatible');
const recovery=vm.createContext({
  localStorage:{getItem:k=>{
    if(k==='civweave.local-ai.selection.v266')return JSON.stringify({active:true,id:'gemma4-e2b-it-litert-web'});
    return candidateStorage.get(k)||null
  }},
  LOCAL_SELECTION_KEY:'civweave.local-ai.selection.v266',
  parse:(v,d)=>{try{return JSON.parse(v)??d}catch{return d}}
});
vm.runInContext(guideFn+'\nthis.evaluateFallback=selectedLocal;',recovery);
assert.equal(recovery.evaluateFallback(),null,'Guide recovery must not start stale Gemma when Qwen browser GGUF is selected.');
candidateStorage.set('civweave-model-profiles-v1',JSON.stringify({interactive:{provider:'server-auto',model:'civweave-server-auto-v1'}}));
assert.equal(recovery.evaluateFallback(),null,'An explicitly changed server-auto route must not awaken an unrelated downloaded-local model.');

console.log('Moss Learning Journey bridge regression check passed.');
