export const APP_VERSION = '0.3.3';
export const SCHEMA_VERSION = 'anarchadia.community-record.v1';
export const BUNDLE_VERSION = 'anarchadia.bundle.v1';

export const ARTICLE_INDEX = [
  { article: '01', title: 'Purpose, Identity, and Non-Goals', hash: '42be14dcc867d42050a79d2fe94be6e179162b18720ef4871341c2ca1a7088bc', principle: 'Optional, local-first, bounded charter journey; software records declarations but certifies no legitimacy.' },
  { article: '02', title: 'Human Agency and Voluntary Association', hash: 'a0a82dcd2f67048a531fa0a9ce2392b29f2c036f64e2f5a6f3913cdf814fb70b', principle: 'Participation, refusal, assistance, withdrawal, export, and exit must have equal effect.' },
  { article: '03', title: 'Membership, Identity, Pseudonymity, and Recovery', hash: '5e51380c3ccc7841bbb59aa488e5fd005dd9c2c26520f8ec0c48707afa851fa0', principle: 'Membership is a contestable human procedure; credentials do not establish belonging or legitimacy.' },
  { article: '04', title: 'Rights of Persons and Duties of Institutions', hash: 'b06d75ab86c493153b63c8802acaaa5dc437500ec21181b29935cec1c77ade84', principle: 'Every right needs funded, replaceable duty roles, deadlines, remedies, and offline invocation.' },
  { article: '05', title: 'Transparency, Privacy, and the Commons', hash: '74bb008ff532a08bf93d228943d5da2bcca88bbd09e9c44067a31ceea74a55f0', principle: 'Private by default for people; accountable by default for institutions.' },
  { article: '06', title: 'Governance Primitives', hash: '76f1ade53af4320914998f3ebe22efa47df4e9f9ee76b21417621ba481f68f6f', principle: 'Compare procedure cards without popularity cues or binding defaults.' },
  { article: '07', title: 'Delegation, Mandates, Administration, and Recall', hash: 'cf33fd62be2c1825ab1731e0bbb1ce156b9a0d4564be14f00deb7ab2bd9197d8', principle: 'Power is narrow, visible, expiring, recallable, and replaceable.' },
  { article: '12', title: 'Technical Sovereignty and Architecture', hash: '41d6a2e19f5d5dffa865531c97c9dde2334e82c42353f27523a1ad440fc5a50b', principle: 'L0 manual and L1 file exchange remain usable without remote services.' },
  { article: '13', title: 'Security and Threat Model', hash: 'd932e3da7ed91d60db10663a7038b77756d9b7cfab3b0f4ed2423adceb055cf9', principle: 'Unresolved rights-critical threats block scope or deployment.' },
  { article: '14', title: 'Ecosystem Boundaries', hash: 'b75d6f2be7b0eb89696da5c6be1df0f0279811f6f814a8ba5981af20166d2d00', principle: 'Bridges are default-off, one-purpose, one-direction, minimized, expiring contracts.' },
  { article: '15', title: 'Federation, Subsidiarity, Exit, and Fork', hash: 'bb8e1f78962c2886656b70dca78673b6b9dfc88f2357a54778c18bfaa6a1aeee', principle: 'Federation is deferred; exit and fork cannot depend on federation permission.' },
  { article: '17', title: 'MVP Constitution', hash: '940ceaed5a8c0ad47a53d3bfe9f1e1509e1acdbc26670f980f1b332539a19616', principle: 'Synthetic L0/L1 capability packet first, with no telemetry and no legitimacy claims.' },
  { article: '18', title: 'Amendment, Experimentation, and Ratification', hash: 'aafd503b460ccf52fc42546eff4c569af9e3e510b2917b30877200f5c9e06b58', principle: 'Exact diffs, explicit enrollment, expiry, rollback, dissent, and residual effects remain inspectable.' }
];

