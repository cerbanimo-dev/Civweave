import {
  ARTICLE_INDEX, READINESS_ITEMS, APP_VERSION, emptyState, syntheticFixture, touch, uid, nowIso,
  classifyProposal, validateProposal, validateRight, validateBridge, readinessSummary,
  makeHumanApprovalMarkdown, createExactDiff, mergeImportedState, deepClone
} from './domain.js';
import { loadWorkspace, saveWorkspace, clearWorkspace, storageEstimate, requestPersistentStorage } from './store.js';
import { runAssistant } from './ai.js';
import {
  buildBundle, downloadText, validateBundle, verifyBundleHash, bundleToImportState
} from './export.js';

const app = document.querySelector('#app');
let state = null;
let modalCleanup = null;
let installPrompt = null;
let toastTimer = null;
let lastAiDraft = null;
let exchangePreview = null;
const commonweaveIntentRequests = new Set();
let commonweaveCommunityRef = '';

const NAV = [
  ['hall', 'Home Hall'],
  ['proposal-commons', 'Proposals'],
  ['bug-triage', 'Bug Triage'],
  ['hub-commons', 'Hub Commons'],
  ['federation', 'Federation'],
  ['rails', 'Rails'],
  ['forge', 'Forge'],
  ['ledger', 'Ledger'],
  ['observatory', 'Observatory'],
  ['workbench', 'Workbench']
];

const CLASSIC_ROUTES = new Set(['overview','charter','proposals','safeguards','exchange','ai','readiness','constitution']);
const VISUAL_ROUTES = new Set(['hall','proposal-commons','bug-triage','hub-commons','federation','rails','forge','ledger','observatory']);

const esc = value => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
const nl2br = value => esc(value).replaceAll('\n', '<br>');
const VISUAL_HOST_FOR_ROUTE = {
  workbench:'hall', overview:'observatory', charter:'hub-commons', proposals:'proposal-commons',
  safeguards:'rails', exchange:'federation', ai:'forge', readiness:'observatory', constitution:'ledger'
};
const rawRoute = () => (location.hash || '#hall').slice(1).split('?')[0];
const route = () => VISUAL_ROUTES.has(rawRoute()) ? rawRoute() : (VISUAL_HOST_FOR_ROUTE[rawRoute()] || 'hall');
const visualRequested = true;
const legacyMode = () => false;
try{localStorage.setItem('anarchadia.interface-mode','visual');}catch{}
const find = (collection, id) => state[collection]?.find(item => item.id === id);

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

function announce(message, kind = 'good') {
  clearTimeout(toastTimer);
  document.querySelector('.toast')?.remove();
  const toast = document.createElement('div');
  toast.className = `toast ${kind}`;
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  document.body.append(toast);
  toastTimer = setTimeout(() => toast.remove(), 3800);
}

async function persist(action, detail = {}) {
  touch(state, action, detail);
  await saveWorkspace(state);
  render();
}

function applySessionSettings() {
  const settings = JSON.parse(sessionStorage.getItem('anarchadia-accessibility') || '{}');
  document.body.classList.toggle('large-text', Boolean(settings.largeText));
  document.body.classList.toggle('high-contrast', Boolean(settings.highContrast));
  document.body.classList.toggle('reduce-motion', Boolean(settings.reduceMotion));
  document.body.classList.toggle('show-hotspots', new URLSearchParams(location.search).get('debugHotspots') === '1');
}

function renderOnboarding() {
  app.innerHTML = `<main class="anarchadia-emergency-entry">
    <picture aria-hidden="true"><source media="(max-width:760px) and (orientation:portrait)" srcset="assets/screens/home-portrait.webp"><img src="assets/screens/home-landscape.webp" alt=""></picture>
    <button type="button" data-action="start-blank" aria-label="Enter a new local Home Hall"></button>
    <div class="anarchadia-version-plaque"><img src="../../ui-icons/settings.svg" alt=""><span>v${APP_VERSION}</span></div>
  </main>`;
}
function shell(content, title, subtitle = '') {
  return `<div class="shell visual-shell cardinal-visual-shell">
    <main id="main" class="visual-main">${content}</main>
    <input id="import-file" type="file" accept="application/json,.json" hidden>
  </div>`;
}

const VISUAL_ASSETS = {
  hall: 'home',
  'proposal-commons': 'proposal',
  'bug-triage': 'bug',
  'hub-commons': 'hub',
  federation: 'federation',
  rails: 'rails',
  forge: 'forge',
  ledger: 'ledger',
  observatory: 'observatory'
};


// RC17.2 image interaction map. Coordinates are percentages of the supplied
// portrait and landscape artwork, measured against the visible labeled panels.
// p = portrait [x,y,width,height], l = landscape [x,y,width,height].
const SCENE_HOTSPOTS = {
  hall: [
    {id:'hall-feature',label:'Feature Request door',detail:'Enter Proposal Commons',href:'#proposal-commons',p:[8.5,16.2,29,18.5],l:[20.5,15.5,15.5,28]},
    {id:'hall-bug',label:'Bug Report door',detail:'Enter Bug Triage',href:'#bug-triage',p:[65.5,16.2,29,18.5],l:[66.5,15.5,15.5,28]},
    {id:'hall-hub',label:'Hub arch',detail:'Enter Hub Commons',href:'#hub-commons',p:[31,32.4,38,24.5],l:[37.5,39,25,35]},
    {id:'hall-federation',label:'Federation door',detail:'Enter Federation Chamber',href:'#federation',p:[7.5,37.5,29,23],l:[20,43,16,33]},
    {id:'hall-rails',label:'Rails door',detail:'Enter Rails Engine Room',href:'#rails',p:[66.5,37.5,27,23],l:[60,43,13.5,33]},
    {id:'hall-forge',label:'Forge entrance',detail:'Enter The Forge',href:'#forge',p:[31,56.2,38,24],l:[73.5,44,16.5,32]},
    {id:'hall-announcements',label:'Announcements board',detail:'Open recent hall notices',info:'hall-announcements',p:[1.5,61,31,18],l:[0.5,29,17,30]},
    {id:'hall-routes',label:'Quick Routes board',detail:'Open route guide',info:'hall-routes',p:[70.5,61,28,20],l:[86,31,13.5,31]},
    {id:'hall-activity',label:'Live Activity board',detail:'Open Observatory',href:'#observatory',p:[35,78,36,14],l:[85,67,14.5,21]}
  ],
  'proposal-commons': [
    {id:'proposal-idea-board',label:'Idea Board',detail:'Inspect the current proposal board',info:'proposal-idea-board',p:[2.5,17,46,21],l:[7,22,27,29]},
    {id:'proposal-petitions',label:'Petitions desk',detail:'Inspect support and concern signals',action:'open-petition-board',p:[54,17,43.5,21],l:[68,22,25,29]},
    {id:'proposal-discussion',label:'Discussion chamber',detail:'Open proposal discussions',action:'open-discussion-board',p:[29,37,42,22],l:[36,32,28,35]},
    {id:'proposal-voting',label:'Voting station',detail:'Open proposal choices',href:'#proposals',p:[2.5,42,34,24],l:[4,48,24,27]},
    {id:'proposal-status',label:'Status board',detail:'Open amendment ledger',href:'#ledger',p:[66,42,31.5,24],l:[73,48,20,27]},
    {id:'proposal-form',label:'Feature Request form',detail:'Open proposal form',action:'add-proposal',p:[24,65,52,25],l:[35,63,27,27]}
  ],
  'bug-triage': [
    {id:'bug-queue',label:'Issue Queue',detail:'Inspect current issue queue',info:'bug-queue',p:[1.5,20,36,24],l:[12,27,20,32]},
    {id:'bug-severity',label:'Severity Matrix',detail:'Read severity guidance',info:'bug-severity',p:[35,20,33,24],l:[38,28,22,31]},
    {id:'bug-repro',label:'Repro Lab',detail:'Open the bug report form',action:'add-bug',p:[68.5,20,30,24],l:[66,27,21,33]},
    {id:'bug-pipeline',label:'Fix Pipeline',detail:'Inspect repair stages',info:'bug-pipeline',p:[1.5,45,47,23],l:[13,62,23,25]},
    {id:'bug-resolved',label:'Resolved board',detail:'Inspect completed repairs',info:'bug-resolved',p:[63.5,45,35,23],l:[65,62,21,25]},
    {id:'bug-form',label:'Bug Report form',detail:'Open the bug report form',action:'add-bug',p:[23,66,54,30],l:[38,62,23,34]}
  ],
  'hub-commons': [
    {id:'hub-assembly',label:'Assembly chamber',detail:'Open the charter workbench',href:'#charter',p:[2,17,46,27],l:[8,12,29,35]},
    {id:'hub-workgroups',label:'Workgroups chamber',detail:'Create and inspect local workgroups',action:'open-workgroups',p:[52,17,46,27],l:[65,12,29,35]},
    {id:'hub-bulletins',label:'Bulletins board',detail:'Read and post local notices',action:'open-bulletins',p:[2,43,45,25],l:[8,48,27,29]},
    {id:'hub-rules',label:'Local Rules board',detail:'Open readiness and rules gates',href:'#readiness',p:[53,43,45,25],l:[68,48,27,29]},
    {id:'hub-archives',label:'Archives',detail:'Open constitutional source archive',href:'#constitution',p:[28,68,45,25],l:[38,58,24,29]}
  ],
  federation: [
    {id:'federation-hub-map',label:'Hub Map',detail:'Open selective exchange',href:'#exchange',p:[2,32,31,29],l:[0,38,26,35]},
    {id:'federation-treaties',label:'Treaties',detail:'Draft a bridge contract',action:'add-bridge',p:[67,32,31,29],l:[80,38,20,35]},
    {id:'federation-amendments',label:'Shared Amendments',detail:'Open the amendment ledger',href:'#ledger',p:[35,38,30,27],l:[39,44,24,25]},
    {id:'federation-adoption',label:'Adoption Signals',detail:'Record scoped hub adoption signals',action:'open-adoption-signals',p:[7,61,32,21],l:[18,55,18,27]},
    {id:'federation-messages',label:'Federation Messages',detail:'Draft bounded hub messages',action:'open-federation-messages',p:[62,61,32,21],l:[70,55,17,27]},
    {id:'federation-ledger',label:'Federation Ledger',detail:'Inspect exchange provenance',info:'federation-ledger',p:[21,79,58,17],l:[31,68,38,23]}
  ],
  rails: [
    {id:'rails-contracts',label:'Contracts rail',detail:'Open bridge contracts',href:'#exchange',p:[2,23,19,31],l:[11,18,14,34]},
    {id:'rails-capabilities',label:'Capabilities rail',detail:'Open safeguards and capabilities',href:'#safeguards',p:[21,23,19,31],l:[26,20,14,32]},
    {id:'rails-versions',label:'Versions rail',detail:'Open version history',href:'#ledger',p:[40.5,23,19,31],l:[42,21,14,31]},
    {id:'rails-migrations',label:'Migrations rail',detail:'Open exchange and migration tools',href:'#exchange',p:[60,23,19,31],l:[59,20,14,32]},
    {id:'rails-conformance',label:'Conformance rail',detail:'Run conformance check',action:'run-rail-check',p:[79,23,19,31],l:[76,18,14,34]},
    {id:'rails-core',label:'Interoperability Core',detail:'Inspect current rail health',info:'rails-core',p:[28,62,44,25],l:[37,53,27,29]},
    {id:'rails-status',label:'System Status',detail:'Inspect status summary',info:'rails-status',p:[1,59,24,18],l:[0.5,58,14,25]},
    {id:'rails-sync',label:'Core Health and Sync Signal',detail:'Inspect relay state',info:'rails-sync',p:[76,59,23,22],l:[69,58,14,25]},
    {id:'rails-flow',label:'Compatibility Flow',detail:'Inspect movement guarantees',info:'rails-flow',p:[76,76,23,13],l:[69,80,14,14]},
    {id:'rails-code',label:'Engine Room Code',detail:'Open protocol constitution',href:'#constitution',p:[74,86,25,13],l:[84,58,15.5,31]}
  ],
  forge: [
    {id:'forge-sandbox',label:'Sandbox',detail:'Forge a bounded improvement',action:'forge-improvement',p:[2,17,44,24],l:[21,18,21,29]},
    {id:'forge-ai',label:'AI Build station',detail:'Ask Rook to draft',action:'open-ai',aiTask:'proposal-card',aiTarget:'workspace',p:[54,17,44,24],l:[67,18,21,29]},
    {id:'forge-simulation',label:'Simulation station',detail:'Design or record a bounded experiment',action:'open-experiments',p:[2,45,45,24],l:[17,49,27,30]},
    {id:'forge-tests',label:'Tests station',detail:'Run conformance and inspect experiments',action:'open-experiments',p:[54,45,44,24],l:[63,49,23,30]},
    {id:'forge-review',label:'Review Gate',detail:'Move into proposal review',href:'#proposal-commons',p:[27,64,46,22],l:[39,59,22,23]},
    {id:'forge-deploy',label:'Deploy exit',detail:'Read the human deployment boundary',info:'forge-deploy',p:[73,63,26,25],l:[82,50,17,31]},
    {id:'forge-tools',label:'Forge Tools',detail:'Open precision workbench',href:'#workbench',p:[1,65,24,27],l:[1,58,16,29]}
  ],
  ledger: [
    {id:'ledger-ratified',label:'Ratified Changes',detail:'Open charter versions',href:'#charter',p:[1,18,31,24],l:[4,12,24,27]},
    {id:'ledger-timeline',label:'Timeline',detail:'Open proposal outcomes',href:'#proposals',p:[30,22,41,42],l:[35,24,31,45]},
    {id:'ledger-audit',label:'Audit Trail',detail:'Inspect recent audit records',info:'ledger-audit',p:[70,18,29,24],l:[76,12,21,28]},
    {id:'ledger-bundles',label:'Bundles',detail:'Open continuity exchange',href:'#exchange',p:[2,43,31,23],l:[4,40,27,26]},
    {id:'ledger-truth',label:'Truth Vault',detail:'Open constitutional source',href:'#constitution',p:[67,38,31,35],l:[72,38,23,39]},
    {id:'ledger-rollback',label:'Rollback controls',detail:'Draft an append-only rollback proposal',action:'open-rollback-board',p:[1,66,31,25],l:[0,65,25,27]},
    {id:'ledger-record',label:'The record remembers',detail:'Read ledger principles',info:'ledger-record',p:[34,66,32,20],l:[36,70,28,20]}
  ],
  observatory: [
    {id:'observatory-health',label:'Health gauge',detail:'Open readiness health',href:'#readiness',p:[1,27,19,21],l:[18,32,11.5,22]},
    {id:'observatory-activity',label:'Activity gauge',detail:'Inspect audit activity',info:'observatory-activity',p:[20,27,19,21],l:[30,32,12,22]},
    {id:'observatory-participation',label:'Participation gauge',detail:'Open safeguards and participation conditions',href:'#safeguards',p:[40,27,19,21],l:[43,32,12,22]},
    {id:'observatory-adoption',label:'Adoption gauge',detail:'Open Federation Chamber',href:'#federation',p:[60,27,19,21],l:[57,32,12,22]},
    {id:'observatory-alerts',label:'Alerts gauge',detail:'Open actionable system alerts',action:'open-alert-center',p:[80,27,19,21],l:[70,32,12,22]},
    {id:'observatory-overview',label:'System Overview map',detail:'Open system overview projection',href:'#overview',p:[19,49,62,23],l:[25,55,39,24]},
    {id:'observatory-heatmap',label:'Activity Heatmap',detail:'Read privacy-bounded activity guidance',info:'observatory-heatmap',p:[1,70,30,18],l:[5,55,20,24]},
    {id:'observatory-trends',label:'Trends Over Time',detail:'Open the audit ledger',href:'#ledger',p:[32,70,35,18],l:[65,55,18,24]},
    {id:'observatory-top-alerts',label:'Top Alerts',detail:'Open actionable system alerts',action:'open-alert-center',p:[69,70,30,18],l:[83,55,16,24]}
  ]
};

function hotspotStyle({p,l}) {
  const style = (prefix, values) => [`--${prefix}x:${values[0]}%`,`--${prefix}y:${values[1]}%`,`--${prefix}w:${values[2]}%`,`--${prefix}h:${values[3]}%`].join(';');
  return `${style('l',l)};${style('p',p)}`;
}

function sceneHotspot(item) {
  const attrs = [`class="scene-hotspot"`,`data-hotspot-id="${esc(item.id)}"`,`style="${hotspotStyle(item)}"`,`aria-label="${esc(item.label)}: ${esc(item.detail)}"`,`title="${esc(item.label)} · ${esc(item.detail)}"`];
  if (item.href) {
    return `<a ${attrs.join(' ')} href="${esc(item.href)}"></a>`;
  }
  attrs.push(`type="button"`, `data-action="${esc(item.info ? 'scene-info' : item.action)}"`);
  if (item.info) attrs.push(`data-info="${esc(item.info)}"`);
  if (item.aiTask) attrs.push(`data-ai-task="${esc(item.aiTask)}"`);
  if (item.aiTarget) attrs.push(`data-ai-target="${esc(item.aiTarget)}"`);
  return `<button ${attrs.join(' ')}></button>`;
}

function sceneHotspots(key) {
  const items = SCENE_HOTSPOTS[key] || [];
  return `<div class="scene-hotspots" role="group" aria-label="Interactive areas in this illustrated room">${items.map(sceneHotspot).join('')}</div>`;
}

function ensureImprovementState() {
  if (!state.improvementSystem || typeof state.improvementSystem !== 'object') state.improvementSystem = {};
  if (!Array.isArray(state.improvementSystem.bugs)) state.improvementSystem.bugs = [];
  if (!Array.isArray(state.improvementSystem.railChecks)) state.improvementSystem.railChecks = [];
  if (!Array.isArray(state.improvementSystem.forgeDrafts)) state.improvementSystem.forgeDrafts = [];
}

const PROPOSAL_STAGES = ['proposed','petitioning','deliberating','voting','outcome recorded','expired','withdrawn','superseded'];
const CIVIC_COLLECTIONS = ['petitionSignals','discussions','workgroups','bulletins','federationMessages','adoptionSignals','experiments','rollbacks'];

function ensureCivicState() {
  if (!state.civicSystem || typeof state.civicSystem !== 'object') state.civicSystem = {};
  for (const key of CIVIC_COLLECTIONS) if (!Array.isArray(state.civicSystem[key])) state.civicSystem[key] = [];
  if (!Array.isArray(state.civicSystem.dismissedAlerts)) state.civicSystem.dismissedAlerts = [];
}

function petitionSummary(proposalId) {
  ensureCivicState();
  const signals = state.civicSystem.petitionSignals.filter(item => item.proposalId === proposalId);
  return {
    support: signals.filter(item => item.signal === 'support').length,
    concern: signals.filter(item => item.signal === 'concern').length,
    local: signals.find(item => item.sourceRef === `local:${state.meta.communityRef}`)?.signal || ''
  };
}

function discussionCount(proposalId) {
  ensureCivicState();
  return state.civicSystem.discussions.filter(item => item.proposalId === proposalId).length;
}

function petitionControls(proposal) {
  const summary = petitionSummary(proposal.id);
  return `<div class="petition-controls"><div class="tags"><span class="tag cyan">${summary.support} support</span><span class="tag gold">${summary.concern} concerns</span><span class="tag">${discussionCount(proposal.id)} discussion notes</span></div><div class="item-actions"><button class="btn small ${summary.local==='support'?'primary':'secondary'}" data-action="signal-petition" data-id="${esc(proposal.id)}" data-signal="support">Support petition</button><button class="btn small ${summary.local==='concern'?'primary':'ghost'}" data-action="signal-petition" data-id="${esc(proposal.id)}" data-signal="concern">Raise concern</button><button class="btn small ghost" data-action="open-discussion" data-id="${esc(proposal.id)}">Discuss</button><button class="btn small ghost" data-action="advance-proposal-status" data-id="${esc(proposal.id)}">Advance visible stage</button></div></div>`;
}

