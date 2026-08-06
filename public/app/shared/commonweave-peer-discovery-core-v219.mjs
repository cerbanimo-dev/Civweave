export const VERSION = '1.0.7-peer-discovery-core-v219';
export const PRESENCE_SCHEMA = 'commonweave.peer-presence.v1';
export const PRESENCE_KIND = 'commonweave.peer-presence.v1';
export const NODE_CARD_SCHEMA = 'commonweave.shared-node-card.v1';

const DEFAULT_SERVICES = Object.freeze({
  tasks: true,
  trades: true,
  validations: true,
});

const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const unique = (values, max = 50) => [...new Set((Array.isArray(values) ? values : [])
  .map(value => clean(value, 80).toLowerCase())
  .filter(Boolean))].slice(0, max);

export function normalizeNodeUrl(value, baseUrl = 'https://commonweave.invalid') {
  const raw = clean(value, 2000);
  if (!raw) throw new Error('A Commonweave node address is required.');
  let url;
  try {
    url = new URL(raw, baseUrl);
  } catch {
    throw new Error('That Commonweave node address is not a valid URL.');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Commonweave nodes must use HTTP or HTTPS.');
  if (url.username || url.password) throw new Error('Node addresses cannot contain usernames or passwords.');
  const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !local) throw new Error('Remote Commonweave nodes must use HTTPS.');
  return url.origin;
}

export function normalizeSettings(input = {}) {
  const visibility = input.visibility === 'public' ? 'public' : 'paired';
  const intervalMinutes = Math.max(2, Math.min(60, Number(input.intervalMinutes || 4)));
  const ttlMinutes = Math.max(intervalMinutes + 2, Math.min(120, Number(input.ttlMinutes || 12)));
  const sourceServices = input.services && typeof input.services === 'object' ? input.services : {};
  return {
    enabled: Boolean(input.enabled),
    visibility,
    label: clean(input.label || 'My Commonweave', 80) || 'My Commonweave',
    capabilities: unique(input.capabilities, 24),
    services: {
      tasks: sourceServices.tasks !== false,
      trades: sourceServices.trades !== false,
      validations: sourceServices.validations !== false,
    },
    intervalMinutes,
    ttlMinutes,
  };
}

function normalizeNodeRecord(record, baseUrl) {
  if (!record) return null;
  const source = clean(record.source || 'manual', 40) || 'manual';
  try {
    return {
      url: normalizeNodeUrl(record.url || record.nodeUrl, baseUrl),
      label: clean(record.label || 'Commonweave node', 100) || 'Commonweave node',
      source,
      removable: source === 'manual',
      addedAt: record.addedAt || null,
    };
  } catch {
    return null;
  }
}

export function buildNodeCatalog({ configuredNode, friends = [], savedNodes = [], baseUrl } = {}) {
  const rows = [];
  if (configuredNode?.url) rows.push({
    url: configuredNode.url,
    label: configuredNode.label || 'Current Commonweave node',
    source: 'configured',
  });
  for (const friend of Array.isArray(friends) ? friends : []) {
    if (!friend?.nodeUrl) continue;
    rows.push({
      url: friend.nodeUrl,
      label: friend.label ? `${friend.label}'s shared node` : 'Paired friend node',
      source: 'pairing',
      addedAt: friend.addedAt || friend.updatedAt || null,
    });
  }
  for (const node of Array.isArray(savedNodes) ? savedNodes : []) rows.push(node);

  const merged = new Map();
  for (const raw of rows) {
    const row = normalizeNodeRecord(raw, baseUrl);
    if (!row) continue;
    const previous = merged.get(row.url);
    if (!previous) {
      merged.set(row.url, { ...row, sources: [row.source] });
      continue;
    }
    const sources = [...new Set([...(previous.sources || []), row.source])];
    merged.set(row.url, {
      ...previous,
      label: previous.source === 'configured' ? previous.label : row.label || previous.label,
      source: sources.includes('configured') ? 'configured' : sources.includes('pairing') ? 'pairing' : 'manual',
      sources,
      removable: sources.every(source => source === 'manual'),
      addedAt: previous.addedAt || row.addedAt,
    });
  }
  return [...merged.values()].sort((left, right) => {
    const rank = { configured: 0, pairing: 1, manual: 2 };
    return (rank[left.source] ?? 9) - (rank[right.source] ?? 9) || left.label.localeCompare(right.label);
  });
}

