#!/usr/bin/env node

import fs from 'node:fs';
import { resolve } from 'node:path';
import { provisionCloudflareAccountEdge, starterNodeIds } from './provision-cloudflare-account-edge-v1.mjs';

const clean = value => String(value ?? '').trim();
const hostId = 'civweave';
const workerName = 'civweave-host-edge';
const desiredNodeIds = starterNodeIds(hostId);

function parseArgs(argv) {
  let output = '';
  let repair = true;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--output') output = resolve(String(argv[++i] || ''));
    else if (arg === '--check-only') repair = false;
    else if (arg === '--repair') repair = true;
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/ensure-founder-source-node-v1.mjs [--repair|--check-only] [--output <json>]');
      process.exit(0);
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return { output, repair };
}

async function json(url, init = {}) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(12000), cache: 'no-store' });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}: ${JSON.stringify(payload)}`);
  return payload;
}

async function resolveWorkerOrigin() {
  const account = clean(process.env.CLOUDFLARE_ACCOUNT_ID);
  const token = clean(process.env.CLOUDFLARE_API_TOKEN);
  if (!account || !token) throw new Error('CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required.');
  const payload = await json(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/workers/subdomain`, {
    headers: { authorization: `Bearer ${token}` }
  });
  const subdomain = clean(payload?.result?.subdomain);
  if (!payload?.success || !/^[a-z0-9-]{1,63}$/i.test(subdomain)) {
    throw new Error(`Could not resolve founder workers.dev subdomain: ${JSON.stringify(payload?.errors || payload)}`);
  }
  return `https://${workerName}.${subdomain}.workers.dev`;
}

async function inspectFounder(workerOrigin) {
  const capacity = await json(`${workerOrigin}/api/fabric/capacity`);
  const actualIds = Array.isArray(capacity?.hostNodeIds) ? [...capacity.hostNodeIds].sort() : [];
  const expectedIds = [...desiredNodeIds].sort();
  if (actualIds.length !== expectedIds.length || actualIds.some((id, index) => id !== expectedIds[index])) {
    throw new Error(`Founder source node set is ${JSON.stringify(actualIds)}; expected ${JSON.stringify(expectedIds)}.`);
  }
  const starterNodes = [];
  for (const nodeId of expectedIds) {
    const origin = `${workerOrigin}/nodes/${nodeId}`;
    const [health, manifestEnvelope] = await Promise.all([
      json(`${origin}/api/node/health`),
      json(`${origin}/api/ai/node/manifest`)
    ]);
    const manifest = manifestEnvelope?.manifest || manifestEnvelope;
    if (health?.ok !== true || health?.nodeId !== nodeId) throw new Error(`${nodeId} failed its health probe.`);
    if (manifest?.nodeId !== nodeId || clean(manifest?.publicOrigin).replace(/\/+$/, '') !== origin) {
      throw new Error(`${nodeId} advertised the wrong node identity or origin.`);
    }
    starterNodes.push({ nodeId, publicOrigin: origin, runtime: manifest.runtime || null });
  }
  return { workerOrigin, starterNodes };
}

function writeSummary(path, summary) {
  if (!path) return;
  fs.mkdirSync(resolve(path, '..'), { recursive: true });
  fs.writeFileSync(path, `${JSON.stringify(summary, null, 2)}\n`);
}

const options = parseArgs(process.argv.slice(2));
let workerOrigin = '';
let repaired = false;
let firstFailure = null;

try {
  workerOrigin = await resolveWorkerOrigin();
  await inspectFounder(workerOrigin);
} catch (error) {
  firstFailure = String(error?.message || error);
  if (!options.repair) throw error;
  const provisioned = await provisionCloudflareAccountEdge({ hostId, strict: true });
  workerOrigin = provisioned.workerOrigin;
  repaired = true;
}

const verified = await inspectFounder(workerOrigin);
const summary = {
  ok: true,
  schema: 'civweave.founder-source-node-health.v1',
  hostId,
  worker: workerName,
  workerOrigin: verified.workerOrigin,
  browserTrafficPolicy: 'not-a-public-web-origin',
  machineTrafficPolicy: 'node-fabric-and-steward-operations',
  expectedStarterNodes: desiredNodeIds,
  starterNodes: verified.starterNodes,
  repaired,
  repairReason: firstFailure,
  checkedAt: new Date().toISOString()
};
writeSummary(options.output, summary);
console.log(JSON.stringify(summary, null, 2));
