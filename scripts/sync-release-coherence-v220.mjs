import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const version=(await read('VERSION')).trim();
if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error('VERSION must contain a semantic release version.');

const [html,runtime,gateway,workerCore,wrapper]=await Promise.all([
  read('public/app/working-campus-v156.html'),
  read('public/app/working-campus-v156.js'),
  read('public/app/settings-gateway-v317.js'),
  read('public/service-worker-core-v208.js'),
  read('public/service-worker-v203.js')
]);

const requireToken=(source,token,label)=>{if(!source.includes(token))throw new Error(`${label} is missing ${token}.`)};
const forbid=(source,token,label)=>{if(source.includes(token))throw new Error(`${label} reintroduced ${token}.`)};

requireToken(html,`Civweave Working Campus · v${version}`,'Working Campus');
requireToken(html,`<b class="version-chip">v${version}</b>`,'Working Campus');
for(const token of ['settings-gateway-v317.js','system-routes-v227.js','family-ai-loader-v105.js','working-campus-v156.js'])requireToken(html,token,'Working Campus');
for(const token of ['working-campus-return-guard-v425','document-lifecycle-v221','install-boundary-v146','working-campus-v156.part'])forbid(html,token,'Working Campus');

requireToken(runtime,`const VERSION='${version}-interface-runtime-v1';`,'Working Campus runtime');
requireToken(runtime,"architecture:'static-runtime-no-fragment-eval'",'Working Campus runtime');
for(const token of ['Function(','fetchPart(','working-campus-v156.part','repairPersistedCampusState','location.reload()'])forbid(runtime,token,'Working Campus runtime');

requireToken(gateway,"managementActivation:'explicit-secondary-action'",'Settings gateway');
requireToken(gateway,'generativeRuntimeOnOpen:false','Settings gateway');
for(const token of ['document-lifecycle-v221','bootstrap-v266','runtime-bridge-v266'])forbid(gateway,token,'Settings gateway');

for(const token of ['working-campus-return-guard-v425','document-lifecycle-v221'])forbid(workerCore,token,'Service-worker core');
requireToken(wrapper,`system-routes-v227.js?v=${version}-five-system-route-contract-v227`,'Service-worker wrapper');

console.log(JSON.stringify({
  ok:true,
  version,
  revision:'interface-runtime-coherence-v1',
  staticCampus:true,
  fragmentEvaluation:false,
  settingsManagementOwner:'settings-gateway-v317',
  retiredRecoveryLayersAbsent:true,
  mutatesCheckout:false
},null,2));
