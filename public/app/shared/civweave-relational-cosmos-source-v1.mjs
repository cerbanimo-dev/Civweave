import { normalizeCosmosData } from './civweave-relational-cosmos-v1.mjs';

const INTENTIONS_KEY = 'civweave.intentions.v127';
const DISCOVERY_KEY = 'civweave.hub-discovery.v1';
const MESH_KEY = 'federation-finder.mesh-nodes.v1';
const DIRECTORY_ENDPOINT = '/api/hub-map-nodes';
const DIRECTORY_CACHE_KEY = 'civweave.hub-map.directory.v1';
const HOST_SELECTION_KEY = 'civweave.host-node.selection.v1';
const QUEST_ARC_KEY = 'civweave.quest-arc.v1';

const clean = (value, max = 1200) => String(value ?? '').trim().slice(0, max);
const arr = (value) => Array.isArray(value) ? value : [];
const parse = (value, fallback) => { try { return JSON.parse(value) ?? fallback; } catch { return fallback; } };
function storage() { try { return globalThis.localStorage || null; } catch { return null; } }
function read(key, fallback) { const store = storage(); return store ? parse(store.getItem(key), fallback) : fallback; }
function explicitTags(raw) {
  const values = [...arr(raw?.tags), ...arr(raw?.topics), ...arr(raw?.skills), ...arr(raw?.categories), ...arr(raw?.interests)];
  const category = clean(raw?.category || raw?.topic || raw?.realm, 96); if (category) values.push(category);
  return [...new Set(values.map((value) => clean(typeof value === 'object' ? value?.name || value?.label || value?.id : value, 96).toLowerCase()).filter(Boolean))];
}
function guildId(raw) { return clean(raw?.id || raw?.guildId || raw?.hubId || raw?.nodeId || raw?.slug, 180); }
function guildName(raw) { return clean(raw?.guildName || raw?.displayName || raw?.name || raw?.label || raw?.hubName || raw?.nodeName, 180); }
function normalizeGuild(raw, source = 'discovery') {
  if (!raw || typeof raw !== 'object') return null;
  const id = guildId(raw), name = guildName(raw); if (!id || !name) return null;
  return { id, name, source, description: clean(raw?.description || raw?.summary || raw?.about || raw?.purpose || raw?.bio, 1200), tags: explicitTags(raw), quests: arr(raw?.sharedIntentions || raw?.intentions || raw?.publicIntentions || raw?.weaves || raw?.quests), raw };
}
function mergeGuild(current, next) {
  if (!current) return next;
  return { ...current, ...next, description: next.description || current.description, tags: [...new Set([...(current.tags || []), ...(next.tags || [])])], quests: next.quests?.length ? next.quests : current.quests, raw: { ...(current.raw || {}), ...(next.raw || {}) } };
}
function rowsFromPacket(value) {
  if (Array.isArray(value)) return value;
  return arr(value?.nodes || value?.guilds || value?.hubs || value?.items || (value && typeof value === 'object' ? Object.values(value) : []));
}
async function liveDirectory(options = {}) {
  if (options.includeNetwork === false || typeof fetch !== 'function' || globalThis.navigator?.onLine === false) return [];
  try {
    const response = await fetch(options.directoryEndpoint || DIRECTORY_ENDPOINT, { cache: 'no-store', headers: { accept: 'application/json' } });
    const packet = await response.json().catch(() => null);
    if (!response.ok || packet?.ok !== true || !Array.isArray(packet.nodes)) return [];
    try { storage()?.setItem(DIRECTORY_CACHE_KEY, JSON.stringify(packet)); } catch {}
    return packet.nodes;
  } catch { return []; }
}
function localIntentions() { return arr(read(INTENTIONS_KEY, [])); }
function selectedGuild() {
  const raw = read(HOST_SELECTION_KEY, null); if (!raw || typeof raw !== 'object') return null;
  const id = clean(raw.nodeId || raw.guildId || raw.hubId || raw.id, 180), name = clean(raw.displayName || raw.guildName || raw.name, 180); if (!id || !name) return null;
  return normalizeGuild({ ...raw, id, displayName: name, intentions: localIntentions() }, 'local');
}
function questId(raw, index) { return clean(raw?.id || raw?.questId || raw?.plan?.id || raw?.slug || `quest-${index}`, 180); }
function questTitle(raw) { const plan = raw?.plan && typeof raw.plan === 'object' ? raw.plan : raw; return clean(plan?.title || raw?.title || raw?.text || raw?.name || raw?.label, 180); }
function normalizeQuest(raw, index, parentGuildUid) {
  if (!raw || typeof raw !== 'object') return null;
  const id = questId(raw, index), title = questTitle(raw); if (!id || !title) return null;
  const plan = raw?.plan && typeof raw.plan === 'object' ? raw.plan : raw;
  return { uid: `quest:${parentGuildUid}:${id}`, sourceId: id, title, description: clean(plan?.outcome || raw?.description || raw?.summary || raw?.text, 1200), tags: explicitTags({ ...raw, ...plan }), weaveUid: clean(raw?.weaveUid || raw?.weave_uid, 220) || null, chordUid: clean(raw?.chordUid || raw?.chord_uid, 220) || null, raw };
}
function arcHistoryForQuest(sourceQuestId) { const state = read(QUEST_ARC_KEY, {}); const quests = state?.quests && typeof state.quests === 'object' ? state.quests : {}; return arr(quests[sourceQuestId]?.history); }
function publishedBeats(raw) { return arr(raw?.questBeats || raw?.quest_beats || raw?.beats || raw?.chronicle?.history || raw?.history); }
function beatRows(quest) { const explicit = publishedBeats(quest.raw); return explicit.length ? explicit : arcHistoryForQuest(quest.sourceId); }
function beatId(raw, index) { return clean(raw?.id || raw?.beatUid || raw?.beatId || raw?.beat_id || `${raw?.beatId || raw?.beatName || raw?.name || 'beat'}-${index}`, 180); }
function beatName(raw, index) { return clean(raw?.beatName || raw?.name || raw?.label || raw?.title || raw?.beatId || `Quest Beat ${index + 1}`, 180); }
function explicitRelationsFor(raw, sourceUid, type, uidForSourceId) {
  const rows = arr(raw?.relations || raw?.similar || raw?.similarTo || raw?.related || raw?.relatedIds);
  return rows.map((relation, index) => {
    const targetId = clean(typeof relation === 'object' ? relation?.uid || relation?.id || relation?.targetUid || relation?.targetId : relation, 220); if (!targetId) return null;
    const targetUid = targetId.includes(':') ? targetId : uidForSourceId(targetId);
    return { uid: `published-similarity:${sourceUid}->${targetUid}:${index}`, kind: 'similarity', sourceUid, targetUid, weight: typeof relation === 'object' ? Number(relation?.weight ?? relation?.similarity ?? 0.72) : 0.72, reason: clean(typeof relation === 'object' ? relation?.reason || relation?.basis : 'published-relation', 180), entityType: type };
  }).filter(Boolean);
}

