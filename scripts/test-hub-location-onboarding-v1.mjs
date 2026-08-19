import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

import {
  CivweaveCloudNode,
  normalizeGuildRallyPoint,
  normalizeHubLocation,
} from '../cloudflare/node-cloud/src/index.mjs';

const now = Date.parse('2026-08-12T18:00:00.000Z');
const reading = {
  latitude: 43.9754321,
  longitude: -75.9109876,
  accuracyMeters: 37,
  capturedAt: '2026-08-12T17:59:30.000Z',
};
const normalized = normalizeHubLocation(reading, now);
assert.deepEqual(normalized, {
  schema: 'civweave.hub-location.v1',
  latitude: 43.975,
  longitude: -75.911,
  precisionMeters: 100,
  coordinateDecimals: 3,
  source: 'guildkeeper-browser-geolocation',
  capturedAt: '2026-08-12T17:59:30.000Z',
  syncedAt: '2026-08-12T18:00:00.000Z',
});
const precise = normalizeHubLocation({ ...reading, publicPrecision: 'precise' }, now);
assert.deepEqual(precise, {
  schema: 'civweave.hub-location.v1',
  latitude: 43.975432,
  longitude: -75.910988,
  precisionMeters: 37,
  coordinateDecimals: 6,
  source: 'guildkeeper-browser-geolocation',
  capturedAt: '2026-08-12T17:59:30.000Z',
  syncedAt: '2026-08-12T18:00:00.000Z',
});
assert.throws(() => normalizeHubLocation({ ...reading, latitude: 91 }, now), /latitude/i);
assert.throws(() => normalizeHubLocation({ ...reading, accuracyMeters: 6000 }, now), /accuracy/i);
assert.throws(() => normalizeHubLocation({ ...reading, publicPrecision: 'precise', accuracyMeters: 300 }, now), /precise public Guild pin/i);
assert.throws(() => normalizeHubLocation({ ...reading, publicPrecision: 'secret' }, now), /public precision/i);
assert.throws(() => normalizeHubLocation({ ...reading, capturedAt: '2026-08-12T17:00:00.000Z' }, now), /stale/i);

const rallyReading = {
  name: 'Riverside Park pavilion',
  directions: 'Main pavilion beside the east parking lot',
  latitude: 43.9761234,
  longitude: -75.9123456,
  accuracyMeters: 24,
  publicPlaceConfirmed: true,
  capturedAt: '2026-08-12T17:59:40.000Z',
};
const rally = normalizeGuildRallyPoint(rallyReading, now);
assert.deepEqual(rally, {
  schema: 'civweave.guild-rally-point.v1',
  name: 'Riverside Park pavilion',
  directions: 'Main pavilion beside the east parking lot',
  latitude: 43.976123,
  longitude: -75.912346,
  precisionMeters: 24,
  publicPlaceConfirmed: true,
  source: 'guildkeeper-browser-geolocation',
  capturedAt: '2026-08-12T17:59:40.000Z',
  updatedAt: '2026-08-12T18:00:00.000Z',
});
assert.throws(() => normalizeGuildRallyPoint({ ...rallyReading, name: '' }, now), /name/i);
assert.throws(() => normalizeGuildRallyPoint({ ...rallyReading, publicPlaceConfirmed: false }, now), /public|community/i);
assert.throws(() => normalizeGuildRallyPoint({ ...rallyReading, accuracyMeters: 300 }, now), /250 meters/i);
assert.throws(() => normalizeGuildRallyPoint({ ...rallyReading, capturedAt: '2026-08-12T17:00:00.000Z' }, now), /stale/i);

class MemoryStorage {
  values = new Map();
  async get(key) { return this.values.get(key); }
  async put(key, value) {
    if (typeof key === 'object') for (const [entryKey, entryValue] of Object.entries(key)) this.values.set(entryKey, entryValue);
    else this.values.set(key, value);
  }
}

