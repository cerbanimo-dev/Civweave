import {lstat,readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const launchVersion='1.0.79',launchCommit='395ec2394edad86e0b5ce092300dd613f7ce4a7d';
const version=(await readFile(path.join(root,'VERSION'),'utf8')).trim();
const fail=m=>{throw new Error(m)};
async function verifyRelease(v,expectedStatus){const releaseRoot=path.join(root,'releases',v);const manifest=JSON.parse(await readFile(path.join(releaseRoot,'release.json'),'utf8'));if(manifest.schema!=='civweave.canonical-release.v1'||manifest.version!==v)fail('Canonical manifest mismatch for '+v);if(expectedStatus&&manifest.status!==expectedStatus)fail('Canonical status mismatch for '+v+': '+manifest.status);for(const [relative,expected] of Object.entries(manifest.sha256||{})){const bytes=await readFile(path.join(releaseRoot,relative));const actual=crypto.createHash('sha256').update(bytes).digest('hex');if(actual!==expected)fail('Canonical hash mismatch: '+v+'/'+relative)}return manifest}
const launch=await verifyRelease(launchVersion,'launch');if(launch.sourceCommit!==launchCommit)fail('Launch snapshot source commit drifted.');
const current=await verifyRelease(version,'current');
const embeddedVersions=(await readdir(path.join(root,'releases'),{withFileTypes:true})).filter(e=>e.isDirectory()&&/^\d+\.\d+\.\d+$/.test(e.name)).map(e=>e.name).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
const allowedEmbedded=[...new Set([launchVersion,version])].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
if(JSON.stringify(embeddedVersions)!==JSON.stringify(allowedEmbedded))fail(`Redundant embedded release snapshots remain: expected ${allowedEmbedded.join(', ')}, found ${embeddedVersions.join(', ')}`);
const entries=await readdir(root,{withFileTypes:true});if(entries.some(e=>e.isDirectory()&&e.name==='archive'))fail('archive/ remains in live tree.');if(entries.some(e=>e.isFile()&&/^server.*\.mjs$/i.test(e.name)))fail('Root server implementation/pointer remains.');for(const e of entries){if((await lstat(path.join(root,e.name))).isSymbolicLink())fail('Root compatibility symlink remains: '+e.name)}try{await lstat(path.join(root,'server','compat'));fail('server/compat remains.')}catch(error){if(error.code!=='ENOENT')throw error}
const versionRead=/readFile\(path\.join\(root,\s*['"]VERSION['"]/;
const releaseJoin=/path\.join\(root,\s*['"]releases['"],\s*version,\s*['"]server['"]\)/;
for(const name of ['dev.mjs','local.mjs','gateway.mjs','gateway-base.mjs','federated.mjs']){const source=await readFile(path.join(root,'server',name),'utf8');if(!versionRead.test(source)||!releaseJoin.test(source))fail('Stable launcher is not VERSION-selected canonical runtime: '+name);if(source.includes('server/compat')||source.includes('Compatibility pointer'))fail('Compatibility launch code remains in '+name)}
const critical=['package.json','Dockerfile','Dockerfile.federated',...((await readdir(path.join(root,'.github','workflows'))).map(n=>'.github/workflows/'+n))];const rootAlias=/(^|[\s"'=:(])server(?:-[a-z0-9-]+)?-v\d+(?:-hotfix)?\.mjs(?=$|[\s"')])/mi;for(const relative of critical){let source='';try{source=await readFile(path.join(root,relative),'utf8')}catch{continue}if(source.includes('server/compat')||source.includes('archive/runtime')||rootAlias.test(source))fail('Live launch/control surface references retired compatibility path: '+relative)}
const contract=JSON.parse(await readFile(path.join(root,'config','release-contract.json'),'utf8'));if(contract.canonical?.launch?.version!==launchVersion||contract.canonical?.current?.version!==version||contract.canonical?.current?.path!==`releases/${version}`)fail('Canonical release index is stale.');
const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));if(!String(pkg.scripts?.['release:materialize']||'').includes('materialize-canonical-release.mjs'))fail('Durable canonical release materializer is not wired.');

const [bootstrapWorker,installedEntry,minilmAdapter]=await Promise.all([
  readFile(path.join(root,'public','service-worker-install-v1.js'),'utf8'),
  readFile(path.join(root,'public','app','installed-entry-v146.js'),'utf8'),
  readFile(path.join(root,'public','app','models','all-minilm-l6-v2','adapter.js'),'utf8')
]);
for(const token of ["runtimeNetworkFallback: false","error: 'LOCAL_PACKAGE_REQUIRED'","x-civweave-local-first","requestFromInstaller(event.clientId)"])if(!bootstrapWorker.includes(token))fail('Bootstrap local-first boundary missing '+token);
if(!bootstrapWorker.includes("headers: { 'x-civweave-package': 'bootstrap-install' }"))fail('Bootstrap acquisition is not explicitly marked as package installation.');
for(const token of ["allowProvision:localDeveloper()","installed-entry-local-package-required","localCampusReady","browserRuntimePolicy:'installed-display-cache-only'"])if(!installedEntry.includes(token))fail('Installed launch local-package boundary missing '+token);
if(!installedEntry.includes("if(!allowProvision)"))fail('Production installed launch can still provision a worker implicitly.');
for(const token of ['sameOriginDownloadsOnly:true','remoteModelHostsAllowed:false',"source:'local-model-cache'"])if(!minilmAdapter.includes(token))fail('MiniLM local-only runtime contract missing '+token);
if(/https?:\/\//i.test(minilmAdapter))fail('MiniLM browser adapter contains a direct remote model URL.');

console.log(JSON.stringify({ok:true,launch:{version:launchVersion,path:`releases/${launchVersion}`,hashes:Object.keys(launch.sha256||{}).length},current:{version,path:`releases/${version}`,hashes:Object.keys(current.sha256||{}).length},embeddedReleaseSnapshots:embeddedVersions,compatibilityPointers:0,archiveDirectory:false,bootstrapRuntime:'cache-only',implicitCampusProvision:false,minilmRuntime:'same-origin-local-cache-only'},null,2));