export async function loadCivweaveRelationalCosmos(options = {}) {
  const byGuildId = new Map(); const addGuild = (guild) => { if (guild) byGuildId.set(guild.id, mergeGuild(byGuildId.get(guild.id), guild)); };
  rowsFromPacket(read(DISCOVERY_KEY, [])).forEach((raw) => addGuild(normalizeGuild(raw, 'discovery')));
  rowsFromPacket(read(MESH_KEY, [])).forEach((raw) => addGuild(normalizeGuild(raw, 'mesh')));
  rowsFromPacket(read(DIRECTORY_CACHE_KEY, [])).forEach((raw) => addGuild(normalizeGuild(raw, 'directory-cache')));
  (await liveDirectory(options)).forEach((raw) => addGuild(normalizeGuild(raw, 'directory'))); addGuild(selectedGuild());

  const nodes = [], relations = [], questUidBySource = new Map(), guildUidBySource = new Map(), pendingQuestRelations = [];
  for (const guild of byGuildId.values()) {
    const guildUid = `guild:${guild.id}`; guildUidBySource.set(guild.id, guildUid);
    nodes.push({ uid: guildUid, type: 'guild', label: guild.name, summary: guild.description, tags: guild.tags, weaveUid: clean(guild.raw?.weaveUid || guild.raw?.weave_uid, 220) || null, chordUid: clean(guild.raw?.chordUid || guild.raw?.chord_uid, 220) || null, metadata: { source: guild.source, sourceId: guild.id } });
    const quests = guild.quests.map((raw, index) => normalizeQuest(raw, index, guildUid)).filter(Boolean);
    for (const quest of quests) {
      questUidBySource.set(quest.sourceId, quest.uid);
      nodes.push({ uid: quest.uid, type: 'quest', label: quest.title, summary: quest.description, parentUid: guildUid, guildUid, tags: quest.tags, weaveUid: quest.weaveUid, chordUid: quest.chordUid, metadata: { sourceId: quest.sourceId } });
      pendingQuestRelations.push(...explicitRelationsFor(quest.raw, quest.uid, 'quest', (id) => questUidBySource.get(id) || `quest:${guildUid}:${id}`));
      beatRows(quest).forEach((rawBeat, beatIndex) => {
        if (!rawBeat || typeof rawBeat !== 'object') return;
        const id = beatId(rawBeat, beatIndex), uid = `beat:${quest.uid}:${id}`;
        nodes.push({ uid, type: 'beat', label: beatName(rawBeat, beatIndex), summary: clean(rawBeat?.meaning || rawBeat?.reason || rawBeat?.summary || '', 600), parentUid: quest.uid, guildUid, questUid: quest.uid, tags: explicitTags(rawBeat), weaveUid: clean(rawBeat?.weaveUid || rawBeat?.weave_uid || quest.weaveUid, 220) || null, chordUid: clean(rawBeat?.chordUid || rawBeat?.chord_uid, 220) || null, metadata: { sourceId: id, outcome: clean(rawBeat?.outcome, 40), at: clean(rawBeat?.at || rawBeat?.createdAt, 80) } });
      });
    }
    relations.push(...explicitRelationsFor(guild.raw, guildUid, 'guild', (id) => guildUidBySource.get(id) || `guild:${id}`));
  }
  relations.push(...pendingQuestRelations.map((relation) => { const suffix = relation.targetUid.split(':').at(-1); return { ...relation, targetUid: questUidBySource.get(suffix) || relation.targetUid }; }));
  return normalizeCosmosData({ projectionUid: `civweave-live-${Date.now().toString(36)}`, nodes, relations });
}

export const CIVWEAVE_COSMOS_SOURCE_KEYS = Object.freeze({ intentions: INTENTIONS_KEY, discovery: DISCOVERY_KEY, mesh: MESH_KEY, directoryCache: DIRECTORY_CACHE_KEY, hostSelection: HOST_SELECTION_KEY, questArc: QUEST_ARC_KEY });
export default Object.freeze({ loadCivweaveRelationalCosmos, CIVWEAVE_COSMOS_SOURCE_KEYS });