function derivedCivicAlerts() {
  ensureCivicState();
  ensureImprovementState();
  const dismissed = new Set(state.civicSystem.dismissedAlerts);
  const summary = readinessSummary(state);
  const alerts = [];
  if (summary.blockingThreats.length) alerts.push({id:'readiness:blocking-threats',tone:'danger',title:`${summary.blockingThreats.length} blocking threat records`,detail:'Rights-critical or deployment-blocking threats still require tested dispositions.',href:'#readiness'});
  if (summary.incompleteRights.length) alerts.push({id:'readiness:incomplete-rights',tone:'warn',title:`${summary.incompleteRights.length} rights duties incomplete`,detail:'Mandates, remedies, deadlines, or replacement paths are missing.',href:'#safeguards'});
  const seriousBugs = state.improvementSystem.bugs.filter(item => item.status !== 'resolved' && ['critical','high'].includes(item.severity));
  if (seriousBugs.length) alerts.push({id:'bugs:serious',tone:'danger',title:`${seriousBugs.length} serious open bugs`,detail:'High or critical defects remain in the repair pipeline.',href:'#bug-triage'});
  const invalidBridges = state.bridgeContracts.filter(item => !validateBridge(item).valid);
  if (invalidBridges.length) alerts.push({id:'rails:invalid-bridges',tone:'warn',title:`${invalidBridges.length} bridge contracts need review`,detail:'Compatibility, minimization, or default-off requirements are incomplete.',href:'#rails'});
  const stale = state.proposals.filter(item => item.status === 'proposed' && item.createdAt && Date.now() - Date.parse(item.createdAt) > 14*86400000);
  if (stale.length) alerts.push({id:'proposals:stale',tone:'warn',title:`${stale.length} proposals have not entered deliberation`,detail:'Move them to petitioning, discussion, withdrawal, or expiry.',href:'#proposal-commons'});
  return alerts.filter(item => !dismissed.has(item.id));
}


