const $ = (selector) => document.querySelector(selector);

const isJapanese = document.documentElement.lang.toLowerCase().startsWith('ja');
const locale = isJapanese ? 'ja-JP' : undefined;
const year = $('#year');
if (year) year.textContent = String(new Date().getFullYear());
const countNode = $('#commitCount');
const dateNode = $('#initialDate');
const stateNode = $('#sourceState');

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return isJapanese ? '公開' : 'public';
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: isJapanese ? 'numeric' : 'short', day: 'numeric' }).format(date);
}
function formatCount(value) { return Number(value).toLocaleString(locale); }
function renderCount(value) {
  const target = Number(value);
  if (!countNode || !Number.isSafeInteger(target) || target < 1) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) { countNode.textContent = formatCount(target); return; }
  const duration = 900, started = performance.now();
  const frame = (now) => {
    const progress = Math.min(1, (now - started) / duration), eased = 1 - Math.pow(1 - progress, 3);
    countNode.textContent = formatCount(Math.max(1, Math.round(target * eased)));
    if (progress < 1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
async function loadHistory() {
  try {
    const response = await fetch(`/history.json?ts=${Date.now()}`, { cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`History HTTP ${response.status}`);
    const history = await response.json();
    renderCount(history.commitCount);
    if (dateNode) dateNode.textContent = formatDate(history.initialCommitDate);
    if (stateNode) stateNode.textContent = isJapanese ? '公開中' : 'live';
  } catch (error) {
    console.warn('Civweave history counter unavailable', error);
    if (countNode) countNode.textContent = isJapanese ? '公開' : 'public';
    if (dateNode) dateNode.textContent = isJapanese ? 'ソース' : 'source';
    if (stateNode) stateNode.textContent = isJapanese ? '閲覧可能' : 'reachable';
  }
}
function setSpriteFrame(node, index) {
  const frame = Math.max(0, Math.min(19, Number(index) || 0));
  node.style.setProperty('--sprite-col', String(frame % 5));
  node.style.setProperty('--sprite-row', String(Math.floor(frame / 5)));
}
function animateMaterializedGuides() {
  const avatars = Array.from(document.querySelectorAll('.cast .guide-avatar-frame[data-guide-avatar-index]'));
  if (!avatars.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const idleFrames = [0, 4, 1, 17];
  avatars.forEach((avatar, index) => {
    let step = index % idleFrames.length;
    const tick = () => { step = (step + 1) % idleFrames.length; setSpriteFrame(avatar, idleFrames[step]); };
    const timer = window.setInterval(tick, 3200 + index * 170);
    const card = avatar.closest('article');
    card?.addEventListener('mouseenter', () => setSpriteFrame(avatar, 17));
    card?.addEventListener('mouseleave', tick);
    card?.addEventListener('focusin', () => setSpriteFrame(avatar, 16));
    card?.addEventListener('focusout', tick);
    window.addEventListener('pagehide', () => window.clearInterval(timer), { once: true });
  });
}

loadHistory();
animateMaterializedGuides();
