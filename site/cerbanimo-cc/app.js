const $ = (selector) => document.querySelector(selector);

const MOBILE_VIEWPORT_FIX = '2026-08-20-v4';

function resetHorizontalScroll() {
  if (window.scrollX !== 0) window.scrollTo(0, window.scrollY);
}

function installViewportContainment() {
  document.documentElement.dataset.mobileViewportFix = MOBILE_VIEWPORT_FIX;
  const style = document.createElement('style');
  style.dataset.civweaveViewportGuard = MOBILE_VIEWPORT_FIX;
  style.textContent = `
    html,
    body {
      width: 100%;
      max-width: 100vw;
      overflow-x: hidden;
    }
    @supports (overflow: clip) {
      html,
      body { overflow-x: clip; }
    }
    body > * {
      max-width: 100vw;
    }
    .lari-section {
      overflow-x: hidden;
    }
    @supports (overflow: clip) {
      .lari-section { overflow-x: clip; }
    }
    @media (max-width: 720px) {
      .shell {
        width: auto !important;
        max-width: none !important;
        margin-left: 12px !important;
        margin-right: 12px !important;
      }
      .nav-wrap,
      .hero,
      .stats,
      .section,
      .closing,
      footer,
      .story-grid,
      .lari-hero,
      .realms,
      .economy,
      .guildkeepers,
      .press,
      .cast,
      .duties {
        min-width: 0 !important;
        max-width: 100% !important;
      }
      .hero,
      .story-grid,
      .lari-hero,
      .realms,
      .economy,
      .guildkeepers,
      .press,
      .cast,
      .duties {
        grid-template-columns: minmax(0, 1fr) !important;
      }
      .hero > *,
      .stats > *,
      .story-grid > *,
      .lari-hero > *,
      .realms > *,
      .economy > *,
      .guildkeepers > *,
      .press > *,
      .cast > *,
      .duties > * {
        min-width: 0 !important;
        max-width: 100% !important;
      }
      .hero-copy,
      .hero-art,
      .hero h1,
      .hero h1 span,
      .eyebrow,
      .lede,
      .intro,
      .actions {
        width: 100%;
        max-width: 100% !important;
      }
      .hero h1 {
        font-size: clamp(44px, 13.5vw, 60px) !important;
        overflow-wrap: normal;
        word-break: normal;
      }
      .hero h1 span {
        overflow-wrap: normal;
        word-break: normal;
      }
      .btn {
        max-width: 100%;
      }
      .portal {
        width: min(100%, 360px) !important;
        max-width: 100% !important;
      }
      .portal-note {
        right: 0 !important;
        left: auto !important;
        width: min(320px, calc(100% - 16px)) !important;
        max-width: calc(100% - 16px) !important;
      }
      .lari-section::before {
        left: 0 !important;
        right: 0 !important;
        width: 100% !important;
      }
      .lari-cutout {
        top: 0 !important;
        bottom: auto !important;
        transform: none !important;
      }
    }
  `;
  document.head.append(style);

  requestAnimationFrame(resetHorizontalScroll);
  window.setTimeout(resetHorizontalScroll, 80);
  window.addEventListener('pageshow', resetHorizontalScroll);
  window.addEventListener('resize', resetHorizontalScroll, { passive: true });
}

installViewportContainment();

const isJapanese = document.documentElement.lang.toLowerCase().startsWith('ja');
const locale = isJapanese ? 'ja-JP' : undefined;
const year = $('#year');
if (year) year.textContent = String(new Date().getFullYear());
const countNode = $('#commitCount');
const dateNode = $('#initialDate');
const stateNode = $('#sourceState');

const EXPLAINER_DISCLOSURES = {
  story: { en: 'Explore the story', ja: '物語を詳しく見る' },
  lari: { en: 'Meet Lari', ja: 'ラリについて詳しく見る' },
  realms: { en: 'Explore the realms', ja: '各領域を詳しく見る' },
  economy: { en: 'See how value moves', ja: '価値の流れを詳しく見る' },
  guildkeepers: { en: 'Explore Guildkeeping', ja: 'ギルドキーパーについて詳しく見る' },
  press: { en: 'Read the plain-language version', ja: '平易な説明を読む' },
};

