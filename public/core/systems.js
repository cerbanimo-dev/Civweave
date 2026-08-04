import { ask, askJson, aiStatus } from './ai.js';
import { addRecord, appendLedger, readState, updateState } from './store.js';
import { buildCurriculum, buildIntention, buildMarketDraft, buildProject, rewardEvents, taskAvailability, unlockCurriculum, validatePatch } from './domain.js';
import * as mesh from './mesh.js';
import { semanticMatch } from './local-model.js';

const jsonInstruction = schema => `Return one JSON object matching this shape. Do not add markdown.\n${JSON.stringify(schema, null, 2)}`;

export async function createIntention(wish) {
  const result = await askJson({
    system: 'commonweave',
    prompt: `${wish}\n\n${jsonInstruction({
      title: 'short title', outcome: 'observable outcome',
      learning: { goal: 'learning goal', topics: ['topic'], desiredEvidence: 'evidence', skillTags: ['skill'] },
      tasks: { objective: 'project objective', steps: ['step'], completionRequirements: ['requirement'], skillTags: ['skill'] },
      materials: { purpose: 'why materials are needed', items: [{ name: 'item', quantity: 1, unit: 'item', required: true, notes: '' }] }
    })}`,
    context: 'Turn the wish into one coherent intention and three typed downstream requests.',
    temperature: 0.2
  }).catch(error => ({ ok: false, reason: error.message }));
  const intention = buildIntention(wish, result.ok ? result.data : null);
  if (!result.ok) {
    try {
      const semantic = await semanticMatch(wish, { limit: 3, timeoutMs: 15000 });
      intention.semanticRoute = { device: semantic.device, matches: semantic.matches };
    } catch { intention.semanticRoute = null; }
  }
  addRecord('intentions', intention);
  return { intention, ai: result };
}

export function activateIntention(id) {
  return updateState(state => {
    const intention = state.intentions.find(item => item.id === id);
    if (!intention) throw new Error('Intention not found.');
    intention.status = 'active';
    intention.activatedAt = new Date().toISOString();
    for (const [collection, request] of [
      ['learningRequests', intention.learningRequest],
      ['taskRequests', intention.taskRequest],
      ['materialsRequests', intention.materialsRequest]
    ]) if (!state[collection].some(item => item.id === request.id)) state[collection].unshift(structuredClone(request));
    return state;
  });
}

export async function generateCurriculum(requestId) {
  const request = readState().learningRequests.find(item => item.id === requestId);
  if (!request) throw new Error('Learning request not found.');
  const result = await askJson({
    system: 'living-school',
    prompt: `${JSON.stringify(request)}\n\n${jsonInstruction({
      title: 'curriculum title',
      topics: ['topic'],
      modules: [{
        title: 'module title', objective: 'observable objective', skillTags: ['skill'],
        sections: [{ kind: 'text|video|image|diagram|practice', title: 'section title', content: 'content', url: 'optional URL', nodes: ['optional diagram node'], prompt: 'optional practice prompt' }],
        assessment: [{ type: 'choice|short|essay', prompt: 'question', options: ['optional'], answer: 'optional', rubric: 'rubric' }],
        rewards: { acorns: 2, xp: 20 }
      }]
    })}`,
    context: 'Build a practical curriculum. Only include media URLs you have reason to believe are real. Use a mix of explanation, practice, diagrams, and assessments.',
    temperature: 0.35
  }).catch(error => ({ ok: false, reason: error.message }));
  let curriculum = buildCurriculum(request, result.ok ? result.data : null);
  if (aiStatus().antigravityEnabled && curriculum.modules[0]) {
    const research = await askJson({
      system: 'living-school',
      research: true,
      prompt: `${curriculum.modules[0].title}\n${curriculum.modules[0].objective}\n\n${jsonInstruction({ summary: 'research summary', sources: [{ title: 'source', url: 'https://...' }], youtube: [{ title: 'video', url: 'https://www.youtube.com/watch?v=...' }], imageIdeas: ['diagram or image idea'] })}`,
      context: 'Research the first learning module. Prefer primary sources and suitable educational YouTube videos. Do not fabricate URLs.',
      temperature: 0.1
    }).catch(error => ({ ok: false, reason: error.message }));
    if (research.ok) curriculum.modules[0].research = research.data;
  }
  curriculum = unlockCurriculum(curriculum);
  addRecord('curricula', curriculum);
  return { curriculum, ai: result };
}

export async function validateLearningAnswer({ curriculumId, moduleId, question, answer }) {
  const result = await askJson({
    system: 'living-school',
    prompt: `${jsonInstruction({ pass: true, score: 0.8, feedback: 'specific feedback', evidence: ['what the answer demonstrated'], missing: ['what is missing'] })}\n\nQuestion: ${question.prompt}\nRubric: ${question.rubric}\nAnswer: ${answer}`,
    context: 'Evaluate the answer against the stated rubric. Be demanding but fair. Never claim certainty beyond the evidence.',
    temperature: 0.1
  }).catch(error => ({ ok: false, reason: error.message }));
  if (result.ok) return result.data;
  const words = String(answer || '').trim().split(/\s+/).filter(Boolean).length;
  return { pass: words >= (question.type === 'essay' ? 80 : 20), score: Math.min(1, words / (question.type === 'essay' ? 120 : 35)), feedback: 'Local fallback checks completeness only. Connect an AI source for rubric-aware validation.', evidence: [`${words} words submitted`], missing: words ? [] : ['No answer submitted'] };
}

