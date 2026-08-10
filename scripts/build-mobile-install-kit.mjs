import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const publicDir = path.join(repo, 'public');
const downloadsDir = path.join(publicDir, 'downloads');
const packageJson = JSON.parse(await fs.readFile(path.join(repo, 'package.json'), 'utf8'));

export const CORE_FILES = Object.freeze([
  '/index.html',
  '/offline.html',
  '/service-worker.js',
  '/app/index.html',
  '/app/core.css',
  '/app/core.js',
  '/app/manifest.webmanifest',
  '/app/logos/civweave-symbol.svg',
  '/app/logos/civweave-pwa-192-v247.png',
  '/app/logos/civweave-pwa-512-v247.png',
  '/app/logos/civweave-pwa-maskable-512-v247.png',
  '/app/assets/ai/weaveling.png',
  '/app/assets/ai/moss.png',
  '/app/assets/ai/kamiya.png',
  '/app/assets/ai/rook.png',
  '/app/assets/ai/merlin.png'
]);

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.error) throw new Error(`${command} failed to start: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed.`);
}

async function sha256(file) {
  const bytes = await fs.readFile(file);
  return { bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
}

async function copyCore(targetRoot) {
  const manifest = [];
  for (const urlPath of CORE_FILES) {
    const source = path.join(publicDir, urlPath.slice(1));
    const stat = await fs.stat(source).catch(() => null);
    if (!stat?.isFile()) throw new Error(`Required core file is missing: ${urlPath}`);
    const target = path.join(targetRoot, urlPath.slice(1));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(source, target);
    manifest.push({ path: urlPath, ...(await sha256(source)) });
  }
  return manifest;
}

function createZip(archivePath, sourceDir, entryName) {
  if (process.platform === 'win32') {
    const sourcePath = path.join(sourceDir, entryName).replaceAll("'", "''");
    const archive = archivePath.replaceAll("'", "''");
    run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Compress-Archive -LiteralPath '${sourcePath}' -DestinationPath '${archive}' -CompressionLevel Optimal -Force`], sourceDir);
    return;
  }
  run('zip', ['-q', '-r', '-9', archivePath, entryName], sourceDir);
}

await fs.mkdir(downloadsDir, { recursive: true });
const work = await fs.mkdtemp(path.join(os.tmpdir(), 'civweave-core-release-'));
try {
  const kitName = 'civweave-mobile-install-kit';
  const kitRoot = path.join(work, kitName);
  const payloadRoot = path.join(kitRoot, 'public');
  const manifest = await copyCore(payloadRoot);
  await fs.writeFile(path.join(kitRoot, 'core-assets.json'), `${JSON.stringify({ schema: 'civweave.core-release.v1', version: packageJson.version, entry: '/app/', generatedAt: new Date().toISOString(), assets: manifest }, null, 2)}\n`);
  await fs.writeFile(path.join(kitRoot, 'README.txt'), `Civweave ${packageJson.version}\n\nThis package contains only the canonical offline boot core. Realm, model, knowledge, and other feature modules hydrate on demand and are not duplicated into the mandatory install package.\n`);

  const kitPath = path.join(downloadsDir, 'Civweave-Mobile-Install-Kit.zip');
  await fs.rm(kitPath, { force: true });
  createZip(kitPath, work, kitName);
  const info = await sha256(kitPath);
  await fs.writeFile(`${kitPath}.sha256`, `${info.sha256}  ${path.basename(kitPath)}\n`);

  const seedName = 'civweave-pocket-campus';
  const seedRoot = path.join(work, seedName);
  await fs.mkdir(seedRoot, { recursive: true });
  await fs.cp(kitRoot, path.join(seedRoot, 'mobile-core'), { recursive: true });
  const hubTemplates = path.join(here, 'cwseed-node-hub');
  if ((await fs.stat(hubTemplates).catch(() => null))?.isDirectory()) await fs.cp(hubTemplates, path.join(seedRoot, 'node-hub'), { recursive: true });
  await fs.writeFile(path.join(seedRoot, 'seed.json'), `${JSON.stringify({ schema: 'civweave.portable-seed.v4', version: packageJson.version, entry: '/app/', modelPolicy: 'on-demand', coreAssets: manifest.length }, null, 2)}\n`);

  const seedPath = path.join(downloadsDir, 'civweave-pocket-campus.cwseed');
  await fs.rm(seedPath, { force: true });
  createZip(seedPath, work, seedName);
  const seedInfo = await sha256(seedPath);
  await fs.writeFile(`${seedPath}.sha256`, `${seedInfo.sha256}  ${path.basename(seedPath)}\n`);
  console.log(`Built Civweave ${packageJson.version} core: ${manifest.length} mandatory files, ${(info.bytes / 1024).toFixed(1)} KiB install kit.`);
} finally {
  await fs.rm(work, { recursive: true, force: true });
}
