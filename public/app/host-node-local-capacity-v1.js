(() => {
'use strict';

const VERSION = 'host-node-local-capacity-v2-citizen-patron-copy';
const CAPACITY_ENDPOINT = '/api/federation/capacity';
const ADMIT_ENDPOINT = '/api/federation/residents/admit';
const HOST_ENDPOINT_KEY = 'federation-finder.physical-node-endpoint';
const RESIDENT_KEY = 'civweave.host-resident-id.v1';
const PASSPORT_KEY = 'civweave.anarchadia.citizen-console.v139';
const REFRESH_MS = 15_000;
const LOBBY_WAIT_MS = 10_000;
let refreshing = false;
let joining = false;
let observerTimer = 0;
let refreshTimer = 0;
let bound = false;

const el = id => document.getElementById(id);

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
    join.textContent = 'Find nearest open Hub';
  }
  document.getElementById('cw-host-node-lobby')?.setAttribute('data-local-capacity-live', 'true');
  return true;
}

async function refreshCapacity() {
  if (refreshing || !document.getElementById('cw-host-node-lobby')) return null;
  refreshing = true;
  try {
    const packet = await jsonRequest(CAPACITY_ENDPOINT);
    renderCapacity(packet);
    return packet;
  } catch (error) {
    const note = el('cw-host-node-note');
    if (note && /Not published|not expose|live capacity/i.test(note.textContent || '')) note.textContent = `Local seat accounting is starting: ${error.message}`;
    return null;
  } finally {
    refreshing = false;
  }
}

async function admitResident({ quiet = false } = {}) {
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
    renderCapacity(packet);
    return packet;
  } catch (error) {
    if (help) {
      help.textContent = error.status === 409
        ? 'This Host Node has no Citizen slots right now. A Guildkeeper can expand capacity or you can choose another Host Node.'
        : `Civweave could not reserve a Citizen slot on this local Host Node: ${error.message}`;
    }
    throw error;
  } finally {
    if (!quiet && button) { button.disabled = false; button.textContent = priorText || 'Use this Host Node'; }
  }
}

async function interceptJoin(event) {
  const button = event.target?.closest?.('#cw-host-node-join');
  const lobby = document.getElementById('cw-host-node-lobby');
  if (!button || !lobby || lobby.dataset.localFederated !== 'true') return;
  if (button.dataset.mode === 'search') return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (joining) return;
  joining = true;
  try {
    await admitResident();
    await globalThis.CivweaveHostNodeInstallerLobbyV1?.joinHostNode?.();
    await refreshCapacity();
  } catch {
    // admitResident already leaves a useful status message and deliberately does not select a full host.
  } finally {
    joining = false;
  }
}

function observeLobby() {
  const lobby = document.getElementById('cw-host-node-lobby');
  if (!lobby) return false;
  const observer = new MutationObserver(() => {
    clearTimeout(observerTimer);
    observerTimer = setTimeout(() => {
      const free = el('cw-host-free-slots')?.textContent || '';
      const paid = el('cw-host-paid-slots')?.textContent || '';
      if (/Not published|^—$/.test(free) || /Not published|^—$/.test(paid)) refreshCapacity();
    }, 80);
  });
  observer.observe(lobby, { subtree: true, childList: true, characterData: true });
  addEventListener('pagehide', () => observer.disconnect(), { once: true });
  return true;
}

function waitForLobby(timeoutMs = LOBBY_WAIT_MS) {
  const existing = document.getElementById('cw-host-node-lobby');
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
      const lobby = document.getElementById('cw-host-node-lobby');
      if (lobby) finish(lobby);
    });
    observer.observe(root, { childList: true, subtree: true });
    const timer = setTimeout(() => finish(null), timeoutMs);
  });
}

async function boot() {
  if (bound) return true;
  const lobby = await waitForLobby();
  if (!lobby || bound) return false;
  bound = true;
  document.addEventListener('click', interceptJoin, true);
  observeLobby();
  await refreshCapacity();
  if (selectedLocalHost()) admitResident({ quiet: true }).then(refreshCapacity).catch(() => {});
  clearInterval(refreshTimer);
  refreshTimer = setInterval(() => { if (document.visibilityState === 'visible') refreshCapacity(); }, REFRESH_MS);
  addEventListener('pagehide', () => clearInterval(refreshTimer), { once: true });
  return true;
}

if (document.readyState === 'loading') addEventListener('DOMContentLoaded', boot, { once: true });
else boot();

globalThis.CivweaveHostNodeLocalCapacityV1 = Object.freeze({ version: VERSION, refreshCapacity, admitResident, residentId, passportId, waitForLobby, boot });
})();
