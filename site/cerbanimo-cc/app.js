const $ = (selector) => document.querySelector(selector);

const year = $('#year');
if (year) year.textContent = String(new Date().getFullYear());

const countNode = $('#commitCount');
const dateNode = $('#initialDate');
const stateNode = $('#sourceState');

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'public';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date);
}

function renderCount(value) {
  const target = Number(value);
  if (!countNode || !Number.isSafeInteger(target) || target < 1) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    countNode.textContent = target.toLocaleString();
    return;
  }
  const duration = 900;
  const started = performance.now();
  const frame = (now) => {
    const progress = Math.min(1, (now - started) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    countNode.textContent = Math.max(1, Math.round(target * eased)).toLocaleString();
    if (progress < 1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

async function loadHistory() {
  try {
    const response = await fetch(`/history.json?ts=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) throw new Error(`History HTTP ${response.status}`);
    const history = await response.json();
    renderCount(history.commitCount);
    if (dateNode) dateNode.textContent = formatDate(history.initialCommitDate);
    if (stateNode) stateNode.textContent = 'live';
  } catch (error) {
    console.warn('Civweave history counter unavailable', error);
    if (countNode) countNode.textContent = 'public';
    if (dateNode) dateNode.textContent = 'source';
    if (stateNode) stateNode.textContent = 'reachable';
  }
}

loadHistory();
