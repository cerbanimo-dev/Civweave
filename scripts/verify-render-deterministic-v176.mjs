import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const [renderSource,packageSource,versionSource]=await Promise.all([
  readFile(path.join(root,'render.yaml'),'utf8'),
  readFile(path.join(root,'package.json'),'utf8'),
  readFile(path.join(root,'VERSION'),'utf8')
]);
const pkg=JSON.parse(packageSource),canonicalVersion=versionSource.trim();
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

assert(/buildCommand:\s*\|[\s\S]*npm install --omit=dev --no-audit --no-fund[\s\S]*npm run build:release/.test(renderSource),'Render must install production dependencies and run the release build.');
assert(/startCommand:\s*npm start/.test(renderSource),'Render start command must remain npm start.');
for(const forbidden of ['stage-transformers-assets','ensure-minilm-model','@huggingface/transformers','transformer:stage','transformer:model']){
  assert(!renderSource.includes(forbidden),`Render configuration must delegate runtime staging to package scripts instead of hard-coding: ${forbidden}`);
}

assert(/^\d+\.\d+\.\d+$/.test(canonicalVersion),'VERSION must contain a semantic release version.');
assert(pkg.version===canonicalVersion,`Render package ${pkg.version} must match canonical Civweave ${canonicalVersion}.`);
assert(pkg.engines?.node==='22.x','Render Node version must be pinned to Node 22.');
const productionDependencies=Object.entries(pkg.dependencies||{});
const productionDependencyNames=productionDependencies.map(([name])=>name).sort();
const approvedDependencyNames=['@huggingface/transformers','onnxruntime-web'].sort();
assert(JSON.stringify(productionDependencyNames)===JSON.stringify(approvedDependencyNames),'Normal npm install must contain exactly the two approved local-AI runtime dependencies.');
assert(pkg.dependencies?.['onnxruntime-web']==='1.27.0','Normal npm install must pin onnxruntime-web to 1.27.0.');
assert(pkg.dependencies?.['@huggingface/transformers']==='3.8.1','Normal npm install must pin @huggingface/transformers to 3.8.1.');
assert(!pkg.devDependencies||Object.keys(pkg.devDependencies).length===0,'Render production builds must not install development dependencies.');

assert(String(pkg.scripts?.['transformer:install']||'').includes('npm install --no-save --ignore-scripts @huggingface/transformers@3.8.1'),'Manual Transformer runtime installation must remain pinned and ignore package scripts.');
assert(String(pkg.scripts?.prestart||'').includes('stage-onnxruntime-web-assets.mjs'),'Normal startup must stage the pinned ONNX Runtime Web browser assets.');
assert(String(pkg.scripts?.prestart||'').includes('stage-transformers-assets.mjs --force'),'Normal startup must stage the pinned local Transformers browser runtime.');
assert(String(pkg.scripts?.prestart||'').includes('ensure-minilm-fixed-ort-model.mjs'),'Normal startup must materialize the fixed MiniLM ORT package.');
assert(String(pkg.scripts?.['build:release']||'').startsWith('npm run minilm:fixed-model:pull'),'Release builds must materialize the fixed quantized graph before verification.');
assert(String(pkg.scripts?.['build:release']||'').includes('npm run transformer:stage'),'Release builds must stage the pinned local generative runtime before verification.');
assert(String(pkg.scripts?.check||'').includes('verify-minilm-fixed-ort.mjs'),'Release verification must include the fixed ORT contract.');

for(const name of ['check','build:release','start','prestart']){
  const command=String(pkg.scripts?.[name]||'');
  for(const forbidden of ['transformer:install','transformer:model:pull','transformer:model:check','ensure-minilm-model.mjs']){
    assert(!command.includes(forbidden),`${name} must not fetch or install a model/runtime dynamically during normal operation: ${forbidden}`);
  }
}

console.log(JSON.stringify({
  ok:true,
  version:canonicalVersion,
  renderBuild:'npm install --omit=dev && npm run build:release',
  node:'22.x',
  normalDependencyCount:productionDependencies.length,
  fixedRuntimeDependency:'onnxruntime-web@1.27.0',
  localGenerativeRuntimeDependency:'@huggingface/transformers@3.8.1',
  fixedModelMaterialization:true,
  runtimeStaging:'package-script-owned'
},null,2));
