import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const read=path=>fs.readFileSync(path,'utf8');
const routerPath='public/app/minilm-response-router-v347.js';
const loaderPath='public/app/shared-guide-surface-v236.js';
const unifiedPath='public/app/unified-chat-system-v1.js';
const source=read(routerPath),loader=read(loaderPath),unified=read(unifiedPath);
for(const path of [routerPath,loaderPath,unifiedPath])execFileSync(process.execPath,['--check',path],{stdio:'inherit'});
for(const marker of [
  "maxWords:50",
  "minWords:100,maxWords:200",
  "minWords:250,maxWords:800",
  "minWords:900,maxWords:null",
  "gemma3-1b-it-q4f16",
  "qwen3-0.6b-q4f16",
  "qwen3-1.7b-q4f16",
  "smollm3-3b-q4f16",
  "gemma4-e2b-it-q2f16-mobile",
  "gemma4-e4b-it-q2f16-mobile",
  "reviewRequired:true",
  "purpose:'civweave-high-tier-review'",
  "__civweaveSkipResponseRouter:true",
  "installIfMissing:false",
  "settingsAutostart:false",
  "user=Hero",
  "operator=Guildkeeper",
  "regional charter role=Charterkeeper",
  "map=Guild Map",
  "Rook=Quartermaster",
  "tiny-condensed",
  "artifactClass:route.artifactClass",
  "provider:'server-auto'",
  "structured-artifact-network-route",
  "deterministic-thread-fallback",
  "deterministic-realm-fallback",
  "minilmPrimary:true",
  "deterministicFallbackOnly:true",
  "directNetworkHandle",
  "registerSpineInterceptor",
  "Local generation was intentionally skipped"
])assert.ok(source.includes(marker),`missing response-router marker: ${marker}`);
const artifactIntentBody=source.slice(source.indexOf('async function artifactIntent'),source.indexOf('\nfunction tierFor',source.indexOf('async function artifactIntent')));
assert.ok(artifactIntentBody.indexOf('semanticRank(')>=0,'artifact intent must call MiniLM semanticRank');
assert.ok(artifactIntentBody.indexOf('semanticRank(')<artifactIntentBody.indexOf('continuationArtifact('),'MiniLM must classify free-form artifact prompts before deterministic continuation fallback');
assert.ok(artifactIntentBody.indexOf('semanticRank(')<artifactIntentBody.indexOf('ruleArtifact('),'MiniLM must classify free-form artifact prompts before deterministic realm rules');
const classifyBody=source.slice(source.indexOf('async function classify'),source.indexOf('\nfunction userText',source.indexOf('async function classify')));
assert.ok(classifyBody.indexOf("semanticRank(text,TASK_PROTOTYPES")>=0,'task routing must call MiniLM');
assert.ok(classifyBody.indexOf("semanticRank(text,TASK_PROTOTYPES")<classifyBody.indexOf('hardTaskClass(text,request)'),'MiniLM must classify task intent before deterministic hard-task fallback');
assert.ok(loader.includes('/app/minilm-response-router-v347.js?v=1.3.0-minilm-primary'),'shared guide loader must cache-bust the MiniLM-primary response router');
assert.ok(loader.includes('/app/unified-chat-system-v1.js?v=1.0.2-learning-continuation'),'shared guide loader must cache-bust the learning-continuation unified chat runtime');
assert.ok(unified.includes("'civweave:assistant-runtime-ready'"),'unified chat must reattach after assistant runtime readiness');
assert.ok(unified.includes("'civweave:response-router-installed'"),'unified chat must reattach after response-router replacement');
assert.ok(unified.includes("'civweave:guide-chat-opened'"),'opening chat must self-heal a missing assistant wrapper');
assert.ok(unified.includes('learning plan|study plan'),'unified Living School detector must recognize learning-plan wording as a deterministic fallback');
assert.ok(unified.includes('const CONTINUE='),'unified Living School detector must preserve thread continuation cues');
const registrations=[];
const context={
  globalThis:null,
  document:{scripts:[],head:{append(){}},createElement(){return{dataset:{},addEventListener(){}}}},
  location:{href:'https://example.test/app/'},navigator:{},
  CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},
  dispatchEvent(){return true},addEventListener(){},setInterval(){return 1},clearInterval(){},setTimeout,clearTimeout,structuredClone,URL,console,queueMicrotask,
  CivweaveFastInteractiveV192:{register(id,hooks,priority){registrations.push({id,hooks,priority});return()=>{}}}
};
context.globalThis=context;vm.createContext(context);vm.runInContext(source,context,{filename:routerPath});
const api=context.CivweaveResponseRouterV347;assert.ok(api,'response router API missing');
assert.equal(api.minilmPrimary,true);
assert.equal(api.deterministicFallbackOnly,true);
assert.equal(api.fallbackLength('Answer in 50 words or less.'),'short');
assert.equal(api.fallbackLength('Give me 100-200 words on this.'),'medium');
assert.equal(api.fallbackLength('Write 250-800 words on this.'),'fast');
assert.equal(api.fallbackLength('Write at least 900 words on this.'),'smart');
assert.equal(api.hardTaskClass('Fix this JavaScript race condition and merge the PR.'),'programming');
assert.equal(api.hardTaskClass('Go ahead and implement this and monitor it.'),'agentic');
assert.equal(api.hardTaskClass('What is a fox?'),'ordinary');
assert.deepEqual([...api.tiers.short.preferredModelIds].slice(0,2),['gemma3-1b-it-q4f16','qwen3-0.6b-q4f16']);
assert.deepEqual([...api.tiers.medium.preferredModelIds],['qwen3-1.7b-q4f16','smollm3-3b-q4f16']);
assert.equal(api.tiers.fast.preferredModelIds[0],'gemma4-e2b-it-q2f16-mobile');
assert.equal(api.tiers.smart.preferredModelIds[0],'gemma4-e4b-it-q2f16-mobile');
assert.ok(api.tinyModels.includes('smollm2-135m-instruct-q8-wasm'));
for(const term of ['Hero','Quest','Party','Guild','Guildkeeper','Charterkeeper','Guild Map','Quartermaster'])assert.ok(api.languagePack.full.includes(term),`language pack missing ${term}`);
const guideNames={civweave:'Weaveling','living-school':'Moss',cerbanimo:'Kamiya',fellowfare:'Rook',anarchadia:'Merlin'};
for(const [system,name] of Object.entries(guideNames)){
  const tinyRequest={purpose:'civweave-guide-response-v141',config:{provider:'downloaded-local',route:'downloaded-local',model:'smollm2-135m-instruct-q8-wasm'},context:{guide:{system}},messages:[{role:'system',content:'THIS FULL PROMPT SHOULD BE REPLACED FOR TINY MODELS'},{role:'user',content:'Give me a short answer.'}]};
  const tiny=api.applyGuideLanguage(tinyRequest);
  assert.equal(tiny.guidePromptProfile,'tiny-condensed',`${name} should use the tiny prompt profile`);
  assert.equal(tiny.messages[0].role,'system');
  assert.ok(tiny.messages[0].content.includes(`You are ${name}`),`${name} identity missing from tiny prompt`);
  assert.ok(tiny.messages[0].content.includes('user=Hero'),`${name} tiny prompt missing Hero vocabulary`);
  assert.ok(tiny.messages[0].content.includes('operator=Guildkeeper'),`${name} tiny prompt missing Guildkeeper vocabulary`);
  assert.ok(!tiny.messages[0].content.includes('THIS FULL PROMPT SHOULD BE REPLACED'),`${name} retained oversized prompt in tiny mode`);
}
const fullRequest={purpose:'civweave-guide-response-v141',config:{provider:'server-auto',route:'server-auto',model:'civweave-server-auto'},context:{guide:{system:'living-school'}},messages:[{role:'system',content:'KEEP THIS FULL MOSS PROMPT'},{role:'user',content:'Explain reinforcement.'}]};
const full=api.applyGuideLanguage(fullRequest);
assert.equal(full.guidePromptProfile,'full');
assert.ok(full.messages[0].content.includes('Civweave language pack:'));
assert.ok(full.messages[0].content.includes('KEEP THIS FULL MOSS PROMPT'));
// Exact phrases belong in regression tests only. In this VM MiniLM is intentionally unavailable,
// so these assertions prove the deterministic safety net still works without making it primary.
const fallbackRequest={context:{guide:{system:'living-school'}},task:{kind:'dialogue',systemId:'living-school',requirements:{planning:false}}};
const mossRule=api.ruleArtifact("Ok let's make a learning path that teaches parents gentle parenting",fallbackRequest);
assert.equal(mossRule.id,'curriculum');
const learningPlanRule=api.ruleArtifact('Can you help me make a learning plan that teaches parents gentle parenting?',fallbackRequest);
assert.equal(learningPlanRule.id,'curriculum');
const route=await api.classify("Ok let's make a learning path that teaches parents gentle parenting",fallbackRequest);
assert.equal(route.artifactClass,'curriculum');
assert.equal(route.networkRequired,true);
assert.equal(route.lengthClass,'fast');
assert.equal(route.source,'deterministic-realm-fallback');
const network=api.forceNetworkForArtifact({purpose:'civweave-guide-response-v141',config:{provider:'downloaded-local',route:'downloaded-local',model:'smollm2-135m-instruct-q8-wasm'},context:{guide:{system:'living-school'}},messages:[]},route);
assert.equal(network.config.provider,'server-auto');
assert.equal(network.config.route,'server-auto');
assert.equal(network.config.model,'civweave-server-auto');
assert.equal(network.__civweaveNetworkRequired,true);
const continuationRequest={
  context:{guide:{system:'living-school'},recentConversation:[
    {role:'user',text:'Build a course for parents about calm boundaries and co-regulation.'},
    {role:'assistant',text:'partial learning plan'},
    {role:'user',text:'.'}
  ]},
  messages:[
    {role:'user',content:'Build a course for parents about calm boundaries and co-regulation.'},
    {role:'assistant',content:'partial learning plan'},
    {role:'user',content:'.'}
  ],
  task:{kind:'dialogue',systemId:'living-school',requirements:{planning:false}}
};
assert.ok(api.semanticArtifactPrompt('.',continuationRequest).includes('Build a course for parents'),'MiniLM continuation query must include the prior user intent');
const continuation=await api.classify('.',continuationRequest);
assert.equal(continuation.artifactClass,'curriculum');
assert.equal(continuation.networkRequired,true);
assert.equal(continuation.source,'deterministic-thread-fallback');
assert.equal(api.continuationCue('.'),true);
assert.equal(api.continuationCue('continue'),true);
assert.equal(api.continuationCue('Tell me a joke'),false);
assert.ok(registrations.some(row=>row.id==='minilm-response-router-v347'&&row.priority===120),'response router must register on the runtime spine before local inference');
const declared=api.declaredArtifact({context:{guide:{system:'fellowfare'}},task:{kind:'resource-draft'}});
assert.equal(declared.id,'resource');
console.log('PASS MiniLM-primary prompt classification, deterministic-only fallback, five-guide language, tiny-prompt, thread continuation, spine network gate, and structured-artifact router v347.');