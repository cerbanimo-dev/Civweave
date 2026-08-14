const MODEL_PROFILES = Object.freeze({
  quick: Object.freeze({
    id: '@cf/zai-org/glm-4.7-flash',
    inputNeuronsPerMillion: 5_455,
    outputNeuronsPerMillion: 36_364,
    label: 'fast multilingual dialogue and instruction following',
  }),
  smart: Object.freeze({
    id: '@cf/google/gemma-4-26b-a4b-it',
    inputNeuronsPerMillion: 9_091,
    outputNeuronsPerMillion: 27_273,
    label: 'substantive drafting, analysis, vision, and moderate reasoning',
  }),
  deep: Object.freeze({
    id: '@cf/openai/gpt-oss-120b',
    inputNeuronsPerMillion: 31_818,
    outputNeuronsPerMillion: 68_182,
    label: 'high-reasoning and agentic work',
  }),
  qwen: Object.freeze({
    id: '@cf/qwen/qwen2.5-coder-32b-instruct',
    inputNeuronsPerMillion: 60_000,
    outputNeuronsPerMillion: 90_909,
    label: 'code-specialized free-server escalation',
  }),
  code: Object.freeze({
    id: '@cf/moonshotai/kimi-k2.7-code',
    inputNeuronsPerMillion: 86_364,
    outputNeuronsPerMillion: 363_636,
    label: 'specialist coding and long-horizon software implementation',
  }),
});

const clean = (value, max = 48_000) => String(value ?? '').trim().slice(0, max);
const CODE_TASK = /\b(code|software|debug|refactor|patch|program|script|typescript|javascript|python|react|sql|api|database|compiler|repository|pull request)\b/;
const PLAN_TASK = /\b(plan|planning|roadmap|milestone|curriculum|quest|proposal|draft|analysis|analy[sz]e|evaluate|assess|recommend|work breakdown)\b/;
const COMPLEX_TASK = /\b(multi[- ]system|cross[- ]realm|long[- ]horizon|architecture|threat model|formal verification|migration strategy|distributed system|consensus|high[- ]consequence|high stakes|safety critical|ambiguous multi[- ]step|agent planning)\b/;
const PATCH_HEAVY_TASK = /\b(repo[- ]scale|multi[- ]file|many files|stack trace|failing tests?|test failures?|regression|dependency conflict|merge conflict|large patch|deep debugging|complex debugging)\b/;

function structuredContextText(value) {
  const text = clean(value);
  const marker = text.match(/^Structured context:\s*([\s\S]+)$/i);
  if (!marker) return text;
  try { return clean(JSON.parse(marker[1])?.userMessage || text); }
  catch { return text; }
}

function taskText(input = {}) {
  const task = input.task && typeof input.task === 'object' ? input.task : {};
  const direct = clean(task.text || input.taskText || input.prompt);
  if (direct) return direct;
  const users = (Array.isArray(input.messages) ? input.messages : []).filter(item => item?.role !== 'system');
  return structuredContextText(users.at(-1)?.content || '');
}

function normalizedRequirements(input = {}) {
  const explicit = input.capabilityRequirements && typeof input.capabilityRequirements === 'object'
    ? input.capabilityRequirements
    : {};
  const task = input.task && typeof input.task === 'object' ? input.task : {};
  const text = taskText(input).toLowerCase();
  const taskKind = clean(task.kind || input.taskKind || 'general', 80).toLowerCase();
  const complexity = clean(task.complexity || explicit.complexity, 40).toLowerCase();
  return Object.freeze({
    taskKind,
    agentic: input.executionProfile === 'agentic' || explicit.profile === 'agentic' || input.agentic === true,
    requiresTools: explicit.requiresTools === true || input.requiresTools === true,
    externalResearch: explicit.externalResearch === true || input.externalResearch === true,
    code: explicit.code === true || input.code === true || taskKind === 'code-project' || CODE_TASK.test(text),
    planning: explicit.planning === true || /(?:draft|plan|project|proposal|curriculum|quest|weave)/.test(taskKind) || PLAN_TASK.test(text),
    vision: explicit.vision === true || input.vision === true || input.imageInput === true,
    structured: Boolean(input.responseSchema || input.responseFormat === 'json' || input.responseFormat === 'structured'),
    complex: explicit.complexity === true || complexity === 'complex' || COMPLEX_TASK.test(text),
    substantive: explicit.substantive === true || PLAN_TASK.test(text) || text.length > 320,
    patchHeavy: explicit.patchHeavy === true || PATCH_HEAVY_TASK.test(text) || (/\b(?:debug|patch|refactor)\b/.test(text) && text.length > 500),
    schemaBytes: input.responseSchema && typeof input.responseSchema === 'object' ? JSON.stringify(input.responseSchema).length : 0,
    textBytes: text.length,
  });
}

export function selectWorkersAiModel(input = {}) {
  const requirements = normalizedRequirements(input);
  const smartCeiling = clean(input.modelTierCeiling, 20).toLowerCase() === 'smart';
  const paidServer = clean(input.workersPlan, 20).toLowerCase() === 'paid';
  const specialistCode = requirements.code && !smartCeiling;
  const highReasoning = !specialistCode && !smartCeiling && (requirements.agentic
    || requirements.complex
    || requirements.schemaBytes > 8_000
    || requirements.textBytes > 12_000);
  const smart = !specialistCode && !highReasoning && (requirements.planning
    || requirements.vision
    || requirements.requiresTools
    || requirements.externalResearch
    || requirements.code
    || requirements.substantive
    || (requirements.structured && !['dialogue','conversation','question-answer'].includes(requirements.taskKind)));
  const tier = specialistCode ? 'code' : highReasoning ? 'deep' : smart ? 'smart' : 'quick';
  const variant = specialistCode ? (paidServer ? 'advanced' : 'standard') : tier;
  const pipeline = specialistCode
    ? (paidServer
      ? [MODEL_PROFILES.code.id]
      : [MODEL_PROFILES.smart.id, MODEL_PROFILES.qwen.id, MODEL_PROFILES.deep.id])
    : [MODEL_PROFILES[tier].id];
  const profile = Object.values(MODEL_PROFILES).find(item => item.id === pipeline[0]);
  const reasons = Object.entries(requirements)
    .filter(([key, value]) => !['taskKind','schemaBytes', 'textBytes'].includes(key) && value === true)
    .map(([key]) => key);
  return Object.freeze({
    schema: 'civweave.workers-ai-model-route.v1',
    model: profile.id,
    tier,
    variant,
    pipeline: Object.freeze(pipeline),
    reason: reasons.length ? reasons.join(', ') : `${requirements.taskKind} request`,
    requirements,
  });
}

export function neuronRatesForModel(model) {
  return Object.values(MODEL_PROFILES).find(profile => profile.id === model) || MODEL_PROFILES.code;
}

export function estimateGenerationNeurons(inputTokens, outputTokens, model) {
  const rates = neuronRatesForModel(model);
  const input = Math.max(0, Number(inputTokens) || 0);
  const output = Math.max(0, Number(outputTokens) || 0);
  return Math.max(1, Math.ceil((input * rates.inputNeuronsPerMillion + output * rates.outputNeuronsPerMillion) / 1_000_000));
}

export const WORKERS_AI_MODEL_PROFILES = MODEL_PROFILES;
