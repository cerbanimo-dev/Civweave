import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { CivweaveCapacityAccount } from '../cloudflare/node-cloud/src/capacity.mjs';
import nodeWorker from '../cloudflare/node-cloud/src/entry.mjs';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [access, lobby, router, topbar, guideChat, assistant, nodeEntry, serverEntry, coreEntry, locationMigration, searchFunction, statusFunction, boundary, ownership, offline] = await Promise.all([
  'public/app/host-node-session-v1.js',
  'public/app/host-node-installer-lobby-v1.js',
  'public/app/server-ai-router-v301.js',
  'public/app/working-campus-topbar-v243.js',
  'public/app/guide-chat-surface-v350.js',
  'public/app/assistant-runtime-v141.js',
  'cloudflare/node-cloud/src/entry.mjs',
  'cloudflare/node-cloud/src/server-ai-entry-v1.mjs',
  'cloudflare/core/src/index.mjs',
  'cloudflare/core/migrations/0006_node_location.sql',
  'functions/api/host-node-search.ts',
  'functions/api/host-node-status.ts',
  'public/app/install-boundary-v146.js',
  'config/system-ownership.json',
  'public/app/offline-package-v208.json',
].map(read));

for (const source of [access, lobby, router, topbar, guideChat, assistant]) new Function(source);
const registry = JSON.parse(ownership), offlinePackage = JSON.parse(offline);

class WebStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.get(key) ?? null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
}
const localStorage = new WebStorage(), sessionStorage = new WebStorage(), browserEvents = [], browserRequests = [];
const browser = {
  URL, Date, Math, JSON, Object, Number, String, Boolean, Array, Promise, Error, TypeError, RangeError,
  localStorage, sessionStorage, crypto: webcrypto, structuredClone,
  btoa: value => Buffer.from(value, 'binary').toString('base64'),
  atob: value => Buffer.from(value, 'base64').toString('binary'),
  CustomEvent: class { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
  dispatchEvent: event => { browserEvents.push(event); return true; },
  fetch: async (url, init = {}) => {
    browserRequests.push({ url: String(url), init });
    const input = JSON.parse(init.body || '{}');
    return Response.json({
      ok: true,
      schema: 'civweave.host-node-login.v1',
      nodeId: 'seed-nearby',
      member: { nodeId: 'seed-nearby', userId: input.userId, seatClass: 'community' },
      quota: { includedRemainingNeurons: 480 },
      capacitySession: { nodeId: 'seed-nearby', userId: input.userId, seatClass: 'community', origin: 'https://civweave-node-cloud.cerbanimo.workers.dev', token: 'signed.capacity.token', expiresAt: '2099-01-01T00:00:00.000Z' },
    });
  },
};
browser.globalThis = browser;
vm.createContext(browser);
vm.runInContext(access, browser, { filename: 'host-node-session-v1.js' });
const browserLogin = await browser.CivweaveHostNodeSessionV1.join('https://civweave-node-cloud.cerbanimo.workers.dev', { nodeId: 'seed-nearby' });
assert.equal(browserLogin.session.nodeId, 'seed-nearby');
assert.equal(browserRequests.length, 1);
assert.match(browserRequests[0].url, /\/api\/ai\/node\/session\?nodeId=seed-nearby$/);
assert.ok(JSON.parse(localStorage.getItem('civweave.host-node.credentials.v1'))['https://civweave-node-cloud.cerbanimo.workers.dev#seed-nearby'].credential.length >= 40);
assert.equal(JSON.parse(sessionStorage.getItem('civweave.host-capacity.sessions.v1'))['seed-nearby'].token, 'signed.capacity.token');
assert.ok(!JSON.stringify(browserEvents).includes('credential'), 'Guild events must never publish the reusable device credential');

class MemoryStorage {
  constructor() { this.map = new Map(); }
  async get(key) { return this.map.get(key); }
  async put(key, value) {
    if (typeof key === 'object' && key) for (const [entry, item] of Object.entries(key)) this.map.set(entry, item);
    else this.map.set(key, value);
  }
  async delete(key) { this.map.delete(key); }
  async list({ prefix = '' } = {}) { return new Map([...this.map].filter(([key]) => key.startsWith(prefix))); }
}

const account = new CivweaveCapacityAccount({ storage: new MemoryStorage() }, { CIVWEAVE_WORKERS_PLAN: 'free' });
await account.registerNode('seed-nearby');
const first = await account.admitMember({ nodeId: 'seed-nearby', userId: 'cwres:test-device-001', seatClass: 'community', billingStatus: 'free', loginCredentialHash: 'a'.repeat(64) });
assert.equal(first.member.loginCredentialHash, undefined, 'credential hash must never leave the capacity authority');
await assert.rejects(
  account.admitMember({ nodeId: 'seed-nearby', userId: 'cwres:test-device-001', seatClass: 'community', billingStatus: 'free', loginCredentialHash: 'b'.repeat(64) }),
  error => error?.status === 401,
  'a different device credential must not mint a member session',
);
const reservation = await account.reserveUsage({ nodeId: 'seed-nearby', userId: 'cwres:test-device-001', requestedNeurons: 10 });
await account.settleUsage({ reservationId: reservation.reservation.reservationId, actualNeurons: 4 });
const status = await account.memberStatus({ nodeId: 'seed-nearby', userId: 'cwres:test-device-001' });
assert.equal(status.quota.usedNeuronsToday, 4);
assert.equal(status.quota.includedRemainingNeurons, status.quota.includedDailyNeurons - 4);

const loginAccount = new CivweaveCapacityAccount({ storage: new MemoryStorage() }, { CIVWEAVE_WORKERS_PLAN: 'free' });
await loginAccount.registerNode('seed-session');
const capacityBinding = {
  idFromName: value => value,
  get: () => ({ fetch: (url, init) => loginAccount.fetch(new Request(url, init)) }),
};
const workerEnv = { CAPACITY: capacityBinding, NODE_DOMAIN: 'nodes.commonweave.earth', NODE_FABRIC_SESSION_SECRET: 'test-only-session-secret-0000000000000' };
const loginResponse = await nodeWorker.fetch(new Request('https://seed-session.nodes.commonweave.earth/api/ai/node/session', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: 'cwres:worker-device-001', credential: 'c'.repeat(43) }),
}), workerEnv, {});
const loginPacket = await loginResponse.json();
assert.equal(loginResponse.status, 201);
assert.equal(loginResponse.headers.get('access-control-allow-origin'), '*');
assert.ok(loginPacket.capacitySession?.token);
const sessionResponse = await nodeWorker.fetch(new Request('https://seed-session.nodes.commonweave.earth/api/ai/node/session', {
  headers: { authorization: `Bearer ${loginPacket.capacitySession.token}` },
}), workerEnv, {});
const sessionPacket = await sessionResponse.json();
assert.equal(sessionResponse.status, 200);
assert.equal(sessionPacket.member.userId, 'cwres:worker-device-001');
assert.equal(sessionPacket.quota.includedRemainingNeurons, sessionPacket.quota.includedDailyNeurons);
const rejectedResponse = await nodeWorker.fetch(new Request('https://seed-session.nodes.commonweave.earth/api/ai/node/session', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: 'cwres:worker-device-001', credential: 'd'.repeat(43) }),
}), workerEnv, {});
assert.equal(rejectedResponse.status, 401);
const workerOriginResponse = await nodeWorker.fetch(new Request('https://civweave-node-cloud.cerbanimo.workers.dev/api/ai/node/session?nodeId=seed-session', {
  method: 'POST', headers: { 'content-type': 'application/json', 'x-civweave-node-id': 'seed-session' }, body: JSON.stringify({ userId: 'cwres:worker-device-002', credential: 'e'.repeat(43) }),
}), workerEnv, {});
const workerOriginPacket = await workerOriginResponse.json();
assert.equal(workerOriginResponse.status, 201);
assert.equal(workerOriginPacket.capacitySession.origin, 'https://civweave-node-cloud.cerbanimo.workers.dev');