const ANARCHADIA_RESIDENTS = {
  hall:{id:'rook',label:'Rook the Hall Steward',glyph:'✦',position:{x:49,y:72},lines:['Every bright door has a manual latch.','A proposal is a question, not a crown.','The workbench stays open when the murals fail.']},
  'proposal-commons':{id:'scribe',label:'Mara the Petition Scribe',glyph:'✎',position:{x:48,y:64},lines:['Support and concern are signals, not proof of consent.','A quiet objection still belongs in the record.','Nothing advances merely because a counter increased.']},
  'bug-triage':{id:'tinker',label:'Bolt the Repair Tinker',glyph:'⚒',position:{x:50,y:66},lines:['Reproduction before rhetoric.','Severity describes harm, not prestige.','Resolved means tested, not forgotten.']},
  'hub-commons':{id:'facilitator',label:'Ilex the Commons Facilitator',glyph:'⌂',position:{x:51,y:69},lines:['Roles should be replaceable without erasing people.','A meeting is not the whole community.','The exit door is part of the constitution.']},
  federation:{id:'courier',label:'Sable the Federation Courier',glyph:'◎',position:{x:50,y:68},lines:['Bundles travel with provenance and limits attached.','Compatibility is not obedience.','Conflicts remain visible at the border.']},
  rails:{id:'engineer',label:'Nix the Rails Engineer',glyph:'≋',position:{x:50,y:69},lines:['Default-off is a kindness to future strangers.','A bridge contract should explain how to leave.','Conformance checks test claims, not legitimacy.']},
  forge:{id:'smith',label:'Ember the Civic Smith',glyph:'⚙',position:{x:50,y:69},lines:['Draft hot, ratify cold.','A simulation is evidence, not permission.','The emergency brake belongs within reach.']},
  ledger:{id:'archivist',label:'Quill the Ledger Archivist',glyph:'▤',position:{x:50,y:68},lines:['History may be appended, never quietly polished.','Rollback is a new record, not an eraser.','Contradictions deserve shelf space.']},
  observatory:{id:'watcher',label:'Vesper the Privacy Watcher',glyph:'◉',position:{x:50,y:68},lines:['Measure conditions without ranking souls.','An alert should point to action, not suspicion.','No dashboard gets to become a judge.']}
};
const ANARCHADIA_AMBIENT = {
  hall:['A paper route map flutters and points toward the Forge.','The announcement board gains a fresh local note.'],
  'proposal-commons':['A petition ribbon is moved from support to concern.','A scribe adds a dissent margin beside a draft.'],
  'bug-triage':['A tiny wrench clatters into the reproduction lab.','A resolved card is copied into the audit archive.'],
  'hub-commons':['The assembly bell rings once, then waits.','A workgroup moves its chairs into a wider circle.'],
  federation:['A sealed bundle arrives with its scope written on the outside.','Two hub signals disagree and remain visibly separate.'],
  rails:['A compatibility lamp blinks amber during a contract check.','The migration track clicks into its rollback position.'],
  forge:['A test furnace cools before the review gate opens.','A draft sparks, fails a check, and stays safely inside the sandbox.'],
  ledger:['An archivist adds a timestamp without declaring it supreme.','A rollback proposal is filed beside the record it challenges.'],
  observatory:['The privacy shutters close over an overly granular chart.','A trend line fades until its source note is restored.']
};
let anarchadiaWorldEngine=null;
function anarchadiaSceneImage(key){const asset=VISUAL_ASSETS[key];return matchMedia('(max-width: 760px) and (orientation: portrait)').matches?`assets/screens/${asset}-portrait.webp`:`assets/screens/${asset}-landscape.webp`;}
function anarchadiaBounds(item){const values=matchMedia('(max-width: 760px) and (orientation: portrait)').matches?item.p:item.l;return {x:values[0],y:values[1],w:values[2],h:values[3]};}
function ensureAnarchadiaWorldEngine(){
  if(anarchadiaWorldEngine||!window.CommonweaveWorldEngine)return anarchadiaWorldEngine;
  anarchadiaWorldEngine=new window.CommonweaveWorldEngine({
    storageKey:'anarchadia.world-state.v1',
    onNavigate:destination=>{location.hash=`#${destination}`;},
    onWorkspace:handoff=>{location.hash=handoff.workspace.startsWith('#')?handoff.workspace:`#${handoff.workspace}`;},
    onAction:item=>{
      if(item.info){sceneInfoModal(item.info);return;}
      const proxy=document.createElement('button');proxy.dataset.action=item.action||'';
      if(item.id)proxy.dataset.id=item.id;if(item.aiTask)proxy.dataset.aiTask=item.aiTask;if(item.aiTarget)proxy.dataset.aiTarget=item.aiTarget;
      handleAction(proxy);
    },
    onAnnounce:message=>announce(message,'good')
  });
  for(const key of VISUAL_ROUTES){
    const actor=ANARCHADIA_RESIDENTS[key];
    const objects=(SCENE_HOTSPOTS[key]||[]).map(item=>{
      const converted={...item,bounds:()=>anarchadiaBounds(item)};
      if(item.href){const destination=item.href.replace(/^#/,'');if(VISUAL_ROUTES.has(destination))converted.portal=destination;else converted.workspace=destination;delete converted.href;}
      return converted;
    });
    objects.push({id:`${key}-memory`,label:'Room memory',bounds:{x:2,y:2,w:12,h:8},action:'increment',stateKey:`anarchadia.${key}.visits`,message:value=>`This room has recorded ${value} deliberate visit${value===1?'':'s'} on this device.`});
    anarchadiaWorldEngine.registerScene({id:key,label:NAV.find(([id])=>id===key)?.[1]||key,image:()=>anarchadiaSceneImage(key),alt:`Anarchadia ${key} illustrated civic room`,objects,actors:actor?[actor]:[],ambient:(ANARCHADIA_AMBIENT[key]||[]).map((message,index)=>({id:`ambient-${index}`,message})),ambientInterval:52000});
  }
  return anarchadiaWorldEngine;
}
function mountAnarchadiaWorldScene(){
  if(!VISUAL_ROUTES.has(route())){anarchadiaWorldEngine?.stopAmbient?.();return;}
  const root=document.querySelector('[data-anarchadia-world-root]');if(!root)return;
  try{const engine=ensureAnarchadiaWorldEngine();if(!engine)throw new Error('World Engine unavailable');engine.mount(route(),root);root.removeAttribute('data-world-fallback');}
  catch(error){console.warn('Anarchadia World Engine fallback active:',error);root.setAttribute('data-world-fallback','true');}
}

function visualScene(key, alt) {
  const asset = VISUAL_ASSETS[key];
  const showingZones = document.body.classList.contains('show-hotspots');
  return `<section class="visual-stage" data-scene="${esc(key)}">
    <div class="visual-stage-canvas" data-anarchadia-world-root data-world-fallback>
      <picture>
        <source media="(max-width: 760px) and (orientation: portrait)" srcset="assets/screens/${asset}-portrait.webp">
        <img src="assets/screens/${asset}-landscape.webp" alt="${esc(alt)}" ${key === 'hall' ? 'fetchpriority="high"' : 'loading="lazy"'}>
      </picture>
      <div class="visual-stage-glass" aria-hidden="true"></div>
      ${sceneHotspots(key)}
      <div class="visual-stage-hint" aria-hidden="true">Tap the labeled stations</div>
    </div>
    <nav class="visual-stage-tools cardinal-image-dock" aria-label="Anarchadia visual dock">
      <a class="scene-tool" href="#hall" aria-label="Home Hall"><img src="../../ui-icons/home.svg" alt=""><span>Hall</span></a>
      <button class="scene-tool passport-tool" type="button" data-action="open-passport" aria-label="Passport"><img src="assets/passport/anarchadia-passport-blank.webp" alt=""><span>Passport</span></button>
      <button class="scene-tool" type="button" data-action="accessibility" aria-label="Accessibility"><img src="assets/icon-192.png" alt=""><span>Settings</span></button>
      <button class="scene-tool" type="button" data-action="return-commonweave" aria-label="Return to Commonweave"><img src="../../ui-icons/back.svg" alt=""><span>Commonweave</span></button>
    </nav>
    <div class="anarchadia-version-plaque"><img src="assets/icon-192.png" alt=""><span>v${APP_VERSION}</span></div>
  </section>`;
}

function sceneAction(action) {
  const tone = action.tone ? ` ${action.tone}` : '';
  const metric = action.metric ? `<strong>${esc(action.metric)}</strong>` : '';
  const content = `<span class="scene-action-icon" aria-hidden="true">${esc(action.icon || '✦')}</span><span><b>${esc(action.label)}</b><small>${esc(action.detail || '')}</small></span>${metric}`;
  if (action.href) return `<a class="scene-action${tone}" href="${esc(action.href)}">${content}</a>`;
  const data = [
    `data-action="${esc(action.action)}"`,
    action.id ? `data-id="${esc(action.id)}"` : '',
    action.aiTask ? `data-ai-task="${esc(action.aiTask)}"` : '',
    action.aiTarget ? `data-ai-target="${esc(action.aiTarget)}"` : ''
  ].filter(Boolean).join(' ');
  return `<button class="scene-action${tone}" type="button" ${data}>${content}</button>`;
}

function visualPage({key,title,subtitle,alt,actions,content=''}) {
  return shell(`${visualScene(key, alt)}<p class="visually-hidden">${esc(title)}. ${esc(subtitle)}</p>`, title, subtitle);
}

function hallPage() {
  return visualPage({
    key:'hall', title:'Home Hall', subtitle:'Choose a room. Every door opens an inspectable workflow.', alt:'Anarchadia Home Hall with doors to feature requests, bug reports, hub governance, federation, rails, and the forge.',
    actions:[
      {href:'#proposal-commons',label:'Feature Request',detail:'Propose an improvement and gather support.',icon:'✎'},
      {href:'#bug-triage',label:'Bug Report',detail:'Log, reproduce, advance, and resolve defects.',icon:'⚒'},
      {href:'#hub-commons',label:'Hub Commons',detail:'Local charter, roles, rights, and assembly.',icon:'⌂'},
      {href:'#federation',label:'Federation Chamber',detail:'Exchange bundles and connect trusted hubs.',icon:'◎'},
      {href:'#rails',label:'Rails Engine Room',detail:'Inspect compatibility and bridge contracts.',icon:'≋'},
      {href:'#forge',label:'The Forge',detail:'Turn an improvement request into a bounded build proposal.',icon:'⚙'}
    ],
    content:`<section class="section grid three hall-pulse">
      <article class="card"><span class="eyebrow">Live activity</span><h3>${state.proposals.length} proposals in the hall</h3><p>${state.audit[0] ? esc(state.audit[0].action) : 'No activity recorded yet.'}</p></article>
      <article class="card"><span class="eyebrow">Community</span><h3>${esc(state.meta.communityName)}</h3><p>${state.charter.sections.length} charter sections · ${state.dissents.length} preserved dissent records</p></article>
      <article class="card"><span class="eyebrow">Emergency brake</span><h3>${readinessSummary(state).percent}% readiness recorded</h3><p>Evidence is inspectable and never treated as automatic legitimacy.</p></article>
    </section>`
  });
}

function proposalCommonsPage() {
  const cards = state.proposals.slice(0,4).map(proposal => `<article class="room-record"><span class="tag ${classifyProposal(proposal).level === 'rights-critical' ? 'rose' : 'cyan'}">${esc(classifyProposal(proposal).level)}</span><h3>${esc(proposal.title)}</h3><p>${esc(proposal.purpose || 'No purpose recorded.')}</p>${petitionControls(proposal)}<div class="row"><button class="btn small" data-action="edit-proposal" data-id="${esc(proposal.id)}">Open</button><button class="btn small ghost" data-action="open-ai" data-ai-task="rights-scan" data-ai-target="proposal" data-id="${esc(proposal.id)}">AI scan</button></div></article>`).join('') || '<div class="empty">No proposals yet. The Idea Board is waiting.</div>';
  return visualPage({key:'proposal-commons',title:'Proposal Commons',subtitle:'Ideas enter as proposals, then move through discussion, choice, and visible status.',alt:'Anarchadia Proposal Commons with idea board, petitions, discussion, voting, status, and a feature request desk.',actions:[
    {action:'add-proposal',label:'Submit Feature Request',detail:'Open the bounded proposal form.',icon:'✎',tone:'primary'},
    {action:'open-petition-board',label:'Petitions & Support',detail:'Record operational support or concern signals.',icon:'✋',metric:String(state.civicSystem.petitionSignals.length)},
    {action:'open-discussion-board',label:'Discussion Chamber',detail:'Add attributed or pseudonymous deliberation notes.',icon:'☷',metric:String(state.civicSystem.discussions.length)},
    {href:'#ledger',label:'Track Status',detail:'Inspect stages, outcomes, versions, and audit history.',icon:'✓',metric:String(state.proposals.length)}
  ],content:`<section class="section room-records"><div class="section-head"><div><h2>Current idea board</h2><p>Recent proposals from this local workspace.</p></div></div><div class="grid two">${cards}</div></section>`});
}

function bugTriagePage() {
  ensureImprovementState();
  const bugs=state.improvementSystem.bugs;
  const unresolved=bugs.filter(b=>b.status!=='resolved');
  const cards=bugs.slice(0,8).map(b=>`<article class="room-record bug-record"><div class="item-head"><div><span class="tag ${b.severity==='critical'?'rose':b.severity==='high'?'gold':'cyan'}">${esc(b.severity)}</span><h3>${esc(b.title)}</h3></div><span class="tag">${esc(b.status)}</span></div><p>${esc(b.environment || 'Environment not recorded')}</p><p>${esc(b.actual || b.steps || 'No reproduction notes yet.')}</p><div class="row">${b.status!=='resolved'?`<button class="btn small" data-action="advance-bug" data-id="${esc(b.id)}">Advance pipeline</button><button class="btn small secondary" data-action="resolve-bug" data-id="${esc(b.id)}">Resolve</button>`:'<span class="tag acid">Fixed · tested · shipped</span>'}</div></article>`).join('') || '<div class="empty">No bugs are currently on the board.</div>';
  return visualPage({key:'bug-triage',title:'Bug Triage Board',subtitle:'Document the failure, reproduce it, and move it visibly toward resolution.',alt:'Anarchadia Bug Triage Board with issue queue, severity matrix, reproduction lab, fix pipeline, and resolved records.',actions:[
    {action:'add-bug',label:'File Bug Report',detail:'Record environment, reproduction, and expected behavior.',icon:'⚒',tone:'primary'},
    {action:'run-rail-check',label:'Check Related Rails',detail:'Run a local compatibility and bridge validation.',icon:'≋'},
    {href:'#forge',label:'Send to Forge',detail:'Turn a persistent defect into an improvement proposal.',icon:'⚙'},
    {href:'#observatory',label:'Watch System Health',detail:'Inspect readiness, activity, and alerts.',icon:'◉',metric:String(unresolved.length)}
  ],content:`<section class="section room-records"><div class="section-head"><div><h2>Issue queue</h2><p>${unresolved.length} open · ${bugs.filter(b=>b.status==='resolved').length} resolved</p></div></div><div class="grid two">${cards}</div></section>`});
}

function hubCommonsPage() {
  return visualPage({key:'hub-commons',title:'Hub Commons',subtitle:'The local community governs its charter, roles, rights, records, and readiness here.',alt:'Anarchadia Hub Commons with assembly, workgroups, bulletins, local rules, and archives.',actions:[
    {href:'#charter',label:'Assembly Charter',detail:'Draft controlling text and commit local versions.',icon:'☷',metric:String(state.charter.sections.length)},
    {action:'open-workgroups',label:'Workgroups',detail:'Coordinate bounded circles with visible next actions.',icon:'⚒',metric:String(state.civicSystem.workgroups.length)},
    {action:'open-bulletins',label:'Commons Bulletins',detail:'Post expiring local notices without inferring consensus.',icon:'▤',metric:String(state.civicSystem.bulletins.length)},
    {href:'#readiness',label:'Local Rules Gate',detail:'Record evidence and preserve the no-build option.',icon:'✓'}
  ],content:`<section class="section grid two"><article class="card"><span class="eyebrow">Local banner</span><h2>${esc(state.meta.communityName)}</h2><p>${esc(state.charter.preamble || 'No preamble has been drafted.')}</p></article><article class="card"><span class="eyebrow">Commons pulse</span><h2>${state.rights.length} rights · ${state.roles.length} roles</h2><p>${state.civicSystem.workgroups.length} workgroups · ${state.civicSystem.bulletins.length} current bulletins · ${state.dissents.length} dissent records remain visible.</p></article></section>`});
}

function federationChamberPage() {
  const valid=state.bridgeContracts.filter(item=>validateBridge(item).valid).length;
  return visualPage({key:'federation',title:'Federation Chamber',subtitle:'Hubs exchange bounded artifacts, preserve conflicts, and adopt improvements deliberately.',alt:'Anarchadia Federation Chamber with hub map, treaties, shared amendments, adoption signals, and messages.',actions:[
    {href:'#exchange',label:'Hub Map & Exchange',detail:'Build, inspect, download, or restore a scoped bundle.',icon:'◎'},
    {action:'add-bridge',label:'Draft Treaty / Bridge',detail:'Create a default-off one-direction contract.',icon:'∞',tone:'primary'},
    {action:'open-adoption-signals',label:'Adoption Signals',detail:'Record a hub’s scoped, reversible response to an artifact.',icon:'✓',metric:String(state.civicSystem.adoptionSignals.length)},
    {action:'open-federation-messages',label:'Hub Messages',detail:'Draft bounded messages linked to explicit contracts.',icon:'✉',metric:String(state.civicSystem.federationMessages.length)}
  ],content:`<section class="section grid four"><article class="card metric"><small>Bridge contracts</small><strong>${state.bridgeContracts.length}</strong><span class="tag cyan">${valid} conforming</span></article><article class="card metric"><small>Imported hub bundles</small><strong>${state.imports.length}</strong><span class="tag gold">conflicts preserved</span></article><article class="card metric"><small>Shared amendment records</small><strong>${state.amendments.length}</strong><span class="tag acid">adoption is explicit</span></article><article class="card metric"><small>Bounded hub messages</small><strong>${state.civicSystem.federationMessages.length}</strong><span class="tag">draft or declared sent</span></article></section>`});
}

function railHealth() {
  const bridges=state.bridgeContracts || [];
  const invalid=bridges.filter(item=>!validateBridge(item).valid);
  const readiness=readinessSummary(state);
  return {bridges:bridges.length,invalid:invalid.length,readiness,score:Math.max(0,100-invalid.length*15-readiness.blockingThreats.length*10)};
}

function railsEnginePage() {
  ensureImprovementState();
  const health=railHealth();
  const latest=state.improvementSystem.railChecks[0];
  return visualPage({key:'rails',title:'Rails Engine Room',subtitle:'Compatibility is maintained through inspectable contracts, versions, migration paths, and conformance checks.',alt:'Anarchadia Rails Engine Room with contracts, capabilities, versions, migrations, conformance, and an interoperability core.',actions:[
    {action:'run-rail-check',label:'Run Conformance Check',detail:'Validate bridge contracts and readiness locally.',icon:'✓',tone:'primary'},
    {href:'#exchange',label:'Contracts & Migrations',detail:'Open the bridge and bundle workbench.',icon:'⇄'},
    {href:'#safeguards',label:'Capabilities & Limits',detail:'Inspect procedures, data, threats, and duty roles.',icon:'▦'},
    {href:'#constitution',label:'Protocol Constitution',detail:'Review frozen principles and replaceability boundaries.',icon:'☷'}
  ],content:`<section class="section grid four"><article class="card metric"><small>Rail health</small><strong>${health.score}%</strong><span class="tag ${health.invalid?'gold':'acid'}">${health.invalid} invalid bridges</span></article><article class="card metric"><small>Contracts</small><strong>${health.bridges}</strong><span class="tag cyan">default-off</span></article><article class="card metric"><small>Readiness</small><strong>${health.readiness.percent}%</strong><span class="tag gold">evidence only</span></article><article class="card metric"><small>Last check</small><strong>${latest ? esc(new Date(latest.at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})) : '—'}</strong><span class="tag">${latest ? esc(latest.result) : 'not run'}</span></article></section>`});
}

function forgePage() {
  ensureImprovementState();
  const drafts=state.proposals.filter(item=>item.status==='forge-draft');
  return visualPage({key:'forge',title:'The Forge',subtitle:'Build an amendment candidate inside a bounded, reviewable workflow. Nothing deploys itself.',alt:'Anarchadia Forge with sandbox, AI build, simulation, tests, review gate, and deploy exit.',actions:[
    {action:'forge-improvement',label:'Forge Improvement',detail:'Turn a problem and desired outcome into a proposal draft.',icon:'⚙',tone:'primary'},
    {action:'open-ai',aiTask:'proposal-card',aiTarget:'workspace',label:'AI Build Assistant',detail:'Open Rook for advisory drafting and review.',icon:'✧'},
    {action:'open-experiments',label:'Simulation & Tests',detail:'Plan and record bounded experiments before adoption.',icon:'◉',metric:String(state.civicSystem.experiments.length)},
    {href:'#proposal-commons',label:'Review Gate',detail:'Move the draft into discussion and choice.',icon:'✓',metric:String(drafts.length)}
  ],content:`<section class="section grid two"><article class="card"><span class="eyebrow">Forge queue</span><h2>${drafts.length} improvement drafts</h2><p>Each draft remains a proposal record until people deliberately discuss, amend, test, and declare an outcome.</p>${drafts.slice(0,3).map(d=>`<div class="item"><h3>${esc(d.title)}</h3><p>${esc(d.forge?.desiredOutcome || d.purpose)}</p><div class="row"><button class="btn small" data-action="edit-proposal" data-id="${esc(d.id)}">Open draft</button><button class="btn small ghost" data-action="open-ai" data-ai-task="rights-scan" data-ai-target="proposal" data-id="${esc(d.id)}">Review risks</button></div></div>`).join('')}</article><article class="card"><span class="eyebrow">Latest advisory output</span><h2>${lastAiDraft ? esc(lastAiDraft.task) : 'No AI draft yet'}</h2><p>${lastAiDraft ? esc(lastAiDraft.text.slice(0,260)) : 'Rook can propose text, identify risks, and suggest tests. It cannot approve or deploy the result.'}</p>${lastAiDraft?'<a class="btn small" href="#ai">Inspect draft</a>':''}</article></section>`});
}

function ledgerPage() {
  const audit=state.audit.slice(0,6).map(item=>`<article class="room-record"><span class="tag">${esc(new Date(item.at).toLocaleString())}</span><h3>${esc(item.action)}</h3><p class="mono">${esc(JSON.stringify(item.detail || {}).slice(0,220))}</p></article>`).join('');
  return visualPage({key:'ledger',title:'Amendment Ledger',subtitle:'The record preserves ratified claims, versions, conflicts, bundles, and rollback paths.',alt:'Anarchadia Amendment Ledger with ratified changes, timeline, audit trail, bundles, rollback, and truth vault.',actions:[
    {href:'#charter',label:'Ratified Changes',detail:'Inspect charter versions and exact controlling text.',icon:'▤',metric:String(state.charter.versions.length)},
    {href:'#proposals',label:'Timeline & Outcomes',detail:'Review proposals, declared outcomes, and dissent.',icon:'⌛'},
    {action:'open-rollback-board',label:'Rollback Proposals',detail:'Draft append-only reversals without erasing history.',icon:'↶',metric:String(state.civicSystem.rollbacks.length)},
    {href:'#exchange',label:'Bundles & Audit',detail:'Build continuity archives and inspect imports.',icon:'▣'}
  ],content:`<section class="section room-records"><div class="section-head"><div><h2>Recent audit trail</h2><p>Informational provenance only. Earlier timestamps do not outrank later or conflicting records.</p></div></div><div class="grid two">${audit || '<div class="empty">No audit events yet.</div>'}</div></section>`});
}

function observatoryPage() {
  ensureImprovementState();
  ensureCivicState();
  const summary=readinessSummary(state);
  const alerts=derivedCivicAlerts();
  const activeWorkgroups=state.civicSystem.workgroups.filter(item=>item.status==='active').length;
  const adoptionCount=state.civicSystem.adoptionSignals.filter(item=>item.status==='adopted in scope').length;
  return visualPage({key:'observatory',title:'Observatory / Metrics',subtitle:'See system conditions without turning people into scores or surveillance targets.',alt:'Anarchadia civic observatory with health, activity, participation, adoption, alerts, maps, and trends.',actions:[
    {href:'#overview',label:'System Overview',detail:'Open the classic workspace summary.',icon:'◉'},
    {action:'open-alert-center',label:'Actionable Alerts',detail:'Inspect blockers and dismiss only the local reminder.',icon:'⚠',metric:String(alerts.length)},
    {action:'open-workgroups',label:'Participation Conditions',detail:'Inspect active workgroups without ranking people.',icon:'♧',metric:String(activeWorkgroups)},
    {action:'open-adoption-signals',label:'Adoption Signals',detail:'Inspect scoped federation responses.',icon:'◎',metric:String(adoptionCount)}
  ],content:`<section class="section grid four"><article class="card metric"><small>Health</small><strong>${summary.percent}%</strong><span class="tag acid">recorded readiness</span></article><article class="card metric"><small>Activity</small><strong>${state.audit.length}</strong><span class="tag cyan">audit events</span></article><article class="card metric"><small>Participation</small><strong>${activeWorkgroups}</strong><span class="tag gold">active workgroups</span></article><article class="card metric"><small>Alerts</small><strong>${alerts.length}</strong><span class="tag ${alerts.length?'rose':'acid'}">local review queue</span></article></section>`});
}

function workbenchPage() {
  const links=[
    ['overview','Overview','Metrics, admission, and recent provenance'],['charter','Charter','Controlling text and local versions'],['proposals','Proposals','Full deliberation, votes, outcomes, and dissent'],['safeguards','Safeguards','Rights, roles, procedures, data, threats, and bridges'],['exchange','Exchange','Bundles, import, fork, and exit'],['ai','Rook','Model configuration and advisory drafts'],['readiness','Readiness','Evidence gates and no-build stop rule'],['constitution','Constitution','Frozen source articles and boundaries']
  ];
  return shell(`<section class="workbench-intro"><span class="eyebrow">Accessible text interface</span><h1>The machinery behind the murals.</h1><p>Every illustrated room routes into these existing local-first tools. This view remains available for precision, keyboard access, small screens, debugging, and low-bandwidth use.</p><a class="btn primary" href="#hall">Return to Home Hall</a></section><section class="section workbench-grid">${links.map(([id,label,detail])=>`<a class="workbench-link" href="#${id}"><span class="eyebrow">${esc(id)}</span><h2>${esc(label)}</h2><p>${esc(detail)}</p><span>Open →</span></a>`).join('')}</section>`, 'Anarchadia Workbench', 'Direct access to every underlying governance tool');
}

function overviewPage() {
  const summary = readinessSummary(state);
  const blockers = summary.blockingThreats.length + summary.incompleteRights.length;
  return shell(`
    <section class="hero">
      <div class="eyebrow">Local-first constitutional toolkit</div>
      <h2>A civic workbench with an emergency brake.</h2>
      <p>Draft a charter, document procedures, preserve dissent, map institutional powers, exercise offline continuity, and exchange deliberately scoped records. Every bright button has a shadow label: what it cannot authorize.</p>
      <div class="hero-actions">
        <a class="btn primary" href="#charter">Open the charter</a>
        <a class="btn secondary" href="#readiness">Inspect readiness gate</a>
        <button class="btn" data-action="open-ai" data-ai-task="rights-scan">Ask AI to scan workspace</button>
      </div>
    </section>
    <section class="section grid four">
      <article class="card metric"><small>Charter version</small><strong>v${state.charter.version}</strong><span class="tag acid">${esc(state.charter.status)}</span></article>
      <article class="card metric"><small>Declared proposals</small><strong>${state.proposals.length}</strong><span class="tag cyan">record-only</span></article>
      <article class="card metric"><small>Preserved dissent records</small><strong>${state.dissents.length}</strong><span class="tag rose">dissenter-scoped</span></article>
      <article class="card metric"><small>Unresolved blockers</small><strong>${blockers}</strong><span class="tag gold">${esc(summary.pilotStatus)}</span></article>
    </section>
    <section class="section grid two">
      <article class="card">
        <div class="section-head"><div><h3>Candidate journey</h3><p>The admission card can still conclude that no software should be built or used.</p></div><button class="btn small" data-action="edit-admission">Edit</button></div>
        <dl>
          <dt class="eyebrow">Observed bottleneck</dt><dd>${esc(state.admission.actualBottleneck || 'Not documented')}</dd>
          <dt class="eyebrow">Comparator</dt><dd>${esc(state.admission.comparator || 'Not documented')}</dd>
          <dt class="eyebrow">No-build path</dt><dd>${esc(state.admission.noBuildPath || 'Not documented')}</dd>
          <dt class="eyebrow">Stop condition</dt><dd>${esc(state.admission.stopCondition || 'Not documented')}</dd>
        </dl>
      </article>
      <article class="card">
        <div class="section-head"><div><h3>Readiness constellation</h3><p>Completion records evidence. It does not bestow legitimacy.</p></div><a class="btn small" href="#readiness">Open gate</a></div>
        <div class="progress"><span style="width:${summary.percent}%"></span></div>
        <div class="row" style="margin-top:.7rem"><strong>${summary.percent}% recorded</strong><span class="muted">${summary.complete} of ${summary.total}</span></div>
        <div class="notice ${blockers ? 'danger' : 'good'}" style="margin-top:.8rem">${blockers ? `${blockers} rights or threat blockers remain.` : 'No automatic blocker is currently visible. Human review remains mandatory.'}</div>
      </article>
    </section>
    <section class="section">
      <div class="section-head"><div><h2>Recent provenance</h2><p>Informational history only. Earlier timestamps do not outrank later or conflicting records.</p></div></div>
      <div class="list">${state.audit.slice(0,6).map(log => `<article class="item"><div class="item-head"><h4>${esc(log.action)}</h4><span class="tag">${esc(new Date(log.at).toLocaleString())}</span></div><p>${esc(JSON.stringify(log.detail))}</p></article>`).join('') || '<div class="empty">No audit entries.</div>'}</div>
    </section>`, 'Overview', state.meta.communityName);
}

function charterPage() {
  const conflictCount = state.charter.conflicts?.length || 0;
  return shell(`
    <section class="grid two">
      <article class="card accent">
        <div class="section-head"><div><div class="eyebrow">Operative draft</div><h2>${esc(state.charter.title)}</h2><p>Version ${state.charter.version} · ${esc(state.charter.status)}</p></div><button class="btn small" data-action="edit-charter-meta">Edit header</button></div>
        <p>${nl2br(state.charter.preamble || 'No preamble yet.')}</p>
        <div class="tags"><span class="tag acid">human-editable</span><span class="tag cyan">offline-readable</span><span class="tag rose">non-certifying</span>${conflictCount ? `<span class="tag gold">${conflictCount} contested imports</span>` : ''}</div>
      </article>
      <article class="card">
        <h3>Version action</h3>
        <p>Committing a version preserves the current snapshot and change summary. It does not adopt or ratify the text.</p>
        <label>Change summary<textarea id="version-summary" placeholder="What changed, why, and what remains disputed?"></textarea></label>
        <div class="form-actions"><button class="btn primary" data-action="commit-charter">Commit local version</button><button class="btn" data-action="open-ai" data-ai-task="rights-scan" data-ai-target="charter">AI rights scan</button></div>
      </article>
    </section>
    <section class="section">
      <div class="section-head"><div><h2>Charter sections</h2><p>Controlling language stays visible and community-revisable.</p></div><button class="btn primary" data-action="add-section">Add section</button></div>
      <div class="list">
        ${state.charter.sections.sort((a,b)=>a.order-b.order).map(section => `<article class="item">
          <div class="item-head"><div><span class="eyebrow">Section ${esc(section.order)}</span><h3>${esc(section.title)}</h3></div><div class="row"><button class="btn small" data-action="edit-section" data-id="${esc(section.id)}">Edit</button><button class="btn small danger" data-action="delete-section" data-id="${esc(section.id)}">Remove</button></div></div>
          <p>${nl2br(section.text)}</p>
          <div class="item-actions"><button class="btn small ghost" data-action="open-ai" data-ai-task="plain-language" data-ai-target="section" data-id="${esc(section.id)}">Accessible layer</button><button class="btn small ghost" data-action="open-ai" data-ai-task="rights-scan" data-ai-target="section" data-id="${esc(section.id)}">Scan protections</button><button class="btn small ghost" data-action="add-dissent" data-target-type="charter-section" data-target-id="${esc(section.id)}">Preserve dissent</button></div>
        </article>`).join('') || '<div class="empty">No sections yet. A blank charter is not a failure state.</div>'}
      </div>
    </section>
    <section class="section grid two">
      <article class="card">
        <div class="section-head"><div><h3>Version history</h3><p>Snapshots can be inspected or used to draft amendments.</p></div></div>
        <div class="list">${state.charter.versions.map(version => `<article class="item"><div class="item-head"><h4>Version ${esc(version.version)}</h4><span class="tag">${esc(new Date(version.at).toLocaleString())}</span></div><p>${esc(version.summary || 'No summary')}</p><button class="btn small" data-action="view-version" data-id="${esc(version.id)}">Inspect snapshot</button></article>`).join('') || '<div class="empty">No committed versions.</div>'}</div>
      </article>
      <article class="card">
        <div class="section-head"><div><h3>Contested imported records</h3><p>Import order and administrator preference do not resolve conflict.</p></div></div>
        <div class="list">${(state.charter.conflicts || []).map(conflict => `<article class="item"><div class="item-head"><h4>${esc(conflict.collection)} / ${esc(conflict.recordId)}</h4><span class="tag gold">contested</span></div><p>${esc(conflict.resolution)}</p><button class="btn small" data-action="view-conflict" data-id="${esc(conflict.id)}">Compare</button></article>`).join('') || '<div class="empty">No imported conflicts.</div>'}</div>
      </article>
    </section>`, 'Charter workspace', 'Draft, inspect, compare, dissent, version, export');
}

function governanceTally(proposal = {}) {
  const tally = proposal.governance?.tally || proposal.tally || {};
  return {
    approve: Math.max(0, Number(tally.approve || 0)),
    reject: Math.max(0, Number(tally.reject || 0)),
    abstain: Math.max(0, Number(tally.abstain || 0))
  };
}

function governanceVoteControls(proposal) {
  if (!proposal.externalId) return '';
  const tally = governanceTally(proposal);
  const selected = proposal.localVote || proposal.governance?.myVote || '';
  const status = proposal.governance?.status || proposal.status || 'voting';
  return `<div class="commonweave-vote">
    <div class="tags"><span class="tag acid">Commonweave member vote</span><span class="tag">${esc(status)}</span><span class="tag cyan">${tally.approve} support</span><span class="tag rose">${tally.reject} concern</span><span class="tag">${tally.abstain} abstain</span></div>
    <p class="disclaimer">One connected member may record one current choice. Numbers are operational signals, not proof of legitimacy or consent.</p>
    <div class="item-actions">
      <button class="btn small ${selected === 'approve' ? 'primary' : 'secondary'}" data-action="cast-governance-vote" data-id="${esc(proposal.id)}" data-choice="approve">Support plan</button>
      <button class="btn small ${selected === 'reject' ? 'primary' : 'ghost'}" data-action="cast-governance-vote" data-id="${esc(proposal.id)}" data-choice="reject">Raise concern</button>
      <button class="btn small ${selected === 'abstain' ? 'primary' : 'ghost'}" data-action="cast-governance-vote" data-id="${esc(proposal.id)}" data-choice="abstain">Abstain</button>
    </div>
  </div>`;
}

function proposalsPage() {
  const approved = state.proposals.filter(proposal => (proposal.governance?.status || proposal.status) === 'approved');
  return shell(`
    <section class="hero" style="padding:1.6rem">
      <div class="eyebrow">Member choices, declared outcomes, never machine-certified</div>
      <h2 style="font-size:clamp(2rem,4vw,3.5rem)">A vote can move a plan without crowning the machine.</h2>
      <p>Anarchadia can collect one current operational choice from each connected member for a Cerbanimo plan. The result updates the shared quest board, while legitimacy, authority, rights, silence, and dissent remain human questions.</p>
      <div class="hero-actions"><button class="btn primary" data-action="add-proposal">Create proposal record</button><button class="btn" data-action="open-ai" data-ai-task="proposal-card">AI drafting card</button></div>
    </section>
    <section class="section">
      <div class="section-head"><div><h2>Approved community quest board</h2><p>${approved.length} operational plan${approved.length === 1 ? '' : 's'} currently visible to connected Cerbanimo members</p></div></div>
      <div class="grid two">${approved.map(proposal => `<article class="card"><span class="tag acid">approved for quest board</span><h3>${esc(proposal.title)}</h3><p>${esc(proposal.purpose)}</p>${governanceVoteControls(proposal)}</article>`).join('') || '<div class="empty">No Cerbanimo plan has reached its declared operational threshold.</div>'}</div>
    </section>
    <section class="section grid two">
      <article class="card">
        <div class="section-head"><div><h2>Proposals</h2><p>${state.proposals.length} local records</p></div></div>
        <div class="list">${state.proposals.map(proposal => {
          const validation = validateProposal(proposal);
          return `<article class="item"><div class="item-head"><div><h3>${esc(proposal.title)}</h3><div class="tags"><span class="tag ${validation.classification.level === 'rights-critical' ? 'rose' : 'cyan'}">${esc(validation.classification.level)}</span><span class="tag">${esc(proposal.governance?.status || proposal.status || 'proposed')}</span>${validation.missing.length ? `<span class="tag gold">${validation.missing.length} missing fields</span>` : ''}</div></div><button class="btn small" data-action="edit-proposal" data-id="${esc(proposal.id)}">Edit</button></div><p>${esc(proposal.purpose)}</p>${petitionControls(proposal)}${governanceVoteControls(proposal)}<div class="item-actions"><button class="btn small secondary" data-action="declare-outcome" data-id="${esc(proposal.id)}">Declare outcome</button><button class="btn small ghost" data-action="add-dissent" data-target-type="proposal" data-target-id="${esc(proposal.id)}">Preserve dissent</button><button class="btn small ghost" data-action="open-ai" data-ai-task="rights-scan" data-ai-target="proposal" data-id="${esc(proposal.id)}">AI scan</button></div></article>`;
        }).join('') || '<div class="empty">No proposal records. Omission is allowed.</div>'}</div>
      </article>
      <article class="card">
        <div class="section-head"><div><h2>Declared outcomes</h2><p>Outcomes remain claims with provenance and contest status.</p></div></div>
        <div class="list">${state.outcomes.map(outcome => `<article class="item"><div class="item-head"><h3>${esc(outcome.outcome)}</h3><span class="tag ${outcome.contested ? 'gold' : 'cyan'}">${outcome.contested ? 'contested' : 'declared'}</span></div><p>${esc(outcome.statement)}</p><div class="tags"><span class="tag">proposal ${esc(outcome.proposalId)}</span><span class="tag">${esc(outcome.procedureVersion)}</span></div></article>`).join('') || '<div class="empty">No declared outcomes.</div>'}</div>
      </article>
    </section>
    <section class="section">
      <div class="section-head"><div><h2>Voluntarily preserved dissent</h2><p>No dissent is erased by a declared outcome.</p></div></div>
      <div class="grid three">${state.dissents.map(dissent => `<article class="card"><div class="item-head"><h3>${esc(dissent.title || 'Dissent record')}</h3><span class="tag rose">${esc(dissent.disclosure)}</span></div><p>${esc(dissent.text)}</p><small class="muted">Target: ${esc(dissent.targetType)} / ${esc(dissent.targetId)}</small></article>`).join('') || '<div class="empty">No dissent records have been added.</div>'}</div>
    </section>`, 'Proposals, member choices, and declared outcomes', 'Operational tally · dissent preserved · no automatic ratification claim');
}

function safeguardsPage() {
  const incomplete = state.rights.filter(r => !validateRight(r).valid).length;
  return shell(`
    <section class="grid four">
      <article class="card metric"><small>Rights duty cards</small><strong>${state.rights.length}</strong><span class="tag ${incomplete ? 'gold' : 'acid'}">${incomplete} incomplete</span></article>
      <article class="card metric"><small>Replaceable role cards</small><strong>${state.roles.length}</strong><span class="tag cyan">bounded</span></article>
      <article class="card metric"><small>Data map classes</small><strong>${state.dataMap.length}</strong><span class="tag rose">private by default</span></article>
      <article class="card metric"><small>Threats recorded</small><strong>${state.threats.length}</strong><span class="tag gold">unknowns visible</span></article>
    </section>
    ${collectionSection('Rights and institutional duties','A rights-affecting act pauses when notice, review, assistance, or replacement is unresolved.','rights','add-right', state.rights, rightCard)}
    ${collectionSection('Roles and mandate cards','Every operational privilege is visible, bounded, expiring, recallable, and replaceable.','roles','add-role', state.roles, roleCard)}
    ${collectionSection('Procedure comparison cards','Documentation-only alternatives receive equivalent weight and no recommended default.','procedureCards','add-procedure', state.procedureCards, procedureCard)}
    ${collectionSection('Data and authority map','Private by default for people; accountable by default for institutions.','dataMap','add-data', state.dataMap, dataCard)}
    ${collectionSection('Security and threat register','Unresolved rights-critical threats block scope or deployment.','threats','add-threat', state.threats, threatCard)}
    ${collectionSection('Assisted and offline receipts','Least-linkable receipts record requests without civil identity, motive, location, or stable history.','receipts','add-receipt', state.receipts, receiptCard)}
    ${collectionSection('Default-off ecosystem bridge contracts','One direction, one purpose, one recipient class, separately ratified, revocable, expiring, and non-reciprocal.','bridgeContracts','add-bridge', state.bridgeContracts, bridgeCard)}
  `, 'Safeguards and institutional power', 'Rights, roles, data, threats, offline paths, and bridge boundaries');
}

function collectionSection(title, subtitle, key, action, collection, renderer) {
  return `<section class="section"><div class="section-head"><div><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></div><button class="btn primary" data-action="${action}">Add record</button></div><div class="grid ${collection.length > 1 ? 'two' : ''}">${collection.map(renderer).join('') || '<div class="empty">No records in this class.</div>'}</div></section>`;
}
function rightCard(item) { const v=validateRight(item); return `<article class="card"><div class="item-head"><h3>${esc(item.name)}</h3><span class="tag ${v.valid?'acid':'gold'}">${esc(v.state)}</span></div><p><strong>Duty:</strong> ${esc(item.mandate)}</p><p><strong>Roles:</strong> ${esc(item.responsibleRole)} / ${esc(item.backupRole)}</p><p><strong>Offline:</strong> ${esc(item.offlinePath)}</p><p><strong>Remedy:</strong> ${esc(item.remedy)}</p><div class="item-actions"><button class="btn small" data-action="edit-record" data-collection="rights" data-id="${esc(item.id)}">Edit</button></div></article>`; }
function roleCard(item) { return `<article class="card"><div class="item-head"><h3>${esc(item.name)}</h3><span class="tag cyan">${esc(item.status)}</span></div><p><strong>Scope:</strong> ${esc(item.scope)}</p><p><strong>May:</strong> ${esc(item.permitted)}</p><p><strong>May not:</strong> ${esc(item.prohibited)}</p><p><strong>Replacement:</strong> ${esc(item.replacementPath)}</p><div class="item-actions"><button class="btn small" data-action="edit-record" data-collection="roles" data-id="${esc(item.id)}">Edit</button></div></article>`; }
function procedureCard(item) { return `<article class="card"><div class="item-head"><h3>${esc(item.name)}</h3><span class="tag gold">${esc(item.status)}</span></div><p>${esc(item.purpose)}</p><p><strong>Power:</strong> ${esc(item.powerGained)}</p><p><strong>Offline/conflict:</strong> ${esc(item.offline)} · ${esc(item.conflict)}</p><p><strong>Unsuitable:</strong> ${esc(item.unsuitable)}</p><div class="item-actions"><button class="btn small" data-action="edit-record" data-collection="procedureCards" data-id="${esc(item.id)}">Edit</button></div></article>`; }
function dataCard(item) { return `<article class="card"><div class="item-head"><h3>${esc(item.recordClass)}</h3><span class="tag rose">${esc(item.audience)}</span></div><p><strong>Purpose:</strong> ${esc(item.purpose)}</p><p><strong>Fields:</strong> ${esc(item.fields)}</p><p><strong>Retention:</strong> ${esc(item.retention)}</p><p><strong>Linkage stop:</strong> ${esc(item.stopRule)}</p><div class="item-actions"><button class="btn small" data-action="edit-record" data-collection="dataMap" data-id="${esc(item.id)}">Edit</button></div></article>`; }
function threatCard(item) { return `<article class="card"><div class="item-head"><h3>${esc(item.title)}</h3><span class="tag ${item.disposition.includes('blocking')?'rose':'cyan'}">${esc(item.disposition)}</span></div><p><strong>Harm:</strong> ${esc(item.harm)}</p><p><strong>Protection:</strong> ${esc(item.protection)}</p><p><strong>Outcome:</strong> ${esc(item.outcome)}</p><p><strong>Residual:</strong> ${esc(item.residual)}</p><div class="item-actions"><button class="btn small" data-action="edit-record" data-collection="threats" data-id="${esc(item.id)}">Edit</button></div></article>`; }
function receiptCard(item) { return `<article class="card"><div class="item-head"><h3>${esc(item.requestType)}</h3><span class="tag">${esc(item.state)}</span></div><p class="mono">${esc(item.reference)}</p><p>${esc(item.note)}</p><p class="muted">No civil identity, reason, location, device, or stable cross-context identifier.</p><div class="item-actions"><button class="btn small" data-action="edit-record" data-collection="receipts" data-id="${esc(item.id)}">Edit</button></div></article>`; }
function bridgeCard(item) { const v=validateBridge(item); return `<article class="card"><div class="item-head"><h3>${esc(item.name)}</h3><span class="tag ${v.valid?'cyan':'rose'}">${esc(v.state)}</span></div><p><strong>${esc(item.direction)}</strong> · ${esc(item.purpose)}</p><p><strong>Fields:</strong> ${esc(item.fields)}</p><p><strong>Manual alternative:</strong> ${esc(item.manualAlternative)}</p>${v.flagged.length?`<div class="notice danger">Flagged: ${esc(v.flagged.join(', '))}</div>`:''}<div class="item-actions"><button class="btn small" data-action="edit-record" data-collection="bridgeContracts" data-id="${esc(item.id)}">Edit</button><button class="btn small ghost" data-action="open-ai" data-ai-task="bridge-review" data-ai-target="bridge" data-id="${esc(item.id)}">AI review</button></div></article>`; }

function exchangePage() {
  const classes = [
    ['admission','Admission card'],['charter','Charter and conflicts'],['decisions','Proposals and outcomes'],['dissent','Dissent'],['rights','Rights duties'],['roles','Roles and procedures'],['privacy-security','Data map and threats'],['receipts','Offline receipts'],['amendments','Amendments'],['bridges','Bridge contracts'],['readiness','Readiness and approval'],['audit','Audit history']
  ];
  return shell(`
    <section class="grid two">
      <article class="card accent">
        <div class="eyebrow">L1 manual exchange</div><h2>Selective bundle forge</h2>
        <p>Choose record classes independently. The bundle declares omissions, privacy marking, onward-export rule, replica uncertainty, conflicts, and a SHA-256 payload checksum.</p>
        <div class="gate-grid" id="export-classes">${classes.map(([id,label],index)=>`<label class="check-row"><input type="checkbox" value="${id}" ${index < 4 ? 'checked' : ''}> ${esc(label)}</label>`).join('')}</div>
        <div class="field-row" style="margin-top:.8rem"><label>Purpose<input id="export-purpose" value="Manual L1 file exchange and restore"></label><label>Audience<input id="export-audience" value="Authorized recipient selected by the community"></label></div>
        <label style="margin-top:.7rem">Onward-export rule<input id="export-onward" value="No onward export without a new community decision."></label>
        <div class="form-actions"><button class="btn primary" data-action="preview-export">Build preview</button><button class="btn" data-action="download-export" ${exchangePreview ? '' : 'disabled'}>Download JSON</button></div>
      </article>
      <article class="card">
        <div class="eyebrow">Restore and fork</div><h2>Keep conflicts visible</h2>
        <p>Imports verify bundle shape and checksum, then keep incompatible records side by side. They are never resolved by import order, connectivity, or operator preference.</p>
        <div class="form-actions"><button class="btn secondary" data-action="open-import">Import bundle</button><button class="btn" data-action="fork-workspace">Fork this workspace</button><button class="btn danger" data-action="exit-wipe">Export then exit</button></div>
        <div class="notice" style="margin-top:1rem">Forking creates a new local community reference while preserving the source reference as provenance. It does not transfer membership, authority, or identity.</div>
      </article>
    </section>
    <section class="section grid two">
      <article class="card"><div class="section-head"><div><h3>Bundle preview</h3><p>${exchangePreview ? 'Generated locally; not yet downloaded.' : 'Build a preview to inspect the manifest.'}</p></div></div>${exchangePreview ? `<pre class="ai-output">${esc(JSON.stringify(exchangePreview,null,2).slice(0,18000))}</pre>` : '<div class="empty">No preview.</div>'}</article>
      <article class="card"><div class="section-head"><div><h3>Import history</h3><p>Source references and conflict counts only.</p></div></div><div class="list">${state.imports.map(item=>`<article class="item"><h4>${esc(item.sourceCommunityRef)}</h4><p>${item.conflicts} conflicts preserved · ${esc(new Date(item.at).toLocaleString())}</p></article>`).join('') || '<div class="empty">No imports yet.</div>'}</div></article>
    </section>
    <section class="section card"><div class="section-head"><div><h2>Cerbanimo suite handoff</h2><p>Anarchadia exports declared constitutional artifacts. It sends no person-level work, need, care, motivation, private dissent, eligibility, or proof-of-worth.</p></div><button class="btn" data-action="download-integration">Download integration specimen</button></div><pre class="ai-output">${esc(JSON.stringify({type:'anarchadia.constitutional-artifact.v1',direction:'Anarchadia → Cerbanimo',purpose:'Inform Cerbanimo that a scoped, human-declared governance artifact exists; no automatic governance effect.',fields:['artifactRef','artifactKind','sourceCommunityScopedRef','declaredVersion','declaredStatus','conflictState','expiry','manualReviewRequired'],prohibited:['person identifiers','private dissent','motivation','work history','needs','eligibility','governance effect'],activation:'default-off bridge contract plus affected-human ratification'},null,2))}</pre></section>
  `, 'Exchange, restore, exit, and fork', 'Manual files are the first-class integration boundary');
}

function aiPage() {
  const config = getAiConfig();
  return shell(`
    <section class="grid two">
      <article class="card accent">
        <div style="display:flex;align-items:center;gap:.8rem"><img src="../../logos/anarchadia.webp" alt="Rook avatar" style="width:58px;height:58px;padding:5px;border:1px solid var(--line);border-radius:50%;background:#fff;object-fit:contain"><div><div class="eyebrow">Rook · advisory intelligence</div><h2>Give the machine a lantern.</h2></div></div><p>Rook can draft, compare, translate, scan omissions, generate threat questions, and propose structured records. Rook cannot apply changes, classify people, infer consent, certify legitimacy, or ratify anything.</p>
        <label>Provider<select id="ai-provider"><option value="deterministic" ${config.provider==='deterministic'?'selected':''}>Deterministic local constitutional linter</option><option value="suite-bridge" ${config.provider==='suite-bridge'?'selected':''}>Cerbanimo suite AI broker</option><option value="ollama" ${config.provider==='ollama'?'selected':''}>Ollama local or LAN model</option><option value="openai-compatible" ${config.provider==='openai-compatible'?'selected':''}>OpenAI-compatible local/API endpoint</option><option value="gemini" ${config.provider==='gemini'?'selected':''}>Gemini API</option></select></label>
        <div class="field-row" style="margin-top:.7rem"><label>Endpoint or base URL<input id="ai-endpoint" value="${esc(config.endpoint || '')}" maxlength="2048" placeholder="http://127.0.0.1:11434/v1"></label><label>Model<input id="ai-model" value="${esc(config.model || '')}" maxlength="200" placeholder="suite-default or local model"></label></div>
        <label style="margin-top:.7rem">Session-only API key<input id="ai-key" type="password" value="${esc(config.apiKey || '')}" maxlength="500" autocomplete="off" placeholder="Never written to IndexedDB"></label>
        <div class="check-row" style="margin-top:.7rem"><input type="checkbox" id="ai-consent" ${config.externalConsent?'checked':''}><span>I understand non-local providers transmit the selected context to that provider. No key or consent setting is persisted beyond this tab session.</span></div>
        <div class="form-actions"><button class="btn" data-action="save-ai-config">Use this session configuration</button></div>
      </article>
      <article class="card">
        <h3>Ask Rook</h3>
        <label>Task<select id="ai-task"><option value="rights-scan">Rights and power scan</option><option value="plain-language">Accessible short layer</option><option value="proposal-card">Proposal card draft</option><option value="threat-model">Threat register draft</option><option value="compare">Non-ranked comparison</option><option value="draft-section">Charter section draft</option><option value="freeform">Freeform constitutional assistance</option></select></label>
        <label style="margin-top:.7rem">Instruction<textarea id="ai-instruction" maxlength="12000" placeholder="Describe the section, proposal, alternatives, or question. The full workspace is not sent unless you choose that context below."></textarea></label>
        <label style="margin-top:.7rem">Context<select id="ai-context"><option value="instruction">Instruction only</option><option value="charter">Current charter</option><option value="admission">Admission card</option><option value="safeguards">Rights, roles, data map, and threats</option><option value="workspace">Entire local workspace</option></select></label>
        <div class="form-actions"><button class="btn primary" data-action="run-ai">Generate advisory draft</button></div>
      </article>
    </section>
    <section class="section card"><div class="section-head"><div><h2>Latest advisory draft</h2><p>Copy or deliberately apply text. Nothing here changes the record automatically.</p></div>${lastAiDraft ? '<button class="btn small" data-action="save-ai-draft">Preserve in local draft history</button>' : ''}</div>${lastAiDraft ? `<div class="tags"><span class="tag cyan">${esc(lastAiDraft.provider)}</span><span class="tag">${esc(lastAiDraft.model)}</span>${lastAiDraft.runtime?.streamed?'<span class="tag acid">streamed</span>':''}${lastAiDraft.runtime?.fallback?'<span class="tag gold">fallback</span>':''}<span class="tag rose">no authority</span></div><pre class="ai-output">${esc(lastAiDraft.text)}</pre><p class="disclaimer">${esc(lastAiDraft.disclaimer)}</p>` : '<div class="empty">No AI draft in this session.</div>'}</section>
    <section class="section"><div class="section-head"><div><h2>Preserved AI drafts</h2><p>Stored only when a person explicitly chooses to preserve them.</p></div></div><div class="list">${state.aiDrafts.map(d=>`<article class="item"><div class="item-head"><h4>${esc(d.task)}</h4><span class="tag">${esc(d.provider)}</span></div><p>${esc(d.text.slice(0,280))}${d.text.length>280?'…':''}</p><button class="btn small" data-action="view-ai-draft" data-id="${esc(d.id)}">Open</button></article>`).join('') || '<div class="empty">No preserved AI drafts.</div>'}</div></section>
  `, 'Rook · AI advisory', 'Drafting power without decision power');
}

function readinessPage() {
  const summary = readinessSummary(state);
  return shell(`
    <section class="grid two">
      <article class="card accent"><div class="eyebrow">Pilot gate</div><h2>${summary.percent}% recorded</h2><div class="progress"><span style="width:${summary.percent}%"></span></div><p>${esc(summary.pilotStatus)}</p><div class="notice ${summary.blockingThreats.length || summary.incompleteRights.length ? 'danger':'good'}">${summary.blockingThreats.length} unresolved blocking threats · ${summary.incompleteRights.length} incomplete rights cards</div></article>
      <article class="card"><h3>The stop rule</h3><p>${esc(state.admission.stopCondition)}</p><p class="disclaimer">Checking boxes records evidence supplied by humans. It does not prove that the evidence is true, sufficient, voluntary, or legitimate.</p></article>
    </section>
    <section class="section card"><div class="section-head"><div><h2>Readiness evidence</h2><p>Open each gate to add a note and evidence reference.</p></div></div><div class="gate-grid">${summary.entries.map(item=>`<label class="gate ${item.complete?'complete':''}"><input type="checkbox" data-action="toggle-gate" data-id="${esc(item.id)}" ${item.complete?'checked':''}><span><strong>${esc(item.label)}</strong><br><small>${esc(item.note || 'No note')}</small></span><button type="button" class="btn small" data-action="edit-gate" data-id="${esc(item.id)}">Evidence</button></label>`).join('')}</div></section>
    <section class="section grid two">
      <article class="card"><div class="section-head"><div><h2>Human procedural approval</h2><p>Required by the source constitution before proceeding beyond Article 01.</p></div><button class="btn small" data-action="edit-human-approval">Edit</button></div><dl><dt class="eyebrow">Reviewing people/body</dt><dd>${esc(state.humanApproval.reviewingPeople || 'Not provided')}</dd><dt class="eyebrow">Scope</dt><dd>${esc(state.humanApproval.scope || 'Not provided')}</dd><dt class="eyebrow">Dissent</dt><dd>${esc(state.humanApproval.dissent || 'Not provided')}</dd><dt class="eyebrow">Conditions</dt><dd>${esc(state.humanApproval.conditions || 'Not provided')}</dd></dl><button class="btn" data-action="download-human-approval">Download HUMAN_APPROVAL.md</button></article>
      <article class="card"><h2>Failure register</h2><div class="list">${summary.blockingThreats.map(t=>`<article class="item"><h4>${esc(t.title)}</h4><p>${esc(t.outcome)} · ${esc(t.disposition)}</p></article>`).join('') || '<div class="empty">No threat is currently marked blocking with an unpassed outcome.</div>'}${summary.incompleteRights.map(r=>`<article class="item"><h4>${esc(r.name)}</h4><p>${validateRight(r).missing.length} required duty fields are missing.</p></article>`).join('')}</div></article>
    </section>
  `, 'Readiness and no-build gate', 'A failed gate narrows or stops the pilot');
}

function constitutionPage() {
  return shell(`
    <section class="hero" style="padding:1.6rem"><div class="eyebrow">Source boundary</div><h2 style="font-size:clamp(2rem,4vw,3.5rem)">A constitution the app cannot crown.</h2><p>The source is a synthetically ratified provisional constitution. Its own first line says synthetic approval is not community ratification and authorizes no deployment or real-person governance. This MVP preserves that warning throughout the interface.</p><div class="hero-actions"><a class="btn primary" href="docs/PROVISIONAL_CONSTITUTION.md" download>Download source markdown</a><button class="btn" data-action="open-source">Read source</button></div></section>
    <section class="section article-grid">${ARTICLE_INDEX.map(item=>`<article class="card article-card"><div class="item-head"><span class="eyebrow">Article ${item.article}</span><span class="tag">frozen</span></div><h3>${esc(item.title)}</h3><p>${esc(item.principle)}</p><code>${esc(item.hash)}</code></article>`).join('')}</section>
  `, 'Provisional constitution', 'Frozen article hashes and implementation principles');
}

function render() {
  applySessionSettings();
  if (!state) { renderOnboarding(); return; }
  ensureImprovementState();
  ensureCivicState();
  const pages = {
    hall: hallPage,
    'proposal-commons': proposalCommonsPage,
    'bug-triage': bugTriagePage,
    'hub-commons': hubCommonsPage,
    federation: federationChamberPage,
    rails: railsEnginePage,
    forge: forgePage,
    ledger: ledgerPage,
    observatory: observatoryPage,
    workbench: workbenchPage,
    overview: overviewPage, charter: charterPage, proposals: proposalsPage, safeguards: safeguardsPage,
    exchange: exchangePage, ai: aiPage, readiness: readinessPage, constitution: constitutionPage
  };
  app.innerHTML = (pages[route()] || hallPage)();
  mountAnarchadiaWorldScene();
}

function openModal(title, bodyHtml, { onSubmit, submitLabel = 'Save', wide = false } = {}) {
  closeModal();
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop cardinal-projection';
  const sceneAsset=VISUAL_ASSETS[route()]||VISUAL_ASSETS.hall;
  backdrop.style.setProperty('--projection-scene',`url("assets/screens/${sceneAsset}-landscape.webp")`);
  backdrop.innerHTML = `<section class="modal ${wide?'wide':''}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="modal-head"><h2 id="modal-title">${esc(title)}</h2><button class="btn small ghost" data-close-modal aria-label="Close projection">×</button></header><div class="modal-body">${onSubmit ? `<form id="modal-form">${bodyHtml}<div class="form-actions"><button class="btn primary" type="submit">${esc(submitLabel)}</button><button class="btn" type="button" data-close-modal>Cancel</button></div></form>` : bodyHtml}</div></section>`;
  document.body.append(backdrop);
  const close = event => { if (event.target === backdrop || event.target.closest('[data-close-modal]')) closeModal(); };
  backdrop.addEventListener('click', close);
  const key = event => { if (event.key === 'Escape') closeModal(); };
  document.addEventListener('keydown', key);
  if (onSubmit) backdrop.querySelector('#modal-form').addEventListener('submit', async event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    event.currentTarget.querySelectorAll('input[type=checkbox]').forEach(box => data[box.name] = box.checked);
    await onSubmit(data);
  });
  modalCleanup = () => { document.removeEventListener('keydown', key); backdrop.remove(); modalCleanup = null; };
  setTimeout(() => backdrop.querySelector('input,textarea,select,button')?.focus(), 20);
}
function closeModal() { modalCleanup?.(); }

function fieldsHtml(fields, initial = {}) {
  return `<div class="grid two">${fields.map(field => {
    const value = initial[field.name] ?? field.default ?? '';
    if (field.type === 'textarea') return `<label style="grid-column:${field.full?'1/-1':'auto'}">${esc(field.label)}<textarea name="${field.name}" ${field.required?'required':''} placeholder="${esc(field.placeholder||'')}">${esc(value)}</textarea>${field.help?`<small class="muted">${esc(field.help)}</small>`:''}</label>`;
    if (field.type === 'select') return `<label>${esc(field.label)}<select name="${field.name}">${field.options.map(option=>{const [v,l]=Array.isArray(option)?option:[option,option];return `<option value="${esc(v)}" ${String(value)===String(v)?'selected':''}>${esc(l)}</option>`}).join('')}</select></label>`;
    if (field.type === 'checkbox') return `<label class="check-row" style="grid-column:${field.full?'1/-1':'auto'}"><input type="checkbox" name="${field.name}" ${value?'checked':''}> <span>${esc(field.label)}</span></label>`;
    return `<label style="grid-column:${field.full?'1/-1':'auto'}">${esc(field.label)}<input name="${field.name}" type="${field.type||'text'}" value="${esc(value)}" ${field.required?'required':''} placeholder="${esc(field.placeholder||'')}">${field.help?`<small class="muted">${esc(field.help)}</small>`:''}</label>`;
  }).join('')}</div>`;
}

const FORM_SCHEMAS = {
  rights: [
    ['name','Right name'],['responsibleRole','Responsible role'],['backupRole','Backup role'],['mandate','Bounded mandate','textarea'],['digitalPath','Digital invocation'],['offlinePath','Equal-effect offline/assisted invocation'],['responseDeadline','Response deadline'],['reviewDeadline','Review deadline'],['record','Least-revealing record','textarea'],['remedy','Remedy and restoration','textarea'],['replacementPath','Service/operator replacement path','textarea'],['expiry','Expiry'],['stopCondition','Versioned stop condition'],['fundedBy','Who funds the duty']
  ],
  roles: [
    ['name','Role name'],['status','State'],['scope','Scope','textarea'],['permitted','Permitted acts','textarea'],['prohibited','Prohibited acts','textarea'],['backupRole','Backup role'],['expiry','Expiry'],['recallPath','Recall path','textarea'],['replacementPath','Replacement path','textarea']
  ],
  procedureCards: [
    ['name','Procedure name'],['status','Status'],['purpose','Purpose','textarea'],['authorDefaults','Author and defaults'],['powerGained','Power gained','textarea'],['affectedExcluded','Affected/excluded people','textarea'],['initiation','Initiation'],['ruleThresholdTiming','Rule, threshold, timing','textarea'],['silenceAbstention','Silence and abstention','textarea'],['dissentAppeal','Dissent and appeal','textarea'],['expiryTermination','Expiry and termination'],['administratorPowers','Administrator/recorder powers','textarea'],['privacy','Privacy','textarea'],['offline','Offline initiation and inspection','textarea'],['conflict','Partition/conflict behavior','textarea'],['burdens','Labor and funding burdens','textarea'],['suitable','Suitable uses','textarea'],['unsuitable','Unsuitable uses','textarea']
  ],
  dataMap: [
    ['recordClass','Record class'],['purpose','Purpose','textarea'],['fields','Exact fields and metadata','textarea'],['source','Source'],['steward','Controller/steward'],['decisionAuthority','Decision authority'],['audience','Smallest audience'],['retention','Retention/expiry'],['correction','Correction'],['deletionLimits','Deletion limits','textarea'],['export','Export class'],['replicas','Replicas/backups','textarea'],['linkageRisk','Foreseeable linkage/re-identification','textarea'],['stopRule','Re-identification stop','textarea']
  ],
  threats: [
    ['title','Threat title'],['adversary','Adversary','textarea'],['harm','Harm','textarea'],['protection','Tested protection','textarea'],['testMethod','Method and threshold','textarea'],['outcome','Outcome'],['residual','Residual uncertainty','textarea'],['disposition','Disposition'],['monitoredFailure','Monitored failure'],['support','Institutional support','textarea'],['recovery','Recovery or abandonment','textarea'],['retestTrigger','Retest trigger']
  ],
  receipts: [
    ['requestType','Request type'],['state','Receipt state'],['receivingRole','Receiving role'],['ruleVersion','Rule version'],['contestStatus','Contest status'],['note','Minimized note','textarea']
  ],
  bridgeContracts: [
    ['name','Contract name'],['direction','One direction'],['purpose','One purpose','textarea'],['recipientClass','One recipient class'],['fields','Exact fields','textarea'],['metadata','Exact metadata','textarea'],['retention','Retention/deletion limits'],['expiry','Expiry'],['revocation','Revocation and correction','textarea'],['failureClosed','Failure-closed behavior','textarea'],['reidentificationRisk','Re-identification and onward-copy risk','textarea'],['manualAlternative','Observed no-bridge/manual alternative','textarea'],['enabled','Attempt live activation','checkbox']
  ]
};

function schemaFields(collection) {
  return FORM_SCHEMAS[collection].map(([name,label,type='text']) => ({ name,label,type,full:type==='textarea' }));
}

async function startBlank() {
  openModal('Create candidate draft', fieldsHtml([
    {name:'communityName',label:'Candidate community label',required:true},
    {name:'mode',label:'Workspace mode',type:'select',options:[['synthetic','Synthetic capability test'],['pilot-draft','Pilot draft, not authorized']]}
  ]), { onSubmit: async data => { state = emptyState(data); await saveWorkspace(state); closeModal(); location.hash='#hall'; render(); announce('Local workspace created.'); } });
}

function assertImportBudget(root) {
  const stack=[{value:root,depth:0}];
  let nodes=0;
  while(stack.length){
    const {value,depth}=stack.pop();
    nodes+=1;
    if(nodes>30000||depth>24)throw new Error('Bundle structure is too large or deeply nested.');
    if(typeof value==='string'&&value.length>250000)throw new Error('Bundle contains an oversized text value.');
    if(value&&typeof value==='object'){
      for(const [key,child] of Object.entries(value)){
        if(['__proto__','prototype','constructor'].includes(key))throw new Error('Bundle contains a forbidden field name.');
        stack.push({value:child,depth:depth+1});
      }
    }
  }
}

async function handleImport(file) {
  try {
    if(file.size>5_000_000)throw new Error('Bundles are limited to 5 MB.');
    const bundle = JSON.parse(await file.text());
    assertImportBudget(bundle);
    const shape = validateBundle(bundle);
    if (!shape.valid) throw new Error(shape.errors.join(' '));
    const hash = await verifyBundleHash(bundle);
    if (!hash.valid) throw new Error(`Checksum mismatch. Expected ${hash.expected}, calculated ${hash.actual}.`);
    if (!state) {
      const fallback = emptyState({ communityName: bundle.source.communityName, mode: bundle.source.mode });
      state = bundleToImportState(bundle, fallback);
      state.audit = state.audit || [];
      touch(state, 'workspace.restored', { bundleRef: bundle.bundleRef });
      await saveWorkspace(state);
      location.hash='#hall'; render(); announce('Bundle restored locally.');
      return;
    }
    const incoming = {
      meta: {
        communityRef: bundle.source.communityRef,
        communityName: bundle.source.communityName,
        mode: bundle.source.mode,
        syntheticOnly: Boolean(bundle.source.syntheticOnly),
        importedFromBundle: bundle.bundleRef
      },
      ...deepClone(bundle.payload)
    };
    const result = mergeImportedState(state, incoming);
    state = result.merged;
    await saveWorkspace(state);
    render();
    announce(`Bundle imported. ${result.conflicts.length} contested conflicts preserved.`, result.conflicts.length ? 'warn' : 'good');
  } catch (error) { announce(error.message, 'danger'); }
}

let aiConfigMemory={provider:'deterministic'};
try{
  sessionStorage.removeItem('anarchadia-ai-config');
  const shared=window.CommonweaveModelRuntime?.readSharedConfig?.();
  if(shared){
    const providerMap={deterministic:'deterministic',hosted:'suite-bridge',gemini:'gemini','openai-compatible':'openai-compatible',ollama:'ollama',browser:'deterministic',manual:'deterministic'};
    aiConfigMemory={
      provider:providerMap[shared.provider]||'deterministic',
      model:shared.model||'local-constitutional-linter',
      endpoint:shared.endpoint||'',
      baseUrl:shared.endpoint||'',
      apiKey:shared.apiKey||'',
      externalConsent:Boolean(shared.externalConsent),
      commonweaveManaged:true
    };
  }
}catch{}
function getAiConfig() { return {...aiConfigMemory}; }
function contextFor(target, id) {
  if (target === 'charter') return state.charter;
  if (target === 'section') return findCharterSection(id);
  if (target === 'proposal') return find('proposals',id);
  if (target === 'bridge') return find('bridgeContracts',id);
  if (target === 'admission') return state.admission;
  if (target === 'safeguards') return {rights:state.rights,roles:state.roles,dataMap:state.dataMap,threats:state.threats};
  return state;
}
function findCharterSection(id) { return state.charter.sections.find(section=>section.id===id); }

async function invokeAi(task, context, instruction='') {
  const config = getAiConfig();
  try {
    lastAiDraft = await runAssistant({task,context,instruction,config});
    location.hash='#ai'; render(); announce('Advisory draft generated. No records were changed.');
  } catch (error) { announce(`AI failed: ${error.message}`, 'danger'); }
}

function openAiModal(task='rights-scan', target='workspace', id='') {
  openModal('AI advisory draft', fieldsHtml([
    {name:'instruction',label:'Instruction',type:'textarea',full:true,placeholder:'What should the assistant inspect or draft?'},
    {name:'task',label:'Task',type:'select',default:task,options:['rights-scan','plain-language','proposal-card','threat-model','compare','draft-section','bridge-review','exact-diff-review','freeform']}
  ]), { submitLabel:'Generate advisory draft', onSubmit: async data => { closeModal(); await invokeAi(data.task, contextFor(target,id), data.instruction); } });
}

function openAdmission() {
  const fields = [
    {name:'namedJourney',label:'Named bounded journey',type:'textarea',full:true},{name:'actualBottleneck',label:'Observed bottleneck',type:'textarea',full:true},
    {name:'affectedPeople',label:'Affected people',type:'textarea',full:true},{name:'comparator',label:'Existing-tool, paper, or no-software comparator',type:'textarea',full:true},
    {name:'whySoftware',label:'Specific lower-burden failure software may address',type:'textarea',full:true},{name:'noBuildPath',label:'No-build path',type:'textarea',full:true},
    {name:'stopCondition',label:'Stop or narrowing condition',type:'textarea',full:true}
  ];
  openModal('Candidate journey admission card', fieldsHtml(fields,state.admission), {onSubmit: async data=>{state.admission=data; closeModal(); await persist('admission.updated');}});
}

function sectionForm(section={}) {
  openModal(section.id?'Edit charter section':'Add charter section', fieldsHtml([
    {name:'title',label:'Section title',required:true},{name:'order',label:'Order',type:'number',default:state.charter.sections.length+1},
    {name:'text',label:'Controlling text',type:'textarea',full:true,required:true}
  ],section), {onSubmit: async data=>{
    const record={...section,...data,order:Number(data.order),id:section.id||uid('section')};
    if(section.id) state.charter.sections=state.charter.sections.map(item=>item.id===section.id?record:item); else state.charter.sections.push(record);
    closeModal(); await persist(section.id?'charter.section.updated':'charter.section.added',{sectionId:record.id});
  }});
}

function proposalForm(proposal={}) {
  const classification = proposal.id ? classifyProposal(proposal) : null;
  const fields=[
    {name:'title',label:'Proposal title',required:true},{name:'status',label:'State',type:'select',options:['proposed','petitioning','classification-contested','deliberating','voting','outcome recorded','expired','withdrawn','superseded']},
    {name:'purpose',label:'Bounded purpose',type:'textarea',full:true,required:true},{name:'affectedPeople',label:'Affected, excluded, and absent people',type:'textarea',full:true},
    {name:'procedure',label:'Community-declared procedure',type:'textarea',full:true},{name:'threshold',label:'Declared threshold/timing'},
    {name:'silenceAbstention',label:'Silence and abstention',type:'textarea',full:true},{name:'dissentPath',label:'Dissent and appeal',type:'textarea',full:true},
    {name:'reconsideration',label:'Reconsideration condition',type:'textarea',full:true},{name:'offlinePath',label:'Equal-effect offline/assisted path',type:'textarea',full:true},
    {name:'expiry',label:'Locally knowable expiry'},{name:'noSoftwareAlternative',label:'No-software alternative',type:'textarea',full:true},
    {name:'laborFunding',label:'Labor, accessibility, care, and funding',type:'textarea',full:true},
    {name:'createsAuthority',label:'May create or transfer authority',type:'checkbox'},{name:'affectsRights',label:'May affect rights or necessities',type:'checkbox'},
    {name:'usesPrivateChoice',label:'Uses private choice',type:'checkbox'},{name:'bindsNonparticipants',label:'May bind nonparticipants',type:'checkbox'}
  ];
  openModal(proposal.id?`Edit proposal · ${classification.level}`:'Create non-certifying proposal record', fieldsHtml(fields,proposal), {onSubmit:async data=>{
    const record={...proposal,...data,id:proposal.id||uid('proposal'),createdAt:proposal.createdAt||nowIso()};
    if(proposal.id) state.proposals=state.proposals.map(item=>item.id===proposal.id?record:item); else state.proposals.unshift(record);
    closeModal(); await persist(proposal.id?'proposal.updated':'proposal.created',{proposalId:record.id,classification:classifyProposal(record).level});
  }});
}

function outcomeForm(proposal) {
  openModal('Record declared outcome', fieldsHtml([
    {name:'outcome',label:'Declared outcome',type:'select',options:['adopted as declared','rejected as declared','deferred','withdrawn','no outcome declared','records conflict']},
    {name:'statement',label:'Exact community-provided outcome statement',type:'textarea',full:true,required:true},
    {name:'procedureVersion',label:'Procedure/version used'},{name:'decidingRoles',label:'Initiating and deciding roles'},
    {name:'reconsideration',label:'Amendment/reconsideration condition',type:'textarea',full:true},{name:'contested',label:'Outcome is contested',type:'checkbox'}
  ]), {onSubmit:async data=>{
    const record={...data,id:uid('outcome'),proposalId:proposal.id,at:nowIso(),disclaimer:'Declared outcome only; not software-certified.'};
    state.outcomes.unshift(record); closeModal(); await persist('outcome.declared',{outcomeId:record.id,proposalId:proposal.id});
    if(record.outcome==='adopted as declared'&&window.parent!==window){
      window.parent.postMessage({
        type:'commonweave:handoff',
        source:'anarchadia',
        target:'cerbanimo',
        kind:'quest-board',
        title:`Community quest board · ${proposal.title}`,
        payload:{
          schema:'commonweave.quest-board-handoff.v1',
          proposal:{id:proposal.id,title:proposal.title,purpose:proposal.purpose},
          outcome:record,
          automaticEffect:false,
          manualReviewRequired:true,
          authorityDisclaimer:'This is a community-declared outcome record. Commonweave does not certify ratification or authority.'
        }
      },location.origin);
    }
  }});
}

function dissentForm(targetType,targetId) {
  openModal('Preserve voluntary dissent', fieldsHtml([
    {name:'title',label:'Optional title'},{name:'text',label:'Dissent or unresolved objection',type:'textarea',full:true,required:true},
    {name:'disclosure',label:'Dissenter-chosen disclosure',type:'select',options:['private local record','anonymous summary','attributed full text','withheld pending safe review']},
    {name:'conditions',label:'Correction, withdrawal, or later disclosure conditions',type:'textarea',full:true}
  ]), {onSubmit:async data=>{const record={...data,id:uid('dissent'),targetType,targetId,at:nowIso()};state.dissents.unshift(record);closeModal();await persist('dissent.preserved',{dissentId:record.id,targetType,targetId});}});
}

function recordForm(collection, initial={}) {
  openModal(initial.id?`Edit ${collection} record`:`Add ${collection} record`, fieldsHtml(schemaFields(collection),initial), {onSubmit:async data=>{
    const record={...initial,...data,id:initial.id||uid(collection.slice(0,-1)||'record')};
    if(collection==='receipts') record.reference=initial.reference||uid('act');
    if(initial.id) state[collection]=state[collection].map(item=>item.id===initial.id?record:item); else state[collection].unshift(record);
    closeModal(); await persist(initial.id?`${collection}.updated`:`${collection}.added`,{recordId:record.id});
  }});
}



async function setPetitionSignal(proposalId, signal) {
  ensureCivicState();
  const proposal = find('proposals', proposalId);
  if (!proposal || !['support','concern'].includes(signal)) return;
  const sourceRef = `local:${state.meta.communityRef}`;
  const existing = state.civicSystem.petitionSignals.find(item => item.proposalId === proposalId && item.sourceRef === sourceRef);
  const removed = existing?.signal === signal;
  if (removed) state.civicSystem.petitionSignals = state.civicSystem.petitionSignals.filter(item => item.id !== existing.id);
  else if (existing) { existing.signal = signal; existing.updatedAt = nowIso(); }
  else state.civicSystem.petitionSignals.push({id:uid('petition'),proposalId,signal,sourceRef,label:'Local participant signal',createdAt:nowIso()});
  if (!removed && proposal.status === 'proposed') proposal.status = 'petitioning';
  const boardOpen = Boolean(document.querySelector('.modal-backdrop'));
  await persist('proposal.petition-signal.updated',{proposalId,signal,removed});
  if (boardOpen) openPetitionBoard();
  announce(removed ? 'Local petition signal removed.' : `Local ${signal} signal recorded. It is not proof of consent or legitimacy.`);
}

async function advanceProposalStatus(proposalId) {
  const proposal = find('proposals', proposalId);
  if (!proposal) return;
  const current = PROPOSAL_STAGES.includes(proposal.status) ? proposal.status : 'proposed';
  const index = PROPOSAL_STAGES.indexOf(current);
  if (index >= PROPOSAL_STAGES.length - 3) { announce('Terminal states must be changed deliberately in the proposal editor.','warn'); return; }
  proposal.status = PROPOSAL_STAGES[index + 1];
  const boardOpen = Boolean(document.querySelector('.modal-backdrop'));
  await persist('proposal.stage.advanced',{proposalId,status:proposal.status});
  if (boardOpen) openPetitionBoard();
  announce(`Proposal moved to ${proposal.status}. This records workflow state only.`);
}

function openPetitionBoard() {
  ensureCivicState();
  const rows = state.proposals.map(proposal => {
    const summary = petitionSummary(proposal.id);
    return `<article class="item"><div class="item-head"><div><h3>${esc(proposal.title)}</h3><div class="tags"><span class="tag">${esc(proposal.status || 'proposed')}</span><span class="tag cyan">${summary.support} support</span><span class="tag gold">${summary.concern} concerns</span></div></div></div><p>${esc(proposal.purpose || '')}</p>${petitionControls(proposal)}</article>`;
  }).join('') || '<div class="empty">No proposal records are available to petition.</div>';
  openModal('Petitions and support signals', `<div class="notice">Signals are operational indicators. They do not prove identity, consent, quorum, legitimacy, or ratification.</div><div class="list civic-stack">${rows}</div><div class="form-actions"><button class="btn primary" data-action="add-proposal">Create proposal</button></div>`, {wide:true});
}

function discussionForm(proposalId) {
  const proposal = find('proposals', proposalId);
  if (!proposal) return;
  openModal(`Discuss · ${proposal.title}`, fieldsHtml([
    {name:'authorLabel',label:'Name or pseudonym',default:'Local participant'},
    {name:'stance',label:'Contribution type',type:'select',options:['question','support','concern','amendment suggestion','implementation note']},
    {name:'text',label:'Discussion note',type:'textarea',full:true,required:true}
  ]), {submitLabel:'Add discussion note',onSubmit:async data=>{
    ensureCivicState();
    const record={...data,id:uid('discussion'),proposalId,createdAt:nowIso(),disclaimer:'Deliberation note only; not a vote or authority claim.'};
    state.civicSystem.discussions.push(record);
    if (proposal.status === 'proposed' || proposal.status === 'petitioning') proposal.status = 'deliberating';
    closeModal(); await persist('proposal.discussion.added',{proposalId,discussionId:record.id,stance:record.stance});
    announce('Discussion note preserved with the proposal.');
  }});
}

function openDiscussionBoard(proposalId='') {
  ensureCivicState();
  const proposals = proposalId ? state.proposals.filter(item=>item.id===proposalId) : state.proposals;
  const rows = proposals.map(proposal => {
    const notes = state.civicSystem.discussions.filter(item=>item.proposalId===proposal.id).slice().reverse();
    return `<article class="card"><div class="item-head"><div><span class="tag">${esc(proposal.status || 'proposed')}</span><h3>${esc(proposal.title)}</h3></div><button class="btn small primary" data-action="add-discussion" data-id="${esc(proposal.id)}">Add note</button></div><div class="discussion-list">${notes.map(note=>`<div class="discussion-entry"><div class="item-head"><strong>${esc(note.authorLabel || 'Participant')}</strong><span class="tag">${esc(note.stance)}</span></div><p>${nl2br(note.text)}</p><small>${esc(new Date(note.createdAt).toLocaleString())}</small></div>`).join('') || '<div class="empty">No discussion notes yet.</div>'}</div></article>`;
  }).join('') || '<div class="empty">Create a proposal before opening deliberation.</div>';
  openModal('Proposal discussion chamber', `<div class="notice">Discussion notes are visible records. Private or sensitive deliberation should use a participant-chosen protected path.</div><div class="grid two civic-stack">${rows}</div>`, {wide:true});
}

function workgroupForm(initial={}) {
  openModal(initial.id?'Edit workgroup':'Create bounded workgroup', fieldsHtml([
    {name:'name',label:'Workgroup name',required:true},{name:'status',label:'Status',type:'select',options:['forming','active','paused','completed','dissolved'],default:'forming'},
    {name:'purpose',label:'Bounded purpose',type:'textarea',full:true,required:true},{name:'facilitator',label:'Facilitator or contact role'},
    {name:'scope',label:'Scope and exclusions',type:'textarea',full:true},{name:'nextAction',label:'Next visible action',type:'textarea',full:true}
  ],initial), {onSubmit:async data=>{
    ensureCivicState(); const record={...initial,...data,id:initial.id||uid('workgroup'),createdAt:initial.createdAt||nowIso(),updatedAt:nowIso()};
    if(initial.id) state.civicSystem.workgroups=state.civicSystem.workgroups.map(item=>item.id===initial.id?record:item); else state.civicSystem.workgroups.unshift(record);
    closeModal(); await persist(initial.id?'workgroup.updated':'workgroup.created',{workgroupId:record.id,status:record.status}); announce('Workgroup record saved.');
  }});
}

function openWorkgroups() {
  ensureCivicState();
  const rows=state.civicSystem.workgroups.map(item=>`<article class="item"><div class="item-head"><div><span class="tag ${item.status==='active'?'acid':''}">${esc(item.status)}</span><h3>${esc(item.name)}</h3></div><button class="btn small" data-action="edit-workgroup" data-id="${esc(item.id)}">Edit</button></div><p>${esc(item.purpose)}</p><p><strong>Scope:</strong> ${esc(item.scope||'Not declared')}</p><p><strong>Next:</strong> ${esc(item.nextAction||'No next action recorded')}</p></article>`).join('')||'<div class="empty">No workgroups have been recorded.</div>';
  openModal('Commons workgroups', `<div class="notice">Workgroups coordinate work. They gain no undeclared authority and remain recallable through the community’s procedures.</div><div class="list civic-stack">${rows}</div><div class="form-actions"><button class="btn primary" data-action="add-workgroup">Create workgroup</button><a class="btn" href="#safeguards" data-close-modal>Inspect roles and duties</a></div>`,{wide:true});
}

function bulletinForm(initial={}) {
  openModal(initial.id?'Edit bulletin':'Post commons bulletin',fieldsHtml([
    {name:'title',label:'Bulletin title',required:true},{name:'category',label:'Category',type:'select',options:['announcement','event','help wanted','mutual aid','meeting','documentation']},
    {name:'body',label:'Notice',type:'textarea',full:true,required:true},{name:'expiresAt',label:'Expiry date',type:'date'}
  ],initial),{onSubmit:async data=>{
    ensureCivicState(); const record={...initial,...data,id:initial.id||uid('bulletin'),createdAt:initial.createdAt||nowIso(),updatedAt:nowIso()};
    if(initial.id) state.civicSystem.bulletins=state.civicSystem.bulletins.map(item=>item.id===initial.id?record:item); else state.civicSystem.bulletins.unshift(record);
    closeModal();await persist(initial.id?'bulletin.updated':'bulletin.posted',{bulletinId:record.id,category:record.category});announce('Commons bulletin posted locally.');
  }});
}

function openBulletins() {
  ensureCivicState(); const today=new Date().toISOString().slice(0,10);
  const rows=state.civicSystem.bulletins.map(item=>`<article class="item"><div class="item-head"><div><span class="tag">${esc(item.category)}</span><h3>${esc(item.title)}</h3></div><button class="btn small" data-action="edit-bulletin" data-id="${esc(item.id)}">Edit</button></div><p>${nl2br(item.body)}</p><small>${item.expiresAt?`Expires ${esc(item.expiresAt)}${item.expiresAt<today?' · expired':''}`:'No expiry declared'}</small></article>`).join('')||'<div class="empty">No commons bulletins are posted.</div>';
  openModal('Commons bulletins', `<div class="notice">Bulletins announce activity. They do not infer attendance, consent, consensus, or obligation.</div><div class="list civic-stack">${rows}</div><div class="form-actions"><button class="btn primary" data-action="add-bulletin">Post bulletin</button></div>`,{wide:true});
}

function federationMessageForm(initial={}) {
  const bridgeOptions=[['','No bridge linked'],...state.bridgeContracts.map(item=>[item.id,item.name||item.direction||item.id])];
  openModal(initial.id?'Edit federation message':'Draft bounded federation message',fieldsHtml([
    {name:'recipientHub',label:'Recipient hub label',required:true},{name:'subject',label:'Subject',required:true},
    {name:'bridgeId',label:'Linked treaty / bridge',type:'select',options:bridgeOptions},{name:'status',label:'Delivery claim',type:'select',options:['draft','declared sent','acknowledged','withdrawn'],default:'draft'},
    {name:'body',label:'Bounded message',type:'textarea',full:true,required:true}
  ],initial),{onSubmit:async data=>{
    ensureCivicState(); const record={...initial,...data,id:initial.id||uid('fedmsg'),createdAt:initial.createdAt||nowIso(),updatedAt:nowIso(),automaticEffect:false};
    if(initial.id)state.civicSystem.federationMessages=state.civicSystem.federationMessages.map(item=>item.id===initial.id?record:item);else state.civicSystem.federationMessages.unshift(record);
    closeModal();await persist(initial.id?'federation.message.updated':'federation.message.created',{messageId:record.id,status:record.status});announce('Federation message record saved. No transport or adoption was inferred.');
  }});
}

function openFederationMessages() {
  ensureCivicState(); const rows=state.civicSystem.federationMessages.map(item=>`<article class="item"><div class="item-head"><div><span class="tag">${esc(item.status)}</span><h3>${esc(item.subject)}</h3></div><button class="btn small" data-action="edit-federation-message" data-id="${esc(item.id)}">Edit</button></div><p><strong>To:</strong> ${esc(item.recipientHub)}</p><p>${nl2br(item.body)}</p><small>${item.bridgeId?`Bridge ${esc(item.bridgeId)}`:'No bridge linked'}</small></article>`).join('')||'<div class="empty">No bounded federation messages are recorded.</div>';
  openModal('Federation messages',`<div class="notice">A “sent” status is a local declaration unless a signed transport receipt is attached elsewhere. Messages cannot adopt amendments automatically.</div><div class="list civic-stack">${rows}</div><div class="form-actions"><button class="btn primary" data-action="add-federation-message">Draft message</button></div>`,{wide:true});
}

function adoptionSignalForm(initial={}) {
  openModal(initial.id?'Edit adoption signal':'Record hub adoption signal',fieldsHtml([
    {name:'hubLabel',label:'Hub label',required:true},{name:'artifactRef',label:'Proposal, amendment, or bundle reference',required:true},
    {name:'status',label:'Scoped response',type:'select',options:['proposed','under review','adopted in scope','declined','reconsidering','superseded']},
    {name:'scope',label:'Exact adopted or reviewed scope',type:'textarea',full:true,required:true},{name:'conditions',label:'Conditions, expiry, or rollback path',type:'textarea',full:true}
  ],initial),{onSubmit:async data=>{
    ensureCivicState();const record={...initial,...data,id:initial.id||uid('adoption'),createdAt:initial.createdAt||nowIso(),updatedAt:nowIso(),automaticEffect:false};
    if(initial.id)state.civicSystem.adoptionSignals=state.civicSystem.adoptionSignals.map(item=>item.id===initial.id?record:item);else state.civicSystem.adoptionSignals.unshift(record);
    closeModal();await persist(initial.id?'federation.adoption.updated':'federation.adoption.recorded',{signalId:record.id,status:record.status});announce('Scoped adoption signal recorded.');
  }});
}

function openAdoptionSignals() {
  ensureCivicState();const rows=state.civicSystem.adoptionSignals.map(item=>`<article class="item"><div class="item-head"><div><span class="tag acid">${esc(item.status)}</span><h3>${esc(item.hubLabel)}</h3></div><button class="btn small" data-action="edit-adoption-signal" data-id="${esc(item.id)}">Edit</button></div><p><strong>Artifact:</strong> ${esc(item.artifactRef)}</p><p>${esc(item.scope)}</p><small>${esc(item.conditions||'No conditions recorded')}</small></article>`).join('')||'<div class="empty">No hub adoption signals are recorded.</div>';
  openModal('Federation adoption signals',`<div class="notice">These are hub-scoped declarations. They do not bind other hubs, certify authority, or become operative merely by import.</div><div class="list civic-stack">${rows}</div><div class="form-actions"><button class="btn primary" data-action="add-adoption-signal">Record signal</button></div>`,{wide:true});
}

function experimentForm(initial={}) {
  openModal(initial.id?'Edit Forge experiment':'Plan Forge experiment',fieldsHtml([
    {name:'title',label:'Experiment title',required:true},{name:'status',label:'Status',type:'select',options:['planned','running','passed','failed','inconclusive','abandoned'],default:'planned'},
    {name:'hypothesis',label:'Hypothesis',type:'textarea',full:true,required:true},{name:'method',label:'Method and affected environment',type:'textarea',full:true,required:true},
    {name:'successCriteria',label:'Observable success criteria',type:'textarea',full:true,required:true},{name:'result',label:'Result and residual uncertainty',type:'textarea',full:true}
  ],initial),{onSubmit:async data=>{
    ensureCivicState();const record={...initial,...data,id:initial.id||uid('experiment'),createdAt:initial.createdAt||nowIso(),updatedAt:nowIso()};
    if(initial.id)state.civicSystem.experiments=state.civicSystem.experiments.map(item=>item.id===initial.id?record:item);else state.civicSystem.experiments.unshift(record);
    closeModal();await persist(initial.id?'forge.experiment.updated':'forge.experiment.created',{experimentId:record.id,status:record.status});announce('Forge experiment record saved.');
  }});
}

function openExperiments() {
  ensureCivicState();const rows=state.civicSystem.experiments.map(item=>`<article class="item"><div class="item-head"><div><span class="tag ${item.status==='passed'?'acid':item.status==='failed'?'rose':'gold'}">${esc(item.status)}</span><h3>${esc(item.title)}</h3></div><button class="btn small" data-action="edit-experiment" data-id="${esc(item.id)}">Edit</button></div><p><strong>Hypothesis:</strong> ${esc(item.hypothesis)}</p><p><strong>Criteria:</strong> ${esc(item.successCriteria)}</p><p><strong>Result:</strong> ${esc(item.result||'Not recorded')}</p></article>`).join('')||'<div class="empty">No simulations or tests have been recorded.</div>';
  openModal('Forge simulations and tests',`<div class="notice">Experiments produce evidence, not automatic deployment permission.</div><div class="list civic-stack">${rows}</div><div class="form-actions"><button class="btn primary" data-action="add-experiment">Plan experiment</button><button class="btn" data-action="run-rail-check">Run rail conformance</button></div>`,{wide:true});
}

function rollbackForm(versionId) {
  const version=state.charter.versions.find(item=>item.id===versionId);
  if(!version)return;
  openModal(`Draft rollback to charter v${version.version}`,fieldsHtml([
    {name:'rationale',label:'Why a rollback is proposed',type:'textarea',full:true,required:true},
    {name:'affectedPeople',label:'Affected people and relied-upon decisions',type:'textarea',full:true,required:true},
    {name:'residualEffects',label:'Effects that cannot be undone',type:'textarea',full:true,required:true},
    {name:'reviewPath',label:'Review, dissent, and restoration path',type:'textarea',full:true,required:true}
  ]),{submitLabel:'Create rollback proposal',onSubmit:async data=>{
    ensureCivicState();
    const rollback={...data,id:uid('rollback'),versionId,version:version.version,status:'proposal draft',createdAt:nowIso()};
    const proposal={id:uid('proposal'),title:`Rollback charter to version ${version.version}`,status:'proposed',purpose:data.rationale,affectedPeople:data.affectedPeople,procedure:'Append-only rollback proposal. Preserve the current version, exact predecessor, dissent, and downstream effects.',threshold:'Community-declared review required.',silenceAbstention:'Silence is not consent.',dissentPath:data.reviewPath,reconsideration:'Reopen when affected people or restoration evidence changes.',offlinePath:'Provide the compared snapshots in readable file or paper form.',expiry:'No automatic expiry declared.',noSoftwareAlternative:'Continue the current charter while people review the rollback.',laborFunding:'Name restoration, communication, accessibility, and repair labor before adoption.',createsAuthority:false,affectsRights:true,usesPrivateChoice:false,bindsNonparticipants:false,rollbackRef:rollback.id,createdAt:rollback.createdAt};
    rollback.proposalId=proposal.id;state.civicSystem.rollbacks.unshift(rollback);state.proposals.unshift(proposal);
    closeModal();await persist('charter.rollback.proposed',{rollbackId:rollback.id,proposalId:proposal.id,version:version.version});announce('Rollback proposal created. No charter text was erased or restored automatically.');
  }});
}

function openRollbackBoard() {
  ensureCivicState();const versions=state.charter.versions.map(item=>`<article class="item"><div class="item-head"><div><span class="tag">v${esc(item.version)}</span><h3>${esc(item.summary||'Charter snapshot')}</h3></div><button class="btn small primary" data-action="propose-rollback" data-id="${esc(item.id)}">Draft rollback</button></div><p>${esc(new Date(item.at).toLocaleString())}</p></article>`).join('')||'<div class="empty">Commit at least one charter version before drafting a rollback.</div>';
  const records=state.civicSystem.rollbacks.map(item=>`<article class="item"><div class="item-head"><h3>Rollback toward v${esc(item.version)}</h3><span class="tag gold">${esc(item.status)}</span></div><p>${esc(item.rationale)}</p><small>Proposal ${esc(item.proposalId)}</small></article>`).join('');
  openModal('Append-only rollback board',`<div class="notice danger">Rollback never deletes the current record. It creates a new proposal that must preserve dissent, relied-upon effects, and residual harm.</div><h3>Available snapshots</h3><div class="list civic-stack">${versions}</div>${records?`<h3>Rollback proposals</h3><div class="list civic-stack">${records}</div>`:''}`,{wide:true});
}

async function dismissCivicAlert(id) {
  ensureCivicState();if(!state.civicSystem.dismissedAlerts.includes(id))state.civicSystem.dismissedAlerts.push(id);
  const centerOpen=Boolean(document.querySelector('.modal-backdrop'));await persist('observatory.alert.dismissed',{alertId:id});if(centerOpen)openAlertCenter();announce('Local alert reminder dismissed. The underlying record was not changed.');
}

function openAlertCenter() {
  const alerts=derivedCivicAlerts();
  const rows=alerts.map(item=>`<article class="item"><div class="item-head"><div><span class="tag ${item.tone==='danger'?'rose':'gold'}">${esc(item.tone)}</span><h3>${esc(item.title)}</h3></div><button class="btn small ghost" data-action="dismiss-alert" data-id="${esc(item.id)}">Dismiss reminder</button></div><p>${esc(item.detail)}</p><a class="btn small" href="${esc(item.href)}" data-close-modal>Open source record</a></article>`).join('')||'<div class="empty">No undismissed system alerts are currently derived.</div>';
  openModal('Observatory alert center',`<div class="notice">Alerts are local diagnostic reminders. Dismissing one never resolves or deletes the underlying record.</div><div class="list civic-stack">${rows}</div>`,{wide:true});
}

function bugForm(initial={}) {
  openModal(initial.id ? 'Edit bug report' : 'File bug report', fieldsHtml([
    {name:'title',label:'Short issue title',required:true},
    {name:'severity',label:'Severity',type:'select',options:['low','medium','high','critical'],default:'medium'},
    {name:'environment',label:'Environment / device / browser'},
    {name:'steps',label:'Steps to reproduce',type:'textarea',full:true,required:true},
    {name:'expected',label:'Expected behavior',type:'textarea',full:true},
    {name:'actual',label:'Actual behavior',type:'textarea',full:true,required:true}
  ], initial), {onSubmit:async data=>{
    ensureImprovementState();
    const record={...initial,...data,id:initial.id||uid('bug'),status:initial.status||'triage',createdAt:initial.createdAt||nowIso(),updatedAt:nowIso()};
    if(initial.id) state.improvementSystem.bugs=state.improvementSystem.bugs.map(item=>item.id===initial.id?record:item);
    else state.improvementSystem.bugs.unshift(record);
    closeModal();
    await persist(initial.id?'bug.updated':'bug.reported',{bugId:record.id,severity:record.severity});
    announce(initial.id?'Bug report updated.':'Bug entered the triage queue.');
  }});
}

async function advanceBug(id) {
  ensureImprovementState();
  const bug=state.improvementSystem.bugs.find(item=>item.id===id);
  if(!bug) return;
  const stages=['triage','in progress','review','qa','ready to ship','resolved'];
  const next=stages[Math.min(stages.length-1,Math.max(0,stages.indexOf(bug.status))+1)];
  bug.status=next; bug.updatedAt=nowIso();
  await persist('bug.pipeline.advanced',{bugId:id,status:next});
  announce(`Bug moved to ${next}.`);
}

async function resolveBug(id) {
  ensureImprovementState();
  const bug=state.improvementSystem.bugs.find(item=>item.id===id);
  if(!bug) return;
  bug.status='resolved'; bug.resolvedAt=nowIso(); bug.updatedAt=bug.resolvedAt;
  await persist('bug.resolved',{bugId:id});
  announce('Bug marked resolved. The record remains in the ledger.');
}

function forgeImprovementForm() {
  openModal('Forge an improvement candidate', fieldsHtml([
    {name:'title',label:'Improvement title',required:true},
    {name:'problem',label:'Observed problem or missing capability',type:'textarea',full:true,required:true},
    {name:'outcome',label:'Desired observable outcome',type:'textarea',full:true,required:true},
    {name:'scope',label:'Affected systems or rails'},
    {name:'risk',label:'Known risks or people who could bear burdens',type:'textarea',full:true}
  ]), {submitLabel:'Create forge draft',onSubmit:async data=>{
    ensureImprovementState();
    const record={
      id:uid('proposal'), title:data.title, status:'forge-draft', purpose:`Problem: ${data.problem}\n\nDesired outcome: ${data.outcome}`,
      affectedPeople:data.risk||'Maintainers, users, offline participants, and communities adopting the change.',
      procedure:'Forge draft only. Move through Proposal Commons discussion, amendment, testing, and a separately declared outcome.',
      threshold:'Not yet declared.', silenceAbstention:'Silence is not consent.',
      dissentPath:'Preserve objections and offer a no-adoption path.', reconsideration:'Reopen when implementation evidence or affected people change.',
      offlinePath:'Provide a manual or no-software alternative with equal standing.', expiry:'Draft expires unless renewed by the community.',
      noSoftwareAlternative:'Retain the current workflow or use a manual workaround.', laborFunding:'Identify implementation, testing, accessibility, care, and maintenance labor before adoption.',
      createsAuthority:false, affectsRights:false, usesPrivateChoice:false, bindsNonparticipants:false,
      forge:{scope:data.scope||'unspecified',desiredOutcome:data.outcome,risks:data.risk||'',createdIn:'anarchadia-forge-mvp'}, createdAt:nowIso()
    };
    state.proposals.unshift(record); state.improvementSystem.forgeDrafts.unshift({proposalId:record.id,at:record.createdAt});
    closeModal(); await persist('forge.draft.created',{proposalId:record.id,scope:data.scope||''});
    announce('Forge draft created. It has not been adopted or deployed.');
  }});
}

async function runRailCheck() {
  ensureImprovementState();
  const health=railHealth();
  const result=health.invalid || health.readiness.blockingThreats.length ? 'review required' : 'conforming locally';
  const check={id:uid('rail-check'),at:nowIso(),result,score:health.score,bridges:health.bridges,invalidBridges:health.invalid,blockingThreats:health.readiness.blockingThreats.length};
  state.improvementSystem.railChecks.unshift(check);
  await persist('rails.conformance.checked',check);
  announce(`Rail check complete: ${result}.`, result==='review required'?'warn':'good');
}

function gateForm(id) {
  const item=READINESS_ITEMS.find(i=>i.id===id); const current=state.readiness[id];
  openModal(`Evidence · ${item.label}`, fieldsHtml([
    {name:'note',label:'Human-readable note',type:'textarea',full:true},{name:'evidence',label:'Evidence reference or exercise result',type:'textarea',full:true},
    {name:'complete',label:'Mark recorded as complete',type:'checkbox',full:true}
  ],current), {onSubmit:async data=>{state.readiness[id]=data;closeModal();await persist('readiness.updated',{gate:id,complete:data.complete});}});
}

function humanApprovalForm() {
  const fields=['reviewingPeople','community','scope','procedure','authorization','dissent','conditions'].map(name=>({name,label:name.replace(/[A-Z]/g,m=>` ${m}`).replace(/^./,m=>m.toUpperCase()),type:'textarea',full:true}));
  fields.push({name:'date',label:'Date declared',type:'date'},{name:'complete',label:'Procedural artifact complete',type:'checkbox'});
  openModal('HUMAN_APPROVAL procedural gate',fieldsHtml(fields,state.humanApproval),{onSubmit:async data=>{state.humanApproval=data;state.readiness.humanApproval={complete:Boolean(data.complete),note:data.reviewingPeople,evidence:'HUMAN_APPROVAL.md'};closeModal();await persist('human-approval.updated');}});
}

function conflictModal(conflict) {
  openModal('Contested import comparison', `<div class="notice danger">No automatic resolution is available. A qualified human process may create a new reconciled record while preserving both predecessors.</div><div class="grid two" style="margin-top:1rem"><article><h3>Local</h3><pre class="ai-output">${esc(JSON.stringify(conflict.local,null,2))}</pre></article><article><h3>Incoming</h3><pre class="ai-output">${esc(JSON.stringify(conflict.incoming,null,2))}</pre></article></div>`,{wide:true});
}

async function openSource() {
  const response=await fetch('docs/PROVISIONAL_CONSTITUTION.md'); const text=await response.text();
  openModal('Synthetically Ratified Provisional Constitution',`<pre class="ai-output" style="max-height:70vh">${esc(text)}</pre>`,{wide:true});
}

async function doExport() {
  const selected=[...document.querySelectorAll('#export-classes input:checked')].map(box=>box.value);
  if(!selected.length){announce('Select at least one export class.','danger');return null;}
  exchangePreview=await buildBundle(state,selected,{purpose:document.querySelector('#export-purpose')?.value,audience:document.querySelector('#export-audience')?.value,onwardExportRule:document.querySelector('#export-onward')?.value});
  render(); return exchangePreview;
}

async function forkWorkspace() {
  const sourceRef=state.meta.communityRef;
  state=deepClone(state);
  state.meta.communityRef=uid('community');
  state.meta.communityName=`${state.meta.communityName} · fork`;
  state.meta.forkedFrom=sourceRef;
  state.meta.createdAt=nowIso();
  state.charter.status='forked draft';
  await persist('workspace.forked',{sourceCommunityRef:sourceRef});
  announce('Local fork created with a new community-scoped reference.');
}

async function exitWipe() {
  const bundle=await buildBundle(state,['charter','decisions','dissent','rights','roles','privacy-security','readiness'],{purpose:'Exit archive before local deletion'});
  downloadText(`anarchadia-exit-${state.meta.communityRef}.json`,JSON.stringify(bundle,null,2),'application/json');
  openModal('Confirm local exit',`<div class="notice danger">The exit archive was downloaded. Clearing removes this browser’s local workspace. It cannot erase external copies or prove deletion elsewhere.</div>`,{onSubmit:async()=>{await clearWorkspace();state=emptyState();state.meta.mode='candidate';exchangePreview=null;lastAiDraft=null;await saveWorkspace(state);closeModal();location.hash='#hall';render();announce('Local workspace cleared. A fresh local hall is ready.');},submitLabel:'Clear local workspace'});
}

async function castGovernanceVote(proposal, choice) {
  if (!proposal?.externalId || !['approve', 'reject', 'abstain'].includes(choice)) {
    throw new Error('This proposal is not connected to a Commonweave vote.');
  }
  proposal.localVote = choice;
  proposal.governance = {
    ...(proposal.governance || {}),
    myVote: choice,
    status: proposal.governance?.status || 'voting',
    communityRef: proposal.governance?.communityRef || commonweaveCommunityRef
  };
  await persist('commonweave.vote-cast', {
    proposalId: proposal.id,
    externalId: proposal.externalId,
    choice
  });
  if (window.parent !== window) {
    window.parent.postMessage({
      type: 'commonweave:governance-vote',
      source: 'anarchadia',
      proposalId: proposal.externalId,
      communityRef: proposal.governance.communityRef,
      choice
    }, location.origin);
  }
  announce('Your current operational choice was recorded. You may change it later.');
}

async function handleAction(target) {
  const action=target.dataset.action;
  if(!action) return;
  if(action==='toggle-interface'){location.hash='#hall';render();return;}
  if(action==='return-commonweave'){location.href='../../index.html?visual=1&build=1.0.20#square';return;}
  if(action==='start-fixture'){state=syntheticFixture();ensureImprovementState();await saveWorkspace(state);location.hash='#hall';render();announce('Synthetic Lantern Commons loaded.');}
  else if(action==='start-blank') startBlank();
  else if(action==='open-import') document.querySelector('#import-file')?.click();
  else if(action==='install'&&installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;render();}
  else if(action==='accessibility') openAccessibility();
  else if(action==='toggle-hotspots'){announce('Hotspot debugging is available only with ?debugHotspots=1.');}
  else if(action==='open-passport') openAnarchadiaPassport();
  else if(action==='scene-info') sceneInfoModal(target.dataset.info);
  else if(action==='edit-admission') openAdmission();
  else if(action==='edit-charter-meta') openModal('Edit charter header',fieldsHtml([{name:'title',label:'Title'},{name:'status',label:'Status',type:'select',options:['draft','under review','declared operative','rejected','superseded','forked draft']},{name:'preamble',label:'Preamble',type:'textarea',full:true}],state.charter),{onSubmit:async data=>{Object.assign(state.charter,data);closeModal();await persist('charter.header.updated');}});
  else if(action==='add-section') sectionForm();
  else if(action==='edit-section') sectionForm(findCharterSection(target.dataset.id));
  else if(action==='delete-section'){const id=target.dataset.id;state.charter.sections=state.charter.sections.filter(s=>s.id!==id);await persist('charter.section.removed',{sectionId:id});}
  else if(action==='commit-charter'){const summary=document.querySelector('#version-summary')?.value||'';const snap={id:uid('version'),version:state.charter.version,at:nowIso(),summary,snapshot:{title:state.charter.title,preamble:state.charter.preamble,sections:deepClone(state.charter.sections)}};state.charter.versions.unshift(snap);state.charter.version+=1;await persist('charter.version.committed',{snapshotVersion:snap.version});announce('Local version snapshot committed. No adoption was inferred.');}
  else if(action==='view-version'){const version=state.charter.versions.find(v=>v.id===target.dataset.id);openModal(`Charter version ${version.version}`,`<p>${esc(version.summary)}</p><pre class="ai-output">${esc(JSON.stringify(version.snapshot,null,2))}</pre>`,{wide:true});}
  else if(action==='view-conflict') conflictModal(state.charter.conflicts.find(c=>c.id===target.dataset.id));
  else if(action==='add-proposal') proposalForm();
  else if(action==='open-petition-board') openPetitionBoard();
  else if(action==='signal-petition') await setPetitionSignal(target.dataset.id,target.dataset.signal);
  else if(action==='advance-proposal-status') await advanceProposalStatus(target.dataset.id);
  else if(action==='open-discussion-board') openDiscussionBoard();
  else if(action==='open-discussion') openDiscussionBoard(target.dataset.id);
  else if(action==='add-discussion') discussionForm(target.dataset.id);
  else if(action==='open-workgroups') openWorkgroups();
  else if(action==='add-workgroup') workgroupForm();
  else if(action==='edit-workgroup') workgroupForm(state.civicSystem.workgroups.find(item=>item.id===target.dataset.id)||{});
  else if(action==='open-bulletins') openBulletins();
  else if(action==='add-bulletin') bulletinForm();
  else if(action==='edit-bulletin') bulletinForm(state.civicSystem.bulletins.find(item=>item.id===target.dataset.id)||{});
  else if(action==='open-federation-messages') openFederationMessages();
  else if(action==='add-federation-message') federationMessageForm();
  else if(action==='edit-federation-message') federationMessageForm(state.civicSystem.federationMessages.find(item=>item.id===target.dataset.id)||{});
  else if(action==='open-adoption-signals') openAdoptionSignals();
  else if(action==='add-adoption-signal') adoptionSignalForm();
  else if(action==='edit-adoption-signal') adoptionSignalForm(state.civicSystem.adoptionSignals.find(item=>item.id===target.dataset.id)||{});
  else if(action==='open-experiments') openExperiments();
  else if(action==='add-experiment') experimentForm();
  else if(action==='edit-experiment') experimentForm(state.civicSystem.experiments.find(item=>item.id===target.dataset.id)||{});
  else if(action==='open-rollback-board') openRollbackBoard();
  else if(action==='propose-rollback') rollbackForm(target.dataset.id);
  else if(action==='open-alert-center') openAlertCenter();
  else if(action==='dismiss-alert') await dismissCivicAlert(target.dataset.id);
  else if(action==='add-bug') bugForm();
  else if(action==='advance-bug') await advanceBug(target.dataset.id);
  else if(action==='resolve-bug') await resolveBug(target.dataset.id);
  else if(action==='forge-improvement') forgeImprovementForm();
  else if(action==='run-rail-check') await runRailCheck();
  else if(action==='edit-proposal') proposalForm(find('proposals',target.dataset.id));
  else if(action==='cast-governance-vote') await castGovernanceVote(find('proposals',target.dataset.id),target.dataset.choice);
  else if(action==='declare-outcome') outcomeForm(find('proposals',target.dataset.id));
  else if(action==='add-dissent') dissentForm(target.dataset.targetType,target.dataset.targetId);
  else if(action==='add-right') recordForm('rights');
  else if(action==='add-role') recordForm('roles');
  else if(action==='add-procedure') recordForm('procedureCards',{status:'documentation-only'});
  else if(action==='add-data') recordForm('dataMap');
  else if(action==='add-threat') recordForm('threats',{outcome:'not tested',disposition:'unresolved'});
  else if(action==='add-receipt') recordForm('receipts',{state:'received',contestStatus:'not contested'});
  else if(action==='add-bridge') recordForm('bridgeContracts',{enabled:false});
  else if(action==='edit-record') recordForm(target.dataset.collection,find(target.dataset.collection,target.dataset.id));
  else if(action==='open-ai') openAiModal(target.dataset.aiTask,target.dataset.aiTarget,target.dataset.id);
  else if(action==='preview-export') await doExport();
  else if(action==='download-export'){const bundle=exchangePreview||await doExport();if(bundle)downloadText(`anarchadia-${state.meta.communityRef}.json`,JSON.stringify(bundle,null,2),'application/json');}
  else if(action==='fork-workspace') await forkWorkspace();
  else if(action==='exit-wipe') await exitWipe();
  else if(action==='download-human-approval') downloadText('HUMAN_APPROVAL.md',makeHumanApprovalMarkdown(state.humanApproval,state.meta),'text/markdown');
  else if(action==='edit-human-approval') humanApprovalForm();
  else if(action==='edit-gate') gateForm(target.dataset.id);
  else if(action==='toggle-gate'){state.readiness[target.dataset.id].complete=target.checked;await persist('readiness.toggled',{gate:target.dataset.id,complete:target.checked});}
  else if(action==='open-source') await openSource();
  else if(action==='save-ai-config') saveAiConfig();
  else if(action==='run-ai') runAiPage();
  else if(action==='save-ai-draft'&&lastAiDraft){state.aiDrafts.unshift(lastAiDraft);await persist('ai-draft.preserved',{draftId:lastAiDraft.id});announce('AI draft preserved as advisory provenance.');}
  else if(action==='view-ai-draft'){const d=find('aiDrafts',target.dataset.id);openModal(`AI draft · ${d.task}`,`<pre class="ai-output">${esc(d.text)}</pre><p class="disclaimer">${esc(d.disclaimer)}</p>`,{wide:true});}
  else if(action==='download-integration') downloadIntegration();
}


function passportSafeJson(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}}
function passportIdentity(){
  const vault=passportSafeJson('commonweave-identity-vault',{});
  const pocket=passportSafeJson('commonweave-pocket-identity-v1',{});
  const identity=vault?.identity||pocket?.identity||{};
  return {
    name:identity.displayName||identity.name||identity.alias||pocket?.profile?.name||'Local traveler',
    chosenName:identity.chosenName||identity.alias||'',
    pronouns:identity.pronouns||'',
    id:identity.identityId||pocket?.identityId||'local-passport',
    community:identity.homeCommunity||identity.community||state?.meta?.communityRef||'Local commons',
    avatar:identity.avatar||identity.avatarUrl||pocket?.profile?.avatar||''
  };
}
function passportIntentions(){
  const all=passportSafeJson('commonweave.intentions.v2',[]);
  const activeId=passportSafeJson('commonweave.active.intention.v1','')||localStorage.getItem('commonweave.active.intention.v1')||'';
  return (Array.isArray(all)?all:[]).filter(x=>!['complete','abandoned','cancelled'].includes(String(x.status||'').toLowerCase())).sort((a,b)=>(a.id===activeId?-1:0)-(b.id===activeId?-1:0)).slice(0,3);
}
function openAnarchadiaPassport(){
  const who=passportIdentity(),intentions=passportIntentions();
  const active=intentions[0];
  const avatar=who.avatar?`<img class="passport-avatar-image" src="${esc(who.avatar)}" alt="${esc(who.name)} profile avatar">`:`<span class="passport-avatar-fallback">${esc((who.name||'?').slice(0,1).toUpperCase())}</span>`;
  const intentionCards=[0,1,2].map(i=>`<article class="passport-intention-card"><b>${i+1}</b><span>${esc(intentions[i]?.title||intentions[i]?.purpose||'Open intention slot')}</span></article>`).join('');
  const nextStep=active?.steps?.find(step=>!['complete','done'].includes(String(step.status||'').toLowerCase()));
  const context=active?`${active.health?.summary||active.summary||'Active journey in progress'}${nextStep?` Next: ${nextStep.title}.`:''}`:'No active intention is currently carried.';
  const html=`<div class="anarchadia-passport" style="--passport-bg:url('assets/passport/anarchadia-passport-blank.webp')">
    <img class="passport-art" src="assets/passport/anarchadia-passport-blank.webp" alt="Blank Anarchadia passport spread">
    <div class="passport-avatar-slot">${avatar}</div>
    <div class="passport-field passport-name">${esc(who.name)}</div>
    <div class="passport-field passport-chosen">${esc(who.chosenName||who.name)}</div>
    <div class="passport-field passport-pronouns">${esc(who.pronouns||'Not specified')}</div>
    <div class="passport-field passport-id">${esc(who.id)}</div>
    <div class="passport-field passport-community">${esc(who.community)}</div>
    <div class="passport-intentions">${intentionCards}</div>
    <div class="passport-field passport-current">${esc(active?.title||'No active journey')}</div>
    <div class="passport-field passport-next">${esc(nextStep?.system||'Choose next realm')}</div>
    <div class="passport-field passport-context">${esc(context)}</div>
  </div>
  <div class="notice"><strong>Intention continuity is active.</strong> This passport reads the shared Commonweave intention ledger, so every realm can receive the same current purpose, decisions, next step, and journey context. Canonical records remain in their home realm.</div>`;
  openModal('Anarchadia Passport · Intention Continuity',html,{wide:true});
}

