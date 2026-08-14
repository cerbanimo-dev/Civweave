(()=>{
'use strict';

const VERSION = '1.0.153';
const ENTRY = '/app/installed-entry-v146.html?installed=1&system=civweave';
const WORKER_BUILD = `${VERSION}-lightweight-shell-v208`;
const WORKER_SCRIPT_REVISION = 'release-coherence-v226';
const WORKER_URL = `/service-worker-v203.js?v=${WORKER_BUILD}&revision=${WORKER_SCRIPT_REVISION}`;
const REGISTRATION_TIMEOUT_MS = 15000;
const REGISTRATION_QUERY_TIMEOUT_MS = 6000;
const ACTIVATION_TIMEOUT_MS = 45000;
const WATCHDOG_RECOVERY_KEY = 'civweave.shell.registration-watchdog.v208';
const LEGACY_LIBRARY_CACHE = 'civweave-knowledge-schools-v1';
const LIBRARY_CACHE = 'cwknowledge-school-seeds-v2';
const PROTECTED_CACHE_PREFIXES = ['cwknowledge-', 'cwupdate-', 'civweave-model-', 'civweave-offline-'];
const OFFLINE_MANIFEST_URL = '/app/offline-package-v208.json';

let installPrompt = null;
let registration = null;
let activeWorker = null;
let shellReady = false;
let shellStatus = null;
let shellError = null;
let preparing = false;
let recovering = false;
let offlineStatus = null;
let offlineBusy = false;

const $ = selector => document.querySelector(selector);
const help = message => { const node = $('#install-help'); if (node) node.textContent = message; };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

function withTimeout(promise, timeoutMs, message, phase = 'operation') {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      const error = new Error(message);
      error.name = 'CivweavePackageTimeoutError';
      error.code = 'CIVWEAVE_PACKAGE_TIMEOUT';
      error.phase = phase;
      reject(error);
    }, timeoutMs);
    Promise.resolve(promise).then(value => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    }, error => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
  });
}

function standalone() {
  return navigator.standalone === true || ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'].some(mode => matchMedia(`(display-mode: ${mode})`).matches);
}

function isIOS() {
  return /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
}

function rootScope(reg) {
  try {
    const scope = new URL(reg.scope);
    return scope.origin === location.origin && scope.pathname === '/';
  } catch {
    return false;
  }
}

