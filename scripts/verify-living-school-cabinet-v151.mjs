import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(value,message)=>{if(!value)throw new Error(message)};

const [cabinet,index,css,runtime,workbench,workbenchCss,rubric,projectGate,cerbanimoBridge,worker,additiveWorker]=await Promise.all([
  read('public/app/cabinet-mode-v142.js'),
  read('public/app/cabinets/living-school/index.html'),
  read('public/app/cabinets/living-school/living-school-cabinet-v151.css'),
  read('public/app/cabinets/living-school/living-school-cabinet-v151.mjs'),
  read('public/app/cabinets/living-school/living-school-workbench-v158.js'),
  read('public/app/cabinets/living-school/living-school-workbench-v158.css'),
  read('public/app/services/living-school/modules/rubric-engine.mjs'),
  read('public/app/services/living-school/modules/project-gate.mjs'),
  read('public/app/services/living-school/modules/cerbanimo-bridge.mjs'),
  read('public/service-worker.js'),
  read('public/service-worker-v156.js')
]);

assert(cabinet.includes("system?.id==='living-school'"),'Cabinet Mode does not select the dedicated Living School runtime');
assert(cabinet.includes('/app/cabinets/living-school/index.html'),'Dedicated Living School URL is missing');
assert(!index.includes('realm-console-v140'),'Living School must not mount the generic realm console');
assert(index.includes('living-school-cabinet-v151.css'),'Living School v151 stylesheet is not mounted');
assert(index.includes('living-school-cabinet-v151.mjs'),'Living School v151 module runtime is not mounted');
assert(index.includes('living-school-workbench-v158.css')&&index.includes('living-school-workbench-v158.js'),'Generated-content workbench is not mounted');
assert(!index.includes('ls-scene-art')&&!index.includes('ls-tree')&&!index.includes('ls-window')&&!index.includes('ls-floor'),'Painted room drawing remains in Living School markup');
assert(index.includes('<title>Living School Learning Console</title>'),'Living School still presents itself as a cabinet drawing instead of a learning console');

for(const token of ['/app/cabinets/living-school/index.html','/app/cabinets/living-school/living-school-cabinet-v151.css','/app/cabinets/living-school/living-school-cabinet-v151.mjs'])assert(worker.includes(token),`Fast core package missing ${token}`);
for(const token of ['/app/cabinets/living-school/index.html','/app/cabinets/living-school/living-school-workbench-v158.css','/app/cabinets/living-school/living-school-workbench-v158.js'])assert(additiveWorker.includes(token),`Additive package missing ${token}`);

for(const token of ['Pathway Desk','Curriculum Forge','Research Conservatory','Learning Map','Lesson Atelier','Constellation Observatory','Practicum Workshop','Cerbanimo Bridge','Credential Forge','Creator & Systems Loft'])assert(runtime.includes(token),`Living School cabinet missing ${token}`);
for(const token of ['data-room','data-object','action-list','drawer','aria-label="Open room actions"'])assert(index.includes(token)||runtime.includes(token),`Shared visual and accessible action contract missing ${token}`);
assert(css.includes('prefers-reduced-motion'),'Reduced-motion support is missing from the retained runtime stylesheet');

for(const token of ['GENERATED LEARNING CONTENT','ACTIVE LEARNING PATH','moduleRail','generatedReader','data-lsw-module','Open full lesson','Open assessment','Manage sources'])assert(workbench.includes(token),`Visible generated-content interface missing ${token}`);
for(const token of ['living-school-curriculum-generation','CommonweaveFamilyAILoaderV105','CommonweaveModelRuntime','readSharedConfig','executionProfile:\'interactive\'','runtime.generate','curriculum-generated-shared','curriculum-generated-local-fallback'])assert(workbench.includes(token),`Real shared curriculum generation missing ${token}`);
for(const token of ['Shared Commonweave AI settings','Deterministic local compiler','Actual curriculum generation','data-form="forge"'])assert(workbench.includes(token),`Forge interception or unified settings route missing ${token}`);
for(const token of ['.ls-stage[data-room]','background:','ls-scene-art','display:none!important','.lsw-grid','.lsw-reader','.lsw-modules','.lsw-actions'])assert(workbenchCss.includes(token),`Living School workbench styling missing ${token}`);
assert(!workbenchCss.includes('ls-tree{')&&!workbenchCss.includes('ls-window{')&&!workbenchCss.includes('ls-floor{'),'New workbench stylesheet redraws the retired room scene');

for(const token of [
  "../../services/living-school/modules/rubric-engine.mjs",
  "../../services/living-school/modules/project-gate.mjs",
  "../../services/living-school/modules/cerbanimo-bridge.mjs",
  'rubric.evaluateShortAnswer',
  'bridge.createProjectHandoffRequest',
  'gate.applyReceipt',
  'gate.canUnlockFinalTest'
])assert(runtime.includes(token),`Retained feature engine is not wired: ${token}`);

assert(rubric.includes('export function evaluateShortAnswer'),'Retained deterministic rubric engine is incomplete');
assert(projectGate.includes('export function canUnlockFinalTest'),'Retained project gate cannot protect the final assessment');
assert(projectGate.includes('duplicate-receipt')&&projectGate.includes('stale-receipt'),'Project gate no longer rejects duplicate or stale receipts');
assert(cerbanimoBridge.includes('export function createProjectHandoffRequest'),'Canonical Cerbanimo handoff builder is missing');

for(const token of ['living-school-cabinet-v151','commonweave.living-school.cabinet.v151','commonweave.living-school.cabinet.v150','commonweave.cerbanimo.project-handoff.outbox.v1'])assert(runtime.includes(token),`Versioned state or migration contract missing ${token}`);
for(const token of ['authoritative','practitioner','community','commercial','contested','source-pack'])assert(runtime.includes(token),`Research and provenance option missing ${token}`);
for(const token of ['curriculum-forged','source-added','lesson-completed','assessment-evaluated','practicum-saved','cerbanimo-handoff-created','cerbanimo-receipt-applied','final-assessment-evaluated','credential-issued'])assert(runtime.includes(token),`Golden-path event receipt missing ${token}`);

assert(!runtime.includes('local-cabinet-test'),'Fake local Cerbanimo acceptance remains in the v151 runtime');
assert(!runtime.includes("status:'accepted',questId"),'Living School can still mint its own accepted project receipt');
assert(runtime.includes("status:'submitted'"),'Canonical handoff does not stop at submitted before receipt validation');
assert(runtime.includes('Only a validated v151 cabinet record can be restored.'),'State restore lacks schema validation');
assert(runtime.includes('.backup.${Date.now()}'),'State restore lacks a pre-import backup');
new Function(workbench);

console.log(JSON.stringify({
  ok:true,
  system:'living-school',
  surface:'generated-content-workbench',
  paintedBackground:false,
  curriculumGeneration:['shared-commonweave-model','deterministic-fallback'],
  generatedContentVisible:['modules','lesson','practice','assessment','progress','sources'],
  retainedEngines:['rubric-engine','project-gate','cerbanimo-bridge'],
  fakeAcceptance:false
},null,2));
