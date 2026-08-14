import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const requiredFiles = [
  'scripts/verify-pwa-cold-launch-recovery-v426.mjs',
  'scripts/verify-local-ai-smooth-fit-v314.mjs',
  'scripts/test-user-ai-pool-routing-v2.mjs',
  'scripts/verify-user-ai-pools-v302.mjs',
  'scripts/civweave_d1_backup.py',
  '.github/workflows/cloudflare-money-emergency-stop-v1.yml',
  'public/app/LAUNCH-FORGE.md',
];
for (const path of requiredFiles) await access(new URL(path, root));
const readiness = JSON.parse(await read('ops/launch/public-launch-readiness-v1.json'));
const pkg = JSON.parse(await read('package.json'));
assert.equal(readiness.schema, 'civweave.public-launch-readiness.v1');
assert.equal(typeof readiness.publicLaunchApproved, 'boolean');
assert.ok(pkg.scripts?.check, 'root repository regression command is required');
assert.ok(pkg.scripts?.['audit:production'], 'production dependency audit command is required');
assert.ok(pkg.scripts?.['check:release-discipline'], 'release-discipline command is required');
assert.ok(pkg.scripts?.['build:install'], 'install artifact build command is required');
const manualEntries = Object.entries(readiness.manualGates || {});
assert.ok(manualEntries.length >= 5, 'manual launch evidence must cover branch protection, production Worker, legal, restore, and low-end devices');
assert.deepEqual(manualEntries.filter(([,gate]) => !['blocked','pass'].includes(gate?.status)), [], 'manual launch gates must be explicitly pass or blocked');
const blockers = manualEntries.filter(([,gate]) => gate.status !== 'pass').map(([id,gate]) => ({id,reason:gate.reason}));
if (readiness.publicLaunchApproved) assert.equal(blockers.length, 0, 'publicLaunchApproved cannot be true while manual evidence is blocked');
const strictPublic = process.argv.includes('--public');
const report = { ok: !strictPublic || (readiness.publicLaunchApproved && blockers.length === 0), schema: readiness.schema, releaseMode: readiness.releaseMode, publicLaunchApproved: readiness.publicLaunchApproved, blockers, automatedGateCount: Object.keys(readiness.automatedGates || {}).length };
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 2;
