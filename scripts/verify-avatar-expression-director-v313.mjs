import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=process.cwd();
const manifest=JSON.parse(fs.readFileSync(path.join(root,'public/app/assets/ai/chat/expressions/manifest-v313.json'),'utf8'));
const director=fs.readFileSync(path.join(root,'public/app/avatar-expression-director-v313.js'),'utf8');
const faces=fs.readFileSync(path.join(root,'public/app/shared-chat-face-icons-v255.js'),'utf8');
const loader=fs.readFileSync(path.join(root,'public/app/shared-guide-surface-v236.js'),'utf8');
assert.equal(manifest.schema,'civweave.avatar-expression-assets.v3');
assert.equal(manifest.sourceCuts.alphaVerified,true);
assert.equal(manifest.sourceCuts.count,100);
assert.equal(manifest.runtime.preservesAlpha,true);
assert.equal(manifest.runtime.columns,5);
assert.equal(manifest.runtime.rows,4);
assert.equal(manifest.runtime.cellWidth,80);
assert.equal(manifest.runtime.cellHeight,80);
assert.equal(manifest.runtime.atlasWidth,400);
assert.equal(manifest.runtime.atlasHeight,320);
assert.equal(manifest.sleepPolicy.onModelFailure,true);
assert.equal(manifest.sleepPolicy.inDeterministicModeWhenTinyLMUnavailable,true);
assert.deepEqual(Object.keys(manifest.systems),['civweave','living-school','cerbanimo','fellowfare','anarchadia']);
let count=0;
for(const [system,data] of Object.entries(manifest.systems)){
  assert.equal(data.expressions.length,20,`${system} must have exactly 20 labeled expressions`);
  count+=data.expressions.length;
  const atlas=fs.readFileSync(path.join(root,data.atlas.replace(/^\/app\//,'public/app/')));
  assert.equal(atlas.subarray(0,4).toString('ascii'),'RIFF',`${system} atlas must be RIFF`);
  assert.equal(atlas.subarray(8,12).toString('ascii'),'WEBP',`${system} atlas must be WebP`);
  assert.ok(atlas.byteLength>50_000,`${system} atlas should contain the full 20-pose art bank`);
  assert.ok(atlas.includes(Buffer.from('VP8 '))||atlas.includes(Buffer.from('VP8L'))||atlas.includes(Buffer.from('ALPH')),`${system} atlas must contain WebP image payload`);
}
assert.equal(count,100,'must label all 100 expression cells');
for(const marker of ['smollm2-135m-avatar-q8-wasm','onnx-community/SmolLM2-135M-Instruct-ONNX',"device:'wasm'","recommended:'high'",'chatSelectable:false','HIGHLY RECOMMENDED','civweave:avatar-expression','civweave:avatar-classifier-fallback','new Worker(WORKER','classifyRules','sleepOnModelFailure:true','sleepInDeterministicWithoutTinyLM:true','civweave:local-model-error','model-failure','deterministicMode()&&!tinyAvailable','publishSleep'])assert.ok(director.includes(marker),`director missing ${marker}`);
assert.ok(director.includes('stopClassifierSelection'),'avatar model must not replace selected chat model');
for(const marker of ['/app/avatar-expression-director-v313.js','civweave:avatar-expression',"atlasGrid:'5x4'",'background-size'])assert.ok(faces.includes(marker),`face renderer missing ${marker}`);
assert.ok(loader.includes('/app/avatar-expression-director-v313.js'),'shared guide loader must preload the avatar director');
console.log(`PASS avatar-expression-director-v314: ${count} labeled alpha sprites, 5 transparent atlases, TinyLM sidecar, deterministic/model-failure sleep policy.`);
