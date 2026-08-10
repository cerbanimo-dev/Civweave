import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { webcrypto, createHash } from 'node:crypto';

function normalized(value) {
  if (Array.isArray(value)) return value.map(normalized);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, normalized(value[key])]));
  }
  return value;
}
function canonical(value) { return JSON.stringify(normalized(value)); }
function hexDeviceId(publicKey) {
  const hash = createHash('sha256').update(canonical(publicKey)).digest('hex');
  return `device:${hash.slice(0, 24)}`;
}

test('browser contribution identity is distinct from transport fingerprint but cross-runtime stable', async () => {
  const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const publicKey = await webcrypto.subtle.exportKey('jwk', pair.publicKey);
  const transportId = 'device:local-mesh-base64url-id';

  const context = {
    console,
    crypto: webcrypto,
    TextEncoder,
    structuredClone,
    btoa,
    atob,
    queueMicrotask,
    setInterval,
    clearInterval,
    CivweaveLocalMeshV146: {
      credential: async () => ({ id: transportId, publicKey, privateKey: pair.privateKey }),
      subscribe: () => () => {},
      listObjects: async () => [],
      getObject: async () => null,
      createObject: async () => ({ ok: true }),
    },
  };
  context.globalThis = context;
  vm.createContext(context);
  const source = await readFile(new URL('../public/app/shared/civweave-contribution-mesh-v1.js', import.meta.url), 'utf8');
  vm.runInContext(source, context, { filename: 'civweave-contribution-mesh-v1.js' });

  const api = context.CivweaveContributionMeshV1;
  assert.ok(api);
  const credential = await api.credentials();
  assert.equal(credential.meshDeviceId, transportId);
  assert.equal(credential.deviceId, hexDeviceId(publicKey));
  assert.notEqual(credential.deviceId, transportId);

  const derived = await api.deviceIdForKey(publicKey);
  assert.equal(derived, hexDeviceId(publicKey));
});
