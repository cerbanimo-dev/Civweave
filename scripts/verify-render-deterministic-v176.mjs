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

assert(/buildCommand:\s*\|[\s\S]*npm install --omit=dev --no-audit --no-fund[\s\S]*npm run build:release/.test(renderSource),'Render must install production dependencies and run the deterministic release build.');
assert(/startCommand:\s*npm start/.test(renderSource),'Render start command must remain npm start.');
for(const forbidden of ['stage-transformers-assets','model:pull','model:check','ensure-minilm-model','MiniLM','all-minilm','transformer:stage','transformer:model']){
  assert(!renderSource.includes(forbidden),`Render configuration resurrected forbidden model work: ${forbidden}`);
}
assert(pkg.engines?.node==='22.x','Render Node version must be pinned to the supported Node 22 line.');
assert(!pkg.dependencies?.['@huggingface/transformers'],'Transformers.js must not be a production dependency.');
assert(pkg.devDependencies?.['@huggingface/transformers']==='3.8.1','The dormant Transformer laboratory dependency must remain available for explicit development installs.');
for(const name of ['check','build:release']){
  const command=String(pkg.scripts?.[name]||'');
  for(const forbidden of ['transformer:stage','transformer:model:pull','transformer:model:check','model:pull','model:check'])assert(!command.includes(forbidden),`${name} activates ${forbidden}`);
}
console.log(JSON.stringify({ok:true,renderBuild:'npm install --omit=dev && npm run build:release',node:'22.x',productionTransformerDependency:false,dormantTransformerLab:true},null,2));
