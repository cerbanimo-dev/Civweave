const STATUS_ORDER = ['draft','active','fulfilled','settled','repair','cancelled'];

export function createAgreementFromProposal(proposal, thread, people = [], options = {}) {
  if (!proposal || !thread) throw new Error('Proposal and thread are required');
  const createdAt = options.createdAt || new Date().toISOString();
  const actorId = options.actorId || 'me';
  const counterpartyId = thread.ownerId === actorId ? proposal.fromId : thread.ownerId;
  const dueAt = parseLooseDueDate(proposal.when || thread.when, createdAt);
  const baseMilestone = {
    id: options.milestoneId || `milestone_${proposal.id}`,
    title: conciseMilestoneTitle(proposal.message || thread.title),
    ownerId: proposal.fromId,
    dueAt,
    status: 'pending',
    completedAt: '',
    evidenceIds: []
  };
  return normalizeAgreement({
    id: options.id || `agreement_${proposal.id}`,
    threadId: thread.id,
    proposalId: proposal.id,
    title: thread.title,
    category: thread.category || 'Other',
    participants: uniqueParticipants([
      { personId: actorId, role: thread.ownerId === actorId ? 'requester' : 'provider', confirmedAt: '' },
      { personId: counterpartyId, role: thread.ownerId === counterpartyId ? 'requester' : 'provider', confirmedAt: '' }
    ]),
    terms: {
      scope: proposal.message || thread.description || '',
      compensation: proposal.compensation || thread.amountLabel || 'Open terms',
      timing: proposal.when || thread.when || 'Flexible',
      conditions: proposal.conditions || '',
      methods: Array.isArray(thread.methods) ? [...thread.methods] : []
    },
    milestones: [baseMilestone],
    evidence: [],
    settlement: {
      status: 'pending',
      method: proposal.compensation || thread.methods?.[0] || '',
      amount: inferAmount(proposal.compensation, thread.amount),
      currency: 'USD',
      note: '',
      recordedAt: ''
    },
    recurrence: { enabled: false, cadence: '', nextAt: '' },
    repair: { status: 'none', issue: '', requestedRemedy: '', openedAt: '', resolvedAt: '' },
    reviews: [],
    status: 'draft',
    createdAt,
    updatedAt: createdAt
  });
}

export function normalizeAgreement(raw = {}) {
  const createdAt = raw.createdAt || new Date().toISOString();
  const agreement = {
    id: String(raw.id || `agreement_${Date.now()}`),
    threadId: String(raw.threadId || ''),
    proposalId: String(raw.proposalId || ''),
    title: String(raw.title || 'Exchange agreement'),
    category: String(raw.category || 'Other'),
    participants: uniqueParticipants(Array.isArray(raw.participants) ? raw.participants : []),
    terms: {
      scope: String(raw.terms?.scope || ''),
      compensation: String(raw.terms?.compensation || 'Open terms'),
      timing: String(raw.terms?.timing || 'Flexible'),
      conditions: String(raw.terms?.conditions || ''),
      methods: Array.isArray(raw.terms?.methods) ? raw.terms.methods.map(String) : []
    },
    milestones: Array.isArray(raw.milestones) ? raw.milestones.map((item, index) => ({
      id: String(item.id || `milestone_${index}_${Date.now()}`),
      title: String(item.title || `Milestone ${index + 1}`),
      ownerId: String(item.ownerId || 'me'),
      dueAt: String(item.dueAt || ''),
      status: ['pending','complete','waived'].includes(item.status) ? item.status : 'pending',
      completedAt: String(item.completedAt || ''),
      evidenceIds: Array.isArray(item.evidenceIds) ? item.evidenceIds.map(String) : []
    })) : [],
    evidence: Array.isArray(raw.evidence) ? raw.evidence.map((item, index) => ({
      id: String(item.id || `evidence_${index}_${Date.now()}`),
      kind: ['note','link','receipt','photo-reference'].includes(item.kind) ? item.kind : 'note',
      label: String(item.label || 'Evidence'),
      url: String(item.url || ''),
      note: String(item.note || ''),
      addedBy: String(item.addedBy || 'me'),
      createdAt: String(item.createdAt || createdAt)
    })) : [],
    settlement: {
      status: ['pending','recorded','settled','waived'].includes(raw.settlement?.status) ? raw.settlement.status : 'pending',
      method: String(raw.settlement?.method || ''),
      amount: Number.isFinite(Number(raw.settlement?.amount)) ? Number(raw.settlement.amount) : null,
      currency: String(raw.settlement?.currency || 'USD'),
      note: String(raw.settlement?.note || ''),
      recordedAt: String(raw.settlement?.recordedAt || '')
    },
    recurrence: {
      enabled: Boolean(raw.recurrence?.enabled),
      cadence: String(raw.recurrence?.cadence || ''),
      nextAt: String(raw.recurrence?.nextAt || '')
    },
    repair: {
      status: ['none','open','resolved'].includes(raw.repair?.status) ? raw.repair.status : 'none',
      issue: String(raw.repair?.issue || ''),
      requestedRemedy: String(raw.repair?.requestedRemedy || ''),
      openedAt: String(raw.repair?.openedAt || ''),
      resolvedAt: String(raw.repair?.resolvedAt || '')
    },
    reviews: Array.isArray(raw.reviews) ? raw.reviews.map((review, index) => normalizeReview(review, index, createdAt)) : [],
    status: STATUS_ORDER.includes(raw.status) ? raw.status : 'draft',
    createdAt,
    updatedAt: raw.updatedAt || createdAt
  };
  return deriveAgreementStatus(agreement);
}