function installExplainerDisclosures() {
  const style = document.createElement('style');
  style.dataset.civweaveExplainerDisclosures = '2026-08-22-v1';
  style.textContent = `
    .section.section-collapsible {
      padding-block: clamp(46px, 6.5vw, 78px);
      border-top: 1px solid rgba(255,255,255,.07);
    }
    .section.section-collapsible > .intro {
      margin-bottom: 22px;
      max-width: 900px;
    }
    .section-details {
      margin: 0;
    }
    .section-details > summary {
      width: min(100%, 440px);
      min-height: 52px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 12px 16px 12px 20px;
      border: 1px solid rgba(255,255,255,.17);
      border-radius: 999px;
      color: #f8f5ff;
      background: linear-gradient(110deg, rgba(255,47,207,.09), rgba(37,217,255,.07));
      box-shadow: inset 0 1px 0 rgba(255,255,255,.06);
      cursor: pointer;
      font-size: 14px;
      font-weight: 800;
      letter-spacing: .01em;
      list-style: none;
      user-select: none;
      transition: border-color .18s ease, background .18s ease, transform .18s ease;
    }
    .section-details > summary::-webkit-details-marker {
      display: none;
    }
    .section-details > summary:hover,
    .section-details > summary:focus-visible {
      border-color: rgba(255,255,255,.35);
      background: linear-gradient(110deg, rgba(255,47,207,.15), rgba(37,217,255,.12));
      transform: translateY(-1px);
      outline: none;
    }
    .section-details-icon {
      width: 28px;
      height: 28px;
      flex: 0 0 28px;
      display: grid;
      place-items: center;
      border: 1px solid rgba(255,255,255,.14);
      border-radius: 50%;
      color: var(--cyan);
      background: rgba(255,255,255,.05);
      font-size: 20px;
      font-weight: 400;
      line-height: 1;
      transition: transform .2s ease;
    }
    .section-details[open] > summary .section-details-icon {
      transform: rotate(45deg);
    }
    .section-details-body {
      padding-top: 30px;
      animation: explainerReveal .2s ease-out;
    }
    .section-details-body > :first-child {
      margin-top: 0;
    }
    @keyframes explainerReveal {
      from { opacity: 0; transform: translateY(-6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @media (max-width: 720px) {
      .section.section-collapsible {
        padding-block: 42px;
      }
      .section.section-collapsible h2 {
        margin-bottom: 16px;
      }
      .section.section-collapsible > .intro {
        margin-bottom: 18px;
      }
      .section-details > summary {
        width: 100%;
      }
      .section-details-body {
        padding-top: 22px;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .section-details-body {
        animation: none;
      }
    }
  `;
  document.head.append(style);

  Object.entries(EXPLAINER_DISCLOSURES).forEach(([id, labels]) => {
    const section = document.getElementById(id);
    if (!section || section.dataset.collapsibleReady === 'true') return;

    const intro = Array.from(section.children).find((node) => node.classList?.contains('intro'));
    if (!intro) return;

    const details = document.createElement('details');
    details.className = 'section-details';

    const summary = document.createElement('summary');
    const label = document.createElement('span');
    label.textContent = isJapanese ? labels.ja : labels.en;
    const icon = document.createElement('span');
    icon.className = 'section-details-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '+';
    summary.append(label, icon);

    const body = document.createElement('div');
    body.className = 'section-details-body';

    let sibling = intro.nextElementSibling;
    while (sibling) {
      const next = sibling.nextElementSibling;
      body.append(sibling);
      sibling = next;
    }

    details.append(summary, body);
    section.append(details);
    section.classList.add('section-collapsible');
    section.dataset.collapsibleReady = 'true';
  });

  const openHashSection = () => {
    const id = decodeURIComponent(window.location.hash.replace(/^#/, ''));
    if (!id) return;
    const section = document.getElementById(id);
    if (!section?.classList.contains('section-collapsible')) return;
    const details = section.querySelector(':scope > .section-details');
    if (details) details.open = true;
  };

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    const id = decodeURIComponent(link.getAttribute('href').slice(1));
    const section = document.getElementById(id);
    if (!section?.classList.contains('section-collapsible')) return;
    const details = section.querySelector(':scope > .section-details');
    if (details) details.open = true;
  });

  openHashSection();
  window.addEventListener('hashchange', openHashSection);
}

installExplainerDisclosures();

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
