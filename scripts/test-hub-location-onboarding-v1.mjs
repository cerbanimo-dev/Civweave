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
assert.throws(() => normalizeHubLocation({ ...reading, latitude: 91 }, now), /latitude/i);
assert.throws(() => normalizeHubLocation({ ...reading, accuracyMeters: 6000 }, now), /accuracy/i);
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
const repeated = await node.updateHubLocation('garden-a', { ...reading, capturedAt: new Date().toISOString() }, 'a'.repeat(43));
assert.equal(repeated.claimed, false);
await assert.rejects(() => node.updateHubLocation('garden-a', { ...reading, capturedAt: new Date().toISOString() }, 'b'.repeat(43)), error => error?.status === 409);

const setup = await readFile(new URL('../public/host-setup.html', import.meta.url), 'utf8');
const browserScript = setup.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(browserScript, 'host setup inline script must exist');
new vm.Script(browserScript, { filename: 'public/host-setup.html#inline-script' });
assert.ok(setup.includes('Stand where the hub lives.'));
assert.ok(setup.includes('navigator.geolocation.watchPosition'));
assert.ok(setup.includes("position.coords.latitude.toFixed(3)"));
assert.ok(setup.includes("'x-civweave-location-key':claimKey"));
assert.ok(setup.includes('Your exact GPS reading stays on this device.'));

console.log(JSON.stringify({
  ok: true,
  schema: 'civweave.hub-location-onboarding.v1',
  publicCoordinateDecimals: 3,
  minimumPublicPrecisionMeters: 100,
  exactReadingLeavesDevice: false,
  stewardUpdateKeyStoredAsHash: true,
}, null, 2));
