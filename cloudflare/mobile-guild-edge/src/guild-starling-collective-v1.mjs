import { executeGuildQuestAction, projectGuildQuest } from './guild-quest-publications-v1.mjs';

// Portable domain only. Adapters must authenticate current membership and route every
// starter node of one Guild to the same transactional storage before calling this API.
export const GUILD_STARLING_ROUTE = '/api/node/starling';
export const GUILD_STARLING_SCHEMA = 'civweave.guild-starling.v1';
export const STARLING_POLICY = Object.freeze({ maxActiveLines: 3, maxCreatedPerWindow: 6, creationWindowMs: 24 * 60 * 60 * 1000, maxRetainedLines: 500, maxIntentionProposalsPerWindow: 6, maxPassportSkills: 64 });
const enc = new TextEncoder();
const activeStates = new Set(['reserved', 'proposed', 'published']);
const terminalStates = new Set(['completed', 'abandoned']);
const fail = (message, status = 400, code) => { throw Object.assign(new Error(message), { status, ...(code ? { code } : {}) }); };
const clean = (value, max = 180) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const identifier = (value, label = 'identifier', status = 400) => { const id = clean(value); if (!id || !/^[A-Za-z0-9:_-]+$/.test(id)) fail(`A valid ${label} is required.`, status); return id; };
const clone = value => structuredClone(value);
function publicPassport(value) { const row = clone(value); delete row.accountId; return row; }
const digest = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(value)))].map(byte => byte.toString(16).padStart(2, '0')).join('');
const empty = () => ({ version: 1, quotaModeVersion: 2, activeIds: [], recentIds: [], creationEvents: [], retainedLines: 0, passportUsers: [], intentionUsers: [], intentionEvents: [] });
const currentEvents = (events, at) => (Array.isArray(events) ? events : []).filter(value => Number.isFinite(value) && value > at - STARLING_POLICY.creationWindowMs);
const revision = value => { if (!Number.isSafeInteger(value) || value < 0) fail('expectedRevision must be a nonnegative integer.'); return value; };
function actor(member) {
  const nodeId = identifier(member?.nodeId, 'authenticated node', 401), userId = identifier(member?.userId, 'authenticated member', 401), guildId = identifier(member?.guildId || nodeId, 'authenticated Guild', 401);
  if (member?.isAI === true) fail('AI identities cannot act as human Guild members.', 403);
  return { nodeId, userId, guildId };
}
function timestamp(options) {
  const value = options.now == null ? Date.now() : typeof options.now === 'number' ? options.now : Date.parse(options.now);
  if (!Number.isFinite(value) || value < 0) fail('Server time is unavailable.', 503);
  return value;
}
function validateState(value) {
  if (!value) return empty();
  if (value.version !== 1 || !Array.isArray(value.activeIds) || !Array.isArray(value.creationEvents) || !Array.isArray(value.recentIds) || !Array.isArray(value.passportUsers) || !Array.isArray(value.intentionUsers) || !Array.isArray(value.intentionEvents) || !Number.isSafeInteger(value.retainedLines) || value.retainedLines < 0 || value.activeIds.length > STARLING_POLICY.maxActiveLines) fail('The Guild Collective state needs repair before new work can be reserved.', 503, 'STARLING_STATE_INVALID');
  return clone(value);
}
function owned(line, who) { if (!line) fail('Collective Quest line was not found.', 404); if (line.userId !== who.userId) fail('Only the member who reserved this line may change it.', 403); }
function checkRevision(line, expected) { if (revision(expected) !== line.revision) fail('The Collective Quest line changed. Refresh before continuing.', 409); }
function presentLine(line, who) {
  if (!line) return null;
  if (line.userId === who.userId || line.publicationId) return clone(line);
  return { schema: line.schema, id: line.id, nodeId: line.nodeId, guildId: line.guildId, userId: line.userId, state: line.state, revision: line.revision, createdAt: line.createdAt, updatedAt: line.updatedAt, privateDraft: true };
}
function normalizeSkills(value) {
  if (!Array.isArray(value) || value.length > STARLING_POLICY.maxPassportSkills) fail(`Share at most ${STARLING_POLICY.maxPassportSkills} explicit Passport skills.`);
  const unique = new Map();
  for (const row of value) {
    const skillId = identifier(row?.skillId, 'skill identifier'), xp = row?.xp;
    if (typeof xp !== 'number' || !Number.isFinite(xp) || xp < 0 || xp > 1e12) fail('Passport skill XP must be a finite nonnegative number.');
    if (unique.has(skillId)) fail('Passport skills must have unique identifiers.');
    if (xp > 0) unique.set(skillId, { skillId, name: clean(row.name, 120) || skillId, xp });
  }
  return [...unique.values()];
}
// Calls the existing publication owner within this already-open transaction. The
// facade keeps its revision and privacy rules without nesting storage transactions.
const scopedStorage = tx => ({ get: key => tx.get(key), put: (key, value) => tx.put(key, value), delete: key => tx.delete(key), list: options => tx.list(options), transaction: run => run(tx) });

