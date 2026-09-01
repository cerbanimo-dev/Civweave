#!/usr/bin/env node
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';

const root=resolve(new URL('..',import.meta.url).pathname);
const file=relative=>readFileSync(resolve(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const includes=(text,needle,label)=>assert(text.includes(needle),`${label} is missing ${needle}`);
const excludes=(text,needle,label)=>assert(!text.includes(needle),`${label} still contains retired source: ${needle}`);
const syntax=relative=>{const result=spawnSync(process.execPath,['--check',resolve(root,relative)],{encoding:'utf8'});assert(result.status===0,`${relative} failed node --check:\n${result.stderr||result.stdout}`)};

for(const path of [
  'public/app/intention-planner-v141.js',
  'public/app/server-ai-output-normalizer-v1.js',
  'public/service-worker-local-ai-coherence-v307.js',
  'public/service-worker-v203.js',
  'public/service-worker.js'
])syntax(path);

const planner=file('public/app/intention-planner-v141.js');
includes(planner,'1.1.0-intention-planner-v141-ai-authority-only','canonical intention planner');
includes(planner,"error.code='QUEST_AI_AUTHORING_REQUIRED'",'canonical intention planner');
includes(planner,'function maybeCreate(options={})','canonical intention planner');
includes(planner,'return null;','canonical intention planner');
includes(planner,'deterministicQuestCreation:false','canonical intention planner');
excludes(planner,'function learningPath(', 'canonical intention planner');
excludes(planner,'function skilledPath(', 'canonical intention planner');
excludes(planner,'deterministic lexical', 'canonical intention planner');
excludes(planner,"title:'Learn what the intention requires'", 'canonical intention planner');

const storage=new Map();
const sandbox={
  console,Date,Math,Object,Array,String,Number,Boolean,RegExp,JSON,Promise,
  localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},
  dispatchEvent:()=>{},CustomEvent:class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}},
  structuredClone:value=>JSON.parse(JSON.stringify(value))
};
sandbox.globalThis=sandbox;
vm.runInNewContext(planner,sandbox,{filename:'intention-planner-v141.js'});
const api=sandbox.CivweaveIntentionPlanner;
assert(api?.aiQuestOnly===true,'canonical planner did not declare AI-only authority');
assert(api.shouldCreate({text:'Teach me to read',context:{currentContext:{systemId:'civweave'}}})===true,'Teach me to read was not recognized as Quest intent');
assert(api.shouldCreate({text:'Hello me and my friends create a basement arcade business',context:{currentContext:{systemId:'civweave'}}})===true,'greeting-prefixed collective project intent was not recognized');
assert(api.maybeCreate({text:'Teach me to read',context:{currentContext:{systemId:'civweave'}}})===null,'maybeCreate still manufactured a Quest');
let buildBlocked=false;try{api.buildPlan({text:'Teach me to read'})}catch(error){buildBlocked=error?.code==='QUEST_AI_AUTHORING_REQUIRED'}
assert(buildBlocked,'buildPlan did not fail closed on deterministic Quest construction');
const deterministic={schema:'civweave.intention-weave.v1',id:'det',title:'Teach me to read',wish:'Teach me to read',authoring:{mode:'deterministic',aiGenerated:false,provider:'civweave-platform-planner'}};
let persistBlocked=false;try{api.persist(deterministic)}catch(error){persistBlocked=error?.code==='QUEST_AI_AUTHORING_REQUIRED'}
assert(persistBlocked,'deterministic platform plan still persisted');
const aiPlan={schema:'civweave.intention-weave.v1',id:'ai',title:'Reading Quest',wish:'Teach me to read',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),authoring:{mode:'model-structured-json',aiGenerated:true,provider:'cloudflare-workers-ai',model:'@cf/zai-org/glm-4.7-flash'},paths:[]};
assert(api.persist(aiPlan)?.plan?.authoring?.aiGenerated===true,'valid AI-authored Quest could not persist');

const campus=file('public/app/working-campus-v156.html');
includes(campus,'working-campus-v199-ai-quest-authority','Working Campus HTML');
includes(campus,"Generate Quest with AI",'Working Campus HTML');
includes(campus,'persistenceAuthority:false','Working Campus HTML');
includes(campus,'server-ai-output-normalizer-v1.js?v=1.0.0','Working Campus HTML');
excludes(campus,"mode:'deterministic'",'Working Campus HTML');
excludes(campus,'Deterministic templates are being ranked','Working Campus HTML');
excludes(campus,'Building Quest with local templates','Working Campus HTML');
excludes(campus,'composer.composePath','Working Campus HTML');
excludes(campus,'function canonical(plan)','Working Campus HTML');
excludes(campus,'function handoffs(plan)','Working Campus HTML');

