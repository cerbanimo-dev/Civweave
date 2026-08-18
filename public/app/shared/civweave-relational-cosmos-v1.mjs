export const RELATIONAL_COSMOS_SCHEMA = 'civweave.relational-cosmos.v1';
export const COSMOS_NODE_TYPES = Object.freeze(['guild', 'quest', 'beat']);
export const COSMOS_RELATION_TYPES = Object.freeze(['hierarchy', 'similarity', 'origin']);

const TYPE_RANK = Object.freeze({ guild: 0, quest: 1, beat: 2 });
const TYPE_DEFAULT_SCALE = Object.freeze({ guild: 0.48, quest: 0.95, beat: 1.65 });

const clean = (value, max = 6000) => String(value ?? '').trim().slice(0, max);
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

function stableString(value) {
  if (Array.isArray(value)) return `[${value.map(stableString).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableString(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function stableHash32(value) {
  const text = typeof value === 'string' ? value : stableString(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function unit(value, salt = '') {
  return stableHash32(`${salt}|${value}`) / 0xffffffff;
}

function normalizeType(value) {
  const type = clean(value, 24).toLowerCase();
  return COSMOS_NODE_TYPES.includes(type) ? type : 'beat';
}

function normalizeTags(value) {
  return [...new Set((Array.isArray(value) ? value : [])
    .map((tag) => clean(tag, 96).toLowerCase())
    .filter(Boolean))].sort();
}

function nodeUid(raw, index) {
  return clean(raw?.uid || raw?.id || `${normalizeType(raw?.type)}-${index}`, 220);
}

export function normalizeCosmosData(input = {}) {
  const sourceNodes = Array.isArray(input) ? input : (Array.isArray(input?.nodes) ? input.nodes : []);
  const nodes = sourceNodes.map((raw, index) => {
    const type = normalizeType(raw?.type);
    const uid = nodeUid(raw, index);
    const parentUid = clean(raw?.parentUid || raw?.parent_uid || '', 220) || null;
    const originUid = clean(raw?.originUid || raw?.origin_uid || '', 220) || null;
    const guildUid = clean(raw?.guildUid || raw?.guild_uid || (type === 'guild' ? uid : ''), 220) || null;
    const questUid = clean(raw?.questUid || raw?.quest_uid || (type === 'quest' ? uid : ''), 220) || null;
    return {
      uid,
      type,
      label: clean(raw?.label || raw?.name || uid, 240) || uid,
      summary: clean(raw?.summary || raw?.description || '', 1200),
      parentUid,
      originUid,
      guildUid,
      questUid,
      tags: normalizeTags(raw?.tags),
      weaveUid: clean(raw?.weaveUid || raw?.weave_uid || '', 220) || null,
      chordUid: clean(raw?.chordUid || raw?.chord_uid || '', 220) || null,
      metadata: raw?.metadata && typeof raw.metadata === 'object' ? raw.metadata : {},
    };
  }).filter((node) => node.uid);

  const byUid = new Map();
  for (const node of nodes) if (!byUid.has(node.uid)) byUid.set(node.uid, node);
  const dedupedNodes = [...byUid.values()];

  for (const node of dedupedNodes) {
    const parent = node.parentUid ? byUid.get(node.parentUid) : null;
    if (node.type === 'quest' && !node.guildUid && parent?.type === 'guild') node.guildUid = parent.uid;
    if (node.type === 'beat' && parent?.type === 'quest') {
      if (!node.questUid) node.questUid = parent.uid;
      if (!node.guildUid) node.guildUid = parent.guildUid || parent.parentUid || null;
    }
  }

  const rawRelations = Array.isArray(input?.relations) ? input.relations : [];
  const relations = rawRelations.map((raw, index) => {
    const sourceUid = clean(raw?.sourceUid || raw?.source_uid || raw?.source || '', 220);
    const targetUid = clean(raw?.targetUid || raw?.target_uid || raw?.target || '', 220);
    const kindText = clean(raw?.kind || raw?.type || 'similarity', 32).toLowerCase();
    const kind = COSMOS_RELATION_TYPES.includes(kindText) ? kindText : 'similarity';
    return {
      uid: clean(raw?.uid || `${kind}:${sourceUid}->${targetUid}:${index}`, 320),
      kind,
      sourceUid,
      targetUid,
      weight: clamp(raw?.weight ?? 1, 0, 1),
      reason: clean(raw?.reason || '', 240),
    };
  }).filter((relation) => relation.sourceUid && relation.targetUid && byUid.has(relation.sourceUid) && byUid.has(relation.targetUid) && relation.sourceUid !== relation.targetUid);

  return {
    schema: RELATIONAL_COSMOS_SCHEMA,
    projectionUid: clean(input?.projectionUid || input?.projection_uid || `cosmos-${stableHash32(dedupedNodes.map((node) => node.uid).join('|')).toString(16)}`, 220),
    nodes: dedupedNodes,
    relations,
  };
}

export function tagSimilarity(left, right) {
  const a = new Set(left?.tags || []);
  const b = new Set(right?.tags || []);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const value of a) if (b.has(value)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

export function deriveTagSimilarities(nodes, options = {}) {
  const threshold = clamp(options.threshold ?? 0.34, 0, 1);
  const maxPerNode = Math.max(1, Math.floor(Number(options.maxPerNode) || 4));
  const rows = Array.isArray(nodes) ? nodes : [];
  const candidates = [];
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      const left = rows[i], right = rows[j];
      if (!left?.uid || !right?.uid || left.type !== right.type) continue;
      const weight = tagSimilarity(left, right);
      if (weight >= threshold) candidates.push({
        uid: `similarity:tags:${left.uid}->${right.uid}`,
        kind: 'similarity', sourceUid: left.uid, targetUid: right.uid, weight,
        reason: 'shared-tags',
      });
    }
  }
  candidates.sort((a, b) => b.weight - a.weight || a.uid.localeCompare(b.uid));
  const count = new Map();
  return candidates.filter((relation) => {
    const leftCount = count.get(relation.sourceUid) || 0;
    const rightCount = count.get(relation.targetUid) || 0;
    if (leftCount >= maxPerNode || rightCount >= maxPerNode) return false;
    count.set(relation.sourceUid, leftCount + 1);
    count.set(relation.targetUid, rightCount + 1);
    return true;
  });
}

export function buildCosmosEdges(data, options = {}) {
  const normalized = data?.schema === RELATIONAL_COSMOS_SCHEMA ? data : normalizeCosmosData(data);
  const byUid = new Map(normalized.nodes.map((node) => [node.uid, node]));
  const edges = [];
  for (const node of normalized.nodes) {
    if (node.parentUid && byUid.has(node.parentUid)) {
      edges.push({ uid: `hierarchy:${node.parentUid}->${node.uid}`, kind: 'hierarchy', sourceUid: node.parentUid, targetUid: node.uid, weight: 1, reason: 'parent' });
    }
    if (node.originUid && byUid.has(node.originUid) && node.originUid !== node.parentUid) {
      edges.push({ uid: `origin:${node.originUid}->${node.uid}`, kind: 'origin', sourceUid: node.originUid, targetUid: node.uid, weight: 1, reason: 'origin' });
    }
  }
  const explicitKeys = new Set();
  for (const relation of normalized.relations) {
    const ordered = [relation.sourceUid, relation.targetUid].sort();
    explicitKeys.add(`${relation.kind}:${ordered.join('|')}`);
    edges.push(relation);
  }
  if (options.deriveTagSimilarities !== false) {
    for (const relation of deriveTagSimilarities(normalized.nodes, options.similarity || {})) {
      const ordered = [relation.sourceUid, relation.targetUid].sort();
      const key = `${relation.kind}:${ordered.join('|')}`;
      if (!explicitKeys.has(key)) edges.push(relation);
    }
  }
  return edges;
}

export function traceOrigins(data, startUid) {
  const normalized = data?.schema === RELATIONAL_COSMOS_SCHEMA ? data : normalizeCosmosData(data);
  const byUid = new Map(normalized.nodes.map((node) => [node.uid, node]));
  const visited = new Set();
  const leafToRoot = [];
  let current = byUid.get(clean(startUid, 220));
  while (current && !visited.has(current.uid)) {
    visited.add(current.uid);
    leafToRoot.push(current);
    const nextUid = current.originUid || current.parentUid;
    current = nextUid ? byUid.get(nextUid) : null;
  }
  return {
    leafToRoot,
    rootToLeaf: [...leafToRoot].reverse(),
    root: leafToRoot.at(-1) || null,
    leaf: leafToRoot[0] || null,
    cycleDetected: Boolean(current),
  };
}

export function visibilityForScale(scale) {
  const value = clamp(scale, 0.05, 8);
  return {
    scale: value,
    guilds: true,
    quests: value >= 0.72,
    beats: value >= 1.42,
    guildLabels: value >= 0.36,
    questLabels: value >= 1.0,
    beatLabels: value >= 2.05,
    strongSimilarityOnly: value < 0.9,
  };
}

export function preferredScaleForType(type) {
  return TYPE_DEFAULT_SCALE[normalizeType(type)] || 1;
}

function placeGuilds(nodes, width, height, positions) {
  const guilds = nodes.filter((node) => node.type === 'guild').sort((a, b) => a.uid.localeCompare(b.uid));
  const radiusX = Math.max(180, width * 0.34);
  const radiusY = Math.max(130, height * 0.26);
  const centerX = width / 2, centerY = height / 2;
  guilds.forEach((node, index) => {
    const base = guilds.length <= 1 ? -Math.PI / 2 : (Math.PI * 2 * index) / guilds.length - Math.PI / 2;
    const jitter = (unit(node.uid, 'guild-angle') - 0.5) * 0.22;
    const radial = 0.88 + unit(node.uid, 'guild-radius') * 0.22;
    positions.set(node.uid, {
      x: centerX + Math.cos(base + jitter) * radiusX * radial,
      y: centerY + Math.sin(base + jitter) * radiusY * radial,
      depth: 0,
    });
  });
}

function parentAnchor(node, byUid, positions, width, height) {
  const direct = node.parentUid ? positions.get(node.parentUid) : null;
  if (direct) return direct;
  const quest = node.questUid ? positions.get(node.questUid) : null;
  if (quest) return quest;
  const guild = node.guildUid ? positions.get(node.guildUid) : null;
  if (guild) return guild;
  const parent = node.parentUid ? byUid.get(node.parentUid) : null;
  if (parent && positions.has(parent.uid)) return positions.get(parent.uid);
  return { x: width / 2, y: height / 2, depth: Math.max(0, TYPE_RANK[node.type] - 1) };
}

function placeChildren(type, nodes, byUid, positions, width, height) {
  const children = nodes.filter((node) => node.type === type).sort((a, b) => a.uid.localeCompare(b.uid));
  const radius = type === 'quest' ? 112 : 52;
  const grouped = new Map();
  for (const node of children) {
    const key = node.parentUid || node.questUid || node.guildUid || '__root__';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(node);
  }
  for (const rows of grouped.values()) {
    rows.forEach((node, index) => {
      const anchor = parentAnchor(node, byUid, positions, width, height);
      const count = Math.max(1, rows.length);
      const angle = (Math.PI * 2 * index) / count + unit(node.uid, `${type}-angle`) * 0.55;
      const spread = radius * (0.7 + unit(node.uid, `${type}-radius`) * 0.55);
      positions.set(node.uid, {
        x: anchor.x + Math.cos(angle) * spread,
        y: anchor.y + Math.sin(angle) * spread,
        depth: TYPE_RANK[type],
      });
    });
  }
}

function nudgeSimilarity(positions, edges, nodesByUid, iterations = 5) {
  const similarities = edges.filter((edge) => edge.kind === 'similarity' && edge.weight > 0);
  for (let pass = 0; pass < iterations; pass += 1) {
    const deltas = new Map();
    for (const edge of similarities) {
      const leftNode = nodesByUid.get(edge.sourceUid), rightNode = nodesByUid.get(edge.targetUid);
      if (!leftNode || !rightNode || leftNode.type !== rightNode.type) continue;
      const left = positions.get(edge.sourceUid), right = positions.get(edge.targetUid);
      if (!left || !right) continue;
      const dx = right.x - left.x, dy = right.y - left.y;
      const factor = Math.min(0.075, 0.018 + edge.weight * 0.05);
      const lx = dx * factor, ly = dy * factor;
      const a = deltas.get(edge.sourceUid) || { x: 0, y: 0 };
      const b = deltas.get(edge.targetUid) || { x: 0, y: 0 };
      a.x += lx; a.y += ly; b.x -= lx; b.y -= ly;
      deltas.set(edge.sourceUid, a); deltas.set(edge.targetUid, b);
    }
    for (const [uid, delta] of deltas) {
      const point = positions.get(uid);
      if (!point) continue;
      point.x += delta.x; point.y += delta.y;
    }
  }
}

export function computeCosmosLayout(data, options = {}) {
  const normalized = data?.schema === RELATIONAL_COSMOS_SCHEMA ? data : normalizeCosmosData(data);
  const width = Math.max(420, Number(options.width) || 1200);
  const height = Math.max(360, Number(options.height) || 760);
  const byUid = new Map(normalized.nodes.map((node) => [node.uid, node]));
  const positions = new Map();
  placeGuilds(normalized.nodes, width, height, positions);
  placeChildren('quest', normalized.nodes, byUid, positions, width, height);
  placeChildren('beat', normalized.nodes, byUid, positions, width, height);
  for (const node of normalized.nodes) {
    if (positions.has(node.uid)) continue;
    positions.set(node.uid, {
      x: width * (0.18 + unit(node.uid, 'x') * 0.64),
      y: height * (0.18 + unit(node.uid, 'y') * 0.64),
      depth: TYPE_RANK[node.type],
    });
  }
  const edges = buildCosmosEdges(normalized, options);
  nudgeSimilarity(positions, edges, byUid, Math.max(0, Math.floor(Number(options.similarityIterations) || 5)));
  return { width, height, positions, edges, nodes: normalized.nodes, data: normalized };
}

export function buildCosmosProjection(input, options = {}) {
  const data = normalizeCosmosData(input);
  const layout = computeCosmosLayout(data, options);
  return {
    schema: RELATIONAL_COSMOS_SCHEMA,
    projectionUid: data.projectionUid,
    nodes: data.nodes.map((node) => ({ ...node, ...(layout.positions.get(node.uid) || {}) })),
    edges: layout.edges,
    width: layout.width,
    height: layout.height,
  };
}

export default Object.freeze({
  RELATIONAL_COSMOS_SCHEMA,
  COSMOS_NODE_TYPES,
  normalizeCosmosData,
  tagSimilarity,
  deriveTagSimilarities,
  buildCosmosEdges,
  traceOrigins,
  visibilityForScale,
  preferredScaleForType,
  computeCosmosLayout,
  buildCosmosProjection,
});
