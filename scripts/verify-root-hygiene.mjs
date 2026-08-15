import {lstat,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const entries=await readdir(root,{withFileTypes:true});
const allowedRootMarkdown=new Set(['AGENTS.md','README.md','RELEASE-NOTES.md']);
const failures=[];
const markdown=entries.filter(e=>e.isFile()&&/\.md$/i.test(e.name)&&!allowedRootMarkdown.has(e.name)).map(e=>e.name);
if(markdown.length)failures.push('Unexpected root Markdown: '+markdown.sort().join(', '));
const rootServers=entries.filter(e=>e.isFile()&&/^server.*\.mjs$/i.test(e.name)).map(e=>e.name);
if(rootServers.length)failures.push('Root server implementations/pointers are forbidden: '+rootServers.sort().join(', '));
const symlinks=[];for(const e of entries){if((await lstat(path.join(root,e.name))).isSymbolicLink())symlinks.push(e.name)}
if(symlinks.length)failures.push('Root compatibility symlinks are forbidden: '+symlinks.sort().join(', '));
if(entries.some(e=>e.isDirectory()&&e.name==='archive'))failures.push('archive/ is forbidden; Git history is the archive.');
try{await lstat(path.join(root,'server','compat'));failures.push('server/compat is forbidden; use releases/{VERSION}/server.')}catch(error){if(error.code!=='ENOENT')throw error}
const forbiddenRepoPayloads=[
  ['mempalace-develop.zip','Redundant Memory Palace ZIP must not be tracked.'],
  ['public/app/models/smollm2-360m-instruct/tokenizer.json','SmolLM tokenizer payload must not be tracked.'],
  ['public/app/models/smollm2-360m-instruct/onnx/model_q4f16.onnx','SmolLM model graph must not be tracked.']
];
for(const [relativePath,message] of forbiddenRepoPayloads){
  try{await lstat(path.join(root,...relativePath.split('/')));failures.push(message+' ('+relativePath+')')}catch(error){if(error.code!=='ENOENT')throw error}
}
if(failures.length){console.error('Root hygiene check failed.');for(const failure of failures)console.error('- '+failure);process.exit(1)}
console.log(JSON.stringify({ok:true,allowedRootMarkdown:[...allowedRootMarkdown].sort(),rootServerFiles:0,compatibilityPointers:0,archiveDirectory:false,forbiddenRepoPayloads:forbiddenRepoPayloads.map(([relativePath])=>relativePath),canonicalReleaseDirectory:'releases'},null,2));
