import assert from 'node:assert/strict';
import { test } from 'node:test';
import stagingWorker from '../cloudflare/node-cloud/src/staging-entry-v1.mjs';

const origin = 'https://civweave-node-cloud-staging.cerbanimo.workers.dev';
const browserOrigin = 'https://civweave-staging.pages.dev';
const env = Object.freeze({ NODE_DOMAIN: 'nodes.civweave.invalid', CIVWEAVE_ENVIRONMENT: 'staging' });
const publicPaths = [
  '/api/civweave-trust/bundle',
  '/api/civweave-release/current',
  '/api/civweave-release/asset?releaseId=missing&path=/app/index.html',
];

async function request(path, method = 'GET', headers = {}) {
  return stagingWorker.fetch(new Request(new URL(path, origin), {
    method,
    headers: { origin: browserOrigin, ...headers },
  }), env, {});
}

function assertPublicResponse(response, status) {
  assert.equal(response.status, status);
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
  assert.equal(response.headers.get('cache-control'), 'no-store');
}

test('staging Guild discovery returns an empty trust bundle without granting release authority', async () => {
  const response = await request(publicPaths[0]);
  assertPublicResponse(response, 200);
  assert.deepEqual(await response.json(), {
    schema: 'civweave.release-trust-bundle.v1',
    delegations: [],
    revocations: [],
  });
});

test('staging Guild without a signed release returns CORS-readable 404s instead of fabric JSON', async () => {
  for (const path of [...publicPaths.slice(1), '/api/civweave-release/unknown', '/api/civweave-trust/unknown']) {
    const response = await request(path);
    assertPublicResponse(response, 404);
    const payload = await response.json();
    assert.equal(payload.ok, false);
    assert.equal(typeof payload.error, 'string');
    assert.equal(payload.manifest, undefined);
  }
});

test('public discovery HEAD responses preserve GET status and CORS with no response body', async () => {
  for (const path of publicPaths) {
    const response = await request(path, 'HEAD');
    assertPublicResponse(response, path === publicPaths[0] ? 200 : 404);
    assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
    assert.equal(await response.text(), '');
  }
});

test('public discovery preflight advertises only read methods and stays readable for absent paths', async () => {
  for (const path of [...publicPaths, '/api/civweave-release/import', '/api/civweave-trust/import']) {
    const response = await request(path, 'OPTIONS', {
      'access-control-request-method': 'GET',
      'access-control-request-headers': 'content-type, x-civweave-node-id',
    });
    assertPublicResponse(response, 204);
    assert.deepEqual(response.headers.get('access-control-allow-methods').split(/\s*,\s*/), ['GET', 'HEAD', 'OPTIONS']);
    const allowedHeaders = response.headers.get('access-control-allow-headers').split(/\s*,\s*/);
    assert.ok(allowedHeaders.includes('content-type'));
    assert.ok(allowedHeaders.includes('x-civweave-node-id'));
    assert.equal(await response.text(), '');
  }
});

test('node-cloud discovery never enables writable signed release or trust relay endpoints', async () => {
  for (const path of [...publicPaths, '/api/civweave-release/import', '/api/civweave-release/relay', '/api/civweave-trust/import']) {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const response = await request(path, method);
      assertPublicResponse(response, 405);
      assert.equal(response.headers.get('allow'), 'GET, HEAD, OPTIONS');
      assert.equal((await response.json()).ok, false);
    }
  }
});

test('release discovery does not broaden CORS for fabric administration or unrelated paths', async () => {
  for (const path of ['/api/fabric/health', '/api/civweave-trustworthy/bundle', '/api/civweave-release-private/current']) {
    const response = await request(path);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    assert.equal((await response.json()).schema, 'civweave.node-cloud-fabric.v1');
  }
  const response = await request('/api/fabric/nodes/test-guild', 'POST');
  assert.equal(response.status, 403);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});
