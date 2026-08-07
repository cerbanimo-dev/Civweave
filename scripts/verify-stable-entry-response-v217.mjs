import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

for (const file of ['public/service-worker-core-v208.js', 'public/service-worker-v203.js']) {
  const source = await fs.readFile(file, 'utf8');
  assert(source.includes('async function normalizeStableAppEntryResponse(response)'), file + ' lacks the stable-entry response normalizer');
  assert(source.includes("headers.delete('location')"), file + ' retains redirect headers');
  assert(source.includes("headers.set('x-civweave-stable-entry', 'v217')"), file + ' lacks the v217 marker');
  assert(source.includes("const fetched = await fetchFresh('/app/', 'stable-app-entry')"), file + ' still fetches canonicalized index.html');
  assert(source.includes('const normalized = await normalizeStableAppEntryResponse(response);'), file + ' replays the cached response directly');
  assert(!source.includes("response = await fetchFresh('/app/index.html', 'stable-app-entry')"), file + ' still fetches the redirecting index.html URL');
}

const index = await fs.readFile('public/index.html', 'utf8');
const installer = await fs.readFile('public/install-v130.js', 'utf8');
assert(index.includes('revision=stable-entry-v217'), 'homepage does not force the v217 worker');
assert(installer.includes("const WORKER_SCRIPT_REVISION = 'stable-entry-v217'"), 'installer does not require the v217 worker');
console.log('Stable entry response v217 verified.');