function sceneInfoModal(key) {
  ensureImprovementState();
  const recentAudit = state.audit.slice(0,5).map(item=>`<li><strong>${esc(item.action)}</strong><span>${esc(new Date(item.at).toLocaleString())}</span></li>`).join('') || '<li>No activity recorded yet.</li>';
  const unresolved = state.improvementSystem.bugs.filter(item=>item.status!=='resolved');
  const resolved = state.improvementSystem.bugs.filter(item=>item.status==='resolved');
  const latestRail = state.improvementSystem.railChecks[0];
  const summary = readinessSummary(state);
  const entries = {
    'hall-announcements': ['Announcements', `<p>Recent local hall events. These notices are projections of inspectable records, not authority claims.</p><ul class="scene-info-list">${recentAudit}</ul><a class="btn small" href="#ledger" data-close-modal>Open full ledger</a>`],
    'hall-routes': ['Quick Routes', `<div class="scene-route-grid"><a href="#proposal-commons" data-close-modal>Propose an improvement</a><a href="#bug-triage" data-close-modal>Report a bug</a><a href="#hub-commons" data-close-modal>Open local governance</a><a href="#federation" data-close-modal>Exchange with hubs</a><a href="#rails" data-close-modal>Check compatibility</a><a href="#forge" data-close-modal>Forge a bounded change</a></div>`],
    'proposal-idea-board': ['Idea Board', `<p>${state.proposals.length} proposal records are currently preserved in this workspace. Ideas remain proposals until people deliberately discuss, amend, and declare an outcome.</p><a class="btn small" href="#proposals" data-close-modal>Open proposal workbench</a>`],
    'bug-queue': ['Issue Queue', `<p>${unresolved.length} unresolved and ${resolved.length} resolved bug records are stored locally.</p><p>Queue position does not override severity, rights impact, or human judgment.</p>`],
    'bug-severity': ['Severity Matrix', `<p><strong>Critical:</strong> safety, rights, irreversible data loss, or blocked recovery.</p><p><strong>High:</strong> major workflow failure without a safe workaround.</p><p><strong>Medium:</strong> impaired workflow with a workaround.</p><p><strong>Low:</strong> polish, clarity, or limited-scope defect.</p>`],
    'bug-pipeline': ['Fix Pipeline', `<ol><li>Triage the report.</li><li>Reproduce the failure.</li><li>Build a bounded repair.</li><li>Review and test.</li><li>Mark resolved only after evidence.</li></ol><a class="btn small" href="#forge" data-close-modal>Open The Forge</a>`],
    'bug-resolved': ['Resolved Repairs', `<p>${resolved.length} repairs are currently marked resolved. Resolution remains an editable local claim backed by the bug record and audit trail.</p><a class="btn small" href="#ledger" data-close-modal>Inspect audit history</a>`],
    'hub-bulletins': ['Commons Bulletins', `<p>${state.audit.length} local events, ${state.proposals.length} proposals, and ${state.dissents.length} preserved dissent records currently feed this commons view.</p><p>Bulletins summarize activity without exposing private identity or inferring consensus.</p>`],
    'federation-adoption': ['Adoption Signals', `<p>Adoption is explicit, scoped, and reversible. Importing a bundle never automatically makes its amendments operative.</p><p>${state.imports.length} imported bundle records are present; conflicts remain visible.</p>`],
    'federation-messages': ['Federation Messages', `<p>Messages carry bounded artifacts and declared status, not hidden authority. Every bridge remains default-off until people approve its exact fields, recipients, retention, and exit path.</p>`],
    'federation-ledger': ['Federation Ledger', `<p>${state.bridgeContracts.length} bridge contracts and ${state.imports.length} imports are recorded. The ledger preserves provenance and conflicting versions rather than choosing a winner silently.</p><a class="btn small" href="#exchange" data-close-modal>Open exchange workbench</a>`],
    'rails-core': ['Interoperability Core', `<p>Current rail score: <strong>${railHealth().score}%</strong>.</p><p>The core combines bridge validity and recorded readiness. It is a diagnostic projection, not proof that another community must accept the connection.</p>`],
    'rails-status': ['System Status', `<p>${railHealth().invalid} invalid bridge contracts and ${summary.blockingThreats.length} blocking threats currently need review.</p><p>${latestRail ? `Latest local check: ${esc(latestRail.result)} at ${esc(new Date(latestRail.at).toLocaleString())}.` : 'No conformance check has been run yet.'}</p>`],
    'rails-sync': ['Core Health and Sync Signal', `<p>Encrypted relay and bundle movement preserve local authority. A delivery receipt proves transport, not legitimacy or adoption.</p><a class="btn small" href="#exchange" data-close-modal>Inspect bridge contracts</a>`],
    'rails-flow': ['Compatibility Flow', `<p>Compatible records may move between rooms and hubs only through versioned contracts. Unsupported fields remain stopped or explicitly contested.</p>`],
    'forge-deploy': ['Deploy Boundary', `<div class="notice danger">Nothing deploys itself.</div><p>The Forge creates a proposal draft. Human review, testing, a declared governance outcome, and an authorized implementation path are still required.</p><a class="btn small" href="#proposal-commons" data-close-modal>Open Review Gate</a>`],
    'ledger-audit': ['Audit Trail', `<ul class="scene-info-list">${recentAudit}</ul><p>Audit events preserve provenance. Earlier timestamps do not automatically outrank later or conflicting records.</p>`],
    'ledger-rollback': ['Rollback Safeguards', `<p>Rollback creates another visible record. It does not erase the superseded version, dissent, evidence, or consequences already produced.</p><p>Human review is required whenever reversal affects rights, obligations, or relied-upon records.</p>`],
    'ledger-record': ['The Record Remembers', `<p>Common records remain accountable, exportable, and contestable. The ledger records what a community declared; it cannot certify legitimacy.</p>`],
    'observatory-activity': ['Activity Gauge', `<p>${state.audit.length} inspectable local audit events are present. Activity is counted at the record level and is not used to rank or profile people.</p>`],
    'observatory-heatmap': ['Activity Heatmap', `<p>The heatmap is a system-level diagnostic metaphor. Production metrics must remain aggregated, privacy-bounded, and unsuitable for individual scoring or surveillance.</p>`]
  };
  const entry = entries[key] || ['Room information', '<p>No additional information is available for this station.</p>'];
  openModal(entry[0], `<div class="scene-info">${entry[1]}</div>`, {wide:true});
}

