import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const version=(await read('VERSION')).trim();
if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error('VERSION must contain a semantic release version.');

const required=[
  'public/app/system-routes-v227.js',
  'public/service-worker-core-v208.js',
  'public/service-worker-installed-launch-v282.js',
  'public/service-worker-installer-state-v280.js',
  'public/service-worker-local-model-download-v267.js',
  'public/service-worker-boot-recovery-v426.js'
];
for(const relative of required)await read(relative);

const wrapper=await read('public/service-worker-v203.js');
const imports=[...wrapper.matchAll(/importScripts\((['"])(.*?)\1\)/g)].map(match=>match[2]);
const expected=[
  `/app/system-routes-v227.js?v=${version}-five-system-route-contract-v227`,
  `/service-worker-core-v208.js?v=${version}-interface-rebase-v1`,
  '/service-worker-installed-launch-v282.js?v=installed-pwa-launch-v294-campus-recovery',
  '/service-worker-installer-state-v280.js?v=installer-state-authority-v281-manual-first',
  '/service-worker-local-model-download-v267.js?v=1.0.67-local-model-background-v271-integrity',
  '/service-worker-boot-recovery-v426.js?v=boot-recovery-v426'
];
if(JSON.stringify(imports)!==JSON.stringify(expected))throw new Error(`Active service-worker wrapper drifted. Expected ${JSON.stringify(expected)}, received ${JSON.stringify(imports)}.`);
for(const retired of ['code-coherence','release-coherence','shell-repair','chat-repair','working-campus-return','document-lifecycle'])if(wrapper.includes(retired))throw new Error(`Active worker reintroduced retired layer ${retired}.`);

console.log(JSON.stringify({ok:true,version,mode:'assert-only',imports:imports.length,runtimeRepairImports:0,mutatesCheckout:false},null,2));
