(() => {
'use strict';

const VERSION = 'host-node-local-capacity-v4-request-budget-safe';
const CAPACITY_ENDPOINT = '/api/federation/capacity';
const ADMIT_ENDPOINT = '/api/federation/residents/admit';
const HOST_ENDPOINT_KEY = 'federation-finder.physical-node-endpoint';
const RESIDENT_KEY = 'civweave.host-resident-id.v1';
const PASSPORT_KEY = 'civweave.anarchadia.citizen-console.v139';
const CACHE_KEY = 'civweave.local-host-capacity.cache.v1';
const LEASE_KEY = 'civweave.local-host-capacity.network-lease.v1';
const FAILURE_KEY = 'civweave.local-host-capacity.failure-backoff.v1';
const REFRESH_MS = 5 * 60 * 1000;
const NETWORK_LEASE_MS = 60 * 1000;
const FAILURE_BACKOFF_MS = 5 * 60 * 1000;
const LOBBY_WAIT_MS = 10_000;
const INSTANCE_ID = `local-capacity:${crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
let refreshing = false;
let joining = false;
let refreshTimer = 0;
let bound = false;

const el = id => document.getElementById(id);
const parse = (value, fallback = null) => { try { return JSON.parse(value) ?? fallback; } catch { return fallback; } };

function lobby() { return document.getElementById('cw-host-node-lobby'); }
function localFederatedLobby() { return lobby()?.dataset.localFederated === 'true'; }

function selectedLocalHost() {
  try { return new URL(localStorage.getItem(HOST_ENDPOINT_KEY) || '').origin === location.origin; }
  catch { return false; }
}

function residentId() {
  try {
    const saved = localStorage.getItem(RESIDENT_KEY);
    if (saved) return saved;
    const id = `cwres:${crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('')}`;
    localStorage.setItem(RESIDENT_KEY, id);
    return id;
  } catch {
    return `cwres:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
  }
}

function passportId() {
  try {
    const state = JSON.parse(localStorage.getItem(PASSPORT_KEY) || 'null');
    return String(state?.passportId || '').trim().slice(0, 180);
  } catch {
    return '';
  }
}

function readCache() {
  try { return parse(localStorage.getItem(CACHE_KEY), null); }
  catch { return null; }
}

function writeCache(packet) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ packet, updatedAt: Date.now() })); }
  catch {}
}

function failureBackoffActive(now = Date.now()) {
  try {
    const until = Number(localStorage.getItem(FAILURE_KEY) || 0);
    return Number.isFinite(until) && until > now;
  } catch { return false; }
}

function markFailureBackoff() {
  try { localStorage.setItem(FAILURE_KEY, String(Date.now() + FAILURE_BACKOFF_MS)); }
  catch {}
}

function clearFailureBackoff() {
  try { localStorage.removeItem(FAILURE_KEY); }
  catch {}
}

function acquireNetworkLease({ force = false } = {}) {
  if (!localFederatedLobby()) return false;
  if (document.visibilityState !== 'visible' && !force) return false;
  const now = Date.now();
  if (!force && failureBackoffActive(now)) return false;
  try {
    const current = parse(localStorage.getItem(LEASE_KEY), null);
    if (!force && Number(current?.expiresAt) > now) return false;
    const next = { owner: INSTANCE_ID, expiresAt: now + NETWORK_LEASE_MS, updatedAt: now };
    localStorage.setItem(LEASE_KEY, JSON.stringify(next));
    const stored = parse(localStorage.getItem(LEASE_KEY), null);
    return stored?.owner === INSTANCE_ID && Number(stored?.expiresAt) > now;
  } catch {
    return true;
  }
}