function workerMatches(worker) {
  try {
    const url = new URL(worker?.scriptURL || '');
    return url.pathname === '/service-worker-v203.js' &&
      url.searchParams.get('v') === WORKER_BUILD &&
      url.searchParams.get('revision') === WORKER_SCRIPT_REVISION;
  } catch {
    return false;
  }
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (!value) return '';
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

function showShell(status = {}) {
  shellStatus = status;
  const state = $('#package-state');
  const assets = $('#package-assets');
  const mode = $('#local-mode');
  if (state) state.textContent = shellReady ? 'ready' : shellError ? 'failed' : preparing ? 'preparing' : 'not prepared';
  if (assets) {
    const total = Number(status.assetCount || 0);
    const present = Number(status.presentCount || 0);
    assets.textContent = total ? `${present}/${total} shell files` : preparing ? 'checking shell' : 'starts on install';
  }
  if (mode) mode.textContent = 'small shell · optional code-first campus · visuals and models on demand';
}

function showOffline(status = offlineStatus || {}) {
  offlineStatus = status;
  const state = $('#offline-package-state');
  const assets = $('#offline-package-assets');
  const button = $('#download-offline-package');
  const failed = Number(status.failedCount || status.failed?.length || 0);
  const complete = Number(status.downloaded ?? status.completed ?? 0);
  const total = Number(status.total || status.discovered || 0);
  const size = formatBytes(status.bytes);
  if (state) {
    if (status.running || offlineBusy) state.textContent = 'downloading';
    else if (status.ready) state.textContent = 'ready offline';
    else if (status.paused) state.textContent = 'paused';
    else if (failed) state.textContent = `${failed} file${failed === 1 ? '' : 's'} need retry`;
    else state.textContent = complete ? 'partially downloaded' : 'not downloaded';
  }
  if (assets) {
    const count = total ? `${Math.min(complete, total)}/${total} files` : 'not started';
    assets.textContent = size ? `${count} · ${size}` : count;
  }
  if (button) {
    button.disabled = offlineBusy || preparing;
    if (offlineBusy || status.running) button.textContent = total ? `Downloading ${Math.min(complete, total)}/${total}…` : 'Preparing campus file list…';
    else if (status.ready) button.textContent = 'Refresh offline campus';
    else if (status.paused) button.textContent = 'Resume offline campus';
    else if (failed) button.textContent = `Retry ${failed} missing file${failed === 1 ? '' : 's'}`;
    else if (complete) button.textContent = 'Resume offline campus';
    else button.textContent = 'Download offline campus';
  }
}

function guidance() {
  const button = $('#install-app');
  if (!button) return;
  if (standalone()) {
    button.disabled = false;
    button.textContent = `Open Civweave v${VERSION}`;
    help(shellReady ? 'Civweave is installed. Open it now; offline campus files are a separate optional download.' : 'Civweave is installed. Open it now; shell repair only runs if you request it.');
    return;
  }
  if (shellError) {
    button.disabled = false;
    button.textContent = 'Reset app shell and retry';
    help(`App-shell preparation failed: ${shellError.message}. Saved campus, knowledge schools, and model files will be preserved.`);
    return;
  }
  if (preparing) {
    button.disabled = true;
    button.textContent = 'Preparing app shell…';
    help('Preparing only the small installable shell. No campus, model, media, or school download is running.');
    return;
  }
  if (!shellReady) {
    button.disabled = false;
    button.textContent = `Install Civweave v${VERSION}`;
    help('Ready when you are. Nothing large downloads until you choose Install or Download offline campus.');
    return;
  }
  button.disabled = false;
  button.textContent = `Install Civweave v${VERSION}`;
  if (installPrompt) help('The lightweight shell is ready. Install now; the offline campus remains optional and separate.');
  else if (isIOS()) help('The shell is ready. Tap Install Civweave for Safari Add to Home Screen instructions.');
  else help('The shell is ready. Tap Install Civweave, or use your browser menu and choose Install app or Add to Home screen.');
}

function failShell(error) {
  shellReady = false;
  shellError = error instanceof Error ? error : new Error(String(error || 'Unknown app-shell error'));
  showShell({ ...shellStatus, error: shellError.message });
  guidance();
  showOffline();
}

function protectedCache(name) {
  return name === LEGACY_LIBRARY_CACHE || name === LIBRARY_CACHE || PROTECTED_CACHE_PREFIXES.some(prefix => name.startsWith(prefix));
}

async function migrateKnowledgeCache() {
  if (!('caches' in window)) return 0;
  const names = await caches.keys();
  if (!names.includes(LEGACY_LIBRARY_CACHE)) return 0;
  const legacy = await caches.open(LEGACY_LIBRARY_CACHE);
  const target = await caches.open(LIBRARY_CACHE);
  const requests = await legacy.keys();
  let copied = 0;
  for (const request of requests) {
    if (await target.match(request)) continue;
    const response = await legacy.match(request);
    if (response) {
      await target.put(request, response.clone());
      copied += 1;
    }
  }
  if (requests.length) await caches.delete(LEGACY_LIBRARY_CACHE);
  return copied;
}

async function clearAppCaches() {
  if (!('caches' in window)) return;
  await migrateKnowledgeCache();
  const keys = await caches.keys();
  await Promise.allSettled(keys.filter(key => !protectedCache(key) && (
    key.startsWith('civweave-') ||
    key.startsWith('cwext-') ||
    key.startsWith('cwboot-') ||
    key.startsWith('cwimg-')
  )).map(key => caches.delete(key)));
}

async function resetAppShell() {
  recovering = true;
  help('Removing the incomplete app shell while preserving the offline campus, saved knowledge schools, and model files…');
  sessionStorage.removeItem(WATCHDOG_RECOVERY_KEY);
  await migrateKnowledgeCache();
  if ('serviceWorker' in navigator) {
    const regs = await withTimeout(
      navigator.serviceWorker.getRegistrations(),
      REGISTRATION_QUERY_TIMEOUT_MS,
      'Chrome did not return registered app shells.',
      'registration lookup'
    ).catch(() => []);
    await Promise.allSettled(regs.filter(rootScope).map(reg => withTimeout(
      reg.unregister(),
      REGISTRATION_QUERY_TIMEOUT_MS,
      'Chrome did not release the old app shell.',
      'registration cleanup'
    )));
  }
  await clearAppCaches();
  registration = null;
  activeWorker = null;
  await pause(120);
  const next = new URL(location.href);
  next.searchParams.set('shell-reset', Date.now().toString(36));
  location.replace(next.href);
}

async function recoverStalledRegistration(error) {
  const phase = error?.phase || 'service-worker registration';
  if (sessionStorage.getItem(WATCHDOG_RECOVERY_KEY) === '1') {
    throw new Error(`${error?.message || 'Chrome stalled while preparing the app shell.'} Automatic recovery already ran once. Use Reset app shell and retry.`);
  }
  sessionStorage.setItem(WATCHDOG_RECOVERY_KEY, '1');
  recovering = true;
  help(`Chrome stalled during ${phase}. Preserving local data and rebuilding the small app registration once…`);
  await migrateKnowledgeCache();
  const regs = await withTimeout(
    navigator.serviceWorker.getRegistrations(),
    REGISTRATION_QUERY_TIMEOUT_MS,
    'Chrome did not return registrations during recovery.',
    'registration recovery lookup'
  ).catch(() => []);
  await Promise.allSettled(regs.filter(rootScope).map(reg => withTimeout(
    reg.unregister(),
    REGISTRATION_QUERY_TIMEOUT_MS,
    'Chrome did not release a stale registration.',
    'registration recovery cleanup'
  )));
  await clearAppCaches();
  registration = null;
  activeWorker = null;
  await pause(120);
  const next = new URL(location.href);
  next.searchParams.set('registration-recovery', Date.now().toString(36));
  location.replace(next.href);
  const navigation = new Error(`Reloading after stalled ${phase}.`);
  navigation.code = 'CIVWEAVE_RECOVERY_RELOAD';
  navigation.phase = phase;
  throw navigation;
}

function askWorker(worker, type, timeoutMs = 12000) {
  return new Promise(resolve => {
    if (!worker) return resolve(null);
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(null), timeoutMs);
    channel.port1.onmessage = event => {
      clearTimeout(timer);
      resolve(event.data || null);
    };
    worker.postMessage({ type }, [channel.port2]);
  });
}

