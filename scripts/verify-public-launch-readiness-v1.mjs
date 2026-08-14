import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const requiredFiles = [
  'scripts/verify-pwa-cold-launch-recovery-v426.mjs',
  'scripts/verify-local-ai-smooth-fit-v314.mjs',
  'scripts/test-user-ai-pool-routing-v2.mjs',
  'scripts/verify-user-ai-pools-v302.mjs',
  'scripts/verify-legal-consent-v1.mjs',
  'scripts/civweave_d1_backup.py',
  '.github/workflows/cloudflare-money-emergency-stop-v1.yml',
  'public/app/LAUNCH-FORGE.md',
  'public/legal/civweave-legal-release-v1.json',
  'ops/launch/low-end-device-matrix-v1.json',
];
for (const path of requiredFiles) await access(new URL(path, root));
const readiness = JSON.parse(await read('ops/launch/public-launch-readiness-v1.json'));
const legalRelease = JSON.parse(await read('public/legal/civweave-legal-release-v1.json'));
const deviceMatrix = JSON.parse(await read('ops/launch/low-end-device-matrix-v1.json'));
const pkg = JSON.parse(await read('package.json'));
assert.equal(readiness.schema, 'civweave.public-launch-readiness.v1');
assert.equal(typeof readiness.publicLaunchApproved, 'boolean');
assert.equal(legalRelease.schema, 'civweave.legal-release.v1');
assert.equal(deviceMatrix.schema, 'civweave.low-end-device-matrix.v1');
assert.ok(pkg.scripts?.check, 'root repository regression command is required');
assert.ok(pkg.scripts?.['audit:production'], 'production dependency audit command is required');
assert.ok(pkg.scripts?.['check:release-discipline'], 'release-discipline command is required');
assert.ok(pkg.scripts?.['build:install'], 'install artifact build command is required');
const manualEntries = Object.entries(readiness.manualGates || {});
assert.ok(manualEntries.length >= 5, 'manual launch evidence must cover branch protection, production Worker, legal, restore, and low-end devices');
assert.deepEqual(manualEntries.filter(([,gate]) => !['blocked','pass'].includes(gate?.status)), [], 'manual launch gates must be explicitly pass or blocked');
const legalGate=readiness.manualGates.legalReviewAndClickwrap;
if(legalGate?.status==='pass'){
  assert.equal(legalRelease.status,'final','Passing legal evidence requires a final legal release manifest.');
  assert.equal(legalRelease.enforcement,'required','Passing legal evidence requires clickwrap enforcement.');
  assert.ok(legalRelease.termsVersion&&legalRelease.termsUrl,'Passing legal evidence requires versioned Terms.');
  assert.ok(legalGate.evidence,'Passing legal evidence requires a durable evidence reference.');
}
const deviceGate=readiness.manualGates.lowEndPhysicalDeviceMatrix;
if(deviceGate?.status==='pass'){
  assert.equal(deviceMatrix.status,'pass','Passing low-end evidence requires the physical device matrix itself to pass.');
  assert.ok(Array.isArray(deviceMatrix.devices)&&deviceMatrix.devices.length>=1,'At least one real low-end physical device result is required.');
  for(const [index,device] of deviceMatrix.devices.entries()){
    assert.equal(device.physical,true,`Device ${index+1} must be marked physical.`);
    assert.equal(device.verdict,'pass',`Device ${index+1} must pass.`);
    for(const scenario of deviceMatrix.requiredEvidence)assert.equal(device.scenarios?.[scenario],'pass',`Device ${index+1} is missing passing scenario ${scenario}.`);
    for(const metric of deviceMatrix.requiredMeasurements)assert.ok(Number.isFinite(Number(device.measurements?.[metric])),`Device ${index+1} is missing numeric measurement ${metric}.`);
  }
  assert.ok(deviceGate.evidence,'Passing low-end evidence requires a durable evidence reference.');
}
const blockers = manualEntries.filter(([,gate]) => gate.status !== 'pass').map(([id,gate]) => ({id,reason:gate.reason}));
if (readiness.publicLaunchApproved) assert.equal(blockers.length, 0, 'publicLaunchApproved cannot be true while manual evidence is blocked');
const strictPublic = process.argv.includes('--public');
const report = { ok: !strictPublic || (readiness.publicLaunchApproved && blockers.length === 0), schema: readiness.schema, releaseMode: readiness.releaseMode, publicLaunchApproved: readiness.publicLaunchApproved, blockers, legalRelease:{status:legalRelease.status,enforcement:legalRelease.enforcement}, physicalDeviceResults:deviceMatrix.devices.length, automatedGateCount: Object.keys(readiness.automatedGates || {}).length };
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 2;
