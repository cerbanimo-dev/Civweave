(() => {
'use strict';

const REVISION = 'installer-online-fallback-v225';
const stateNode = document.getElementById('package-state');
const installButton = document.getElementById('install-app');
const updateButton = document.getElementById('check-update');
const helpNode = document.getElementById('install-help');

function releaseVersion() {
  const visible = document.querySelector('.version')?.textContent || '';
  const match = visible.match(/\d+\.\d+\.\d+/);
  return match?.[0] || '1.0.12';
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
  if (!failed()) return;
  if (installButton) {
    installButton.disabled = false;
    installButton.textContent = 'Open Commonweave online';
    installButton.dataset.commonweaveOnlineFallback = REVISION;
  }
  if (updateButton) updateButton.textContent = 'Repair shell';
  if (helpNode && !helpNode.dataset.commonweaveOnlineFallback) {
    helpNode.dataset.commonweaveOnlineFallback = REVISION;
    helpNode.textContent = `${helpNode.textContent} Online launch is still available; offline shell repair can continue separately.`;
  }
}

document.addEventListener('click', event => {
  const target = event.target instanceof Element ? event.target.closest('#install-app') : null;
  if (!target || !failed()) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  openCampus();
}, true);

const observer = new MutationObserver(apply);
if (stateNode) observer.observe(stateNode, { childList: true, characterData: true, subtree: true });
addEventListener('pagehide', () => observer.disconnect(), { once: true });
apply();

globalThis.CommonweaveInstallerOnlineFallbackV225 = Object.freeze({
  revision: REVISION,
  campusUrl
});

})();