function streamWorker(worker, type, onPacket, idleTimeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    if (!worker) return reject(new Error('The active app worker is unavailable.'));
    const channel = new MessageChannel();
    let timer = null;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => reject(new Error('The offline-campus download stopped responding. Tap Resume to continue.')), idleTimeoutMs);
    };
    arm();
    channel.port1.onmessage = event => {
      arm();
      const packet = event.data || {};
      onPacket?.(packet);
      if (packet.type === 'CIVWEAVE_OFFLINE_PACKAGE_STATUS' && !packet.running) {
        clearTimeout(timer);
        resolve(packet);
      }
    };
    try {
      worker.postMessage({ type }, [channel.port2]);
    } catch (error) {
      clearTimeout(timer);
      reject(error);
    }
  });
}

async function waitForCurrentWorker(timeoutMs = ACTIVATION_TIMEOUT_MS) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    registration = await withTimeout(
      navigator.serviceWorker.getRegistration('/'),
      REGISTRATION_QUERY_TIMEOUT_MS,
      'Chrome did not return the current service-worker registration.',
      'registration lookup'
    );
    const candidate = registration?.waiting || registration?.installing;
    if (registration?.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    if (candidate?.state === 'installed') candidate.postMessage({ type: 'SKIP_WAITING' });
    if (registration?.active?.state === 'activated' && workerMatches(registration.active)) {
      activeWorker = registration.active;
      return activeWorker;
    }
    const state = candidate?.state || registration?.active?.state || 'registering';
    help(`Preparing the lightweight Civweave shell · ${state}…`);
    if (candidate?.state === 'redundant') throw new Error('The browser rejected the updated app shell.');
    await pause(180);
  }
  const error = new Error('App-shell activation timed out.');
  error.code = 'CIVWEAVE_PACKAGE_TIMEOUT';
  error.phase = 'worker activation';
  throw error;
}

