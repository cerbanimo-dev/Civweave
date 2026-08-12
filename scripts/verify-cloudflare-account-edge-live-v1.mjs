#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const [summaryPath = '/tmp/civweave-account-edge.json'] = process.argv.slice(2);
const clean = value => String(value ?? '').trim().replace(/\/+$/g, '');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchText(url, attempts = 6) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`${url}${url.includes('?') ? '&' : '?'}verify=${Date.now()}-${attempt}`, {
        headers: { 'cache-control': 'no-cache' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(Math.min(750 * attempt, 3000));
    }
  }
  throw lastError || new Error(`Unable to fetch ${url}`);
}

async function fetchJson(url) {
  const text = await fetchText(url);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON from ${url}`);
  }
}

const summary = JSON.parse(await readFile(summaryPath, 'utf8'));
if (summary?.status !== 'ready') {
  throw new Error(`Account edge is not ready: ${summary?.status || 'unknown'}`);
}
if (!Array.isArray(summary.starterNodes) || summary.starterNodes.length !== 3) {
  throw new Error(`Expected exactly 3 starter nodes, received ${summary?.starterNodes?.length ?? 0}.`);
}

const checked = [];
for (const node of summary.starterNodes) {
  const nodeId = clean(node?.nodeId);
  const origin = clean(node?.publicOrigin);
  if (!nodeId || !origin) throw new Error('Starter node is missing nodeId or publicOrigin.');

  const [html, health, manifestEnvelope, capacity] = await Promise.all([
    fetchText(`${origin}/`),
    fetchJson(`${origin}/api/node/health`),
    fetchJson(`${origin}/api/ai/node/manifest`),
    fetchJson(`${origin}/api/ai/node/capacity`),
  ]);

  const expectedLinks = [
    `${origin}/api/ai/node/manifest`,
    `${origin}/api/ai/node/capacity`,
    `${origin}/api/node/health`,
  ];
  for (const href of expectedLinks) {
    if (!html.includes(`href="${href}"`)) {
      throw new Error(`${nodeId} dashboard is missing node-scoped link ${href}`);
    }
  }
  if (html.includes('href="/api/')) {
    throw new Error(`${nodeId} dashboard still contains a Worker-root /api/ link.`);
  }
  if (health?.ok !== true || health?.nodeId !== nodeId) {
    throw new Error(`${nodeId} health endpoint does not identify the expected node.`);
  }
  if (manifestEnvelope?.manifest?.nodeId !== nodeId || clean(manifestEnvelope?.manifest?.publicOrigin) !== origin) {
    throw new Error(`${nodeId} manifest does not preserve its account-edge public origin.`);
  }
  const capacityNodeId = capacity?.nodeId || capacity?.capacity?.nodeId;
  if (capacityNodeId && capacityNodeId !== nodeId) {
    throw new Error(`${nodeId} capacity endpoint reported ${capacityNodeId}.`);
  }

  checked.push({
    nodeId,
    publicOrigin: origin,
    health: true,
    dashboardLinks: expectedLinks,
  });
}

console.log(JSON.stringify({
  ok: true,
  schema: 'civweave.cloudflare-account-edge-live-check.v1',
  workerOrigin: summary.workerOrigin,
  checked,
}, null, 2));
