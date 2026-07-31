import { BUNDLE_VERSION, SCHEMA_VERSION, deepClone, nowIso, uid } from './domain.js';

export async function sha256Text(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
}

export function downloadText(filename, text, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function selectExportClasses(state, classes) {
  const selected = {};
  const allowed = new Set(classes);
  if (allowed.has('admission')) selected.admission = deepClone(state.admission);
  if (allowed.has('charter')) selected.charter = deepClone(state.charter);
  if (allowed.has('decisions')) {
    selected.proposals = deepClone(state.proposals);
    selected.outcomes = deepClone(state.outcomes);
    selected.improvementSystem = {
      bugs: deepClone(state.improvementSystem?.bugs || []),
      forgeDrafts: deepClone(state.improvementSystem?.forgeDrafts || [])
    };
    selected.civicSystem = selected.civicSystem || {};
    selected.civicSystem.petitionSignals = deepClone(state.civicSystem?.petitionSignals || []);
    selected.civicSystem.discussions = deepClone(state.civicSystem?.discussions || []);
    selected.civicSystem.bulletins = deepClone(state.civicSystem?.bulletins || []);
    selected.civicSystem.experiments = deepClone(state.civicSystem?.experiments || []);
  }
  if (allowed.has('dissent')) selected.dissents = deepClone(state.dissents);
  if (allowed.has('rights')) selected.rights = deepClone(state.rights);
  if (allowed.has('roles')) {
    selected.roles = deepClone(state.roles);
    selected.procedureCards = deepClone(state.procedureCards);
    selected.civicSystem = selected.civicSystem || {};
    selected.civicSystem.workgroups = deepClone(state.civicSystem?.workgroups || []);
  }
  if (allowed.has('privacy-security')) {
    selected.dataMap = deepClone(state.dataMap);
    selected.threats = deepClone(state.threats);
  }
  if (allowed.has('receipts')) selected.receipts = deepClone(state.receipts);
  if (allowed.has('amendments')) {
    selected.amendments = deepClone(state.amendments);
    selected.civicSystem = selected.civicSystem || {};
    selected.civicSystem.rollbacks = deepClone(state.civicSystem?.rollbacks || []);
  }
  if (allowed.has('bridges')) {
    selected.bridgeContracts = deepClone(state.bridgeContracts);
    selected.civicSystem = selected.civicSystem || {};
    selected.civicSystem.federationMessages = deepClone(state.civicSystem?.federationMessages || []);
    selected.civicSystem.adoptionSignals = deepClone(state.civicSystem?.adoptionSignals || []);
  }
  if (allowed.has('readiness')) {
    selected.readiness = deepClone(state.readiness);
    selected.humanApproval = deepClone(state.humanApproval);
  }
  if (allowed.has('audit')) selected.audit = deepClone(state.audit);
  return selected;
}

export async function buildBundle(state, classes, options = {}) {
  const payload = selectExportClasses(state, classes);
  const payloadText = JSON.stringify(payload);
  const payloadSha256 = await sha256Text(payloadText);
  return {
    bundleVersion: BUNDLE_VERSION,
    recordSchema: SCHEMA_VERSION,
    bundleRef: uid('bundle'),
    exportedAt: nowIso(),
    exportedAtNote: 'Informational provenance only. Time does not confer priority or authority.',
    source: {
      communityRef: state.meta.communityRef,
      communityName: state.meta.communityName,
      mode: state.meta.mode,
      syntheticOnly: state.meta.syntheticOnly,
      appVersion: state.meta.appVersion
    },
    manifest: {
      purpose: options.purpose || 'Manual L1 file exchange and restore',
      intendedAudience: options.audience || 'Authorized recipient selected by the exporting community',
      classes,
      omissions: options.omissions || 'All unselected classes are intentionally omitted.',
      privacyMarking: options.privacyMarking || 'community-scoped',
      onwardExportRule: options.onwardExportRule || 'No onward export without a new community decision.',
      expiry: options.expiry || 'No automatic expiry declared',
      conflictsPresent: Boolean(state.charter.conflicts?.length),
      replicaUncertainty: 'The app cannot know or erase prior copies created outside this installation.',
      authorityDisclaimer: state.meta.authorityDisclaimer,
      payloadSha256
    },
    payload
  };
}

export function validateBundle(bundle) {
  const errors = [];
  const allowedClasses = new Set(['admission','charter','decisions','dissent','rights','roles','privacy-security','receipts','amendments','bridges','readiness','audit']);
  const arrayPayloads = ['proposals','outcomes','dissents','rights','roles','procedureCards','dataMap','threats','receipts','amendments','bridgeContracts','audit'];
  if (!bundle || typeof bundle !== 'object') errors.push('Bundle is not an object.');
  if (bundle?.bundleVersion !== BUNDLE_VERSION) errors.push(`Unsupported bundleVersion: ${bundle?.bundleVersion || 'missing'}`);
  if (bundle?.recordSchema !== SCHEMA_VERSION) errors.push(`Unsupported recordSchema: ${bundle?.recordSchema || 'missing'}`);
  if (!bundle?.source || typeof bundle.source !== 'object' || typeof bundle.source.communityRef !== 'string' || !bundle.source.communityRef.trim() || bundle.source.communityRef.length > 200) errors.push('Missing or invalid source community reference.');
  if (!Array.isArray(bundle?.manifest?.classes) || !bundle.manifest.classes.length || bundle.manifest.classes.length > allowedClasses.size || bundle.manifest.classes.some(item => typeof item !== 'string' || !allowedClasses.has(item))) errors.push('Export classes are missing or invalid.');
  if (!/^[a-f0-9]{64}$/i.test(String(bundle?.manifest?.payloadSha256 || ''))) errors.push('Payload checksum is missing or invalid.');
  if (!bundle?.payload || typeof bundle.payload !== 'object' || Array.isArray(bundle.payload)) errors.push('Missing payload.');
  for (const key of arrayPayloads) {
    if (bundle?.payload?.[key] !== undefined && (!Array.isArray(bundle.payload[key]) || bundle.payload[key].length > 5000)) errors.push(`Payload collection ${key} is invalid or too large.`);
  }
  if (bundle?.payload?.civicSystem !== undefined) {
    const civic = bundle.payload.civicSystem;
    if (!civic || typeof civic !== 'object' || Array.isArray(civic)) errors.push('Civic system payload is invalid.');
    for (const key of ['petitionSignals','discussions','workgroups','bulletins','federationMessages','adoptionSignals','experiments','rollbacks']) {
      if (civic?.[key] !== undefined && (!Array.isArray(civic[key]) || civic[key].length > 5000)) errors.push(`Civic collection ${key} is invalid or too large.`);
    }
  }
  if (bundle?.payload?.improvementSystem !== undefined) {
    const improvements = bundle.payload.improvementSystem;
    if (!improvements || typeof improvements !== 'object' || Array.isArray(improvements)) errors.push('Improvement system payload is invalid.');
    for (const key of ['bugs','forgeDrafts']) if (improvements?.[key] !== undefined && (!Array.isArray(improvements[key]) || improvements[key].length > 5000)) errors.push(`Improvement collection ${key} is invalid or too large.`);
  }
  return { valid: errors.length === 0, errors };
}

export async function verifyBundleHash(bundle) {
  if (!bundle?.manifest?.payloadSha256) return { valid: false, actual: '', expected: '' };
  const actual = await sha256Text(JSON.stringify(bundle.payload));
  return { valid: actual === bundle.manifest.payloadSha256, actual, expected: bundle.manifest.payloadSha256 };
}

export function bundleToImportState(bundle, fallbackState) {
  return {
    ...deepClone(fallbackState),
    meta: {
      ...deepClone(fallbackState.meta),
      communityRef: bundle.source.communityRef,
      communityName: bundle.source.communityName,
      mode: bundle.source.mode,
      syntheticOnly: Boolean(bundle.source.syntheticOnly),
      importedFromBundle: bundle.bundleRef
    },
    ...deepClone(bundle.payload)
  };
}
