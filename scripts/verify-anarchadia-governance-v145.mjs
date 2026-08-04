import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
const root=process.cwd(),read=file=>fs.readFile(path.join(root,file),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const [html,ui,kernel,store,bridge,worker,pkgRaw,executor,testSource]=await Promise.all([
  read('public/app/anarchadia-governance-v145.html'),read('public/app/anarchadia-governance-v145.js'),read('public/app/anarchadia-governance-kernel-v145.js'),read('public/app/anarchadia-governance-store-v145.js'),read('public/app/anarchadia-governance-bridge-v145.js'),read('public/service-worker.js'),read('package.json'),read('scripts/anarchadia-branch-executor-v145.mjs'),read('scripts/test-anarchadia-governance-v145.mjs')
]);
const pkg=JSON.parse(pkgRaw),deviceRevision=worker.match(/const DEVICE_REVISION='([^']+)'/)?.[1]||'';
for(const token of ['Consent, ballots, federation, release','People & nodes','Changes','Ballots','Federation','Execution'])assert(html.includes(token),`Governance HTML is missing ${token}`);
for(const token of ['createCredential','createChangeSet','openBallot','castBallot','recordConsent','createDissent','createNodeOutcome','issueExecutionAuthorization','createExecutionPacket','validateExecutionPacket'])assert(kernel.includes(`function ${token}`)||kernel.includes(`async function ${token}`),`Kernel is missing ${token}`);
for(const token of ['Exact immutable base commit','Branch-only target','Forbidden-code scan','Risk and consent declaration'])assert(kernel.includes(token),`Rails are missing ${token}`);
assert(kernel.includes("executionMode:'branch-only'")&&kernel.includes("/^agent\\/anarchadia-/"),'Authorization is not branch-only.');
assert(ui.includes('commonweave.anarchadia.citizen-console.v139')&&ui.includes('Import latest console preview'),'Citizen Console preview import is not wired.');
assert(store.includes("const KEYS='keys'")&&store.includes('putPrivateKey')&&store.includes('getPrivateKey'),'Signing keys are not isolated in IndexedDB.');
assert(bridge.includes('GOVERNED UPDATE')&&bridge.includes('data-signal-vote')&&bridge.includes('vote-hub'),'Citizen Console bridge is incomplete.');
for(const asset of ['anarchadia-governance-v145.html','anarchadia-governance-v145.css','anarchadia-governance-v145.js','anarchadia-governance-kernel-v145.js','anarchadia-governance-store-v145.js','anarchadia-governance-bridge-v145.js','anarchadia-sovereignty-kernel-v146.js','install-boundary-v146.js','local-object-mesh-v146.js'])assert(worker.includes(asset),`Progressive package inventory omits ${asset}`);
assert(deviceRevision==='progressive-device-r37','Governance is not attached to the progressive device package.');
assert(worker.includes("INSTALL_REVISION='instant-entry-r37'")&&worker.includes("CABINET_REVISION='direct-software-r35'")&&worker.includes('anarchadia-sovereignty-kernel-v146.js'),'Governance is not installed inside the direct local-sovereignty package.');
assert(worker.includes("pathname.includes('anarchadia')&&!text.includes('/app/anarchadia-local-sovereignty-v146.js')"),'Local sovereignty injection is not scoped to Anarchadia.');
assert(executor.includes("git',['worktree','add','-b'")&&executor.includes("run('npm',['run','check']")&&executor.includes('pushPerformed:false')&&executor.includes('mergePerformed:false'),'Branch executor does not preserve prepare-only boundary.');
assert(pkg.scripts['anarchadia:execute']==='node scripts/anarchadia-branch-executor-v145.mjs','Executor command is missing.');
assert(pkg.scripts.check.includes('verify-anarchadia-governance-v145.mjs')&&pkg.scripts.check.includes('test:anarchadia-governance'),'Main verification suite omits governed self-update.');
assert(testSource.includes('execution packet is hash-bound')&&testSource.includes('signed node outcome verifies'),'Required governance tests are missing.');
console.log(JSON.stringify({ok:true,system:'anarchadia',governanceKernel:'v145',devicePackage:deviceRevision,installedSurface:'progressive-software-family-v1.0.4'},null,2));
