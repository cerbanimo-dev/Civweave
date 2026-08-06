import fs from 'node:fs/promises';

const workerFiles = [
  'public/service-worker-core-v208.js',
  'public/service-worker-v203.js'
];

const oldBlock = `async function stableAppEntry(request) {
  let response = await findCached('/app/index.html');
  if (!response) {
    try {
      response = await fetchFresh('/app/index.html', 'stable-app-entry');
      await (await caches.open(SHELL_CACHE)).put(cacheKey('/app/index.html'), response.clone());
    } catch {}
  }
  if (!response) {
    return new Response('Commonweave launcher is unavailable.', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
    });
  }
  return request.method === 'HEAD'
    ? new Response(null, { status: response.status, statusText: response.statusText, headers: response.headers })
    : response;
}`;

const newBlock = `async function normalizeStableAppEntryResponse(response) {
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  headers.delete('location');
  if (!headers.get('content-type')) headers.set('content-type', 'text/html; charset=utf-8');
  headers.set('cache-control', 'no-store');
  headers.set('x-commonweave-stable-entry', 'v217');
  const body = await response.clone().arrayBuffer();
  return new Response(body, { status: 200, statusText: 'OK', headers });
}

async function stableAppEntry(request) {
  let response = await findCached('/app/index.html');
  if (!response) {
    try {
      const fetched = await fetchFresh('/app/', 'stable-app-entry');
      response = await normalizeStableAppEntryResponse(fetched);
      await (await caches.open(SHELL_CACHE)).put(cacheKey('/app/index.html'), response.clone());
    } catch {}
  }
  if (!response) {
    return new Response('Commonweave launcher is unavailable.', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
    });
  }
  const normalized = await normalizeStableAppEntryResponse(response);
  return request.method === 'HEAD'
    ? new Response(null, { status: normalized.status, statusText: normalized.statusText, headers: normalized.headers })
    : normalized;
}`;

for (const file of workerFiles) {
  let source = await fs.readFile(file, 'utf8');
  if (source.includes(oldBlock)) {
    source = source.replace(oldBlock, newBlock);
  } else if (!source.includes("headers.set('x-commonweave-stable-entry', 'v217')")) {
    throw new Error(`${file} does not contain the expected stableAppEntry implementation.`);
  }
  await fs.writeFile(file, source);
}

for (const file of ['public/index.html', 'public/install-v130.js', 'scripts/smoke-service-worker-registration-watchdog-v207.mjs']) {
  let source = await fs.readFile(file, 'utf8');
  source = source.replaceAll('stable-entry-v216', 'stable-entry-v217');
  await fs.writeFile(file, source);
}

const verifier = `import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

for (const file of ['public/service-worker-core-v208.js', 'public/service-worker-v203.js']) {
  const source = await fs.readFile(file, 'utf8');
  assert(source.includes('async function normalizeStableAppEntryResponse(response)'), file + ' lacks the stable-entry response normalizer');
  assert(source.includes("headers.delete('location')"), file + ' retains redirect headers');
  assert(source.includes("headers.set('x-commonweave-stable-entry', 'v217')"), file + ' lacks the v217 marker');
  assert(source.includes("const fetched = await fetchFresh('/app/', 'stable-app-entry')"), file + ' still fetches canonicalized index.html');
  assert(source.includes('const normalized = await normalizeStableAppEntryResponse(response);'), file + ' replays the cached response directly');
  assert(!source.includes("response = await fetchFresh('/app/index.html', 'stable-app-entry')"), file + ' still fetches the redirecting index.html URL');
}

const index = await fs.readFile('public/index.html', 'utf8');
const installer = await fs.readFile('public/install-v130.js', 'utf8');
assert(index.includes('revision=stable-entry-v217'), 'homepage does not force the v217 worker');
assert(installer.includes("const WORKER_SCRIPT_REVISION = 'stable-entry-v217'"), 'installer does not require the v217 worker');
console.log('Stable entry response v217 verified.');
`;
await fs.writeFile('scripts/verify-stable-entry-response-v217.mjs', verifier);

const workflow = `name: Verify stable entry response v217

on:
  pull_request:
    paths:
      - public/index.html
      - public/install-v130.js
      - public/service-worker-core-v208.js
      - public/service-worker-v203.js
      - scripts/verify-stable-entry-response-v217.mjs
  push:
    branches: [main]
    paths:
      - public/index.html
      - public/install-v130.js
      - public/service-worker-core-v208.js
      - public/service-worker-v203.js
      - scripts/verify-stable-entry-response-v217.mjs

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: node --check public/install-v130.js
      - run: node --check public/service-worker-core-v208.js
      - run: node --check public/service-worker-v203.js
      - run: node scripts/verify-stable-entry-response-v217.mjs
`;
await fs.writeFile('.github/workflows/verify-stable-entry-response-v217.yml', workflow);

console.log('Applied stable entry response v217.');
