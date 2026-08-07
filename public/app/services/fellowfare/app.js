import {
  DEFAULT_AI_SETTINGS, normalizeAISettings, deterministicDraft, deterministicMatches, deterministicReview,
  deterministicAssembly, deterministicProposal, deterministicProviderProfile, deterministicMarketSignals,
  invokeModel, testModel
} from './ai.js';
import {
  createAgreementFromProposal, normalizeAgreement, agreementProgress as ledgerProgress, deriveAgreementStatus,
  addMilestone as ledgerAddMilestone, completeMilestone as ledgerCompleteMilestone, addEvidence as ledgerAddEvidence,
  recordSettlement as ledgerRecordSettlement, openRepair as ledgerOpenRepair, resolveRepair as ledgerResolveRepair,
  addReview as ledgerAddReview, advanceRecurringAgreement, createLedgerEvent, buildCivweaveBundle, trustSnapshotFromReviews
} from './ledger.js';

const APP_VERSION = '0.4.1-cardinal-visual';
const STORE_KEY = 'fellowfare.mvp.state.v3';
const V2_STORE_KEY = 'fellowfare.mvp.state.v2';
const LEGACY_STORE_KEY = 'fellowfare.mvp.state.v1';
const AI_SECRET_KEY = 'fellowfare.ai.secret.session.v1';
const ROUTES = ['mall', 'market', 'loom', 'assemblies', 'inbox', 'profile'];
const AGREEMENT_ACTIONS = ['milestone','evidence','settlement','repair','review','recurrence'];
const categories = ['Goods', 'Services', 'Work', 'Repair', 'Transport', 'Food', 'Tools & space', 'Learning', 'Housing', 'Funding', 'Other'];
const exchangeMethods = ['Cash', 'Barter', 'Gift', 'Community credit', 'Loan', 'Pay what you can'];

const now = Date.now();
const hoursAgo = (hours) => new Date(now - hours * 3600_000).toISOString();
const daysFromNow = (days) => new Date(now + days * 86400_000).toISOString();

const starterState = {
  version: APP_VERSION,
  route: 'mall',
  filters: { mode: 'all', query: '', sort: 'newest' },
  loom: { action:'matches', threadId:'', input:'', result:null, source:'deterministic', updatedAt:'' },
  profile: {
    id: 'me',
    name: 'Cami',
    area: 'Watertown, NY',
    bio: 'Builder, designer, organizer, and neighbor.',
    initials: 'CR',
    trust: { communication: 92, reliability: 88, quality: 90, repair: 96 },
    credits: 24,
    completed: 17,
    settings: { theme: 'system', nearby: true, notifications: true, privateByDefault: false, ai: { ...DEFAULT_AI_SETTINGS } }
  },
  people: [
    { id: 'p1', name: 'Mara Velez', initials: 'MV', area: 'Watertown, NY', trust: 94, specialty: 'Transport & repairs' },
    { id: 'p2', name: 'Jules Chen', initials: 'JC', area: 'Fort Drum, NY', trust: 91, specialty: 'Carpentry' },
    { id: 'p3', name: 'Noah Adebayo', initials: 'NA', area: 'Brownville, NY', trust: 89, specialty: 'Food & gardens' },
    { id: 'p4', name: 'Tess Morgan', initials: 'TM', area: 'Watertown, NY', trust: 96, specialty: 'Care work' },
    { id: 'p5', name: 'River Patel', initials: 'RP', area: 'Adams, NY', trust: 86, specialty: 'Design & fabrication' }
  ],
  threads: [
    {
      id: 't1', ownerId: 'p1', mode: 'offer', title: 'Pickup truck and hauling help',
      description: 'Available evenings and Saturdays for furniture moves, dump runs, and material pickup. Up to two hours locally.',
      category: 'Transport', amount: 55, amountLabel: '$55 / trip', methods: ['Cash', 'Barter'], area: 'Watertown · 15 mi', when: 'Evenings & Saturdays', quantity: 'Up to 2 hours', partial: false, visibility: 'public', status: 'open', createdAt: hoursAgo(3), saved: true, views: 31
    },
    {
      id: 't2', ownerId: 'p2', mode: 'need', title: 'Reclaimed windows for greenhouse build',
      description: 'Looking for 8–12 old windows, any matching set helps. Can collect locally and trade carpentry work.',
      category: 'Goods', amount: 120, amountLabel: 'Up to $120', methods: ['Cash', 'Barter', 'Gift'], area: 'Jefferson County', when: 'Before September', quantity: '8–12 windows', partial: true, visibility: 'public', status: 'open', createdAt: hoursAgo(8), saved: false, views: 48
    },
    {
      id: 't3', ownerId: 'p3', mode: 'collective', title: 'Weekly local bread buying circle',
      description: 'If ten households commit, I can bake sourdough loaves every Friday using regional flour. Pickup hub needed.',
      category: 'Food', amount: 7, amountLabel: '$7 / loaf', methods: ['Cash', 'Community credit'], area: 'Watertown', when: 'Fridays', quantity: '10 households', partial: true, visibility: 'public', status: 'assembling', createdAt: hoursAgo(14), saved: true, views: 67
    },
    {
      id: 't4', ownerId: 'p4', mode: 'offer', title: 'Two hours of household reset help',
      description: 'Nonjudgmental help sorting clutter, making a plan, and resetting one room. You set the pace.',
      category: 'Services', amount: 40, amountLabel: '$40 or trade', methods: ['Cash', 'Barter', 'Pay what you can'], area: 'Watertown · in person', when: 'Weekday afternoons', quantity: '2-hour session', partial: false, visibility: 'public', status: 'open', createdAt: hoursAgo(21), saved: false, views: 29
    },
    {
      id: 't5', ownerId: 'p5', mode: 'need', title: 'Shared workshop space one evening a week',
      description: 'Three makers need a ventilated workspace for small woodworking and fabrication. Open to rent or helping improve the space.',
      category: 'Tools & space', amount: 160, amountLabel: '$160 / month pool', methods: ['Cash', 'Barter', 'Community credit'], area: 'Within 20 mi', when: 'One evening weekly', quantity: '300+ sq ft', partial: true, visibility: 'public', status: 'assembling', createdAt: hoursAgo(30), saved: false, views: 81
    },
    {
      id: 't6', ownerId: 'me', mode: 'offer', title: 'Flyer and one-page web design',
      description: 'A focused design package for local projects, events, and small providers. Includes editable source files.',
      category: 'Services', amount: 75, amountLabel: 'From $75', methods: ['Cash', 'Barter', 'Community credit'], area: 'Remote or local', when: '3–5 day turnaround', quantity: 'One design package', partial: false, visibility: 'public', status: 'open', createdAt: hoursAgo(46), saved: false, views: 22
    }
  ],
  proposals: [
    { id: 'pr1', threadId: 't2', fromId: 'me', message: 'I have four storm windows in storage and can deliver them Sunday.', compensation: 'Trade for a small shelf repair', when: 'Sunday afternoon', conditions: 'Need help carrying two of them', status: 'pending', createdAt: hoursAgo(2) },
    { id: 'pr2', threadId: 't3', fromId: 'me', message: 'Count me in for one loaf weekly and I can host pickup twice a month.', compensation: '$7 weekly', when: 'Fridays', conditions: '', status: 'accepted', createdAt: hoursAgo(10) }
  ],
  agreements: [normalizeAgreement({
    id: 'ag1', threadId: 't3', proposalId: 'pr2', title: 'Weekly local bread buying circle', category: 'Food',
    participants: [
      { personId: 'me', role: 'buyer and pickup host', confirmedAt: hoursAgo(9.5) },
      { personId: 'p3', role: 'baker', confirmedAt: hoursAgo(9) }
    ],
    terms: { scope: 'One sourdough loaf each Friday, with pickup hosting twice monthly.', compensation: '$7 weekly', timing: 'Fridays', conditions: 'Pickup schedule rotates by agreement.', methods: ['Cash','Community credit'] },
    milestones: [
      { id: 'ms1', title: 'Bake and prepare this week’s loaf', ownerId: 'p3', dueAt: daysFromNow(2), status: 'pending', completedAt: '', evidenceIds: [] },
      { id: 'ms2', title: 'Host or confirm Friday pickup', ownerId: 'me', dueAt: daysFromNow(2), status: 'pending', completedAt: '', evidenceIds: [] }
    ],
    evidence: [],
    settlement: { status: 'pending', method: 'Cash or community credit', amount: 7, currency: 'USD', note: '', recordedAt: '' },
    recurrence: { enabled: true, cadence: 'weekly', nextAt: daysFromNow(2) },
    repair: { status: 'none', issue: '', requestedRemedy: '', openedAt: '', resolvedAt: '' },
    reviews: [], status: 'active', createdAt: hoursAgo(9), updatedAt: hoursAgo(9)
  })],
  ledgerEvents: [
    createLedgerEvent('agreement.created', 'agreement', 'ag1', 'me', { threadId: 't3', proposalId: 'pr2' }, hoursAgo(9)),
    createLedgerEvent('agreement.confirmed', 'agreement', 'ag1', 'me', { participantId: 'me' }, hoursAgo(9))
  ],
  assemblies: [
    {
      id: 'a1', threadId: 't3', title: 'Friday bread circle', target: 10, unit: 'households', status: 'forming',
      commitments: [
        { id: 'c1', personId: 'p3', contribution: 'Bake 12 loaves', value: 4 },
        { id: 'c2', personId: 'me', contribution: 'Buy 1 loaf + host pickup', value: 1 },
        { id: 'c3', personId: 'p4', contribution: 'Buy 2 loaves', value: 2 }
      ]
    },
    {
      id: 'a2', threadId: 't5', title: 'North Country maker room', target: 160, unit: 'monthly dollars', status: 'forming',
      commitments: [
        { id: 'c4', personId: 'p5', contribution: '$60 monthly + workbench', value: 60 },
        { id: 'c5', personId: 'p2', contribution: '$40 monthly', value: 40 },
        { id: 'c6', personId: 'me', contribution: 'Website and booking system', value: 25 }
      ]
    }
  ],
  messages: [
    { id: 'm1', threadId: 't2', fromId: 'p2', toId: 'me', text: 'Four windows would be a great start. What kind of shelf repair?', createdAt: hoursAgo(1.6), read: false },
    { id: 'm2', threadId: 't2', fromId: 'me', toId: 'p2', text: 'A small wall shelf with a loose joint. I can send a photo.', createdAt: hoursAgo(1.3), read: true },
    { id: 'm3', threadId: 't3', fromId: 'p3', toId: 'me', text: 'Pickup host twice a month makes the route workable. Thank you!', createdAt: hoursAgo(9), read: true }
  ],
  aiRuns: [],
  activity: [
    { id: 'ev1', type: 'proposal', text: 'Proposal sent for reclaimed windows', createdAt: hoursAgo(2) },
    { id: 'ev2', type: 'assembly', text: 'Joined the Friday bread circle', createdAt: hoursAgo(10) }
  ]
};

let state = loadState();
const FF_PARAMS=new URLSearchParams(location.search);
if(FF_PARAMS.get('visual')==='1'||FF_PARAMS.get('civweave')==='1'){state.route='mall';localStorage.setItem('fellowfare.mall.scene.v1',localStorage.getItem('fellowfare.mall.scene.v1')||'atrium');}
let installPrompt = null;
let activeComposerMode = 'need';
let activeConversationThreadId = null;
let civweaveContext = null;
const CIVWEAVE_EMBEDDED = new URLSearchParams(location.search).get('civweave') === '1' && window.parent !== window;

function postToCivweave(message) {
  if (!CIVWEAVE_EMBEDDED) return;
  window.parent.postMessage({ ...message, sourceApplication:'fellowfare', automaticEffect:false }, window.location.origin);
}

function civweaveDeepLink(object, objectId) {
  return `/campus?app=fellowfare&object=${encodeURIComponent(object)}&id=${encodeURIComponent(objectId)}`;
}

function emitCivweaveSignal({ signalId, kind, subjectType, subjectId, title, detail, state='human-action-required' }) {
  postToCivweave({
    type:'civweave:action-signal', contractVersion:'civweave.action-signal.v1',
    signalId, kind, subjectType, subjectId, title, detail, state,
    deepLink:civweaveDeepLink(subjectType, subjectId)
  });
}

function handoffToCivweave(target, kind, title, payload) {
  postToCivweave({ type:'civweave:handoff', contractVersion:'civweave.handoff.v1', target, kind, title, payload });
  toast(`A reviewable ${target === 'cerbanimo' ? 'work' : target === 'living' ? 'learning' : 'governance'} handoff was sent to the Civweave Loom.`);
}


const main = document.querySelector('#main');
const composerDialog = document.querySelector('#composerDialog');
const detailDialog = document.querySelector('#detailDialog');
const proposalDialog = document.querySelector('#proposalDialog');
const messageDialog = document.querySelector('#messageDialog');
const importDialog = document.querySelector('#importDialog');
const aiSettingsDialog = document.querySelector('#aiSettingsDialog');
const ledgerActionDialog = document.querySelector('#ledgerActionDialog');

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY) || localStorage.getItem(V2_STORE_KEY) || localStorage.getItem(LEGACY_STORE_KEY);
    const saved = raw ? JSON.parse(raw) : null;
    if (saved && saved.profile && Array.isArray(saved.threads)) {
      const agreements = Array.isArray(saved.agreements)
        ? saved.agreements.map(normalizeAgreement)
        : migrateAcceptedProposals(saved);
      const merged = {
        ...structuredClone(starterState),
        ...saved,
        version: APP_VERSION,
        filters: { ...starterState.filters, ...(saved.filters || {}) },
        profile: {
          ...starterState.profile,
          ...saved.profile,
          trust: { ...starterState.profile.trust, ...(saved.profile.trust || {}) },
          settings: {
            ...starterState.profile.settings,
            ...(saved.profile.settings || {}),
            ai: normalizeAISettings(saved.profile.settings?.ai || {})
          }
        },
        aiRuns: Array.isArray(saved.aiRuns) ? saved.aiRuns : [],
        loom: { ...starterState.loom, ...(saved.loom || {}) },
        agreements,
        ledgerEvents: Array.isArray(saved.ledgerEvents) ? saved.ledgerEvents : []
      };
      if (!merged.ledgerEvents.length && agreements.length) {
        merged.ledgerEvents = agreements.map((agreement) => createLedgerEvent('agreement.migrated', 'agreement', agreement.id, 'me', { fromVersion: saved.version || '0.2.x' }, agreement.createdAt));
      }
      return merged;
    }
  } catch (error) {
    console.warn('Could not read local state', error);
  }
  return structuredClone(starterState);
}

function migrateAcceptedProposals(saved) {
  const proposals = Array.isArray(saved.proposals) ? saved.proposals : [];
  const threads = Array.isArray(saved.threads) ? saved.threads : [];
  return proposals.filter((proposal) => proposal.status === 'accepted').map((proposal) => {
    const thread = threads.find((item) => item.id === proposal.threadId);
    if (!thread) return null;
    return createAgreementFromProposal(proposal, thread, saved.people || [], { actorId: 'me', createdAt: proposal.createdAt });
  }).filter(Boolean);
}

function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
  updateBadges();
}

function esc(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function id(prefix) {
  return `${prefix}_${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(16).slice(2)}`}`;
}

function getPerson(personId) {
  if (personId === 'me') return state.profile;
  return state.people.find((person) => person.id === personId) || { id: personId, name: 'Unknown neighbor', initials: '?', area: 'Unknown area', trust: 0 };
}

function getThread(threadId) {
  return state.threads.find((thread) => thread.id === threadId);
}

function getAgreement(agreementId) {
  return (state.agreements || []).find((agreement) => agreement.id === agreementId);
}

function getAgreementForThread(threadId) {
  return (state.agreements || []).find((agreement) => agreement.threadId === threadId && agreement.status !== 'cancelled');
}

function appendLedgerEvent(type, entityType, entityId, payload = {}) {
  if (!Array.isArray(state.ledgerEvents)) state.ledgerEvents = [];
  const event = createLedgerEvent(type, entityType, entityId, 'me', payload);
  state.ledgerEvents.unshift(event);
  return event;
}

function formatDate(dateString, fallback = 'No date set') {
  if (!dateString) return fallback;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat('en-US', { month:'short', day:'numeric', year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined }).format(date);
}

function isOverdue(dateString, status = 'pending') {
  if (!dateString || status !== 'pending') return false;
  return new Date(dateString).getTime() < Date.now();
}

function formatRelative(dateString) {
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function modeText(mode) {
  return ({ need: 'Need', offer: 'Offer', collective: 'Collective' })[mode] || 'Thread';
}

function priceLabel(thread) {
  if (thread.amountLabel) return thread.amountLabel;
  if (Number.isFinite(Number(thread.amount))) return `$${Number(thread.amount).toLocaleString('en-US')}`;
  return thread.methods?.[0] || 'Open terms';
}

function routeTo(route, options = {}) {
  const next = ROUTES.includes(route) ? route : 'market';
  state.route = next;
  if (next === 'mall' && !options.keepMallScene) { mallScene = 'atrium'; localStorage.setItem('fellowfare.mall.scene.v1','atrium'); }
  saveState();
  history.replaceState(null, '', `#${next}`);
  render();
  if (!options.keepScroll) window.scrollTo({ top: 0, behavior: 'smooth' });
}

const FELLOWFARE_ROUTE_ART = {
  market: './assets/mall/marketplace.webp',
  loom: './assets/mall/skill-shop.webp',
  assemblies: './assets/mall/volunteer-hub.webp',
  inbox: './assets/mall/help-desk.webp',
  profile: './assets/mall/resource-center.webp'
};

function applyFellowfareVisualContract() {
  document.body.classList.add('ff-cardinal-visual');
  document.documentElement.dataset.fellowfareVersion = APP_VERSION;
  if (state.route === 'mall') {
    main.className = 'ff-world-main ff-mall-main';
    document.body.style.setProperty('--ff-current-scene', `url("${FELLOWFARE_MALL_ART[mallScene] || FELLOWFARE_MALL_ART.atrium}")`);
    return;
  }
  const art = FELLOWFARE_ROUTE_ART[state.route] || './assets/mall/main-atrium.webp';
  document.body.style.setProperty('--ff-current-scene', `url("${art}")`);
  const current = main.innerHTML;
  main.className = 'ff-world-main ff-projected-main';
  main.innerHTML = `<section class="ff-route-scene" data-ff-route-scene="${esc(state.route)}">
    <img class="ff-route-scene-art" src="${art}" alt="" aria-hidden="true" />
    <div class="ff-world-projection" role="region" aria-label="${esc(state.route)} work surface">${current}</div>
  </section>`;
}

function render() {
  applyTheme();
  document.querySelectorAll('[data-route]').forEach((button) => button.classList.toggle('is-active', button.dataset.route === state.route));
  if (state.route === 'mall') renderMall();
  if (state.route === 'market') renderMarket();
  if (state.route === 'loom') renderLoom();
  if (state.route === 'assemblies') renderAssemblies();
  if (state.route === 'inbox') renderInbox();
  if (state.route === 'profile') renderProfile();
  applyFellowfareVisualContract();
  updateBadges();
}


