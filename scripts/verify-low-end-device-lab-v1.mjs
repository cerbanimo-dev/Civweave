import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [html,lab,matrixText,worker,readinessText]=await Promise.all([
  read('public/app/low-end-device-lab-v1.html'),
  read('public/app/low-end-device-lab-v1.js'),
  read('ops/launch/low-end-device-matrix-v1.json'),
  read('public/service-worker-core-v208.js'),
  read('ops/launch/public-launch-readiness-v1.json')
]);
new Function(lab);
const matrix=JSON.parse(matrixText),readiness=JSON.parse(readinessText);
assert.equal(matrix.schema,'civweave.low-end-device-matrix.v1');
assert.equal(matrix.status,'blocked','Physical gate must remain blocked until real evidence is reviewed.');
assert.equal(matrix.physicalEvidenceRequired,true);
assert.equal(matrix.syntheticEvidenceAccepted,false);
assert.equal(matrix.labPath,'/app/low-end-device-lab-v1.html');
assert.equal(matrix.evidenceSchema,'civweave.low-end-device-evidence.v1');
for(const id of ['coldLaunchOnline','coldLaunchOffline','warmMiniLmClassification','smolLm135mGeneration','memoryPressureRecovery','workerShutdown','interruptedModelDownloadRecovery','fullyDisconnectedRelaunch','thermalAndBatteryObservation'])assert.ok(matrix.requiredEvidence.includes(id),`missing physical scenario ${id}`);
for(const id of ['startupMs','miniLmColdMs','miniLmWarmMs','smolLm135mFirstTokenMs','smolLm135mTokensPerSecond','peakMemoryMb'])assert.ok(matrix.requiredMeasurements.includes(id),`missing physical measurement ${id}`);
assert.equal(readiness.manualGates?.lowEndPhysicalDeviceMatrix?.status,'blocked','Public launch must stay blocked before physical evidence is recorded.');
for(const token of [
  'Low-end device launch lab',
  'Run core device checks',
  'Install / repair 135M model',
  'Arm offline relaunch',
  'Arm memory-pressure return',
  'Begin interrupted-download checkpoint',
  'Export hashed evidence JSON',
  '/app/local-ai/test-pulse-v269.js',
  '/app/minilm-context-router-v344.js',
  '/app/low-end-device-lab-v1.js'
])assert.ok(html.includes(token),`lab HTML missing ${token}`);
for(const token of [
  "SCHEMA='civweave.low-end-device-evidence.v1'",
  "MODEL_ID='smollm2-135m-instruct-q8-wasm'",
  'physicalEvidenceRequired:true',
  'syntheticEvidenceAccepted:false',
  "import('/app/models/all-minilm-l6-v2/adapter.js')",
  "adapter.shutdown('low-end-device-lab-cold-reset')",
  "adapter.shutdown('low-end-device-lab-worker-shutdown')",
  'r.emotion(',
  'p.test(MODEL_ID',
  'm.select(MODEL_ID)',
  'm.select(original.id)',
  'navigator.onLine',
  "document.addEventListener('visibilitychange'",
  'manager()?.sync?.()',
  'crypto.subtle.digest',
  "automaticUpload:false",
  "locationCollected:false",
  "chatContentCollected:false",
  "credentialsCollected:false"
])assert.ok(lab.includes(token),`lab runtime missing ${token}`);
assert.ok(!/geolocation|getCurrentPosition|watchPosition/.test(lab),'Physical lab must not collect location.');
assert.ok(!/fetch\([^\n]*(?:evidence|upload)|XMLHttpRequest|sendBeacon/.test(lab),'Physical evidence must not be automatically uploaded.');
for(const asset of [
  '/app/low-end-device-lab-v1.html',
  '/app/low-end-device-lab-v1.js',
  '/app/local-ai/model-registry-v266.js',
  '/app/local-ai/download-manager-v267.js',
  '/app/local-ai/runtime-v266.js',
  '/app/mobile-ai-hardening-v302.js',
  '/app/local-ai/test-pulse-v269.js',
  '/app/minilm-context-router-v344.js',
  '/app/models/all-minilm-l6-v2/adapter.js'
])assert.ok(worker.includes(`'${asset}'`),`Installed shell does not retain physical lab dependency ${asset}`);
console.log(JSON.stringify({ok:true,schema:matrix.schema,lab:matrix.labPath,physicalEvidenceRequired:true,syntheticEvidenceAccepted:false,requiredScenarios:matrix.requiredEvidence.length,requiredMeasurements:matrix.requiredMeasurements.length,publicGateStillBlocked:true,offlineShell:true},null,2));
