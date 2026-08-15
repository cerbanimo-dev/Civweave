#!/usr/bin/env node

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const configPath = resolve(repoRoot, 'cloudflare/account-edge/wrangler.jsonc');
const WORKER_NAME = 'civweave-host-edge';
const STARTER_NODE_COUNT = 3;
const WORKERS_PERMISSION = 'Account > Workers Scripts > Edit';

const clean = (value, max = 180) => String(value ?? '').trim().slice(0, max);
export const normalizeHostId = value => clean(value, 72)
  .toLowerCase()
  .replace(/[^a-z0-9-]+/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '');

export function starterNodeIds(hostId) {
  const base = normalizeHostId(hostId) || 'civweave';
  return Object.freeze(['a', 'b', 'c'].map(suffix => `${base}-${suffix}`));
}

export function parseWorkersDevUrl(output) {
  const matches = String(output || '').match(/https:\/\/[^\s"']+\.workers\.dev\/?/gi) || [];
  if (!matches.length) return '';
  return matches.at(-1).replace(/[),.;]+$/g, '').replace(/\/+$/g, '');
}

export function needsBootstrap(snapshot) {
  return !Array.isArray(snapshot?.hostNodeIds) || snapshot.hostNodeIds.length < STARTER_NODE_COUNT;
}

function parseArgs(argv) {
  let hostId = normalizeHostId(process.env.CIVWEAVE_HOST_ID) || 'civweave';
  let output = '';
  let strict = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--host-id') hostId = normalizeHostId(argv[++i]);
    else if (arg === '--output') output = resolve(repoRoot, String(argv[++i] || ''));
    else if (arg === '--strict') strict = true;
    else if (arg === '--allow-partial') strict = false;
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/provision-cloudflare-account-edge-v1.mjs --host-id <id> [--strict|--allow-partial] [--output <json>]');
      process.exit(0);
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!hostId) throw new Error('A non-empty --host-id is required.');
  return { hostId, output, strict };
}

