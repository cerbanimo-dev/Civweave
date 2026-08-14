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

const GUIDE_SPRITES = Object.freeze([
  { name: 'Weaveling', sheet: '/assets/weaveling.png' },
  { name: 'Moss', sheet: '/assets/moss.png' },
  { name: 'Kamiya', sheet: '/assets/kamiya.png' },
  { name: 'Rook', sheet: '/assets/rook.png' },
  { name: 'Merlin', sheet: '/assets/merlin.png' }
]);

const REALM_POSTERS = Object.freeze({
  'Living School': ['/assets/living-school-poster.webp', 'Living School poster art'],
  Cerbanimo: ['/assets/cerbanimo-poster.webp', 'Cerbanimo poster art'],
  FellowFare: ['/assets/fellowfare-poster.webp', 'FellowFare poster art'],
  Anarchadia: ['/assets/anarchadia-poster.webp', 'Anarchadia poster art']
});

function installGuideAvatarStyles() {
  if ($('#cerbanimoGuideAvatarStyles')) return;
  const style = document.createElement('style');
  style.id = 'cerbanimoGuideAvatarStyles';
  style.textContent = `
    .cast .guide-avatar-shell {
      width: 82px;
      height: 82px;
      margin-bottom: 20px;
      padding: 3px;
      border: 1px solid color-mix(in srgb, var(--accent) 72%, white);
      border-radius: 22px;
      background: linear-gradient(145deg, color-mix(in srgb, var(--accent) 18%, #190b2f), rgba(7,3,14,.94));
      box-shadow: inset 0 0 24px color-mix(in srgb, var(--accent) 12%, transparent), 0 9px 28px rgba(0,0,0,.25);
      overflow: hidden;
    }
    .cast .guide-avatar-frame {
      display: block;
      width: 100%;
      height: 100%;
      border-radius: 18px;
      background-image: var(--guide-sheet);
      background-size: 500% 400%;
      background-position: calc(var(--sprite-col) * 25%) calc(var(--sprite-row) * 33.333333%);
      background-repeat: no-repeat;
      background-color: #05030c;
      filter: saturate(.98) brightness(1.02);
      transition: background-position 140ms steps(1), transform 180ms ease, filter 180ms ease;
    }
    .cast article:hover .guide-avatar-frame,
    .cast article:focus-within .guide-avatar-frame {
      transform: scale(1.045);
      filter: saturate(1.08) brightness(1.06);
    }
    @media (prefers-reduced-motion: reduce) {
      .cast .guide-avatar-frame { transition: none; }
    }
  `;
  document.head.append(style);
}

function setSpriteFrame(node, index) {
  const frame = Math.max(0, Math.min(19, Number(index) || 0));
  node.style.setProperty('--sprite-col', String(frame % 5));
  node.style.setProperty('--sprite-row', String(Math.floor(frame / 5)));
}

function installGuideAvatars() {
  const cards = Array.from(document.querySelectorAll('.cast article'));
  if (!cards.length) return;
  installGuideAvatarStyles();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const idleFrames = [0, 4, 1, 17];

  cards.forEach((card, index) => {
    const guide = GUIDE_SPRITES[index];
    if (!guide) return;
    const placeholder = card.querySelector('.sigil');
    if (!placeholder) return;

    const shell = document.createElement('div');
    shell.className = 'guide-avatar-shell';
    shell.setAttribute('aria-hidden', 'true');
    const avatar = document.createElement('span');
    avatar.className = 'guide-avatar-frame';
    avatar.style.setProperty('--guide-sheet', `url("${guide.sheet}")`);
    setSpriteFrame(avatar, 0);
    shell.append(avatar);
    placeholder.replaceWith(shell);

    if (reduced) return;
    let step = index % idleFrames.length;
    const tick = () => {
      step = (step + 1) % idleFrames.length;
      setSpriteFrame(avatar, idleFrames[step]);
    };
    const timer = window.setInterval(tick, 3200 + index * 170);
    card.addEventListener('mouseenter', () => setSpriteFrame(avatar, 17));
    card.addEventListener('mouseleave', tick);
    card.addEventListener('focusin', () => setSpriteFrame(avatar, 16));
    card.addEventListener('focusout', tick);
    window.addEventListener('pagehide', () => window.clearInterval(timer), { once: true });
  });
}

function installRealmPosters() {
  for (const realm of document.querySelectorAll('.realm')) {
    const title = realm.querySelector('h3')?.textContent?.trim();
    const poster = REALM_POSTERS[title];
    const image = realm.querySelector('img');
    if (!poster || !image) continue;
    image.src = poster[0];
    image.alt = poster[1];
    image.loading = 'lazy';
    image.decoding = 'async';
  }
}

loadHistory();
installGuideAvatars();
installRealmPosters();
