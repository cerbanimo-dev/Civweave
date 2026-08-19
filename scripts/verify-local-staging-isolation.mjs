#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const functionsRoot = resolve(repoRoot, 'functions');
const stagingRuntimePath = resolve(functionsRoot, '_shared', 'staging-runtime.ts');
const localToolsRoot = resolve(repoRoot, 'tools', 'civweave-dev-mcp');
const retiredLocalConfigPath = resolve(localToolsRoot, 'wrangler.local-staging.jsonc');
const localLauncherPath = resolve(localToolsRoot, 'start-local-staging.mjs');
const localSpawnPath = resolve(localToolsRoot, 'lib', 'local-staging-spawn.mjs');

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
  ['functions/api/guild-directory-register.ts', new Set([
    'civweave-core.cerbanimo.workers.dev',
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

if (existsSync(retiredLocalConfigPath)) {
  fail('local staging must not use a custom Pages Wrangler config; Pages dev rejects nonstandard config paths.');
}

const launcher = readFileSync(localLauncherPath, 'utf8');
for (const marker of [
  "'127.0.0.1'",
  '8788',
  'localStagingSpawnSpec',
  'localStagingWranglerArgs',
]) {
  if (!launcher.includes(marker)) fail(`local staging launcher is missing expected contract marker: ${marker}`);
}
if (launcher.includes('wrangler.local-staging.jsonc')) {
  fail('local staging launcher must not reference a custom Wrangler config path.');
}
if (!launcher.includes("const loopbackHosts = new Set(['127.0.0.1', 'localhost', '::1'])")) {
  fail('local staging launcher must remain loopback-only.');
}

const spawnContract = readFileSync(localSpawnPath, 'utf8');
for (const marker of [
  "platform === 'win32'",
  'env.ComSpec || env.COMSPEC',
  "['/d', '/s', '/c', 'npx'",
  "command: 'npx'",
  "'pages'",
  "'dev'",
  "'public'",
  "'--compatibility-date'",
  "'2026-08-04'",
  "'--compatibility-flag'",
  "'nodejs_compat'",
  "'--binding'",
  "'CIVWEAVE_ENVIRONMENT=staging'",
  "'CIVWEAVE_LOCAL_STAGING=1'",
  "'CIVWEAVE_PRODUCTION_ISOLATION=true'",
]) {
  if (!spawnContract.includes(marker)) fail(`local staging spawn contract is missing safety marker: ${marker}`);
}
if (/['"](?:-c|--config)['"]/.test(spawnContract)) {
  fail('local staging Pages args must not pass -c/--config; Pages rejects custom configuration paths.');
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
  process.stdout.write('[local-staging] isolation verified: config-free Pages dev uses explicit staging bindings, Windows launches through ComSpec, and known production service targets are guarded.\n');
}
