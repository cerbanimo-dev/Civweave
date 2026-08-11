import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createZipArchive } from './portable-zip.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const portableSource = await fs.readFile(path.join(root, 'scripts/portable-zip.mjs'), 'utf8');
const cloudflareSource = await fs.readFile(path.join(root, 'scripts/build-cloudflare-pages.mjs'), 'utf8');
for (const token of [
  "from 'node:zlib'",
  'export async function createZipArchive',
  '0x04034b50',
  '0x02014b50',
  '0x06054b50',
  'deflateRawSync',
]) assert(portableSource.includes(token), `Portable ZIP writer missing ${token}`);
for (const token of [
  'withPortableZipFallback',
  'CIVWEAVE_PORTABLE_ZIP_SCRIPT',
  'System zip is unavailable; using the dependency-free Civweave ZIP writer.',
]) assert(cloudflareSource.includes(token), `Cloudflare build fallback missing ${token}`);

const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'civweave-portable-zip-test-'));
try {
  const bundle = path.join(fixture, 'bundle');
  await fs.mkdir(path.join(bundle, 'nested'), { recursive: true });
  await fs.writeFile(path.join(bundle, 'hello.txt'), 'Civweave portable ZIP\n');
  await fs.writeFile(path.join(bundle, 'nested', 'run.sh'), '#!/bin/sh\necho woven\n');
  await fs.chmod(path.join(bundle, 'nested', 'run.sh'), 0o755);
  const archivePath = path.join(fixture, 'fixture.zip');
  const result = await createZipArchive(archivePath, fixture, 'bundle', { level: 9 });
  const archive = await fs.readFile(archivePath);
  assert(result.entries === 4, `Expected four ZIP entries, received ${result.entries}`);
  assert(archive.readUInt32LE(0) === 0x04034b50, 'Portable archive is missing its local ZIP header.');
  assert(archive.includes(Buffer.from('bundle/hello.txt')), 'Portable archive omitted hello.txt.');
  assert(archive.includes(Buffer.from('bundle/nested/run.sh')), 'Portable archive omitted nested run.sh.');
  assert(archive.includes(Buffer.from([0x50, 0x4b, 0x05, 0x06])), 'Portable archive is missing the end-of-central-directory record.');
} finally {
  await fs.rm(fixture, { recursive: true, force: true });
}

// Simulate a machine with no system `zip`, but keep unrelated build tools available.
const nodeOnlyPath = path.dirname(process.execPath);
const tarLocator = process.platform === 'win32' ? 'where' : 'which';
const tarProbe = spawnSync(tarLocator, ['tar'], { encoding: 'utf8' });
assert(!tarProbe.error && tarProbe.status === 0, 'Portable ZIP verifier requires tar for dependency staging.');
const tarExecutable = String(tarProbe.stdout || '').split(/\r?\n/).map(value => value.trim()).find(Boolean);
assert(tarExecutable, 'Portable ZIP verifier could not resolve the tar executable.');
const restrictedTools = await fs.mkdtemp(path.join(os.tmpdir(), 'civweave-no-system-zip-'));
try {
  if (process.platform === 'win32') {
    await fs.writeFile(path.join(restrictedTools, 'tar.cmd'), `@"${tarExecutable}" %*\r\n`, 'utf8');
  } else {
    await fs.symlink(tarExecutable, path.join(restrictedTools, 'tar'));
  }
  const restrictedPath = `${restrictedTools}${path.delimiter}${nodeOnlyPath}`;
  const build = spawnSync(process.execPath, ['scripts/build-cloudflare-pages.mjs'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, PATH: restrictedPath },
    maxBuffer: 20 * 1024 * 1024,
  });
  if (build.status !== 0) {
    const detail = [build.stdout, build.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`Cloudflare build failed without system zip, status ${build.status}.${detail ? `\n${detail.slice(-12000)}` : ''}`);
  }
  const output = `${build.stdout || ''}\n${build.stderr || ''}`;
  assert(output.includes('System zip is unavailable; using the dependency-free Civweave ZIP writer.'), 'Cloudflare build did not enter its portable ZIP path.');
  assert(output.includes('All Cloudflare-hosted files are at or below 24 MiB'), 'Cloudflare build did not complete its hosted-file audit.');
} finally {
  await fs.rm(restrictedTools, { recursive: true, force: true });
}
for (const relative of [
  'public/downloads/Civweave-Mobile-Install-Kit.zip',
  'public/downloads/civweave-pocket-campus.cwseed',
  '.cloudflare-pages/downloads/Civweave-Mobile-Install-Kit.zip',
  '.cloudflare-pages/downloads/civweave-pocket-campus.cwseed',
]) {
  const value = await fs.readFile(path.join(root, relative));
  assert(value.readUInt32LE(0) === 0x04034b50, `${relative} is not a ZIP-compatible archive.`);
}

console.log(JSON.stringify({
  ok: true,
  revision: 'v185-cloudflare-portable-zip',
  systemZipRequired: false,
  cloudflareBuildSimulatedWithoutZip: true,
  tarPreservedDuringNoZipSimulation: true,
  mobileInstallKitBuilt: true,
  pocketCampusSeedBuilt: true,
  pagesOutputBuilt: true,
}, null, 2));