export function completeModule(curriculumId, moduleId, validation) {
  let rewards = [];
  updateState(state => {
    const curriculum = state.curricula.find(item => item.id === curriculumId);
    const module = curriculum?.modules.find(item => item.id === moduleId);
    if (!module) throw new Error('Learning module not found.');
    if (!validation?.pass) throw new Error('The assessment has not passed.');
    module.status = 'completed';
    module.completedAt = new Date().toISOString();
    module.validation = validation;
    const next = unlockCurriculum(curriculum);
    Object.assign(curriculum, next);
    rewards = rewardEvents({ system: 'living-school', sourceId: module.id, rewards: module.rewards, skillTags: module.skillTags, validator: validation.provider || 'local' });
    return state;
  });
  appendLedger(rewards);
  return rewards;
}

export async function generateProject(requestId) {
  const request = readState().taskRequests.find(item => item.id === requestId);
  if (!request) throw new Error('Task request not found.');
  const result = await askJson({
    system: 'cerbanimo',
    prompt: `${JSON.stringify(request)}\n\n${jsonInstruction({ title: 'project title', steps: ['dependency ordered task'], taskRequirements: [['requirement for task 1'], ['requirement for task 2']] })}`,
    context: 'Break the work into dependency-ordered tasks with observable completion requirements and useful proof.',
    temperature: 0.25
  }).catch(error => ({ ok: false, reason: error.message }));
  const project = buildProject(request, result.ok ? result.data : null);
  addRecord('projects', project);
  return { project, ai: result };
}

export function startTask(projectId, taskId) {
  return updateState(state => {
    const project = state.projects.find(item => item.id === projectId);
    const task = project?.tasks.find(item => item.id === taskId);
    if (!task || task.status !== 'ready') throw new Error('Task is not ready.');
    task.status = 'in-progress';
    task.startedAt = new Date().toISOString();
    return state;
  });
}

export function addTaskProof(projectId, taskId, proof) {
  return updateState(state => {
    const project = state.projects.find(item => item.id === projectId);
    const task = project?.tasks.find(item => item.id === taskId);
    if (!task) throw new Error('Task not found.');
    task.proof.push({ id: crypto.randomUUID(), note: String(proof.note || '').trim(), url: String(proof.url || '').trim(), createdAt: new Date().toISOString() });
    task.status = 'review';
    return state;
  });
}

export async function validateTask(projectId, taskId, { crossValidate = false } = {}) {
  const state = readState();
  const project = state.projects.find(item => item.id === projectId);
  const task = project?.tasks.find(item => item.id === taskId);
  if (!task) throw new Error('Task not found.');
  if (crossValidate) {
    const envelope = await mesh.publish('validation.request', { projectId, taskId, title: task.title, requirements: task.completionRequirements, proof: task.proof, requester: state.profile.id });
    return { pending: true, envelopeId: envelope.id };
  }
  const result = await askJson({
    system: 'cerbanimo',
    prompt: `${jsonInstruction({ pass: true, confidence: 0.8, feedback: 'validation feedback', requirementResults: [{ requirement: 'requirement', pass: true, reason: 'reason' }] })}\n\nTask: ${task.title}\nRequirements: ${JSON.stringify(task.completionRequirements)}\nProof: ${JSON.stringify(task.proof)}`,
    context: 'Validate only what the submitted proof supports. Reject unsupported completion claims.',
    temperature: 0.1
  }).catch(error => ({ ok: false, reason: error.message }));
  const validation = result.ok ? { ...result.data, provider: result.provider?.name || 'AI' } : { pass: task.proof.some(item => item.note.length >= 20 || item.url), confidence: 0.35, feedback: 'Local fallback checks only that inspectable proof was supplied.', provider: 'local fallback' };
  return finishTaskValidation(projectId, taskId, validation);
}

export function finishTaskValidation(projectId, taskId, validation) {
  let rewards = [];
  updateState(state => {
    const project = state.projects.find(item => item.id === projectId);
    const task = project?.tasks.find(item => item.id === taskId);
    if (!task) throw new Error('Task not found.');
    task.validation = validation;
    if (validation.pass) {
      task.status = 'completed';
      task.completedAt = new Date().toISOString();
      rewards = rewardEvents({ system: 'cerbanimo', sourceId: task.id, rewards: task.rewards, skillTags: task.skillTags, validator: validation.provider || validation.validatorId || 'unknown' });
    } else task.status = 'in-progress';
    Object.assign(project, taskAvailability(project));
    return state;
  });
  appendLedger(rewards);
  return { validation, rewards };
}