function openAccessibility(){
  const current=JSON.parse(sessionStorage.getItem('anarchadia-accessibility')||'{}');
  openModal('Session accessibility choices',fieldsHtml([
    {name:'largeText',label:'Larger text',type:'checkbox'},{name:'highContrast',label:'Higher contrast',type:'checkbox'},{name:'reduceMotion',label:'Reduce motion',type:'checkbox'}
  ],current),{onSubmit:async data=>{sessionStorage.setItem('anarchadia-accessibility',JSON.stringify(data));closeModal();applySessionSettings();render();announce('Session-local accessibility choices applied.');}});
}
function saveAiConfig(){
  const config={provider:document.querySelector('#ai-provider').value,endpoint:document.querySelector('#ai-endpoint').value,model:document.querySelector('#ai-model').value,apiKey:document.querySelector('#ai-key').value,externalConsent:document.querySelector('#ai-consent').checked};
  if(config.provider==='gemini') config.baseUrl=config.endpoint||'https://generativelanguage.googleapis.com/v1beta';
  aiConfigMemory={...config};
  if(window.CommonweaveModelRuntime){
    const provider=config.provider==='suite-bridge'?'hosted':config.provider;
    window.CommonweaveModelRuntime.saveSharedConfig({
      route:config.provider,provider,model:config.model,endpoint:config.endpoint||config.baseUrl||'',
      apiKey:config.apiKey,externalConsent:config.externalConsent,service:'anarchadia'
    });
    if(config.apiKey)window.CommonweaveModelRuntime.saveSessionSecret(config,{apiKey:config.apiKey,externalConsent:config.externalConsent});
  }
  announce('AI configuration is active across this campus. Secrets remain in this tab.');
}
function runAiPage(){
  saveAiConfig();
  const task=document.querySelector('#ai-task').value;const instruction=document.querySelector('#ai-instruction').value;const choice=document.querySelector('#ai-context').value;
  const context=choice==='instruction'?{}:contextFor(choice);invokeAi(task,context,instruction);
}
function downloadIntegration(){
  const specimen={schema:'anarchadia.constitutional-artifact.v1',generatedAt:nowIso(),sourceCommunityScopedRef:state.meta.communityRef,artifactRef:state.charter.id,artifactKind:'charter',declaredVersion:state.charter.version,declaredStatus:state.charter.status,conflictState:state.charter.conflicts?.length?'contested':'no recorded conflict',expiry:'community-declared or none',manualReviewRequired:true,automaticEffect:false,authorityDisclaimer:state.meta.authorityDisclaimer};
  downloadText('anarchadia-cerbanimo-handoff.json',JSON.stringify(specimen,null,2),'application/json');
}

