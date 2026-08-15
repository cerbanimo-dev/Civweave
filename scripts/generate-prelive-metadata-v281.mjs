import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const version=(await readFile(path.join(root,'VERSION'),'utf8')).trim();
const worker=await readFile(path.join(root,'public/service-worker-core-v208.js'),'utf8');
const manifest=JSON.parse(await readFile(path.join(root,'public/app/offline-package-v208.json'),'utf8'));

if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error(`Invalid VERSION: ${version}`);
if(!worker.includes("const BUILD='lightweight-shell-v208-interface-rebase-v1';"))throw new Error('Service-worker core is not on the interface-rebase shell.');
if(!Array.isArray(manifest.seeds)||!manifest.seeds.includes('/app/working-campus-v156.html'))throw new Error('Offline manifest lost Working Campus.');

console.log(JSON.stringify({
  ok:true,
  version,
  revision:'prelive-metadata-read-only-v1',
  mutatesCheckout:false,
  offlineSeedCount:manifest.seeds.length,
  shellIntegrityRuntime:'retired-from-active-worker'
},null,2));