const FELLOWFARE_MALL_SCENES = {
  atrium:{label:'Main Atrium',floor:'Ground floor',wing:'Center',icon:'✦',summary:'The social heart of FellowFare. Search the whole mall, see what is moving, and choose a wing.',portals:['exchange','aid','makers','logistics','upper','rooftop'],actions:[['directory','Open directory kiosk'],['post-need','Post a need'],['post-offer','Post an offer'],['market','Browse every listing']]},
  exchange:{label:'Exchange Galleria',floor:'Ground floor',wing:'East Wing',icon:'↔',summary:'Goods, services, borrowing, gifts, and negotiated exchange share one bright arcade.',portals:['atrium','marketplace','free-store','skill-shop','tool-rental'],actions:[['market','Browse all exchange threads'],['post-offer','Open a storefront listing']]},
  marketplace:{label:'Marketplace',floor:'Ground floor',wing:'East Wing',icon:'▦',summary:'Buy, sell, barter, commission, and assemble offers without hiding the terms.',portals:['exchange','free-store','skill-shop'],actions:[['market','Open marketplace'],['post-need','Request something'],['post-offer','List something']]},
  'free-store':{label:'Free Store',floor:'Ground floor',wing:'East Wing',icon:'♡',summary:'A gift-economy storefront for taking, leaving, donating, and wish-listing useful things.',portals:['marketplace','tool-rental','exchange'],actions:[['filter-gift','Show gifts and free offers'],['post-offer','Donate an item'],['post-need','Add a wish']]},
  'skill-shop':{label:'Skill Shop',floor:'Ground floor',wing:'East Wing',icon:'✎',summary:'People offer teaching, mentoring, repair, care, and specialist help. Learning paths can cross into Living School.',portals:['marketplace','tool-rental','makers'],actions:[['filter-learning','Browse learning and services'],['post-offer','Offer a skill'],['loom-provider','Discover what I can offer']]},
  'tool-rental':{label:'Tool Rental',floor:'Ground floor',wing:'East Wing',icon:'⚒',summary:'Reserve, borrow, return, and maintain shared tools and spaces.',portals:['free-store','skill-shop','repair-cafe','loading-dock'],actions:[['filter-tools','Browse tools and spaces'],['post-need','Request a tool'],['post-offer','Lend a tool']]},
  aid:{label:'Mutual Aid Wing',floor:'Ground floor',wing:'West Wing',icon:'☼',summary:'Urgent requests, food, volunteers, and shared resources are coordinated with care and visible consent.',portals:['atrium','help-desk','resource-center','volunteer-hub','pantry'],actions:[['post-need','Ask for help'],['loom-matches','Find possible matches']]},
  'help-desk':{label:'Help Desk',floor:'Ground floor',wing:'West Wing',icon:'?',summary:'A calm intake counter for immediate needs, transport, food, care, and emergency support.',portals:['aid','resource-center','lost-found'],actions:[['post-need','Start a help request'],['market-needs','Browse open needs'],['inbox','Check responses']]},
  'resource-center':{label:'Resource Center',floor:'Ground floor',wing:'West Wing',icon:'▤',summary:'Bulk supplies, preparedness kits, and community-held resources become visible and matchable.',portals:['help-desk','volunteer-hub','warehouse'],actions:[['market','Browse resources'],['post-offer','Register available resources'],['assemblies','Assemble a shared response']]},
  'volunteer-hub':{label:'Volunteer Hub',floor:'Ground floor',wing:'West Wing',icon:'⚑',summary:'Volunteer calls, schedules, teams, and collective work gather here.',portals:['resource-center','pantry','organizations'],actions:[['market-collective','Browse collective calls'],['post-offer','Offer volunteer time'],['assemblies','Open assemblies']]},
  pantry:{label:'Community Pantry',floor:'Ground floor',wing:'West Wing',icon:'♨',summary:'Food offers, meal trains, buying circles, gardens, and cooking events share one welcoming counter.',portals:['aid','volunteer-hub','rooftop'],actions:[['filter-food','Browse food exchanges'],['post-need','Request food support'],['post-offer','Share food or a meal']]},
  makers:{label:'Makers Arcade',floor:'Ground floor',wing:'North Wing',icon:'⌁',summary:'Making, fabrication, repair, and commissions occupy a noisy, generous arcade.',portals:['atrium','workshop','repair-cafe','makers-market','skill-shop'],actions:[['filter-work','Browse making and repair'],['post-offer','Offer maker services']]},
  workshop:{label:'Community Workshop',floor:'Ground floor',wing:'North Wing',icon:'⚙',summary:'Shared benches, tools, project space, and commissions can become Cerbanimo work handoffs.',portals:['makers','repair-cafe','makers-market','tool-rental'],actions:[['filter-tools','Find workspace and tools'],['post-need','Request a build'],['post-offer','Offer fabrication']]},
  'repair-cafe':{label:'Repair Café',floor:'Ground floor',wing:'North Wing',icon:'⌘',summary:'Broken things become repair threads with diagnosis, parts, volunteers, evidence, and repair history.',portals:['workshop','makers-market','tool-rental','recycling'],actions:[['filter-repair','Browse repairs'],['post-need','Bring in a repair'],['post-offer','Volunteer repair skill']]},
  'makers-market':{label:'Makers Market',floor:'Ground floor',wing:'North Wing',icon:'◇',summary:'Handmade work, local commissions, and custom builds meet transparent pricing and barter.',portals:['makers','workshop','repair-cafe','marketplace'],actions:[['market-offers','Browse maker offers'],['post-offer','Open a maker stall']]},
  logistics:{label:'Logistics Concourse',floor:'Ground floor',wing:'South Wing',icon:'➜',summary:'Shipping, rides, deliveries, and regional routes turn promises into completed movement.',portals:['atrium','shipping','rideshare','transit','loading-dock'],actions:[['filter-transport','Browse transport'],['loom-assembly','Assemble a delivery']]},
  shipping:{label:'Shipping Center',floor:'Ground floor',wing:'South Wing',icon:'▣',summary:'Incoming donations, outgoing deliveries, packages, and proof of handoff are coordinated here.',portals:['logistics','loading-dock','warehouse'],actions:[['filter-transport','Browse delivery threads'],['post-need','Request delivery'],['inbox','Track agreements']]},
  rideshare:{label:'Ride Share',floor:'Ground floor',wing:'South Wing',icon:'⇢',summary:'Offer rides, request transport, share vehicles, and coordinate accessible travel.',portals:['logistics','transit','housing'],actions:[['filter-transport','Browse rides'],['post-need','Request a ride'],['post-offer','Offer a ride']]},
  transit:{label:'Regional Transit',floor:'Ground floor',wing:'South Wing',icon:'⌖',summary:'Nearby communities, routes, timing, and transfer points form a navigable regional layer.',portals:['logistics','rideshare','rooftop'],actions:[['filter-transport','Open transport market'],['directory','Search the mall']]},
  upper:{label:'Upper Gallery',floor:'Second floor',wing:'Center',icon:'⌃',summary:'Longer-term relationships live upstairs: housing, time, organizations, and events.',portals:['atrium','housing','time-bank','organizations','event-center'],actions:[['directory','Open upper-floor directory']]},
  housing:{label:'Housing Exchange',floor:'Second floor',wing:'East Gallery',icon:'⌂',summary:'Temporary housing, roommates, emergency shelter, hosting, and shared-space offers.',portals:['upper','rideshare','organizations'],actions:[['filter-housing','Browse housing'],['post-need','Request housing'],['post-offer','Offer a place']]},
  'time-bank':{label:'Time Bank',floor:'Second floor',wing:'West Gallery',icon:'◴',summary:'Hours, community credits, contributions, and reciprocal exchange are visible without pretending every act is identical.',portals:['upper','skill-shop','organizations'],actions:[['profile','View my contribution profile'],['market-credit','Browse community-credit exchange'],['post-offer','Offer time']]},
  organizations:{label:'Community Organizations',floor:'Second floor',wing:'North Gallery',icon:'◎',summary:'Neighborhood groups, guilds, mutual-aid teams, and local organizations maintain public counters here.',portals:['upper','volunteer-hub','housing','event-center'],actions:[['assemblies','Browse active assemblies'],['post-collective','Start a collective thread']]},
  'event-center':{label:'Event Center',floor:'Second floor',wing:'South Gallery',icon:'✺',summary:'Swap meets, skill fairs, volunteer days, markets, and community gatherings get assembled here.',portals:['upper','organizations','rooftop'],actions:[['market-collective','Browse community events'],['post-collective','Propose an event'],['assemblies','Coordinate attendance']]},
  rooftop:{label:'Rooftop Commons',floor:'Rooftop',wing:'Open air',icon:'☀',summary:'Community garden, solar canopy, outdoor classroom, music nights, and a seasonal farmers market.',portals:['atrium','pantry','event-center','transit'],actions:[['filter-food','Browse garden and food offers'],['post-collective','Plan a rooftop event']]},
  'loading-dock':{label:'Loading Dock',floor:'Service level',wing:'Back of house',icon:'▥',summary:'Donation intake, dispatch, large-item pickup, and operational queues move behind the storefronts.',portals:['shipping','warehouse','tool-rental','maintenance'],actions:[['assemblies','Open logistics assemblies'],['inbox','Review active agreements']]},
  warehouse:{label:'Inventory Warehouse',floor:'Service level',wing:'Back of house',icon:'▧',summary:'Shared inventory, bulk resources, reservations, and distribution batches are staged here.',portals:['loading-dock','resource-center','recycling'],actions:[['market','Browse inventory threads'],['post-offer','Add stock'],['loom-signals','Analyze demand']]},
  maintenance:{label:'Maintenance Hall',floor:'Service level',wing:'Back of house',icon:'⚿',summary:'Mall systems, storefront readiness, accessibility checks, and shared infrastructure maintenance.',portals:['loading-dock','repair-cafe','security'],actions:[['post-collective','Report a shared maintenance need'],['assemblies','Coordinate repair work']]},
  'lost-found':{label:'Lost & Found',floor:'Service level',wing:'Customer care',icon:'⌕',summary:'Misrouted items, interrupted exchanges, and unresolved handoffs get a humane recovery path.',portals:['help-desk','security'],actions:[['inbox','Review messages and repairs'],['market','Search listings']]},
  security:{label:'Safety & Consent Office',floor:'Service level',wing:'Customer care',icon:'◈',summary:'Safety plans, consent boundaries, repair paths, and contextual trust live here without becoming surveillance.',portals:['lost-found','maintenance','recycling'],actions:[['inbox','Open agreements and repairs'],['loom-review','Review fairness and risk'],['profile','Review privacy settings']]},
  recycling:{label:'Recycling Center',floor:'Service level',wing:'Back of house',icon:'♲',summary:'Reuse, salvage, materials recovery, and repair-before-disposal routes close the loop.',portals:['repair-cafe','warehouse','security'],actions:[['filter-goods','Browse reusable goods'],['post-offer','Offer salvage'],['post-need','Request materials']]}
};

const FELLOWFARE_MALL_ART = {
  atrium:'./assets/mall/main-atrium.webp',
  exchange:'./assets/mall/exchange-galleria.webp',
  aid:'./assets/mall/mutual-aid-wing.webp',
  makers:'./assets/mall/makers-arcade.webp',
  logistics:'./assets/mall/logistics-concourse.webp',
  upper:'./assets/mall/upper-gallery.webp',
  rooftop:'./assets/mall/rooftop-commons.webp',
  marketplace:'./assets/mall/marketplace.webp',
  'free-store':'./assets/mall/free-store.webp',
  'help-desk':'./assets/mall/help-desk.webp',
  'repair-cafe':'./assets/mall/repair-cafe.webp',
  'skill-shop':'./assets/mall/skill-shop.webp',
  'tool-rental':'./assets/mall/tool-rental.webp',
  'resource-center':'./assets/mall/resource-center.webp',
  'volunteer-hub':'./assets/mall/volunteer-hub.webp',
  pantry:'./assets/mall/pantry.webp'
};

const FELLOWFARE_SCENE_FEATURES={
 atrium:[['Handmade & Heartfelt','Enter the exchange galleria and local marketplace.',0,38,31,31,'scene-exchange'],['Neighbors Helping Neighbors','Enter mutual aid, resources, and care coordination.',69,39,31,31,'scene-aid'],['Directory Kiosk','Use the central mall directory and resource map.',34,49,32,22,'directory'],['Rook','Open your FellowFare profile and relationship ledger.',37,61,27,27,'profile'],['Share Skills · Share Stories','Enter the makers arcade for skills, repair, and teaching.',0,70,24,27,'scene-makers'],['Trade Time · Talent','Enter logistics, time exchange, transport, and delivery.',76,70,24,27,'scene-logistics']],
 exchange:[['Marketplace','Browse offers, requests, local goods, and commissions.',4,25,29,28,'market'],['Free Store','Open gift-economy exchange.',68,25,29,28,'filter-gift'],['Help Desk','Ask for guided support.',35,58,30,25,'post-need']],
 aid:[['Help Desk','Ask for practical help and navigation.',3,28,29,24,'post-need'],['Resource Center','Browse supplies, referrals, housing, and transport.',68,28,29,24,'market'],['Community Pantry','Find food and coordinate shared meals.',35,62,30,24,'filter-food']],
 makers:[['Repair Café','Open repair requests and repair offers.',3,30,28,24,'filter-repair'],['Skill Shop','Find or teach a skill.',69,30,28,24,'filter-learning'],['Tool Rental','Browse shared tools and workspaces.',35,63,30,24,'filter-tools']],
 upper:[['Resource Center','Browse local resources and services.',3,34,29,28,'market'],['Volunteer Hub','Join a shift, team, or assembly.',68,34,29,28,'assemblies']],
 rooftop:[['Volunteer Hub','Open collective opportunities and active teams.',3,35,29,30,'assemblies'],['Community Assembly','Coordinate a shared project.',68,35,29,30,'post-collective']],
 logistics:[['Tool Rental','Reserve tools and record returns.',3,34,29,28,'filter-tools'],['Help Desk','Coordinate pickup, delivery, or transportation.',68,34,29,28,'filter-transport']],
 marketplace:[['Offers','Browse goods, services, and available help.',4,29,28,17,'market'],['Requests','Browse needs and requests for support.',69,29,27,17,'market'],['Local Goods','Explore nearby goods and producers.',3,55,27,18,'market'],['Commissions','Request or offer custom work.',70,55,27,18,'post-need']],
 'free-store':[['Donate Here','Offer useful items without payment.',3,28,28,16,'post-offer'],['Take What You Need','Browse free and gift-economy listings.',70,28,27,16,'filter-gift'],['Clothing','Browse or donate clothing.',3,45,28,17,'filter-gift'],['Household','Browse or donate household supplies.',69,45,28,17,'filter-gift']],
 'help-desk':[['How Can We Help?','Open support for resources, housing, food, care, or community navigation.',3,42,28,23,'post-need'],['Translation Support','Request language and translation support.',70,43,27,18,'post-need'],['Accessibility Support','Open accessibility assistance and accommodations.',70,72,27,18,'post-need'],['Care Packages','Browse or contribute emergency care packages.',3,72,28,18,'filter-gift']],
 'repair-cafe':[['Clothes','Open clothing mending and textile repair.',3,40,27,12,'filter-repair'],['Electronics','Open electronics diagnosis and repair.',3,51,27,12,'filter-repair'],['Tools','Open tool repair requests.',3,62,27,12,'filter-repair'],['Bikes','Open bicycle repair and maintenance.',3,73,27,12,'filter-repair'],['Intake','Create a repair request and diagnosis thread.',70,61,27,23,'post-need']],
 'skill-shop':[['Mending','Find or teach mending skills.',3,31,28,12,'filter-learning'],['Foraging','Find or teach field and food skills.',3,43,28,12,'filter-learning'],['Coding','Find or teach technical skills.',3,55,28,12,'filter-learning'],['Music','Find or teach music skills.',3,67,28,12,'filter-learning'],['Sign Up for a Session','Open learning offers and mentorship.',72,49,24,20,'filter-learning']],
 'tool-rental':[['Garden Tools','Browse shared gardening tools.',3,31,27,12,'filter-tools'],['Power Tools','Browse shared power tools.',3,43,27,12,'filter-tools'],['Craft Tools','Browse shared craft tools.',3,55,27,12,'filter-tools'],['Repair Tools','Browse shared repair tools.',3,67,27,12,'filter-tools'],['Reservations','Open reservations and availability.',72,31,24,18,'filter-tools'],['Return & Inspect','Record a tool return or condition check.',69,65,28,18,'inbox']],
 'resource-center':[['Supplies','Find practical supplies and distributions.',3,31,29,13,'market'],['Referrals','Find local services and trusted referrals.',3,44,29,13,'market'],['Housing','Open housing resources and support.',3,57,29,13,'filter-housing'],['Transport','Open transportation and ride resources.',3,70,29,13,'filter-transport'],['Local Services Map','Browse nearby services and organizations.',72,35,25,22,'directory']],
 'volunteer-hub':[["Today's Opportunities",'Browse immediate volunteer needs.',3,31,29,24,'assemblies'],['Recurring Opportunities','Browse ongoing care and service roles.',70,31,27,24,'assemblies'],['Shift Board','Review teams, times, and open shifts.',33,28,34,22,'assemblies'],['Urgent Calls','Open time-sensitive requests for help.',3,56,27,20,'post-need'],['Supply Station','Prepare supplies for active teams.',70,56,27,20,'market']],
 pantry:[['Fresh','Browse fresh produce and refrigerated food.',3,32,28,13,'filter-food'],['Shelf Stable','Browse shelf-stable food.',3,45,28,13,'filter-food'],['Protein','Browse protein and meal staples.',3,58,28,13,'filter-food'],['Hygiene','Browse hygiene and household essentials.',3,71,28,13,'filter-gift'],['Community Kitchen','Coordinate shared meals and kitchen work.',70,37,27,20,'post-collective']]
};
let mallFeatureDetail=null;
function renderMallFeatureHotspots(id){return (FELLOWFARE_SCENE_FEATURES[id]||[]).map(([label,description,x,y,w,h,action])=>`<button class="mall-feature-hotspot" data-mall-feature="${esc(label)}" data-mall-description="${esc(description)}" data-mall-feature-action="${esc(action||'')}" style="left:${x}%;top:${y}%;width:${w}%;height:${h}%" aria-label="${esc(label)}: ${esc(description)}"><span>${esc(label)}</span></button>`).join('')}

let mallScene = localStorage.getItem('fellowfare.mall.scene.v1') || 'atrium';
let mallDirectoryOpen = false;
let mallSearch = '';
const MALL_IMAGE_REQUIREMENTS = Object.entries(FELLOWFARE_MALL_SCENES).map(([id,scene])=>({id,label:scene.label,floor:scene.floor,wing:scene.wing,orientation:'portrait + landscape',required:true}));

