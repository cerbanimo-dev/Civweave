import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const [wrapperSource,coreSource,cleanupSource,overrideSource]=await Promise.all([
  readFile(path.join(root,'public/service-worker-v203.js'),'utf8'),
  readFile(path.join(root,'public/service-worker-core-v208.js'),'utf8'),
  readFile(path.join(root,'public/service-worker-living-school-cleanroom-v218.js'),'utf8'),
  readFile(path.join(root,'public/service-worker-offline-v211-override.js'),'utf8')
]);
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const workerPackage=`${wrapperSource}\n${coreSource}\n${overrideSource}`;
assert(wrapperSource.includes("importScripts('/service-worker-living-school-cleanroom-v218.js"),'Generated worker omits the Living School clean-room boundary.');
assert(wrapperSource.includes("importScripts('/service-worker-core-v208.js"),'Generated worker omits the retained lightweight core.');
assert(wrapperSource.includes("importScripts('/service-worker-offline-v211-override.js"),'Generated worker omits the offline retry override.');
assert(wrapperSource.indexOf('service-worker-living-school-cleanroom-v218.js')<wrapperSource.indexOf('service-worker-core-v208.js'),'Living School retirement does not load before the generic core.');
assert(wrapperSource.indexOf('service-worker-core-v208.js')<wrapperSource.indexOf('service-worker-offline-v211-override.js'),'Offline override does not load after the core globals.');
assert(workerPackage.includes("const BUILD = 'lightweight-shell-v208'"),'Verified lightweight shell core is missing.');
assert(workerPackage.includes("const LIBRARY_CACHE='cwknowledge-school-seeds-v2'")||workerPackage.includes('cwknowledge-'),'Protected knowledge storage markers are missing from the worker package.');
assert(overrideSource.includes("const V211_REVISION = 'offline-campus-seed-provenance-v211'"),'v211 retry provenance override is missing from the worker package.');
assert(!/self\[['"]import['"]\s*\+\s*['"]Scripts['"]\]/.test(coreSource),'Retained core still depends on the temporary wrapper import.');
assert(cleanupSource.includes("const REVISION='living-school-cleanroom-v218'"),'Living School cache retirement revision is missing.');

let persisted=null;const self={};
const context=vm.createContext({console,Date,Map,Set,Promise,Number,String,Array,Math,URL,self,VERSION:'1.0.7',OFFLINE_CACHE:'commonweave-offline-test',offlinePacket:()=>({}),offlineStatus:async()=>({}),downloadOfflinePackage:async()=>({}),writeOfflineMeta:async packet=>{persisted=packet;return packet},loadOfflineManifest:async()=>({seeds:[]}),readOfflineMeta:async()=>null,cacheOfflineAsset:async()=>{throw new Error('not used by metadata migration test')},discoverReferences:()=>[],TEXT_CONTENT:/text/,post:()=>{}});
vm.runInContext(overrideSource,context,{filename:'service-worker-offline-v211-override.js'});
const api=self.CommonweaveOfflineCampusV211;
assert(api?.revision==='offline-campus-seed-provenance-v211','v211 metadata migration API is unavailable.');
const seeds=Array.from({length:11},(_,index)=>`/app/seed-${index}.html`),assets=Array.from({length:205},(_,index)=>`/app/discovered-${index}.js`),failedPaths=assets.slice(-19);
const legacy={revision:'lightweight-shell-v208',ready:false,running:false,completed:205,total:205,assets,failed:failedPaths.map(pathname=>({pathname,message:`${pathname} is unavailable.`})),bytes:17*1024*1024};
const migrated=await api.migrateMeta(legacy,{seeds});
assert(migrated.ready===true,'Repeated discovered failures did not become a ready partial campus.');
assert(migrated.total===186,`Expected 186 accepted assets, received ${migrated.total}.`);
assert(migrated.downloaded===186,`Expected 186 downloaded assets, received ${migrated.downloaded}.`);
assert(migrated.failedCount===0,'Optional discovered references remained in the retry queue.');
assert(migrated.skippedCount===19,`Expected 19 quarantined references, received ${migrated.skippedCount}.`);
assert(persisted?.revision==='offline-campus-seed-provenance-v211','Migrated metadata was not persisted.');
persisted=null;
const requiredFailure=await api.migrateMeta({revision:'lightweight-shell-v208',completed:2,total:2,assets:[seeds[0],'/app/optional.js'],failed:[{pathname:seeds[0],message:'required seed unavailable'}]},{seeds});
assert(requiredFailure.ready===false,'A required seed failure was incorrectly hidden.');
assert(requiredFailure.failedCount===1,'Required seed failure left the retry queue.');
assert(requiredFailure.skippedCount===0,'Required seed failure was quarantined as optional.');
console.log(JSON.stringify({ok:true,revision:'offline-campus-seed-provenance-v211',workerComposition:'v218-cleanroom-plus-retained-core-plus-v211-override',legacyAttempted:205,acceptedDownloaded:migrated.downloaded,staleReferencesSkipped:migrated.skippedCount,requiredFailuresPreserved:requiredFailure.failedCount},null,2));
