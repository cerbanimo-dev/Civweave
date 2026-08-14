import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

import {
  CivweaveCloudNode,
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
  source: 'steward-browser-geolocation',
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
  source: 'steward-browser-geolocation',
  capturedAt: '2026-08-12T17:59:30.000Z',
  syncedAt: '2026-08-12T18:00:00.000Z',
});
assert.throws(() => normalizeHubLocation({ ...reading, latitude: 91 }, now), /latitude/i);
assert.throws(() => normalizeHubLocation({ ...reading, accuracyMeters: 6000 }, now), /accuracy/i);
assert.throws(() => normalizeHubLocation({ ...reading, publicPrecision: 'precise', accuracyMeters: 300 }, now), /precise public Hub pin/i);
assert.throws(() => normalizeHubLocation({ ...reading, publicPrecision: 'secret' }, now), /public precision/i);
assert.throws(() => normalizeHubLocation({ ...reading, capturedAt: '2026-08-12T17:00:00.000Z' }, now), /stale/i);

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
assert.ok(!JSON.stringify(await storage.get('hub-location')).includes('a'.repeat(43)), 'raw steward claim key must never be stored');
const repeated = await node.updateHubLocation('garden-a', { ...reading, publicPrecision: 'precise', capturedAt: new Date().toISOString() }, 'a'.repeat(43));
assert.equal(repeated.claimed, false);
assert.equal(repeated.manifest.location.coordinateDecimals, 6);
assert.equal(repeated.manifest.location.precisionMeters, 37);
await assert.rejects(() => node.updateHubLocation('garden-a', { ...reading, capturedAt: new Date().toISOString() }, 'b'.repeat(43)), error => error?.status === 409);

const setup = await readFile(new URL('../public/host-setup.html', import.meta.url), 'utf8');
const browserScript = setup.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(browserScript, 'host setup inline script must exist');
new vm.Script(browserScript, { filename: 'public/host-setup.html#inline-script' });
assert.ok(setup.includes('Stand where the hub lives.'));
assert.ok(setup.includes('navigator.geolocation.watchPosition'));
assert.ok(setup.includes('publish-precise-location'));
assert.ok(setup.includes("publicPrecision:precise?'precise':'rounded'"));
assert.ok(setup.includes('position.coords.latitude.toFixed(coordinateDecimals)'));
assert.ok(setup.includes("'x-civweave-location-key':claimKey"));
assert.ok(setup.includes('Rounded placement is the default'));
assert.ok(setup.includes('six decimal places'));
assert.ok(setup.includes('CONNECT STEWARD PAYOUTS'));
assert.ok(setup.includes('http://127.0.0.1:8787/app/node-ai-operator-v1.html#liveCommerce'));
assert.ok(setup.includes('Transfers must be active'));
assert.ok(setup.includes('bank, identity, and tax details are entered in Stripe-hosted onboarding'));

console.log(JSON.stringify({
  ok: true,
  schema: 'civweave.hub-location-onboarding.v1',
  defaultPublicCoordinateDecimals: 3,
  defaultMinimumPublicPrecisionMeters: 100,
  precisePublicOptIn: true,
  precisePublicCoordinateDecimals: 6,
  precisePublicAccuracyMeters: precise.precisionMeters,
  exactReadingLeavesDeviceByDefault: false,
  stewardUpdateKeyStoredAsHash: true,
}, null, 2));
