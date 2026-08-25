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

/**
 * Selection is included-pool only. Qwen never consumes lifetime credits and
 * never upgrades a request to paid compute merely because the high tier was
 * requested. When it does not fit, the caller should fall through to the normal
 * low-cost router unchanged.
 */
export function chooseQwenHighCompute({ input = {}, estimatedTokens = {}, memberStatus = {} } = {}) {
  if (!qwenHighComputeIntent(input)) return Object.freeze({
    schema: QWEN_HIGH_COMPUTE_SCHEMA,
    selected: false,
    reason: 'not-explicit-high-code',
    model: QWEN_HIGH_MODEL,
  });

  const estimatedNeurons = qwenNeuronsForTokens(estimatedTokens.inputTokens, estimatedTokens.outputTokens);
  const includedRemainingNeurons = nonNegative(memberStatus?.quota?.includedRemainingNeurons);
  if (estimatedNeurons > includedRemainingNeurons) return Object.freeze({
    schema: QWEN_HIGH_COMPUTE_SCHEMA,
    selected: false,
    reason: 'included-daily-budget',
    model: QWEN_HIGH_MODEL,
    estimatedNeurons,
    includedRemainingNeurons,
  });

  const sharedFreeRemainingNeurons = nonNegative(
    memberStatus?.quota?.workersAiFreeRemainingNeurons ?? memberStatus?.capacity?.workersAiFreeRemainingNeurons,
  );
  const paidWorkers = lower(memberStatus?.capacity?.workersPlan) === 'paid';
  let route = 'workers-ai-free';
  if (estimatedNeurons > sharedFreeRemainingNeurons) {
    if (!paidWorkers) return Object.freeze({
      schema: QWEN_HIGH_COMPUTE_SCHEMA,
      selected: false,
      reason: 'shared-workers-free-budget',
      model: QWEN_HIGH_MODEL,
      estimatedNeurons,
      includedRemainingNeurons,
      sharedFreeRemainingNeurons,
    });
    route = 'workers-ai-paid-overage';
  }

  return Object.freeze({
    schema: QWEN_HIGH_COMPUTE_SCHEMA,
    selected: true,
    reason: 'explicit-high-code-within-included-budget',
    model: QWEN_HIGH_MODEL,
    route,
    pool: 'included',
    estimatedNeurons,
    includedRemainingNeurons,
    sharedFreeRemainingNeurons,
    allowLifetimeCredits: false,
  });
}
