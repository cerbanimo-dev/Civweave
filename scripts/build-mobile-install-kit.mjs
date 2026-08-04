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
const mobileTemplatesDir = path.join(here, 'mobile-install-kit');
const seedTemplatesDir = path.join(here, 'cwseed-node-hub');
const packageJson = JSON.parse(await fs.readFile(path.join(repo, 'package.json'), 'utf8'));
const workerPath = path.join(publicDir, 'service-worker.js');
const boundaryPath = path.join(publicDir, 'app', 'install-boundary-v146.js');
const additionsPath = path.join(publicDir, 'extensions', 'commonweave-additions-v156.js');
const maxCloudflareAssetBytes = 24 * 1024 * 1024;
const nodeVersion = `${packageJson.version}-seed-node-v1`;

function extractArray(source, name) {
  const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*\\[(.*?)\\];`, 's'));
  if (!match) throw new Error(`Could not locate ${name} in ${workerPath}`);
  const value = Function(`"use strict"; return [${match[1]}];`)();
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
    throw new Error(`${name} must contain string paths only.`);
  }
  return value;
}

function extensionPaths(source) {
  return [...source.matchAll(/['"](\/extensions\/[A-Za-z0-9._/-]+)['"]/g)].map(match => match[1]);
}

function unique(items) {
  return [...new Set(items)];
}

function assertReleasePath(asset) {
  if (!asset.startsWith('/') || asset.includes('..')) throw new Error(`Unsafe release path: ${asset}`);
  const forbidden = [
    '/app/services/living-school/visual-assets/',
    '/app/services/cerbanimo/assets/visual/',
    '/app/services/fellowfare/assets/mall/',
    '/app/services/anarchadia/assets/screens/',
    '/app/models/all-minilm-l6-v2/onnx/',
    '/app/models/smollm2-360m-instruct/onnx/',
    '/app/vendor/transformers/wasm/'
  ];
  if (forbidden.some(prefix => asset.startsWith(prefix))) {
    throw new Error(`Optional, archived, or oversized asset leaked into the mobile core: ${asset}`);
  }
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed.`);
}

async function sha256(file) {
  const bytes = await fs.readFile(file);
  return { bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
}

async function inspectAsset(asset) {
  const source = path.join(publicDir, asset.slice(1));
  const stat = await fs.stat(source).catch(() => null);
  if (!stat?.isFile()) throw new Error(`Required mobile core file is missing: ${asset}`);
  return { path: asset, ...(await sha256(source)) };
}

async function renderTemplate(sourceName, target, replacements = {}) {
  let content = await fs.readFile(path.join(seedTemplatesDir, sourceName), 'utf8');
  for (const [token, value] of Object.entries(replacements)) content = content.replaceAll(token, value);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content);
}

const workerSource = await fs.readFile(workerPath, 'utf8');
const boundarySource = await fs.readFile(boundaryPath, 'utf8');
const additionsSource = await fs.readFile(additionsPath, 'utf8');
const workerCore = extractArray(workerSource, 'CORE');
const dynamicExtensions = unique([...extensionPaths(boundarySource), ...extensionPaths(additionsSource)]);
const requiredAssets = unique(['/service-worker.js', ...workerCore, ...dynamicExtensions]);
requiredAssets.forEach(assertReleasePath);

