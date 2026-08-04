import { createEnvelope, forwardEnvelope, validateEnvelope } from './protocol.js';

const STOP = new Set(['a','an','and','are','as','at','be','by','for','from','i','in','is','it','my','of','on','or','that','the','this','to','want','with','we','you']);
const uid = prefix => `${prefix}-${crypto.randomUUID()}`;
const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const unique = values => [...new Set(values.map(clean).filter(Boolean))];
const titleCase = text => clean(text).replace(/\b\w/g, letter => letter.toUpperCase());

export const REWARD_TYPES = Object.freeze(['acorn', 'button', 'cotoken', 'xp']);

export function keywordTopics(text, limit = 5) {
  const words = clean(text).toLowerCase().match(/[a-z0-9][a-z0-9-]{2,}/g) || [];
  const scored = new Map();
  for (const word of words) if (!STOP.has(word)) scored.set(word, (scored.get(word) || 0) + 1);
  return [...scored.entries()].sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([word]) => word);
}

export function buildIntention(wish, draft = null) {
  const statement = clean(wish);
  if (statement.length < 8) throw new Error('A wish needs enough detail to build a useful route.');
  const topics = keywordTopics(statement, 6);
  const skill = topics[0] || 'project practice';
  const outcome = clean(draft?.outcome) || `Create a usable first result for: ${statement}`;
  const learningTopics = unique(draft?.learning?.topics || [
    `Foundations of ${skill}`,
    `Safety, quality, and evaluation for ${skill}`,
    `How to explain and improve the result`
  ]);
  const taskSteps = unique(draft?.tasks?.steps || [
    'Define the smallest observable result',
    'Build or perform the first working version',
    'Collect proof against the completion requirements',
    'Review the result and decide the next iteration'
  ]);
  const materials = (draft?.materials?.items || topics.slice(1,4).map((topic, index) => ({
    name: titleCase(topic),
    quantity: 1,
    unit: 'item',
    required: index < 2,
    notes: 'Confirm the exact specification before requesting.'
  })));
  if (!materials.length) materials.push({ name: 'Project-specific materials', quantity: 1, unit: 'set', required: false, notes: 'Clarify during task planning.' });
  const intentionId = uid('intention');
  return {
    id: intentionId,
    schema: 'commonweave.intention.v1',
    wish: statement,
    title: clean(draft?.title) || titleCase(topics.slice(0,4).join(' ') || 'New intention'),
    outcome,
    status: 'review',
    createdAt: new Date().toISOString(),
    learningRequest: {
      id: uid('learning'),
      schema: 'commonweave.learning-request.v1',
      intentionId,
      goal: clean(draft?.learning?.goal) || `Learn enough to complete and evaluate the first result for ${statement}`,
      topics: learningTopics,
      desiredEvidence: clean(draft?.learning?.desiredEvidence) || 'The learner can explain the core ideas and apply them in the project.',
      skillTags: unique(draft?.learning?.skillTags || [skill, ...topics.slice(1,3)])
    },
    taskRequest: {
      id: uid('task-request'),
      schema: 'commonweave.task-request.v1',
      intentionId,
      objective: clean(draft?.tasks?.objective) || outcome,
      steps: taskSteps,
      completionRequirements: unique(draft?.tasks?.completionRequirements || [
        'The result is observable by another person.',
        'Evidence is attached for each required step.',
        'A validator can compare the result with the stated outcome.'
      ]),
      skillTags: unique(draft?.tasks?.skillTags || [skill, ...topics.slice(1,3)])
    },
    materialsRequest: {
      id: uid('materials-request'),
      schema: 'commonweave.materials-request.v1',
      intentionId,
      purpose: clean(draft?.materials?.purpose) || outcome,
      items: materials.map(item => ({
        id: item.id || uid('material'),
        name: clean(item.name),
        quantity: Number(item.quantity) || 1,
        unit: clean(item.unit) || 'item',
        required: item.required !== false,
        notes: clean(item.notes)
      }))
    }
  };
}