async function confirmShell(worker = activeWorker) {
  const status = await askWorker(worker, 'GET_DEVICE_PACKAGE_STATUS');
  if (!status || status.type !== 'CIVWEAVE_DEVICE_PACKAGE') throw new Error('The app worker did not return shell readiness.');
  if (status.mode !== 'lightweight-shell') throw new Error('The browser activated an outdated full-package worker.');
  if (!status.ready) throw new Error(`${status.missing?.length || 'Some'} required shell files are missing.`);
  shellReady = true;
  shellError = null;
  showShell(status);
  guidance();
  return status;
}

async function refreshOfflineStatus() {
  if (!activeWorker) return null;
  const status = await askWorker(activeWorker, 'GET_OFFLINE_PACKAGE_STATUS');
  if (status?.type === 'CIVWEAVE_OFFLINE_PACKAGE_STATUS') showOffline(status);
  return status;
}

async function prepareShell(options = {}) {
  if (preparing) return;
  preparing = true;
  recovering = false;
  shellReady = false;
  shellError = null;
  showShell({});
  guidance();
  showOffline();
  const updateButton = $('#check-update');
  if (updateButton) {
    updateButton.disabled = true;
    updateButton.textContent = options.manual ? 'Checking release…' : 'Preparing shell…';
  }
  try {
    if (!('serviceWorker' in navigator)) throw new Error('This browser does not support service workers.');
    const migrated = await migrateKnowledgeCache();
    if (migrated) help(`Preserved ${migrated} knowledge-school file${migrated === 1 ? '' : 's'} before updating the app shell…`);
    const existing = await withTimeout(
      navigator.serviceWorker.getRegistration('/'),
      REGISTRATION_QUERY_TIMEOUT_MS,
      'Chrome did not return the existing app registration.',
      'registration lookup'
    );
    const exactActive = existing?.active?.state === 'activated' && workerMatches(existing.active);
    const exactCandidate = [existing?.waiting, existing?.installing].find(workerMatches);
    let worker = null;

    if (exactActive) {
      registration = existing;
      activeWorker = existing.active;
      worker = activeWorker;
      if (options.manual) {
        help('Checking the lightweight app worker for an updated release…');
        await withTimeout(registration.update(), REGISTRATION_TIMEOUT_MS, 'Chrome did not finish checking the app worker.', 'service-worker update');
        worker = await waitForCurrentWorker();
      }
    } else {
      if (exactCandidate) {
        registration = existing;
        exactCandidate.postMessage({ type: 'SKIP_WAITING' });
      } else {
        help('Registering the lightweight Civweave app shell…');
        registration = await withTimeout(
          navigator.serviceWorker.register(WORKER_URL, { scope: '/', updateViaCache: 'none' }),
          REGISTRATION_TIMEOUT_MS,
          'Chrome did not finish registering the Civweave app shell.',
          'service-worker registration'
        );
      }
      worker = await waitForCurrentWorker();
    }

    await withTimeout(
      navigator.serviceWorker.ready,
      REGISTRATION_TIMEOUT_MS,
      'Chrome did not finish activating the Civweave app shell.',
      'service-worker readiness'
    );
    await confirmShell(worker);
    sessionStorage.removeItem(WATCHDOG_RECOVERY_KEY);
    await refreshOfflineStatus();
    if (options.manual) help('The app shell is current. Offline-campus files remain separate and start only when requested.');
  } catch (error) {
    if (error?.code === 'CIVWEAVE_PACKAGE_TIMEOUT') {
      try {
        await recoverStalledRegistration(error);
      } catch (recoveryError) {
        if (recoveryError?.code !== 'CIVWEAVE_RECOVERY_RELOAD') failShell(recoveryError);
      }
    } else if (error?.code !== 'CIVWEAVE_RECOVERY_RELOAD') {
      failShell(error);
    }
  } finally {
    preparing = false;
    if (updateButton) {
      updateButton.disabled = false;
      updateButton.textContent = 'Check release';
    }
    if (!recovering) {
      guidance();
      showOffline();
    }
  }
}

