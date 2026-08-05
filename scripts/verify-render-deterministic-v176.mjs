import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const [renderSource,packageSource]=await Promise.all([readFile(path.join(root,'render.yaml'),'utf8'),readFile(path.join(root,'package.json'),'utf8')]);
const pkg=JSON.parse(packageSource),assert=(condition,message)=>{if(!condition)throw new Error(message)};
assert(/buildCommand:\s*\|[\s\S]*npm install --omit=dev --no-audit --no-fund[\s\S]*npm run build:release/.test(renderSource),'Render must install production dependencies and run the release build.');
assert(/startCommand:\s*npm start/.test(renderSource),'Render start command must remain npm start.');
for(const forbidden of ['stage-transformers-assets','model:pull','model:check','ensure-minilm-model','MiniLM','all-minilm','transformer:stage','transformer:model'])assert(!renderSource.includes(forbidden),`Render configuration resurrected forbidden model work: ${forbidden}`);
assert(pkg.version==='1.0.6','Render package must publish v1.0.6.');
assert(pkg.engines?.node==='22.x','Render Node version must be pinned to Node 22.');
assert(!pkg.dependencies&&!pkg.devDependencies,'Normal npm install must have no Transformer dependency graph.');
assert(String(pkg.scripts?.['transformer:install']||'').includes('npm install --no-save --ignore-scripts @huggingface/transformers@3.8.1'),'Transformer laboratory installation must be explicit and unpersisted.');
for(const name of ['check','build:release','start','prestart']){const command=String(pkg.scripts?.[name]||'');for(const forbidden of ['transformer:install','transformer:stage','transformer:model:pull','transformer:model:check','model:pull','model:check'])assert(!command.includes(forbidden),`${name} activates ${forbidden}`)}
console.log(JSON.stringify({ok:true,version:'1.0.6',renderBuild:'npm install --omit=dev && npm run build:release',node:'22.x',normalDependencyCount:0,transformerInstall:'explicit laboratory command only'},null,2));