function mallMetrics(){
  return {
    needs:state.threads.filter(t=>t.mode==='need'&&t.status!=='complete').length,
    offers:state.threads.filter(t=>t.mode==='offer'&&t.status!=='complete').length,
    collectives:state.threads.filter(t=>t.mode==='collective'&&t.status!=='complete').length,
    agreements:state.agreements.filter(a=>!['complete','cancelled'].includes(a.status)).length
  };
}
function mallSceneStyle(id){
  const index=Object.keys(FELLOWFARE_MALL_SCENES).indexOf(id);
  return `--mall-scene-index:${index};`;
}
function renderMall(){
  let scene=FELLOWFARE_MALL_SCENES[mallScene]||FELLOWFARE_MALL_SCENES.atrium;
  let art=FELLOWFARE_MALL_ART[mallScene];
  if(!art){
    mallScene='atrium';
    scene=FELLOWFARE_MALL_SCENES.atrium;
    art=FELLOWFARE_MALL_ART.atrium;
    localStorage.setItem('fellowfare.mall.scene.v1','atrium');
  }
  document.body.style.setProperty('--ff-current-scene', `url("${art}")`);
  main.innerHTML=`<section class="mall-scene ff-image-screen" data-mall-scene-id="${mallScene}" style="${mallSceneStyle(mallScene)}" aria-label="${esc(scene.label)}">
    <img class="mall-scene-background" src="${art}" alt="FellowFare ${esc(scene.label)}" />
    ${renderMallFeatureHotspots(mallScene)}
  </section>`;
}
function renderMallDirectory(){
  const query=mallSearch.trim().toLowerCase();
  const entries=Object.entries(FELLOWFARE_MALL_SCENES).filter(([id,s])=>!query||`${id} ${s.label} ${s.summary} ${s.floor} ${s.wing}`.toLowerCase().includes(query));
  return `<section class="mall-directory panel" aria-label="Mall directory"><div class="section-heading"><div><p class="eyebrow">Directory kiosk</p><h2>Find anything in FellowFare</h2></div><button class="icon-button" data-mall-action="close-directory" aria-label="Close directory">×</button></div><label class="field"><span>Search rooms and functions</span><input id="mallDirectorySearch" value="${esc(mallSearch)}" placeholder="tools, food, housing, repair, rides…"></label><div class="mall-directory-grid">${entries.map(([id,s])=>`<button data-mall-scene="${id}"><span>${s.icon}</span><strong>${esc(s.label)}</strong><small>${esc(s.floor)} · ${esc(s.wing)}</small><em>${esc(s.summary)}</em></button>`).join('')||'<div class="empty-state"><strong>No room matched.</strong><p>Try a broader word or open the classic market.</p></div>'}</div><p class="muted-copy">The kiosk is already wired to people, listings, assemblies, agreements, and future storefront plugins. Artwork can replace each placeholder without changing scene IDs.</p></section>`;
}
function enterMallScene(id){if(!FELLOWFARE_MALL_SCENES[id])return;if(!FELLOWFARE_MALL_ART[id]){toast('That room still needs its illustrated host scene.');return;}mallScene=id;mallDirectoryOpen=false;localStorage.setItem('fellowfare.mall.scene.v1',id);render();}
function setMarketFilter(query,mode='all'){state.filters.query=query;state.filters.mode=mode;saveState();routeTo('market');}
function runMallAction(action){
  if(action?.startsWith('scene-')){enterMallScene(action.slice(6));return;}
  const mappings={market:()=>routeTo('market'),inbox:()=>routeTo('inbox'),assemblies:()=>routeTo('assemblies'),profile:()=>routeTo('profile'),'post-need':()=>openComposer('need'),'post-offer':()=>openComposer('offer'),'post-collective':()=>openComposer('collective'),'market-needs':()=>{state.filters.mode='need';state.filters.query='';saveState();routeTo('market')},'market-offers':()=>{state.filters.mode='offer';state.filters.query='';saveState();routeTo('market')},'market-collective':()=>{state.filters.mode='collective';state.filters.query='';saveState();routeTo('market')},'filter-gift':()=>setMarketFilter('Gift'),'filter-learning':()=>setMarketFilter('Learning'),'filter-tools':()=>setMarketFilter('Tools & space'),'filter-food':()=>setMarketFilter('Food'),'filter-work':()=>setMarketFilter('Work'),'filter-repair':()=>setMarketFilter('Repair'),'filter-transport':()=>setMarketFilter('Transport'),'filter-housing':()=>setMarketFilter('Housing'),'filter-goods':()=>setMarketFilter('Goods'),'market-credit':()=>setMarketFilter('Community credit'),'loom-matches':()=>{state.loom.action='matches';saveState();routeTo('loom')},'loom-assembly':()=>{state.loom.action='assembly';saveState();routeTo('loom')},'loom-provider':()=>{state.loom.action='provider';saveState();routeTo('loom')},'loom-signals':()=>{state.loom.action='signals';saveState();routeTo('loom')},'loom-review':()=>{state.loom.action='review';saveState();routeTo('loom')}};
  if(action==='directory'){enterMallScene('resource-center');return;}
  if(action==='close-directory'){enterMallScene('atrium');return;}
  mappings[action]?.();
}

function renderMarket() {
  const filtered = getFilteredThreads();
  const needs = state.threads.filter((thread) => thread.status !== 'complete' && thread.mode === 'need').length;
  const offers = state.threads.filter((thread) => thread.status !== 'complete' && thread.mode === 'offer').length;
  const collective = state.threads.filter((thread) => thread.status !== 'complete' && thread.mode === 'collective').length;
  main.innerHTML = `
    <div class="page">
      <section class="hero">
        <div class="hero-copy">
          <p class="eyebrow">Everything people can do for one another</p>
          <h1>Ask. Offer.<br>Make it workable.</h1>
          <p class="lead">Buy, sell, trade, lend, hire, or give. Fellowfare helps one need become one complete arrangement, even when several people make it possible.</p>
          <div class="hero-actions">
            <button class="button button-primary" data-open-composer="need">Post what I need</button>
            <button class="button button-secondary" data-open-composer="offer">Share what I offer</button>
          </div>
        </div>
        <aside class="hero-side">
          <div>
            <p class="eyebrow" style="color:#f2ad88">Market pulse</p>
            <h2>What is moving nearby</h2>
          </div>
          <div class="pulse-list">
            <div class="pulse-item"><span class="pulse-icon">${needs}</span><div><strong>Open needs</strong><small>Requests ready for a response</small></div></div>
            <div class="pulse-item"><span class="pulse-icon" style="background:#2c8869">${offers}</span><div><strong>Available offers</strong><small>Skills, goods, tools, and time</small></div></div>
            <div class="pulse-item"><span class="pulse-icon" style="background:#b4924e">${collective}</span><div><strong>Things forming</strong><small>Shared demand becoming possible</small></div></div>
          </div>
        </aside>
      </section>

      <div class="market-tools">
        <label class="search-box"><span class="sr-only">Search the market</span><input id="marketSearch" type="search" value="${esc(state.filters.query)}" placeholder="Search needs, offers, skills, goods…" /></label>
        <select id="sortThreads" class="sort-select" aria-label="Sort threads">
          <option value="newest" ${state.filters.sort === 'newest' ? 'selected' : ''}>Newest first</option>
          <option value="saved" ${state.filters.sort === 'saved' ? 'selected' : ''}>Saved first</option>
          <option value="price-low" ${state.filters.sort === 'price-low' ? 'selected' : ''}>Lowest amount</option>
          <option value="popular" ${state.filters.sort === 'popular' ? 'selected' : ''}>Most viewed</option>
        </select>
      </div>
      <div class="filter-row" aria-label="Market filters">
        ${['all','need','offer','collective'].map((mode) => `<button class="filter-chip ${state.filters.mode === mode ? 'is-active' : ''}" data-filter-mode="${mode}">${mode === 'all' ? 'Everything' : modeText(mode)}</button>`).join('')}
        ${categories.slice(0,6).map((category) => `<button class="filter-chip" data-category-search="${esc(category)}">${esc(category)}</button>`).join('')}
      </div>

      <div class="section-heading"><div><h2>${filtered.length} exchange thread${filtered.length === 1 ? '' : 's'}</h2><p>Open a thread to propose, message, share, or assemble a multi-person answer.</p></div></div>
      ${filtered.length ? `<div class="thread-grid">${filtered.map(renderThreadCard).join('')}</div>` : renderEmpty('No matching threads', 'Try another search, clear the filter, or post the thing you wish existed.')}
    </div>`;
}

function getFilteredThreads() {
  const query = state.filters.query.trim().toLowerCase();
  let threads = state.threads.filter((thread) => thread.status !== 'archived');
  if (state.filters.mode !== 'all') threads = threads.filter((thread) => thread.mode === state.filters.mode);
  if (query) {
    threads = threads.filter((thread) => [thread.title, thread.description, thread.category, thread.area, ...(thread.methods || [])].join(' ').toLowerCase().includes(query));
  }
  if (state.filters.sort === 'newest') threads.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (state.filters.sort === 'saved') threads.sort((a,b) => Number(b.saved) - Number(a.saved) || new Date(b.createdAt) - new Date(a.createdAt));
  if (state.filters.sort === 'price-low') threads.sort((a,b) => Number(a.amount || Infinity) - Number(b.amount || Infinity));
  if (state.filters.sort === 'popular') threads.sort((a,b) => Number(b.views || 0) - Number(a.views || 0));
  return threads;
}

function renderThreadCard(thread) {
  const person = getPerson(thread.ownerId);
  return `
    <article class="thread-card" data-mode="${esc(thread.mode)}">
      <div class="thread-top"><span class="mode-label">${modeText(thread.mode)}</span><button class="save-button ${thread.saved ? 'is-saved' : ''}" data-save-thread="${thread.id}" aria-label="${thread.saved ? 'Unsave' : 'Save'} ${esc(thread.title)}">${thread.saved ? '◆' : '◇'}</button></div>
      <h3>${esc(thread.title)}</h3>
      <p>${esc(thread.description)}</p>
      <div class="thread-meta">
        <span class="meta-pill">${esc(thread.category)}</span>
        ${thread.area ? `<span class="meta-pill">⌖ ${esc(thread.area)}</span>` : ''}
        ${thread.when ? `<span class="meta-pill">◷ ${esc(thread.when)}</span>` : ''}
        ${thread.partial ? `<span class="meta-pill">＋ multi-person</span>` : ''}
      </div>
      <div class="thread-footer">
        <div class="person"><span class="avatar">${esc(person.initials)}</span><span class="person-info"><strong>${esc(person.name)}</strong><small>${formatRelative(thread.createdAt)} · ${thread.views || 0} views</small></span></div>
        <span class="price">${esc(priceLabel(thread))}</span>
      </div>
      <button class="card-button" data-open-thread="${thread.id}" aria-label="Open ${esc(thread.title)}"></button>
    </article>`;
}

function renderAssemblies() {
  const active = state.assemblies.filter((assembly) => assembly.status !== 'complete');
  const totalCommitments = active.reduce((sum, assembly) => sum + assembly.commitments.length, 0);
  const ready = active.filter((assembly) => assemblyProgress(assembly) >= 100).length;
  main.innerHTML = `
    <div class="page">
      <div class="page-header"><div><p class="eyebrow">Multi-person exchange</p><h1>Assemblies</h1><p>One need can be fulfilled by a patchwork of people, goods, money, skills, and access. Assemblies keep the patchwork legible.</p></div><button class="button button-primary" data-open-composer="collective">Start a collective thread</button></div>
      <div class="stat-strip">
        <div class="stat-card"><strong>${active.length}</strong><span>forming assemblies</span></div>
        <div class="stat-card"><strong>${totalCommitments}</strong><span>active commitments</span></div>
        <div class="stat-card"><strong>${ready}</strong><span>ready to confirm</span></div>
        <div class="stat-card"><strong>${state.profile.credits}</strong><span>community credits</span></div>
      </div>
      <div class="assembly-grid">${active.length ? active.map(renderAssemblyCard).join('') : renderEmpty('Nothing is assembling yet', 'Start a collective thread and let several small contributions become one complete answer.')}</div>
      <div class="section-heading"><div><h2>Assembly-ready needs</h2><p>Threads that explicitly welcome partial fulfillment.</p></div></div>
      <div class="thread-grid">${state.threads.filter((thread) => thread.partial && !state.assemblies.some((assembly) => assembly.threadId === thread.id)).map(renderThreadCard).join('') || renderEmpty('No unassembled needs', 'New partial-fill threads will appear here.')}</div>
    </div>`;
}

function assemblyProgress(assembly) {
  const value = assembly.commitments.reduce((sum, commitment) => sum + Number(commitment.value || 0), 0);
  return Math.min(100, Math.round((value / Number(assembly.target || 1)) * 100));
}

function renderAssemblyCard(assembly) {
  const thread = getThread(assembly.threadId);
  const progress = assemblyProgress(assembly);
  const mine = assembly.commitments.some((commitment) => commitment.personId === 'me');
  return `
    <article class="assembly-card">
      <span class="mode-label">${progress >= 100 ? 'Ready' : 'Forming'}</span>
      <h3>${esc(assembly.title)}</h3>
      <p>${thread ? esc(thread.description) : 'A shared arrangement is forming.'}</p>
      <div class="progress-track" aria-label="${progress}% complete"><span style="width:${progress}%"></span></div>
      <small><strong>${progress}% assembled</strong> toward ${esc(assembly.target)} ${esc(assembly.unit)}</small>
      <div class="commitment-list">
        ${assembly.commitments.map((commitment) => {
          const person = getPerson(commitment.personId);
          return `<div class="commitment"><span><strong>${esc(person.name)}</strong><br><small>${esc(commitment.contribution)}</small></span><span>${esc(commitment.value)}</span></div>`;
        }).join('')}
      </div>
      ${(assembly.suggestions || []).length ? `<div class="assembly-draft"><strong>Loom plan · unconfirmed</strong>${assembly.suggestions.map((suggestion) => `<div class="commitment suggested"><span><strong>${esc(suggestion.contributor || suggestion.label || 'Possible contributor')}</strong><br><small>${esc(suggestion.contribution || '')}</small></span><span>?</span></div>`).join('')}${(assembly.gaps || []).length ? `<small>${esc(assembly.gaps.join(' · '))}</small>` : ''}</div>` : ''}
      <div class="hero-actions">
        <button class="button button-primary compact" data-join-assembly="${assembly.id}">${mine ? 'Update my commitment' : 'Add my piece'}</button>
        ${thread ? `<button class="button button-ghost compact" data-open-thread="${thread.id}">Open thread</button>` : ''}
      </div>
    </article>`;
}

function renderInbox() {
  const agreements = (state.agreements || []).map(normalizeAgreement).sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  state.agreements = agreements;
  const activeAgreements = agreements.filter((agreement) => !['settled','cancelled'].includes(agreement.status));
  const dueMilestones = activeAgreements.flatMap((agreement) => agreement.milestones.map((milestone) => ({ agreement, milestone }))).filter(({ milestone }) => milestone.status === 'pending' && milestone.dueAt);
  const overdue = dueMilestones.filter(({ milestone }) => isOverdue(milestone.dueAt, milestone.status)).length;
  const unsettled = agreements.filter((agreement) => agreementProgressForUI(agreement) === 100 && !['settled','waived'].includes(agreement.settlement.status)).length;
  const threads = uniqueConversationThreads();
  if (!activeConversationThreadId && threads[0]) activeConversationThreadId = threads[0].id;
  const activeThread = getThread(activeConversationThreadId);
  const activeMessages = state.messages.filter((message) => message.threadId === activeConversationThreadId).sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));
  if (activeConversationThreadId) {
    state.messages.forEach((message) => { if (message.threadId === activeConversationThreadId && message.toId === 'me') message.read = true; });
    saveState();
  }
  main.innerHTML = `
    <div class="page">
      <div class="page-header"><div><p class="eyebrow">Agreements, proof, and conversation</p><h1>Exchange Desk</h1><p>Carry an arrangement from accepted proposal to fulfilled work, settlement, repair, and contextual trust.</p></div><button class="button button-ghost" data-export-civweave>Export Civweave bundle</button></div>
      <div class="stat-strip">
        <div class="stat-card"><strong>${activeAgreements.length}</strong><span>active agreements</span></div>
        <div class="stat-card"><strong>${dueMilestones.length}</strong><span>dated milestones</span></div>
        <div class="stat-card"><strong>${overdue}</strong><span>overdue actions</span></div>
        <div class="stat-card"><strong>${unsettled}</strong><span>ready to settle</span></div>
      </div>
      <div class="section-heading"><div><h2>Exchange ledger</h2><p>Accepted proposals become explicit, portable agreements. Nothing is silently confirmed for another person.</p></div></div>
      ${agreements.length ? `<div class="agreement-grid">${agreements.map(renderAgreementCard).join('')}</div>` : renderEmpty('No agreements yet', 'Accept a proposal to create a reviewable agreement and begin the fulfillment ledger.')}
      <div class="section-heading"><div><h2>Conversations</h2><p>Messages remain attached to the market thread that created the agreement.</p></div></div>
      ${threads.length ? `
      <section class="inbox-layout">
        <div class="conversation-list">
          ${threads.map((thread) => {
            const person = conversationPerson(thread.id);
            const latest = state.messages.filter((message) => message.threadId === thread.id).sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt))[0];
            const agreement = getAgreementForThread(thread.id);
            return `<button class="conversation-item ${thread.id === activeConversationThreadId ? 'is-active' : ''}" data-conversation="${thread.id}"><span class="avatar">${esc(person.initials)}</span><span class="conversation-preview"><strong>${esc(thread.title)}</strong><small>${agreement ? `${agreementStatusLabel(agreement.status)} · ` : ''}${latest ? esc(latest.text) : 'Start the conversation'}</small></span></button>`;
          }).join('')}
        </div>
        <div class="chat-pane">
          ${activeThread ? `<div class="chat-header"><strong>${esc(activeThread.title)}</strong><br><small>${esc(conversationPerson(activeThread.id).name)}</small></div>` : ''}
          <div class="chat-messages">${activeMessages.map(renderMessage).join('') || '<div class="empty-state">No messages yet.</div>'}</div>
          ${activeThread ? `<form class="chat-compose" id="inlineMessageForm"><input type="hidden" name="threadId" value="${activeThread.id}"><input name="text" required autocomplete="off" placeholder="Write a message…"><button class="button button-primary compact">Send</button></form>` : ''}
        </div>
      </section>` : renderEmpty('No conversations yet', 'Respond to a thread or send a message to begin an arrangement.')}
    </div>`;
}

function agreementProgressForUI(agreement) {
  return ledgerProgress(agreement);
}

function agreementStatusLabel(status) {
  return ({ draft:'Awaiting confirmation', active:'In progress', fulfilled:'Fulfilled', settled:'Settled', repair:'Repair open', cancelled:'Cancelled' })[status] || 'Agreement';
}

function renderAgreementCard(agreement) {
  const progress = agreementProgressForUI(agreement);
  const participants = agreement.participants.map((participant) => getPerson(participant.personId));
  const nextMilestone = agreement.milestones.find((milestone) => milestone.status === 'pending');
  const confirmationCount = agreement.participants.filter((participant) => participant.confirmedAt).length;
  return `<article class="agreement-card status-${esc(agreement.status)}">
    <div class="agreement-card-top"><span class="mode-label">${agreementStatusLabel(agreement.status)}</span>${agreement.recurrence.enabled ? '<span class="recurring-badge">↻ recurring</span>' : ''}</div>
    <h3>${esc(agreement.title)}</h3>
    <p>${esc(agreement.terms.scope || 'A portable exchange agreement.')}</p>
    <div class="participant-stack">${participants.map((person) => `<span class="avatar" title="${esc(person.name)}">${esc(person.initials)}</span>`).join('')}<small>${confirmationCount}/${agreement.participants.length} confirmed</small></div>
    <div class="progress-track" aria-label="${progress}% fulfilled"><span style="width:${progress}%"></span></div>
    <div class="agreement-card-meta">
      <small><strong>${progress}% fulfilled</strong></small>
      <small>${nextMilestone ? `${isOverdue(nextMilestone.dueAt, nextMilestone.status) ? 'Overdue: ' : 'Next: '}${esc(nextMilestone.title)}${nextMilestone.dueAt ? ` · ${formatDate(nextMilestone.dueAt)}` : ''}` : 'No pending milestones'}</small>
      <small>${esc(agreement.terms.compensation)} · ${esc(agreement.settlement.status)}</small>
    </div>
    <button class="button button-primary compact" data-open-agreement="${agreement.id}">Open ledger</button>
  </article>`;
}