async function jsonRequest(url, options = {}) {
  const response = await fetch(url, { cache: 'no-store', ...options, headers: { accept: 'application/json', ...(options.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `HTTP ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

function renderCapacity(packet) {
  if (!localFederatedLobby()) return false;
  const capacity = packet?.capacity || packet;
  if (!capacity?.capacityAvailable || !capacity?.slots) return false;
  const free = el('cw-host-free-slots');
  const paid = el('cw-host-paid-slots');
  const note = el('cw-host-node-note');
  if (free) free.textContent = Number(capacity.slots.free).toLocaleString();
  if (paid) paid.textContent = Number(capacity.slots.paid).toLocaleString();
  if (note) {
    const counts = capacity.counts || {};
    const limits = capacity.limits || {};
    note.textContent = `${Number(counts.communityMembers || 0).toLocaleString()} / ${Number(limits.community || 0).toLocaleString()} Citizen slots used · ${Number(counts.paidExpansionMembers || 0).toLocaleString()} / ${Number(limits.paidExpansion || 0).toLocaleString()} Patron slots used · ${Number(counts.activePaidMembers || 0).toLocaleString()} active Patron${Number(counts.activePaidMembers || 0) === 1 ? '' : 's'} total. A Citizen who becomes a Patron keeps the Citizen slot and leaves Patron capacity open.`;
  }
  const join = el('cw-host-node-join');
  if (join && Number(capacity.slots.free || 0) < 1 && !selectedLocalHost()) {
    join.dataset.mode = 'search';
    join.textContent = 'Find nearest open Guild';
  }
  lobby()?.setAttribute('data-local-capacity-live', 'true');
  return true;
}

function renderCachedCapacity() {
  const cached = readCache();
  if (!cached?.packet) return false;
  return renderCapacity(cached.packet);
}

async function refreshCapacity({ force = false } = {}) {
  if (refreshing || !localFederatedLobby()) return null;
  if (!acquireNetworkLease({ force })) {
    renderCachedCapacity();
    return null;
  }
  refreshing = true;
  try {
    const packet = await jsonRequest(CAPACITY_ENDPOINT);
    clearFailureBackoff();
    writeCache(packet);
    renderCapacity(packet);
    return packet;
  } catch {
    markFailureBackoff();
    renderCachedCapacity();
    return null;
  } finally {
    refreshing = false;
  }
}

async function admitResident({ quiet = false } = {}) {
  if (!localFederatedLobby()) throw new Error('Local Guild capacity is unavailable on this page.');
  const button = el('cw-host-node-join');
  const help = el('cw-host-node-help');
  const priorText = button?.textContent || '';
  if (!quiet && button) { button.disabled = true; button.textContent = 'Reserving seat…'; }
  try {
    const packet = await jsonRequest(ADMIT_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ residentId: residentId(), userId: passportId() || undefined, seatClass: 'community' }),
    });
    clearFailureBackoff();
    writeCache(packet);
    renderCapacity(packet);
    return packet;
  } catch (error) {
    if (help) {
      help.textContent = error.status === 409
        ? 'This Guild has no Citizen slots right now. A Guildkeeper can expand capacity or you can choose another Guild.'
        : `Civweave could not reserve a Citizen slot on this local Guild: ${error.message}`;
    }
    throw error;
  } finally {
    if (!quiet && button) { button.disabled = false; button.textContent = priorText || 'Use this Guild'; }
  }
}

async function interceptJoin(event) {
  const button = event.target?.closest?.('#cw-host-node-join');
  const currentLobby = lobby();
  if (!button || !currentLobby || currentLobby.dataset.localFederated !== 'true') return;
  if (button.dataset.mode === 'search') return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (joining) return;
  joining = true;
  try {
    await admitResident();
    await globalThis.CivweaveHostNodeInstallerLobbyV1?.joinHostNode?.();
    await refreshCapacity({ force: true });
  } catch {
    // admitResident already leaves a useful status message and deliberately does not select a full host.
  } finally {
    joining = false;
  }
}

function waitForLobby(timeoutMs = LOBBY_WAIT_MS) {
  const existing = lobby();
  if (existing) return Promise.resolve(existing);
  return new Promise(resolve => {
    const root = document.documentElement || document;
    let settled = false;
    const finish = value => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      observer.disconnect();
      resolve(value);
    };
    const observer = new MutationObserver(() => {
      const current = lobby();
      if (current) finish(current);
    });
    observer.observe(root, { childList: true, subtree: true });
    const timer = setTimeout(() => finish(null), timeoutMs);
  });
}

function scheduleRefresh() {
  clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    if (document.visibilityState === 'visible' && localFederatedLobby()) void refreshCapacity();
  }, REFRESH_MS);
}

async function boot() {
  if (bound) return true;
  const currentLobby = await waitForLobby();
  if (!currentLobby || bound) return false;
  if (currentLobby.dataset.localFederated !== 'true') {
    document.documentElement.dataset.civweaveLocalCapacity = 'inactive-nonlocal';
    return false;
  }
  bound = true;
  document.documentElement.dataset.civweaveLocalCapacity = VERSION;
  document.addEventListener('click', interceptJoin, true);
  renderCachedCapacity();
  if (document.visibilityState === 'visible') await refreshCapacity();
  scheduleRefresh();
  addEventListener('storage', event => { if (event.key === CACHE_KEY && localFederatedLobby()) renderCachedCapacity(); });
  addEventListener('pagehide', () => clearInterval(refreshTimer), { once: true });
  return true;
}

if (document.readyState === 'loading') addEventListener('DOMContentLoaded', boot, { once: true });
else boot();

globalThis.CivweaveHostNodeLocalCapacityV1 = Object.freeze({
  version: VERSION,
  refreshMs: REFRESH_MS,
  networkLeaseMs: NETWORK_LEASE_MS,
  failureBackoffMs: FAILURE_BACKOFF_MS,
  localFederatedLobby,
  refreshCapacity,
  admitResident,
  residentId,
  passportId,
  waitForLobby,
  boot,
});
})();
