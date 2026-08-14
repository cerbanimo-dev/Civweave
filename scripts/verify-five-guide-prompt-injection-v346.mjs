import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../public/app/assistant-runtime-v141.js',import.meta.url),'utf8');
new Function(source);
for(const token of [
  "MINILM_ID='Xenova/all-MiniLM-L6-v2'",
  'CORE_PROMPT=',
  "civweave:{name:'Weaveling'",
  "'living-school':{name:'Moss'",
  "cerbanimo:{name:'Kamiya'",
  "fellowfare:{name:'Rook'",
  "anarchadia:{name:'Merlin'",
  'function promptHistory(ctx)',
  'function compactContext(ctx)',
  "provider:'downloaded-local'",
  "provider:'server-auto'",
  'migratedSidecar:true',
  'sidecarModel:MINILM_ID',
  'guidePrompts:Object.freeze',
  "purpose:'civweave-guide-response-v141'"
])assert.ok(source.includes(token),`assistant runtime is missing ${token}`);
assert.ok(!source.includes("model:MINILM_ID,endpoint:'/app/models/all-minilm-l6-v2"),'MiniLM must not be configured as a chat generator.');
assert.ok(!source.includes('Structured context:\\n${JSON.stringify(ctx)}'),'guide chat should not dump the entire context object into one user prompt.');

const memory=new Map([['civweave.universal-ai.v127',JSON.stringify({provider:'minilm',model:'Xenova/all-MiniLM-L6-v2'})]]);
const sandbox={
  console,URLSearchParams,
  location:{pathname:'/app/working-campus-v156.html',search:'',hostname:'example.test'},
  localStorage:{getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,value)},
  document:{documentElement:{dataset:{}},body:{dataset:{},append(){}},querySelectorAll:()=>[],createElement:()=>({addEventListener(){},showModal(){},open:false})},
  MutationObserver:class{observe(){}},addEventListener(){},structuredClone:globalThis.structuredClone,CustomEvent:class{},
  CivweaveModelRuntime:{readSharedConfig:()=>null},
  CivweaveLocalModelDownloadV266:{selection:()=>({active:false,id:''})}
};
sandbox.globalThis=sandbox;
vm.runInNewContext(source,sandbox,{filename:'assistant-runtime-v141.js'});
const assistant=sandbox.CivweaveAssistantV141;
assert.equal(assistant.selectedConfig().provider,'server-auto','legacy MiniLM chat selection must migrate to the generative route');
assert.equal(assistant.sidecarModel,'Xenova/all-MiniLM-L6-v2');

const realms={civweave:'Civweave','living-school':'Living School',cerbanimo:'Cerbanimo',fellowfare:'FellowFare',anarchadia:'Anarchadia'};
const systemPrompts=new Map();
for(const [system,realm] of Object.entries(realms)){
  const ctx={guide:{system,realm},currentContext:{roomLabel:'Test Room',roomPurpose:'Test purpose'},recentConversation:[{role:'user',text:'Earlier question'},{role:'assistant',text:'Earlier answer'},{role:'user',text:'Current question'}],userMessage:'Current question',routingAnswer:{system,mode:'Reflect',room:'test.room',confidence:.5},actionDraft:null};
  const messages=assistant.prompt(ctx);
  assert.equal(messages[0].role,'system');
  assert.ok(messages[0].content.includes(assistant.guidePrompts[system]),`${system} role prompt was not injected`);
  assert.equal(messages.at(-1).role,'user');
  assert.ok(messages.at(-1).content.includes('Current question'));
  assert.equal(messages.filter(row=>row.role==='user'&&row.content==='Current question').length,0,'current user message should not be duplicated in history');
  systemPrompts.set(system,messages[0].content);
}
assert.equal(new Set(systemPrompts.values()).size,5,'all five guides must receive distinct system prompts');

sandbox.CivweaveLocalModelDownloadV266.selection=()=>({active:true,id:'smollm2-135m-instruct-q8-wasm'});
assert.deepEqual(JSON.parse(JSON.stringify(assistant.selectedConfig())),{provider:'downloaded-local',route:'downloaded-local',model:'smollm2-135m-instruct-q8-wasm',externalConsent:false});

console.log(JSON.stringify({ok:true,guidePrompts:5,minilm:'sidecar-only',activeLocal:'generative-model-choice',promptInjection:'system-role-plus-history-plus-compact-context'},null,2));