export function buildCurriculum(request, draft = null) {
  const topics = unique(draft?.topics || request.topics || keywordTopics(request.goal, 4));
  const modules = (draft?.modules || topics.map((topic, index) => ({
    title: `${index + 1}. ${titleCase(topic)}`,
    objective: `Explain and apply ${topic} to the active intention.`,
    skillTags: request.skillTags?.length ? request.skillTags : [topic],
    sections: [
      { kind: 'text', title: 'Core idea', content: `Build a working mental model of ${topic}, then connect it to the project outcome.` },
      { kind: 'diagram', title: 'Concept map', nodes: ['Observe', titleCase(topic), 'Practice', 'Evidence'] },
      { kind: 'practice', title: 'Applied exercise', prompt: `Use ${topic} to make one decision in the active project and record why.` }
    ],
    assessment: [
      { id: uid('question'), type: 'short', prompt: `Explain ${topic} in your own words and give one project example.`, rubric: `Names the core idea, connects it to the project, and includes a concrete example.` },
      { id: uid('question'), type: 'essay', prompt: `What could go wrong when applying ${topic}, and how would you detect and correct it?`, rubric: 'Identifies a plausible failure, evidence that reveals it, and a corrective action.' }
    ],
    rewards: { acorns: 2, xp: 20 }
  })));
  return {
    id: uid('curriculum'),
    schema: 'living-school.curriculum.v1',
    requestId: request.id,
    intentionId: request.intentionId,
    title: clean(draft?.title) || `Learning path: ${titleCase(keywordTopics(request.goal, 4).join(' ') || 'Project Foundations')}`,
    goal: request.goal,
    status: 'active',
    createdAt: new Date().toISOString(),
    modules: modules.map((module, index) => ({
      id: module.id || uid('module'),
      order: index,
      title: clean(module.title) || `Module ${index + 1}`,
      objective: clean(module.objective),
      skillTags: unique(module.skillTags || request.skillTags || []),
      sections: Array.isArray(module.sections) ? module.sections : [],
      assessment: Array.isArray(module.assessment) ? module.assessment : [],
      rewards: { acorns: Number(module.rewards?.acorns ?? 2), xp: Number(module.rewards?.xp ?? 20) },
      research: module.research || null,
      status: 'locked'
    }))
  };
}

export function unlockCurriculum(curriculum) {
  const copy = structuredClone(curriculum);
  const firstIncomplete = copy.modules.findIndex(module => module.status !== 'completed');
  copy.modules.forEach((module, index) => {
    if (module.status === 'completed') return;
    module.status = index === firstIncomplete ? 'available' : 'locked';
  });
  return copy;
}

export function buildProject(request, draft = null) {
  const sourceSteps = unique(draft?.steps || request.steps || []);
  const steps = sourceSteps.length ? sourceSteps : ['Define the result', 'Create the first version', 'Collect proof', 'Review and finish'];
  const projectId = uid('project');
  return {
    id: projectId,
    schema: 'cerbanimo.project.v1',
    requestId: request.id,
    intentionId: request.intentionId,
    title: clean(draft?.title) || titleCase(keywordTopics(request.objective, 5).join(' ') || 'New project'),
    objective: request.objective,
    status: 'active',
    createdAt: new Date().toISOString(),
    tasks: steps.map((step, index) => ({
      id: uid('task'),
      projectId,
      title: clean(step),
      order: index,
      dependencies: index === 0 ? [] : [index - 1],
      completionRequirements: unique(draft?.taskRequirements?.[index] || request.completionRequirements || ['Attach proof that another person can inspect.']),
      skillTags: unique(request.skillTags || []),
      status: index === 0 ? 'ready' : 'blocked',
      proof: [],
      validation: null,
      rewards: {
        cotokens: 1,
        buttons: 2,
        acorns: 1,
        xp: 25
      }
    }))
  };
}

export function taskAvailability(project) {
  const copy = structuredClone(project);
  const completedOrders = new Set(copy.tasks.filter(task => task.status === 'completed').map(task => task.order));
  for (const task of copy.tasks) {
    if (task.status === 'completed' || task.status === 'in-progress' || task.status === 'review') continue;
    task.status = task.dependencies.every(order => completedOrders.has(order)) ? 'ready' : 'blocked';
  }
  if (copy.tasks.every(task => task.status === 'completed')) copy.status = 'completed';
  return copy;
}