document.addEventListener('click',event=>{const target=event.target.closest('[data-action]');if(target)handleAction(target);});
app.addEventListener('change',event=>{if(event.target.id==='import-file'&&event.target.files?.[0]){handleImport(event.target.files[0]);event.target.value='';}});
window.addEventListener('hashchange',render);
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;render();});
window.addEventListener('appinstalled',()=>{installPrompt=null;announce('Anarchadia installed for offline use.');render();});

async function importCommonweaveProposal(payload={}) {
  if(!state) {
    state=emptyState({communityName:'Candidate Commonweave community',mode:'candidate'});
  }
  const source=payload.plan||payload.quest||payload;
  const tasks=Array.isArray(source.tasks)?source.tasks:[];
  const title=String(source.title||payload.title||'Cerbanimo operating plan');
  const externalId=String(payload.id||payload.governance?.id||payload.proposalId||'').slice(0,120);
  const existing=externalId?state.proposals.find(item=>item.externalId===externalId):null;
  if(existing){
    existing.governance={
      ...(existing.governance||{}),
      ...(payload.governance||{}),
      id:externalId,
      communityRef:String(payload.communityRef||payload.governance?.communityRef||existing.governance?.communityRef||'')
    };
    existing.status=existing.governance.status||existing.status;
    await persist('commonweave.proposal-synced',{proposalId:existing.id,externalId});
    if(!payload.silent)location.hash='#proposal-commons';
    return existing;
  }
  const record={
    id:uid('proposal'),
    externalId:externalId||null,
    title,
    status:String(payload.governance?.status||'voting'),
    purpose:String(source.description||source.summary||payload.summary||`Review the bounded operating plan “${title}”.`),
    affectedPeople:String(payload.affectedPeople||'Participants, nonparticipants, maintainers, people needing offline access, and people who may bear material or care work.'),
    procedure:String(payload.procedure||'Community-declared deliberation with accessible notice, amendment, refusal, and a separately recorded outcome.'),
    threshold:String(payload.threshold||'Simple majority of current cast choices, with at least one supporting member; the community may replace this declared operational rule.'),
    silenceAbstention:'Silence is not consent. Abstention and absence remain visible and carry no inferred position.',
    dissentPath:'Preserve dissenter-chosen disclosure, independent appeal, and a path to withdraw or revise the proposal.',
    reconsideration:'Reopen when material assumptions, affected people, costs, risks, or implementation conditions change.',
    offlinePath:'Provide an assisted or paper path with equal deliberative effect.',
    expiry:String(payload.expiry||new Date(Date.now()+30*86400000).toISOString()),
    noSoftwareAlternative:'Facilitated paper planning, an existing community process, or no project.',
    laborFunding:String(payload.laborFunding||'The community must identify facilitation, translation, accessibility, care, maintenance, and funding responsibilities.'),
    createsAuthority:Boolean(payload.createsAuthority),
    affectsRights:Boolean(payload.affectsRights),
    usesPrivateChoice:false,
    bindsNonparticipants:false,
    source:{
      system:'cerbanimo',
      schema:String(payload.schema||'commonweave.cerbanimo-plan.v1'),
      taskCount:tasks.length,
      automaticEffect:false,
      manualReviewRequired:true
    },
    governance:{
      ...(payload.governance||{}),
      id:externalId||null,
      communityRef:String(payload.communityRef||payload.governance?.communityRef||commonweaveCommunityRef||''),
      status:String(payload.governance?.status||'voting'),
      tally:payload.governance?.tally||{approve:0,reject:0,abstain:0}
    },
    createdAt:nowIso()
  };
  state.proposals.unshift(record);
  await persist('commonweave.proposal-imported',{proposalId:record.id,source:'cerbanimo'});
  if(!payload.silent)location.hash='#proposal-commons';
  announce('Cerbanimo plan imported as a non-certifying proposal record.');
  return record;
}

