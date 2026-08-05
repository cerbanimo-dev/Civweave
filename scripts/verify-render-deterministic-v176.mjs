import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const [renderSource,packageSource]=await Promise.all([
  readFile(path.join(root,'render.yaml'),'utf8'),
  readFile(path.join(root,'package.json'),'utf8')
]);
const pkg=JSON.parse(packageSource);
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

assert(/buildCommand:\s*\|[\s\S]*npm install --omit=dev --no-audit --no-fund[\s\S]*npm run build:release/.test(renderSource),'Render must install production dependencies and run the release build.');
assert(/startCommand:\s*npm start/.test(renderSource),'Render start command must remain npm start.');
for(const forbidden of ['stage-transformers-assets','ensure-minilm-model','@huggingface/transformers','transformer:stage','transformer:model']){
  assert(!renderSource.includes(forbidden),`Render configuration resurrected forbidden Transformers.js work: ${forbidden}`);
}

assert(pkg.version==='1.0.6','Render package must publish v1.0.6.');
assert(pkg.engines?.node==='22.x','Render Node version must be pinned to Node 22.');
const productionDependencies=Object.entries(pkg.dependencies||{});
assert(productionDependencies.length===1,'Normal npm install must contain exactly one approved production dependency.');
assert(pkg.dependencies?.['onnxruntime-web']==='1.27.0','Normal npm install must pin onnxruntime-web to 1.27.0.');
assert(!pkg.devDependencies||Object.keys(pkg.devDependencies).length===0,'Render production builds must not install development dependencies.');
for(const name of [...Object.keys(pkg.dependencies||{}),...Object.keys(pkg.devDependencies||{})]){
  assert(!/transformers|huggingface/i.test(name),`Persisted dependency graph contains forbidden Transformer package: ${name}`);
}

assert(String(pkg.scripts?.['transformer:install']||'').includes('npm install --no-save --ignore-scripts @huggingface/transformers@3.8.1'),'Transformer laboratory installation must remain explicit and unpersisted.');
assert(String(pkg.scripts?.prestart||'').includes('stage-onnxruntime-web-assets.mjs'),'Normal startup must stage the pinned ONNX Runtime Web browser assets.');
assert(String(pkg.scripts?.prestart||'').includes('ensure-minilm-fixed-ort-model.mjs'),'Normal startup must materialize only the fixed MiniLM ORT package.');
assert(String(pkg.scripts?.['build:release']||'').startsWith('npm run minilm:fixed-model:pull'),'Release builds must materialize the fixed quantized graph before verification.');
assert(String(pkg.scripts?.check||'').includes('verify-minilm-fixed-ort.mjs'),'Release verification must include the fixed ORT contract.');

for(const name of ['check','build:release','start','prestart']){
  const command=String(pkg.scripts?.[name]||'');
  for(const forbidden of ['transformer:install','transformer:stage','transformer:model:pull','transformer:model:check','stage-transformers-assets.mjs','ensure-minilm-model.mjs','@huggingface/transformers']){
    assert(!command.includes(forbidden),`${name} activates legacy Transformer work: ${forbidden}`);
  }
}

console.log(JSON.stringify({
  ok:true,
  version:'1.0.6',
  renderBuild:'npm install --omit=dev && npm run build:release',
  node:'22.x',
  normalDependencyCount:productionDependencies.length,
  fixedRuntimeDependency:'onnxruntime-web@1.27.0',
  fixedModelMaterialization:true,
  transformerInstall:'explicit laboratory command only'
},null,2));
