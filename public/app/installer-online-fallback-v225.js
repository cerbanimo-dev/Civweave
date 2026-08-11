(() => {
'use strict';

const REVISION = 'installer-online-fallback-v225-installed-shell-repair-v300';
const REPAIR_TIMEOUT_MS = 20000;
const stateNode = document.getElementById('package-state');
const assetsNode = document.getElementById('package-assets');
const installButton = document.getElementById('install-app');
const updateButton = document.getElementById('check-update');
const helpNode = document.getElementById('install-help');
let repairing = false;

function releaseVersion() {
  const visible = document.querySelector('.version')?.textContent || '';
  const match = visible.match(/\d+\.\d+\.\d+/);
  return match?.[0] || '1.0.12';
}

function installedDisplay() {
  return navigator.standalone === true || ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'].some(mode => matchMedia(`(display-mode: ${mode})`).matches);
}

function installedEntryUrl() {
  const url = new URL('/app/installed-entry-v146.html', location.origin);
  url.searchParams.set('installed', '1');
  url.searchParams.set('system', 'civweave');
  url.searchParams.set('source', 'installer-open');
  return url.href;
}

function campusUrl() {
  const url = new URL('/app/working-campus-v156.html', location.origin);
  url.searchParams.set('installed', '1');
  url.searchParams.set('version', releaseVersion());
  url.searchParams.set('launch', 'online');
  return url.href;
}

function failed() {
  return /^(?:failed|needs? repair|repair required|error)\b/i.test(String(stateNode?.textContent || '').trim());
}

function openInstalled() {
  location.assign(installedEntryUrl());
}

function openCampus() {
  location.assign(campusUrl());
}

async function currentWorker() {
  try {
    const registration = await navigator.serviceWorker?.getRegistration?.('/');
    return registration?.active || navigator.serviceWorker?.controller || registration?.waiting || registration?.installing || null;
  } catch {
    return navigator.serviceWorker?.controller || null;
  }
}

async function requestWorker(type, timeoutMs) {
  const worker = await currentWorker();
  if (!worker) throw new Error('The installed Civweave worker is unavailable.');
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => {
      try { channel.port1.close(); } catch {}
      reject(new Error(`${type === 'REPAIR_DEVICE_PACKAGE' ? 'Shell repair' : 'Worker request'} stopped responding.`));
    }, timeoutMs);
    channel.port1.onmessage = event => {
      clearTimeout(timer);
      try { channel.port1.close(); } catch {}
      resolve(event.data || null);
    };
    try {
      worker.postMessage({ type }, [channel.port2]);
    } catch (error) {
      clearTimeout(timer);
      reject(error);
    }
  });
}

async function pauseCampusBestEffort() {
  try { await requestWorker('PAUSE_OFFLINE_PACKAGE', 1800); } catch {}
}

async function requestRepair() {
  return requestWorker('REPAIR_DEVICE_PACKAGE', REPAIR_TIMEOUT_MS);
}

async function hardResetFallback(error) {
  const reset = globalThis.CivweaveInstallerV130?.resetAppShell;
  if (typeof reset !== 'function') return false;
  if (helpNode) helpNode.textContent = `Verified repair did not answer (${error?.message || error}). Rebuilding the small app registration once while preserving campus, models, media, and schools…`;
  await reset();
  return true;
}

async function repairInstalledShell() {
  if (repairing) return;
  repairing = true;
  if (installButton) {
    installButton.disabled = true;
    installButton.textContent = 'Repairing shell…';
  }
  if (updateButton) {
    updateButton.disabled = true;
    updateButton.textContent = 'Repairing shell…';
  }
  if (helpNode) helpNode.textContent = 'Pausing offline transfer, then rebuilding only the small verified Civweave shell. Campus, model, media, and knowledge-school storage stay untouched.';
  try {
    await pauseCampusBestEffort();
    const packet = await requestRepair();
    if (packet?.type !== 'CIVWEAVE_DEVICE_PACKAGE_REPAIR') throw new Error('The app worker did not acknowledge shell repair.');
    if (!packet.ready) {
      const first = Array.isArray(packet.failures) && packet.failures[0];
      throw new Error(first?.message || packet.error || 'The verified shell is still incomplete.');
    }
    if (stateNode) stateNode.textContent = 'ready';
    if (assetsNode && packet.assetCount) assetsNode.textContent = `${packet.presentCount || packet.assetCount}/${packet.assetCount} shell files`;
    if (helpNode) helpNode.textContent = 'Civweave shell repaired. Opening the installed app.';
    if (installButton) {
      installButton.disabled = false;
      installButton.textContent = 'Open Civweave';
    }
    if (updateButton) {
      updateButton.disabled = false;
      updateButton.textContent = 'Check release';
    }
    openInstalled();
  } catch (error) {
    if (await hardResetFallback(error).catch(() => false)) return;
    if (stateNode) stateNode.textContent = 'needs repair';
    if (helpNode) helpNode.textContent = `Shell repair could not complete: ${error?.message || error}. Saved campus, model, media, and school storage was preserved.`;
    if (installButton) {
      installButton.disabled = false;
      installButton.textContent = 'Repair shell';
    }
    if (updateButton) {
      updateButton.disabled = false;
      updateButton.textContent = 'Repair shell';
    }
  } finally {
    repairing = false;
  }
}

function ensureOnlineButton() {
  const actions = installButton?.closest('.gateway-actions');
  if (!actions || document.getElementById('open-online-campus-v225')) return;
  const button = document.createElement('button');
  button.id = 'open-online-campus-v225';
  button.className = 'secondary';
  button.type = 'button';
  button.textContent = 'Open online campus';
  button.addEventListener('click', openCampus);
  actions.append(button);
}

function apply() {
  ensureOnlineButton();
  if (repairing) return;
  if (installedDisplay() && installButton && !failed()) {
    installButton.disabled = false;
    installButton.dataset.civweaveInstalledLaunch = 'installed-pwa-launch-v282';
  }
  if (!failed()) return;
  if (installButton) {
    installButton.disabled = false;
    installButton.textContent = installedDisplay() ? 'Repair shell' : 'Open Civweave online';
    installButton.dataset.civweaveOnlineFallback = REVISION;
  }
  if (updateButton) updateButton.textContent = 'Repair shell';
  if (helpNode && !helpNode.dataset.civweaveOnlineFallback) {
    helpNode.dataset.civweaveOnlineFallback = REVISION;
    helpNode.textContent = `${helpNode.textContent} Online launch is still available; verified shell repair can continue separately.`;
  }
}

document.addEventListener('click', event => {
  const target = event.target instanceof Element ? event.target.closest('#install-app') : null;
  if (!target) return;
  if (installedDisplay()) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (failed()) repairInstalledShell();
    else openInstalled();
    return;
  }
  if (!failed()) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  openCampus();
}, true);

updateButton?.addEventListener('click', event => {
  if (!failed()) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  repairInstalledShell();
}, true);

const observer = new MutationObserver(apply);
if (stateNode) observer.observe(stateNode, { childList: true, characterData: true, subtree: true });
addEventListener('pagehide', () => observer.disconnect(), { once: true });
apply();

globalThis.CivweaveInstallerOnlineFallbackV225 = Object.freeze({
  revision: REVISION,
  installedEntryUrl,
  campusUrl,
  repairInstalledShell,
  repairMessage: 'REPAIR_DEVICE_PACKAGE',
  repairTimeoutMs: REPAIR_TIMEOUT_MS,
  storagePolicy: 'preserve-campus-model-media-school-storage'
});

})();