async function applyCommonweaveGovernanceSync(message={}) {
  commonweaveCommunityRef=String(message.communityRef||commonweaveCommunityRef||'').slice(0,120);
  const plans=Array.isArray(message.plans)?message.plans.slice(0,100):[];
  for(const item of plans){
    await importCommonweaveProposal({
      ...(item.payload||{}),
      id:String(item.id||''),
      title:item.title,
      summary:item.summary,
      communityRef:commonweaveCommunityRef,
      governance:{
        id:String(item.id||''),
        communityRef:commonweaveCommunityRef,
        status:String(item.status||'voting'),
        tally:item.tally||{approve:0,reject:0,abstain:0},
        myVote:item.myVote||''
      },
      silent:true
    });
  }
  render();
}

async function receiveCommonweaveAiIntention(message={}) {
  const requestId=String(message.requestId||'');
  const prompt=String(message.prompt||message.value||'').trim().slice(0,4000);
  const reply=(status,detail)=>{
    if(window.parent!==window)window.parent.postMessage({
      type:'commonweave:ai-intention-receipt',
      service:'anarchadia',
      requestId,
      status,
      detail
    },location.origin);
  };
  if(commonweaveIntentRequests.has(requestId)){
    reply('accepted','Anarchadia already accepted this routed intention.');
    return;
  }
  commonweaveIntentRequests.add(requestId);
  sessionStorage.setItem('commonweave-anarchadia-intention',prompt);
  location.hash='#ai';
  render();
  reply('accepted','Rook accepted the intention as an advisory, non-authoritative AI request in Anarchadia.');
  try{
    const sharedModelKey=message.modelSettings?.sharedForThisSession
      ? String(message.modelSettings.apiKey||'').slice(0,500)
      : '';
    lastAiDraft=await runAssistant({
      task:'freeform',
      context:{routePlan:message.routePlan||null},
      instruction:prompt,
      config:{
        ...getAiConfig(),
        ...(sharedModelKey?{apiKey:sharedModelKey,externalConsent:true}:{})
      }
    });
    render();
    announce('Rook drafted the Commonweave intention. No governance record changed.');
    reply('delivered','Rook generated an advisory draft. It has no authority and was not applied to any record.');
  }catch(error){
    announce(`Routed AI request needs attention: ${error.message}`,'danger');
    reply('failed',`Anarchadia kept the prompt, but its selected model needs attention: ${error.message}`);
  }
}

