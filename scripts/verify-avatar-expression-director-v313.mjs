import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=process.cwd();
const manifest=JSON.parse(fs.readFileSync(path.join(root,'public/app/assets/ai/chat/expressions/manifest-v313.json'),'utf8'));
const director=fs.readFileSync(path.join(root,'public/app/avatar-expression-director-v313.js'),'utf8');
const faces=fs.readFileSync(path.join(root,'public/app/shared-chat-face-icons-v255.js'),'utf8');
assert.equal(manifest.schema,'civweave.avatar-expression-assets.v1');
assert.equal(manifest.sourceCut.alphaVerified,true);
assert.equal(manifest.runtimeFormat,'WebP with alpha');
assert.deepEqual(Object.keys(manifest.systems).sort(),['anarchadia','cerbanimo','civweave','fellowfare','living-school']);
let count=0;
for(const [system,data] of Object.entries(manifest.systems)){
  assert.equal(data.expressions.length,20,`${system} must have exactly 20 expressions`);
  data.expressions.forEach((expression,index)=>{
    count++;
    const file=path.join(root,'public/app/assets/ai/chat/expressions',data.character,`${String(index+1).padStart(2,'0')}-${expression}.webp`);
    const webp=fs.readFileSync(file);
    assert.equal(webp.subarray(0,4).toString('ascii'),'RIFF',`${file} must be RIFF`);
    assert.equal(webp.subarray(8,12).toString('ascii'),'WEBP',`${file} must be WebP`);
    assert.ok(webp.includes(Buffer.from('ALPH')),`${file} must carry an alpha plane`);
  });
}
assert.equal(count,100,'must ship all 100 individual expression sprites');
for(const marker of ["smollm2-135m-avatar-q8-wasm","onnx-community/SmolLM2-135M-Instruct-ONNX","b8a5c0f183b78c55955a5364f610c36668b5e681","onnx/model_quantized.onnx","device:'wasm'","recommended:'high'","chatSelectable:false","civweave:avatar-expression","civweave:avatar-classifier-fallback","new Worker(WORKER","classifyRules"])assert.ok(director.includes(marker),`director missing ${marker}`);
assert.ok(director.includes('HIGHLY RECOMMENDED'),'download UI must visibly highly recommend the avatar director');
assert.ok(director.includes('stopClassifierSelection'),'avatar model must not replace selected chat model');
assert.ok(faces.includes('/app/avatar-expression-director-v313.js'),'chat face layer must load the expression director');
assert.ok(faces.includes('civweave:avatar-expression'),'chat face layer must react to expression events');
assert.ok(faces.includes('object-fit:contain'),'transparent full-body sprites should use contain sizing');
console.log(`PASS avatar-expression-director-v313: ${count} alpha WebP sprites, TinyLM sidecar, rule fallback, expressive face wiring.`);
