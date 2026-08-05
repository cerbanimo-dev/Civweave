import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

const [worker, installer, index, manifest] = await Promise.all([
  read('public/service-worker-v203.js'),
  read('public/install-v130.js'),
  read('public/index.html'),
  read('public/app/offline-package-v208.json').then(JSON.parse)
]);

assert.match(worker, /lightweight-shell-v208/);
assert.match(worker, /const SHELL_ASSETS = \[/);
assert.doesNotMatch(worker, /importScripts\(/);
assert.match(worker, /DOWNLOAD_OFFLINE_PACKAGE/);
assert.match(worker, /COMMONWEAVE_OFFLINE_PACKAGE_PROGRESS/);
assert.match(worker, /Promise\.allSettled/);
assert.match(worker, /knowledgeLibrarySeparate: true/);

assert.match(installer, /lightweight-shell-v208/);
assert.doesNotMatch(installer, /GET_CRITICAL_BOOT_STATUS/);
assert.doesNotMatch(installer, /GET_SHARED_IMAGE_STATUS/);
assert.doesNotMatch(installer, /GET_ADDITIONS_STATUS/);
assert.match(installer, /downloadOfflineCampus/);
assert.match(installer, /The campus pack no longer blocks installation/);

assert.match(index, /Install now\. Download the campus afterward\./);
assert.match(index, /id="download-offline-package"/);
assert.match(index, /no install gate/);

assert.equal(manifest.revision, 'resumable-discovered-campus-v208');
assert.ok(manifest.seeds.length >= 5);
assert.ok(manifest.excludePrefixes.includes('/app/models/'));

console.log('lightweight installer v208 smoke checks passed');