function uniqueConversationThreads() {
  const ids = [...new Set(state.messages.filter((message) => message.fromId === 'me' || message.toId === 'me').map((message) => message.threadId))];
  return ids.map(getThread).filter(Boolean);
}

function conversationPerson(threadId) {
  const thread = getThread(threadId);
  if (!thread) return getPerson('me');
  if (thread.ownerId !== 'me') return getPerson(thread.ownerId);
  const message = state.messages.find((item) => item.threadId === threadId && item.fromId !== 'me');
  return getPerson(message?.fromId || 'me');
}

function renderMessage(message) {
  return `<div class="message ${message.fromId === 'me' ? 'mine' : ''}">${esc(message.text)}<time>${formatRelative(message.createdAt)}</time></div>`;
}


function openAgreement(agreementId) {
  const agreement = getAgreement(agreementId);
  if (!agreement) return;
  deriveAgreementStatus(agreement);
  const thread = getThread(agreement.threadId);
  const progress = agreementProgressForUI(agreement);
  const myParticipant = agreement.participants.find((participant) => participant.personId === 'me');
  const events = (state.ledgerEvents || []).filter((event) => event.entityId === agreement.id || event.payload?.agreementId === agreement.id).slice(0,8);
  document.querySelector('#detailContent').innerHTML = `
    <header class="dialog-header"><div><p class="eyebrow">Portable exchange agreement</p></div><button class="icon-button" data-close-detail aria-label="Close">×</button></header>
    <section class="detail-hero agreement-detail-hero">
      <div class="agreement-card-top"><span class="mode-label">${agreementStatusLabel(agreement.status)}</span>${agreement.recurrence.enabled ? `<span class="recurring-badge">↻ ${esc(agreement.recurrence.cadence)}</span>` : ''}</div>
      <h2>${esc(agreement.title)}</h2>
      <p>${esc(agreement.terms.scope)}</p>
      <div class="progress-track" aria-label="${progress}% fulfilled"><span style="width:${progress}%"></span></div>
      <div class="thread-meta"><span class="meta-pill">${progress}% fulfilled</span><span class="meta-pill">${esc(agreement.terms.compensation)}</span><span class="meta-pill">${esc(agreement.terms.timing)}</span></div>
      <div class="detail-actions">
        ${myParticipant && !myParticipant.confirmedAt ? `<button class="button button-primary" data-confirm-agreement="${agreement.id}">Confirm my side</button>` : ''}
        <button class="button button-secondary" data-ledger-action="milestone" data-agreement-id="${agreement.id}">Add milestone</button>
        <button class="button button-ghost" data-ledger-action="evidence" data-agreement-id="${agreement.id}">Add evidence</button>
        <button class="button button-ghost" data-share-agreement="${agreement.id}">Share agreement</button>
        ${CIVWEAVE_EMBEDDED ? `<button class="button button-ghost" data-handoff-work="${agreement.id}">Carry confirmed scope to Cerbanimo</button>` : ''}
        ${thread ? `<button class="button button-ghost" data-open-thread="${thread.id}">Open market thread</button>` : ''}
      </div>
    </section>
    <section class="detail-section">
      <h3>Human confirmations</h3>
      <div class="participant-confirmations">${agreement.participants.map((participant) => {
        const person = getPerson(participant.personId);
        return `<div class="confirmation-row"><span class="person"><span class="avatar">${esc(person.initials)}</span><span class="person-info"><strong>${esc(person.name)}</strong><small>${esc(participant.role)}</small></span></span><span class="confirmation-state ${participant.confirmedAt ? 'confirmed' : ''}">${participant.confirmedAt ? `Confirmed ${formatDate(participant.confirmedAt)}` : 'Not yet confirmed'}</span></div>`;
      }).join('')}</div>
      <div class="terms-box"><div><strong>Scope</strong><p>${esc(agreement.terms.scope)}</p></div><div><strong>Compensation</strong><p>${esc(agreement.terms.compensation)}</p></div><div><strong>Timing</strong><p>${esc(agreement.terms.timing)}</p></div>${agreement.terms.conditions ? `<div><strong>Conditions</strong><p>${esc(agreement.terms.conditions)}</p></div>` : ''}</div>
    </section>
    <section class="detail-section">
      <div class="section-heading compact-heading"><div><h3>Milestones</h3><p>Completion remains reversible until the arrangement is settled.</p></div></div>
      <div class="milestone-list">${agreement.milestones.length ? agreement.milestones.map((milestone) => {
        const owner = getPerson(milestone.ownerId);
        const evidenceCount = milestone.evidenceIds?.length || 0;
        return `<article class="milestone-row ${milestone.status === 'complete' ? 'is-complete' : ''} ${isOverdue(milestone.dueAt, milestone.status) ? 'is-overdue' : ''}"><button class="milestone-toggle" data-toggle-milestone="${agreement.id}:${milestone.id}" aria-label="${milestone.status === 'complete' ? 'Reopen' : 'Complete'} ${esc(milestone.title)}">${milestone.status === 'complete' ? '✓' : '○'}</button><div><strong>${esc(milestone.title)}</strong><small>${esc(owner.name)}${milestone.dueAt ? ` · ${formatDate(milestone.dueAt)}` : ''}${evidenceCount ? ` · ${evidenceCount} proof item${evidenceCount === 1 ? '' : 's'}` : ''}</small></div><button class="button button-ghost compact" data-ledger-action="evidence" data-agreement-id="${agreement.id}" data-milestone-id="${milestone.id}">Proof</button></article>`;
      }).join('') : '<div class="empty-state">No milestones yet.</div>'}</div>
    </section>
    <section class="detail-section ledger-two-column">
      <div>
        <h3>Evidence custody</h3>
        ${agreement.evidence.length ? `<div class="evidence-list">${agreement.evidence.map((item) => `<article class="evidence-item"><span class="evidence-kind">${esc(item.kind)}</span><div><strong>${esc(item.label)}</strong>${item.note ? `<p>${esc(item.note)}</p>` : ''}${item.url ? `<a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">Open reference</a>` : ''}<small>${formatDate(item.createdAt)}</small></div></article>`).join('')}</div>` : '<p class="muted-copy">No evidence has been attached. Fellowfare stores references and notes locally rather than uploading files.</p>'}
      </div>
      <div>
        <h3>Settlement record</h3>
        <div class="settlement-card"><span class="settlement-status">${esc(agreement.settlement.status)}</span><strong>${agreement.settlement.amount != null ? `$${Number(agreement.settlement.amount).toLocaleString('en-US')}` : esc(agreement.settlement.method || 'Open terms')}</strong><p>${esc(agreement.settlement.method || 'No method recorded')}</p>${agreement.settlement.note ? `<small>${esc(agreement.settlement.note)}</small>` : ''}</div>
        <div class="hero-actions"><button class="button button-primary compact" data-ledger-action="settlement" data-agreement-id="${agreement.id}">${agreement.settlement.status === 'settled' ? 'Update settlement' : 'Record settlement'}</button>${agreement.status === 'settled' && !agreement.reviews.some((review) => review.fromId === 'me') ? `<button class="button button-ghost compact" data-ledger-action="review" data-agreement-id="${agreement.id}">Add contextual review</button>` : ''}</div>
      </div>
    </section>
    <section class="detail-section ledger-two-column">
      <div>
        <h3>Recurrence</h3>
        ${agreement.recurrence.enabled ? `<p>${esc(agreement.recurrence.cadence)} cycle · next ${formatDate(agreement.recurrence.nextAt)}</p><button class="button button-ghost compact" data-next-cycle="${agreement.id}">Start next cycle</button>` : `<p class="muted-copy">Make a proven exchange repeat without rebuilding its terms.</p><button class="button button-ghost compact" data-ledger-action="recurrence" data-agreement-id="${agreement.id}">Make recurring</button>`}
      </div>
      <div>
        <h3>Repair path</h3>
        ${agreement.repair.status === 'open' ? `<div class="repair-card"><strong>Repair requested</strong><p>${esc(agreement.repair.issue)}</p><small>${esc(agreement.repair.requestedRemedy)}</small><button class="button button-primary compact" data-resolve-repair="${agreement.id}">Record resolution</button></div>` : `<p class="muted-copy">A repair request preserves the agreement instead of forcing an immediate punishment score.</p><button class="button button-ghost compact" data-ledger-action="repair" data-agreement-id="${agreement.id}">Open repair request</button>`}
      </div>
    </section>
    ${agreement.reviews.length ? `<section class="detail-section"><h3>Contextual trust attestations</h3>${agreement.reviews.map((review) => `<article class="review-card"><strong>${esc(review.context || agreement.category)}</strong><span>${review.ratings.communication}/5 communication · ${review.ratings.reliability}/5 reliability · ${review.ratings.quality}/5 quality</span>${review.note ? `<p>${esc(review.note)}</p>` : ''}</article>`).join('')}</section>` : ''}
    <section class="detail-section"><h3>Event trail</h3><div class="event-list">${events.length ? events.map((event) => `<div class="event-row"><span>${esc(event.type.replaceAll('.',' · '))}</span><time>${formatRelative(event.timestamp)}</time></div>`).join('') : '<p class="muted-copy">No ledger events recorded yet.</p>'}</div></section>`;
  if (!detailDialog.open) detailDialog.showModal();
}

function confirmAgreement(agreementId) {
  const agreement = getAgreement(agreementId);
  const participant = agreement?.participants.find((item) => item.personId === 'me');
  if (!agreement || !participant || participant.confirmedAt) return;
  participant.confirmedAt = new Date().toISOString();
  deriveAgreementStatus(agreement);
  agreement.updatedAt = participant.confirmedAt;
  appendLedgerEvent('agreement.confirmed', 'agreement', agreement.id, { participantId: 'me' });
  saveState();
  openAgreement(agreement.id);
  toast('Your side of the agreement is confirmed.');
}

function toggleAgreementMilestone(payload) {
  const [agreementId, milestoneId] = payload.split(':');
  const agreement = getAgreement(agreementId);
  if (!agreement) return;
  const milestone = agreement.milestones.find((item) => item.id === milestoneId);
  ledgerCompleteMilestone(agreement, milestoneId);
  appendLedgerEvent(milestone?.status === 'complete' ? 'milestone.completed' : 'milestone.reopened', 'agreement', agreement.id, { milestoneId });
  const thread = getThread(agreement.threadId);
  if (thread && agreement.status === 'fulfilled') thread.status = 'fulfilled';
  saveState();
  openAgreement(agreement.id);
  toast(milestone?.status === 'complete' ? 'Milestone completed.' : 'Milestone reopened.');
}

function openLedgerAction(action, agreementId, milestoneId = '') {
  if (!AGREEMENT_ACTIONS.includes(action) || !getAgreement(agreementId)) return;
  const fieldIds = ['ledgerPrimaryField','ledgerSecondaryField','ledgerDateField','ledgerKindField','ledgerCadenceField','ledgerRatingField','ledgerNotesField'];
  fieldIds.forEach((fieldId) => { document.querySelector(`#${fieldId}`).hidden = true; });
  ['ledgerPrimary','ledgerSecondary','ledgerDate','ledgerNotes'].forEach((fieldId) => { const field = document.querySelector(`#${fieldId}`); field.value = ''; field.required = false; });
  document.querySelector('#ledgerActionType').value = action;
  document.querySelector('#ledgerAgreementId').value = agreementId;
  document.querySelector('#ledgerMilestoneId').value = milestoneId;
  const heading = document.querySelector('#ledgerActionHeading');
  const help = document.querySelector('#ledgerActionHelp');
  const submit = document.querySelector('#ledgerActionSubmit');
  const show = (...ids) => ids.forEach((fieldId) => { document.querySelector(`#${fieldId}`).hidden = false; });
  if (action === 'milestone') {
    heading.textContent = 'Add a milestone'; help.textContent = 'Break fulfillment into a specific, visible step.'; submit.textContent = 'Add milestone';
    show('ledgerPrimaryField','ledgerSecondaryField','ledgerDateField');
    document.querySelector('#ledgerPrimaryLabel').textContent = 'Milestone'; document.querySelector('#ledgerPrimary').required = true;
    document.querySelector('#ledgerSecondaryLabel').textContent = 'Owner name or role';
    document.querySelector('#ledgerDateLabel').textContent = 'Due date';
  }
  if (action === 'evidence') {
    heading.textContent = 'Attach evidence'; help.textContent = 'Store a note or reference. Fellowfare does not upload private files in this release.'; submit.textContent = 'Attach evidence';
    show('ledgerPrimaryField','ledgerSecondaryField','ledgerKindField','ledgerNotesField');
    document.querySelector('#ledgerPrimaryLabel').textContent = 'Label'; document.querySelector('#ledgerPrimary').required = true;
    document.querySelector('#ledgerSecondaryLabel').textContent = 'Link or reference';
    document.querySelector('#ledgerNotesLabel').textContent = 'What does this show?';
  }
  if (action === 'settlement') {
    const agreement = getAgreement(agreementId);
    heading.textContent = 'Record settlement'; help.textContent = 'This records what the people say moved. It does not process money.'; submit.textContent = 'Record as settled';
    show('ledgerPrimaryField','ledgerSecondaryField','ledgerNotesField');
    document.querySelector('#ledgerPrimaryLabel').textContent = 'Method'; document.querySelector('#ledgerPrimary').value = agreement.settlement.method || agreement.terms.compensation; document.querySelector('#ledgerPrimary').required = true;
    document.querySelector('#ledgerSecondaryLabel').textContent = 'Amount in USD, optional'; document.querySelector('#ledgerSecondary').value = agreement.settlement.amount ?? '';
    document.querySelector('#ledgerNotesLabel').textContent = 'Receipt, barter, gift, or completion note';
  }
  if (action === 'repair') {
    heading.textContent = 'Open a repair request'; help.textContent = 'Describe the gap and a workable remedy before reputation changes.'; submit.textContent = 'Open repair path';
    show('ledgerPrimaryField','ledgerSecondaryField');
    document.querySelector('#ledgerPrimaryLabel').textContent = 'What went wrong?'; document.querySelector('#ledgerPrimary').required = true;
    document.querySelector('#ledgerSecondaryLabel').textContent = 'Requested remedy'; document.querySelector('#ledgerSecondary').required = true;
  }
  if (action === 'review') {
    heading.textContent = 'Add contextual trust'; help.textContent = 'Rate this exchange in its actual context rather than producing one universal star score.'; submit.textContent = 'Save trust attestation';
    show('ledgerPrimaryField','ledgerRatingField','ledgerNotesField');
    document.querySelector('#ledgerPrimaryLabel').textContent = 'Context'; document.querySelector('#ledgerPrimary').value = getAgreement(agreementId).category; document.querySelector('#ledgerPrimary').required = true;
    document.querySelector('#ledgerNotesLabel').textContent = 'Optional public note';
  }
  if (action === 'recurrence') {
    heading.textContent = 'Make this recurring'; help.textContent = 'Reuse the agreement terms while each cycle keeps its own evidence and settlement.'; submit.textContent = 'Enable recurrence';
    show('ledgerCadenceField','ledgerDateField');
    document.querySelector('#ledgerDateLabel').textContent = 'Next cycle date'; document.querySelector('#ledgerDate').required = true;
  }
  ledgerActionDialog.showModal();
}

function submitLedgerAction(event) {
  event.preventDefault();
  const action = document.querySelector('#ledgerActionType').value;
  const agreement = getAgreement(document.querySelector('#ledgerAgreementId').value);
  const milestoneId = document.querySelector('#ledgerMilestoneId').value;
  if (!agreement || !AGREEMENT_ACTIONS.includes(action)) return;
  const primary = document.querySelector('#ledgerPrimary').value.trim();
  const secondary = document.querySelector('#ledgerSecondary').value.trim();
  const notes = document.querySelector('#ledgerNotes').value.trim();
  if (action === 'milestone') {
    const owner = agreement.participants.find((participant) => getPerson(participant.personId).name.toLowerCase().includes(secondary.toLowerCase()))?.personId || 'me';
    const due = document.querySelector('#ledgerDate').value;
    ledgerAddMilestone(agreement, { id: id('milestone'), title: primary, ownerId: owner, dueAt: due ? new Date(`${due}T12:00:00`).toISOString() : '' });
    appendLedgerEvent('milestone.added','agreement',agreement.id,{ title:primary, ownerId:owner });
  }
  if (action === 'evidence') {
    const evidence = ledgerAddEvidence(agreement, { id:id('evidence'), kind:document.querySelector('#ledgerKind').value, label:primary, url:secondary, note:notes, addedBy:'me' }, milestoneId);
    appendLedgerEvent('evidence.attached','agreement',agreement.id,{ evidenceId:evidence.id, milestoneId });
  }
  if (action === 'settlement') {
    const wasSettled = agreement.settlement.status === 'settled';
    ledgerRecordSettlement(agreement, { method:primary, amount:secondary === '' ? null : Number(secondary), currency:'USD', note:notes });
    appendLedgerEvent('settlement.recorded','agreement',agreement.id,{ method:primary, amount:secondary === '' ? null : Number(secondary), currency:'USD' });
    const thread = getThread(agreement.threadId); if (thread && agreement.status === 'settled') thread.status = 'complete';
    if (!wasSettled && agreement.status === 'settled') state.profile.completed = Number(state.profile.completed || 0) + 1;
  }
  if (action === 'repair') {
    ledgerOpenRepair(agreement, { issue:primary, requestedRemedy:secondary });
    appendLedgerEvent('repair.opened','agreement',agreement.id,{ issue:primary, requestedRemedy:secondary });
    emitCivweaveSignal({ signalId:`repair:${agreement.id}`, kind:'exchange-repair', subjectType:'repair', subjectId:agreement.id, title:`Repair requested · ${agreement.title}`, detail:`${primary}${secondary ? ` · Requested remedy: ${secondary}` : ''}` });
  }
  if (action === 'review') {
    const target = agreement.participants.find((participant) => participant.personId !== 'me')?.personId || '';
    const review = ledgerAddReview(agreement, { id:id('review'), fromId:'me', toId:target, context:primary, ratings:{ communication:Number(document.querySelector('#ratingCommunication').value), reliability:Number(document.querySelector('#ratingReliability').value), quality:Number(document.querySelector('#ratingQuality').value), repair:Number(document.querySelector('#ratingRepair').value) }, note:notes });
    appendLedgerEvent('trust.attested','agreement',agreement.id,{ reviewId:review.id, toId:target, context:primary });
    const person = state.people.find((item) => item.id === target);
    if (person) {
      person.trustBreakdown = trustSnapshotFromReviews(person.trustBreakdown || { communication:person.trust, reliability:person.trust, quality:person.trust, repair:person.trust }, [review]);
      person.trust = Math.round(Object.values(person.trustBreakdown).reduce((sum,value)=>sum+value,0)/4);
    }
  }
  if (action === 'recurrence') {
    const next = document.querySelector('#ledgerDate').value;
    agreement.recurrence = { enabled:true, cadence:document.querySelector('#ledgerCadence').value, nextAt:new Date(`${next}T12:00:00`).toISOString() };
    agreement.updatedAt = new Date().toISOString();
    appendLedgerEvent('recurrence.enabled','agreement',agreement.id,{ ...agreement.recurrence });
  }
  deriveAgreementStatus(agreement);
  saveState();
  ledgerActionDialog.close();
  openAgreement(agreement.id);
  toast('Agreement ledger updated.');
}

function resolveAgreementRepair(agreementId) {
  const agreement = getAgreement(agreementId);
  if (!agreement || agreement.repair.status !== 'open') return;
  const note = prompt('How was the repair resolved?', 'The agreed remedy was completed.');
  if (note == null) return;
  ledgerResolveRepair(agreement, note.trim());
  appendLedgerEvent('repair.resolved','agreement',agreement.id,{ note:note.trim() });
  emitCivweaveSignal({ signalId:`repair:${agreement.id}`, kind:'exchange-repair', subjectType:'repair', subjectId:agreement.id, title:`Repair resolved · ${agreement.title}`, detail:note.trim(), state:'resolved' });
  saveState(); openAgreement(agreement.id); toast('Repair resolution recorded.');
}

function startNextAgreementCycle(agreementId) {
  const agreement = getAgreement(agreementId);
  if (!agreement?.recurrence.enabled) return;
  if (!confirm('Start the next cycle? Current proof remains in the event history, while milestones and settlement reset.')) return;
  advanceRecurringAgreement(agreement);
  appendLedgerEvent('recurrence.advanced','agreement',agreement.id,{ nextAt:agreement.recurrence.nextAt, cadence:agreement.recurrence.cadence });
  saveState(); openAgreement(agreement.id); toast('Next exchange cycle opened.');
}

async function shareAgreement(agreementId) {
  const agreement = getAgreement(agreementId);
  if (!agreement) return;
  const payload = { format:'fellowfare.agreement', version:APP_VERSION, exportedAt:new Date().toISOString(), agreement:normalizeAgreement(agreement), thread:getThread(agreement.threadId), events:(state.ledgerEvents || []).filter((event)=>event.entityId===agreement.id) };
  const file = new File([JSON.stringify(payload,null,2)], `${slug(agreement.title)}.fellowfare-agreement.json`, { type:'application/json' });
  if (navigator.share && navigator.canShare?.({ files:[file] })) {
    try { await navigator.share({ title:agreement.title, text:'Fellowfare agreement pack', files:[file] }); return; } catch (error) { if (error.name === 'AbortError') return; }
  }
  downloadBlob(file,file.name); toast('Agreement pack downloaded.');
}

function exportCivweaveBundle() {
  const bundle = buildCivweaveBundle(state,{ version:APP_VERSION, nodeId:state.profile.id });
  downloadBlob(new Blob([JSON.stringify(bundle,null,2)],{type:'application/json'}),`fellowfare-civweave-bridge-${new Date().toISOString().slice(0,10)}.json`);
  toast('Civweave bridge bundle exported.');
}

function civweaveCoinLedger() {
  try {
    const parsed=JSON.parse(localStorage.getItem('fellowfare.reward-ledger.v1.1')||localStorage.getItem('fellowfare.reward-ledger.v1')||'null');
    return parsed&&['fellowfare.coin-ledger.v1.1','fellowfare.coin-ledger.v1'].includes(parsed.schema)?parsed:null;
  } catch { return null; }
}

function rewardAccountBalance(ledger) {
  if(!ledger||!ledger.balances)return 0;
  let identityId='';try{identityId=JSON.parse(localStorage.getItem('civweave-identity-vault')||'null')?.identity?.identityId||''}catch{}
  const ids=[identityId,state.profile.id,'me',state.profile.name,state.profile.initials].filter(Boolean);
  return ids.reduce((sum,key)=>sum+Number(ledger.balances[key]||0),0);
}

function renderProfile() {
  const rewardLedger=civweaveCoinLedger();
  const rewardBalance=rewardAccountBalance(rewardLedger);
  const pendingMint=(rewardLedger?.escrows||[]).filter(item=>['proposed','pending-validation','locked'].includes(item.status)).reduce((sum,item)=>sum+Number(item.amount||0),0);
  const mine = state.threads.filter((thread) => thread.ownerId === 'me');
  const myProposals = state.proposals.filter((proposal) => proposal.fromId === 'me');
  const myAgreements = (state.agreements || []).filter((agreement) => agreement.participants.some((participant) => participant.personId === 'me'));
  main.innerHTML = `
    <div class="page">
      <div class="page-header"><div><p class="eyebrow">Portable economic identity</p><h1>You</h1><p>Your context-specific reputation, open arrangements, local data, and exportable market history.</p></div><button class="button button-ghost" data-edit-profile>Edit profile</button></div>
      <div class="profile-grid">
        <aside class="profile-card profile-hero">
          <div class="avatar-large">${esc(state.profile.initials)}</div>
          <h2>${esc(state.profile.name)}</h2>
          <p>${esc(state.profile.bio)}</p>
          <span class="meta-pill">⌖ ${esc(state.profile.area)}</span>
          <div class="stat-strip" style="grid-template-columns:repeat(2,1fr)">
            <div class="stat-card"><strong>${state.profile.completed}</strong><span>completed cycles</span></div>
            <div class="stat-card"><strong>${state.profile.credits}</strong><span>credits</span></div>
          </div>
          <div class="action-grid">
            <button class="button button-primary compact" data-export-pack>Export my pack</button>
            <button class="button button-ghost compact" data-import-pack>Import pack</button>
          </div>
        </aside>
        <div>
          <section class="panel">
            <p class="eyebrow">Contextual trust</p><h2>Not one radioactive score</h2>
            <p>Trust stays attached to the kind of exchange that produced it.</p>
            <div class="trust-bars">
              ${Object.entries(state.profile.trust).map(([label,value]) => `<div class="trust-row"><span>${esc(label)}</span><div class="progress-track"><span style="width:${value}%"></span></div><strong>${value}</strong></div>`).join('')}
            </div>
          </section>
          <section class="panel reward-wallet-panel" style="margin-top:1rem">
            <p class="eyebrow">Canonical reward wallet · RC15.1</p><h2>${rewardBalance} Fellowfare coins</h2>
            <p>${pendingMint} coins are proposed for conditional proof-of-human-labor issuance. Living School and Cerbanimo may propose rewards, but only this Fellowfare ledger records coin mint receipts and balances.</p>
            <div class="stat-strip" style="grid-template-columns:repeat(3,1fr)">
              <div class="stat-card"><strong>${(rewardLedger?.receipts||[]).filter(item=>item.kind==='validator-bounty').reduce((sum,item)=>sum+Number(item.amount||0),0)}</strong><span>validator coins</span></div>
              <div class="stat-card"><strong>${(rewardLedger?.receipts||[]).filter(item=>item.kind==='level-up').reduce((sum,item)=>sum+Number(item.amount||0),0)}</strong><span>level-up coins</span></div>
              <div class="stat-card"><strong>${(rewardLedger?.receipts||[]).filter(item=>item.kind==='labor-mint'||item.kind==='escrow-release').reduce((sum,item)=>sum+Number(item.amount||0),0)}</strong><span>labor-mint coins</span></div>
            </div>
            <div class="settings-list">${(rewardLedger?.receipts||[]).slice(0,8).map(item=>`<div class="setting-row"><span><strong>+${Number(item.amount||0)} · ${esc(String(item.kind||'reward').replaceAll('-',' '))}</strong><br><small>${esc(item.reason||'Civweave reward receipt')}</small></span><code>${esc(String(item.sourceReceiptId||'').slice(0,12))}</code></div>`).join('')||'<div class="empty-state"><strong>No reward receipts yet.</strong><p>Validated lessons, work, and peer-review labor will arrive here.</p></div>'}</div>
          </section>
          <section class="panel" style="margin-top:1rem">
            <p class="eyebrow">Your market</p><h2>${mine.length} threads · ${myProposals.length} proposals · ${myAgreements.length} agreements</h2>
            <div class="settings-list">
              <div class="setting-row"><span><strong>Nearby-first feed</strong><br><small>Prefer threads from your area.</small></span><input class="toggle" type="checkbox" data-setting="nearby" ${state.profile.settings.nearby ? 'checked' : ''}></div>
              <div class="setting-row"><span><strong>Arrangement notifications</strong><br><small>Notify when a proposal or message arrives.</small></span><input class="toggle" type="checkbox" data-setting="notifications" ${state.profile.settings.notifications ? 'checked' : ''}></div>
              <div class="setting-row"><span><strong>Private by default</strong><br><small>New threads begin as share-only.</small></span><input class="toggle" type="checkbox" data-setting="privateByDefault" ${state.profile.settings.privateByDefault ? 'checked' : ''}></div>
              <div class="setting-row"><span><strong>Theme</strong><br><small>System, light, or forest-night.</small></span><select id="themeSetting" class="sort-select"><option value="system" ${state.profile.settings.theme === 'system' ? 'selected' : ''}>System</option><option value="light" ${state.profile.settings.theme === 'light' ? 'selected' : ''}>Light</option><option value="dark" ${state.profile.settings.theme === 'dark' ? 'selected' : ''}>Forest night</option></select></div>
            </div>
          </section>
          <section class="panel ai-profile-panel" style="margin-top:1rem">
            <div class="section-heading" style="margin-top:0"><div><p class="eyebrow">Fellowfare Loom</p><h2>${esc(aiProviderLabel())}</h2><p>${state.profile.settings.ai.enabled ? 'AI assistance is enabled. Every result remains a reviewable suggestion.' : 'Loom assistance is currently disabled.'}</p></div><span class="ai-provider-dot ${state.profile.settings.ai.provider === 'deterministic' ? 'local' : 'connected'}"></span></div>
            <div class="action-grid">
              <button class="button button-primary" data-route="loom">Open Loom</button>
              <button class="button button-ghost" data-ai-settings>Configure mind</button>
            </div>
          </section>
          <section class="panel" style="margin-top:1rem">
            <div class="section-heading" style="margin-top:0"><div><h2>Local data controls</h2><p>Fellowfare keeps the complete exchange ledger on this device and requires no account.</p></div></div>
            <div class="action-grid">
              <button class="button button-ghost" data-export-pack>Download backup</button>
              <button class="button button-ghost" data-export-civweave>Civweave bridge bundle</button>
              <button class="button button-ghost" data-share-profile>Share profile card</button>
              <button class="button button-danger" data-reset-demo>Reset demo data</button>
              <button class="button button-ghost" data-install-help>Installation help</button>
            </div>
          </section>
        </div>
      </div>
    </div>`;
}

function getAISettings() {
  const model = civweaveContext?.model;
  if (CIVWEAVE_EMBEDDED && model) {
    const route = String(model.route || 'deterministic');
    return {
      enabled: route !== 'deterministic',
      provider: route === 'deterministic' ? 'deterministic' : 'civweave-shared',
      route,
      model: String(model.model || ''),
      endpoint: String(model.endpoint || ''),
      apiKey: String(civweaveContext?.modelSettings?.apiKey || civweaveContext?.modelSettings?.bearerToken || ''),
      externalConsent: Boolean(civweaveContext?.privacy?.secretsShared || route === 'hosted'),
      timeoutMs: 120000,
      sendArea: false
    };
  }
  const stored = normalizeAISettings(state.profile.settings.ai || {});
  const sessionSecret = sessionStorage.getItem(AI_SECRET_KEY) || '';
  return { ...stored, apiKey: sessionSecret || stored.apiKey || '' };
}

function aiProviderLabel(provider = getAISettings().provider) {
  return ({ deterministic:'On-device deterministic Loom', 'civweave-shared':'Civweave shared mind', 'openai-compatible':'OpenAI-compatible / local model', gemini:'Gemini API' })[provider] || 'Fellowfare Loom';
}

function friendlyAIError(error) {
  if (!error) return '';
  if (error.message === 'DETERMINISTIC_MODE') return 'Deterministic mode is active.';
  if (error.name === 'AbortError' || /timed out|abort/i.test(error.message)) return 'The provider timed out.';
  return String(error.message || error).slice(0,180);
}

function setBusy(button, busy, label = 'Working…') {
  if (!button) return;
  if (busy) {
    button.dataset.originalLabel = button.textContent;
    button.textContent = label;
    button.disabled = true;
    button.setAttribute('aria-busy','true');
  } else {
    button.textContent = button.dataset.originalLabel || button.textContent;
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
}

function recordAIRun(type, source, input, output, threadId = '') {
  state.aiRuns = Array.isArray(state.aiRuns) ? state.aiRuns : [];
  state.aiRuns.unshift({ id:id('airun'), type, source, input:String(input || '').slice(0,500), output, threadId, createdAt:new Date().toISOString() });
  state.aiRuns = state.aiRuns.slice(0,30);
  saveState();
}

function ensureLoomState() {
  state.loom = state.loom || { action:'matches', threadId:'', input:'', result:null, source:'deterministic', updatedAt:'' };
  if (!state.loom.threadId) state.loom.threadId = state.threads.find((thread) => thread.ownerId === 'me' && thread.mode === 'need')?.id || state.threads.find((thread) => thread.mode === 'need')?.id || state.threads[0]?.id || '';
  return state.loom;
}

function renderLoom() {
  const loom = ensureLoomState();
  const selected = getThread(loom.threadId);
  const settings = getAISettings();
  const supportedRuns = new Set(['matches','assembly','review','proposal','provider','signals']);
  const recent = (state.aiRuns || []).filter((run) => supportedRuns.has(run.type)).slice(0,5);
  main.innerHTML = `
    <div class="page loom-page">
      <section class="loom-hero">
        <div>
          <p class="eyebrow">Fellowfare Loom</p>
          <h1>Turn a market thread into a way forward.</h1>
          <p>Find complementary offers, assemble several contributors, draft fair terms, review risks, uncover what you can offer, and notice unmet local demand.</p>
          <div class="ai-trust-line"><span class="ai-provider-dot ${settings.provider === 'deterministic' ? 'local' : 'connected'}"></span><strong>${esc(aiProviderLabel(settings.provider))}</strong><span>${settings.enabled ? 'enabled' : 'disabled'}</span><button class="text-button" data-ai-settings>Configure</button></div>
        </div>
        <div class="loom-principle"><strong>Human authorization boundary</strong><p>Loom may analyze and draft. It cannot publish, accept, pay, message, rate, reveal location, or commit anyone.</p></div>
      </section>

      <section class="loom-workbench panel">
        <div class="loom-controls">
          <label class="field"><span>Work on a thread</span><select id="loomThreadSelect">${state.threads.filter((thread) => thread.status !== 'archived').map((thread) => `<option value="${thread.id}" ${thread.id === loom.threadId ? 'selected' : ''}>${esc(modeText(thread.mode))}: ${esc(thread.title)}</option>`).join('')}</select></label>
          <label class="field"><span>Ask the Loom to</span><select id="loomActionSelect">
            <option value="matches" ${loom.action === 'matches' ? 'selected' : ''}>Find complete and partial matches</option>
            <option value="assembly" ${loom.action === 'assembly' ? 'selected' : ''}>Build a multi-person assembly</option>
            <option value="review" ${loom.action === 'review' ? 'selected' : ''}>Review clarity, fairness, and risk</option>
            <option value="proposal" ${loom.action === 'proposal' ? 'selected' : ''}>Draft a proposal or counteroffer</option>
            <option value="provider" ${loom.action === 'provider' ? 'selected' : ''}>Turn my capabilities into offers</option>
            <option value="signals" ${loom.action === 'signals' ? 'selected' : ''}>Read market gaps and collective opportunities</option>
          </select></label>
        </div>
        <label class="field loom-input-field ${loom.action === 'provider' ? '' : 'is-optional'}"><span>${loom.action === 'provider' ? 'Describe what you know, own, make, or can do' : 'Extra context (optional)'}</span><textarea id="loomInput" rows="4" placeholder="${loom.action === 'provider' ? 'I am good at organizing, visual design, planning events, teaching beginners…' : 'Add constraints, missing context, or the outcome you care about most.'}">${esc(loom.input || '')}</textarea></label>
        ${selected ? `<article class="loom-selected"><span class="mode-label">${modeText(selected.mode)}</span><div><strong>${esc(selected.title)}</strong><small>${esc(selected.description)}</small></div><span class="price">${esc(priceLabel(selected))}</span></article>` : ''}
        <button class="button button-primary full loom-run" data-ai-action="${esc(loom.action)}" data-thread-id="${esc(loom.threadId)}">Run Loom analysis</button>
      </section>

      <section class="loom-output" id="loomOutput">
        ${loom.result ? renderLoomResult(loom) : `<div class="empty-state loom-empty"><img src="../../logos/fellowfare.png" alt=""><h3>The shuttle is ready</h3><p>Choose a thread and a job. Results stay local unless you configure an external model.</p></div>`}
      </section>

      ${recent.length ? `<section class="panel loom-history"><div class="section-heading" style="margin-top:0"><div><h2>Recent Loom work</h2><p>Only the latest 30 reviewable results are kept in your local market pack.</p></div></div><div class="history-list">${recent.map((run) => `<button class="history-item" data-load-ai-run="${run.id}"><span>${esc(run.type)}</span><strong>${esc(run.input || getThread(run.threadId)?.title || 'Market analysis')}</strong><small>${esc(aiProviderLabel(run.source))} · ${formatRelative(run.createdAt)}</small></button>`).join('')}</div></section>` : ''}
    </div>`;
}

function renderLoomResult(loom) {
  const result = loom.result || {};
  const source = aiProviderLabel(loom.source);
  const header = `<div class="loom-result-header"><div><p class="eyebrow">Reviewable suggestion</p><h2>${esc(result.title || loomResultTitle(loom.action))}</h2><p>${esc(result.summary || result.outcome || 'Loom prepared a structured suggestion from the market data available on this device.')}</p></div><span class="source-chip">${esc(source)}</span></div>`;
  if (loom.action === 'matches') return `<section class="panel loom-result">${header}${renderMatchResult(result)}</section>`;
  if (loom.action === 'assembly') return `<section class="panel loom-result">${header}${renderAssemblySuggestion(result, loom.threadId)}</section>`;
  if (loom.action === 'review') return `<section class="panel loom-result">${header}${renderReviewResult(result)}</section>`;
  if (loom.action === 'proposal') return `<section class="panel loom-result">${header}${renderProposalResult(result, loom.threadId)}</section>`;
  if (loom.action === 'provider') return `<section class="panel loom-result">${header}${renderProviderResult(result)}</section>`;
  if (loom.action === 'signals') return `<section class="panel loom-result">${header}${renderSignalResult(result)}</section>`;
  return `<section class="panel loom-result">${header}<pre>${esc(JSON.stringify(result,null,2))}</pre></section>`;
}

function loomResultTitle(action) {
  return ({ matches:'Possible paths', assembly:'Proposed assembly', review:'Exchange review', proposal:'Draft terms', provider:'Your provider map', signals:'Market signals' })[action] || 'Loom result';
}

function renderMatchResult(result) {
  const matches = Array.isArray(result.matches) ? result.matches : Array.isArray(result) ? result : [];
  if (!matches.length) return renderEmpty('No strong matches yet','The market may need a new offer, a wider area, or a collective thread.');
  return `<div class="match-list">${matches.map((match,index) => {
    const thread = getThread(match.threadId);
    if (!thread) return '';
    const person = getPerson(thread.ownerId);
    return `<article class="match-card"><div class="match-score">${Math.round(Number(match.score || 0))}%</div><div><span class="mode-label">Path ${index + 1}</span><h3>${esc(thread.title)}</h3><p>${esc(thread.description)}</p><div class="reason-list">${(match.reasons || []).map((reason) => `<span>${esc(reason)}</span>`).join('')}</div><div class="person"><span class="avatar">${esc(person.initials)}</span><span class="person-info"><strong>${esc(person.name)}</strong><small>${esc(priceLabel(thread))}</small></span></div></div><button class="button button-ghost compact" data-open-thread="${thread.id}">Open thread</button></article>`;
  }).join('')}</div>`;
}

function renderAssemblySuggestion(result, threadId) {
  const contributions = result.contributions || [];
  return `<div class="assembly-suggestion">
    <div class="plan-steps">${(result.steps || []).map((step) => `<div class="plan-step"><span>${step.order || '•'}</span><div><strong>${esc(step.label || '')}</strong><small>${esc(step.owner || 'Unassigned')} · after ${esc(step.dependency || 'none')}</small></div></div>`).join('')}</div>
    ${contributions.length ? `<h3>Unconfirmed pieces</h3><div class="suggestion-grid">${contributions.map((item) => `<article><strong>${esc(item.label || item.contribution)}</strong><p>${esc(item.contribution || '')}</p><small>${esc(item.contributor || 'Possible contributor')} · not committed</small></article>`).join('')}</div>` : ''}
    ${(result.gaps || []).length ? `<div class="gap-box"><strong>Still unresolved</strong><ul>${result.gaps.map((gap) => `<li>${esc(gap)}</li>`).join('')}</ul></div>` : ''}
    <button class="button button-primary" data-apply-assembly="${esc(threadId)}">Save as an unconfirmed assembly plan</button>
  </div>`;
}

function renderReviewResult(result) {
  return `<div class="review-grid">
    <div><h3>Strengths</h3>${(result.strengths || []).length ? `<ul class="check-list good">${result.strengths.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>` : '<p>No special strengths were identified yet.</p>'}</div>
    <div><h3>Clarify before commitment</h3>${(result.issues || []).length ? `<div class="issue-list">${result.issues.map((issue) => `<article data-severity="${esc(issue.severity || 'low')}"><strong>${esc(issue.title || 'Clarify this')}</strong><p>${esc(issue.detail || '')}</p></article>`).join('')}</div>` : '<p>No obvious missing terms were found.</p>'}</div>
  </div>${(result.nextQuestions || []).length ? `<div class="gap-box"><strong>Questions worth asking</strong><ul>${result.nextQuestions.map((item) => `<li>${esc(item)}</li>`).join('')}</ul></div>` : ''}`;
}

function renderProposalResult(result, threadId) {
  return `<div class="proposal-preview"><label><span>Contribution / interest</span><p>${esc(result.message || '')}</p></label><label><span>Compensation</span><p>${esc(result.compensation || 'Open terms')}</p></label><label><span>Timing</span><p>${esc(result.when || 'Flexible')}</p></label><label><span>Conditions</span><p>${esc(result.conditions || 'None stated')}</p></label>${(result.checklist || []).length ? `<ul class="check-list">${result.checklist.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>` : ''}<button class="button button-primary" data-use-proposal="${esc(threadId)}">Copy into proposal form</button></div>`;
}

function renderProviderResult(result) {
  const offers = result.suggestedOffers || [];
  return `<div class="provider-result"><div class="provider-headline"><strong>${esc(result.headline || 'Possible provider identity')}</strong><p>${esc(result.summary || '')}</p></div><div class="suggestion-grid">${offers.map((offer,index) => `<article><span class="mode-label">Offer ${index + 1}</span><h3>${esc(offer.title || '')}</h3><p>${esc(offer.description || '')}</p><small>${esc(offer.category || 'Services')} · ${(offer.methods || []).map(esc).join(', ')}</small><button class="button button-ghost compact" data-create-offer-from-loom="${index}">Open editable offer</button></article>`).join('')}</div><div class="review-grid"><div><h3>Healthy boundaries</h3><ul>${(result.boundaries || []).map((item) => `<li>${esc(item)}</li>`).join('')}</ul></div><div><h3>Intake questions</h3><ul>${(result.intakeQuestions || []).map((item) => `<li>${esc(item)}</li>`).join('')}</ul></div></div></div>`;
}

function renderSignalResult(result) {
  return `<div class="signal-board">${(result.signals || []).map((signal) => `<article><div class="signal-counts"><span>${signal.needs || 0} needs</span><span>${signal.offers || 0} offers</span><span>${signal.collective || 0} collective</span></div><h3>${esc(signal.category || 'Market')}</h3><p>${esc(signal.opportunity || '')}</p><small>${(signal.examples || []).slice(0,2).map(esc).join(' · ')}</small></article>`).join('')}</div>${(result.repeated || []).length ? `<div class="gap-box"><strong>Repeated demand language</strong><div class="thread-meta">${result.repeated.map((item) => `<span class="meta-pill">${esc(item.term)} × ${item.count}</span>`).join('')}</div></div>` : ''}`;
}

async function runLoomAction(action, threadId = '') {
  const loom = ensureLoomState();
  loom.action = action || document.querySelector('#loomActionSelect')?.value || loom.action;
  loom.threadId = threadId || document.querySelector('#loomThreadSelect')?.value || loom.threadId;
  loom.input = document.querySelector('#loomInput')?.value.trim() || loom.input || '';
  const thread = getThread(loom.threadId);
  if (!thread && !['provider','signals'].includes(loom.action)) return toast('Choose a thread first.', 'error');
  if (loom.action === 'provider' && !loom.input) return toast('Describe what you can offer first.', 'error');
  const button = document.querySelector('.loom-run');
  setBusy(button,true,'Loom is weaving…');
  const fallback = deterministicLoomAction(loom.action, thread, loom.input);
  let result = fallback;
  let source = 'deterministic';
  const settings = getAISettings();
  if (settings.enabled && settings.provider !== 'deterministic') {
    try {
      const context = buildModelContext(loom.action, thread, loom.input, fallback, settings);
      const modelResult = await invokeModel(settings,{ task:`fellowfare_${loom.action}`, context, schemaHint:loomSchemaHint(loom.action) });
      result = normalizeLoomResult(loom.action, modelResult, fallback);
      source = settings.provider;
    } catch (error) {
      toast(`The configured model did not complete this turn. Deterministic Loom supplied the result instead. ${friendlyAIError(error)}`, 'error');
    }
  }
  loom.result = result;
  loom.source = source;
  loom.updatedAt = new Date().toISOString();
  recordAIRun(loom.action,source,loom.input || thread?.title || 'market',result,loom.threadId);
  saveState();
  renderLoom();
  toast(source === 'deterministic' ? 'On-device Loom analysis complete.' : `${aiProviderLabel(source)} analysis complete. Review before applying.`);
}

function deterministicLoomAction(action, thread, input) {
  if (action === 'matches') return { title:'Possible fulfillment paths', summary:'Ranked by complementary intent, category, exchange terms, and visible location clues.', matches:deterministicMatches(thread,state.threads,state.people) };
  if (action === 'assembly') {
    const matches = deterministicMatches(thread,state.threads,state.people);
    return deterministicAssembly(thread,matches,state.threads,state.people);
  }
  if (action === 'review') return deterministicReview(thread);
  if (action === 'proposal') return deterministicProposal(thread,state.profile);
  if (action === 'provider') return deterministicProviderProfile(input,state.profile);
  if (action === 'signals') return deterministicMarketSignals(state.threads);
  return {};
}

function buildModelContext(action, thread, input, fallback, settings) {
  const publicThreads = state.threads.filter((item) => item.status !== 'archived').map((item) => ({
    id:item.id, mode:item.mode, title:item.title, description:item.description, category:item.category, amount:item.amount, methods:item.methods,
    area:settings.sendArea ? item.area : undefined, when:item.when, quantity:item.quantity, partial:item.partial, status:item.status
  }));
  return {
    selectedThread:thread ? { ...thread, area:settings.sendArea ? thread.area : undefined, ownerId:undefined } : undefined,
    userInput:input || undefined,
    market:action === 'signals' || action === 'matches' || action === 'assembly' ? publicThreads : undefined,
    deterministicBaseline:fallback,
    allowedCategories:categories,
    allowedMethods:exchangeMethods,
    rules:['Do not invent participants or commitments','Mark every contributor as unconfirmed','Do not declare a correct price','Do not expose private data','Explain reasons concisely']
  };
}

function loomSchemaHint(action) {
  const hints = {
    matches:'Return {title,summary,matches:[{threadId,score,reasons:[string]}]}. Use only thread IDs in context.',
    assembly:'Return {title,outcome,steps:[{order,label,owner,dependency}],contributions:[{threadId,personId,label,contributor,contribution,value,status:"suggested"}],gaps:[string],confidence}. Do not mark anyone committed.',
    review:'Return {summary,strengths:[string],issues:[{severity:"low|medium|high",title,detail}],nextQuestions:[string]}.',
    proposal:'Return {message,compensation,when,conditions,checklist:[string]}. Do not accept or send anything.',
    provider:'Return {headline,summary,suggestedOffers:[{title,description,category,methods,amount}],boundaries:[string],intakeQuestions:[string]}.',
    signals:'Return {summary,signals:[{category,needs,offers,collective,gap,opportunity,examples:[string]}],repeated:[{term,count}]}. Do not infer sensitive traits.'
  };
  return hints[action] || 'Return one JSON object.';
}

function normalizeLoomResult(action, result, fallback) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return fallback;
  if (action === 'matches') {
    const allowed = new Set(state.threads.map((thread) => thread.id));
    const matches = (Array.isArray(result.matches) ? result.matches : []).filter((match) => allowed.has(match.threadId)).map((match) => ({ ...match, score:Math.max(0,Math.min(99,Number(match.score || 0))), reasons:Array.isArray(match.reasons) ? match.reasons.map(String) : [] }));
    return { ...fallback, ...result, matches:matches.length ? matches : fallback.matches };
  }
  if (action === 'assembly') return { ...fallback, ...result, steps:Array.isArray(result.steps) ? result.steps : fallback.steps, contributions:Array.isArray(result.contributions) ? result.contributions.map((item) => ({...item,status:'suggested'})) : fallback.contributions, gaps:Array.isArray(result.gaps) ? result.gaps.map(String) : fallback.gaps };
  if (action === 'review') return { ...fallback, ...result, strengths:Array.isArray(result.strengths) ? result.strengths.map(String) : fallback.strengths, issues:Array.isArray(result.issues) ? result.issues : fallback.issues, nextQuestions:Array.isArray(result.nextQuestions) ? result.nextQuestions.map(String) : fallback.nextQuestions };
  if (action === 'proposal') return { ...fallback, ...result, checklist:Array.isArray(result.checklist) ? result.checklist.map(String) : fallback.checklist };
  if (action === 'provider') return { ...fallback, ...result, suggestedOffers:Array.isArray(result.suggestedOffers) ? result.suggestedOffers : fallback.suggestedOffers, boundaries:Array.isArray(result.boundaries) ? result.boundaries.map(String) : fallback.boundaries, intakeQuestions:Array.isArray(result.intakeQuestions) ? result.intakeQuestions.map(String) : fallback.intakeQuestions };
  if (action === 'signals') return { ...fallback, ...result, signals:Array.isArray(result.signals) ? result.signals : fallback.signals, repeated:Array.isArray(result.repeated) ? result.repeated : fallback.repeated };
  return { ...fallback, ...result };
}

function openThreadInLoom(threadId) {
  const loom = ensureLoomState();
  loom.threadId = threadId;
  loom.action = getThread(threadId)?.partial ? 'assembly' : 'matches';
  loom.result = null;
  detailDialog.close();
  saveState();
  routeTo('loom');
}

function renderThreadAIInsight(thread) {
  const run = (state.aiRuns || []).find((item) => item.threadId === thread.id && ['review','matches','assembly'].includes(item.type));
  if (!run) return `<section class="detail-section ai-mini"><div><p class="eyebrow">Fellowfare Loom</p><h3>Make this thread more workable</h3><p>Find matches, assemble several contributors, or review the terms before anyone commits.</p></div><button class="button button-ghost" data-loom-thread="${thread.id}">Open in Loom</button></section>`;
  return `<section class="detail-section ai-mini"><div><p class="eyebrow">Latest Loom note</p><h3>${esc(loomResultTitle(run.type))}</h3><p>${esc(run.output?.summary || run.output?.outcome || 'A reviewable suggestion is ready.')}</p><small>${esc(aiProviderLabel(run.source))} · ${formatRelative(run.createdAt)}</small></div><button class="button button-ghost" data-loom-thread="${thread.id}">Review analysis</button></section>`;
}

function applyAssemblySuggestion(threadId) {
  const loom = ensureLoomState();
  const thread = getThread(threadId);
  if (!thread || loom.action !== 'assembly' || !loom.result) return;
  let assembly = state.assemblies.find((item) => item.threadId === threadId);
  if (!assembly) {
    assembly = { id:id('assembly'), threadId, title:loom.result.title || thread.title, target:Number(thread.quantity?.match(/\d+/)?.[0] || thread.amount || Math.max(1,(loom.result.contributions || []).length)), unit:thread.quantity?.replace(/^\d+\s*/,'') || (thread.amount ? 'value units' : 'pieces'), status:'forming', commitments:[] };
    state.assemblies.unshift(assembly);
  }
  assembly.suggestions = (loom.result.contributions || []).map((item) => ({ ...item, id:id('suggestion'), confirmed:false }));
  assembly.planSteps = loom.result.steps || [];
  assembly.gaps = loom.result.gaps || [];
  saveState();
  routeTo('assemblies');
  toast('Unconfirmed assembly plan saved. No participant was committed.');
}

function applyProposalSuggestion(threadId) {
  const loom = ensureLoomState();
  const thread = getThread(threadId);
  if (!thread || loom.action !== 'proposal' || !loom.result) return;
  openProposal(threadId);
  document.querySelector('#proposalMessage').value = loom.result.message || '';
  document.querySelector('#proposalAmount').value = loom.result.compensation || '';
  document.querySelector('#proposalWhen').value = loom.result.when || '';
  document.querySelector('#proposalConditions').value = loom.result.conditions || '';
  toast('Draft copied. Nothing has been sent.');
}

function createOfferFromLoom(index) {
  const loom = ensureLoomState();
  const offer = loom.result?.suggestedOffers?.[index];
  if (!offer) return;
  openComposer('offer');
  const draft = { ...deterministicDraft(offer.description || offer.title,'offer'), ...offer, partial:false };
  applyDraftToComposer(draft);
  document.querySelector('#structuredFields').hidden = false;
  toast('Offer copied into an editable draft. It is not published.');
}

async function draftProposalWithLoom() {
  const threadId = document.querySelector('#proposalThreadId').value;
  const thread = getThread(threadId);
  if (!thread) return;
  const button = document.querySelector('#draftProposal');
  setBusy(button,true,'Drafting fair terms…');
  let result = deterministicProposal(thread,state.profile);
  let source = 'deterministic';
  const settings = getAISettings();
  if (settings.enabled && settings.provider !== 'deterministic') {
    try {
      result = normalizeLoomResult('proposal',await invokeModel(settings,{ task:'fellowfare_proposal', context:buildModelContext('proposal',thread,'',result,settings), schemaHint:loomSchemaHint('proposal') }),result);
      source = settings.provider;
    } catch (error) { toast(`Model unavailable; local proposal helper filled the draft. ${friendlyAIError(error)}`, 'error'); }
  }
  document.querySelector('#proposalMessage').value = result.message || '';
  document.querySelector('#proposalAmount').value = result.compensation || '';
  document.querySelector('#proposalWhen').value = result.when || '';
  document.querySelector('#proposalConditions').value = result.conditions || '';
  recordAIRun('proposal',source,thread.title,result,threadId);
  setBusy(button,false);
  toast('Proposal drafted. Review it before sending.');
}

function openAISettings() {
  const settings = getAISettings();
  document.querySelector('#aiEnabled').checked = settings.enabled;
  document.querySelector('#aiProvider').value = settings.provider;
  document.querySelector('#aiEndpoint').value = settings.endpoint || '';
  document.querySelector('#aiModel').value = settings.model || '';
  document.querySelector('#aiApiKey').value = settings.apiKey || '';
  document.querySelector('#aiRememberSecret').checked = settings.rememberSecret;
  document.querySelector('#aiTimeout').value = String(settings.timeoutMs);
  document.querySelector('#aiSendArea').checked = settings.sendArea;
  document.querySelector('#aiConnectionStatus').textContent = settings.provider === 'deterministic' ? 'Deterministic Loom is ready offline.' : 'Connection has not been tested in this session.';
  aiSettingsDialog.showModal();
}

function readAISettingsForm() {
  return normalizeAISettings({
    enabled:document.querySelector('#aiEnabled').checked,
    provider:document.querySelector('#aiProvider').value,
    endpoint:document.querySelector('#aiEndpoint').value.trim(),
    model:document.querySelector('#aiModel').value.trim(),
    apiKey:document.querySelector('#aiApiKey').value.trim(),
    rememberSecret:document.querySelector('#aiRememberSecret').checked,
    timeoutMs:Number(document.querySelector('#aiTimeout').value),
    sendArea:document.querySelector('#aiSendArea').checked
  });
}

function saveAISettings(event) {
  event.preventDefault();
  const settings = readAISettingsForm();
  const { apiKey, ...safe } = settings;
  state.profile.settings.ai = settings.rememberSecret ? { ...safe, apiKey } : safe;
  if (settings.rememberSecret) localStorage.removeItem(AI_SECRET_KEY); else sessionStorage.setItem(AI_SECRET_KEY,apiKey);
  saveState();
  aiSettingsDialog.close();
  render();
  toast(`${aiProviderLabel(settings.provider)} selected.`);
}

async function testAIConnection() {
  const settings = readAISettingsForm();
  const status = document.querySelector('#aiConnectionStatus');
  if (settings.provider === 'deterministic') {
    status.textContent = 'Deterministic Loom is ready and requires no network or model.';
    return;
  }
  if (!settings.model) return status.textContent = 'Enter the exact model name first.';
  if (settings.provider === 'gemini' && !settings.apiKey) return status.textContent = 'A Gemini API key is required.';
  status.textContent = 'Testing connection…';
  const button = document.querySelector('#testAI');
  setBusy(button,true,'Testing…');
  try {
    const result = await testModel(settings);
    status.textContent = result.message || 'Fellowfare Loom connected.';
  } catch (error) {
    status.textContent = `Connection failed: ${friendlyAIError(error)}`;
  } finally { setBusy(button,false); }
}


function renderEmpty(title, text) {
  return `<div class="empty-state"><img src="../../logos/fellowfare.png" alt=""><h3>${esc(title)}</h3><p>${esc(text)}</p></div>`;
}

function openComposer(mode = 'need') {
  activeComposerMode = ['need','offer','collective'].includes(mode) ? mode : 'need';
  resetComposer();
  setComposerMode(activeComposerMode);
  composerDialog.showModal();
  setTimeout(() => document.querySelector('#naturalInput')?.focus(), 50);
}

function resetComposer() {
  document.querySelector('#composerForm').reset();
  document.querySelector('#structuredFields').hidden = true;
  document.querySelector('#threadArea').value = state.profile.area;
  populateComposerOptions();
}

function setComposerMode(mode) {
  activeComposerMode = mode;
  document.querySelectorAll('.mode-chip').forEach((chip) => {
    const active = chip.dataset.mode === mode;
    chip.classList.toggle('is-active', active);
    chip.setAttribute('aria-checked', String(active));
  });
}

function populateComposerOptions() {
  const categorySelect = document.querySelector('#threadCategory');
  categorySelect.innerHTML = categories.map((category) => `<option>${esc(category)}</option>`).join('');
  const methods = document.querySelector('#exchangeMethods');
  methods.innerHTML = exchangeMethods.map((method, index) => `<label class="check-card"><input type="checkbox" value="${esc(method)}" ${index === 0 ? 'checked' : ''}><span>${esc(method)}</span></label>`).join('');
  document.querySelector('#threadVisibility').value = state.profile.settings.privateByDefault ? 'private' : 'public';
}

function smartDraft(text, mode) {
  return deterministicDraft(text, mode);
}

async function shapeDraft() {
  const natural = document.querySelector('#naturalInput').value.trim();
  if (!natural) return toast('Describe the exchange first.', 'error');
  const button = document.querySelector('#draftThread');
  setBusy(button, true, 'Loom is shaping…');
  let draft = smartDraft(natural, activeComposerMode);
  let source = 'deterministic';
  const settings = getAISettings();
  if (settings.enabled && settings.provider !== 'deterministic') {
    try {
      const result = await invokeModel(settings, {
        task: 'shape_exchange_thread',
        context: { mode:activeComposerMode, text:natural, allowedCategories:categories, allowedMethods:exchangeMethods, area:settings.sendArea ? state.profile.area : undefined },
        schemaHint: 'Return an object with title, description, category, amount (number or null), when, quantity, methods (array), partial (boolean), questions (array), and confidence (number). Do not invent facts.'
      });
      draft = { ...draft, ...result, methods:Array.isArray(result.methods) ? result.methods.filter((method) => exchangeMethods.includes(method)) : draft.methods };
      source = settings.provider;
    } catch (error) {
      toast(`Model unavailable, so the on-device helper finished the draft. ${friendlyAIError(error)}`, 'error');
    }
  }
  applyDraftToComposer(draft);
  recordAIRun('draft', source, natural, draft);
  setBusy(button, false);
  document.querySelector('#structuredFields').hidden = false;
  document.querySelector('#threadTitle').focus();
  toast(source === 'deterministic' ? 'Draft shaped on this device. Tune anything before publishing.' : `Draft shaped with ${aiProviderLabel(settings.provider)}. Review before publishing.`);
}

function applyDraftToComposer(draft) {
  document.querySelector('#threadTitle').value = draft.title || '';
  document.querySelector('#threadDescription').value = draft.description || '';
  if (categories.includes(draft.category)) document.querySelector('#threadCategory').value = draft.category;
  document.querySelector('#threadAmount').value = draft.amount ?? '';
  document.querySelector('#threadWhen').value = draft.when || '';
  document.querySelector('#threadQuantity').value = draft.quantity || '';
  document.querySelector('#allowPartial').checked = Boolean(draft.partial);
  document.querySelectorAll('#exchangeMethods input').forEach((input) => { input.checked = (draft.methods || []).includes(input.value); });
}

function submitThread(event) {
  event.preventDefault();
  const selectedMethods = [...document.querySelectorAll('#exchangeMethods input:checked')].map((input) => input.value);
  const amountRaw = document.querySelector('#threadAmount').value.trim().replace(/^\$/,'').replace(/,/g,'');
  const amount = amountRaw && !Number.isNaN(Number(amountRaw)) ? Number(amountRaw) : null;
  const thread = {
    id: id('thread'), ownerId: 'me', mode: activeComposerMode,
    title: document.querySelector('#threadTitle').value.trim(),
    description: document.querySelector('#threadDescription').value.trim(),
    category: document.querySelector('#threadCategory').value,
    amount, amountLabel: amount != null ? `$${amount.toLocaleString('en-US')}` : (selectedMethods[0] || 'Open terms'),
    methods: selectedMethods.length ? selectedMethods : ['Open terms'],
    area: document.querySelector('#threadArea').value.trim(),
    when: document.querySelector('#threadWhen').value.trim(),
    quantity: document.querySelector('#threadQuantity').value.trim(),
    partial: document.querySelector('#allowPartial').checked,
    visibility: document.querySelector('#threadVisibility').value,
    status: activeComposerMode === 'collective' ? 'assembling' : 'open',
    createdAt: new Date().toISOString(), saved: false, views: 0
  };
  if (!thread.title || !thread.description) return toast('A title and description are required.', 'error');
  state.threads.unshift(thread);
  state.activity.unshift({ id: id('event'), type: 'thread', text: `Published “${thread.title}”`, createdAt: new Date().toISOString() });
  if (thread.mode === 'collective') {
    state.assemblies.unshift({ id: id('assembly'), threadId: thread.id, title: thread.title, target: Number(thread.quantity.match(/\d+/)?.[0] || 10), unit: thread.quantity.replace(/^\d+\s*/, '') || 'commitments', status: 'forming', commitments: [] });
  }
  saveState();
  composerDialog.close();
  routeTo('market');
  toast('Thread published. The market has something new to work with.');
}

function openThread(threadId) {
  const thread = getThread(threadId);
  if (!thread) return;
  thread.views = Number(thread.views || 0) + 1;
  saveState();
  const person = getPerson(thread.ownerId);
  const proposals = state.proposals.filter((proposal) => proposal.threadId === thread.id);
  const assembly = state.assemblies.find((item) => item.threadId === thread.id);
  const agreement = getAgreementForThread(thread.id);
  const isMine = thread.ownerId === 'me';
  document.querySelector('#detailContent').innerHTML = `
    <header class="dialog-header"><div><p class="eyebrow">${modeText(thread.mode)} · ${esc(thread.category)}</p></div><button class="icon-button" data-close-detail aria-label="Close">×</button></header>
    <section class="detail-hero">
      <span class="mode-label">${modeText(thread.mode)}</span>
      <h2>${esc(thread.title)}</h2>
      <p>${esc(thread.description)}</p>
      <div class="thread-meta"><span class="meta-pill">⌖ ${esc(thread.area || 'Location flexible')}</span><span class="meta-pill">◷ ${esc(thread.when || 'Timing flexible')}</span><span class="meta-pill">${esc(priceLabel(thread))}</span>${thread.partial ? '<span class="meta-pill">＋ partial fulfillment welcome</span>' : ''}</div>
      <div class="detail-actions">
        ${agreement ? `<button class="button button-primary" data-open-agreement="${agreement.id}">Open agreement ledger</button>` : isMine ? `<button class="button button-primary" data-copy-thread="${thread.id}">Share thread</button><button class="button button-ghost" data-complete-thread="${thread.id}">${thread.status === 'complete' ? 'Reopen' : 'Mark complete'}</button>` : `<button class="button button-primary" data-propose="${thread.id}">Make a proposal</button><button class="button button-secondary" data-message-thread="${thread.id}">Message ${esc(person.name.split(' ')[0])}</button>`}
        ${thread.partial ? `<button class="button button-ghost" data-assemble-thread="${thread.id}">${assembly ? 'View assembly' : 'Start assembly'}</button>` : ''}
        <button class="button button-ghost" data-loom-thread="${thread.id}">Ask Loom</button>
        <button class="button button-ghost" data-save-thread="${thread.id}">${thread.saved ? 'Saved ◆' : 'Save ◇'}</button>
      </div>
    </section>
    <section class="detail-section">
      <h3>Arrangement shape</h3>
      <div class="thread-meta">${(thread.methods || []).map((method) => `<span class="meta-pill">${esc(method)}</span>`).join('')}${thread.quantity ? `<span class="meta-pill">Quantity: ${esc(thread.quantity)}</span>` : ''}<span class="meta-pill">Visibility: ${esc(thread.visibility)}</span></div>
    </section>
    <section class="detail-section">
      <h3>Posted by</h3>
      <div class="person"><span class="avatar">${esc(person.initials)}</span><span class="person-info"><strong>${esc(person.name)}</strong><small>${esc(person.area)} · ${person.trust || 90}% contextual trust</small></span></div>
    </section>
    ${proposals.length ? `<section class="detail-section"><h3>${proposals.length} proposal${proposals.length === 1 ? '' : 's'}</h3>${proposals.map((proposal) => {
      const proposer = getPerson(proposal.fromId);
      return `<article class="proposal-card"><strong>${esc(proposer.name)} · ${esc(proposal.status)}</strong><p>${esc(proposal.message)}</p><small>${esc(proposal.compensation || 'Open compensation')} · ${esc(proposal.when || 'Flexible timing')}</small>${isMine && proposal.status === 'pending' ? `<div class="hero-actions"><button class="button button-primary compact" data-proposal-status="${proposal.id}:accepted">Accept</button><button class="button button-ghost compact" data-proposal-status="${proposal.id}:declined">Decline</button></div>` : ''}</article>`;
    }).join('')}</section>` : ''}
    ${assembly ? `<section class="detail-section"><h3>Assembly</h3>${renderAssemblyCard(assembly)}</section>` : ''}
    ${agreement ? `<section class="detail-section agreement-inline"><p class="eyebrow">Exchange ledger</p><h3>${agreementStatusLabel(agreement.status)}</h3><p>${agreementProgressForUI(agreement)}% fulfilled · ${esc(agreement.settlement.status)} · ${(agreement.evidence || []).length} evidence item${(agreement.evidence || []).length === 1 ? '' : 's'}</p><button class="button button-primary compact" data-open-agreement="${agreement.id}">Open agreement</button></section>` : ''}
    ${CIVWEAVE_EMBEDDED ? `<section class="detail-section civweave-handoff-panel"><h3>Carry this through Civweave</h3><div class="action-grid"><button class="button button-ghost compact" data-handoff-learning="${thread.id}">Turn a capability gap into learning</button>${thread.mode === 'collective' ? `<button class="button button-ghost compact" data-handoff-governance="${thread.id}">Turn collective demand into a proposal</button>` : ''}</div><p class="muted-copy">These create reviewable handoffs. They do not publish, enroll, ratify, or accept anything.</p></section>` : ''}
    ${renderThreadAIInsight(thread)}
    <section class="detail-section"><small>Posted ${formatRelative(thread.createdAt)} · ${thread.views} views · Stored on this device</small></section>`;
  if (!detailDialog.open) detailDialog.showModal();
}

function openProposal(threadId) {
  const thread = getThread(threadId);
  if (!thread) return;
  document.querySelector('#proposalForm').reset();
  document.querySelector('#proposalThreadId').value = threadId;
  document.querySelector('#proposalHeading').textContent = `Respond to “${thread.title}”`;
  proposalDialog.showModal();
}

function submitProposal(event) {
  event.preventDefault();
  const threadId = document.querySelector('#proposalThreadId').value;
  const thread = getThread(threadId);
  if (!thread) return;
  const proposal = {
    id: id('proposal'), threadId, fromId: 'me',
    message: document.querySelector('#proposalMessage').value.trim(),
    compensation: document.querySelector('#proposalAmount').value.trim(),
    when: document.querySelector('#proposalWhen').value.trim(),
    conditions: document.querySelector('#proposalConditions').value.trim(),
    status: 'pending', createdAt: new Date().toISOString()
  };
  state.proposals.unshift(proposal);
  state.messages.push({ id: id('message'), threadId, fromId: 'me', toId: thread.ownerId, text: `Proposal: ${proposal.message}`, createdAt: proposal.createdAt, read: true });
  saveState();
  proposalDialog.close();
  detailDialog.close();
  toast('Proposal sent and attached to the thread.');
}

function openMessage(threadId) {
  const thread = getThread(threadId);
  if (!thread) return;
  const person = thread.ownerId === 'me' ? conversationPerson(threadId) : getPerson(thread.ownerId);
  document.querySelector('#messageHeading').textContent = `Message ${person.name}`;
  document.querySelector('#messageThreadId').value = threadId;
  const history = state.messages.filter((message) => message.threadId === threadId).sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));
  document.querySelector('#messageHistory').innerHTML = history.map(renderMessage).join('') || '<div class="empty-state">Start the conversation.</div>';
  document.querySelector('#messageText').value = '';
  messageDialog.showModal();
}

function submitMessage(event) {
  event.preventDefault();
  const threadId = document.querySelector('#messageThreadId').value;
  const thread = getThread(threadId);
  if (!thread) return;
  const other = thread.ownerId === 'me' ? conversationPerson(threadId).id : thread.ownerId;
  state.messages.push({ id: id('message'), threadId, fromId: 'me', toId: other, text: document.querySelector('#messageText').value.trim(), createdAt: new Date().toISOString(), read: true });
  saveState();
  messageDialog.close();
  toast('Message sent.');
  if (state.route === 'inbox') renderInbox();
}

function sendInlineMessage(form) {
  const data = new FormData(form);
  const threadId = data.get('threadId');
  const text = String(data.get('text') || '').trim();
  const thread = getThread(threadId);
  if (!text || !thread) return;
  const other = thread.ownerId === 'me' ? conversationPerson(threadId).id : thread.ownerId;
  state.messages.push({ id: id('message'), threadId, fromId: 'me', toId: other, text, createdAt: new Date().toISOString(), read: true });
  saveState();
  renderInbox();
}

function toggleSave(threadId) {
  const thread = getThread(threadId);
  if (!thread) return;
  thread.saved = !thread.saved;
  saveState();
  toast(thread.saved ? 'Thread saved.' : 'Thread removed from saved.');
  if (detailDialog.open) openThread(threadId);
  else render();
}

function createOrOpenAssembly(threadId) {
  let assembly = state.assemblies.find((item) => item.threadId === threadId);
  const thread = getThread(threadId);
  if (!thread) return;
  if (!assembly) {
    assembly = { id: id('assembly'), threadId, title: thread.title, target: Number(thread.quantity?.match(/\d+/)?.[0] || thread.amount || 10), unit: thread.quantity?.replace(/^\d+\s*/,'') || (thread.amount ? 'value units' : 'commitments'), status: 'forming', commitments: [] };
    state.assemblies.unshift(assembly);
    saveState();
    toast('Assembly started. Add the first piece from the Assemblies view.');
  }
  detailDialog.close();
  routeTo('assemblies');
}

function joinAssembly(assemblyId) {
  const assembly = state.assemblies.find((item) => item.id === assemblyId);
  if (!assembly) return;
  const existing = assembly.commitments.find((commitment) => commitment.personId === 'me');
  const contribution = prompt('What piece can you contribute?', existing?.contribution || '');
  if (contribution == null || !contribution.trim()) return;
  const valueRaw = prompt(`How much does this count toward the target of ${assembly.target} ${assembly.unit}?`, String(existing?.value || 1));
  if (valueRaw == null) return;
  const value = Number(valueRaw);
  if (!Number.isFinite(value) || value <= 0) return toast('Enter a positive numeric contribution value.', 'error');
  if (existing) { existing.contribution = contribution.trim(); existing.value = value; }
  else assembly.commitments.push({ id: id('commitment'), personId: 'me', contribution: contribution.trim(), value });
  if (assemblyProgress(assembly) >= 100) assembly.status = 'ready';
  saveState();
  renderAssemblies();
  toast(existing ? 'Commitment updated.' : 'Your piece joined the assembly.');
}

function setProposalStatus(payload) {
  const [proposalId, status] = payload.split(':');
  const proposal = state.proposals.find((item) => item.id === proposalId);
  if (!proposal) return;
  proposal.status = status;
  proposal.updatedAt = new Date().toISOString();
  if (status === 'accepted') {
    const thread = getThread(proposal.threadId);
    let agreement = (state.agreements || []).find((item) => item.proposalId === proposal.id);
    if (thread && !agreement) {
      agreement = createAgreementFromProposal(proposal, thread, state.people, { actorId:'me', id:id('agreement'), milestoneId:id('milestone'), createdAt:proposal.updatedAt });
      agreement.participants.forEach((participant) => { participant.confirmedAt = participant.personId === proposal.fromId ? proposal.createdAt : proposal.updatedAt; });
      deriveAgreementStatus(agreement);
      state.agreements.unshift(agreement);
      thread.status = 'active';
      appendLedgerEvent('agreement.created','agreement',agreement.id,{ threadId:thread.id, proposalId:proposal.id });
      appendLedgerEvent('agreement.confirmed','agreement',agreement.id,{ participantIds:agreement.participants.map((participant)=>participant.personId), basis:'proposal plus acceptance' });
    }
    state.messages.push({ id: id('message'), threadId: proposal.threadId, fromId: 'me', toId: proposal.fromId, text: 'Your proposal was accepted and a portable agreement ledger is ready.', createdAt: proposal.updatedAt, read: true });
  }
  saveState();
  if (status === 'accepted') { detailDialog.close(); routeTo('inbox'); toast('Proposal accepted. Agreement ledger created.'); }
  else { openThread(proposal.threadId); toast(`Proposal ${status}.`); }
}

function toggleComplete(threadId) {
  const thread = getThread(threadId);
  if (!thread) return;
  const agreement = getAgreementForThread(threadId);
  if (agreement && agreement.status !== 'settled') {
    detailDialog.close();
    routeTo('inbox');
    setTimeout(() => openAgreement(agreement.id), 0);
    return toast('Finish milestones and record settlement through the agreement ledger.');
  }
  thread.status = thread.status === 'complete' ? 'open' : 'complete';
  if (thread.status === 'complete') state.profile.completed += 1;
  saveState();
  openThread(threadId);
  toast(thread.status === 'complete' ? 'Exchange marked complete.' : 'Thread reopened.');
}

async function shareThread(threadId) {
  const thread = getThread(threadId);
  if (!thread) return;
  const payload = { format: 'fellowfare.thread', version: APP_VERSION, exportedAt: new Date().toISOString(), thread };
  const file = new File([JSON.stringify(payload,null,2)], `${slug(thread.title)}.fellowfare.json`, { type: 'application/json' });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ title: thread.title, text: `Fellowfare exchange thread: ${thread.title}`, files: [file] }); return; } catch (error) { if (error.name === 'AbortError') return; }
  }
  downloadBlob(file, file.name);
  toast('Thread pack downloaded for sharing.');
}

