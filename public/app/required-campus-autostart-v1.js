(()=>{
'use strict';

const STATUS_FALLBACK_MS = 8000;
const INSTALLED_KEY = 'civweave.pwa.install-accepted.v1';
const startedAt = Date.now();
let autoStarted = false;
let timer = 0;

const $ = selector => document.querySelector(selector);

function replaceText(node, replacements) {
  if (!node) return;
  const current = node.textContent || '';
  let next = current;
  for (const [pattern, replacement] of replacements) next = next.replace(pattern, replacement);
  if (next !== current) node.textContent = next;
}

function installWaitingStyle() {
  if (document.getElementById('cw-required-campus-wait-style-v238')) return;
  const style = document.createElement('style');
  style.id = 'cw-required-campus-wait-style-v238';
  style.textContent = `
#install-app.cw-campus-waiting{display:inline-flex;align-items:center;justify-content:center;gap:8px}
#install-app.cw-campus-waiting:before{content:"";width:14px;height:14px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:cw-campus-wait-spin .7s linear infinite}
@keyframes cw-campus-wait-spin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){#install-app.cw-campus-waiting:before{animation-duration:1.8s}}
`;
  document.head?.append(style);
}

function installAssetLockboardLink() {
  if (document.querySelector('[data-cw-asset-lockboard-link]')) return;
  const actions = [...document.querySelectorAll('.status-card .card-actions')].at(-1);
  if (!actions) return;
  const link = document.createElement('a');
  // Deliberately assembled at runtime so the required-campus dependency crawler does not
  // treat the lockboard catalog and its every-image inventory as required offline cargo.
  link.href = ['/app', 'asset-lockboard-v239.html'].join('/');
  link.textContent = 'Visual asset lockboard';
  link.dataset.cwAssetLockboardLink = 'v239';
  actions.append(link);
}

function applyRequiredCampusLanguage() {
  replaceText($('#install-help'), [
    [/the optional offline campus can be downloaded or refreshed separately\./gi, 'The required campus downloads automatically and can be refreshed here.'],
    [/download the optional offline campus whenever you want the full local copy\./gi, 'The required campus download starts automatically and resumes here if interrupted.'],
    [/the optional offline campus can continue downloading independently\./gi, 'The required campus continues downloading independently and resumes if interrupted.'],
    [/the optional offline campus is separate\./gi, 'The required campus downloads separately and resumes automatically.'],
    [/download the offline campus whenever useful\./gi, 'The required campus download starts automatically once the shell is ready.'],
    [/downloading the optional campus pack\./gi, 'Downloading the required campus.'],
    [/optional campus files/gi, 'campus files'],
    [/optional offline campus/gi, 'required offline campus'],
    [/optional campus pack/gi, 'required campus download']
  ]);

  const mode = $('#local-mode');
  if (mode && /optional resumable campus/i.test(mode.textContent || '')) {
    mode.textContent = 'small shell · required resumable campus · separate optional model and school storage';
  }
}

function latestStatus() {
  return globalThis.CivweaveOfflineCampusStatusV210?.last || null;
}

function campusIsReady() {
  const status = latestStatus();
  if (status?.ready) return true;
  return /^ready offline\b/i.test($('#offline-package-state')?.textContent || '');
}

function campusIsRunning() {
  const status = latestStatus();
  if (status?.running) return true;
  return /^downloading\b/i.test($('#offline-package-state')?.textContent || '');
}

function installAccepted() {
  const standalone = navigator.standalone === true || ['standalone','fullscreen','minimal-ui','window-controls-overlay'].some(mode => matchMedia(`(display-mode: ${mode})`).matches);
  if (standalone) return true;
  try { return localStorage.getItem(INSTALLED_KEY) === '1'; } catch { return false; }
}

function renderInstallWait() {
  const button = $('#install-app');
  if (!button) return;
  const ready = campusIsReady();
  if (installAccepted() && !ready) {
    button.disabled = true;
    button.classList.add('cw-campus-waiting');
    button.textContent = 'Waiting for campus files…';
    delete button.dataset.campusLaunchReady;
    return;
  }
  button.classList.remove('cw-campus-waiting');
}

function statusHasSettled() {
  return Boolean(latestStatus()) || Date.now() - startedAt >= STATUS_FALLBACK_MS;
}

function tryAutoStart() {
  applyRequiredCampusLanguage();
  renderInstallWait();
  if (autoStarted || campusIsReady() || campusIsRunning() || !statusHasSettled()) return;

  const button = $('#download-offline-package');
  if (!button || button.disabled) return;

  autoStarted = true;
  button.click();
}

function stopTimer() {
  if (!timer) return;
  clearInterval(timer);
  timer = 0;
}

function onStatus() {
  tryAutoStart();
  if (autoStarted || campusIsReady()) stopTimer();
}

function startWatching() {
  installWaitingStyle();
  installAssetLockboardLink();
  addEventListener('civweave:offline-campus-status', onStatus);
  navigator.serviceWorker?.addEventListener?.('controllerchange', onStatus);
  addEventListener('appinstalled', onStatus);

  timer = setInterval(onStatus, 500);
  setTimeout(stopTimer, 60000);
  onStatus();
}

function destroy() {
  stopTimer();
  removeEventListener('civweave:offline-campus-status', onStatus);
  navigator.serviceWorker?.removeEventListener?.('controllerchange', onStatus);
  removeEventListener('appinstalled', onStatus);
}

addEventListener('pagehide', destroy, { once: true });
if (document.readyState === 'loading') addEventListener('DOMContentLoaded', startWatching, { once: true });
else startWatching();

})();
