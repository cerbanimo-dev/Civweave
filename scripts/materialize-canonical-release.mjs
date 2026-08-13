import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=process.cwd();
const version=(await fsp.readFile(path.join(root,'VERSION'),'utf8')).trim();
const releasesRoot=path.join(root,'releases');
const currentRoot=path.join(releasesRoot,version);
const exists=async p=>{try{await fsp.lstat(p);return true}catch(e){if(e.code==='ENOENT')return false;throw e}};
if(await exists(path.join(currentRoot,'release.json'))){console.log(JSON.stringify({ok:true,version,path:`releases/${version}`,alreadyMaterialized:true},null,2));process.exit(0)}
const versions=(await fsp.readdir(releasesRoot,{withFileTypes:true})).filter(e=>e.isDirectory()&&/^\d+\.\d+\.\d+$/.test(e.name)).map(e=>e.name).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));const previous=versions.at(-1);if(!previous)throw new Error('No prior canonical release exists to materialize from.');
await fsp.mkdir(currentRoot,{recursive:true});await fsp.cp(path.join(releasesRoot,previous,'server'),path.join(currentRoot,'server'),{recursive:true});for(const name of await fsp.readdir(path.join(currentRoot,'server'))){const file=path.join(currentRoot,'server',name);let source=await fsp.readFile(file,'utf8');source=source.replaceAll(previous,version);await fsp.writeFile(file,source)}
const sync=spawnSync(process.execPath,['scripts/sync-release-version-assets.mjs'],{cwd:root,stdio:'inherit'});if(sync.status!==0)throw new Error('Release synchronization failed.');
const worker=spawnSync(process.execPath,['scripts/build-service-worker-v211.mjs'],{cwd:root,stdio:'inherit'});if(worker.status!==0)throw new Error('Service worker materialization failed.');
const metadata=spawnSync(process.execPath,['scripts/generate-prelive-metadata-v281.mjs'],{cwd:root,stdio:'inherit'});if(metadata.status!==0)throw new Error('Verified shell metadata materialization failed.');
const sha256={};for(const name of (await fsp.readdir(path.join(currentRoot,'server'))).filter(n=>n.endsWith('.mjs')).sort()){const bytes=await fsp.readFile(path.join(currentRoot,'server',name));sha256['server/'+name]=crypto.createHash('sha256').update(bytes).digest('hex')}const manifest={schema:'civweave.canonical-release.v1',version,status:'current',canonicalPath:`releases/${version}`,sourceCommit:'pending-merge',basedOn:previous,runtime:{base:`releases/${version}/server/server.mjs`,dev:`releases/${version}/server/server-v130.mjs`,local:`releases/${version}/server/server-local-v131.mjs`,gatewayBase:`releases/${version}/server/server-gateway-v131-base.mjs`,gateway:`releases/${version}/server/server-gateway-v131.mjs`,federated:`releases/${version}/server/server-federated-v152.mjs`},sha256};await fsp.writeFile(path.join(currentRoot,'release.json'),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({ok:true,version,path:`releases/${version}`,basedOn:previous,hashes:Object.keys(sha256).length,shellMetadata:'generated-prelive-v281'},null,2));