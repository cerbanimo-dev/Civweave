const KEY = 'commonweave.clean-baseline.state.v1';

const initialState = () => ({
  schema: 'commonweave.clean-baseline.state.v1',
  profile: {
    id: localStorage.getItem('commonweave.peer-id') || crypto.randomUUID(),
    displayName: 'Local citizen',
    nodeUrl: location.origin,
    autoValidate: false
  },
  intentions: [],
  learningRequests: [],
  curricula: [],
  taskRequests: [],
  projects: [],
  materialsRequests: [],
  listings: [],
  trades: [],
  featureRequests: [],
  implementationPackets: [],
  validations: [],
  ledger: [],
  friends: [],
  conversations: {},
  seen: {},
  updatedAt: new Date().toISOString()
});

function normalize(raw) {
  const base = initialState();
  if (!raw || typeof raw !== 'object') return base;
  return {
    ...base,
    ...raw,
    profile: { ...base.profile, ...(raw.profile || {}) },
    intentions: Array.isArray(raw.intentions) ? raw.intentions : [],
    learningRequests: Array.isArray(raw.learningRequests) ? raw.learningRequests : [],
    curricula: Array.isArray(raw.curricula) ? raw.curricula : [],
    taskRequests: Array.isArray(raw.taskRequests) ? raw.taskRequests : [],
    projects: Array.isArray(raw.projects) ? raw.projects : [],
    materialsRequests: Array.isArray(raw.materialsRequests) ? raw.materialsRequests : [],
    listings: Array.isArray(raw.listings) ? raw.listings : [],
    trades: Array.isArray(raw.trades) ? raw.trades : [],
    featureRequests: Array.isArray(raw.featureRequests) ? raw.featureRequests : [],
    implementationPackets: Array.isArray(raw.implementationPackets) ? raw.implementationPackets : [],
    validations: Array.isArray(raw.validations) ? raw.validations : [],
    ledger: Array.isArray(raw.ledger) ? raw.ledger : [],
    friends: Array.isArray(raw.friends) ? raw.friends : [],
    conversations: raw.conversations && typeof raw.conversations === 'object' ? raw.conversations : {},
    seen: raw.seen && typeof raw.seen === 'object' ? raw.seen : {}
  };
}

export function readState() {
  try {
    return normalize(JSON.parse(localStorage.getItem(KEY)));
  } catch {
    return initialState();
  }
}

export function writeState(state) {
  const next = normalize({ ...state, updatedAt: new Date().toISOString() });
  localStorage.setItem(KEY, JSON.stringify(next));
  localStorage.setItem('commonweave.peer-id', next.profile.id);
  window.dispatchEvent(new CustomEvent('commonweave:state', { detail: structuredClone(next) }));
  return next;
}

export function updateState(mutator) {
  const current = readState();
  const output = mutator(current) || current;
  return writeState(output);
}

export function addRecord(collection, record) {
  return updateState(state => {
    state[collection] = Array.isArray(state[collection]) ? state[collection] : [];
    const index = state[collection].findIndex(item => item.id === record.id);
    if (index >= 0) state[collection][index] = structuredClone(record);
    else state[collection].unshift(structuredClone(record));
    return state;
  });
}

export function removeRecord(collection, id) {
  return updateState(state => {
    state[collection] = (state[collection] || []).filter(item => item.id !== id);
    return state;
  });
}

export function appendLedger(events) {
  return updateState(state => {
    const known = new Set((state.ledger || []).map(event => event.id));
    for (const event of events || []) if (!known.has(event.id)) state.ledger.push(structuredClone(event));
    return state;
  });
}

export function markSeen(system) {
  return updateState(state => {
    state.seen[system] = new Date().toISOString();
    return state;
  });
}

export function exportState() {
  const state = readState();
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2);
}

export function importState(text) {
  const parsed = JSON.parse(text);
  if (parsed?.schema !== 'commonweave.clean-baseline.state.v1') throw new Error('Unsupported Commonweave export.');
  return writeState(parsed);
}

export function resetState() {
  localStorage.removeItem(KEY);
  return writeState(initialState());
}