function isOllamaEndpoint(value='') {
  const endpoint=String(value||'').toLowerCase();
  return endpoint.includes(':11434')||endpoint.includes('/api/chat')||endpoint.includes('/api/generate');
}

function applyCommonweaveContext(context={}) {
  const route=context.model?.route||'deterministic';
  const mapping={
    deterministic:{provider:'deterministic',model:'local-constitutional-linter',endpoint:''},
    hosted:{provider:'suite-bridge',model:context.model?.model||'suite-default',endpoint:''},
    gguf:{provider:'openai-compatible',model:context.model?.model||'local-gguf',endpoint:context.model?.endpoint||''},
    'local-api':{provider:isOllamaEndpoint(context.model?.endpoint)?'ollama':'openai-compatible',model:context.model?.model||'local-model',endpoint:context.model?.endpoint||''},
    gemini:{provider:'gemini',model:context.model?.model||'gemini-3.5-flash-lite',baseUrl:context.model?.endpoint||'https://generativelanguage.googleapis.com/v1beta'},
    browser:{provider:'deterministic',model:'local-constitutional-linter',endpoint:''},
    manual:{provider:'deterministic',model:'local-constitutional-linter',endpoint:''}
  };
  const sharedModelKey=context.modelSettings?.sharedForThisSession
    ?String(context.modelSettings.apiKey||context.modelSettings.bearerToken||'').slice(0,500)
    :'';
  commonweaveCommunityRef=String(context.governance?.communityRef||commonweaveCommunityRef||'').slice(0,120);
  aiConfigMemory={...aiConfigMemory,...(mapping[route]||mapping.deterministic),...(sharedModelKey?{apiKey:sharedModelKey,externalConsent:true}:{}),commonweaveManaged:true};
  document.documentElement.dataset.commonweave='connected';
  // The parent campus bar already exposes Rook and the shared-model status.
  // Remove the legacy floating suite badge so it never obscures room controls.
  document.getElementById('commonweave-suite-badge')?.remove();
}

window.__COMMONWEAVE_ANARCHADIA__={
  getState:()=>deepClone(state),
  importProposal:importCommonweaveProposal,
  applyContext:applyCommonweaveContext,
  receiveAiIntention:receiveCommonweaveAiIntention
};

function receiveCommonweaveNavigation(message){
  if(String(message.contractVersion||'')!=='commonweave.navigation.v1'||String(message.sourceApplication||'')!=='commonweave')return;
  const object=String(message.object||''),id=String(message.id||'').slice(0,200),actionId=String(message.actionId||'').slice(0,200);
  let opened=false,detail='Anarchadia could not resolve that governance object.';
  if(object==='proposal'&&state){
    const proposal=state.proposals.find(item=>String(item.id)===id||String(item.externalId||'')===id);
    if(proposal){sessionStorage.setItem('commonweave-anarchadia-selected-proposal',proposal.id);location.hash='#proposal-commons';render();opened=true;detail=`Opened proposal ${proposal.title||proposal.name||proposal.id}.`;}
  }
  if(window.parent!==window)window.parent.postMessage({type:'commonweave:navigation-receipt',contractVersion:'commonweave.navigation.v1',sourceApplication:'anarchadia',actionId,status:opened?'opened':'unavailable',detail},location.origin);
}

window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==window.parent||!event.data)return;
  if(event.data.type==='commonweave:context')applyCommonweaveContext(event.data);
  if(event.data.type==='commonweave:navigate-object')receiveCommonweaveNavigation(event.data);
  if(event.data.type==='commonweave:governance-sync')applyCommonweaveGovernanceSync(event.data).catch(error=>announce(error.message,'danger'));
  if(event.data.type==='commonweave:import-proposal')importCommonweaveProposal(event.data.payload||{}).catch(error=>announce(error.message,'danger'));
  if(event.data.type==='commonweave:intention'){
    location.hash='#proposal-commons';
    sessionStorage.setItem('commonweave-anarchadia-intention',String(event.data.value||''));
    announce('Commonweave opened the proposal workspace. Nothing has been submitted.');
  }
  if(event.data.type==='commonweave:ai-intention')receiveCommonweaveAiIntention(event.data);
});

async function init(){
  applySessionSettings();
  try{state=await loadWorkspace();}catch(error){console.warn(error);announce('Local database was repaired. Starting a fresh local hall.','warn');state=null;}
  if(!state && visualRequested && !legacyMode()){
    state=emptyState();
    state.meta.mode='candidate';
    await saveWorkspace(state);
    location.hash='#hall';
  }

  if('serviceWorker' in navigator){try{await navigator.serviceWorker.register('./service-worker.js');}catch(error){console.warn('Service worker registration failed',error);}}
  render();
  if(state){
    const estimate=await storageEstimate();
    if(estimate&&estimate.percent>80)announce(`Local storage is ${estimate.percent}% full. Export a continuity bundle.`,'warn');
    if(navigator.storage?.persisted&&!(await navigator.storage.persisted())) requestPersistentStorage().catch(()=>false);
  }
  if(window.parent!==window)window.parent.postMessage({type:'commonweave:ready',service:'anarchadia',version:APP_VERSION,communityRef:state?.meta?.communityRef||'',capabilities:['proposal-import','declared-outcome','quest-board-handoff','governance-vote','suite-model','ai-intention','object-navigation-v1']},location.origin);
}
init();
