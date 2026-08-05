(()=>{
'use strict';

const STATUS_FALLBACK_MS = 8000;
const startedAt = Date.now();
let autoStarted = false;
let observer = null;

const $ = selector => document.querySelector(selector);

function replaceText(node, replacements) {
  if (!node) return;
  const current = node.textContent || '';
  let next = current;
  for (const [pattern, replacement] of replacements) next = next.replace(pattern, replacement);
  if (next !== current) node.textContent = next;
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
  return globalThis.CommonweaveOfflineCampusStatusV210?.last || null;
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

function statusHasSettled() {
  return Boolean(latestStatus()) || Date.now() - startedAt >= STATUS_FALLBACK_MS;
}

function tryAutoStart() {
  applyRequiredCampusLanguage();
  if (autoStarted || campusIsReady() || campusIsRunning() || !statusHasSettled()) return;

  const button = $('#download-offline-package');
  if (!button || button.disabled) return;

  autoStarted = true;
  button.click();
}

function startWatching() {
  observer = new MutationObserver(tryAutoStart);
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['disabled']
  });

  const timer = setInterval(() => {
    tryAutoStart();
    if (autoStarted || campusIsReady()) {
      clearInterval(timer);
      observer?.disconnect();
    }
  }, 250);

  setTimeout(() => clearInterval(timer), 60000);
  tryAutoStart();
}

if (document.readyState === 'loading') addEventListener('DOMContentLoaded', startWatching, { once: true });
else startWatching();

})();
