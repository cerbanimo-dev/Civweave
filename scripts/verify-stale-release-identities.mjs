import {readFile,readdir,lstat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const retired=['offline-campus-current-graph-'+'v238','fast-background-'+'v241'];
const extensions=new Set(['.js','.mjs','.json','.md','.txt','.yml','.yaml','.html','.css','.webmanifest','.sh']);
const hits=[];

async function scan(relative){
  for(const entry of await readdir(path.join(root,relative),{withFileTypes:true})){
    const child=path.join(relative,entry.name);
    if(entry.isDirectory()){
      if(child==='scripts/migrations'||child.startsWith('docs/history')||child.startsWith('archive'))continue;
      await scan(child);
      continue;
    }
    if(!entry.isFile()||!extensions.has(path.extname(entry.name))||child==='scripts/verify-stale-release-identities.mjs')continue;
    let text;
    try{text=await readFile(path.join(root,child),'utf8')}catch{continue}
    if(retired.some(token=>text.includes(token)))hits.push(child);
  }
}
for(const relative of ['scripts','.github/workflows','public/app'])await scan(relative);
for(const relative of ['public/service-worker-v203.js','public/service-worker-offline-v211-override.js']){
  const stat=await lstat(path.join(root,relative));
  if(!stat.isFile())continue;
  const text=await readFile(path.join(root,relative),'utf8');
  if(retired.some(token=>text.includes(token)))hits.push(relative);
}
if(hits.length)throw new Error(`Retired release identities remain in live code: ${[...new Set(hits)].sort().join(', ')}`);
console.log(JSON.stringify({ok:true,retiredIdentities:retired.length,liveMatches:0},null,2));
