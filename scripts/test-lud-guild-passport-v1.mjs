import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function makeStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem(key) { return map.has(String(key)) ? map.get(String(key)) : null; },
    setItem(key, value) { map.set(String(key), String(value)); },
    removeItem(key) { map.delete(String(key)); },
    dump() { return Object.fromEntries(map); },
  };
}

async function runPassport(seed = {}) {
  const source = await read('public/app/shared/civweave-passport-identity-v1.js');
  const localStorage = makeStorage(seed);
  const events = [];
  class CustomEventMock { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } }
  const context = {
    localStorage,
    crypto: { randomUUID },
    structuredClone,
    CustomEvent: CustomEventMock,
    dispatchEvent(event) { events.push(event); return true; },
    Date,
    Math,
  };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename: 'civweave-passport-identity-v1.js' });
  return { api: context.CivweavePassportIdentityV1, localStorage, events };
}

test('Lud package includes the canonical Guild membership path and Passport initializer', async () => {
  const manifest = JSON.parse(await read('public/app/lud-package-v1.json'));
  assert.equal(manifest.policy.guildMembership, true);
  assert.equal(manifest.policy.passportIdentity, true);
  for (const asset of [
    '/app/shared/civweave-passport-identity-v1.js',
    '/app/host-node-session-v1.js',
    '/app/host-node-installer-lobby-v1.js',
    '/app/host-node-local-capacity-v1.js',
    '/app/host-node-paid-join-v1.js',
    '/app/host-node-status-selection-v1.js',
  ]) assert.ok(manifest.assets.includes(asset), `${asset} must be in the Lud allowlist`);
});

test('Lud campus exposes Passport and the existing Guild join owner without enabling AI', async () => {
  const campus = await read('public/app/lud/campus.html');
  assert.match(campus, /shared\/civweave-passport-identity-v1\.js/);
  assert.match(campus, /host-node-session-v1\.js/);
  assert.match(campus, /host-node-installer-lobby-v1\.js/);
  assert.match(campus, /id="lud-passport-id"/);
  assert.match(campus, /Joining a Guild never turns AI back on while Lud Mode is active\./);
  assert.match(campus, /validator neuron rewards are same-day bonuses and expire at that same reset/i);
  assert.doesNotMatch(campus, /family-ai-loader|guide-chat|assistant-runtime|server-ai|node-ai|local-ai\/|minilm|smollm|gemini/i);
});

test('Passport initializer creates the same Anarchadia Passport storage contract locally', async () => {
  const { api, localStorage, events } = await runPassport();
  const record = api.snapshot();
  assert.equal(api.storageKey, 'civweave.anarchadia.citizen-console.v139');
  assert.equal(record.schema, 'civweave.anarchadia-console.v1');
  assert.match(record.passportId, /^AC-[A-F0-9]{8}$/);
  assert.deepEqual(Array.from(record.proposals), []);
  assert.ok(record.ledger.length >= 1);
  assert.equal(record.settings.autoRun, true);
  const stored = JSON.parse(localStorage.getItem(api.storageKey));
  assert.equal(stored.passportId, record.passportId);
  assert.ok(events.some(event => event.type === 'civweave:passport-ready'));
});

test('Passport initializer preserves a Passport generated earlier by Anarchadia', async () => {
  const key = 'civweave.anarchadia.citizen-console.v139';
  const prior = {
    schema: 'civweave.anarchadia-console.v1',
    passportId: 'AC-ABCDEF12',
    proposals: [{ id: 'keep-me' }],
    ledger: [{ id: 'evt-existing', time: '2026-08-16T00:00:00.000Z', kind: 'existing', detail: 'Existing Passport state.' }],
    settings: { autoRun: false },
  };
  const { api } = await runPassport({ [key]: JSON.stringify(prior) });
  const record = api.snapshot();
  assert.equal(record.passportId, prior.passportId);
  assert.equal(record.proposals[0].id, 'keep-me');
  assert.equal(record.settings.autoRun, false);
});

test('Guild join owners remain shared membership/authentication code, not Lud AI code', async () => {
  const [session, lobby, localCapacity] = await Promise.all([
    read('public/app/host-node-session-v1.js'),
    read('public/app/host-node-installer-lobby-v1.js'),
    read('public/app/host-node-local-capacity-v1.js'),
  ]);
  assert.match(session, /globalThis\.CivweaveHostNodeSessionV1/);
  assert.match(lobby, /globalThis\.CivweaveHostNodeInstallerLobbyV1/);
  assert.match(localCapacity, /globalThis\.CivweaveHostNodeLocalCapacityV1/);
  for (const source of [session, lobby, localCapacity]) {
    assert.doesNotMatch(source, /CivweaveModelRuntime|CivweaveReflexRuntime|\.generate\s*\(/);
  }
});

test('Lud worker permits only explicit live Guild and human-validation routes beyond packaged assets', async () => {
  const worker = await read('public/service-worker-lud-package-v1.js');
  const allowed = [
    '/api/federation/health',
    '/.well-known/civweave',
    '/api/host-node-status',
    '/api/host-node-search',
    '/api/ai/node/session',
    '/api/commerce/membership/prejoin',
    '/api/federation/capacity',
    '/api/federation/residents/admit',
    '/api/node/human-validation/request',
    '/api/node/human-validation/claim',
    '/api/node/human-validation/status',
  ];
  assert.match(worker, /const LUD_NETWORK_PATHS=new Set\(/);
  for (const path of allowed) assert.ok(worker.includes(`'${path}'`), `${path} must be explicitly network-allowlisted`);
  assert.match(worker, /if\(LUD_NETWORK_PATHS\.has\(pathname\)\)return networkOnly\(request,pathname\)/);
  assert.match(worker, /Lud Mode blocked a non-allowlisted request/);
  assert.doesNotMatch(worker, /\/api\/ai\/node\/generate/);
});