function exportableProfile() {
  const ai = { ...(state.profile.settings.ai || {}) };
  delete ai.apiKey;
  return { ...state.profile, settings:{ ...state.profile.settings, ai } };
}

function loadAIRun(runId) {
  const run = (state.aiRuns || []).find((item) => item.id === runId);
  if (!run) return;
  const loom = ensureLoomState();
  loom.action = run.type;
  loom.threadId = run.threadId || loom.threadId;
  loom.input = run.input || '';
  loom.result = run.output;
  loom.source = run.source;
  loom.updatedAt = run.createdAt;
  saveState();
  routeTo('loom');
}

function exportPack() {
  const payload = {
    format: 'fellowfare.pack', version: APP_VERSION, exportedAt: new Date().toISOString(),
    profile: exportableProfile(),
    threads: state.threads.filter((thread) => thread.ownerId === 'me' || thread.saved),
    proposals: state.proposals.filter((proposal) => proposal.fromId === 'me' || getThread(proposal.threadId)?.ownerId === 'me'),
    assemblies: state.assemblies.filter((assembly) => assembly.commitments.some((commitment) => commitment.personId === 'me')),
    agreements: (state.agreements || []).filter((agreement) => agreement.participants.some((participant) => participant.personId === 'me')).map(normalizeAgreement),
    ledgerEvents: (state.ledgerEvents || []).filter((event) => (state.agreements || []).some((agreement) => agreement.id === event.entityId && agreement.participants.some((participant) => participant.personId === 'me'))),
    messages: state.messages.filter((message) => message.fromId === 'me' || message.toId === 'me')
  };
  const blob = new Blob([JSON.stringify(payload,null,2)], { type: 'application/json' });
  downloadBlob(blob, `fellowfare-pack-${new Date().toISOString().slice(0,10)}.fellowfare.json`);
  toast('Portable Fellowfare pack downloaded.');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60) || 'fellowfare-thread';
}