export function buildPresencePayload({ peerId, settings, now = Date.now() } = {}) {
  const normalized = normalizeSettings(settings);
  const id = clean(peerId, 180);
  if (!id) throw new Error('A local peer identity is required before announcing presence.');
  const pairedOnly = normalized.visibility === 'paired';
  return {
    schema: PRESENCE_SCHEMA,
    peerId: id,
    visibility: normalized.visibility,
    label: pairedOnly ? '' : normalized.label,
    capabilities: pairedOnly ? [] : normalized.capabilities,
    services: normalized.services,
    protocols: ['friend-pairing-v156', 'community-object-v1', 'shared-node-discovery-v1'],
    announcedAt: new Date(now).toISOString(),
  };
}

export function extractPresence(envelope, nodeUrl) {
  if (!envelope || typeof envelope !== 'object') return null;
  let object = null;
  if (envelope.kind === 'peer-presence-v1' && envelope.payload?.kind === PRESENCE_KIND) object = envelope.payload;
  if (envelope.kind === 'community-object' && envelope.payload?.kind === PRESENCE_KIND) object = envelope.payload;
  if (!object || object.kind !== PRESENCE_KIND || object.payload?.schema !== PRESENCE_SCHEMA) return null;
  const peerId = clean(object.origin?.nodeId, 180);
  if (!peerId || clean(object.payload.peerId, 180) !== peerId) return null;
  const expiresAt = Date.parse(object.expiresAt || 0);
  const updatedAt = Date.parse(object.updatedAt || object.createdAt || 0);
  if (!Number.isFinite(expiresAt) || !Number.isFinite(updatedAt)) return null;
  return {
    peerId,
    nodeUrl,
    visibility: object.payload.visibility === 'public' ? 'public' : 'paired',
    label: clean(object.payload.label, 80),
    capabilities: unique(object.payload.capabilities, 24),
    services: {
      ...DEFAULT_SERVICES,
      ...(object.payload.services && typeof object.payload.services === 'object' ? object.payload.services : {}),
    },
    announcedAt: object.payload.announcedAt || object.updatedAt || object.createdAt,
    updatedAt: new Date(updatedAt).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
    object,
  };
}

export function mergePresenceRecords(records, { localPeerId = '', friends = [], now = Date.now() } = {}) {
  const friendMap = new Map((Array.isArray(friends) ? friends : [])
    .filter(friend => friend?.id)
    .map(friend => [String(friend.id), friend]));
  const merged = new Map();

  for (const record of Array.isArray(records) ? records : []) {
    if (!record?.peerId || record.peerId === localPeerId) continue;
    if (Date.parse(record.expiresAt || 0) <= now) continue;
    const friend = friendMap.get(record.peerId);
    if (record.visibility === 'paired' && !friend) continue;
    const previous = merged.get(record.peerId);
    const next = {
      ...record,
      paired: Boolean(friend),
      label: clean(friend?.label || record.label || 'Nearby Commonweave peer', 80),
      publicKey: friend?.publicKey || null,
      nodes: [...new Set([...(previous?.nodes || []), record.nodeUrl].filter(Boolean))],
    };
    if (!previous || Date.parse(record.updatedAt || 0) >= Date.parse(previous.updatedAt || 0)) {
      merged.set(record.peerId, { ...previous, ...next, nodes: next.nodes });
    } else {
      merged.set(record.peerId, { ...previous, nodes: next.nodes });
    }
  }

  return [...merged.values()].sort((left, right) => Date.parse(right.updatedAt || 0) - Date.parse(left.updatedAt || 0));
}

export function createNodeCard({ url, label = 'Commonweave node', createdAt = new Date().toISOString() } = {}, baseUrl) {
  return {
    schema: NODE_CARD_SCHEMA,
    url: normalizeNodeUrl(url, baseUrl),
    label: clean(label, 100) || 'Commonweave node',
    createdAt,
  };
}

export function parseNodeCard(value, baseUrl) {
  let parsed = value;
  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) throw new Error('The shared node card is empty.');
    try {
      parsed = JSON.parse(raw);
    } catch {
      return createNodeCard({ url: raw }, baseUrl);
    }
  }
  if (parsed?.schema !== NODE_CARD_SCHEMA) throw new Error('That is not a Commonweave shared-node card.');
  return createNodeCard(parsed, baseUrl);
}
