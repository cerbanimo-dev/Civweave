import {
  normalizePagesOrigin,
  normalizeSharedDomainLabel,
  sharedDomainForLabel
} from './shared-domain-policy.mjs';

const VALID_STATUSES = new Set(['inactive', 'active', 'grace', 'suspended']);
const VALID_SOURCES = new Set(['hosting-cost-share', 'sponsored', 'platform-owned']);

function clean(value, max = 180) {
  return String(value ?? '').trim().slice(0, max);
}

function normalizeHostId(value) {
  const hostId = clean(value, 120)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (!hostId) throw new TypeError('hostId is required for a Civweave shared-domain alias.');
  return hostId;
}

function normalizeTime(value, label, required = false) {
  if (!value) {
    if (required) throw new TypeError(`${label} is required.`);
    return null;
  }
  const time = new Date(value);
  if (!Number.isFinite(time.getTime())) throw new RangeError(`${label} must be a valid timestamp.`);
  return time.toISOString();
}

export function normalizeSharedDomainEntitlement(input = {}, now = Date.now()) {
  const label = normalizeSharedDomainLabel(input.label || input.hostId);
  const hostId = normalizeHostId(input.hostId);
  const pagesOrigin = normalizePagesOrigin(input.pagesOrigin);
  const status = clean(input.status || 'inactive', 40).toLowerCase();
  const source = clean(input.source || 'hosting-cost-share', 80).toLowerCase();
  if (!VALID_STATUSES.has(status)) throw new RangeError(`Unknown Civweave shared-domain status: ${status}`);
  if (!VALID_SOURCES.has(source)) throw new RangeError(`Unknown Civweave shared-domain entitlement source: ${source}`);
  const paidThrough = normalizeTime(input.paidThrough, 'paidThrough', status === 'active' && source === 'hosting-cost-share');
  const graceUntil = normalizeTime(input.graceUntil, 'graceUntil', status === 'grace');
  const updatedAt = new Date(now).toISOString();
  return Object.freeze({
    schema: 'civweave.shared-domain-entitlement.v1',
    label,
    hostId,
    pagesOrigin,
    publicOrigin: sharedDomainForLabel(label),
    status,
    source,
    paidThrough,
    graceUntil,
    updatedAt
  });
}

export function publicSharedDomainEntitlement(row) {
  if (!row) return null;
  const label = normalizeSharedDomainLabel(row.label);
  return Object.freeze({
    schema: 'civweave.shared-domain-entitlement.v1',
    label,
    hostId: row.host_id,
    pagesOrigin: row.pages_origin,
    publicOrigin: sharedDomainForLabel(label),
    status: row.entitlement_status,
    source: row.entitlement_source,
    paidThrough: row.paid_through || null,
    graceUntil: row.grace_until || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });
}

export async function sharedDomainEntitlementByLabel(db, label) {
  const normalized = normalizeSharedDomainLabel(label);
  const row = await db.prepare(`SELECT label, host_id, pages_origin, entitlement_status, entitlement_source, paid_through, grace_until, created_at, updated_at
    FROM shared_domain_aliases WHERE label=?1`).bind(normalized).first();
  return publicSharedDomainEntitlement(row);
}

export async function upsertSharedDomainEntitlement(db, input, now = Date.now()) {
  if (!db?.prepare) throw new TypeError('A D1-compatible database binding is required.');
  const record = normalizeSharedDomainEntitlement(input, now);
  const owner = await db.prepare('SELECT host_id FROM shared_domain_aliases WHERE label=?1').bind(record.label).first();
  if (owner && owner.host_id !== record.hostId) {
    throw Object.assign(new Error(`The shared Civweave label ${record.label} is already assigned to another host.`), { status: 409, code: 'SHARED_DOMAIN_LABEL_TAKEN' });
  }
  const existingForHost = await db.prepare('SELECT label FROM shared_domain_aliases WHERE host_id=?1').bind(record.hostId).first();
  if (existingForHost && existingForHost.label !== record.label) {
    throw Object.assign(new Error(`Host ${record.hostId} already owns the shared Civweave label ${existingForHost.label}.`), { status: 409, code: 'SHARED_DOMAIN_HOST_ALREADY_ASSIGNED' });
  }
  const createdAt = new Date(now).toISOString();
  await db.prepare(`INSERT INTO shared_domain_aliases
    (label,host_id,pages_origin,entitlement_status,entitlement_source,paid_through,grace_until,created_at,updated_at)
    VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9)
    ON CONFLICT(label) DO UPDATE SET
      pages_origin=excluded.pages_origin,
      entitlement_status=excluded.entitlement_status,
      entitlement_source=excluded.entitlement_source,
      paid_through=excluded.paid_through,
      grace_until=excluded.grace_until,
      updated_at=excluded.updated_at`)
    .bind(record.label, record.hostId, record.pagesOrigin, record.status, record.source, record.paidThrough, record.graceUntil, createdAt, record.updatedAt)
    .run();
  return sharedDomainEntitlementByLabel(db, record.label);
}
