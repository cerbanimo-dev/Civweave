import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const read=path=>fs.readFileSync(path,'utf8');
const routerPath='public/app/minilm-response-router-v347.js';
const loaderPath='public/app/shared-guide-surface-v236.js';
const source=read(routerPath),loader=read(loaderPath);
for(const path of [routerPath,loaderPath])execFileSync(process.execPath,['--check',path],{stdio:'inherit'});
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
  "structured-artifact-network-route"
])assert.ok(source.includes(marker),`missing response-router marker: ${marker}`);
assert.ok(loader.includes('/app/minilm-response-router-v347.js?v=1.0.0-response-router-v347'),'shared guide loader must install the response router');
const context={
  globalThis:null,
  document:{scripts:[],head:{append(){}},createElement(){return{dataset:{},addEventListener(){}}}},
  location:{href:'https://example.test/app/'},navigator:{},
  CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},
  dispatchEvent(){return true},addEventListener(){},setInterval(){return 1},clearInterval(){},setTimeout,clearTimeout,structuredClone,URL,console,
};
context.globalThis=context;vm.createContext(context);vm.runInContext(source,context,{filename:routerPath});
const api=context.CivweaveResponseRouterV347;assert.ok(api,'response router API missing');
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
const tinyRequest={purpose:'civweave-guide-response-v141',config:{provider:'downloaded-local',route:'downloaded-local',model:'smollm2-135m-instruct-q8-wasm'},context:{guide:{system:'living-school'}},messages:[{role:'system',content:'THIS FULL PROMPT SHOULD BE REPLACED FOR TINY MODELS'},{role:'user',content:'Explain reinforcement.'}]};
const tiny=api.applyGuideLanguage(tinyRequest);
assert.equal(tiny.guidePromptProfile,'tiny-condensed');
assert.equal(tiny.messages[0].role,'system');
assert.ok(tiny.messages[0].content.includes('You are Moss.'));
assert.ok(tiny.messages[0].content.includes('user=Hero'));
assert.ok(!tiny.messages[0].content.includes('THIS FULL PROMPT SHOULD BE REPLACED'));
const full=api.applyGuideLanguage({...tinyRequest,config:{provider:'server-auto',route:'server-auto',model:'civweave-server-auto'}});
assert.equal(full.guidePromptProfile,'full');
assert.ok(full.messages[0].content.includes('Civweave language pack:'));
assert.ok(full.messages[0].content.includes('THIS FULL PROMPT SHOULD BE REPLACED'));
const mossRule=api.ruleArtifact("Ok let's make a learning path that teaches parents gentle parenting",{context:{guide:{system:'living-school'}}});
assert.equal(mossRule.id,'curriculum');
const route=await api.classify("Ok let's make a learning path that teaches parents gentle parenting",{context:{guide:{system:'living-school'}},task:{kind:'dialogue',systemId:'living-school',requirements:{planning:false}}});
assert.equal(route.artifactClass,'curriculum');
assert.equal(route.networkRequired,true);
assert.equal(route.lengthClass,'fast');
const network=api.forceNetworkForArtifact(tinyRequest,route);
assert.equal(network.config.provider,'server-auto');
assert.equal(network.config.route,'server-auto');
assert.equal(network.config.model,'civweave-server-auto');
const declared=api.declaredArtifact({context:{guide:{system:'fellowfare'}},task:{kind:'resource-draft'}});
assert.equal(declared.id,'resource');
console.log('PASS MiniLM response-length, guide-language, tiny-prompt, and structured-artifact router v347.');
