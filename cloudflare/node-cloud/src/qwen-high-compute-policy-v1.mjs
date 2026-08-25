export const QWEN_HIGH_COMPUTE_SCHEMA = 'civweave.qwen-high-compute-policy.v1';
export const QWEN_HIGH_MODEL = '@cf/qwen/qwen3.8-27b';
export const QWEN_INPUT_NEURONS_PER_MILLION = 40_909;
export const QWEN_OUTPUT_NEURONS_PER_MILLION = 290_909;

const clean = (value, max = 240) => String(value ?? '').trim().slice(0, max);
const lower = value => clean(value).toLowerCase();
const nonNegative = value => Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0);

/**
 * Qwen 3.8 27B is intentionally not selected from arbitrary user-message text.
 * A request must already be on the agentic execution profile and carry explicit
 * code/implementation metadata (or a code-specific application purpose).
 */
export function qwenHighComputeIntent(input = {}) {
  const profile = lower(input.executionProfile || input.profile);
  if (profile !== 'agentic') return false;

  const requirements = input.capabilityRequirements && typeof input.capabilityRequirements === 'object'
    ? input.capabilityRequirements
    : {};
  if (requirements.code === true || input.code === true) return true;

  const tier = lower(input.taskTier || input.modelTier || input.complexity || input.executionClass);
  if (['code', 'coding', 'programming', 'implementation', 'software-engineering'].includes(tier)) return true;

  if (lower(input.highComputeClass) === 'qwen-code') return true;

  const purpose = lower(input.purpose);
  return /(?:^|[-_:])(code|coding|programming|software|debug|debugging|refactor|patch|repository|repo|developer)(?:[-_:]|$)/.test(purpose);
}

export function qwenNeuronsForTokens(inputTokens = 0, outputTokens = 0) {
  const input = nonNegative(inputTokens), output = nonNegative(outputTokens);
  return Math.max(1, Math.ceil((input * QWEN_INPUT_NEURONS_PER_MILLION + output * QWEN_OUTPUT_NEURONS_PER_MILLION) / 1_000_000));
}

function notSelected(reason, details = {}) {
  return Object.freeze({
    schema: QWEN_HIGH_COMPUTE_SCHEMA,
    selected: false,
    reason,
    model: QWEN_HIGH_MODEL,
    ...details,
  });
}

function selected({ reason, route, pool, estimatedNeurons, includedRemainingNeurons, lifetimeRemainingNeurons, sharedFreeRemainingNeurons, allowLifetimeCredits }) {
  return Object.freeze({
    schema: QWEN_HIGH_COMPUTE_SCHEMA,
    selected: true,
    reason,
    model: QWEN_HIGH_MODEL,
    route,
    pool,
    estimatedNeurons,
    includedRemainingNeurons,
    lifetimeRemainingNeurons,
    sharedFreeRemainingNeurons,
    allowLifetimeCredits,
  });
}

/**
 * Qwen keeps a strict task-selection gate, but uses the same funding boundary as
 * the rest of Civweave: included neurons first, then a whole-request switch to
 * lifetime credits only when the caller explicitly authorizes them. Lifetime-
 * funded Qwen requires a paid Workers host because Qwen is executed on Workers AI
 * and the paid-overage rail is unavailable on a Workers Free host.
 */
export function chooseQwenHighCompute({ input = {}, estimatedTokens = {}, memberStatus = {} } = {}) {
  if (!qwenHighComputeIntent(input)) return notSelected('not-explicit-high-code');

  const estimatedNeurons = qwenNeuronsForTokens(estimatedTokens.inputTokens, estimatedTokens.outputTokens);
  const includedRemainingNeurons = nonNegative(memberStatus?.quota?.includedRemainingNeurons);
  const lifetimeRemainingNeurons = nonNegative(memberStatus?.quota?.lifetimeRemainingNeurons);
  const debtNeurons = nonNegative(memberStatus?.quota?.debtNeurons);
  const sharedFreeRemainingNeurons = nonNegative(
    memberStatus?.quota?.workersAiFreeRemainingNeurons ?? memberStatus?.capacity?.workersAiFreeRemainingNeurons,
  );
  const paidWorkers = lower(memberStatus?.capacity?.workersPlan) === 'paid';

  if (estimatedNeurons <= includedRemainingNeurons) {
    if (estimatedNeurons <= sharedFreeRemainingNeurons) return selected({
      reason: 'explicit-high-code-within-included-budget',
      route: 'workers-ai-free',
      pool: 'included',
      estimatedNeurons,
      includedRemainingNeurons,
      lifetimeRemainingNeurons,
      sharedFreeRemainingNeurons,
      allowLifetimeCredits: false,
    });

    if (paidWorkers) return selected({
      reason: 'explicit-high-code-within-included-budget',
      route: 'workers-ai-paid-overage',
      pool: 'included',
      estimatedNeurons,
      includedRemainingNeurons,
      lifetimeRemainingNeurons,
      sharedFreeRemainingNeurons,
      allowLifetimeCredits: false,
    });

    return notSelected('shared-workers-free-budget', {
      estimatedNeurons,
      includedRemainingNeurons,
      lifetimeRemainingNeurons,
      sharedFreeRemainingNeurons,
    });
  }

  if (input.allowLifetimeCredits !== true) return notSelected('lifetime-permission-required', {
    estimatedNeurons,
    includedRemainingNeurons,
    lifetimeRemainingNeurons,
    sharedFreeRemainingNeurons,
  });

  if (!paidWorkers) return notSelected('workers-paid-required-for-lifetime-qwen', {
    estimatedNeurons,
    includedRemainingNeurons,
    lifetimeRemainingNeurons,
    sharedFreeRemainingNeurons,
  });

  if (debtNeurons > 0) return notSelected('lifetime-credit-debt', {
    estimatedNeurons,
    includedRemainingNeurons,
    lifetimeRemainingNeurons,
    sharedFreeRemainingNeurons,
    debtNeurons,
  });

  if (estimatedNeurons > lifetimeRemainingNeurons) return notSelected('lifetime-credit-budget', {
    estimatedNeurons,
    includedRemainingNeurons,
    lifetimeRemainingNeurons,
    sharedFreeRemainingNeurons,
  });

  return selected({
    reason: 'explicit-high-code-authorized-lifetime',
    route: 'workers-ai-paid-overage',
    pool: 'lifetime',
    estimatedNeurons,
    includedRemainingNeurons,
    lifetimeRemainingNeurons,
    sharedFreeRemainingNeurons,
    allowLifetimeCredits: true,
  });
}
