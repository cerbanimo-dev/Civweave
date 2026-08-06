import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

for (const file of ['public/service-worker-core-v208.js', 'public/service-worker-v203.js']) {
  const source = await fs.readFile(file, 'utf8');
  assert(source.includes('const COMPAT_ENTRY_PATHS = new Set(['), file + ' lacks compatibility launcher paths');
  assert(source.includes("'/app/fullscreen-family-v104.html'"), file + ' does not protect the installed fullscreen URL');
  assert(source.includes("'/app/fullscreen-family-v104'"), file + ' does not protect the extensionless fullscreen URL');
  assert(source.includes('COMPAT_ENTRY_PATHS.has(url.pathname)'), file + ' does not route compatibility launches through stableAppEntry');
  assert(source.includes("headers.set('x-commonweave-stable-entry', 'v219')"), file + ' lacks the v219 response marker');
  assert(!source.includes('LEGACY_ENTRY_PATHS.has(url.pathname)'), file + ' still uses the incomplete legacy-only set');
}

const index = await fs.readFile('public/index.html', 'utf8');
const installer = await fs.readFile('public/install-v130.js', 'utf8');
assert(index.includes('revision=compat-fullscreen-launch-v219'), 'homepage does not force the v219 worker');
assert(installer.includes("const WORKER_SCRIPT_REVISION = 'compat-fullscreen-launch-v219'"), 'installer does not require the v219 worker');
console.log('Fullscreen launch compatibility v219 verified.');