assert.match(nodeEntry, /\/api\/ai\/node\/session/);
assert.match(nodeEntry, /loginCredentialHash/);
assert.match(nodeEntry, /\/members\/status/);
assert.match(serverEntry, /quota: memberStatus\.quota/);
assert.match(serverEntry, /access-control-allow-origin/);
assert.match(router, /recordUsage/);
assert.match(router, /approximateTurnsLeft/);
assert.match(lobby, /Nearest Guilds with open slots/);
for (const mode of ['free', 'paid', 'both']) assert.ok(lobby.includes(`<option value="${mode}">`) || searchFunction.includes(`"${mode}"`));
assert.match(lobby, /Citizen only/);
assert.match(lobby, /Patron only/);
assert.match(lobby, /Use my approximate location/);
assert.match(searchFunction, /MAX_CAPACITY_PROBES = 24/);
assert.match(searchFunction, /toFixed\(3\)/);
assert.match(searchFunction, /exactLocationStored: false/);
assert.match(searchFunction, /environment: "production"/);
assert.match(searchFunction, /stagingSynthetic: false/);
assert.doesNotMatch(searchFunction, /STAGING_GUILDS|stagingSearch|_shared\/staging-runtime/);
assert.match(coreEntry, /location_json AS locationJson/);
assert.match(coreEntry, /latitude: Number\(latitude\.toFixed\(3\)\)/);
assert.match(coreEntry, /canonicalInstallOrigin: 'https:\/\/civweave\.pages\.dev'/);
assert.match(locationMigration, /ALTER TABLE nodes ADD COLUMN location_json TEXT/);
assert.match(statusFunction, /\/api\/node\/health/);
assert.match(topbar, /NODE_STATUS_ID='cw-working-campus-node-v243'/);
assert.match(topbar, /neurons left today/);
assert.match(guideChat, /const ROOT_ID='cw-persistent-guide-chat-v215'/);
assert.match(guideChat, /canonicalOwner:true/);
assert.match(assistant, /usage:result\.usage\|\|null/);
assert.match(boundary, /HOST_NODE_SESSION/);
assert.equal(registry.systems['host-node-access'].owner, 'public/app/host-node-session-v1.js');
assert.ok(offlinePackage.assets.includes('/app/host-node-session-v1.js'));

console.log(JSON.stringify({
  ok: true,
  schema: 'civweave.hub-node-access-verification.v1',
  credentialBoundLogin: true,
  capacitySessionRequired: true,
  nearestSearchModes: ['free', 'paid', 'both'],
  productionGuildDiscovery: 'live-registry-no-staging-fixtures',
  topbarHealth: true,
  canonicalGuideChat: true,
}, null, 2));