function detectWrangler() {
  const localWranglerJs = resolve(repoRoot, 'node_modules/wrangler/bin/wrangler.js');
  const candidates = [];
  if (existsSync(localWranglerJs)) candidates.push({ command: process.execPath, prefix: [localWranglerJs], shell: false });
  if (process.platform === 'win32') {
    candidates.push({ command: 'wrangler.cmd', prefix: [], shell: true });
    candidates.push({ command: 'npx.cmd', prefix: ['--yes', 'wrangler@latest'], shell: true });
  } else {
    candidates.push({ command: 'wrangler', prefix: [], shell: false });
    candidates.push({ command: 'npx', prefix: ['--yes', 'wrangler@latest'], shell: false });
  }
  for (const candidate of candidates) {
    const result = spawnSync(candidate.command, [...candidate.prefix, '--version'], {
      cwd: repoRoot,
      encoding: 'utf8',
      shell: candidate.shell,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    if (result.status === 0) return candidate;
  }
  throw new Error('Wrangler was not found. Install Wrangler or run npm install, then retry.');
}

function runWrangler(wrangler, args, { allowFailure = false, input = undefined } = {}) {
  const result = spawnSync(wrangler.command, [...wrangler.prefix, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: wrangler.shell,
    env: process.env,
    input,
    stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  if (result.status !== 0 && !allowFailure) throw new Error(output.trim() || `Wrangler failed: ${args.join(' ')}`);
  return { status: result.status ?? 1, output };
}

const delay = ms => new Promise(resolvePromise => setTimeout(resolvePromise, ms));

async function fetchJson(url, init = {}, attempts = 9) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, init);
      const payload = await response.json().catch(() => ({}));
      if (response.ok) return payload;
      lastError = new Error(payload?.error || payload?.message || `HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts) await delay(Math.min(750 * attempt, 3000));
  }
  throw lastError || new Error(`Unable to reach ${url}`);
}

function secretNames(output) {
  try {
    const parsed = JSON.parse(output);
    const rows = Array.isArray(parsed) ? parsed : (parsed.result || parsed.secrets || []);
    return new Set(rows.map(item => clean(item?.name || item?.key, 200)).filter(Boolean));
  } catch {
    return new Set();
  }
}

function writeSummary(path, summary) {
  if (!path) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
}

export async function provisionCloudflareAccountEdge({ hostId, strict = true, output = '', wrangler = detectWrangler() } = {}) {
  const normalizedHostId = normalizeHostId(hostId) || 'civweave';
  const baseSummary = {
    schema: 'civweave.cloudflare-account-edge.v1',
    capability: 'worker-plus-three-starter-nodes',
    worker: WORKER_NAME,
    requiredStarterNodes: STARTER_NODE_COUNT,
    hostId: normalizedHostId,
    requiredPermissions: [WORKERS_PERMISSION],
    accountResourceScope: 'Include the Cloudflare account that owns this host',
    retryCommand: `node scripts/provision-cloudflare-account-edge-v1.mjs --host-id ${normalizedHostId} --strict`,
  };

  try {
    console.log('Cloudflare account-edge provisioning');
    console.log(`Worker: ${WORKER_NAME}`);
    console.log(`Starter-node target: ${STARTER_NODE_COUNT}`);

    const deploy = runWrangler(wrangler, ['deploy', '--config', configPath]);
    process.stdout.write(deploy.output);
    const workerOrigin = parseWorkersDevUrl(deploy.output);
    if (!workerOrigin) throw new Error('Wrangler deployed the account edge but did not report a workers.dev URL.');

    let snapshot = await fetchJson(`${workerOrigin}/api/fabric/capacity`);
    let operatorSecretRotated = false;
    let bootstrapToken = '';

    if (needsBootstrap(snapshot)) {
      const secrets = runWrangler(wrangler, ['secret', 'list', '--config', configPath, '--format', 'json'], { allowFailure: true });
      const names = secrets.status === 0 ? secretNames(secrets.output) : new Set();
      const secretWasPresent = names.has('NODE_FABRIC_OPERATOR_TOKEN');

      // Incomplete provisioning is prelaunch state. Rotating this account-local
      // secret makes retries self-healing if an earlier process died after the
      // secret was written but before all three Durable Objects were registered.
      bootstrapToken = randomBytes(32).toString('base64url');
      runWrangler(wrangler, ['secret', 'put', 'NODE_FABRIC_OPERATOR_TOKEN', '--config', configPath], { input: `${bootstrapToken}\n` });
      operatorSecretRotated = secretWasPresent;
      await delay(1000);
      snapshot = await fetchJson(`${workerOrigin}/api/fabric/capacity`);

      const desired = starterNodeIds(normalizedHostId);
      const existing = new Set(Array.isArray(snapshot.hostNodeIds) ? snapshot.hostNodeIds : []);
      for (const nodeId of desired) {
        if (existing.size >= STARTER_NODE_COUNT) break;
        if (existing.has(nodeId)) continue;
        const publicOrigin = `${workerOrigin}/nodes/${nodeId}`;
        const result = await fetchJson(`${workerOrigin}/api/fabric/nodes/${encodeURIComponent(nodeId)}`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${bootstrapToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            displayName: `${normalizedHostId} starter ${nodeId.slice(-1).toUpperCase()}`,
            operatorId: `cloudflare-account-${normalizedHostId}`,
            publicOrigin,
          }),
        });
        const ids = result?.capacity?.hostNodeIds;
        if (Array.isArray(ids)) for (const id of ids) existing.add(id);
        else existing.add(nodeId);
      }
      snapshot = await fetchJson(`${workerOrigin}/api/fabric/capacity`);
    }

    const nodeIds = Array.isArray(snapshot.hostNodeIds) ? [...snapshot.hostNodeIds] : [];
    if (nodeIds.length !== STARTER_NODE_COUNT) {
      throw new Error(`Cloudflare account edge has ${nodeIds.length} starter nodes; expected exactly ${STARTER_NODE_COUNT}.`);
    }

    const starterNodes = [];
    for (const nodeId of nodeIds) {
      const origin = `${workerOrigin}/nodes/${nodeId}`;
      const [health, manifestEnvelope] = await Promise.all([
        fetchJson(`${origin}/api/node/health`),
        fetchJson(`${origin}/api/ai/node/manifest`),
      ]);
      if (health?.ok !== true || health?.nodeId !== nodeId) throw new Error(`Starter node ${nodeId} failed its health probe.`);
      const manifest = manifestEnvelope?.manifest;
      if (manifest?.nodeId !== nodeId || manifest?.publicOrigin !== origin) {
        throw new Error(`Starter node ${nodeId} did not advertise its account-edge public origin.`);
      }
      starterNodes.push({ nodeId, publicOrigin: origin, runtime: manifest.runtime });
    }

    const summary = {
      ...baseSummary,
      status: 'ready',
      workerOrigin,
      starterNodeIds: nodeIds,
      starterNodes,
      operatorSecretRotated,
      generatedAt: new Date().toISOString(),
    };
    writeSummary(output, summary);
    console.log(JSON.stringify(summary, null, 2));
    return summary;
  } catch (error) {
    const summary = {
      ...baseSummary,
      status: 'pending',
      error: String(error?.message || error),
      generatedAt: new Date().toISOString(),
    };
    writeSummary(output, summary);
    if (strict) throw error;
    console.warn(`Cloudflare Pages hosting can continue, but the account edge is incomplete: ${summary.error}`);
    console.warn(`Required token permission: ${WORKERS_PERMISSION}`);
    console.warn(`Retry after updating the token: ${summary.retryCommand}`);
    return summary;
  }
}

const invokedAsScript = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedAsScript) {
  const options = parseArgs(process.argv.slice(2));
  provisionCloudflareAccountEdge(options).catch(error => {
    console.error(error?.stack || String(error));
    process.exitCode = 1;
  });
}
