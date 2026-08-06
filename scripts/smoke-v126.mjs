import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 18787;
const origin = `http://127.0.0.1:${PORT}`;
const EXPECTED_BUILD = '1.0.26-loop-diagnostics-hotfix-2';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = await mkdtemp(path.join(os.tmpdir(), 'civweave-v126-'));
const output = [];
const child = spawn(process.execPath, ['server-v126-hotfix.mjs'], {
  cwd: root,
  env: { ...process.env, HOST: '127.0.0.1', PORT: String(PORT), DATA_DIR: dataDir },
  stdio: ['ignore', 'pipe', 'pipe']
});
child.stdout.on('data', chunk => output.push(chunk.toString()));
child.stderr.on('data', chunk => output.push(chunk.toString()));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
async function waitForHealth() {
  let lastError;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${origin}/api/health`, { cache: 'no-store' });
      if (response.ok) return response.json();
      lastError = new Error(`health returned ${response.status}`);
    } catch (error) { lastError = error; }
    await sleep(250);
  }
  throw lastError || new Error('host did not become healthy');
}
try {
  const health = await waitForHealth();
  assert(health.build === EXPECTED_BUILD, `unexpected health build: ${health.build}`);
  assert(health.appVersion === '1.0.26', `unexpected app version: ${health.appVersion}`);
  assert(String(health.release?.appUrl || '').includes('/campus/'), `release appUrl did not migrate: ${health.release?.appUrl}`);

  const campusResponse = await fetch(`${origin}/campus/`, { cache: 'no-store' });
  const campusHtml = await campusResponse.text();
  assert(campusResponse.ok, `campus returned ${campusResponse.status}`);
  assert(campusResponse.headers.get('x-civweave-version') === '1.0.26', 'campus version header missing');
  assert(campusHtml.includes('boot-diagnostics-v126.js'), 'diagnostics script missing from campus HTML');
  assert(campusHtml.includes('host-node-setup-v126.js'), 'v1.0.26 bootstrap missing from campus HTML');
  assert(!campusHtml.includes('location.reload()'), 'automatic reload survived in campus HTML');
  assert(!campusHtml.includes('register("service-worker.js"'), 'legacy worker registration survived in campus HTML');

  const setup = await fetch(`${origin}/campus/host-node-setup-v126.js`, { cache: 'no-store' }).then(response => response.text());
  assert(setup.includes('host-node-v126-safe.js'), 'safe runtime loader is not wired into bootstrap');

  const runtime = await fetch(`${origin}/campus/host-node-v126.js`, { cache: 'no-store' }).then(response => response.text());
  assert(!runtime.includes('location.reload()'), 'a location.reload call survived in served runtime');
  assert(runtime.includes('controllerchange-observed-no-reload'), 'served runtime does not log blocked reload attempts');

  const worker = await fetch(`${origin}/campus/service-worker-v126.js`, { cache: 'no-store' }).then(response => response.text());
  assert(!worker.includes('clients.claim()'), 'service worker still claims the active page');
  assert(worker.includes('activate-without-client-claim'), 'service-worker no-claim activation marker is missing');

  const version = await fetch(`${origin}/campus/version.json`, { cache: 'no-store' }).then(response => response.json());
  assert(version.version === '1.0.26', `unexpected campus version: ${version.version}`);
  assert(version.build === EXPECTED_BUILD, `unexpected campus build: ${version.build}`);

  const migration = await fetch(`${origin}/app/`, { redirect: 'manual', cache: 'no-store' });
  assert(migration.status === 302, `legacy app migration returned ${migration.status}`);
  assert((migration.headers.get('location') || '').startsWith('/campus/'), `legacy app migration target was ${migration.headers.get('location')}`);

  await fetch(`${origin}/api/boot-log`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'smoke-test', detail: { source: 'scripts/smoke-v126.mjs' } }) });
  const logs = await fetch(`${origin}/api/boot-logs`, { cache: 'no-store' }).then(response => response.json());
  assert(logs.version === '1.0.26', 'boot-log endpoint version mismatch');
  assert(logs.build === EXPECTED_BUILD, `boot-log build mismatch: ${logs.build}`);
  assert(logs.logs.some(entry => entry.kind === 'client:smoke-test'), 'boot-log endpoint did not retain the smoke event');
  assert(logs.logs.some(entry => entry.kind === 'campus-runtime-sanitized' && entry.detail?.remainingReloads === 0), 'runtime sanitization was not logged as successful');
  console.log(JSON.stringify({ ok: true, health, campusBytes: campusHtml.length, bootLogCount: logs.count }, null, 2));
} catch (error) {
  console.error(output.join(''));
  throw error;
} finally {
  child.kill('SIGTERM');
  await Promise.race([new Promise(resolve => child.once('exit', resolve)), sleep(1500)]);
  if (!child.killed) child.kill('SIGKILL');
  await rm(dataDir, { recursive: true, force: true });
}
