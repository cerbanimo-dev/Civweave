import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { randomUUID, webcrypto } from 'node:crypto';
import { TextEncoder, TextDecoder } from 'node:util';

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

async function runPassport(seed = {}, { crypto = { randomUUID }, withCrypto = false } = {}) {
  const source = await read('public/app/shared/civweave-passport-identity-v1.js');
  const localStorage = makeStorage(seed);
  const events = [];
  class CustomEventMock { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } }
  const context = {
    localStorage,
    crypto,
    structuredClone,
    CustomEvent: CustomEventMock,
    dispatchEvent(event) { events.push(event); return true; },
    Date,
    Math,
  };
  if (withCrypto) {
    Object.assign(context, {
      TextEncoder,
      TextDecoder,
      Uint8Array,
      btoa(value) { return Buffer.from(value, 'binary').toString('base64'); },
      atob(value) { return Buffer.from(value, 'base64').toString('binary'); },
    });
  }
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename: 'civweave-passport-identity-v1.js' });
  return { api: context.CivweavePassportIdentityV1, localStorage, events };
}

test('Lud package includes canonical Guild membership, Passport identity, and chat transport', async () => {
  const manifest = JSON.parse(await read('public/app/lud-package-v1.json'));
  assert.equal(manifest.policy.guildMembership, true);
  assert.equal(manifest.policy.passportIdentity, true);
  assert.equal(manifest.policy.guildPartyChat, true);
  assert.equal(manifest.policy.passportPublicAliases, true);
  for (const asset of [
    '/app/shared/civweave-passport-identity-v1.js',
    '/app/lud-guild-party-chat-v1.js',
    '/app/local-object-mesh-v146.js',
    '/app/host-node-session-v1.js',
    '/app/host-node-installer-lobby-v1.js',
    '/app/host-node-local-capacity-v1.js',
    '/app/host-node-paid-join-v1.js',
    '/app/host-node-status-selection-v1.js',
  ]) assert.ok(manifest.assets.includes(asset), `${asset} must be in the Lud allowlist`);
});

test('Lud campus exposes Passport, Guild owner, public alias controls, and Guild Party chat without enabling AI', async () => {
  const campus = await read('public/app/lud/campus.html');
  assert.match(campus, /shared\/civweave-passport-identity-v1\.js/);
  assert.match(campus, /host-node-session-v1\.js/);
  assert.match(campus, /host-node-installer-lobby-v1\.js/);
  assert.match(campus, /lud-guild-party-chat-v1\.js/);
  for (const id of ['lud-passport-id','lud-public-name','lud-cycle-passport-key','lud-chat-channel','lud-chat-messages','lud-chat-form','lud-chat-create-invite','lud-chat-accept-form']) assert.match(campus, new RegExp(`id="${id}"`));
  assert.match(campus, /Joining a Guild automatically joins its Guild Hall chat\./);
  assert.match(campus, /Joining a Party automatically joins that Party chat\./);
  assert.match(campus, /mesh to a Guild member for relay/i);
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

test('Passport chat key creates a repeatable public name and cycles through predecessor-signed history', async () => {
  const { api, localStorage, events } = await runPassport({}, { crypto: webcrypto, withCrypto: true });
  const stablePassportId = api.passportId();
  const first = await api.chatPublicIdentity();
  assert.equal(first.passportId, stablePassportId);
  assert.match(first.keyId, /^pk:/);
  assert.equal(first.publicName, await api.publicNameForKey(first.publicKey));

  const second = await api.rotateChatKey();
  assert.equal(second.passportId, stablePassportId);
  assert.notEqual(second.keyId, first.keyId);
  assert.notEqual(second.publicName, first.publicName);
  assert.equal(second.publicName, await api.publicNameForKey(second.publicKey));

  const history = await api.chatHistory();
  assert.equal(history.length, 2);
  assert.equal(history[0].generation, 1);
  assert.equal(history[1].generation, 2);
  assert.equal(history[1].previousKeyId, history[0].keyId);
  assert.equal(history[1].previousEntryHash, history[0].entryHash);
  assert.ok(history[1].transitionSignature);
  assert.equal(Object.hasOwn(history[0], 'privateKey'), false);
  assert.equal(Object.hasOwn(history[1], 'privateKey'), false);
  const verification = JSON.parse(JSON.stringify(await api.verifyChatHistory()));
  assert.deepEqual(verification, {
    ok: true,
    count: 2,
    generation: 2,
    head: history[1].entryHash,
    keyId: history[1].keyId,
  });

  const stored = JSON.parse(localStorage.getItem(api.storageKey));
  assert.ok(stored.chatIdentity.current.privateKey);
  assert.ok(stored.chatIdentity.history.every(entry => !Object.hasOwn(entry, 'privateKey')));
  assert.ok(events.some(event => event.type === 'civweave:passport-chat-key-rotated'));
});

test('Lud chat automatically binds Guild and Party membership and keeps one signed envelope across mesh and Guild relay', async () => {
  const chat = await read('public/app/lud-guild-party-chat-v1.js');
  for (const token of [
    'civweave.lud-chat.envelope.v1',
    'civweave.lud-chat.invite.v1',
    'ensureGuildChannel',
    'ensurePartyChannels',
    'id:`guild:${session.nodeId}`',
    'id:`party:${party.groupId}`',
    "'civweave:host-node-logged-in'",
    "'civweave:capacity-session-ready'",
    "'civweave:party-thread-changed'",
    "'civweave:tavern-joined'",
    "consent:'direct'",
    "new URL('/api/envelopes',session.origin)",
    "kind:'civweave-lud-chat-v1'",
    "via:'mesh-guild-member'",
    'civweave.lud-chat.guild-outbox.v1',
    'flushGuildOutbox',
    'civweave-lud-chat-groups-v1',
    'dynamicPeerGroups',
    'createInvite',
    'acceptInvite',
    'verifyMessage',
  ]) assert.ok(chat.includes(token), `Lud chat runtime missing ${token}`);
  assert.match(chat, /room\?\.access!==['"]member['"]\)return false/);
  assert.match(chat, /author:\{generation:owner\.generation,keyId:owner\.keyId,publicName:owner\.publicName,publicKey:owner\.publicKey\}/);
  assert.doesNotMatch(chat, /['"]x-civweave-node-id['"]/i);
  new Function(chat);
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

test('Lud worker explicitly permits Guild envelope distribution while keeping the rest fail-closed', async () => {
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
    '/api/envelopes',
  ];
  assert.match(worker, /const LUD_NETWORK_PATHS=new Set\(/);
  for (const path of allowed) assert.ok(worker.includes(`'${path}'`), `${path} must be explicitly network-allowlisted`);
  assert.match(worker, /if\(LUD_NETWORK_PATHS\.has\(pathname\)\)return networkOnly\(request,pathname\)/);
  assert.match(worker, /Lud Mode blocked a non-allowlisted request/);
  assert.doesNotMatch(worker, /\/api\/ai\/node\/generate/);
});