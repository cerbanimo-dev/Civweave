(() => {
'use strict';

const REVISION = 'host-node-installer-lobby-v2-local-federated-autodetect';
const HOST_ENDPOINT_KEY = 'federation-finder.physical-node-endpoint';
const HOST_SELECTION_KEY = 'civweave.host-node.selection.v1';
const STEWARD_KEY = 'civweave.host-steward.v1';
const STATUS_ENDPOINT = '/api/host-node-status';
const FEDERATION_HEALTH_ENDPOINT = '/api/federation/health';
const FEDERATION_PROFILE_ENDPOINT = '/.well-known/civweave';
const REFRESH_MS = 30_000;
let latestStatus = null;
let activeHost = '';
let localFederated = false;
let refreshTimer = 0;

function queryHost() {
  const raw = new URLSearchParams(location.search).get('host');
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
    return url.origin;
  } catch {
    return '';
  }
}

function normalizedHost() {
  return activeHost || queryHost();
}

function selectedOrigin() {
  try { return new URL(localStorage.getItem(HOST_ENDPOINT_KEY) || '').origin; }
  catch { return ''; }
}

function isLocalAddress(origin = location.origin) {
  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '::1' || hostname === '[::1]' || hostname === '0.0.0.0') return true;
    if (/^127(?:\.\d{1,3}){3}$/.test(hostname)) return true;
    if (/^10(?:\.\d{1,3}){3}$/.test(hostname)) return true;
    if (/^192\.168(?:\.\d{1,3}){2}$/.test(hostname)) return true;
    const match = hostname.match(/^172\.(\d{1,3})\./);
    return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
  } catch {
    return false;
  }
}

function stewardBrowser() {
  if (!localFederated) return false;
  if (isLocalAddress()) return true;
  if (new URLSearchParams(location.search).get('host_setup') === '1') return true;
  try { return localStorage.getItem(STEWARD_KEY) === '1'; }
  catch { return false; }
}

function markStewardBrowser() {
  if (!stewardBrowser()) return;
  try { localStorage.setItem(STEWARD_KEY, '1'); } catch {}
}

function el(id) { return document.getElementById(id); }
function numberText(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number).toLocaleString() : '—';
}