export const READINESS_ITEMS = [
  { id: 'bottleneck', label: 'Named community bottleneck documented', group: 'Need' },
  { id: 'comparator', label: 'Paper, existing-tool, or no-software comparator recorded', group: 'Need' },
  { id: 'noBuild', label: 'No-build choice remains available', group: 'Need' },
  { id: 'laborPower', label: 'Function-level labor and power register completed', group: 'Power' },
  { id: 'replaceableRoles', label: 'Primary and backup roles are replaceable', group: 'Power' },
  { id: 'offlineJourney', label: 'Offline charter journey exercised', group: 'Continuity' },
  { id: 'selectiveExport', label: 'Selective export and clean restore exercised', group: 'Continuity' },
  { id: 'nondigitalPath', label: 'Equal-effect assisted or non-digital path exercised', group: 'Agency' },
  { id: 'consequenceComprehension', label: 'Consequences and refusal paths are locatable', group: 'Agency' },
  { id: 'dataAuthorityMap', label: 'Data and authority map completed', group: 'Privacy' },
  { id: 'threatModel', label: 'Threat register has dispositions and residual uncertainty', group: 'Security' },
  { id: 'sharedDevice', label: 'Shared-device and coercion scenario exercised', group: 'Security' },
  { id: 'accessibility', label: 'Accessibility, language, stress, and connectivity conditions exercised', group: 'Access' },
  { id: 'adminReplacement', label: 'Non-original administrator replacement drill completed', group: 'Continuity' },
  { id: 'humanApproval', label: 'HUMAN_APPROVAL.md procedural gate completed', group: 'Authority' }
];

export const HIGH_IMPACT_TERMS = [
  'necessities', 'housing', 'food', 'medicine', 'wage', 'payroll', 'resource allocation',
  'exclusion', 'expel', 'sanction', 'emergency power', 'identity', 'biometric', 'decryption',
  'unmask', 'production', 'debt', 'eligibility', 'standing', 'membership', 'private ballot',
  'delegation', 'recall', 'budget', 'survival', 'care access'
];

