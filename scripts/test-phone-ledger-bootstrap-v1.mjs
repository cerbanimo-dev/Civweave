import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const PHONE_BOOT = '/app/phone-ledger-bootstrap-v1.js';
const TRANSPORT = '/app/local-object-mesh-v146.js';
const CONTRIBUTION = '/app/shared/civweave-contribution-mesh-v1.js';
const SECURITY = '/app/shared/civweave-contribution-security-v1.js';
const SHIP_GUARD = '/app/shared/civweave-contribution-ship-guard-v1.js';

test('phone ledger is browser-local, secured, contained, and does not require a host node', async () => {
  const source = await read('public/app/phone-ledger-bootstrap-v1.js');
  assert.match(source, /role:'phone-ledger-node'/);
  assert.match(source, /storage:'indexeddb'/);
  assert.match(source, /hostRequired:false/);
  assert.match(source, /globalThis\.indexedDB/);
  assert.match(source, /globalThis\.crypto\?\.subtle/);
  assert.match(source, /local-object-mesh-v146\.js/);
  assert.match(source, /civweave-contribution-mesh-v1\.js/);
  assert.match(source, /civweave-contribution-security-v1\.js/);
  assert.match(source, /civweave-contribution-ship-guard-v1\.js/);
  assert.match(source, /valueReady:Boolean\(security\.readyForContributionValue\)/);
  assert.match(source, /externalOfframpsEnabled:false/);
  assert.match(source, /walletFreeze:security\.walletFreeze/);
  assert.doesNotMatch(source, /NODE_AI_LEDGER_PATH|AI_WALLET_DATABASE_URL|@neondatabase|Postgres/i);
});

test('phone ledger remains required in the lightweight install shell and security layers are injected by installer state', async () => {
  const core = await read('public/service-worker-core-v208.js');
  const start = core.indexOf('const REQUIRED_SHELL_ASSETS = [');
  const end = core.indexOf('];', start);
  assert.ok(start >= 0 && end > start, 'required shell asset block must exist');
  const required = core.slice(start, end);
  for (const asset of [TRANSPORT, CONTRIBUTION, PHONE_BOOT]) {
    assert.ok(required.includes(`'${asset}'`), `required lightweight shell omits ${asset}`);
  }
  const installerState = await read('public/service-worker-installer-state-v280.js');
  for (const asset of [SECURITY, SHIP_GUARD]) assert.ok(installerState.includes(`'${asset}'`), `resumable installer shell omits ${asset}`);
  assert.match(installerState, /contributionSecurityRequired:\s*true/);
  assert.match(installerState, /walletContainmentRequired:\s*true/);
});

test('installed entry creates the secure contained ledger runtime before navigation begins', async () => {
  const html = await read('public/app/installed-entry-v146.html');
  const transport = html.indexOf(TRANSPORT);
  const contribution = html.indexOf(CONTRIBUTION);
  const security = html.indexOf(SECURITY);
  const guard = html.indexOf(SHIP_GUARD);
  const phone = html.indexOf(PHONE_BOOT);
  const router = html.indexOf('/app/installed-entry-v146.js');
  assert.ok(transport >= 0, 'installed entry must load local object mesh');
  assert.ok(contribution > transport, 'contribution runtime must follow transport runtime');
  assert.ok(security > contribution, 'security runtime must wrap contribution runtime');
  assert.ok(guard > security, 'ship guard must wrap contribution security');
  assert.ok(phone > guard, 'phone bootstrap must follow ship guard');
  assert.ok(router > phone, 'installed router must start after phone ledger bootstrap');
  const routerSource = await read('public/app/installed-entry-v146.js');
  assert.match(routerSource, /givePhoneLedgerBootWindow/);
  assert.match(routerSource, /CivweavePhoneLedgerV1/);
});

test('canonical phone surfaces reattach the secure ledger after navigation', async () => {
  const localFirst = await read('public/app/local-first-policy-v131.js');
  assert.match(localFirst, /phone-ledger-bootstrap-v1\.js/);
  assert.match(localFirst, /bootPhoneLedger\(\)/);
  const lifecycle = await read('public/app/document-lifecycle-v221.js');
  assert.match(lifecycle, /phone-ledger-bootstrap-v1\.js/);
  assert.match(lifecycle, /ensurePhoneLedger/);
  const localFirstSurfaces = [
    'public/app/cabinets/living-school/index.html',
    'public/app/realm-console-v140.html',
    'public/app/fellowfare-cabinet-v144.html',
    'public/app/anarchadia-console-v139.html',
  ];
  for (const path of localFirstSurfaces) {
    const html = await read(path);
    assert.match(html, /local-first-policy-v131\.js/, `${path} must attach local-first phone ledger boot`);
  }
  const hub = await read('public/app/working-campus-v156.html');
  assert.match(hub, /document-lifecycle-v221\.js/, 'working campus must attach lifecycle phone ledger boot');
});

test('offline campus explicitly carries every ship-secured phone-ledger runtime', async () => {
  const manifest = JSON.parse(await read('public/app/offline-package-v208.json'));
  assert.equal(manifest.phoneLedgerRevision, 'phone-ledger-r3-ship-security');
  for (const asset of [
    '/app/local-first-policy-v131.js',
    TRANSPORT,
    CONTRIBUTION,
    SECURITY,
    SHIP_GUARD,
    PHONE_BOOT,
  ]) assert.ok(manifest.assets.includes(asset), `offline package omits ${asset}`);
});