export function createListing(requestId, options = {}) {
  const request = readState().materialsRequests.find(item => item.id === requestId);
  if (!request) throw new Error('Materials request not found.');
  const listing = buildMarketDraft(request, { ...options, ownerId: readState().profile.id });
  addRecord('listings', listing);
  return listing;
}

export async function publishListing(listingId) {
  let listing;
  updateState(state => {
    listing = state.listings.find(item => item.id === listingId);
    if (!listing) throw new Error('Listing not found.');
    listing.status = 'open';
    listing.publishedAt = new Date().toISOString();
    return state;
  });
  await mesh.publish('trade.request', listing);
  return listing;
}

export async function createImplementationRequest({ kind, title, description }) {
  const request = { id: crypto.randomUUID(), schema: 'anarchadia.change-request.v1', kind, title, description, status: 'drafting', createdAt: new Date().toISOString() };
  addRecord('featureRequests', request);
  const result = await askJson({
    system: 'anarchadia',
    prompt: `${jsonInstruction({ summary: 'implementation summary', assumptions: ['assumption'], railsChecked: ['rail'], tests: ['test'], diff: 'unified git diff beginning with diff --git' })}\n\nKind: ${kind}\nTitle: ${title}\nRequest: ${description}`,
    context: 'Produce a minimal implementation patch for the plain HTML/CSS/JS application. Do not modify protected rails, secrets, workflows, package locks, or server security. The diff may edit public/, tests/, or docs/.',
    temperature: 0.15
  }).catch(error => ({ ok: false, reason: error.message }));
  const packet = {
    id: crypto.randomUUID(),
    requestId: request.id,
    schema: 'anarchadia.implementation-packet.v1',
    status: 'review',
    createdAt: new Date().toISOString(),
    summary: result.ok ? result.data.summary : 'No generative provider is available. Draft the unified diff manually.',
    assumptions: result.ok ? result.data.assumptions || [] : [],
    railsChecked: result.ok ? result.data.railsChecked || [] : [],
    tests: result.ok ? result.data.tests || [] : [],
    diff: result.ok ? result.data.diff || '' : '',
    validation: null
  };
  packet.validation = validatePatch(packet);
  addRecord('implementationPackets', packet);
  updateState(state => {
    const stored = state.featureRequests.find(item => item.id === request.id);
    if (stored) stored.status = 'review';
    return state;
  });
  return { request, packet, ai: result };
}

export async function applyImplementation(packetId, phrase) {
  const packet = readState().implementationPackets.find(item => item.id === packetId);
  if (!packet) throw new Error('Implementation packet not found.');
  const validation = validatePatch(packet);
  if (!validation.ok) throw new Error(validation.errors.join('\n'));
  const response = await fetch('/api/anarchadia/apply', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ packet, approvalPhrase: phrase }) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Local node returned ${response.status}.`);
  updateState(state => {
    const stored = state.implementationPackets.find(item => item.id === packetId);
    if (stored) { stored.status = 'implemented-on-branch'; stored.execution = result; }
    return state;
  });
  return result;
}

export async function guide(system, message) {
  const result = await ask({ system, prompt: message, context: 'Help the user operate the current system. Give a concrete next action and do not pretend an action was completed unless it exists in application state.' });
  return result.ok ? result.text : 'No generative source is unlocked. The local application remains functional through its forms and deterministic planners.';
}

window.addEventListener('commonweave:mesh', async event => {
  const envelope = event.detail.envelope;
  if (envelope.type === 'trade.request') {
    const listing = { ...envelope.payload, id: envelope.payload.id || envelope.id, remote: true, origin: envelope.origin };
    addRecord('listings', listing);
  }
  if (envelope.type === 'validation.receipt') {
    const receipt = envelope.payload;
    addRecord('validations', receipt);
    if (receipt.projectId && receipt.taskId) finishTaskValidation(receipt.projectId, receipt.taskId, { ...receipt.validation, provider: `peer ${envelope.origin}`, validatorId: envelope.origin });
  }
  if (envelope.type === 'validation.request' && readState().profile.autoValidate) {
    const request = envelope.payload;
    const result = await askJson({
      system: 'cerbanimo',
      prompt: `${jsonInstruction({ pass: true, confidence: 0.8, feedback: 'feedback' })}\n\nRequirements: ${JSON.stringify(request.requirements)}\nProof: ${JSON.stringify(request.proof)}`,
      context: 'You are validating another user’s proof. Validate only the submitted evidence.',
      temperature: 0.1
    }).catch(() => ({ ok: false }));
    const validation = result.ok ? result.data : { pass: false, confidence: 0, feedback: 'This node has no unlocked AI validator.' };
    await mesh.publish('validation.receipt', { projectId: request.projectId, taskId: request.taskId, requestEnvelopeId: envelope.id, validation }, { target: envelope.origin });
  }
});
