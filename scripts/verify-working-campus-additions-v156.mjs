import {readFile} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const [campus,campusPart4,boundary,worker,installer,pwa,vault,domain,qr,mesh,additions,css,validator,modelDownload,baseWorker]=await Promise.all([
  read('public/app/working-campus-v156.html'),
  read('public/app/working-campus-v156.part4.txt'),
  read('public/app/install-boundary-v146.js'),
  read('public/service-worker-v156.js'),
  read('public/install-v130.js'),
  read('public/app/pwa-v130.js'),
  read('public/extensions/commonweave-secure-vault-v156.js'),
  read('public/extensions/commonweave-domain-bridge-v156.js'),
  read('public/extensions/commonweave-qr-v156.js'),
  read('public/extensions/commonweave-mesh-tools-v156.js'),
  read('public/extensions/commonweave-additions-v156.js'),
  read('public/extensions/commonweave-additions-v156.css'),
  read('public/app/cerbanimo-ai-validator-v156.js'),
  read('public/extensions/commonweave-model-download-v157.js'),
  read('public/service-worker.js')
]);
assert(campus.includes('Commonweave Working Campus')&&campus.includes('/app/working-campus-v156.js'),'PR #56 source-based Working Campus is not the retained foundation.');
assert(!campus.includes("const payload='H4sI"),'The obsolete packed Working Campus payload was reintroduced.');
for(const token of ['test-gemini','test-antigravity','commonweave-model-profiles-v1','agenticEnabled'])assert(campus+campusPart4.includes(token),`PR #56 native AI setup is missing ${token}.`);
for(const token of ['/extensions/commonweave-additions-v156.js','/extensions/commonweave-additions-v156.css','/extensions/commonweave-model-download-v157.js','installAdditions','v157-fast-core'])assert(boundary.includes(token),`Install boundary is missing direct source-page additive hook ${token}.`);
assert(!boundary.includes('Response.prototype.text')&&!boundary.includes('patchWorkingCampusPayload'),'Packed-response interception survived the PR #56 integration.');
for(const token of ["importScripts('/service-worker.js?v=1.0.4-base-r37-core')",'cwext-working-campus-additions-v157-fast-core','commonweave-secure-vault-v156.js','commonweave-domain-bridge-v156.js','commonweave-qr-v156.js','commonweave-mesh-tools-v156.js','commonweave-model-download-v157.js','patchInstalledBoundary','GET_ADDITIONS_STATUS'])assert(worker.includes(token),`Additive device worker is missing ${token}.`);
assert(installer.includes('/service-worker-v156.js')&&installer.includes("WORKER_REVISION='device-package-r37-core'")&&installer.includes("ADDITIONS_REVISION='working-campus-additions-v157-fast-core'")&&installer.includes('GET_ADDITIONS_STATUS')&&installer.includes('GET_MODEL_PACKAGE_STATUS'),'Installer does not verify the fast core and additive packages independently.');
assert(pwa.includes('/service-worker-v156.js')&&pwa.includes('device-package-r37-core')&&pwa.includes('working-campus-additions-v157-fast-core'),'Installed updater does not target the fast core worker.');
for(const token of ['MODEL_FILES','modelOnDemand','modelDeferred:true','GET_MODEL_PACKAGE_STATUS'])assert(baseWorker.includes(token),`Base worker is missing optional model boundary ${token}.`);
for(const token of ['data-download-local-model','adapter.install','commonweave:model-package-ready','Download local model'])assert(modelDownload.includes(token),`Explicit model download runtime is missing ${token}.`);
for(const token of ['AES-GCM','PBKDF2','250000','commonweave-model-profiles-v1','commonweave.model-secret.v1','sessionStorage','remember','unlock','scrubPlaintext'])assert(vault.includes(token),`Secure vault is missing ${token}.`);
assert(!vault.includes('localStorage.setItem(NATIVE_SECRET_KEY')&&!vault.includes('localStorage.setItem(SECRET_KEY'),'Vault stores raw API secrets in ordinary local storage.');
for(const token of ['commonweave.learning-request.v156','commonweave.task-request.v156','commonweave.materials-request.v156','commonweave.reward-ledger.v156','cerbanimo.ai-reviews.v156','commonweave.cerbanimo.peer-reviews.v156','qualifiedProvider','recordPeerReview','peerReviewStatus','patchCerbanimoEngine'])assert(domain.includes(token),`Domain and reward bridge is missing ${token}.`);
assert(domain.includes("[['button',2],['acorn',1]]"),'Local independent validation no longer mints Buttons and Acorns.');
assert(domain.includes("currency:'xp',amount:25")&&domain.includes("phase:'main-xp'"),'Main skill XP is not tied to local independent AI validation.');
assert(domain.includes('passingCount:validators.size,threshold:2')&&domain.includes("currency:'cotoken',amount:1")&&domain.includes("currency:'xp',amount:10")&&domain.includes("phase:'bonus-xp'"),'Two-peer Cotoken and bonus-XP threshold is incomplete.');
assert(domain.includes('rows.some(row=>row.validatorId===validatorId||row.objectId===object?.id)'),'Duplicate peer validators or replayed receipts can count twice.');
assert(domain.includes("!['','deterministic','bundled','reflex','minilm','manual'].includes(provider)"),'Unqualified local providers can mint rewards.');
for(const token of ['createOffer','acceptOffer','acceptAnswer','friend-offer-v156','friend-answer-v156','/api/envelopes','publishTrade','requestValidation','publishValidation','scrub','syncNode','ensureMesh'])assert(mesh.includes(token),`Mesh tools are missing ${token}.`);
assert(mesh.includes('BarcodeDetector')&&mesh.includes('CommonweaveQRV156.canvas'),'QR friend pairing is incomplete.');
for(const token of ["const PENDING_KEY='commonweave.friend-pairings.pending.v156'",'sessionStorage.getItem(PENDING_KEY)','crypto.subtle.digest(\'SHA-256\'','name:\'HMAC\'','answerProof','verifyAnswerProof','/#cwfriend='])assert(mesh.includes(token),`Private QR rendezvous is missing ${token}.`);
assert(!mesh.includes('localStorage.setItem(PENDING_KEY'),'Pending QR secrets are stored persistently.');
for(const token of ['PR #56','nativeSettings','Node & friends','Rewards','Active thread','data-cwv-request-validation','validatePeerRequest','2 distinct peer AI passes','automaticReward:false'])assert(additions.includes(token),`Shared additions UI is missing ${token}.`);
assert(!additions.includes('interceptSettings'),'The additive layer hijacks PR #56 native Gemini/Antigravity settings.');
for(const token of ['result?.status!==\'success\'','result?.fallback?.used','deterministic','requestId','fallbackUsed:false'])assert(additions.includes(token),`Peer validator is missing fail-closed token ${token}.`);
for(const token of ['result?.fallback?.used','Self-validation is disabled','cerbanimo-independent-task-validation-v156'])assert(validator.includes(token),`PR #56 local independent validator is missing ${token}.`);
assert(css.includes('.cwv156-dialog')&&css.includes('.cwv156-tools')&&css.includes('prefers-reduced-motion'),'Additive UI styling or accessibility boundary is incomplete.');
const sandbox={console,TextEncoder,Uint8Array,Array,Math,Error,Object,String,Number,Boolean,JSON,globalThis:null};sandbox.globalThis=sandbox;vm.createContext(sandbox);vm.runInContext(qr,sandbox,{filename:'commonweave-qr-v156.js'});
const code='https://commonweave-host-node.onrender.com/#cwfriend=123e4567-e89b-12d3-a456-426614174000';
const matrix=sandbox.CommonweaveQRV156.matrix(code);
assert(matrix.version>=1&&matrix.version<=6,'QR renderer selected an unsupported version.');
assert(matrix.size===21+(matrix.version-1)*4,'QR matrix has an invalid size.');
assert(matrix.cells[0][0]&&matrix.cells[6][6]&&matrix.cells[matrix.size-7][0],'QR finder patterns are missing.');
assert(matrix.cells.every(row=>row.every(value=>typeof value==='boolean')),'QR matrix contains unfilled modules.');
console.log(JSON.stringify({ok:true,foundation:'working-campus-v156-source-retained',corePackage:'r37-fast',modelPackage:'explicit-same-origin-download',localCerbanimoRewards:['buttons','acorns','main-skill-xp'],twoPeerRewards:['cotoken','bonus-skill-xp'],additions:['encrypted-native-ai-vault','typed-cross-system-requests','private-qr-friends','signed-mesh-trade','peer-ai-validation'],offlineWorker:'service-worker-v156',qrVersion:matrix.version},null,2));