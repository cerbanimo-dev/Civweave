import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=process.cwd();
const manifest=JSON.parse(fs.readFileSync(path.join(root,'public/app/assets/ai/chat/expressions/manifest-v313.json'),'utf8'));
const director=fs.readFileSync(path.join(root,'public/app/avatar-expression-director-v313.js'),'utf8');
const faces=fs.readFileSync(path.join(root,'public/app/shared-chat-face-icons-v255.js'),'utf8');
assert.equal(manifest.schema,'civweave.avatar-expression-assets.v1');
assert.equal(manifest.sourceCut.alphaVerified,true);
assert.equal(manifest.runtimeFormat,'WebP atlas shards with alpha');
assert.equal(manifest.delivery.totalAtlasFiles,50);
assert.equal(manifest.delivery.expressionsPerShard,2);
assert.deepEqual(Object.keys(manifest.systems).sort(),['anarchadia','cerbanimo','civweave','fellowfare','living-school']);
let expressionCount=0,atlasCount=0;
for(const [system,data] of Object.entries(manifest.systems)){
  assert.equal(data.expressions.length,20,`${system} must have exactly 20 labeled expressions`);
  expressionCount+=data.expressions.length;
  for(let shard=1;shard<=10;shard++){
    atlasCount++;
    const file=path.join(root,'public/app/assets/ai/chat/expressions/atlases',`${data.character}-expressions-${String(shard).padStart(2,'0')}-v313.webp`);
    const webp=fs.readFileSync(file);
    assert.equal(webp.subarray(0,4).toString('ascii'),'RIFF',`${file} must be RIFF`);
    assert.equal(webp.subarray(8,12).toString('ascii'),'WEBP',`${file} must be WebP`);
    assert.ok(webp.includes(Buffer.from('ALPH')),`${file} must carry an alpha plane`);
  }
}
assert.equal(expressionCount,100,'must map all 100 individually labeled expression cuts');
assert.equal(atlasCount,50,'must ship ten transparent atlas shards per guide');
for(const marker of ["smollm2-135m-avatar-q8-wasm","onnx-community/SmolLM2-135M-Instruct-ONNX","b8a5c0f183b78c55955a5364f610c36668b5e681","onnx/model_quantized.onnx","device:'wasm'","recommended:'high'","chatSelectable:false","civweave:avatar-expression","civweave:avatar-classifier-fallback","new Worker(WORKER","classifyRules"])assert.ok(director.includes(marker),`director missing ${marker}`);
assert.ok(director.includes('HIGHLY RECOMMENDED'),'download UI must visibly highly recommend the avatar director');
assert.ok(director.includes('stopClassifierSelection'),'avatar model must not replace selected chat model');
for(const marker of ['/app/avatar-expression-director-v313.js','civweave:avatar-expression','atlasDescriptor','cwExpressionAtlas','background-size'])assert.ok(faces.includes(marker),`chat face layer missing ${marker}`);
console.log(`PASS avatar-expression-director-v313: ${expressionCount} labeled cuts mapped across ${atlasCount} alpha WebP atlases, TinyLM sidecar, rule fallback, expressive face wiring.`);