function mergeExchangeBundle(incoming) {
  if (!incoming || typeof incoming !== 'object') throw new Error('Invalid exchange bundle');
  const allowed = ['fellowfare.pack','fellowfare.thread','fellowfare.agreement','civweave.exchange-bundle'];
  if (!allowed.includes(incoming.format)) throw new Error('Not a supported Fellowfare or Civweave pack');
  const source = incoming.format === 'civweave.exchange-bundle' ? incoming.entities || {} : incoming;
  const threads = incoming.format === 'fellowfare.thread' ? [incoming.thread] : incoming.format === 'fellowfare.agreement' ? [incoming.thread].filter(Boolean) : source.threads || [];
  const agreements = incoming.format === 'fellowfare.agreement' ? [incoming.agreement] : source.agreements || incoming.agreements || [];
  let addedThreads = 0;
  let addedAgreements = 0;
  for (const raw of threads) {
    if (!raw?.id || !raw?.title || !raw?.description) continue;
    if (state.threads.some((thread) => thread.id === raw.id)) continue;
    state.threads.unshift({ ...raw, ownerId: raw.ownerId === 'me' ? `imported_${raw.ownerId}` : raw.ownerId, imported: true, createdAt: raw.createdAt || new Date().toISOString() });
    addedThreads++;
  }
  for (const proposal of source.proposals || incoming.proposals || []) if (proposal?.threadId && !state.proposals.some((item) => item.id === proposal.id)) state.proposals.push(proposal);
  for (const assembly of source.assemblies || incoming.assemblies || []) if (assembly?.threadId && !state.assemblies.some((item) => item.id === assembly.id)) state.assemblies.push(assembly);
  for (const raw of agreements) {
    if (!raw?.id || !raw?.threadId || state.agreements.some((agreement) => agreement.id === raw.id)) continue;
    state.agreements.unshift(normalizeAgreement(raw));
    addedAgreements++;
  }
  for (const eventRecord of incoming.events || incoming.ledgerEvents || []) if (eventRecord?.id && !state.ledgerEvents.some((item) => item.id === eventRecord.id)) state.ledgerEvents.push(eventRecord);
  for (const message of incoming.messages || []) if (message?.id && !state.messages.some((item) => item.id === message.id)) state.messages.push(message);
  saveState();
  return { addedThreads, addedAgreements };
}