export function agreementProgress(agreement) {
  const milestones = agreement?.milestones || [];
  if (!milestones.length) return 0;
  const done = milestones.filter((item) => item.status === 'complete' || item.status === 'waived').length;
  return Math.round((done / milestones.length) * 100);
}

export function deriveAgreementStatus(agreement) {
  const next = agreement;
  if (next.status === 'cancelled') return next;
  if (next.repair?.status === 'open') {
    next.status = 'repair';
    return next;
  }
  const confirmed = next.participants.filter((item) => item.confirmedAt).length;
  const progress = agreementProgress(next);
  if (next.settlement?.status === 'settled' && progress === 100) next.status = 'settled';
  else if (progress === 100) next.status = 'fulfilled';
  else if (confirmed > 0) next.status = 'active';
  else next.status = 'draft';
  return next;
}

export function addMilestone(agreement, milestone, now = new Date().toISOString()) {
  agreement.milestones.push({
    id: milestone.id || `milestone_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    title: String(milestone.title || 'Milestone'),
    ownerId: String(milestone.ownerId || 'me'),
    dueAt: String(milestone.dueAt || ''),
    status: 'pending',
    completedAt: '',
    evidenceIds: []
  });
  agreement.updatedAt = now;
  return deriveAgreementStatus(agreement);
}

export function completeMilestone(agreement, milestoneId, now = new Date().toISOString()) {
  const milestone = agreement.milestones.find((item) => item.id === milestoneId);
  if (!milestone) throw new Error('Milestone not found');
  milestone.status = milestone.status === 'complete' ? 'pending' : 'complete';
  milestone.completedAt = milestone.status === 'complete' ? now : '';
  agreement.updatedAt = now;
  return deriveAgreementStatus(agreement);
}

export function addEvidence(agreement, evidence, milestoneId = '', now = new Date().toISOString()) {
  const record = {
    id: evidence.id || `evidence_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    kind: evidence.kind || (evidence.url ? 'link' : 'note'),
    label: String(evidence.label || 'Evidence'),
    url: String(evidence.url || ''),
    note: String(evidence.note || ''),
    addedBy: String(evidence.addedBy || 'me'),
    createdAt: now
  };
  agreement.evidence.push(record);
  const milestone = agreement.milestones.find((item) => item.id === milestoneId);
  if (milestone && !milestone.evidenceIds.includes(record.id)) milestone.evidenceIds.push(record.id);
  agreement.updatedAt = now;
  return record;
}

export function recordSettlement(agreement, settlement, now = new Date().toISOString()) {
  agreement.settlement = {
    status: settlement.status === 'waived' ? 'waived' : 'settled',
    method: String(settlement.method || agreement.settlement?.method || ''),
    amount: Number.isFinite(Number(settlement.amount)) ? Number(settlement.amount) : agreement.settlement?.amount ?? null,
    currency: String(settlement.currency || agreement.settlement?.currency || 'USD'),
    note: String(settlement.note || ''),
    recordedAt: now
  };
  agreement.updatedAt = now;
  return deriveAgreementStatus(agreement);
}

export function openRepair(agreement, repair, now = new Date().toISOString()) {
  agreement.repair = {
    status: 'open',
    issue: String(repair.issue || ''),
    requestedRemedy: String(repair.requestedRemedy || ''),
    openedAt: now,
    resolvedAt: ''
  };
  agreement.updatedAt = now;
  return deriveAgreementStatus(agreement);
}

export function resolveRepair(agreement, note = '', now = new Date().toISOString()) {
  agreement.repair.status = 'resolved';
  agreement.repair.resolvedAt = now;
  if (note) agreement.repair.requestedRemedy = `${agreement.repair.requestedRemedy}${agreement.repair.requestedRemedy ? ' · ' : ''}Resolution: ${note}`;
  agreement.updatedAt = now;
  return deriveAgreementStatus(agreement);
}

export function addReview(agreement, review, now = new Date().toISOString()) {
  const normalized = normalizeReview({ ...review, createdAt: now }, agreement.reviews.length, now);
  agreement.reviews.push(normalized);
  agreement.updatedAt = now;
  return normalized;
}

export function advanceRecurringAgreement(agreement, now = new Date().toISOString()) {
  if (!agreement.recurrence?.enabled || !agreement.recurrence.cadence) throw new Error('Agreement is not recurring');
  const nextAt = advanceDate(agreement.recurrence.nextAt || now, agreement.recurrence.cadence);
  agreement.milestones = agreement.milestones.map((item) => ({ ...item, status: 'pending', completedAt: '', evidenceIds: [] }));
  // Evidence remains in custody across cycles; milestone links reset for the new cycle.
  agreement.settlement = { ...agreement.settlement, status: 'pending', note: '', recordedAt: '' };
  agreement.repair = { status: 'none', issue: '', requestedRemedy: '', openedAt: '', resolvedAt: '' };
  agreement.recurrence.nextAt = nextAt;
  agreement.status = 'active';
  agreement.updatedAt = now;
  return agreement;
}

export function createLedgerEvent(type, entityType, entityId, actorId = 'me', payload = {}, timestamp = new Date().toISOString()) {
  return {
    id: `event_${timestamp.replace(/\D/g,'')}_${Math.random().toString(16).slice(2)}`,
    type: String(type),
    entityType: String(entityType),
    entityId: String(entityId),
    actorId: String(actorId),
    timestamp,
    payload: structuredCloneSafe(payload)
  };
}

export function buildCommonweaveBundle(state, meta = {}) {
  const relevantPersonIds = new Set(['me']);
  for (const thread of state.threads || []) relevantPersonIds.add(thread.ownerId);
  for (const agreement of state.agreements || []) for (const participant of agreement.participants || []) relevantPersonIds.add(participant.personId);
  const people = [state.profile, ...(state.people || [])].filter((person) => relevantPersonIds.has(person.id));
  return {
    format: 'commonweave.exchange-bundle',
    schemaVersion: '1.0.0',
    exportedAt: meta.exportedAt || new Date().toISOString(),
    source: { app: 'Fellowfare', version: meta.version || state.version || '0.3.0', nodeId: meta.nodeId || state.profile?.id || 'local-node' },
    entities: {
      people: people.map(stripSecrets),
      threads: structuredCloneSafe(state.threads || []),
      proposals: structuredCloneSafe(state.proposals || []),
      assemblies: structuredCloneSafe(state.assemblies || []),
      agreements: (state.agreements || []).map(normalizeAgreement)
    },
    events: structuredCloneSafe(state.ledgerEvents || []),
    mapping: {
      thread: 'market.intent',
      proposal: 'market.proposal',
      assembly: 'coordination.party',
      agreement: 'work.contract',
      milestone: 'work.unit',
      evidence: 'proof.item',
      settlement: 'value.settlement',
      review: 'trust.attestation'
    }
  };
}

export function trustSnapshotFromReviews(base = {}, reviews = []) {
  const keys = ['communication','reliability','quality','repair'];
  const next = { communication: Number(base.communication || 0), reliability: Number(base.reliability || 0), quality: Number(base.quality || 0), repair: Number(base.repair || 0) };
  if (!reviews.length) return next;
  for (const key of keys) {
    const values = reviews.map((review) => Number(review.ratings?.[key])).filter((value) => Number.isFinite(value) && value > 0);
    if (!values.length) continue;
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    const scaled = average * 20;
    next[key] = Math.round((next[key] * 2 + scaled) / 3);
  }
  return next;
}

function normalizeReview(review = {}, index = 0, createdAt = new Date().toISOString()) {
  const clamp = (value) => Math.max(1, Math.min(5, Number(value) || 3));
  return {
    id: String(review.id || `review_${index}_${Date.now()}`),
    fromId: String(review.fromId || 'me'),
    toId: String(review.toId || ''),
    context: String(review.context || ''),
    ratings: {
      communication: clamp(review.ratings?.communication),
      reliability: clamp(review.ratings?.reliability),
      quality: clamp(review.ratings?.quality),
      repair: clamp(review.ratings?.repair)
    },
    note: String(review.note || ''),
    createdAt: String(review.createdAt || createdAt)
  };
}

function uniqueParticipants(participants) {
  const seen = new Set();
  return participants.filter((item) => item?.personId && !seen.has(item.personId) && seen.add(item.personId)).map((item) => ({
    personId: String(item.personId),
    role: String(item.role || 'participant'),
    confirmedAt: String(item.confirmedAt || '')
  }));
}

function conciseMilestoneTitle(text) {
  const compact = String(text || '').replace(/\s+/g,' ').trim();
  return compact.length > 72 ? `${compact.slice(0,69)}…` : compact || 'Complete agreed exchange';
}

function inferAmount(text, fallback) {
  const match = String(text || '').replace(/,/g,'').match(/\$\s*(\d+(?:\.\d{1,2})?)/);
  if (match) return Number(match[1]);
  return Number.isFinite(Number(fallback)) ? Number(fallback) : null;
}

function parseLooseDueDate(text, createdAt) {
  const raw = String(text || '').trim();
  if (!raw) return '';
  const explicit = new Date(raw);
  if (!Number.isNaN(explicit.getTime())) return explicit.toISOString();
  const base = new Date(createdAt);
  if (/tomorrow/i.test(raw)) base.setDate(base.getDate() + 1);
  else if (/next week/i.test(raw)) base.setDate(base.getDate() + 7);
  else if (/week/i.test(raw)) base.setDate(base.getDate() + 7);
  else return '';
  return base.toISOString();
}

function advanceDate(value, cadence) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  if (cadence === 'weekly') date.setDate(date.getDate() + 7);
  else if (cadence === 'biweekly') date.setDate(date.getDate() + 14);
  else if (cadence === 'monthly') date.setMonth(date.getMonth() + 1);
  else if (cadence === 'quarterly') date.setMonth(date.getMonth() + 3);
  return date.toISOString();
}

function stripSecrets(person = {}) {
  const copy = structuredCloneSafe(person);
  if (copy.settings?.ai) delete copy.settings.ai.apiKey;
  return copy;
}

function structuredCloneSafe(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}