const normalizer=file('public/app/server-ai-output-normalizer-v1.js');
const normalizerSandbox={
  console,Object,Array,String,Number,Boolean,RegExp,JSON,Promise,
  globalThis:null,
  addEventListener:()=>{},dispatchEvent:()=>{},CustomEvent:class CustomEvent{},
  queueMicrotask:fn=>fn(),setInterval:()=>0,clearInterval:()=>{},
};
normalizerSandbox.globalThis=normalizerSandbox;
vm.runInNewContext(normalizer,normalizerSandbox,{filename:'server-ai-output-normalizer-v1.js'});
const output=normalizerSandbox.CivweaveServerAIOutputNormalizerV1;
const raw=JSON.stringify({id:'chatcmpl-test',choices:[{message:{role:'assistant',content:'Test received.',reasoning:'PRIVATE REASONING MUST NOT RENDER',reasoning_content:'PRIVATE REASONING MUST NOT RENDER'}}],usage:{neurons:15}});
assert(output.completionText(raw)==='Test received.','Workers AI completion content was not extracted');
assert(!output.completionText(raw).includes('PRIVATE REASONING'),'Workers AI reasoning leaked through completion extraction');
const packet=output.normalizePacket({handled:true,result:{status:'success',outputText:raw,actual:{provider:'cloudflare-workers-ai',model:'@cf/zai-org/glm-4.7-flash'}}});
assert(packet.result.outputText==='Test received.','normalized server-auto packet still contains raw completion JSON');

const questObject={
  title:'Manifestation principles into a web app',
  wish:'Learn manifestation principles and use them to create a web app',
  outcome:'Understand the practical principles and ship a small web app that applies them.',
  assumptions:['The user wants a practical, testable learning path rather than supernatural guarantees.'],
  paths:[{type:'learning',realm:'living-school',title:'Learn manifestation as intentional practice',purpose:'Separate useful goal-setting, attention, visualization, and action principles from unsupported certainty claims.',steps:['Study intention and goal formulation.','Practice visualization as rehearsal.','Connect each intention to observable action.'],completionCriteria:'The user can explain the principles and their limits.',evidence:['Written principles summary']}],
  confidence:.92
};
const questEnvelope=JSON.stringify({id:'chatcmpl-quest',object:'chat.completion',choices:[{message:{role:'assistant',content:`\`\`\`json\n${JSON.stringify(questObject)}\n\`\`\``}}]});
const structuredPacket=output.normalizePacket({status:'success',outputText:questEnvelope,outputJson:null,structured:{requested:true,valid:true,repairAttempts:0},actual:{provider:'cloudflare-workers-ai',model:'@cf/zai-org/glm-4.7-flash'}});
assert(structuredPacket.status==='success','valid structured completion envelope was incorrectly failed');
assert(structuredPacket.structured?.valid===true,'recovered structured completion was not marked valid');
assert(structuredPacket.outputJson?.title===questObject.title,'Quest JSON inside Workers AI completion content was not recovered into outputJson');
assert(structuredPacket.outputJson?.paths?.[0]?.realm==='living-school','recovered Quest JSON lost nested path data');
assert(structuredPacket.diagnostics?.some(item=>item?.code==='WORKERS_AI_STRUCTURED_OUTPUT_RECOVERED'),'structured recovery was not diagnosed');
const invalidEnvelope=JSON.stringify({id:'chatcmpl-invalid',object:'chat.completion',choices:[{message:{role:'assistant',content:'I finished, but this is not JSON.'}}]});
const invalidStructured=output.normalizePacket({status:'success',outputText:invalidEnvelope,outputJson:null,structured:{requested:true,valid:true,repairAttempts:0},actual:{provider:'cloudflare-workers-ai',model:'@cf/zai-org/glm-4.7-flash'}});
assert(invalidStructured.status==='invalid-response','structured server response without JSON still reported success');
assert(invalidStructured.structured?.valid===false,'structured server response without JSON still reported valid');
assert(invalidStructured.error?.code==='INVALID_STRUCTURED_OUTPUT','structured server response without JSON did not expose a useful failure code');

const coherence=file('public/service-worker-local-ai-coherence-v307.js');
includes(coherence,'local-ai-code-v322-ai-quest-source-authority','installed PWA coherence');
includes(coherence,"'/app/working-campus-v156.html'",'installed PWA coherence');
includes(coherence,"'/app/server-ai-output-normalizer-v1.js'",'installed PWA coherence');
includes(coherence,'workingCampusQuestPageCurrentBytes: true','installed PWA coherence');
includes(coherence,'serverAIOutputNormalizerCurrentBytes: true','installed PWA coherence');
const sw203=file('public/service-worker-v203.js');
includes(sw203,'local-ai-code-v322-ai-quest-source-authority','v203 service worker');
const rootWorker=file('public/service-worker.js');
includes(rootWorker,'root-worker-bridge-v10-ai-quest-source-authority','root service worker');
includes(rootWorker,"'/app/server-ai-output-normalizer-v1.js'",'root service worker');

console.log('PASS Quest source authority is AI-only, Workers AI structured Quest envelopes are recovered, invalid structured completions fail closed, and reasoning cannot render.');