export function buildMarketDraft(request, options = {}) {
  return {
    id: uid('listing'),
    schema: 'fellowfare.listing.v1',
    requestId: request.id,
    intentionId: request.intentionId,
    kind: 'request',
    title: clean(options.title) || `Materials for ${titleCase(keywordTopics(request.purpose, 4).join(' ') || 'an intention')}`,
    purpose: request.purpose,
    items: structuredClone(request.items || []),
    offeredButtons: Math.max(0, Number(options.offeredButtons) || 0),
    terms: clean(options.terms) || 'Confirm condition, timing, delivery, and any return expectations before accepting.',
    visibility: options.visibility || 'node',
    status: 'draft',
    createdAt: new Date().toISOString(),
    ownerId: options.ownerId || null,
    remote: false
  };
}

export function rewardEvents({ system, sourceId, rewards, skillTags = [], validator = null, at = new Date().toISOString() }) {
  const events = [];
  const push = (currency, amount, skill = null) => {
    const numeric = Number(amount) || 0;
    if (numeric <= 0) return;
    events.push({ id: uid('reward'), schema: 'commonweave.reward-event.v1', system, sourceId, currency, amount: numeric, skill, validator, createdAt: at });
  };
  push('acorn', rewards?.acorns);
  push('button', rewards?.buttons);
  push('cotoken', rewards?.cotokens);
  for (const skill of unique(skillTags)) push('xp', rewards?.xp, skill);
  return events;
}

export function balances(ledger = []) {
  const result = { acorns: 0, buttons: 0, cotokens: 0, xp: {} };
  for (const event of ledger) {
    if (event.currency === 'xp') result.xp[event.skill || 'general'] = (result.xp[event.skill || 'general'] || 0) + Number(event.amount || 0);
    else if (event.currency === 'acorn') result.acorns += Number(event.amount || 0);
    else if (event.currency === 'button') result.buttons += Number(event.amount || 0);
    else if (event.currency === 'cotoken') result.cotokens += Number(event.amount || 0);
  }
  return result;
}

const PROTECTED_PATHS = [
  'RAILS.md',
  'public/core/protocol.js',
  'public/core/vault.js',
  '.github/',
  '.env',
  'package-lock.json'
];
const FORBIDDEN_PATTERNS = [
  /api[_-]?key\s*[:=]\s*["'][^"']+/i,
  /authorization\s*[:=]\s*["']bearer/i,
  /git\s+push/i,
  /git\s+merge/i,
  /rm\s+-rf\s+\//i,
  /disable\w*rails/i
];

export function patchPaths(diff) {
  const paths = [];
  for (const line of String(diff || '').split(/\r?\n/)) {
    const match = line.match(/^\+\+\+ b\/(.+)$/) || line.match(/^--- a\/(.+)$/);
    if (match && match[1] !== '/dev/null') paths.push(match[1]);
  }
  return unique(paths);
}

export function validatePatch(packet) {
  const errors = [];
  const diff = String(packet?.diff || '').replace(/\r/g, '').trim();
  if (!diff.includes('diff --git')) errors.push('A unified git diff is required.');
  const paths = patchPaths(diff);
  if (!paths.length) errors.push('The patch does not name any files.');
  for (const path of paths) {
    if (path.includes('..') || path.startsWith('/') || PROTECTED_PATHS.some(protectedPath => path === protectedPath || path.startsWith(protectedPath))) {
      errors.push(`Protected path: ${path}`);
    }
    if (!path.startsWith('public/') && !path.startsWith('tests/') && !path.startsWith('docs/')) errors.push(`Path is outside the editable application surface: ${path}`);
  }
  for (const pattern of FORBIDDEN_PATTERNS) if (pattern.test(diff)) errors.push(`Forbidden patch pattern: ${pattern}`);
  if (!Array.isArray(packet?.tests) || packet.tests.length === 0) errors.push('The implementation packet must name at least one acceptance test.');
  if (!Array.isArray(packet?.railsChecked) || packet.railsChecked.length === 0) errors.push('The implementation packet must name the rails it checked.');
  return { ok: errors.length === 0, errors, paths };
}

export { createEnvelope, forwardEnvelope, validateEnvelope };
