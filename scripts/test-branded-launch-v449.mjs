import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const manifest = JSON.parse(read('public/app/manifest.webmanifest'));
const launch = read('public/app/pwa-start-v436.html');
const integrity = JSON.parse(read('public/app/shell-integrity-v281.json'));
const assets = '/app/logos/civweave-branded-heart';

test('approved textual heart is referenced by every installed PWA icon', () => {
  const expected = [
    [assets + '-192-v449.png', 192, 'any'],
    [assets + '-512-v449.png', 512, 'any'],
    [assets + '-maskable-512-v449.png', 512, 'maskable'],
  ];
  assert.deepEqual(manifest.icons.map(icon => [icon.src, Number(icon.sizes.split('x')[0]), icon.purpose]), expected);
  for (const [src, size] of expected) {
    const file = readFileSync(new URL('../public' + src, import.meta.url));
    assert.equal(file.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(file.readUInt32BE(16), size);
    assert.equal(file.readUInt32BE(20), size);
  }
  for (const shortcut of manifest.shortcuts) {
    assert.ok(shortcut.icons.every(icon => icon.src === assets + '-512-v449.png'));
  }
});

test('installed app shows wordmark heart above existing fighting sprites', () => {
  assert.match(launch, /class="cw-launch-logo"[^>]+branded-heart-512-v449/);
  assert.ok(launch.indexOf('cw-launch-logo') < launch.indexOf('id="cw-launch-battle"'));
  for (const cast of ['Weaveling', 'Moss', 'Kamiya', 'Rook', 'Merlin']) {
    assert.ok(launch.includes("name:'" + cast + "'"), cast + ' should be in the battle roster');
    assert.ok(launch.includes('/app/assets/ai/' + cast.toLowerCase() + '-review-sprites-v1.png'));
  }
  assert.ok(launch.includes('/app/assets/ai/lari-review-sprites-v1.png'));
  assert.match(launch, /prefers-reduced-motion:reduce/);
  assert.match(launch, /visibilitychange/);
  assert.match(launch, /setInterval\(choose,3400\)/);
  assert.match(launch, /WORKER_SETTLE_MS=6000/);
  assert.match(launch, /location\.replace\(target\.href\)/);
  assert.doesNotMatch(launch, /rewardReceipt|grantReward|markFresh\(/);
});

test('brand regeneration starts from approved image, not legacy day/night header', () => {
  const gen = read('scripts/generate-civweave-icons.mjs');
  assert.ok(gen.includes("const sourcePath=path.join(logoDir,'civweave-branded-heart-source-v449.webp')"));
  assert.ok(gen.includes("await writeIcon('civweave-branded-heart-512-v449.png'"));
  assert.ok(existsSync(new URL('../public/app/logos/civweave-branded-heart-source-v449.webp', import.meta.url)));
});

test('offline shell integrity hashes are in sync after changing launch files', () => {
  for (const pathname of ['/app/pwa-start-v436.html', '/app/manifest.webmanifest', '/app/index.html']) {
    const bytes = readFileSync(new URL('../public' + pathname, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), integrity.assets[pathname], pathname);
  }
});


test('installed PWA header and installer use the approved branded heart, never outdoor day/night art', () => {
  const runtime=read('public/app/working-campus-v156.js');
  const installer=read('public/app/civweave-brand.js');
  const gateway=read('public/app/index.html');
  for (const source of [runtime,installer,gateway]) {
    assert.doesNotMatch(source,/civweave-(?:day|night)-logo\\.jpg/);
  }
  for (const page of ['working-campus-v156.html','working-campus-v437.html','working-campus-v440.html']) {
    assert.match(read('public/app/'+page),/src="\\/app\\/logos\\/civweave-branded-heart-512-v449\\.png" alt="Civweave"/);
  }
});