const storage = new MemoryStorage();
const node = new CivweaveCloudNode({ storage }, { NODE_DOMAIN: 'nodes.commonweave.earth' });
const first = await node.updateHubLocation('garden-a', { ...reading, capturedAt: new Date().toISOString() }, 'a'.repeat(43));
assert.equal(first.claimed, true);
assert.equal(first.manifest.location.schema, 'civweave.hub-location.v1');
assert.equal((await storage.get('hub-location')).ownerKeyHash.length, 64);
assert.ok(!JSON.stringify(await storage.get('hub-location')).includes('a'.repeat(43)), 'raw Guildkeeper claim key must never be stored');
const rallyUpdate = await node.updateGuildRallyPoint('garden-a', { ...rallyReading, capturedAt: new Date().toISOString() }, 'a'.repeat(43));
assert.equal(rallyUpdate.manifest.location.rallyPoint.schema, 'civweave.guild-rally-point.v1');
assert.equal(rallyUpdate.manifest.location.rallyPoint.name, 'Riverside Park pavilion');
const repeated = await node.updateHubLocation('garden-a', { ...reading, publicPrecision: 'precise', capturedAt: new Date().toISOString() }, 'a'.repeat(43));
assert.equal(repeated.claimed, false);
assert.equal(repeated.manifest.location.coordinateDecimals, 6);
assert.equal(repeated.manifest.location.precisionMeters, 37);
assert.equal(repeated.manifest.location.rallyPoint.name, 'Riverside Park pavilion', 'Guild location updates must preserve the Rally Point');
await assert.rejects(() => node.updateHubLocation('garden-a', { ...reading, capturedAt: new Date().toISOString() }, 'b'.repeat(43)), error => error?.status === 409);
await assert.rejects(() => node.updateGuildRallyPoint('garden-a', { ...rallyReading, capturedAt: new Date().toISOString() }, 'b'.repeat(43)), error => error?.status === 409);

const setup = await readFile(new URL('../public/host-setup.html', import.meta.url), 'utf8');
const browserScript = setup.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(browserScript, 'host setup inline script must exist');
new vm.Script(browserScript, { filename: 'public/host-setup.html#inline-script' });
assert.ok(setup.includes('Stand where the Guild lives to finish setup.'));
assert.ok(setup.includes('Every Guild needs a Guild Map location during setup.'));
assert.ok(setup.includes('id="open-civweave"'));
assert.ok(setup.includes('aria-disabled="true"'));
assert.ok(setup.includes('Place this Guild on the Guild Map before entering Civweave'));
assert.ok(setup.includes('navigator.geolocation.watchPosition'));
assert.ok(setup.includes('publish-precise-location'));
assert.ok(setup.includes("publicPrecision:precise?'precise':'rounded'"));
assert.ok(setup.includes('position.coords.latitude.toFixed(coordinateDecimals)'));
assert.ok(setup.includes("'x-civweave-location-key':claimKey"));
assert.ok(setup.includes('workerOrigin:locationTarget.workerOrigin'));
assert.ok(setup.includes('nodeIds:Array.isArray(result.nodeIds)'));
assert.ok(setup.includes('Rounded placement is the default'));
assert.ok(setup.includes('six decimal places'));
assert.ok(setup.includes('CONNECT GUILDKEEPER PAYOUTS'));
assert.ok(setup.includes('http://127.0.0.1:8787/app/node-ai-operator-v1.html#liveCommerce'));
assert.ok(setup.includes('Transfers must be active'));
assert.ok(setup.includes('bank, identity, and tax details are entered in Stripe-hosted onboarding'));
assert.ok(setup.includes('/app/guild-rally-point-setup-v1.js'));

const rallySetup = await readFile(new URL('../public/app/guild-rally-point-setup-v1.js', import.meta.url), 'utf8');
new vm.Script(rallySetup, { filename: 'public/app/guild-rally-point-setup-v1.js' });
assert.ok(rallySetup.includes('SET THE GUILD RALLY POINT'));
assert.ok(rallySetup.includes('Choose where people regroup offline.'));
assert.ok(rallySetup.includes('public or community-accessible'));
assert.ok(rallySetup.includes("RALLY_STATE_KEY='civweave.guild-rally-point.v1'"));
assert.ok(rallySetup.includes('navigator.geolocation.watchPosition'));
assert.ok(rallySetup.includes('/api/fabric/rally-point'));
assert.ok(rallySetup.includes('publicPlaceConfirmed:true'));
assert.ok(rallySetup.includes('position.coords.latitude.toFixed(6)'));
assert.ok(rallySetup.includes("'x-civweave-location-key':key"));

console.log(JSON.stringify({
  ok: true,
  schema: 'civweave.guild-location-onboarding.v2',
  defaultPublicCoordinateDecimals: 3,
  defaultMinimumPublicPrecisionMeters: 100,
  precisePublicOptIn: true,
  precisePublicCoordinateDecimals: 6,
  precisePublicAccuracyMeters: precise.precisionMeters,
  exactReadingLeavesDeviceByDefault: false,
  desktopLocationRequired: true,
  guildMapUpdateCredentialRetained: true,
  guildkeeperUpdateKeyStoredAsHash: true,
  guildRallyPointSchema: rally.schema,
  guildRallyPointPublicPlaceRequired: true,
  guildRallyPointOfflineCache: true,
}, null, 2));