async function importPack(event) {
  event.preventDefault();
  const file = document.querySelector('#importFile').files[0];
  if (!file) return;
  try {
    const result = mergeExchangeBundle(JSON.parse(await file.text()));
    importDialog.close();
    routeTo(result.addedAgreements ? 'inbox' : 'market');
    toast(`${result.addedThreads} thread${result.addedThreads === 1 ? '' : 's'} and ${result.addedAgreements} agreement${result.addedAgreements === 1 ? '' : 's'} imported.`);
  } catch (error) {
    console.error(error);
    toast('That file could not be imported as a Fellowfare or Civweave exchange pack.', 'error');
  }
}

function editProfile() {
  const name = prompt('Display name', state.profile.name);
  if (name == null || !name.trim()) return;
  const area = prompt('Area', state.profile.area);
  if (area == null) return;
  const bio = prompt('Short profile', state.profile.bio);
  if (bio == null) return;
  state.profile.name = name.trim();
  state.profile.area = area.trim();
  state.profile.bio = bio.trim();
  state.profile.initials = name.trim().split(/\s+/).map((part) => part[0]).join('').slice(0,2).toUpperCase();
  saveState(); renderProfile(); toast('Profile updated.');
}

async function shareProfile() {
  const text = `${state.profile.name} on Fellowfare\n${state.profile.bio}\n${state.profile.area}\n${state.profile.completed} completed exchanges`;
  if (navigator.share) {
    try { await navigator.share({ title: `${state.profile.name} · Fellowfare`, text }); return; } catch (error) { if (error.name === 'AbortError') return; }
  }
  await navigator.clipboard?.writeText(text);
  toast('Profile card copied.');
}

