#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const sourceDir = resolve(repoRoot, 'public');
const outputDir = resolve(repoRoot, '.cloudflare-pages');
const maxCloudflareAssetBytes = 24 * 1024 * 1024;

const ROOT_FILES = Object.freeze([
  'index.html',
  'offline.html',
  'service-worker.js',
  '_redirects',
  '_routes.json'
]);
const APP_PATHS = Object.freeze([
  'app/index.html',
  'app/core.css',
  'app/core.js',
  'app/manifest.webmanifest',
  'app/assets/ai',
  'app/logos',
  'app/local-ai',
  'app/vendor'
]);
const RELEASE_DOWNLOADS = Object.freeze([
  'downloads/Civweave-Mobile-Install-Kit.zip',
  'downloads/Civweave-Mobile-Install-Kit.zip.sha256',
  'downloads/civweave-pocket-campus.cwseed',
  'downloads/civweave-pocket-campus.cwseed.sha256'
]);

function runNode(relativePath, args = []) {
  const result = spawnSync(process.execPath, [resolve(repoRoot, relativePath), ...args], { cwd: repoRoot, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${relativePath} failed.`);
}

function copyRequired(relativePath) {
  const source = resolve(sourceDir, relativePath);
  if (!existsSync(source)) throw new Error(`Required release path is missing: ${relativePath}`);
  const target = resolve(outputDir, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target, { recursive: true, force: true });
}

function assertSizeBoundary(directory) {
  const stack = [directory];
  const oversized = [];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = resolve(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) {
        const bytes = statSync(full).size;
        if (bytes > maxCloudflareAssetBytes) oversized.push({ full, bytes });
      }
    }
  }
  if (!oversized.length) return;
  throw new Error(`Cloudflare Pages release contains ${oversized.length} file(s) above 24 MiB:\n${oversized.map(({ full, bytes }) => `- ${relative(directory, full)} (${(bytes / 1024 / 1024).toFixed(2)} MiB)`).join('\n')}`);
}

// Optional local-model runtime bytes are staged only for the hosted release.
// Model weights remain on-demand and are intentionally not copied into the
// Cloudflare artifact merely because they exist in the source tree.

if (!existsSync(sourceDir) || !statSync(sourceDir).isDirectory()) throw new Error(`Static source directory not found: ${sourceDir}`);
runNode('scripts/verify-core-runtime.mjs');
runNode('scripts/stage-transformers-assets.mjs', ['--force']);
runNode('scripts/build-mobile-install-kit.mjs');

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });
for (const file of ROOT_FILES) if (existsSync(resolve(sourceDir, file))) copyRequired(file);
for (const appPath of APP_PATHS) copyRequired(appPath);
for (const file of RELEASE_DOWNLOADS) copyRequired(file);

assertSizeBoundary(outputDir);
console.log(`Built core-only Cloudflare release at ${relative(repoRoot, outputDir)}. Legacy shells, recovery layers, cabinet bundles, archived public trees, and bundled model weights were not copied.`);