export function uid(prefix = 'ref') {
  const bytes = new Uint8Array(8);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return `${prefix}_${Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('')}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function makeAudit(action, detail = {}, actorRole = 'local-steward') {
  return {
    id: uid('audit'),
    at: nowIso(),
    action,
    actorRole,
    detail,
    note: 'Timestamp is informational provenance only and conveys no civic priority or authority.'
  };
}

export function emptyState({ communityName = 'Unnamed candidate community', mode = 'synthetic' } = {}) {
  const createdAt = nowIso();
  return {
    meta: {
      schemaVersion: SCHEMA_VERSION,
      appVersion: APP_VERSION,
      communityRef: uid('community'),
      communityName,
      mode,
      createdAt,
      updatedAt: createdAt,
      syntheticOnly: mode === 'synthetic',
      authorityDisclaimer: 'This software records declared procedures and outcomes. It does not certify identity, legitimacy, consensus, rights compliance, authority, or ratification.'
    },
    admission: {
      namedJourney: '',
      actualBottleneck: '',
      affectedPeople: '',
      comparator: '',
      whySoftware: '',
      noBuildPath: 'The community may choose paper, existing tools, facilitation, or no software.',
      stopCondition: 'Any safety, standing, comprehension, continuity, transcription, labor, replacement, or rights-critical failure narrows or stops the pilot.'
    },
    charter: {
      id: uid('charter'),
      title: `${communityName} provisional charter`,
      status: 'draft',
      version: 1,
      preamble: '',
      sections: [],
      versions: [],
      conflicts: []
    },
    proposals: [],
    outcomes: [],
    dissents: [],
    rights: [],
    roles: [],
    procedureCards: [],
    dataMap: [],
    threats: [],
    receipts: [],
    amendments: [],
    bridgeContracts: [],
    readiness: Object.fromEntries(READINESS_ITEMS.map(item => [item.id, { complete: false, note: '', evidence: '' }])),
    humanApproval: {
      reviewingPeople: '',
      community: '',
      scope: '',
      procedure: '',
      authorization: '',
      dissent: '',
      conditions: '',
      date: '',
      complete: false
    },
    aiDrafts: [],
    imports: [],
    civicSystem: {
      petitionSignals: [],
      discussions: [],
      workgroups: [],
      bulletins: [],
      federationMessages: [],
      adoptionSignals: [],
      experiments: [],
      rollbacks: [],
      dismissedAlerts: []
    },
    audit: [makeAudit('workspace.created', { mode, communityName })]
  };
}

export function syntheticFixture() {
  const state = emptyState({ communityName: 'Lantern Commons', mode: 'synthetic' });
  state.admission = {
    namedJourney: 'Compare, draft, deliberate, and export a first community meeting charter.',
    actualBottleneck: 'Meeting decisions are preserved in scattered notes and members cannot reliably locate the current procedure or dissent.',
    affectedPeople: 'Synthetic delegates, facilitators, note keepers, and people using assisted or paper participation paths.',
    comparator: 'Paper binder plus shared text files on removable storage.',
    whySoftware: 'A local workspace may lower version confusion while preserving file exchange and paper-equivalent records.',
    noBuildPath: 'Continue using a paper binder and numbered text files. The software may be abandoned without loss of standing.',
    stopCondition: 'Stop if people cannot inspect, refuse, export, restore, contest, or replace the operator with equal effect.'
  };
  state.charter.preamble = 'We gather voluntarily to coordinate shared spaces while preserving dissent, refusal, exit, and the possibility of no software.';
  state.charter.sections = [
    { id: uid('section'), title: 'Participation', text: 'Participation is voluntary. Refusal, assistance, deferment, dissent, export, and exit shall not reduce standing or access to the operative record.', order: 1 },
    { id: uid('section'), title: 'Decision records', text: 'The commons may record its declared procedure and outcome. The record does not certify legitimacy, consensus, or the inner consent of any person.', order: 2 },
    { id: uid('section'), title: 'Dissent and reconsideration', text: 'Dissent may be preserved at the dissenter-chosen disclosure level. Any proposal may name an expiry or reconsideration condition.', order: 3 },
    { id: uid('section'), title: 'Exit and fork', text: 'Any authorized participant may export the community record. No maintainer or host may become the sole usable custodian.', order: 4 }
  ];
  state.roles = [
    {
      id: uid('role'), name: 'Record steward', status: 'proposed', scope: 'Maintain readable local copies and prepare selective exports.',
      permitted: 'Read and append declared records; prepare exports requested by the community.',
      prohibited: 'Certify legitimacy, erase dissent, inspect protected evidence, block export, or decide a dispute.',
      backupRole: 'Alternate record steward', expiry: 'After the pilot review', recallPath: 'Any declared community recall path',
      replacementPath: 'Cold restore the exported bundle on another device and transfer no exclusive secret.'
    },
    {
      id: uid('role'), name: 'Accessibility facilitator', status: 'proposed', scope: 'Provide participant-chosen assistance and alternate formats.',
      permitted: 'Explain interface text and transcribe an act exactly with participant review.',
      prohibited: 'Alter, interpret, legitimate, or retain private comprehension narratives.',
      backupRole: 'Rotating meeting facilitator', expiry: 'Per session', recallPath: 'Participant may stop or replace assistance immediately.',
      replacementPath: 'Use paper forms or another chosen facilitator.'
    }
  ];
  state.rights = [
    {
      id: uid('right'), name: 'Right to inspect and export the operative charter', responsibleRole: 'Record steward', backupRole: 'Alternate record steward',
      mandate: 'Provide a readable local copy or scoped export.', digitalPath: 'Export center', offlinePath: 'Numbered paper copy or removable-media file',
      responseDeadline: 'By the next scheduled meeting or sooner if needed for a pending decision', reviewDeadline: 'Within 7 days',
      record: 'Random request reference, requested export class, state, and remedy.', remedy: 'Funded copy, alternate format, and independent review.',
      expiry: 'Never while the record is operative', stopCondition: 'not executable: notice or review unresolved', fundedBy: 'Community pilot budget'
    }
  ];
  state.dataMap = [
    {
      id: uid('data'), recordClass: 'Charter text and version metadata', purpose: 'Inspect and compare the operative charter', fields: 'section title, section text, version, provenance class, conflict state',
      source: 'Community-provided text', steward: 'Replaceable record steward', decisionAuthority: 'None; record only', audience: 'Authorized local participants',
      retention: 'Until superseded plus community-declared archive period', correction: 'Append corrected version; preserve contested predecessor', deletionLimits: 'Prior distributed exports may remain',
      export: 'Charter export class', replicas: 'Local IndexedDB and user-created files', linkageRisk: 'Low unless text contains identifying details', stopRule: 'Withhold fields that can single out a protected person'
    }
  ];
  state.procedureCards = [
    {
      id: uid('procedure'), name: 'Declared meeting procedure', status: 'documentation-only', purpose: 'Record a community-provided meeting process without executing or recommending it.',
      authorDefaults: 'No binding defaults', powerGained: 'None by software', affectedExcluded: 'Community must identify affected people and absent voices',
      initiation: 'Community-declared', ruleThresholdTiming: 'Entered as text; not computed by the app', silenceAbstention: 'Must be declared by community',
      dissentAppeal: 'Dissent preserved; reconsideration path entered per proposal', expiryTermination: 'Procedure version may expire or be superseded',
      administratorPowers: 'Record only', privacy: 'No private ballot or stable participant telemetry', offline: 'Paper card and file export',
      conflict: 'Conflicting versions remain contested for human review', burdens: 'Facilitation, accessibility, translation, recordkeeping, care, and reconciliation must name funders',
      suitable: 'Comparing and documenting procedures', unsuitable: 'Automatic binding voting, rights denial, resource allocation, or legitimacy certification'
    }
  ];
  state.threats = [
    {
      id: uid('threat'), title: 'Shared-device coercion or shoulder surfing', adversary: 'Person with physical or relational power over a participant', harm: 'Exposure of dissent, refusal, or association',
      protection: 'No accounts; participant-chosen disclosure; session-local accessibility; paper/offline path', testMethod: 'Synthetic role-play on a shared device',
      outcome: 'not tested', residual: 'Device-level access and browser history may still expose activity', disposition: 'scope-blocking',
      monitoredFailure: 'A participant cannot refuse or preserve dissent privately', support: 'Offer a private assisted path and paper receipt', recovery: 'Stop digital mediation and use alternate path', retestTrigger: 'Before any real-person pilot'
    },
    {
      id: uid('threat'), title: 'Single operator or device becomes authoritative', adversary: 'Loss, capture, or refusal by the only operator', harm: 'Records, export, or contest become unavailable',
      protection: 'Selective bundle export, manual copies, restore drill, replaceable role card', testMethod: 'Cold restore on a second browser profile/device',
      outcome: 'not tested', residual: 'People may fail to maintain current copies', disposition: 'deployment-blocking',
      monitoredFailure: 'Restore requires the original operator or undocumented secret', support: 'Fund a second device and operator drill', recovery: 'Restore from latest scoped export; retain conflicting versions', retestTrigger: 'After schema or storage changes'
    }
  ];
  state.civicSystem.workgroups = [
    { id: uid('workgroup'), name: 'Accessibility and Continuity Circle', purpose: 'Exercise assisted, offline, and replacement paths before any real-person pilot.', status: 'active', facilitator: 'Accessibility facilitator', scope: 'Access, continuity, and shared-device risks', nextAction: 'Run the shared-device coercion scenario', createdAt: nowIso() }
  ];
  state.civicSystem.bulletins = [
    { id: uid('bulletin'), title: 'Synthetic assembly this weekend', body: 'Review the charter journey, exercise refusal paths, and record unresolved questions.', category: 'event', expiresAt: '', createdAt: nowIso() }
  ];
  state.civicSystem.federationMessages = [
    { id: uid('fedmsg'), recipientHub: 'Neighboring synthetic hub', subject: 'Request to compare selective export contracts', body: 'Share only the bridge template and declared compatibility questions. No adoption is requested.', bridgeId: '', status: 'draft', createdAt: nowIso() }
  ];
  state.civicSystem.experiments = [
    { id: uid('experiment'), title: 'Paper restore drill', hypothesis: 'A new steward can restore the operative record without the original device.', method: 'Export a scoped bundle, transfer it manually, and restore on a clean browser profile.', successCriteria: 'Current charter, dissent, and readiness records remain inspectable without privileged secrets.', result: 'not run', status: 'planned', createdAt: nowIso() }
  ];
  state.readiness.bottleneck = { complete: true, note: 'Synthetic admission card completed.', evidence: 'Admission panel' };
  state.readiness.comparator = { complete: true, note: 'Paper binder and numbered files documented.', evidence: 'Admission panel' };
  state.readiness.noBuild = { complete: true, note: 'No-software path remains valid.', evidence: 'Admission panel' };
  state.audit.push(makeAudit('fixture.loaded', { fixture: 'Lantern Commons synthetic journey' }));
  return state;
}

export function touch(state, action, detail = {}) {
  state.meta.updatedAt = nowIso();
  state.audit.unshift(makeAudit(action, detail));
  return state;
}

export function classifyProposal(proposal) {
  const haystack = Object.values(proposal || {}).filter(value => typeof value === 'string').join(' ').toLowerCase();
  const matched = HIGH_IMPACT_TERMS.filter(term => haystack.includes(term));
  const structural = Boolean(proposal?.createsAuthority || proposal?.affectsRights || proposal?.usesPrivateChoice || proposal?.bindsNonparticipants);
  return {
    level: matched.length || structural ? 'rights-critical' : 'ordinary-or-contested',
    matched,
    reason: matched.length
      ? `Potentially rights-critical terms: ${matched.join(', ')}`
      : structural
        ? 'The proposal declares authority, rights, private choice, or effects on nonparticipants.'
        : 'No automatic high-impact signal found. A plausibly affected person may still challenge this classification.'
  };
}

export function validateProposal(proposal) {
  const required = ['title', 'purpose', 'affectedPeople', 'procedure', 'threshold', 'dissentPath', 'reconsideration', 'offlinePath', 'expiry'];
  const missing = required.filter(key => !String(proposal?.[key] || '').trim());
  const classification = classifyProposal(proposal);
  return {
    valid: missing.length === 0,
    missing,
    classification,
    executable: false,
    note: 'This record may document a declared procedure and outcome. It does not execute a binding decision or certify ratification.'
  };
}

export function validateRight(right) {
  const required = ['name', 'responsibleRole', 'backupRole', 'mandate', 'digitalPath', 'offlinePath', 'responseDeadline', 'reviewDeadline', 'record', 'remedy', 'replacementPath', 'fundedBy'];
  const missing = required.filter(key => !String(right?.[key] || '').trim());
  return {
    valid: missing.length === 0,
    missing,
    state: missing.length ? 'not executable: notice or review unresolved' : 'documented; human implementation required'
  };
}

export function validateBridge(contract) {
  const required = ['direction', 'purpose', 'recipientClass', 'fields', 'retention', 'expiry', 'revocation', 'failureClosed', 'reidentificationRisk', 'manualAlternative'];
  const missing = required.filter(key => !String(contract?.[key] || '').trim());
  const prohibited = ['identity', 'account', 'device id', 'private dissent', 'motivation', 'emotion', 'proof-of-worth', 'raw database', 'shared login'];
  const haystack = `${contract?.fields || ''} ${contract?.metadata || ''}`.toLowerCase();
  const flagged = prohibited.filter(term => haystack.includes(term));
  return {
    valid: missing.length === 0 && flagged.length === 0 && contract?.enabled !== true,
    missing,
    flagged,
    state: contract?.enabled ? 'blocked: live bridge activation is outside this MVP' : 'default-off contract draft'
  };
}

export function readinessSummary(state) {
  const entries = READINESS_ITEMS.map(item => ({ ...item, ...(state.readiness[item.id] || {}) }));
  const complete = entries.filter(item => item.complete).length;
  const blockingThreats = state.threats.filter(threat => ['scope-blocking', 'deployment-blocking'].includes(threat.disposition) && threat.outcome !== 'passed');
  const incompleteRights = state.rights.filter(right => !validateRight(right).valid);
  return {
    entries,
    complete,
    total: entries.length,
    percent: Math.round((complete / entries.length) * 100),
    blockingThreats,
    incompleteRights,
    pilotStatus: complete === entries.length && blockingThreats.length === 0 && incompleteRights.length === 0
      ? 'procedural gates recorded; human authority still required'
      : 'blocked or synthetic-only'
  };
}

export function makeHumanApprovalMarkdown(approval, meta) {
  const safe = value => String(value || '').trim() || '[not provided]';
  return `# HUMAN_APPROVAL\n\n> This artifact records a procedural gate only. It does not certify contested community legitimacy, rights compliance, consensus, or ratification.\n\n- **Candidate community:** ${safe(approval.community || meta.communityName)}\n- **Reviewing people or body:** ${safe(approval.reviewingPeople)}\n- **Scope reviewed:** ${safe(approval.scope)}\n- **Procedure used:** ${safe(approval.procedure)}\n- **Authorization declared:** ${safe(approval.authorization)}\n- **Dissent preserved:** ${safe(approval.dissent)}\n- **Conditions or limits:** ${safe(approval.conditions)}\n- **Date declared:** ${safe(approval.date)}\n- **Workspace reference:** ${safe(meta.communityRef)}\n- **Workspace mode:** ${safe(meta.mode)}\n\n## Required caution\n\nThis record does not establish authority by itself. Binding use requires accessible, voluntary, safely facilitated, non-extractive affected-community review with authority to amend or reject, and with dissent preserved.\n`;
}