async function readJson(url) {
  const response = await fetch(url, { cache: 'no-store', headers: { accept: 'application/json' } });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function discoverSameOriginFederatedHost() {
  try {
    const { response, payload } = await readJson(FEDERATION_HEALTH_ENDPOINT);
    if (!response.ok || payload?.ok !== true || !payload?.nodeId) return false;
    activeHost = location.origin;
    localFederated = true;
    return true;
  } catch {
    return false;
  }
}

function installStyles() {
  if (document.getElementById('cw-host-node-lobby-style-v1')) return;
  const style = document.createElement('style');
  style.id = 'cw-host-node-lobby-style-v1';
  style.textContent = `
    .cw-host-node-lobby{position:relative;overflow:hidden;margin:20px 0;padding:22px;border:1px solid #9fdfff55;border-radius:24px;background:linear-gradient(145deg,#071d2ae8,#211638e8 52%,#2b1f18e8);box-shadow:0 22px 56px #0007,inset 0 1px #ffffff16;color:#f7fbff}
    .cw-host-node-lobby:before{content:"";position:absolute;inset:-45% 42% auto -8%;height:220px;background:radial-gradient(circle,#8de5ef2e,transparent 67%);pointer-events:none}
    .cw-host-node-head{position:relative;display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
    .cw-host-node-kicker{display:block;color:#8de5ef;font-size:.7rem;font-weight:900;letter-spacing:.14em;text-transform:uppercase}
    .cw-host-node-title{margin:5px 0 4px;font-size:clamp(1.35rem,3vw,2rem);line-height:1.05}
    .cw-host-node-meta{margin:0;color:#bfd2dc;font-size:.82rem;overflow-wrap:anywhere}
    .cw-host-node-live{display:inline-flex;align-items:center;gap:7px;white-space:nowrap;padding:7px 10px;border:1px solid #8de5ef42;border-radius:999px;background:#06131ca8;color:#bcd6df;font-size:.74rem;font-weight:800}
    .cw-host-node-live:before{content:"";width:8px;height:8px;border-radius:50%;background:#78909c;box-shadow:0 0 12px #78909c99}
    .cw-host-node-live[data-state="online"]:before{background:#8df0c6;box-shadow:0 0 14px #8df0c6aa}
    .cw-host-node-live[data-state="error"]:before{background:#ffd08a;box-shadow:0 0 14px #ffd08aaa}
    .cw-host-node-slots{position:relative;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:18px 0}
    .cw-host-slot{padding:16px;border:1px solid #ffffff18;border-radius:18px;background:#020a11a0;box-shadow:inset 0 1px #ffffff0d}
    .cw-host-slot small{display:block;color:#b4c7d3;font-size:.68rem;font-weight:900;letter-spacing:.1em;text-transform:uppercase}
    .cw-host-slot strong{display:block;margin-top:5px;font-size:clamp(1.55rem,5vw,3rem);line-height:1;color:#fff;overflow-wrap:anywhere}
    .cw-host-slot span{display:block;margin-top:7px;color:#9eb2bf;font-size:.74rem;line-height:1.35}
    .cw-host-node-note{position:relative;margin:0 0 16px;color:#c8d7df;font-size:.82rem;line-height:1.5}
    .cw-host-node-actions{position:relative;display:flex;flex-wrap:wrap;gap:10px;align-items:center}
    .cw-host-node-actions button,.cw-host-node-actions a{min-height:44px;padding:9px 15px;border-radius:13px;border:1px solid #ffffff2a;font-weight:900;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;font:900 .82rem/1 system-ui,-apple-system,sans-serif}
    .cw-host-node-join{background:linear-gradient(135deg,#7ee5ff,#f3d77d);color:#10131b;border-color:#ffffff66!important;box-shadow:0 8px 24px #6ee7e733}
    .cw-host-node-join[data-selected="true"]{background:linear-gradient(135deg,#8df0c6,#b99cff)}
    .cw-host-node-refresh{background:#09141f;color:#eefaff}
    .cw-host-node-steward{background:#5b4618;color:#fff;border-color:#e8c96b77!important}
    .cw-host-node-actions button:disabled{opacity:.55;cursor:not-allowed}
    .cw-host-node-help{position:relative;margin:11px 0 0;color:#aebfca;font-size:.76rem;line-height:1.45}
    @media(max-width:640px){.cw-host-node-lobby{padding:18px;border-radius:20px}.cw-host-node-head{display:grid}.cw-host-node-live{justify-self:start}.cw-host-node-slots{grid-template-columns:1fr 1fr}.cw-host-node-actions button,.cw-host-node-actions a{flex:1 1 140px}}
  `;
  document.head.append(style);
}

function buildLobby() {
  if (el('cw-host-node-lobby')) return el('cw-host-node-lobby');
  const host = normalizedHost();
  if (!host) return null;
  const section = document.createElement('section');
  section.id = 'cw-host-node-lobby';
  section.className = 'cw-host-node-lobby';
  section.setAttribute('aria-labelledby', 'cw-host-node-title');
  section.innerHTML = `
    <div class="cw-host-node-head">
      <div><small class="cw-host-node-kicker">${localFederated ? 'LOCAL HOST NODE' : 'HOST NODE'}</small><h2 class="cw-host-node-title" id="cw-host-node-title">Checking this Host Node…</h2><p class="cw-host-node-meta" id="cw-host-node-meta"></p></div>
      <span class="cw-host-node-live" id="cw-host-node-live" data-state="checking">Checking status</span>
    </div>
    <div class="cw-host-node-slots" aria-label="Host Node membership capacity">
      <article class="cw-host-slot"><small>Free slots</small><strong id="cw-host-free-slots">—</strong><span>Community residency available on this host.</span></article>
      <article class="cw-host-slot"><small>Paid slots</small><strong id="cw-host-paid-slots">—</strong><span>Additional paid-expansion residency available.</span></article>
    </div>
    <p class="cw-host-node-note" id="cw-host-node-note">Reading the host's live capacity before you join.</p>
    <div class="cw-host-node-actions">
      <button class="cw-host-node-join" id="cw-host-node-join" type="button" disabled>${localFederated ? 'Use this Host Node' : 'Join this Host'}</button>
      ${localFederated && stewardBrowser() ? '<a class="cw-host-node-steward" id="cw-host-node-steward" href="/app/node-ai-operator-v1.html">Host steward tools</a>' : ''}
      <button class="cw-host-node-refresh" id="cw-host-node-refresh" type="button">Refresh status</button>
    </div>
    <p class="cw-host-node-help" id="cw-host-node-help" role="status">${localFederated ? 'This installer is being served by a Civweave federated Host Node. Steward controls stay local to this node.' : 'Joining sets this as your device\'s Host Node. It does not silently start a paid membership.'}</p>
  `;
  const knowledge = document.querySelector('.knowledge-card');
  const installCard = document.querySelector('.install-card');
  if (knowledge?.parentNode) knowledge.parentNode.insertBefore(section, knowledge);
  else if (installCard?.parentNode) installCard.insertAdjacentElement('afterend', section);
  else document.querySelector('main')?.append(section);
  el('cw-host-node-join')?.addEventListener('click', joinHostNode);
  el('cw-host-node-refresh')?.addEventListener('click', () => loadStatus(true));
  return section;
}

function renderSelectedState() {
  const host = normalizedHost();
  const button = el('cw-host-node-join');
  if (!button || !host) return;
  const selected = selectedOrigin() === host;
  button.dataset.selected = String(selected);
  button.textContent = selected ? 'This is your Host Node' : (localFederated ? 'Use this Host Node' : 'Join this Host');
}

function renderStatus(packet) {
  latestStatus = packet;
  const live = el('cw-host-node-live');
  const join = el('cw-host-node-join');
  const title = el('cw-host-node-title');
  const meta = el('cw-host-node-meta');
  const free = el('cw-host-free-slots');
  const paid = el('cw-host-paid-slots');
  const note = el('cw-host-node-note');
  const help = el('cw-host-node-help');
  if (!packet?.ok) {
    if (live) { live.dataset.state = 'error'; live.textContent = 'Status unavailable'; }
    if (title) title.textContent = 'Host Node status unavailable';
    if (meta) meta.textContent = normalizedHost();
    if (free) free.textContent = '—';
    if (paid) paid.textContent = '—';
    if (join) join.disabled = true;
    if (note) note.textContent = 'Civweave could not verify this host or its current capacity.';
    if (help) help.textContent = 'Refresh to try again. The Host button stays locked until this node answers successfully.';
    return;
  }
  if (live) { live.dataset.state = packet.status === 'degraded' ? 'error' : 'online'; live.textContent = packet.status === 'degraded' ? 'Node online · app unavailable' : 'Online'; }
  if (title) title.textContent = packet.displayName || (localFederated ? 'Local Civweave Host Node' : 'Civweave Host Node');
  if (meta) meta.textContent = [packet.nodeId, packet.runtime, packet.hostOrigin].filter(Boolean).join(' · ');
  if (join) join.disabled = false;
  if (packet.capacityAvailable && packet.slots) {
    if (free) free.textContent = numberText(packet.slots.free);
    if (paid) paid.textContent = numberText(packet.slots.paid);
    if (note) note.textContent = 'Free slots are community seats. A community resident may later become paid without consuming one of the paid-expansion slots.';
  } else if (localFederated) {
    if (free) free.textContent = 'Not published';
    if (paid) paid.textContent = 'Not published';
    if (note) note.textContent = packet.capacityMessage || 'This local Docker Host Node is online, but the federated runtime does not publish membership-seat accounting yet.';
  } else {
    if (free) free.textContent = '—';
    if (paid) paid.textContent = '—';
    if (note) note.textContent = packet.capacityMessage || 'This host is online but does not publish membership capacity yet.';
  }
  if (help && selectedOrigin() !== normalizedHost()) {
    help.textContent = localFederated
      ? 'Use this Host Node makes this Docker node the selected Host for this device. Open Host steward tools for local operator controls.'
      : 'Joining sets this as your device’s Host Node. It does not silently start a paid membership.';
  }
  renderSelectedState();
}

async function loadLocalStatus() {
  try {
    const [healthResult, profileResult] = await Promise.all([
      readJson(FEDERATION_HEALTH_ENDPOINT),
      readJson(FEDERATION_PROFILE_ENDPOINT),
    ]);
    const health = healthResult.payload || {};
    const profile = profileResult.payload || {};
    if (!healthResult.response.ok || health?.ok !== true) {
      return { ok: false, error: health.error || `HTTP ${healthResult.response.status}` };
    }
    return {
      schema: 'civweave.host-node-status.v1',
      ok: true,
      kind: 'local-federated-host',
      hostOrigin: location.origin,
      nodeId: health.nodeId || profile.nodeId || null,
      displayName: profile.name || 'Civweave Local Host Node',
      runtime: health.build || profile.software?.build || 'federated-docker',
      status: health.appAvailable === false ? 'degraded' : 'online',
      slots: null,
      capacityAvailable: false,
      capacityMessage: 'This Docker Host Node is live. Free/paid seat accounting is not exposed by the local federated runtime yet, so Civweave will not invent capacity numbers.',
      appAvailable: health.appAvailable !== false,
    };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
}

async function loadStatus(force = false) {
  const host = normalizedHost();
  if (!host) return null;
  const refresh = el('cw-host-node-refresh');
  if (refresh) { refresh.disabled = true; refresh.textContent = force ? 'Refreshing…' : 'Checking…'; }
  try {
    let packet;
    if (localFederated) {
      packet = await loadLocalStatus();
    } else {
      const url = new URL(STATUS_ENDPOINT, location.origin);
      url.searchParams.set('host', host);
      const response = await fetch(url, { cache: 'no-store', headers: { accept: 'application/json' } });
      const body = await response.json().catch(() => ({ ok: false, error: `HTTP ${response.status}` }));
      packet = response.ok ? body : { ...body, ok: false };
    }
    renderStatus(packet);
    return packet;
  } catch (error) {
    renderStatus({ ok: false, error: String(error?.message || error) });
    return null;
  } finally {
    if (refresh) { refresh.disabled = false; refresh.textContent = 'Refresh status'; }
  }
}

function joinHostNode() {
  const host = normalizedHost();
  if (!host || !latestStatus?.ok) return false;
  const selection = Object.freeze({
    schema: 'civweave.host-node-selection.v1',
    origin: host,
    nodeId: latestStatus.nodeId || null,
    displayName: latestStatus.displayName || null,
    selectedAt: new Date().toISOString(),
    source: REVISION,
  });
  try {
    localStorage.setItem(HOST_ENDPOINT_KEY, host);
    localStorage.setItem(HOST_SELECTION_KEY, JSON.stringify(selection));
  } catch {
    const help = el('cw-host-node-help');
    if (help) help.textContent = 'This browser blocked local Host Node storage, so Civweave could not save the selection.';
    return false;
  }
  renderSelectedState();
  const help = el('cw-host-node-help');
  if (help) help.textContent = `${latestStatus.displayName || 'This host'} is now your Host Node on this device.`;
  dispatchEvent(new CustomEvent('civweave:host-node-selected', { detail: selection }));
  return true;
}

function scheduleRefresh() {
  clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    if (document.visibilityState === 'visible') loadStatus(false);
  }, REFRESH_MS);
}

async function boot() {
  const explicit = queryHost();
  if (explicit) {
    activeHost = explicit;
    if (explicit === location.origin) await discoverSameOriginFederatedHost();
  } else if (!await discoverSameOriginFederatedHost()) {
    return false;
  }
  markStewardBrowser();
  installStyles();
  if (!buildLobby()) return false;
  renderSelectedState();
  loadStatus(false);
  scheduleRefresh();
  addEventListener('pagehide', () => clearInterval(refreshTimer), { once: true });
  return true;
}

if (document.readyState === 'loading') addEventListener('DOMContentLoaded', boot, { once: true });
else boot();

globalThis.CivweaveHostNodeInstallerLobbyV1 = Object.freeze({
  revision: REVISION,
  hostEndpointKey: HOST_ENDPOINT_KEY,
  hostSelectionKey: HOST_SELECTION_KEY,
  normalizedHost,
  discoverSameOriginFederatedHost,
  loadStatus,
  joinHostNode,
  boot,
});
})();