function applyTheme() {
  const theme = state.profile.settings.theme;
  if (theme === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = theme;
}

function updateBadges() {
  const unread = state.messages.filter((message) => message.toId === 'me' && !message.read).length;
  const overdue = (state.agreements || []).flatMap((agreement) => agreement.milestones || []).filter((milestone) => isOverdue(milestone.dueAt, milestone.status)).length;
  const attention = unread + overdue;
  const badge = document.querySelector('#inboxBadge');
  badge.hidden = attention === 0;
  badge.textContent = attention;
  badge.title = `${unread} unread message${unread === 1 ? '' : 's'} · ${overdue} overdue milestone${overdue === 1 ? '' : 's'}`;
}

function toast(message, type = '') {
  const region = document.querySelector('#toastRegion');
  const item = document.createElement('div');
  item.className = `toast ${type}`;
  item.textContent = message;
  region.append(item);
  setTimeout(() => item.remove(), 3400);
}

function showInstallHelp() {
  alert('Install Fellowfare\n\nAndroid Chrome: open the browser menu and choose “Install app” or “Add to Home screen.”\n\niPhone/iPad Safari: tap Share, then “Add to Home Screen.”\n\nDesktop Chrome/Edge: use the install icon in the address bar.\n\nInstallation requires HTTPS or localhost.');
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch((error) => console.warn('Service worker registration failed', error)));
  }
}

function initialize() {
  const hash = location.hash.replace('#','');
  if (ROUTES.includes(hash)) state.route = hash; else state.route = 'mall';
  populateComposerOptions();
  render();
  registerServiceWorker();
}

// Global event delegation keeps the static PWA small and every rendered control live.
document.addEventListener('click', (event) => {
  const target = event.target.closest('button, [data-route]');
  if (!target) return;
  if(target.dataset.mallFeature){
    const action=target.dataset.mallFeatureAction;
    if(action) runMallAction(action); else toast(target.dataset.mallDescription || target.dataset.mallFeature);
    return;
  }
  if (target.dataset.mallScene) { enterMallScene(target.dataset.mallScene); return; }
  if (target.dataset.mallAction) { runMallAction(target.dataset.mallAction); return; }
  if (target.dataset.civweaveReturn !== undefined) { location.href='../../index.html?visual=1&build=1.0.20#square'; return; }
  if (target.dataset.route) routeTo(target.dataset.route);
  if (target.dataset.openComposer) openComposer(target.dataset.openComposer);
  if (target.id === 'quickCreate' || target.id === 'mobileCreate') openComposer('need');
  if (target.dataset.filterMode) { state.filters.mode = target.dataset.filterMode; saveState(); renderMarket(); }
  if (target.dataset.categorySearch) { state.filters.query = target.dataset.categorySearch; saveState(); renderMarket(); }
  if (target.dataset.openThread) openThread(target.dataset.openThread);
  if (target.dataset.openAgreement) openAgreement(target.dataset.openAgreement);
  if (target.dataset.confirmAgreement) confirmAgreement(target.dataset.confirmAgreement);
  if (target.dataset.toggleMilestone) toggleAgreementMilestone(target.dataset.toggleMilestone);
  if (target.dataset.ledgerAction) openLedgerAction(target.dataset.ledgerAction, target.dataset.agreementId, target.dataset.milestoneId || '');
  if (target.dataset.resolveRepair) resolveAgreementRepair(target.dataset.resolveRepair);
  if (target.dataset.nextCycle) startNextAgreementCycle(target.dataset.nextCycle);
  if (target.dataset.shareAgreement) shareAgreement(target.dataset.shareAgreement);
  if (target.dataset.handoffWork) {
    const agreement = getAgreement(target.dataset.handoffWork);
    if (agreement) handoffToCivweave('cerbanimo','exchange-to-work',`Coordinate · ${agreement.title}`,{ agreement:{ id:agreement.id, title:agreement.title, category:agreement.category, terms:agreement.terms, milestones:agreement.milestones, participants:agreement.participants, status:agreement.status }, authority:{ fellowfare:'agreement, settlement, repair', cerbanimo:'work planning, proof, review' }, automaticEffect:false });
  }
  if (target.dataset.handoffLearning) {
    const thread = getThread(target.dataset.handoffLearning);
    if (thread) handoffToCivweave('living','market-skill-gap',`Learn for · ${thread.title}`,{ thread:{ id:thread.id, mode:thread.mode, title:thread.title, description:thread.description, category:thread.category }, prompt:`Build the smallest practical learning path that would help someone meet this need or offer this capability honestly: ${thread.title}.`, automaticEffect:false });
  }
  if (target.dataset.handoffGovernance) {
    const thread = getThread(target.dataset.handoffGovernance);
    const assembly = state.assemblies.find((item) => item.threadId === target.dataset.handoffGovernance);
    if (thread) handoffToCivweave('anarchadia','collective-demand',`Govern · ${thread.title}`,{ thread:{ id:thread.id, title:thread.title, description:thread.description, category:thread.category, quantity:thread.quantity }, assembly:assembly || null, automaticEffect:false });
  }
  if (target.dataset.exportCivweave !== undefined) exportCivweaveBundle();
  if (target.dataset.saveThread) { event.stopPropagation(); toggleSave(target.dataset.saveThread); }
  if (target.dataset.closeDetail !== undefined) detailDialog.close();
  if (target.dataset.propose) openProposal(target.dataset.propose);
  if (target.dataset.messageThread) openMessage(target.dataset.messageThread);
  if (target.dataset.assembleThread) createOrOpenAssembly(target.dataset.assembleThread);
  if (target.dataset.loomThread) openThreadInLoom(target.dataset.loomThread);
  if (target.dataset.aiAction) runLoomAction(target.dataset.aiAction, target.dataset.threadId || '');
  if (target.dataset.applyAssembly) applyAssemblySuggestion(target.dataset.applyAssembly);
  if (target.dataset.useProposal) applyProposalSuggestion(target.dataset.useProposal);
  if (target.dataset.createOfferFromLoom) createOfferFromLoom(Number(target.dataset.createOfferFromLoom));
  if (target.dataset.aiSettings !== undefined) openAISettings();
  if (target.dataset.loadAiRun) loadAIRun(target.dataset.loadAiRun);
  if (target.dataset.joinAssembly) joinAssembly(target.dataset.joinAssembly);
  if (target.dataset.proposalStatus) setProposalStatus(target.dataset.proposalStatus);
  if (target.dataset.completeThread) toggleComplete(target.dataset.completeThread);
  if (target.dataset.copyThread) shareThread(target.dataset.copyThread);
  if (target.dataset.conversation) { activeConversationThreadId = target.dataset.conversation; renderInbox(); }
  if (target.dataset.exportPack !== undefined) exportPack();
  if (target.dataset.importPack !== undefined) importDialog.showModal();
  if (target.dataset.editProfile !== undefined) editProfile();
  if (target.dataset.shareProfile !== undefined) shareProfile();
  if (target.dataset.resetDemo !== undefined && confirm('Reset all local Fellowfare data to the original demo?')) { localStorage.removeItem(STORE_KEY); localStorage.removeItem(V2_STORE_KEY); localStorage.removeItem(LEGACY_STORE_KEY); sessionStorage.removeItem(AI_SECRET_KEY); state = structuredClone(starterState); saveState(); render(); toast('Demo data restored.'); }
  if (target.dataset.installHelp !== undefined) showInstallHelp();
});

document.addEventListener('input', (event) => {
  if (event.target.id === 'loomInput') { ensureLoomState().input = event.target.value; }
  if (event.target.id === 'marketSearch') {
    state.filters.query = event.target.value;
    const caret = event.target.selectionStart ?? event.target.value.length;
    saveState();
    clearTimeout(window.__marketSearchTimer);
    window.__marketSearchTimer = setTimeout(() => {
      renderMarket();
      const input = document.querySelector('#marketSearch');
      input?.focus();
      input?.setSelectionRange(caret, caret);
    }, 180);
  }
});


document.addEventListener('input', (event) => {
  if (event.target.id === 'mallDirectorySearch') {
    mallSearch = event.target.value;
    const caret = event.target.selectionStart;
    renderMall();
    const input = document.querySelector('#mallDirectorySearch');
    if (input) { input.focus(); input.setSelectionRange(caret, caret); }
  }
});

document.addEventListener('change', (event) => {
  if (event.target.id === 'aiProvider') {
    const endpoint = document.querySelector('#aiEndpoint');
    const model = document.querySelector('#aiModel');
    if (event.target.value === 'gemini' && /127\.0\.0\.1|localhost|11434/.test(endpoint.value)) endpoint.value = 'https://generativelanguage.googleapis.com/v1beta';
    if (event.target.value === 'openai-compatible' && /generativelanguage\.googleapis\.com/.test(endpoint.value)) endpoint.value = 'http://127.0.0.1:11434/v1';
    if (event.target.value === 'deterministic') document.querySelector('#aiConnectionStatus').textContent = 'Deterministic Loom is ready offline.';
    if (event.target.value !== 'deterministic' && !model.value) document.querySelector('#aiConnectionStatus').textContent = 'Enter the exact model name, then test the connection.';
  }
  if (event.target.id === 'loomThreadSelect') { const loom = ensureLoomState(); loom.threadId = event.target.value; loom.result = null; saveState(); renderLoom(); }
  if (event.target.id === 'loomActionSelect') { const loom = ensureLoomState(); loom.action = event.target.value; loom.result = null; saveState(); renderLoom(); }
  if (event.target.id === 'sortThreads') { state.filters.sort = event.target.value; saveState(); renderMarket(); }
  if (event.target.dataset.setting) { state.profile.settings[event.target.dataset.setting] = event.target.checked; saveState(); }
  if (event.target.id === 'themeSetting') { state.profile.settings.theme = event.target.value; saveState(); renderProfile(); }
});

document.addEventListener('submit', (event) => {
  if (event.submitter?.value === 'cancel') return;
  if (event.target.id === 'composerForm') submitThread(event);
  if (event.target.id === 'proposalForm') submitProposal(event);
  if (event.target.id === 'messageForm') submitMessage(event);
  if (event.target.id === 'importForm') importPack(event);
  if (event.target.id === 'inlineMessageForm') { event.preventDefault(); sendInlineMessage(event.target); }
  if (event.target.id === 'aiSettingsForm') saveAISettings(event);
  if (event.target.id === 'ledgerActionForm') submitLedgerAction(event);
});

document.querySelector('#draftThread').addEventListener('click', shapeDraft);
document.querySelector('#draftProposal').addEventListener('click', draftProposalWithLoom);
document.querySelector('#testAI').addEventListener('click', testAIConnection);
document.querySelectorAll('.mode-chip').forEach((chip) => chip.addEventListener('click', () => setComposerMode(chip.dataset.mode)));

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event;
  const button = document.querySelector('#installButton');
  button.hidden = false;
  button.onclick = async () => {
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    button.hidden = true;
  };
});
window.addEventListener('appinstalled', () => toast('Fellowfare installed. It can now open from your home screen.'));
window.addEventListener('hashchange', () => { const route = location.hash.replace('#',''); if (ROUTES.includes(route)) { state.route = route; render(); } });

function postCivweaveReady() {
  postToCivweave({
    type:'civweave:ready', service:'fellowfare', version:APP_VERSION,
    capabilities:['market-threads','semantic-loom','assemblies','agreements','milestones','evidence','settlement-records','repair-paths','contextual-trust','civweave-exchange-bundle']
  });
}

function openCivweaveObject(objectType, objectId, actionId='') {
  let opened = false;
  if (objectType === 'thread' && getThread(objectId)) { openThread(objectId); opened = true; }
  if ((objectType === 'agreement' || objectType === 'repair') && getAgreement(objectId)) { routeTo('inbox'); setTimeout(() => openAgreement(objectId), 0); opened = true; }
  if (objectType === 'assembly' && state.assemblies.some((item) => item.id === objectId)) { routeTo('assemblies'); opened = true; }
  postToCivweave({ type:'civweave:navigation-receipt', contractVersion:'civweave.navigation.v1', actionId, objectType, objectId, status:opened ? 'opened' : 'unavailable', detail:opened ? `Opened Fellowfare ${objectType}.` : `Fellowfare could not find that ${objectType} on this device.` });
}

async function acceptCivweaveIntention(message) {
  const requestId = String(message.requestId || '');
  const prompt = String(message.prompt || message.value || '').slice(0,4000).trim();
  if (!requestId || !prompt) return;
  postToCivweave({ type:'civweave:ai-intention-receipt', requestId, status:'accepted', detail:'Fellowfare accepted the intention and is preparing an editable market thread. No listing will be published.' });
  try {
    openComposer('need');
    document.querySelector('#naturalInput').value = prompt;
    await shapeDraft();
    postToCivweave({ type:'civweave:ai-intention-receipt', requestId, status:'delivered', detail:'Fellowfare prepared an editable exchange-thread draft. Review every field before publishing.' });
  } catch (error) {
    postToCivweave({ type:'civweave:ai-intention-receipt', requestId, status:'failed', detail:`Fellowfare preserved the prompt but could not shape the draft: ${friendlyAIError(error)}` });
  }
}

window.addEventListener('message', (event) => {
  if (!CIVWEAVE_EMBEDDED || event.origin !== window.location.origin || event.source !== window.parent || !event.data || typeof event.data !== 'object') return;
  const message = event.data;
  if (message.type === 'civweave:context') {
    civweaveContext = message;
    document.documentElement.classList.add('civweave-embedded');
    postCivweaveReady();
    if (state.route === 'loom' || state.route === 'profile') render();
    return;
  }
  if (message.type === 'civweave:ai-intention') void acceptCivweaveIntention(message);
  if (message.type === 'civweave:navigate-object' && message.contractVersion === 'civweave.navigation.v1') openCivweaveObject(String(message.objectType || message.subjectType || ''), String(message.objectId || message.subjectId || ''), String(message.actionId || ''));
  if (message.type === 'civweave:exchange-import' && message.contractVersion === 'civweave.exchange-import.v1') {
    try {
      const result = mergeExchangeBundle(message.bundle);
      localStorage.removeItem('civweave.pending.fellowfare.exchange.v1');
      render();
      postToCivweave({ type:'civweave:exchange-import-receipt', contractVersion:'civweave.exchange-import.v1', status:'reviewed', detail:`Imported ${result.addedThreads} threads and ${result.addedAgreements} agreements without overwriting local records.` });
    } catch (error) {
      postToCivweave({ type:'civweave:exchange-import-receipt', contractVersion:'civweave.exchange-import.v1', status:'failed', detail:String(error.message || error).slice(0,500) });
    }
  }
});

initialize();
if (CIVWEAVE_EMBEDDED) {
  document.documentElement.classList.add('civweave-embedded');
  try {
    const pending = JSON.parse(localStorage.getItem('civweave.pending.fellowfare.exchange.v1') || 'null');
    if (pending) {
      const result = mergeExchangeBundle(pending);
      localStorage.removeItem('civweave.pending.fellowfare.exchange.v1');
      render();
      toast(`${result.addedThreads} portable thread${result.addedThreads === 1 ? '' : 's'} restored from Civweave.`);
    }
  } catch (error) { console.warn('Pending Civweave exchange import was not applied', error); }
  window.setTimeout(postCivweaveReady, 60);
}

window.addEventListener('storage',(event)=>{if(['fellowfare.reward-ledger.v1.1','fellowfare.reward-ledger.v1'].includes(event.key)&&location.hash.replace('#','')==='profile')renderProfile();});
