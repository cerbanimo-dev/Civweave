import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = async path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [tool, campus, installed] = await Promise.all([
  read('public/app/clear-signal-v1.html'),
  read('public/app/working-campus-v440.html'),
  read('public/app/working-campus-v156.html'),
]);

assert.match(tool, /<title>Clear Signal/);
assert.match(tool, /Self-check tool · Not a threat detector/);
assert.match(tool, /It cannot detect magic, psychic signals, surveillance, attacks, or medical conditions/);
assert.match(tool, /Sudden confusion, fainting, difficulty speaking, weakness/);
assert.match(tool, /What did I directly notice\?/);
assert.match(tool, /What explanation am I considering\?/);
assert.match(tool, /aria-live="polite"/);
assert.match(tool, /href="\/app\/working-campus-v440\.html"/);
for (const id of ['checkin','ground','facts','support']) {
  assert.match(tool, new RegExp(`id="${id}"`));
  assert.match(tool, new RegExp(`data-target="${id}"`));
}
// Self-contained, no model inference, no telemetry, no persistent personal data.
assert.doesNotMatch(tool, /<script[^>]*\bsrc=/i);
// Only the explicit offline save gesture may fetch the same-origin page.
assert.match(tool, /fetch\(key,\{cache:'reload',credentials:'same-origin'\}\)/);
assert.match(tool, /offlineSave\.addEventListener\('click',\(\)=>saveOfflineCopy\(\)\)/);
assert.doesNotMatch(tool, /\b(?:XMLHttpRequest|WebSocket|EventSource|sendBeacon)\s*\(/);
assert.doesNotMatch(tool, /\b(?:localStorage|sessionStorage|indexedDB)\b/);
assert.match(tool, /const OFFLINE_CACHE='civweave-offline-clear-signal-v1'/);
assert.match(tool, /Save for offline/);
assert.match(tool, /Download portable HTML/);
assert.match(tool, /async function checkOfflineCopy\(\)/);
const [shellAssets, offlineManifest, releaseWorker, worker, workerSource] = await Promise.all([
  read('public/service-worker-shell-assets-v1.js'),
  read('public/app/offline-package-v208.json'),
  read('public/service-worker-release-generation-v1.js'),
  read('public/service-worker-v203.js'),
  read('scripts/build-service-worker-v211.mjs'),
]);
assert.match(shellAssets, /'\/app\/clear-signal-v1\.html'/);
assert.ok(JSON.parse(offlineManifest).seeds.includes('/app/clear-signal-v1.html'));
assert.match(releaseWorker, /'civweave-offline-'/);
assert.match(releaseWorker, /async function legacyFallback\(/);
assert.match(worker, /shell-assets-v1-repair-v450-desktop-startup-bounded-clear-signal-v2/);
assert.match(workerSource, /shell-assets-v1-repair-v450-desktop-startup-bounded-clear-signal-v2/);

for (const source of [campus, installed]) {
  assert.match(source, /href="\/app\/clear-signal-v1\.html"/);
  assert.match(source, /aria-label="Open Clear Signal grounding tools"/);
}
console.log('Clear Signal: safe manual offline caching, app shell precache, offline manifest and campus links PASS');
