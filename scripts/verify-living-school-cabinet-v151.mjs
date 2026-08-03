import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(value,message)=>{if(!value)throw new Error(message)};

const [cabinet,index,css,runtime,rubric,projectGate,cerbanimoBridge,worker]=await Promise.all([
  read('public/app/cabinet-mode-v142.js'),
  read('public/app/cabinets/living-school/index.html'),
  read('public/app/cabinets/living-school/living-school-cabinet-v151.css'),
  read('public/app/cabinets/living-school/living-school-cabinet-v151.mjs'),
  read('public/app/services/living-school/modules/rubric-engine.mjs'),
  read('public/app/services/living-school/modules/project-gate.mjs'),
  read('public/app/services/living-school/modules/cerbanimo-bridge.mjs'),
  read('public/service-worker.js')
]);

assert(cabinet.includes("system?.id==='living-school'"),'Cabinet Mode does not select the dedicated Living School runtime');
assert(cabinet.includes('/app/cabinets/living-school/index.html'),'Dedicated Living School cabinet URL is missing');
assert(!index.includes('realm-console-v140'),'Living School must not mount the generic realm console');
assert(index.includes('living-school-cabinet-v151.css'),'Living School v151 stylesheet is not mounted');
assert(index.includes('living-school-cabinet-v151.mjs'),'Living School v151 module runtime is not mounted');

for(const token of ['/app/cabinets/living-school/index.html','/app/cabinets/living-school/living-school-cabinet-v151.css','/app/cabinets/living-school/living-school-cabinet-v151.mjs']){
  assert(worker.includes(token),`Installed device package missing ${token}`);
}

for(const token of ['Pathway Desk','Curriculum Forge','Research Conservatory','Learning Map','Lesson Atelier','Constellation Observatory','Practicum Workshop','Cerbanimo Bridge','Credential Forge','Creator & Systems Loft']){
  assert(runtime.includes(token),`Living School cabinet missing ${token}`);
}
for(const token of ['data-room','data-object','action-list','drawer','aria-label="Open room actions"']){
  assert(index.includes(token)||runtime.includes(token),`Shared visual and accessible action contract missing ${token}`);
}
assert(css.includes('clip-path:polygon'),'In-world shaped cabinet instruments are missing');
assert(css.includes('prefers-reduced-motion'),'Reduced-motion support is missing');

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

for(const token of ['living-school-cabinet-v151','commonweave.living-school.cabinet.v151','commonweave.living-school.cabinet.v150','commonweave.cerbanimo.project-handoff.outbox.v1']){
  assert(runtime.includes(token),`Versioned state or migration contract missing ${token}`);
}
for(const token of ['authoritative','practitioner','community','commercial','contested','source-pack']){
  assert(runtime.includes(token),`Research and provenance option missing ${token}`);
}
for(const token of ['guided','just-in-time','browse','review','creator','deterministic','browser','ollama','openai-compatible','manual']){
  assert(runtime.includes(token),`Learning or model route missing ${token}`);
}
for(const token of ['curriculum-forged','source-added','lesson-completed','assessment-evaluated','practicum-saved','cerbanimo-handoff-created','cerbanimo-receipt-applied','final-assessment-evaluated','credential-issued']){
  assert(runtime.includes(token),`Golden-path event receipt missing ${token}`);
}

assert(!runtime.includes('local-cabinet-test'),'Fake local Cerbanimo acceptance remains in the v151 runtime');
assert(!runtime.includes("status:'accepted',questId"),'Cabinet can still mint its own accepted project receipt');
assert(runtime.includes("status:'submitted'"),'Canonical handoff does not stop at submitted before receipt validation');
assert(runtime.includes('Only a validated v151 cabinet record can be restored.'),'State restore lacks schema validation');
assert(runtime.includes('.backup.${Date.now()}'),'State restore lacks a pre-import backup');

console.log(JSON.stringify({
  ok:true,
  mode:'cabinet-only',
  system:'living-school',
  version:'v151',
  rooms:10,
  offlineDevicePackage:true,
  retainedEngines:['rubric-engine','project-gate','cerbanimo-bridge'],
  goldenPath:['forge','research','map','lesson','assessment','constellation','practicum','canonical-handoff','validated-receipt','final','credential'],
  fakeAcceptance:false
},null,2));
