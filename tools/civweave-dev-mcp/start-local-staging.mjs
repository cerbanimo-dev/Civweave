#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { localStagingSpawnSpec, localStagingWranglerArgs } from './lib/local-staging-spawn.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '../..');
const verifierPath = resolve(repoRoot, 'scripts', 'verify-local-staging-isolation.mjs');
const host = String(process.env.CIVWEAVE_LOCAL_STAGING_HOST || '127.0.0.1').trim();
const port = Number(process.env.CIVWEAVE_LOCAL_STAGING_PORT || 8788);
const loopbackHosts = new Set(['127.0.0.1', 'localhost', '::1']);

if (!loopbackHosts.has(host)) {
  throw new Error(`Local staging must bind to loopback, not ${host}.`);
}
if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) {
  throw new Error(`Invalid local staging port: ${port}`);
}

const displayHost = host === '::1' ? '[::1]' : host;
const origin = `http://${displayHost}:${port}`;
const verifier = spawnSync(process.execPath, [verifierPath], {
  cwd: repoRoot,
  stdio: 'inherit',
});
if (verifier.status !== 0) process.exit(verifier.status || 1);

async function health(timeoutMs = 1200) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${origin}/api/health`, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function isolatedStagingHealth(probe) {
  return Boolean(
    probe?.response.ok
    && probe.payload?.service === 'civweave-cloudflare-pages'
    && probe.payload?.environment === 'staging'
    && probe.payload?.productionIsolation === true
  );
}

const existing = await health();
if (existing) {
  if (isolatedStagingHealth(existing)) {
    console.log(`[civweave-local-staging] already running at ${origin}/app/`);
    console.log(`[civweave-local-staging] MCP browser target: ${origin}`);
    process.exit(0);
  }
  throw new Error(`Port ${port} is already serving something that is not isolated Civweave staging.`);
}

const npxArgs = localStagingWranglerArgs({ host, port });
const launch = localStagingSpawnSpec({ npxArgs });

console.log(`[civweave-local-staging] starting ${origin}`);
console.log('[civweave-local-staging] static source: public/; Functions: functions/; production service bindings: none');
console.log('[civweave-local-staging] staging vars are explicit local --binding values; no Wrangler project config is loaded');

const child = spawn(launch.command, launch.args, {
  cwd: repoRoot,
  env: { ...process.env },
  stdio: 'inherit',
});

let childExit = null;
child.once('error', error => {
  childExit = { code: 1, error };
});
child.once('exit', (code, signal) => {
  childExit = { code: code ?? (signal ? 1 : 0), signal };
});

let ready = false;
for (let attempt = 1; attempt <= 80; attempt += 1) {
  if (childExit) break;
  await new Promise(resolvePromise => setTimeout(resolvePromise, 250));
  const probe = await health(500);
  if (isolatedStagingHealth(probe)) {
    ready = true;
    console.log(`[civweave-local-staging] ready: ${origin}/app/`);
    console.log(`[civweave-local-staging] MCP browser target: ${origin}`);
    break;
  }
}

if (childExit) {
  if (childExit.error) throw childExit.error;
  process.exit(childExit.code || 1);
}
if (!ready) {
  child.kill();
  throw new Error(`Local staging did not become healthy at ${origin}/api/health.`);
}

const exit = await new Promise(resolvePromise => {
  if (child.exitCode !== null || child.signalCode) {
    resolvePromise({ code: child.exitCode, signal: child.signalCode });
    return;
  }
  child.once('exit', (code, signal) => resolvePromise({ code, signal }));
});
process.exit(exit.code ?? (exit.signal ? 1 : 0));
