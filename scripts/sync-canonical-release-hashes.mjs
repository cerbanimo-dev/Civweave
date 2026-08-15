import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = (await fs.readFile(path.join(root, 'VERSION'), 'utf8')).trim();
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`Invalid VERSION: ${version}`);

const releaseDir = path.join(root, 'releases', version);
const manifestPath = path.join(releaseDir, 'release.json');
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
if (manifest?.schema !== 'civweave.canonical-release.v1') throw new Error('Canonical release manifest schema is invalid.');
if (manifest.version !== version) throw new Error(`Canonical release ${manifest.version || 'unknown'} does not match VERSION ${version}.`);
if (!manifest.sha256 || typeof manifest.sha256 !== 'object' || Array.isArray(manifest.sha256)) throw new Error('Canonical release sha256 map is missing.');

const next = {};
for (const relative of Object.keys(manifest.sha256).sort()) {
  const normalized = String(relative).replaceAll('\\', '/');
  if (!normalized.startsWith('server/') || normalized.includes('..') || path.isAbsolute(normalized)) {
    throw new Error(`Unsafe canonical release hash path: ${relative}`);
  }
  const bytes = await fs.readFile(path.join(releaseDir, normalized));
  next[relative] = crypto.createHash('sha256').update(bytes).digest('hex');
}

const before = JSON.stringify(manifest.sha256);
manifest.sha256 = next;
const changed = before !== JSON.stringify(next);
if (changed) await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({ ok: true, version, changed, hashes: Object.keys(next).length, manifest: path.relative(root, manifestPath) }, null, 2));
