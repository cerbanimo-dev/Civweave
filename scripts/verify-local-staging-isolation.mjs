#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const functionsRoot = resolve(repoRoot, 'functions');
const stagingRuntimePath = resolve(functionsRoot, '_shared', 'staging-runtime.ts');
const localConfigPath = resolve(repoRoot, 'wrangler.local-staging.jsonc');

const productionTargets = [
  'civweave-core.cerbanimo.workers.dev',
  'civweave-node-cloud.cerbanimo.workers.dev',
  'civweave-host-edge.cerbanimo.workers.dev',
  'civweave-host-node.onrender.com',
  'api.stripe.com',
];

const guardedProductionFiles = new Map([
  ['functions/api/host-node-search.ts', new Set([
    'civweave-core.cerbanimo.workers.dev',
    'civweave-node-cloud.cerbanimo.workers.dev',
  ])],
  ['functions/api/hub-map-nodes.ts', new Set([
    'civweave-core.cerbanimo.workers.dev',
    'civweave-node-cloud.cerbanimo.workers.dev',
  ])],
  ['functions/api/host-node-status.ts', new Set([
    'civweave-node-cloud.cerbanimo.workers.dev',
    'civweave-host-node.onrender.com',
  ])],
]);

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(path));
    else if (entry.isFile() && /\.(?:ts|js|mjs)$/.test(entry.name)) files.push(path);
  }
  return files;
}

function fail(message) {
  process.stderr.write(`[local-staging] ${message}\n`);
  process.exitCode = 1;
}

if (!statSync(functionsRoot).isDirectory()) fail('functions directory is missing.');

const stagingRuntime = readFileSync(stagingRuntimePath, 'utf8');
for (const marker of [
  'hostname === "localhost"',
  'hostname === "127.0.0.1"',
  'hostname === "[::1]"',
]) {
  if (!stagingRuntime.includes(marker)) fail(`staging runtime no longer recognizes loopback: ${marker}`);
}

const config = readFileSync(localConfigPath, 'utf8');
for (const marker of [
  '"name": "civweave-local-staging"',
  '"pages_build_output_dir": "./public"',
  '"CIVWEAVE_ENVIRONMENT": "staging"',
  '"CIVWEAVE_PRODUCTION_ISOLATION": "true"',
]) {
  if (!config.includes(marker)) fail(`local staging config is missing safety marker: ${marker}`);
}
if (/"name"\s*:\s*"civweave"(?:\s|,)/.test(config)) {
  fail('local staging config must never target the production Pages project name.');
}

for (const file of walk(functionsRoot)) {
  const source = readFileSync(file, 'utf8');
  const repoPath = relative(repoRoot, file).replaceAll('\\', '/');
  for (const target of productionTargets) {
    if (!source.includes(target)) continue;
    const allowedTargets = guardedProductionFiles.get(repoPath);
    if (!allowedTargets?.has(target)) {
      fail(`${repoPath} contains production target ${target} without an approved staging guard.`);
      continue;
    }
    if (!source.includes('isStagingRequest') || !source.includes('if (isStagingRequest(context.request))')) {
      fail(`${repoPath} contains ${target} but no early staging request branch.`);
    }
  }
}

if (!process.exitCode) {
  process.stdout.write('[local-staging] isolation verified: loopback uses staging fixtures and known production service targets are guarded.\n');
}
