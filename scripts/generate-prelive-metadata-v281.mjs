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
const installerRuntimePath = path.join(publicDir, 'install-v130.js');
const installBridgePath = path.join(publicDir, 'app', 'pwa-install-prompt-v250.js');
const appManifestPath = path.join(publicDir, 'app', 'manifest.webmanifest');
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

async function patchTextIfChanged(file, transform) {
  const before = await fs.readFile(file, 'utf8');
  const after = transform(before);
  if (after === before) return false;
  await fs.writeFile(file, after, 'utf8');
  return true;
}

function replaceRequired(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Could not locate ${label}.`);
  return source.replace(before, after);
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

// A lightweight service worker must be able to activate from the genuinely
// required shell alone. Optional local-AI, knowledge, media, and diagnostic
// assets used to be awaited by the install event as well. A single slow optional
// request could therefore hold activation for many timeout windows, which is
// especially damaging during an Android cold-start or retained-worker repair.
const workerInstallChanged = await patchTextIfChanged(workerPath, source => replaceRequired(
  source,
`async function cacheShell() {
  const cache = await caches.open(SHELL_CACHE);
  const failures = [];
  for (let index = 0; index < SHELL_ASSETS.length; index += 4) {
    const batch = SHELL_ASSETS.slice(index, index + 4);
    const results = await Promise.allSettled(batch.map(async pathname => {
      const response = await fetchFresh(pathname, 'shell-install');
      await cache.put(cacheKey(pathname), response.clone());
    }));
    results.forEach((result, offset) => {
      if (result.status === 'rejected') failures.push({ pathname: batch[offset], message: result.reason?.message || String(result.reason) });
    });
  }
  const requiredFailures = failures.filter(entry => REQUIRED_SHELL_ASSETS.includes(entry.pathname));
  if (requiredFailures.length) {
    const error = new Error(\`App shell incomplete: \${requiredFailures.length}/\${REQUIRED_SHELL_ASSETS.length} required files failed.\`);
    error.failures = requiredFailures;
    throw error;
  }
  return { optionalFailures: failures.filter(entry => OPTIONAL_SHELL_ASSETS.includes(entry.pathname)) };
}`,
`async function cacheShell() {
  const cache = await caches.open(SHELL_CACHE);
  const failures = [];
  for (let index = 0; index < REQUIRED_SHELL_ASSETS.length; index += 4) {
    const batch = REQUIRED_SHELL_ASSETS.slice(index, index + 4);
    const results = await Promise.allSettled(batch.map(async pathname => {
      const response = await fetchFresh(pathname, 'shell-install-required');
      await cache.put(cacheKey(pathname), response.clone());
    }));
    results.forEach((result, offset) => {
      if (result.status === 'rejected') failures.push({ pathname: batch[offset], message: result.reason?.message || String(result.reason) });
    });
  }
  if (failures.length) {
    const error = new Error(\`App shell incomplete: \${failures.length}/\${REQUIRED_SHELL_ASSETS.length} required files failed.\`);
    error.failures = failures;
    throw error;
  }
  return { optionalFailures: [], optionalDeferred: OPTIONAL_SHELL_ASSETS.length };
}`,
  'required-only lightweight shell installation block'
));

// Never let an apparently matching v203 registration bypass a real byte update.
// Android can retain the registration after the PWA icon is removed, and an old
// wrapper can have the same versioned URL as the current lightweight shell.
const installerRuntimeChanged = await patchTextIfChanged(installerRuntimePath, source => replaceRequired(
  source,
`    if (exactActive) {
      registration = existing;
      activeWorker = existing.active;
      worker = activeWorker;
      if (options.manual) {
        help('Checking the lightweight app worker for an updated release…');
        try {
          await withTimeout(registration.update(), REGISTRATION_TIMEOUT_MS, 'Chrome did not finish checking the app worker.', 'service-worker update');
          worker = await waitForCurrentWorker();
        } catch (error) {
          if (error?.code === 'CIVWEAVE_PACKAGE_TIMEOUT' && error?.phase === 'service-worker update') {
            releaseCheckTimedOut = true;
            worker = activeWorker;
          } else {
            throw error;
          }
        }
      }
    } else {`,
`    if (exactActive) {
      registration = existing;
      activeWorker = existing.active;
      worker = activeWorker;
      help(options.manual ? 'Checking the lightweight app worker for an updated release…' : 'Refreshing the lightweight app worker before installation…');
      try {
        await withTimeout(registration.update(), REGISTRATION_TIMEOUT_MS, 'Chrome did not finish checking the app worker.', 'service-worker update');
        worker = await waitForCurrentWorker();
      } catch (error) {
        if (options.manual && error?.code === 'CIVWEAVE_PACKAGE_TIMEOUT' && error?.phase === 'service-worker update') {
          releaseCheckTimedOut = true;
          worker = activeWorker;
        } else {
          throw error;
        }
      }
    } else {`,
  'installer exact-active worker refresh block'
));

// The installability bridge previously treated *any* active root worker as good
// enough. Retired /service-worker.js registrations must be evicted instead of
// being blessed as install-ready; current v203 registrations get an explicit
// update check before the browser install prompt is allowed to proceed.
const installBridgeChanged = await patchTextIfChanged(installBridgePath, source => replaceRequired(
  source,
`    const existing=await navigator.serviceWorker.getRegistration('/');
    if(existing?.active){publish('civweave:pwa-installability-bootstrap',{ready:true,worker:workerPath(existing.active),reused:true});return true}
    await navigator.serviceWorker.register(INSTALLABILITY_WORKER_URL,{scope:'/',updateViaCache:'none'});`,
`    const existing=await navigator.serviceWorker.getRegistration('/');
    const active=existing?.active||null,activePath=workerPath(active);
    if(activePath==='/service-worker-v203.js'){
      try{await existing.update();existing.waiting?.postMessage?.({type:'SKIP_WAITING'})}catch{}
      publish('civweave:pwa-installability-bootstrap',{ready:true,worker:activePath,reused:true,validatedCurrentShell:true});return true
    }
    if(activePath==='/pwa-installability-worker-v1.js'){
      publish('civweave:pwa-installability-bootstrap',{ready:true,worker:activePath,reused:true,validatedInstallabilityWorker:true});return true
    }
    if(existing?.active){
      publish('civweave:pwa-installability-bootstrap',{ready:false,worker:activePath,reused:false,retiredRootWorker:true});
      await existing.unregister().catch(()=>false);
      await new Promise(resolve=>setTimeout(resolve,80));
    }
    await navigator.serviceWorker.register(INSTALLABILITY_WORKER_URL,{scope:'/',updateViaCache:'none'});`,
  'installability active-root-worker validation block'
));

// The version synchronizer intentionally owns version text, but the PWA launch
// contract is owned here because shell integrity must hash the *final* manifest.
// Starting from / gives even very old retained root workers a network-safe escape
// hatch where staging can replace stale registrations before the campus opens.
const appManifest = JSON.parse(await fs.readFile(appManifestPath, 'utf8'));
appManifest.start_url = '/?installed=1&source=pwa-root-v431';
const appManifestChanged = await writeJsonIfChanged(appManifestPath, appManifest);

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
  installHardening: { workerInstallChanged, installerRuntimeChanged, installBridgeChanged },
  pwaManifest: { changed: appManifestChanged, startUrl: appManifest.start_url },
  shellIntegrity: { changed: integrityChanged, requiredAssetCount: requiredShellAssets.length },
  campusBudget: { changed: manifestChanged, ...manifest.preflight }
}, null, 2));
