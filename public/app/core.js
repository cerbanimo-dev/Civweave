const VERSION = document.documentElement.dataset.version || '1.0.74';
const STATE_KEY = 'civweave.working-campus.v1';
const INTENTIONS_KEY = 'civweave.intentions.v127';
const INBOX_KEY = 'civweave.realm-inbox.v1';
const SETTINGS_KEY = 'civweave.core.settings.v1';
const SESSION_KEY = 'civweave.core.session.v1';

const REALMS = Object.freeze({
  'living-school': { label: 'Living School', guide: 'Moss', description: 'Learning paths, practice, evidence, and competency.' },
  cerbanimo: { label: 'Cerbanimo', guide: 'Kamiya', description: 'Skilled work, projects, acceptance criteria, and validation.' },
  fellowfare: { label: 'FellowFare', guide: 'Rook', description: 'Materials, services, exchanges, and resource paths.' },
  anarchadia: { label: 'Anarchadia', guide: 'Merlin', description: 'Consent, roles, governance, review, and coordination.' }
});

const $ = (selector) => document.querySelector(selector);
const clean = (value, max = 8000) => String(value ?? '').trim().slice(0, max);
const parse = (value, fallback) => { try { return JSON.parse(value) ?? fallback; } catch { return fallback; } };
const now = () => new Date().toISOString();
const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const title = (value) => clean(value, 180).replace(/^(i want|i wish|we want|please|help me|let'?s)\s+(to\s+)?/i, '').replace(/[.!?]+$/, '').replace(/^./, (c) => c.toUpperCase()) || 'Move this intention forward';

function readState() {
  return parse(localStorage.getItem(STATE_KEY), { stage: 'wish', conversation: [], plan: null });
}

function writeState(next) {
  localStorage.setItem(STATE_KEY, JSON.stringify({ ...next, updatedAt: now() }));
}

function signal(text) {
  const value = text.toLowerCase();
  return {
    learning: /learn|study|understand|research|teach|practice|skill|course|lesson/.test(value),
    materials: /material|resource|tool|equipment|budget|buy|borrow|trade|supply|vendor|inventory/.test(value),
    collaboration: /team|friend|group|community|collaborat|together|\bwe\b|\bour\b/.test(value),
    governance: /consent|agreement|rule|policy|vote|role|approval|boundary/.test(value)
  };
}

function buildPlan(wish) {
  const flags = signal(wish);
  const paths = [];
  if (flags.learning) {
    paths.push({ realm: 'living-school', label: 'Living School', title: 'Build the knowledge path', purpose: 'Learn only what the intention needs, with evidence of understanding.', steps: ['Name the exact capability the outcome requires.', 'Generate or select the smallest useful learning sequence.', 'Practice against a real piece of the intended outcome.', 'Attach evidence and validate demonstrated competency.'] });
  }
  paths.push({ realm: 'cerbanimo', label: 'Cerbanimo', title: 'Build the working slice', purpose: 'Turn the intention into reviewable skilled work rather than a vague task list.', steps: ['Define one observable outcome and acceptance criteria.', 'Break it into independently testable work packets.', 'Produce the first end-to-end slice.', 'Validate evidence, revise failures, then expand.'] });
  if (flags.materials || flags.collaboration) {
    paths.push({ realm: 'fellowfare', label: 'FellowFare', title: 'Resolve resources and help', purpose: 'Find the materials, services, collaborators, or exchanges that unblock the route.', steps: ['List what the work needs but does not already have.', 'Separate must-have resources from conveniences.', 'Compare local, borrowed, traded, and purchased paths.', 'Record the cleanest fair exchange or acquisition route.'] });
  }
  if (flags.governance || flags.collaboration) {
    paths.push({ realm: 'anarchadia', label: 'Anarchadia', title: 'Make participation explicit', purpose: 'Store consent, roles, boundaries, and review conditions without turning them into hidden obligations.', steps: ['Name participants and decision boundaries.', 'Make activation and exit conditions explicit.', 'Record what requires consent or review.', 'Set a revision checkpoint.'] });
  }
  return {
    schema: 'civweave.intention-weave.v1',
    id: uid('weave'),
    title: title(wish),
    wish,
    state: 'review',
    createdAt: now(),
    updatedAt: now(),
    paths: paths.slice(0, 4),
    requiresExplicitActivation: true,
    planning: { engine: 'core-deterministic', version: VERSION }
  };
}

function materialize(plan) {
  const intentions = parse(localStorage.getItem(INTENTIONS_KEY), []);
  const item = { id: plan.id, kind: 'weave-plan', text: plan.title, state: plan.state, done: false, createdAt: plan.createdAt, updatedAt: plan.updatedAt, plan };
  localStorage.setItem(INTENTIONS_KEY, JSON.stringify([item, ...intentions.filter((entry) => entry.id !== item.id)].slice(0, 100)));
  const prior = parse(localStorage.getItem(INBOX_KEY), []).filter((entry) => entry.payload?.weaveId !== plan.id);
  const handoffs = plan.paths.map((path) => ({ id: uid('handoff'), schema: 'civweave.handoff.v1', source: 'civweave', target: path.realm, kind: 'path', title: path.title, status: 'review', payload: { weaveId: plan.id, wish: plan.wish, path, manualReviewRequired: true }, createdAt: now() }));
  localStorage.setItem(INBOX_KEY, JSON.stringify([...handoffs, ...prior].slice(0, 120)));
}

function appendConversation(role, text) {
  const state = readState();
  const conversation = [...(Array.isArray(state.conversation) ? state.conversation : []), { role, text: clean(text), at: now() }].slice(-40);
  writeState({ ...state, conversation });
  renderConversation(conversation);
}

function renderConversation(conversation = readState().conversation || []) {
  const root = $('#conversation');
  root.replaceChildren();
  const list = conversation.length ? conversation : [{ role: 'guide', text: 'What is your wish?', at: now() }];
  for (const entry of list) {
    const node = document.createElement('article');
    node.className = `message ${entry.role === 'user' ? 'user' : 'guide'}`;
    const text = document.createElement('div');
    text.textContent = entry.text;
    const time = document.createElement('time');
    const date = new Date(entry.at || Date.now());
    time.textContent = Number.isNaN(date.valueOf()) ? '' : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    node.append(text, time);
    root.append(node);
  }
  root.scrollTop = root.scrollHeight;
}

function renderPlan(plan = readState().plan) {
  const root = $('#workspace');
  root.replaceChildren();
  if (!plan?.paths?.length) {
    root.append($('#empty-template').content.cloneNode(true));
    return;
  }
  for (const path of plan.paths) {
    const card = document.createElement('article');
    card.className = 'path';
    const head = document.createElement('header');
    const copy = document.createElement('div');
    const small = document.createElement('small');
    small.textContent = path.label;
    const heading = document.createElement('h3');
    heading.textContent = path.title;
    const purpose = document.createElement('p');
    purpose.textContent = path.purpose;
    copy.append(small, heading, purpose);
    const open = document.createElement('button');
    open.className = 'ghost realm-link';
    open.type = 'button';
    open.textContent = 'Open realm';
    open.addEventListener('click', () => setLocation(path.realm));
    head.append(copy, open);
    const list = document.createElement('ol');
    for (const step of path.steps || []) {
      const item = document.createElement('li');
      item.textContent = step;
      list.append(item);
    }
    const meta = document.createElement('div');
    meta.className = 'meta';
    for (const value of ['review first', 'local state', 'explicit activation']) {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = value;
      meta.append(tag);
    }
    card.append(head, list, meta);
    root.append(card);
  }
}

function setLocation(system = '') {
  const url = new URL(location.href);
  if (system) url.searchParams.set('system', system); else url.searchParams.delete('system');
  history.pushState({ system }, '', url);
  renderActiveView(system);
}

function updateHandoffStatus(id, status) {
  const inbox = parse(localStorage.getItem(INBOX_KEY), []);
  const next = inbox.map((entry) => entry.id === id ? { ...entry, status, updatedAt: now() } : entry);
  localStorage.setItem(INBOX_KEY, JSON.stringify(next));
  return next;
}

function renderRealm(system) {
  const realm = REALMS[system];
  if (!realm) return renderPlan();
  const root = $('#workspace');
  root.replaceChildren();
  $('#work-title').textContent = realm.label;
  const intro = document.createElement('article');
  intro.className = 'path';
  const introHead = document.createElement('header');
  const introCopy = document.createElement('div');
  const guide = document.createElement('small'); guide.textContent = realm.guide;
  const heading = document.createElement('h3'); heading.textContent = `${realm.label} core`;
  const description = document.createElement('p'); description.textContent = realm.description;
  introCopy.append(guide, heading, description);
  const home = document.createElement('button'); home.className = 'ghost'; home.type = 'button'; home.textContent = 'Back to weave'; home.addEventListener('click', () => setLocation(''));
  introHead.append(introCopy, home); intro.append(introHead); root.append(intro);

  const inbox = parse(localStorage.getItem(INBOX_KEY), []).filter((entry) => entry.target === system);
  if (!inbox.length) {
    const empty = document.createElement('div'); empty.className = 'empty';
    const strong = document.createElement('strong'); strong.textContent = `Nothing is waiting in ${realm.label}.`;
    const p = document.createElement('p'); p.textContent = 'Build a weave from Civweave and relevant handoffs will appear here.';
    empty.append(strong, p); root.append(empty); return;
  }
  for (const packet of inbox) {
    const card = document.createElement('article'); card.className = 'path';
    const head = document.createElement('header'); const copy = document.createElement('div');
    const small = document.createElement('small'); small.textContent = String(packet.status || 'review').toUpperCase();
    const h = document.createElement('h3'); h.textContent = packet.title || 'Realm handoff';
    const p = document.createElement('p'); p.textContent = packet.payload?.path?.purpose || packet.payload?.wish || 'Review this handoff before activating it.';
    copy.append(small, h, p);
    const action = document.createElement('button'); action.className = 'primary'; action.type = 'button';
    const active = packet.status === 'active'; action.textContent = active ? 'Return to review' : 'Activate';
    action.addEventListener('click', () => { updateHandoffStatus(packet.id, active ? 'review' : 'active'); renderRealm(system); });
    head.append(copy, action); card.append(head);
    const steps = packet.payload?.path?.steps || [];
    if (steps.length) { const list = document.createElement('ol'); for (const step of steps) { const li = document.createElement('li'); li.textContent = step; list.append(li); } card.append(list); }
    root.append(card);
  }
}

function renderActiveView(system = new URLSearchParams(location.search).get('system') || '') {
  for (const button of document.querySelectorAll('[data-system]')) button.toggleAttribute('aria-current', button.dataset.system === system);
  if (REALMS[system]) renderRealm(system); else { $('#work-title').textContent = 'Your route'; renderPlan(); }
}
function loadSettings() {
  const persistent = parse(localStorage.getItem(SETTINGS_KEY), {});
  const session = parse(sessionStorage.getItem(SESSION_KEY), {});
  const settings = { provider: persistent.provider || 'deterministic', rememberKey: Boolean(persistent.rememberKey), key: persistent.rememberKey ? clean(persistent.geminiKey, 500) : clean(session.geminiKey, 500) };
  $('#provider-select').value = settings.provider;
  $('#remember-key').checked = settings.rememberKey;
  $('#gemini-key').value = settings.key;
}

function saveSettings() {
  const provider = $('#provider-select').value;
  const rememberKey = $('#remember-key').checked;
  const geminiKey = clean($('#gemini-key').value, 500);
  const persistent = { provider, rememberKey };
  if (rememberKey && geminiKey) persistent.geminiKey = geminiKey;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(persistent));
  if (rememberKey) sessionStorage.removeItem(SESSION_KEY);
  else sessionStorage.setItem(SESSION_KEY, JSON.stringify({ geminiKey }));
}

function bindInstall() {
  let deferred = null;
  const button = $('#install-button');
  addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferred = event;
    button.hidden = false;
  });
  button.addEventListener('click', async () => {
    if (!deferred) return;
    await deferred.prompt();
    deferred = null;
    button.hidden = true;
  });
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
  } catch (error) {
    console.warn('[Civweave] service worker registration skipped:', error);
  }
}

$('#wish-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const input = $('#wish-input');
  const wish = clean(input.value);
  if (!wish) return;
  const state = readState();
  const plan = buildPlan(wish);
  const conversation = [...(state.conversation || []), { role: 'user', text: wish, at: now() }, { role: 'guide', text: `I built a reviewable route with ${plan.paths.length} path${plan.paths.length === 1 ? '' : 's'}. Nothing is active yet.`, at: now() }].slice(-40);
  writeState({ ...state, stage: 'review', wish, plan, conversation });
  materialize(plan);
  input.value = '';
  renderConversation(conversation);
  renderPlan(plan);
});

$('#clear-plan').addEventListener('click', () => {
  const state = readState();
  writeState({ ...state, stage: 'wish', wish: '', plan: null });
  renderPlan(null);
});

for (const button of document.querySelectorAll('[data-system]')) button.addEventListener('click', () => setLocation(button.dataset.system));
$('#settings-button').addEventListener('click', () => { loadSettings(); $('#settings-dialog').showModal(); });
$('#save-settings').addEventListener('click', saveSettings);

addEventListener('popstate', () => renderActiveView());

renderConversation();
renderActiveView();
bindInstall();
registerServiceWorker();