export async function executeGuildStarlingAction(storage, member, action, input = {}, options = {}) {
  const who = actor(member), at = timestamp(options), iso = new Date(at).toISOString(), base = `guild-starling:${who.guildId}:`, stateKey = `${base}state`;
  if (!storage?.transaction) fail('Transactional Guild storage is required.', 503);
  if (input === null || typeof input !== 'object' || Array.isArray(input)) fail('A JSON object is required.');
  if (enc.encode(JSON.stringify(input)).byteLength > 96 * 1024) fail('Collective input is too large.', 413);
  if (['intention-found', 'intention-vote', 'intention-adopt'].includes(action)) fail('Founder authority and human intention voting must be verified by the Guild governance owner.', 403, 'STARLING_GOVERNANCE_REQUIRED');
  if (!['status', 'reserve', 'propose', 'confirm', 'abandon', 'complete', 'passport', 'passport-revoke', 'intention-propose'].includes(action)) fail('Unsupported Collective action.', 405);
  const reservationHash = action === 'reserve' ? await digest(`${who.guildId}\n${who.userId}\n${identifier(input.idempotencyKey, 'idempotency key')}`) : null;
  const reservationMode=action==='reserve'?(input.mode==='autonomous'?'autonomous':input.mode==null||input.mode==='manual'?'manual':fail('Invalid Collective creation mode.')):null;
  const proposed = action === 'propose' ? projectGuildQuest(input.quest) : null;
  const proposalHash = proposed ? await digest(JSON.stringify(proposed)) : null;
  const skills = action === 'passport' ? normalizeSkills(input.skills) : null;
  return storage.transaction(async tx => {
    const state = validateState(await tx.get(stateKey));
    const lineKey = id => `${base}line:${identifier(id, 'Collective line identifier')}`;
    const saveState = () => tx.put(stateKey, state);
    // Before v2 every Starling reservation was manually requested. Retain
    // its record and history, but don't make legacy manual work spend the
    // new autonomous-only active/creation quotas.
    if(state.quotaModeVersion!==2){state.activeIds=[];state.creationEvents=[];state.quotaModeVersion=2;await saveState()}
    const saveLine = async line => { await tx.put(lineKey(line.id), line); await saveState(); return line; };
    if (action === 'status') {
      const ids = [...new Set([...state.activeIds, ...state.recentIds])].slice(0, 43), lines = await Promise.all(ids.map(id => tx.get(lineKey(id))));
      if (state.activeIds.some(id => !lines.some(line => line?.id === id && activeStates.has(line.state)))) fail('Active Collective lines need repair.', 503, 'STARLING_STATE_INVALID');
      const passports = (await Promise.all(state.passportUsers.map(id => tx.get(`${base}passport:${id}`)))).filter(row => row?.consent === 'guild-planning' && row?.schema === 'civweave.guild-passport-claim.v1');
      // A linked account is supplied only by an authenticated adapter; otherwise
      // Passport IDs are device claims and never proof of unique humans.
      const distinct = new Map();
      for (const row of passports) { const key = row.accountId ? `account:${row.accountId}` : `passport-claim:${row.passportId}`; if (!distinct.has(key) || distinct.get(key).updatedAt < row.updatedAt) distinct.set(key, row); }
      const intentions = (await Promise.all(state.intentionUsers.slice(-40).map(id => tx.get(`${base}intention:${id}`)))).filter(Boolean);
      const knownMemberCount = Number.isSafeInteger(options.knownMemberCount) && options.knownMemberCount >= 0 ? options.knownMemberCount : null;
      const events = currentEvents(state.creationEvents, at);
      return { ok: true, schema: GUILD_STARLING_SCHEMA, nodeId: who.nodeId, guildId: who.guildId, policy: STARLING_POLICY, activeCount: state.activeIds.length, availableSlots: STARLING_POLICY.maxActiveLines - state.activeIds.length, createdInWindow: events.length, creationWindowEndsAt: events.length ? new Date(Math.min(...events) + STARLING_POLICY.creationWindowMs).toISOString() : null, lines: lines.filter(Boolean).map(line => presentLine(line, who)), context: { schema: 'civweave.guild-starling-context.v1', heroCount: null, reportedPassportHeroes: distinct.size || null, claimedPassportCount: distinct.size, knownMemberCount, authoritativeGuildSize: knownMemberCount, guildmasterVerified: false, skillAuthority: 'authenticated-member-device-claim', passports: [...distinct.values()].map(publicPassport), skillsCoverage: passports.length ? 'consenting-member-claims-only' : 'unknown', drivingIntention: null, intentions, humanGovernanceRequired: true }, requiresPostingConfirmation: true };
    }
    if (action === 'reserve') {
      const title = clean(input.title, 240); if (!title) fail('A Collective Quest line title is required.');
      const id = `starling-line:${reservationHash}`, key = lineKey(id), prior = await tx.get(key);
      if (prior) { if (prior.title !== title||!(prior.creationMode===reservationMode||prior.creationMode==null&&reservationMode==='manual')) fail('That idempotency key already names a different Quest line or mode.', 409); return { ok: true, line: clone(prior), idempotent: true }; }
      const events = currentEvents(state.creationEvents, at);
      if (reservationMode==='autonomous'&&state.activeIds.length >= STARLING_POLICY.maxActiveLines) fail('Complete or abandon an active autonomous Collective project before creating another.', 409, 'STARLING_ACTIVE_LIMIT');
      if (reservationMode==='autonomous'&&events.length >= STARLING_POLICY.maxCreatedPerWindow) fail('This Guild has reached six autonomous project creations in the rolling last 24 hours. Manual plans remain unlimited.', 429, 'STARLING_CREATION_LIMIT');
      if (state.retainedLines >= STARLING_POLICY.maxRetainedLines) fail('Collective Quest history storage is full. Existing work remains available.', 409, 'STARLING_HISTORY_LIMIT');
      const line = { schema: 'civweave.guild-starling-line.v1', id, ...who, title, state: 'reserved', revision: 1, origin: reservationMode==='autonomous'?'ai-generated-autonomous':'human-requested-ai-draft', creationMode:reservationMode, createdAt: iso, updatedAt: iso };
      if(reservationMode==='autonomous')state.activeIds.push(id); state.recentIds = [id, ...state.recentIds.filter(value => value !== id)].slice(0, 40); state.creationEvents = reservationMode==='autonomous'?[...events, at]:events; state.retainedLines++;
      await saveLine(line); return { ok: true, line: clone(line), idempotent: false };
    }
    if (action === 'passport') {
      if (input.consent !== 'guild-planning') fail('Explicit consent is required to share Passport skill claims with Guild planning.', 403, 'STARLING_PASSPORT_CONSENT_REQUIRED');
      const passportId = clean(input.passportId); if (!/^[A-Za-z0-9:._-]{6,180}$/.test(passportId)) fail('A valid Passport identifier is required.');
      if (!state.passportUsers.includes(who.userId) && state.passportUsers.length >= 500) fail('Guild Passport claim storage is full.', 409);
      const passport = { schema: 'civweave.guild-passport-claim.v1', ...who, passportId, ...(clean(options.accountId) ? { accountId: clean(options.accountId) } : {}), skills, skillsKnown: skills.length > 0, consent: 'guild-planning', authority: 'authenticated-member-device-claim', verified: false, updatedAt: iso };
      if (!state.passportUsers.includes(who.userId)) state.passportUsers.push(who.userId);
      await tx.put(`${base}passport:${who.userId}`, passport); await saveState(); return { ok: true, passport: publicPassport(passport) };
    }
    if (action === 'passport-revoke') {
      if (input.confirmed !== true) fail('Confirm before withdrawing your Guild planning claim.', 403);
      const removed = await tx.delete(`${base}passport:${who.userId}`); state.passportUsers = state.passportUsers.filter(id => id !== who.userId); await saveState();
      return { ok: true, revoked: true, idempotent: !removed };
    }
    if (action === 'intention-propose') {
      if (input.confirmed !== true) fail('Confirm before posting this Guild Intention proposal.', 403, 'STARLING_POST_CONFIRMATION_REQUIRED');
      const text = clean(input.text, 4000); if (!text) fail('A Guild Intention proposal is required.');
      const key = `${base}intention:${who.userId}`, prior = await tx.get(key), expected = revision(input.expectedRevision);
      if (prior?.text === text && [prior.revision, prior.revision - 1].includes(expected)) return { ok: true, intention: clone(prior), idempotent: true };
      if (expected !== (prior?.revision || 0)) fail('The Guild Intention proposal changed. Refresh before posting.', 409);
      const events = currentEvents(state.intentionEvents, at);
      if (events.length >= STARLING_POLICY.maxIntentionProposalsPerWindow) fail('This Guild has reached its six Intention proposals per rolling 24 hours.', 429, 'STARLING_INTENTION_LIMIT');
      if (!state.intentionUsers.includes(who.userId) && state.intentionUsers.length >= 500) fail('Guild Intention proposal storage is full.', 409);
      const intention = { schema: 'civweave.guild-intention-proposal.v1', ...who, text, state: 'proposed', adopted: false, authority: 'human-proposal', revision: (prior?.revision || 0) + 1, createdAt: prior?.createdAt || iso, updatedAt: iso };
      state.intentionEvents = [...events, at]; if (!state.intentionUsers.includes(who.userId)) state.intentionUsers.push(who.userId);
      await tx.put(key, intention); await saveState(); return { ok: true, intention, idempotent: false };
    }
    const id = identifier(input.id, 'Collective line identifier'), line = await tx.get(lineKey(id)); owned(line, who);
    if (action === 'confirm' && input.confirmed !== true) fail('Confirm the exact proposal before posting to the Guild.', 403, 'STARLING_POST_CONFIRMATION_REQUIRED');
    if (action === 'confirm' && line.state === 'published' && line.proposalHash === clean(input.proposalHash, 128) && [line.revision, line.revision - 1].includes(revision(input.expectedRevision))) {
      const publication = await executeGuildQuestAction(scopedStorage(tx), who, 'read', { id: line.publicationId });
      return { ok: true, line: clone(line), publication: publication.publication, idempotent: true };
    }
    if ((action === 'abandon' && line.state === 'abandoned' && clean(input.reason, 1000) === line.abandonReason || action === 'complete' && line.state === 'completed') && [line.revision, line.revision - 1].includes(revision(input.expectedRevision))) return { ok: true, line: clone(line), idempotent: true };
    checkRevision(line, input.expectedRevision);
    if (!activeStates.has(line.state)) { if (terminalStates.has(line.state)) fail('A completed or abandoned Collective Quest line cannot be reopened.', 409); fail('The Collective Quest line state is unavailable.', 503, 'STARLING_STATE_INVALID'); }
    if (action === 'propose') {
      if (!['reserved', 'proposed'].includes(line.state)) fail('A posted Quest line cannot be replaced by a private proposal.', 409);
      if (line.proposalHash === proposalHash) return { ok: true, line: clone(line), idempotent: true };
      Object.assign(line, { proposal: proposed, proposalHash, provider: clean(input.provider, 80) || 'unknown', model: clean(input.model, 180) || 'unknown', state: 'proposed', revision: line.revision + 1, updatedAt: iso });
      await saveLine(line); return { ok: true, line: clone(line), idempotent: false };
    }
    if (action === 'confirm') {
      if (line.state !== 'proposed' || !line.proposal || line.proposalHash !== clean(input.proposalHash, 128)) fail('The exact saved proposal must be reviewed before posting.', 409);
      const result = await executeGuildQuestAction(scopedStorage(tx), who, 'publish', { quest: line.proposal, expectedRevision: 0 });
      Object.assign(line, { state: 'published', publicationId: result.publication.id, publicationRevision: result.publication.revision, confirmedBy: who.userId, confirmedAt: iso, revision: line.revision + 1, updatedAt: iso });
      await saveLine(line); return { ok: true, line: clone(line), publication: result.publication, idempotent: false };
    }
    if (action === 'complete') {
      const proof = options.verifiedCompletion;
      if (!line.proposal || proof?.authority !== 'canonical-quest-proof' || proof.state !== 'completed' || proof.questId !== line.proposal.id || !clean(proof.receiptId, 240)) fail('Matching canonical Quest completion evidence is required to complete a Collective line.', 403, 'STARLING_COMPLETION_PROOF_REQUIRED');
      line.completionReceiptId = clean(proof.receiptId, 240); line.completedAt = iso;
    } else if (action === 'abandon') {
      if (line.publicationId) {
        const current = await executeGuildQuestAction(scopedStorage(tx), who, 'read', { id: line.publicationId });
        const withdrawn = await executeGuildQuestAction(scopedStorage(tx), who, 'withdraw', { id: line.publicationId, expectedRevision: current.publication.revision });
        line.publicationRevision = withdrawn.publication.revision;
      }
      line.abandonReason = clean(input.reason, 1000); line.abandonedAt = iso;
    }
    line.state = action === 'complete' ? 'completed' : 'abandoned'; line.revision++; line.updatedAt = iso; state.activeIds = state.activeIds.filter(value => value !== id);
    await saveLine(line); return { ok: true, line: clone(line), idempotent: false };
  });
}