async function offlineStoragePreflight() {
  try {
    const [response, estimate] = await Promise.all([
      fetch(`${OFFLINE_MANIFEST_URL}?preflight=${Date.now()}`, { cache: 'no-store' }),
      navigator.storage?.estimate?.().catch?.(() => null) || null
    ]);
    if (!response?.ok || !estimate?.quota) return true;
    const manifest = await response.json();
    const required = Number(manifest?.preflight?.requiredFreeBytes || 0);
    const available = Math.max(0, Number(estimate.quota || 0) - Number(estimate.usage || 0));
    if (required && available < required) {
      help(`Offline campus not started: about ${formatBytes(required - available)} more browser storage is needed. Civweave can still be used online now.`);
      document.documentElement.dataset.civweaveStorageState = 'insufficient';
      return false;
    }
    document.documentElement.dataset.civweaveStorageState = 'sufficient';
  } catch {}
  return true;
}

async function downloadOfflineCampus() {
  if (offlineBusy || preparing) return;
  if (!shellReady || !activeWorker) {
    await prepareShell({ manual: false });
    if (!shellReady || !activeWorker) return;
  }
  if (!(await offlineStoragePreflight())) return;
  offlineBusy = true;
  showOffline({ ...(offlineStatus || {}), running: true });
  help('Downloading the optional code-first campus. Large visuals, models, and media stay on demand and do not block completion.');
  try {
    const status = await streamWorker(activeWorker, 'DOWNLOAD_OFFLINE_PACKAGE', packet => {
      if (packet.type === 'CIVWEAVE_OFFLINE_PACKAGE_PROGRESS' || packet.type === 'CIVWEAVE_OFFLINE_PACKAGE_STATUS') showOffline(packet);
    });
    showOffline(status);
    if (status.ready) help(`Offline campus ready: ${status.completed}/${status.total} files${status.bytes ? ` · ${formatBytes(status.bytes)}` : ''}. Open Civweave whenever you like.`);
    else if (status.paused) help('Offline campus paused. Everything already saved stays on the device; tap Resume when convenient.');
    else help(`Offline campus stopped with ${status.failedCount || status.failed?.length || 0} required files needing retry. Civweave itself remains usable.`);
  } catch (error) {
    help(`${error.message} Installation and the files already saved are unaffected.`);
    await refreshOfflineStatus();
  } finally {
    offlineBusy = false;
    showOffline();
  }
}

async function installOrOpen() {
  if (shellError) return resetAppShell();
  if (standalone()) {
    location.assign(ENTRY);
    return;
  }
  if (!shellReady) {
    await prepareShell({ manual: true });
    if (!shellReady) return;
  }
  if (installPrompt) {
    const prompt = installPrompt;
    installPrompt = null;
    await prompt.prompt();
    const choice = await prompt.userChoice.catch(() => null);
    if (choice?.outcome === 'accepted') {
      help('Civweave installed. Open it from your device app launcher; this browser tab remains installer-only. Offline files remain separate and optional.');
      const button = $('#install-app');
      if (button) {
        button.disabled = true;
        button.textContent = 'Civweave installed';
      }
    } else guidance();
    return;
  }
  help(isIOS()
    ? 'In Safari, tap Share, then Add to Home Screen. Launch Civweave from the installed icon; offline files are separate.'
    : 'Open the browser menu and choose Install app or Add to Home screen. Then launch Civweave from your device app launcher; offline files are separate.');
}

addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
  guidance();
});
addEventListener('appinstalled', () => {
  installPrompt = null;
  help('Civweave is installed. Open it from your device app launcher; download the offline campus only if you want a local code copy.');
});

$('#install-app')?.addEventListener('click', installOrOpen);
$('#check-update')?.addEventListener('click', () => prepareShell({ manual: true }));
$('#download-offline-package')?.addEventListener('click', downloadOfflineCampus);

showShell({});
showOffline({});
guidance();

globalThis.CivweaveInstallerV130 = Object.freeze({
  version: VERSION,
  prepareShell,
  resetAppShell,
  downloadOfflineCampus,
  get shellReady() { return shellReady; }
});
})();
