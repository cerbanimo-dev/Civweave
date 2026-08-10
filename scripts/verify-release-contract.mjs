import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const contract=JSON.parse(await read('config/release-contract.json'));
const {revision,policy,syncTag}=contract.offlineCampus||{};

assert(/^offline-campus-current-graph-v\d+$/.test(String(revision||'')),'Offline campus revision is invalid.');
assert(/^[-a-z0-9]+-v\d+$/.test(String(policy||'')),'Offline campus policy is invalid.');
assert(/^civweave-campus-resume-v\d+$/.test(String(syncTag||'')),'Offline campus sync tag is invalid.');

const [wrapper,override]=await Promise.all([
  read('public/service-worker-v203.js'),
  read('public/service-worker-offline-v211-override.js')
]);
const importToken=`/service-worker-offline-v211-override.js?v=${revision}&policy=${policy}`;
assert(wrapper.includes(importToken),`Active worker wrapper is not pinned to ${importToken}.`);
assert(override.includes(`const V211_REVISION = '${revision}'`),'Offline worker revision does not match the release contract.');
assert(override.includes(`const V211_POLICY = '${policy}'`),'Offline worker policy does not match the release contract.');
assert(override.includes(`const V211_SYNC_TAG = '${syncTag}'`),'Offline worker sync tag does not match the release contract.');

const staleRevision='offline-campus-current-graph-'+'v238';
const stalePolicy='fast-background-'+'v241';
const textExtensions=new Set(['.js','.mjs','.json','.md','.txt','.yml','.yaml','.html','.css','.webmanifest','.sh']);
const scanRoots=['scripts','.github/workflows','public/app'];
const stale=[];

async function scan(relative){
  const absolute=path.join(root,relative);
  const entries=await readdir(absolute,{withFileTypes:true});
  for(const entry of entries){
    const child=path.join(relative,entry.name);
    if(entry.isDirectory()){
      if(child==='scripts/migrations')continue;
      await scan(child);
      continue;
    }
    if(!entry.isFile()||!textExtensions.has(path.extname(entry.name)))continue;
    if(child==='scripts/verify-release-contract.mjs')continue;
    const text=await read(child);
    if(text.includes(staleRevision)||text.includes(stalePolicy))stale.push(child);
  }
}
for(const relative of scanRoots)await scan(relative);
for(const relative of ['public/service-worker-v203.js','public/service-worker-offline-v211-override.js']){
  const text=await read(relative);
  if(text.includes(staleRevision)||text.includes(stalePolicy))stale.push(relative);
}
assert(stale.length===0,`Stale offline release identities remain: ${[...new Set(stale)].sort().join(', ')}`);

console.log(JSON.stringify({ok:true,revision,policy,syncTag,canonical:'config/release-contract.json',staleReferences:0},null,2));
