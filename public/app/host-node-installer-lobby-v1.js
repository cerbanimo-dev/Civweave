(() => {
'use strict';

const REVISION = 'host-node-installer-lobby-v5-guild-terminology';
const HOST_ENDPOINT_KEY = 'federation-finder.physical-node-endpoint';
const HOST_SELECTION_KEY = 'civweave.host-node.selection.v1';
const STEWARD_KEY = 'civweave.host-steward.v1';
const STATUS_ENDPOINT = '/api/host-node-status';
const SEARCH_ENDPOINT = '/api/host-node-search';
const FEDERATION_HEALTH_ENDPOINT = '/api/federation/health';
const FEDERATION_PROFILE_ENDPOINT = '/.well-known/civweave';
const REFRESH_MS = 30_000;
let latestStatus = null;
let activeHost = '';
let activeNodeId = '';
let localFederated = false;
let refreshTimer = 0;
let searching = false;

const access = () => globalThis.CivweaveHostNodeSessionV1 || null;

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
  return activeHost || queryHost() || selectedGuild().origin;
}

function selectedGuild() {
  try {
    const saved = JSON.parse(localStorage.getItem(HOST_SELECTION_KEY) || '{}');
    const origin = new URL(saved?.origin || localStorage.getItem(HOST_ENDPOINT_KEY) || '').origin;
    return { origin, nodeId: /^[a-z0-9-]{1,120}$/.test(String(saved?.nodeId || '')) ? String(saved.nodeId) : '' };
  } catch { return { origin: '', nodeId: '' }; }
}
function selectedOrigin() { return selectedGuild().origin; }
function normalizedNodeId() { return activeNodeId || new URLSearchParams(location.search).get('node') || selectedGuild().nodeId || ''; }

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
function esc(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
function numberText(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number).toLocaleString() : '—';
}

function slotCount(kind) {
  const value = Number(latestStatus?.slots?.[kind]);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
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
    .cw-host-node-search{position:relative;margin-top:16px;padding:16px;border:1px solid #8de5ef36;border-radius:18px;background:#020a11a8}
    .cw-host-node-search[hidden]{display:none}
    .cw-host-node-search h3{margin:0 0 5px;font-size:1rem}.cw-host-node-search>p{margin:0 0 12px;color:#afc5d2;font-size:.78rem;line-height:1.45}
    .cw-host-node-search-controls{display:flex;flex-wrap:wrap;gap:9px;align-items:end}.cw-host-node-search-controls label{display:grid;gap:5px;color:#bcd2dc;font-size:.7rem;font-weight:900;letter-spacing:.07em;text-transform:uppercase}
    .cw-host-node-search select{min-height:42px;padding:8px 34px 8px 10px;border:1px solid #ffffff2a;border-radius:11px;background:#09141f;color:#fff;font:800 .82rem system-ui}
    .cw-host-node-search button{min-height:42px;padding:8px 13px;border:1px solid #8de5ef66;border-radius:11px;background:#123647;color:#fff;font:900 .8rem system-ui;cursor:pointer}
    .cw-host-node-results{display:grid;gap:8px;margin-top:12px}.cw-host-node-result{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px;align-items:center;padding:11px;border:1px solid #ffffff18;border-radius:13px;background:#0b1521;color:#fff;text-align:left}
    .cw-host-node-result strong,.cw-host-node-result span{display:block}.cw-host-node-result span{margin-top:3px;color:#afc2cf;font-size:.72rem}.cw-host-node-result em{font-style:normal;color:#8df0c6;font-size:.72rem;font-weight:900}
    .cw-host-node-search-status{margin:10px 0 0!important;color:#c8d7df!important}
    @media(max-width:640px){.cw-host-node-lobby{padding:18px;border-radius:20px}.cw-host-node-head{display:grid}.cw-host-node-live{justify-self:start}.cw-host-node-slots{grid-template-columns:1fr 1fr}.cw-host-node-actions button,.cw-host-node-actions a{flex:1 1 140px}}
  `;
  document.head.append(style);
}

function buildLobby() {
  if (el('cw-host-node-lobby')) return el('cw-host-node-lobby');
  const host = normalizedHost();
  const section = document.createElement('section');
  section.id = 'cw-host-node-lobby';
  section.className = 'cw-host-node-lobby';
  section.dataset.localFederated = String(localFederated);
  section.setAttribute('aria-labelledby', 'cw-host-node-title');
  section.innerHTML = `
    <div class="cw-host-node-head">
      <div><small class="cw-host-node-kicker">${localFederated ? 'LOCAL GUILD' : 'GUILD'}</small><h2 class="cw-host-node-title" id="cw-host-node-title">${host ? 'Checking this Guild…' : 'Join a Civweave Guild'}</h2><p class="cw-host-node-meta" id="cw-host-node-meta">${host || 'Guild login unlocks capacity-backed Cloudflare AI.'}</p></div>
      <span class="cw-host-node-live" id="cw-host-node-live" data-state="checking">${host ? 'Checking status' : 'Choose a Guild'}</span>
    </div>
    <div class="cw-host-node-slots" aria-label="Guild membership capacity">
      <article class="cw-host-slot"><small>Citizen slots</small><strong id="cw-host-free-slots">—</strong><span>Citizen residency available on this host.</span></article>
      <article class="cw-host-slot"><small>Patron slots</small><strong id="cw-host-paid-slots">—</strong><span>Additional Patron residency available on this host.</span></article>
    </div>
    <p class="cw-host-node-note" id="cw-host-node-note">${host ? 'Reading the Guild’s live capacity before you join.' : 'Find the nearest Guild with Citizen or Patron capacity. Your exact location is never sent; Civweave rounds it before searching.'}</p>
    <div class="cw-host-node-actions">
      <button class="cw-host-node-join" id="cw-host-node-join" type="button" ${host ? 'disabled' : ''} data-mode="${host ? 'join' : 'search'}">${host ? (localFederated ? 'Use this Guild' : 'Join & log in') : 'Find an open Guild'}</button>
      ${localFederated && stewardBrowser() ? '<a class="cw-host-node-steward" id="cw-host-node-steward" href="/app/node-ai-operator-v1.html">Guildkeeper tools</a>' : ''}
      <button class="cw-host-node-refresh" id="cw-host-node-refresh" type="button" ${host ? '' : 'hidden'}>Refresh status</button>
    </div>
    <p class="cw-host-node-help" id="cw-host-node-help" role="status">${localFederated ? 'This installer is being served by a local Civweave Guild. Guildkeeper controls stay local to this node.' : 'A Guild login is device-bound and stored locally. Joining never silently starts a Patron membership.'}</p>
    <section class="cw-host-node-search" id="cw-host-node-search" ${host ? 'hidden' : ''} aria-labelledby="cw-host-node-search-title">
      <h3 id="cw-host-node-search-title">Nearest Guilds with open slots</h3>
      <p>Choose which capacity counts as open. Patron capacity still requires an active Civweave membership.</p>
      <div class="cw-host-node-search-controls"><label>Show slots<select id="cw-host-node-search-mode"><option value="both">Citizen or Patron</option><option value="free">Citizen only</option><option value="paid">Patron only</option></select></label><button type="button" id="cw-host-node-search-run">Use my approximate location</button></div>
      <p class="cw-host-node-search-status" id="cw-host-node-search-status" role="status">Location is requested only when you start a nearest-Guild search.</p>
      <div class="cw-host-node-results" id="cw-host-node-results"></div>
    </section>
  `;
  const knowledge = document.querySelector('.knowledge-card');
  const installCard = document.querySelector('.install-card');
  if (knowledge?.parentNode) knowledge.parentNode.insertBefore(section, knowledge);
  else if (installCard?.parentNode) installCard.insertAdjacentElement('afterend', section);
  else document.querySelector('main')?.append(section);
  el('cw-host-node-join')?.addEventListener('click', () => void joinHostNode());
  el('cw-host-node-refresh')?.addEventListener('click', () => loadStatus(true));
  el('cw-host-node-search-run')?.addEventListener('click', () => void searchNearest());
  el('cw-host-node-results')?.addEventListener('click', event => {
    const button = event.target.closest?.('[data-guild-origin]');
    if (!button) return;
    activeHost = button.dataset.guildOrigin || '';
    activeNodeId = button.dataset.guildNodeId || '';
    localFederated = false;
    latestStatus = null;
    section.dataset.localFederated = 'false';
    const refresh = el('cw-host-node-refresh'); if (refresh) refresh.hidden = false;
    const title = el('cw-host-node-title'); if (title) title.textContent = 'Checking this Guild…';
    const live = el('cw-host-node-live'); if (live) { live.dataset.state = 'checking'; live.textContent = 'Checking status'; }
    revealSearch(false);
    loadStatus(true);
  });
  return section;
}

function revealSearch(visible = true) {
  const panel = el('cw-host-node-search');
  if (panel) panel.hidden = !visible;
  if (visible) panel?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  return visible;
}

function approximateLocation() {
  if (!navigator.geolocation) return Promise.reject(new Error('This browser does not provide location search.'));
  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(
    position => resolve({
      latitude: Number(position.coords.latitude.toFixed(3)),
      longitude: Number(position.coords.longitude.toFixed(3)),
      accuracyMeters: Math.max(100, Math.ceil(Number(position.coords.accuracy || 100) / 100) * 100),
    }),
    error => reject(new Error(error?.message || 'Location permission was not granted.')),
    { enableHighAccuracy: false, maximumAge: 10 * 60 * 1000, timeout: 12_000 },
  ));
}

function renderSearchResults(packet) {
  const results = el('cw-host-node-results');
  const status = el('cw-host-node-search-status');
  const rows = Array.isArray(packet?.nodes) ? packet.nodes : [];
  if (status) status.textContent = rows.length
    ? `${rows.length} nearby Guild${rows.length === 1 ? '' : 's'} currently match this slot search.`
    : 'No nearby registered Guilds currently match those open-slot filters.';
  if (!results) return;
  results.innerHTML = rows.map(node => {
    const distance = Number.isFinite(Number(node.distanceKm)) ? `${Number(node.distanceKm).toFixed(Number(node.distanceKm) < 10 ? 1 : 0)} km away` : 'distance unavailable';
    return `<button type="button" class="cw-host-node-result" data-guild-origin="${esc(node.hostOrigin)}" data-guild-node-id="${esc(node.nodeId || '')}"><span><strong>${esc(node.displayName || node.nodeId || 'Civweave Guild')}</strong><span>${esc(distance)} · ${esc(node.nodeId || '')}</span></span><em>${numberText(node?.slots?.free)} Citizen · ${numberText(node?.slots?.paid)} Patron</em></button>`;
  }).join('');
}

async function searchNearest() {
  if (searching) return null;
  searching = true;
  revealSearch(true);
  const button = el('cw-host-node-search-run');
  const status = el('cw-host-node-search-status');
  const results = el('cw-host-node-results');
  if (button) { button.disabled = true; button.textContent = 'Finding nearby Guilds…'; }
  if (status) status.textContent = 'Getting an approximate location for this search…';
  if (results) results.innerHTML = '';
  try {
    const locationPacket = await approximateLocation();
    if (status) status.textContent = 'Checking nearby Guild capacity…';
    const response = await fetch(SEARCH_ENDPOINT, {
      method: 'POST',
      cache: 'no-store',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ ...locationPacket, mode: el('cw-host-node-search-mode')?.value || 'both' }),
    });
    const packet = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(packet.error || `Nearest-Guild search returned HTTP ${response.status}.`);
    renderSearchResults(packet);
    return packet;
  } catch (error) {
    if (status) status.textContent = `Nearest-Guild search could not complete: ${error?.message || error}`;
    return null;
  } finally {
    searching = false;
    if (button) { button.disabled = false; button.textContent = 'Use my approximate location'; }
  }
}

function renderSelectedState() {
  const host = normalizedHost();
  const button = el('cw-host-node-join');
  if (!button) return;
  if (!host) { button.dataset.mode = 'search'; button.dataset.selected = 'false'; button.textContent = 'Find an open Guild'; return; }
  const nodeId = normalizedNodeId();
  const loggedIn = Boolean(access()?.sessionFor?.(nodeId || host));
  const selected = selectedOrigin() === host;
  button.dataset.selected = String(loggedIn || selected);
  if (loggedIn) { button.dataset.mode = 'join'; button.textContent = 'Logged in to this Guild'; return; }
  if (latestStatus?.capacityAvailable && slotCount('free') < 1 && !access()?.hasCredential?.(host,nodeId)) {
    button.dataset.mode = 'search'; button.textContent = 'Find nearest open Guild'; return;
  }
  button.dataset.mode = 'join';
  button.textContent = access()?.hasCredential?.(host,nodeId) ? 'Log back in' : (localFederated ? 'Use this Guild' : 'Join & log in');
}

function renderStatus(packet) {
  latestStatus = packet;
  if (packet?.nodeId) activeNodeId = String(packet.nodeId);
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
    if (title) title.textContent = 'Guild status unavailable';
    if (meta) meta.textContent = normalizedHost();
    if (free) free.textContent = '—';
    if (paid) paid.textContent = '—';
    if (join) { join.disabled = false; join.dataset.mode = 'search'; join.textContent = 'Find another Guild'; }
    if (note) note.textContent = 'Civweave could not verify this Guild or its current capacity.';
    if (help) help.textContent = 'Refresh to try again. Joining stays locked until this Guild answers successfully.';
    return;
  }
  if (live) { live.dataset.state = packet.status === 'degraded' ? 'error' : 'online'; live.textContent = packet.status === 'degraded' ? 'Guild online · app unavailable' : 'Online'; }
  if (title) title.textContent = packet.displayName || (localFederated ? 'Local Civweave Guild' : 'Civweave Guild');
  if (meta) meta.textContent = [packet.nodeId, packet.runtime, packet.hostOrigin].filter(Boolean).join(' · ');
  if (packet.capacityAvailable && packet.slots) {
    if (free) free.textContent = numberText(packet.slots.free);
    if (paid) paid.textContent = numberText(packet.slots.paid);
    if (note) note.textContent = 'Citizen slots are community seats. A Citizen may later become a Patron without consuming a Patron slot reserved for additional capacity.';
  } else if (localFederated) {
    if (free) free.textContent = 'Not published';
    if (paid) paid.textContent = 'Not published';
    if (note) note.textContent = packet.capacityMessage || 'This local Guild is online, but the federated runtime does not publish membership-seat accounting yet.';
  } else {
    if (free) free.textContent = '—';
    if (paid) paid.textContent = '—';
    if (note) note.textContent = packet.capacityMessage || 'This Guild is online but does not publish membership capacity yet.';
  }
  if (join) {
    const canReconnect = Boolean(access()?.hasCredential?.(normalizedHost(),normalizedNodeId()));
    const freeOpen = slotCount('free') > 0;
    join.disabled = false;
    join.dataset.mode = freeOpen || canReconnect || localFederated ? 'join' : 'search';
    if (!freeOpen && !canReconnect && !localFederated) revealSearch(true);
  }
  if (help && selectedOrigin() !== normalizedHost()) {
    help.textContent = localFederated
      ? 'Use this Guild makes this local node the selected Guild for this device. Open Guildkeeper tools for local operator controls.'
      : 'Joining sets this as your device’s Guild. It does not silently start a Patron membership.';
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
      displayName: profile.name || 'Civweave Local Guild',
      runtime: health.build || profile.software?.build || 'federated-docker',
      status: health.appAvailable === false ? 'degraded' : 'online',
      slots: null,
      capacityAvailable: false,
      capacityMessage: 'This local Guild is live. Citizen/Patron seat accounting is not exposed by the local federated runtime yet, so Civweave will not invent capacity numbers.',
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
      if (normalizedNodeId()) url.searchParams.set('node', normalizedNodeId());
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

async function joinHostNode() {
  const host = normalizedHost();
  const button = el('cw-host-node-join');
  if (button?.dataset.mode === 'search' || !host) { revealSearch(true); await searchNearest(); return false; }
  if (!latestStatus?.ok) return false;
  const help = el('cw-host-node-help');
  if (button) { button.disabled = true; button.textContent = localFederated ? 'Reserving seat…' : 'Logging in…'; }
  let login = null;
  if (!localFederated) {
    try {
      if (!access()?.join) throw new Error('The Guild login runtime is not ready. Refresh this screen and try again.');
      login = await access().join(host,{nodeId:normalizedNodeId()});
    } catch (error) {
      if (help) help.textContent = Number(error?.status) === 409
        ? 'This Guild filled before the seat could be reserved. Find the nearest Guild with an open slot.'
        : `Civweave could not log in to this Guild: ${error?.message || error}`;
      if (Number(error?.status) === 409) revealSearch(true);
      if (button) { button.disabled = false; renderSelectedState(); }
      return false;
    }
  }
  const selection = Object.freeze({
    schema: 'civweave.host-node-selection.v1',
    origin: host,
    nodeId: login?.session?.nodeId || latestStatus.nodeId || normalizedNodeId() || null,
    displayName: latestStatus.displayName || null,
    selectedAt: new Date().toISOString(),
    source: REVISION,
  });
  try {
    localStorage.setItem(HOST_ENDPOINT_KEY, host);
    localStorage.setItem(HOST_SELECTION_KEY, JSON.stringify(selection));
  } catch {
    if (help) help.textContent = 'This browser blocked local Guild selection storage, so Civweave could not save the selection.';
    if (button) button.disabled = false;
    return false;
  }
  renderSelectedState();
  if (button) button.disabled = false;
  if (help) help.textContent = localFederated
    ? `${latestStatus.displayName || 'This Guild'} is now your device’s Guild.`
    : `Logged in to ${latestStatus.displayName || 'this Guild'}. Capacity-backed Cloudflare AI is now available in this tab.`;
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
    activeHost = selectedOrigin();
  }
  markStewardBrowser();
  installStyles();
  if (!buildLobby()) return false;
  renderSelectedState();
  if (normalizedHost()) loadStatus(false);
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
  searchNearest,
  showSearch: revealSearch,
  boot,
});

function installLocalCapacityBridge() {
  if (document.querySelector('script[data-civweave-local-host-capacity]')) return false;
  const script = document.createElement('script');
  script.src = '/app/host-node-local-capacity-v1.js?v=local-host-capacity-v1';
  script.async = true;
  script.dataset.civweaveLocalHostCapacity = 'v1';
  document.head.append(script);
  return true;
}
if (document.readyState === 'loading') addEventListener('DOMContentLoaded', installLocalCapacityBridge, { once: true });
else installLocalCapacityBridge();

})();