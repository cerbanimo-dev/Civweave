import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const publicDir = path.join(root, 'public');
const version = (await fs.readFile(path.join(root, 'VERSION'), 'utf8')).trim();
const workerPath = path.join(publicDir, 'service-worker-core-v208.js');
const shellAssetsWorkerPath = path.join(publicDir, 'service-worker-shell-assets-v1.js');
const installerWorkerPath = path.join(publicDir, 'service-worker-installer-state-v280.js');
const offlineManifestPath = path.join(publicDir, 'app', 'offline-package-v208.json');
const integrityPath = path.join(publicDir, 'app', 'shell-integrity-v281.json');
const DISCOVERABLE_EXTENSION = /\.(?:html?|css|m?js|json|webmanifest|md|txt|png|webp|jpe?g|gif|svg|avif|ico|woff2?|ttf|otf)$/i;
const MIN_SAFETY_BYTES = 64 * 1024 * 1024;

if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`Invalid VERSION: ${version}`);

function extractStringArray(source, name, label) {
  const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*\\[(.*?)\\];`, 's'));
  if (!match) throw new Error(`Could not locate ${name} in ${label}.`);
  const value = Function(`"use strict"; return [${match[1]}];`)();
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
    throw new Error(`${name} in ${label} must be a string array.`);
  }
  return value;
}

async function writeJsonIfChanged(file, value) {
  const next = `${JSON.stringify(value, null, 2)}\n`;
  const before = await fs.readFile(file, 'utf8').catch(() => '');
  if (before === next) return false;
  await fs.writeFile(file, next, 'utf8');
  return true;
}

async function walk(directory) {
  const output = [];
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await walk(full));
    else if (entry.isFile()) output.push(full);
  }
  return output;
}

function urlPathFor(file) {
  return `/${path.relative(publicDir, file).split(path.sep).join('/')}`;
}

function isCandidate(urlPath, manifest) {
  const includePrefixes = Array.isArray(manifest.includePrefixes) ? manifest.includePrefixes : ['/app/', '/extensions/'];
  const excludePrefixes = Array.isArray(manifest.excludePrefixes) ? manifest.excludePrefixes : [];
  const excludeExtensions = Array.isArray(manifest.excludeExtensions) ? manifest.excludeExtensions : [];
  if (!includePrefixes.some(prefix => urlPath.startsWith(prefix))) return false;
  if (excludePrefixes.some(prefix => urlPath.startsWith(prefix))) return false;
  if (excludeExtensions.some(extension => urlPath.toLowerCase().endsWith(String(extension).toLowerCase()))) return false;
  return DISCOVERABLE_EXTENSION.test(urlPath);
}

const [workerSource, shellAssetsWorkerSource, installerWorkerSource] = await Promise.all([
  fs.readFile(workerPath, 'utf8'),
  fs.readFile(shellAssetsWorkerPath, 'utf8'),
  fs.readFile(installerWorkerPath, 'utf8')
]);
const requiredShellAssets = [...new Set([
  ...extractStringArray(workerSource, 'REQUIRED_SHELL_ASSETS', 'service-worker-core-v208.js'),
  ...extractStringArray(shellAssetsWorkerSource, 'REQUIRED_FAMILY_NAV', 'service-worker-shell-assets-v1.js'),
  ...extractStringArray(installerWorkerSource, 'INSTALLER_STATE_ASSETS', 'service-worker-installer-state-v280.js')
])];
const hashes = {};
for (const pathname of requiredShellAssets) {
  const local = path.join(publicDir, pathname.replace(/^\/+/, ''));
  const bytes = await fs.readFile(local);
  hashes[pathname] = crypto.createHash('sha256').update(bytes).digest('hex');
}

const integrity = {
  version,
  revision: 'shell-integrity-v281',
  algorithm: 'sha256',
  requiredAssetCount: requiredShellAssets.length,
  assets: hashes
};
const integrityChanged = await writeJsonIfChanged(integrityPath, integrity);

const manifest = JSON.parse(await fs.readFile(offlineManifestPath, 'utf8'));
const candidateRoots = [...new Set((manifest.includePrefixes || ['/app/', '/extensions/'])
  .map(prefix => String(prefix).replace(/^\/+/, '').replace(/\/+$/, ''))
  .filter(Boolean))];
const files = [];
for (const rootName of candidateRoots) files.push(...await walk(path.join(publicDir, rootName)));

const candidates = [];
for (const file of [...new Set(files)]) {
  const urlPath = urlPathFor(file);
  if (!isCandidate(urlPath, manifest)) continue;
  const stat = await fs.stat(file);
  candidates.push({ urlPath, bytes: stat.size });
}

const maxAssets = Math.max(50, Math.min(1500, Number(manifest.maxAssets || 700)));
const conservative = candidates
  .sort((a, b) => b.bytes - a.bytes || a.urlPath.localeCompare(b.urlPath))
  .slice(0, maxAssets);
const estimatedBytes = conservative.reduce((sum, entry) => sum + entry.bytes, 0);
const safetyBytes = Math.max(MIN_SAFETY_BYTES, Math.ceil(estimatedBytes * 0.15));
manifest.preflight = {
  revision: 'campus-storage-budget-v281',
  estimatedBytes,
  safetyBytes,
  requiredFreeBytes: estimatedBytes + safetyBytes,
  candidateAssetCount: candidates.length,
  estimatedAssetCount: conservative.length,
  conservativeUpperBound: true
};
const manifestChanged = await writeJsonIfChanged(offlineManifestPath, manifest);

console.log(JSON.stringify({
  ok: true,
  version,
  shellIntegrity: { changed: integrityChanged, requiredAssetCount: requiredShellAssets.length },
  campusBudget: { changed: manifestChanged, ...manifest.preflight }
}, null, 2));
