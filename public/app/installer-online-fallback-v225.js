(() => {
'use strict';

const REVISION = 'installer-online-fallback-v225-installed-launch-v282';
const stateNode = document.getElementById('package-state');
const installButton = document.getElementById('install-app');
const updateButton = document.getElementById('check-update');
const helpNode = document.getElementById('install-help');

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
  return String(stateNode?.textContent || '').trim().toLowerCase() === 'failed';
}

function openInstalled() {
  location.assign(installedEntryUrl());
}

function openCampus() {
  location.assign(campusUrl());
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
  if (installedDisplay() && installButton && !failed()) {
    installButton.disabled = false;
    installButton.dataset.civweaveInstalledLaunch = 'installed-pwa-launch-v282';
  }
  if (!failed()) return;
  if (installButton) {
    installButton.disabled = false;
    installButton.textContent = installedDisplay() ? 'Open Civweave' : 'Open Civweave online';
    installButton.dataset.civweaveOnlineFallback = REVISION;
  }
  if (updateButton) updateButton.textContent = 'Repair shell';
  if (helpNode && !helpNode.dataset.civweaveOnlineFallback) {
    helpNode.dataset.civweaveOnlineFallback = REVISION;
    helpNode.textContent = `${helpNode.textContent} Online launch is still available; offline shell repair can continue separately.`;
  }
}

document.addEventListener('click', event => {
  const target = event.target instanceof Element ? event.target.closest('#install-app') : null;
  if (!target) return;
  if (installedDisplay()) {
    event.preventDefault();
    event.stopImmediatePropagation();
    openInstalled();
    return;
  }
  if (!failed()) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  openCampus();
}, true);

const observer = new MutationObserver(apply);
if (stateNode) observer.observe(stateNode, { childList: true, characterData: true, subtree: true });
addEventListener('pagehide', () => observer.disconnect(), { once: true });
apply();

globalThis.CivweaveInstallerOnlineFallbackV225 = Object.freeze({
  revision: REVISION,
  installedEntryUrl,
  campusUrl
});

})();
