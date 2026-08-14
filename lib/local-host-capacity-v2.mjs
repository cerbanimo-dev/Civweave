import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { createLocalHostCapacityStore as createBaseStore, LOCAL_HOST_CAPACITY_SCHEMA } from './local-host-capacity-v1.mjs';

const clean = (value, max = 180) => String(value ?? '').trim().slice(0, max);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function atomicWrite(file, value) { const temp = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`; await fsp.writeFile(temp, JSON.stringify(value, null, 2), { mode: 0o600 }); await fsp.rename(temp, file); await fsp.chmod(file, 0o600).catch(() => {}); }
async function acquire(lockFile) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { const handle = await fsp.open(lockFile, 'wx', 0o600); await handle.writeFile(`${process.pid}\n${Date.now()}\n`); return async () => { await handle.close().catch(() => {}); await fsp.unlink(lockFile).catch(() => {}); }; }
    catch (error) { if (error?.code !== 'EEXIST') throw error; const stat = await fsp.stat(lockFile).catch(() => null); if (stat && Date.now() - stat.mtimeMs > 15000) { await fsp.unlink(lockFile).catch(() => {}); continue; } await sleep(Math.min(250, 20 + attempt * 4)); }
  }
  throw Object.assign(new Error('Local Host Node capacity state is busy. Try again.'), { status: 503 });
}
function publicMember(row) { return row ? Object.freeze({ ...row }) : null; }

export function createLocalHostCapacityStore(options = {}) {
  const base = createBaseStore(options), dataDir = path.resolve(options.dataDir || process.env.DATA_DIR || './data'), file = path.join(dataDir, 'host-capacity-v1.json'), lockFile = `${file}.lock`;
  async function read() { const state = JSON.parse(await fsp.readFile(file, 'utf8').catch(error => { if (error?.code === 'ENOENT') return JSON.stringify({ schema: LOCAL_HOST_CAPACITY_SCHEMA, residents: {}, blockedResidents: {} }); throw error; })); state.residents ||= {}; state.blockedResidents ||= {}; return state; }
  async function edit(worker) { const release = await acquire(lockFile); try { const state = await read(), result = await worker(state); state.updatedAt = new Date().toISOString(); await fsp.mkdir(dataDir, { recursive: true }); await atomicWrite(file, state); return result; } finally { await release(); } }
  function blockId(input = {}) { return clean(input.userId || input.residentId, 180); }
  async function admit(input = {}) { const id = blockId(input); if (id) { const state = await read(); if (state.blockedResidents?.[id]) throw Object.assign(new Error('This account has been blocked from rejoining this local Hub.'), { status: 403, code: 'hub-member-blocked' }); } return base.admit(input); }
  async function listResidents() { const state = await read(); return Object.freeze(Object.values(state.residents || {}).filter(row => row?.billingStatus !== 'ended').map(publicMember).sort((a, b) => String(a.accountName || a.userId || a.residentId).localeCompare(String(b.accountName || b.userId || b.residentId)))); }
  async function annotateResident(input = {}) { const userId = clean(input.userId, 180), residentId = clean(input.residentId, 180); return edit(state => { const row = residentId ? state.residents[residentId] : Object.values(state.residents).find(item => item?.userId === userId && item.billingStatus !== 'ended'); if (!row) throw Object.assign(new Error('Local Hub resident was not found.'), { status: 404 }); row.accountId = clean(input.accountId, 180) || row.accountId || null; row.accountName = clean(input.accountName, 64) || row.accountName || null; row.passportIds = Array.isArray(input.passportIds) ? input.passportIds.map(value => clean(value, 180)).filter(Boolean).slice(0, 32) : row.passportIds || []; row.updatedAt = new Date().toISOString(); return { member: publicMember(row) }; }); }
  async function removeResident(input = {}) { const userId = clean(input.userId, 180), residentId = clean(input.residentId, 180); if (!userId && !residentId) throw Object.assign(new TypeError('userId or residentId is required.'), { status: 400 }); return edit(state => { const entry = residentId ? [residentId, state.residents[residentId]] : Object.entries(state.residents).find(([, row]) => row?.userId === userId && row.billingStatus !== 'ended') || []; const [key, row] = entry; if (!key || !row) return { ok: true, removed: false, idempotent: true }; delete state.residents[key]; const block = clean(row.userId || row.residentId, 180); if (input.blockRejoin === true && block) state.blockedResidents[block] = { userId: row.userId || null, residentId: row.residentId, reason: clean(input.reason, 500) || 'removed-by-host-steward', blockedAt: new Date().toISOString() }; return { ok: true, removed: true, blocked: input.blockRejoin === true, member: publicMember(row), billingActionRequired: row.billingStatus === 'paid' || row.billingStatus === 'grace', walletPreserved: true }; }); }
  async function unblockResident(input = {}) { const id = blockId(input); if (!id) throw Object.assign(new TypeError('userId or residentId is required.'), { status: 400 }); return edit(state => { const existed = Boolean(state.blockedResidents[id]); delete state.blockedResidents[id]; return { ok: true, unblocked: existed, id }; }); }
  return Object.freeze({ ...base, admit, listResidents, annotateResident, removeResident, unblockResident });
}