export function createExactDiff(beforeText = '', afterText = '') {
  const before = beforeText.split('\n');
  const after = afterText.split('\n');
  const max = Math.max(before.length, after.length);
  const lines = [];
  for (let index = 0; index < max; index += 1) {
    const a = before[index];
    const b = after[index];
    if (a === b) lines.push({ type: 'same', line: b ?? '' });
    else {
      if (a !== undefined) lines.push({ type: 'removed', line: a });
      if (b !== undefined) lines.push({ type: 'added', line: b });
    }
  }
  return lines;
}

export function mergeImportedState(current, incoming) {
  const merged = deepClone(current);
  const conflicts = [];
  const collectionKeys = ['proposals', 'outcomes', 'dissents', 'rights', 'roles', 'procedureCards', 'dataMap', 'threats', 'receipts', 'amendments', 'bridgeContracts'];
  for (const key of collectionKeys) {
    const localById = new Map((merged[key] || []).map(item => [item.id, item]));
    for (const remote of incoming[key] || []) {
      const local = localById.get(remote.id);
      if (!local) {
        merged[key].push(remote);
        continue;
      }
      if (JSON.stringify(local) !== JSON.stringify(remote)) {
        const conflict = {
          id: uid('conflict'),
          collection: key,
          recordId: remote.id,
          local,
          incoming: remote,
          status: 'contested',
          resolution: 'human reconciliation required',
          createdAt: nowIso()
        };
        conflicts.push(conflict);
      }
    }
  }
  if (incoming.improvementSystem && typeof incoming.improvementSystem === 'object') {
    merged.improvementSystem = merged.improvementSystem || { bugs: [], forgeDrafts: [], railChecks: [] };
    for (const key of ['bugs','forgeDrafts']) {
      merged.improvementSystem[key] = Array.isArray(merged.improvementSystem[key]) ? merged.improvementSystem[key] : [];
      const localById = new Map(merged.improvementSystem[key].map(item => [item.id || item.proposalId, item]));
      for (const remote of incoming.improvementSystem[key] || []) {
        const recordId = remote.id || remote.proposalId;
        const local = localById.get(recordId);
        if (!local) { merged.improvementSystem[key].push(remote); continue; }
        if (JSON.stringify(local) !== JSON.stringify(remote)) conflicts.push({
          id: uid('conflict'), collection: `improvementSystem.${key}`, recordId,
          local, incoming: remote, status: 'contested', resolution: 'human reconciliation required', createdAt: nowIso()
        });
      }
    }
  }
  if (incoming.civicSystem && typeof incoming.civicSystem === 'object') {
    merged.civicSystem = merged.civicSystem || {};
    for (const key of ['petitionSignals','discussions','workgroups','bulletins','federationMessages','adoptionSignals','experiments','rollbacks']) {
      merged.civicSystem[key] = Array.isArray(merged.civicSystem[key]) ? merged.civicSystem[key] : [];
      const localById = new Map(merged.civicSystem[key].map(item => [item.id, item]));
      for (const remote of incoming.civicSystem[key] || []) {
        const local = localById.get(remote.id);
        if (!local) { merged.civicSystem[key].push(remote); continue; }
        if (JSON.stringify(local) !== JSON.stringify(remote)) conflicts.push({
          id: uid('conflict'), collection: `civicSystem.${key}`, recordId: remote.id,
          local, incoming: remote, status: 'contested', resolution: 'human reconciliation required', createdAt: nowIso()
        });
      }
    }
    merged.civicSystem.dismissedAlerts = [...new Set([...(merged.civicSystem.dismissedAlerts || []), ...(incoming.civicSystem.dismissedAlerts || [])])].slice(0, 1000);
  }
  if (incoming.charter && JSON.stringify(incoming.charter) !== JSON.stringify(current.charter)) {
    conflicts.push({
      id: uid('conflict'), collection: 'charter', recordId: current.charter.id,
      local: current.charter, incoming: incoming.charter, status: 'contested',
      resolution: 'human reconciliation required', createdAt: nowIso()
    });
  }
  merged.charter.conflicts = [...(merged.charter.conflicts || []), ...conflicts];
  merged.imports.unshift({ id: uid('import'), at: nowIso(), sourceCommunityRef: incoming.meta?.communityRef || 'unknown', conflicts: conflicts.length });
  touch(merged, 'bundle.imported', { sourceCommunityRef: incoming.meta?.communityRef || 'unknown', conflicts: conflicts.length });
  return { merged, conflicts };
}
