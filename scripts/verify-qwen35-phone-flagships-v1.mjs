#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [registry,packs,settings,runtime,authority,stage]=await Promise.all([
  read('public/app/local-ai/model-registry-v266.js'),
  read('public/app/local-ai/model-packs-v1.js'),
  read('public/app/settings-local-route-v331.js'),
  read('public/app/local-ai/litert-gemma4-fast-runtime-v1.js'),
  read('public/app/local-ai/gemma4-litert-request-authority-v1.js'),
  read('scripts/stage-litert-lm-web-assets.mjs')
]);

for(const [name,source] of [['registry',registry],['packs',packs],['settings',settings],['runtime',runtime],['authority',authority]]){
  assert.doesNotThrow(()=>new Function(source),`${name} has invalid JavaScript syntax`);
}

for(const [id,repoName,artifact] of [
  ['qwen35-4b-litert-web','litert-community/Qwen3.5-4B','Qwen3.5-4B_mixed_int4.litertlm'],
  ['qwen35-9b-litert-web','litert-community/Qwen3.5-9B-LiteRT','model_multimodal.litertlm']
]){
  assert.match(registry,new RegExp(`id:'${id.replace(/[.*+?^$\\{}()|[\\]\\\\]/g,'\\\\$&')}'`));
  assert.ok(registry.includes(`repo:'${repoName}'`),`${id} repo is not pinned in the registry`);
  assert.ok(registry.includes(`artifact('${artifact}'`),`${id} artifact is not registered`);
}
assert.match(registry,/qwen35PhoneFlagships:true/);
assert.match(registry,/runtime:'litert-lm-web'/);

assert.match(packs,/'qwen-flagship-phone':pack/);
assert.match(packs,/primaryModel:'qwen35-4b-litert-web'/);
assert.match(packs,/deepModel:'qwen35-9b-litert-web'/);
assert.match(packs,/BROWSER_MANAGED_PACK_IDS=freeze\(\['qwen-flagship-phone'/);
assert.match(packs,/Gemma Phone Compatibility Pack/);

assert.match(settings,/id:'qwen-flagship-phone',label:'Flagship Phone Pack'/);
assert.match(settings,/Phone Flagship Max/);
assert.match(settings,/browserPackId:'qwen-flagship-phone'/);
assert.match(settings,/Download flagship pack/);
assert.match(settings,/Gemma Phone Compatibility Pack/);

assert.match(stage,/CORE_VERSION='0\.16\.1'/);
assert.match(runtime,/VERSION='1\.5\.0-litert-phone-runtime-v1-qwen35-flagships'/);
assert.match(runtime,/MODULE_URL='\/app\/vendor\/litert-lm\/dist\/index\.js\?v=0\.16\.1-civweave-qwen35'/);
assert.match(runtime,/const QWEN_FAST='qwen35-4b-litert-web'/);
assert.match(runtime,/const QWEN_DEEP='qwen35-9b-litert-web'/);
assert.match(runtime,/qwenFlagshipSelected/);
assert.match(runtime,/GEMMA_FAST_ALIASES\.has\(key\).*?key=QWEN_FAST/s);
assert.match(runtime,/GEMMA_DEEP_ALIASES\.has\(key\).*?key=QWEN_DEEP/s);
assert.match(runtime,/structuredJsonContract/);
assert.match(runtime,/profile\.constrainedTools===false\?null:requestedTool/);
assert.match(runtime,/structuredJsonPrompt:Boolean\(requestedTool&&!formattedTool\)/);
assert.match(runtime,/runtime:'litert-lm-web-0\.16\.1'/);

assert.match(authority,/QWEN_FAST_MODEL='qwen35-4b-litert-web'/);
assert.match(authority,/QWEN_DEEP_MODEL='qwen35-9b-litert-web'/);
assert.match(authority,/FAST_IDS=new Set\(\[GEMMA_FAST_MODEL,GEMMA_DEEP_MODEL,QWEN_FAST_MODEL,QWEN_DEEP_MODEL\]\)/);
assert.match(authority,/function fastRoleModel\(\).*?QWEN_FAST_MODEL/s);
assert.match(authority,/function deepRoleModel\(\).*?QWEN_DEEP_MODEL/s);
assert.match(authority,/if\(qwenSelected\(\)\)return prior\(\{\.\.\.args,structuredTool:tool\},forcedModelId\)/);
assert.match(authority,/deepGenerationModel:deep/);

console.log(JSON.stringify({
  ok:true,
  contract:'qwen35-phone-flagships-v1',
  defaultPhoneModel:'qwen35-4b-litert-web',
  deepPhoneModel:'qwen35-9b-litert-web',
  runtime:'litert-lm-web-0.17.1',
  gemmaRoleBridge:true,
  qwenStructuredOutput:'strict-json-prompt',
  gemmaCompatibilityPack:true
},null,2));