const work = await fs.mkdtemp(path.join(os.tmpdir(), 'commonweave-release-artifacts-'));
try {
  const seedRoot = path.join(work, 'seed', 'commonweave-seed');
  const seedMobileDir = path.join(seedRoot, 'mobile');
  const seedHubDir = path.join(seedRoot, 'node-hub');
  const kitRoot = path.join(work, 'kit', 'commonweave-mobile-install-kit');
  await fs.mkdir(seedMobileDir, { recursive: true });
  await fs.mkdir(seedHubDir, { recursive: true });
  await fs.mkdir(kitRoot, { recursive: true });
  await fs.mkdir(downloadsDir, { recursive: true });

  const manifestEntries = [];
  for (const asset of requiredAssets) manifestEntries.push(await inspectAsset(asset));

  await fs.copyFile(path.join(mobileTemplatesDir, 'install-mobile.sh'), path.join(kitRoot, 'install-mobile.sh'));
  await fs.copyFile(path.join(mobileTemplatesDir, 'serve-commonweave.py'), path.join(kitRoot, 'serve-commonweave.py'));
  await fs.copyFile(path.join(mobileTemplatesDir, 'README.md'), path.join(kitRoot, 'README.md'));
  await fs.chmod(path.join(kitRoot, 'install-mobile.sh'), 0o755);
  await fs.chmod(path.join(kitRoot, 'serve-commonweave.py'), 0o755);

  await fs.writeFile(path.join(kitRoot, 'core-assets.txt'), `${requiredAssets.join('\n')}\n`);
  await fs.writeFile(path.join(kitRoot, 'service-worker-core.txt'), `${workerCore.join('\n')}\n`);
  await fs.writeFile(path.join(kitRoot, 'core-assets.json'), `${JSON.stringify({
    schema: 'commonweave.mobile-core.v2',
    version: packageJson.version,
    generatedAt: new Date().toISOString(),
    entry: '/app/installed-entry-v146.html',
    modelPolicy: 'deferred',
    assets: manifestEntries
  }, null, 2)}\n`);
  await fs.writeFile(path.join(kitRoot, 'release.json'), `${JSON.stringify({
    schema: 'commonweave.mobile-install-kit.v2',
    version: `${packageJson.version}-core-bootstrap`,
    source: process.env.COMMONWEAVE_RELEASE_BASE_URL || 'https://commonweave-host-node.onrender.com',
    assetManifest: 'core-assets.txt',
    entry: '/app/installed-entry-v146.html',
    modelPolicy: 'deferred',
    excludes: [
      'optional MiniLM ONNX graphs',
      'transformers runtime until enabled',
      'archived visual-location trees',
      'cabinet marketing and calibration assets',
      'retired duplicate runtimes'
    ]
  }, null, 2)}\n`);

  const seedPath = path.join(downloadsDir, 'commonweave-pocket-campus.cwseed');
  const kitPath = path.join(downloadsDir, 'Commonweave-Mobile-Install-Kit.zip');
  await fs.rm(seedPath, { force: true });
  await fs.rm(kitPath, { force: true });
  run('zip', ['-q', '-r', '-9', kitPath, 'commonweave-mobile-install-kit'], path.join(work, 'kit'));

  const kitInfo = await sha256(kitPath);
  await fs.writeFile(`${kitPath}.sha256`, `${kitInfo.sha256}  ${path.basename(kitPath)}\n`);
  await fs.copyFile(kitPath, path.join(seedMobileDir, path.basename(kitPath)));
  await fs.copyFile(`${kitPath}.sha256`, path.join(seedMobileDir, `${path.basename(kitPath)}.sha256`));

  await renderTemplate('server.mjs', path.join(seedHubDir, 'server.mjs'), {
    '__COMMONWEAVE_APP_VERSION__': packageJson.version,
    '__COMMONWEAVE_NODE_VERSION__': nodeVersion
  });
  await fs.copyFile(path.join(seedTemplatesDir, 'README.md'), path.join(seedHubDir, 'README.md'));
  await fs.copyFile(path.join(seedTemplatesDir, 'SEED-README.md'), path.join(seedRoot, 'README.md'));
  await fs.copyFile(path.join(seedTemplatesDir, 'render.yaml'), path.join(seedRoot, 'render.yaml'));
  await fs.writeFile(path.join(seedHubDir, 'package.json'), `${JSON.stringify({
    name: 'commonweave-portable-node-hub',
    version: nodeVersion,
    private: true,
    description: 'Dependency-free Commonweave release, relay, presence, and node-registration hub.',
    type: 'module',
    engines: { node: '>=20' },
    scripts: { start: 'node server.mjs' }
  }, null, 2)}\n`);

  const hubFiles = [];
  for (const relative of ['node-hub/server.mjs', 'node-hub/package.json', 'node-hub/README.md', 'render.yaml']) {
    hubFiles.push({ path: relative, ...(await sha256(path.join(seedRoot, relative))) });
  }
  await fs.writeFile(path.join(seedRoot, 'seed.json'), `${JSON.stringify({
    schema: 'commonweave.portable-seed.v3',
    version: nodeVersion,
    generatedAt: new Date().toISOString(),
    payloads: {
      mobileInstallKit: {
        path: `mobile/${path.basename(kitPath)}`,
        sha256: kitInfo.sha256,
        bytes: kitInfo.bytes
      },
      nodeHub: {
        path: 'node-hub/',
        entry: 'node-hub/server.mjs',
        runtime: 'node>=20',
        files: hubFiles,
        features: [
          'mobile-kit-distribution',
          'release-events',
          'node-registration',
          'heartbeat',
          'relay-envelopes',
          'presence',
          'gemini-agent-proxy'
        ],
        modelPolicy: 'device-only'
      }
    },
    excludes: [
      'full visual application duplicate',
      'optional MiniLM and Transformers model files',
      'archived room-scene trees',
      'cabinet marketing and calibration assets'
    ]
  }, null, 2)}\n`);

  run('zip', ['-q', '-r', '-9', seedPath, 'commonweave-seed'], path.join(work, 'seed'));
  const seedInfo = await sha256(seedPath);
  await fs.writeFile(`${seedPath}.sha256`, `${seedInfo.sha256}  ${path.basename(seedPath)}\n`);

  for (const [label, info] of [['Portable seed', seedInfo], ['Mobile install kit', kitInfo]]) {
    if (info.bytes > maxCloudflareAssetBytes) {
      throw new Error(`${label} is ${(info.bytes / 1024 / 1024).toFixed(2)} MiB; the Cloudflare release boundary is 24 MiB.`);
    }
  }

  console.log(`Indexed ${manifestEntries.length} current core files for mobile hydration.`);
  console.log(`Seed (mobile kit + node hub): ${(seedInfo.bytes / 1024).toFixed(1)} KiB ${seedInfo.sha256}`);
  console.log(`Kit (Cloudflare Pages): ${(kitInfo.bytes / 1024).toFixed(1)} KiB ${kitInfo.sha256}`);
} finally {
  await fs.rm(work, { recursive: true, force: true });
}
