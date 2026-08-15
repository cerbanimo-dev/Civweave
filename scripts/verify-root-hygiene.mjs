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

const symlinks=[];
for(const e of entries){
  if((await lstat(path.join(root,e.name))).isSymbolicLink())symlinks.push(e.name);
}
if(symlinks.length)failures.push('Root compatibility symlinks are forbidden: '+symlinks.sort().join(', '));

if(entries.some(e=>e.isDirectory()&&e.name==='archive'))failures.push('archive/ is forbidden; Git history is the archive.');
try{
  await lstat(path.join(root,'server','compat'));
  failures.push('server/compat is forbidden; use releases/{VERSION}/server.');
}catch(error){
  if(error.code!=='ENOENT')throw error;
}

const disposableNamePatterns=[
  [/\.tmp$/i,'temporary file'],
  [/\.bak$/i,'backup artifact'],
  [/\.orig$/i,'merge/original backup artifact'],
  [/\.rej$/i,'rejected patch artifact'],
  [/\.sw[op]$/i,'editor swap artifact'],
  [/~$/,'editor backup artifact'],
  [/^\.DS_Store$/,'macOS metadata artifact'],
  [/^Thumbs\.db$/i,'Windows metadata artifact']
];
const ignoredDirectories=new Set(['.git','node_modules']);
const disposableArtifacts=[];

async function scan(directory){
  const rows=await readdir(directory,{withFileTypes:true});
  for(const row of rows){
    if(row.isDirectory()&&ignoredDirectories.has(row.name))continue;
    const absolute=path.join(directory,row.name);
    const relative=path.relative(root,absolute).replaceAll('\\','/');
    if(row.isDirectory()){
      await scan(absolute);
      continue;
    }
    const matched=disposableNamePatterns.find(([pattern])=>pattern.test(row.name));
    if(matched)disposableArtifacts.push({path:relative,reason:matched[1]});
  }
}
await scan(root);
if(disposableArtifacts.length){
  failures.push('Disposable/corrupted workspace artifacts are forbidden:\n'+disposableArtifacts.sort((a,b)=>a.path.localeCompare(b.path)).map(item=>`  ${item.path} (${item.reason})`).join('\n'));
}

if(failures.length){
  console.error('Root hygiene check failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}

console.log(JSON.stringify({
  ok:true,
  allowedRootMarkdown:[...allowedRootMarkdown].sort(),
  rootServerFiles:0,
  compatibilityPointers:0,
  archiveDirectory:false,
  disposableArtifacts:0,
  disposablePatterns:disposableNamePatterns.map(([,label])=>label),
  canonicalReleaseDirectory:'releases'
},null,2));
