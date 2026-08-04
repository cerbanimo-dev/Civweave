import {readFile} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const [campus,boundary,worker,installer,pwa,vault,domain,qr,mesh,additions,css]=await Promise.all([
  read('public/app/fullscreen-family-v104.html'),
  read('public/app/install-boundary-v146.js'),
  read('public/service-worker-v156.js'),
  read('public/install-v130.js'),
  read('public/app/pwa-v130.js'),
  read('public/extensions/commonweave-secure-vault-v156.js'),
  read('public/extensions/commonweave-domain-bridge-v156.js'),
  read('public/extensions/commonweave-qr-v156.js'),
  read('public/extensions/commonweave-mesh-tools-v156.js'),
  read('public/extensions/commonweave-additions-v156.js'),
  read('public/extensions/commonweave-additions-v156.css')
]);
assert(campus.includes('Commonweave Working Campus')&&campus.includes("const payload='H4sI"),'The current working-campus MVP was replaced instead of extended.');
for(const token of ['Response.prototype.text','commonweave.working-campus.v1','/extensions/commonweave-additions-v156.js','installAdditions'])assert(boundary.includes(token),`Install boundary is missing additive hook ${token}.`);
for(const token of ["importScripts('/service-worker.js",'cwext-working-campus-additions-v156','commonweave-secure-vault-v156.js','commonweave-domain-bridge-v156.js','commonweave-qr-v156.js','commonweave-mesh-tools-v156.js','patchInstalledBoundary','GET_ADDITIONS_STATUS'])assert(worker.includes(token),`Additive device worker is missing ${token}.`);
assert(installer.includes('/service-worker-v156.js')&&installer.includes("WORKER_REVISION='device-package-r35-direct'")&&installer.includes("ADDITIONS_REVISION='working-campus-additions-v156'")&&installer.includes('GET_ADDITIONS_STATUS'),'Installer does not preserve the base package and require the additive package.');
assert(pwa.includes('/service-worker-v156.js')&&pwa.includes('working-campus-additions-v156'),'Installed manual updater does not retain the additive worker.');
for(const token of ['AES-GCM','PBKDF2','250000','commonweave-model-profiles-v1','commonweave-model-secrets-v1','sessionStorage','remember','unlock','scrubPlaintext'])assert(vault.includes(token),`Secure vault is missing ${token}.`);
assert(!vault.includes("localStorage.setItem(SECRET_KEY"),'Vault stores raw API secrets in ordinary local storage.');
for(const token of ['commonweave.domain.v156','commonweave.learning-request.v156','commonweave.task-request.v156','commonweave.materials-request.v156','commonweave.reward-ledger.v156','acorn','button','cotoken','bridgeLivingRewards','bridgeCerbanimoRewards'])assert(domain.includes(token),`Domain bridge is missing ${token}.`);
assert(domain.includes('const SOURCE_KEYS=new Set([KEYS.campus,KEYS.intentions,KEYS.living,KEYS.cerbanimo,KEYS.fellowfare])'),'Domain bridge watches its own derived storage keys.');
assert(domain.includes("ledger.events.some(item=>item.id===eventRow.id))return null"),'Duplicate reward events are not rejected idempotently.');
assert(!domain.includes("updatedAt:now()};const learning=normalizeRequest"),'Canonical campus snapshot changes merely because it was read.');
for(const token of ['createOffer','acceptOffer','acceptAnswer','friend-offer-v156','friend-answer-v156','/api/envelopes','publishTrade','requestValidation','publishValidation','scrub'])assert(mesh.includes(token),`Mesh tools are missing ${token}.`);
assert(mesh.includes('BarcodeDetector')&&mesh.includes('CommonweaveQRV156.canvas'),'QR friend pairing is incomplete.');
for(const token of ['Shared AI vault','Antigravity / research agent','Node & friends','Rewards','Active thread','data-cwv-request-validation','validatePeerRequest','interceptSettings'])assert(additions.includes(token),`Shared additions UI is missing ${token}.`);
assert(css.includes('.cwv156-dialog')&&css.includes('.cwv156-tools')&&css.includes('prefers-reduced-motion'),'Additive UI styling or accessibility boundary is incomplete.');
const sandbox={console,TextEncoder,Uint8Array,Array,Math,Error,Object,String,Number,Boolean,JSON,globalThis:null};sandbox.globalThis=sandbox;vm.createContext(sandbox);vm.runInContext(qr,sandbox,{filename:'commonweave-qr-v156.js'});
const code='https://commonweave-host-node.onrender.com/?cwfriend=123e4567-e89b-12d3-a456-426614174000';
const matrix=sandbox.CommonweaveQRV156.matrix(code);
assert(matrix.version>=1&&matrix.version<=6,'QR renderer selected an unsupported version.');
assert(matrix.size===21+(matrix.version-1)*4,'QR matrix has an invalid size.');
assert(matrix.cells[0][0]&&matrix.cells[6][6]&&matrix.cells[matrix.size-7][0],'QR finder patterns are missing.');
assert(matrix.cells.every(row=>row.every(value=>typeof value==='boolean')),'QR matrix contains unfilled modules.');
console.log(JSON.stringify({ok:true,foundation:'working-campus-v155-retained',additions:['encrypted-shared-ai-vault','typed-cross-system-requests','append-only-rewards','qr-friend-rendezvous','signed-mesh-trade','peer-ai-validation'],offlineWorker:'service-worker-v156',qrVersion:matrix.version},null,2));
