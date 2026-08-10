import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const entries=await readdir(root,{withFileTypes:true});
const allowedRootMarkdown=new Set(['AGENTS.md','README.md','RELEASE-NOTES.md']);
const rootFiles=entries.filter(entry=>entry.isFile()).map(entry=>entry.name);
const unexpectedMarkdown=rootFiles.filter(name=>/\.md$/i.test(name)&&!allowedRootMarkdown.has(name));
const rootSentinels=rootFiles.filter(name=>/^\..*(?:trigger|materialize|watchdog)/i.test(name));
const displacedArtifacts=rootFiles.filter(name=>name==='README-INSTALL.txt'||name==='FILE-INVENTORY.json');
const versionedServers=rootFiles.filter(name=>/^server(?:-[a-z-]+)?-v\d+\.mjs$/i.test(name));
const nonPointerServers=[];
for(const name of versionedServers){
  const source=await readFile(path.join(root,name),'utf8');
  const pointer=source.length<=512&&source.includes('Compatibility pointer.')&&(/server\//.test(source)||/archive\/runtime\//.test(source));
  if(!pointer)nonPointerServers.push(name);
}
const failures=[];
if(unexpectedMarkdown.length)failures.push(`Unexpected root Markdown: ${unexpectedMarkdown.sort().join(', ')}. Put documentation under docs/.`);
if(rootSentinels.length)failures.push(`Root workflow sentinels are forbidden: ${rootSentinels.sort().join(', ')}. Put sentinels in ops/triggers/.`);
if(displacedArtifacts.length)failures.push(`Root inventory/install artifacts are forbidden as regular files: ${displacedArtifacts.sort().join(', ')}. Store content under docs/ and keep only lightweight pointers when compatibility requires them.`);
if(nonPointerServers.length)failures.push(`Full versioned server implementations are forbidden at root: ${nonPointerServers.sort().join(', ')}. Keep only <=512-byte compatibility pointer stubs and store implementations under server/compat/ or archive/runtime/.`);
if(failures.length){
  console.error('Root hygiene check failed.');
  for(const failure of failures)console.error(`- ${failure}`);
  process.exit(1);
}
console.log(JSON.stringify({ok:true,allowedRootMarkdown:[...allowedRootMarkdown].sort(),compatibilityServerPointers:versionedServers.sort(),sentinelDirectory:'ops/triggers',serverEntryDirectory:'server',docsDirectory:'docs'},null,2));