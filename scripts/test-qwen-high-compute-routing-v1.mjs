import assert from 'node:assert/strict';
import {
  QWEN_HIGH_MODEL,
  chooseQwenHighCompute,
  qwenHighComputeIntent,
  qwenNeuronsForTokens,
} from '../cloudflare/node-cloud/src/qwen-high-compute-policy-v1.mjs';

const ampleStatus = {
  capacity: { workersPlan: 'free', workersAiFreeRemainingNeurons: 8_000 },
  quota: {
    includedRemainingNeurons: 900,
    lifetimeRemainingNeurons: 5_000,
    debtNeurons: 0,
    workersAiFreeRemainingNeurons: 8_000,
  },
};
const paidStatus = {
  capacity: { workersPlan: 'paid', workersAiFreeRemainingNeurons: 8_000 },
  quota: {
    includedRemainingNeurons: 900,
    lifetimeRemainingNeurons: 5_000,
    debtNeurons: 0,
    workersAiFreeRemainingNeurons: 8_000,
  },
};

assert.equal(
  qwenHighComputeIntent({
    executionProfile: 'interactive',
    purpose: 'civweave-guide-response-chat',
    messages: [{ role: 'user', content: 'Write and debug a JavaScript application for me.' }],
  }),
  false,
  'Arbitrary user prompt wording must never be enough to select Qwen.',
);

assert.equal(
  qwenHighComputeIntent({ executionProfile: 'agentic', purpose: 'quest-generation' }),
  false,
  'Generic agentic work must remain on the normal route.',
);

assert.equal(
  qwenHighComputeIntent({ executionProfile: 'agentic', purpose: 'cerbanimo-code-patch' }),
  true,
  'A code-specific application purpose on the agentic profile may request Qwen.',
);

assert.equal(
  qwenHighComputeIntent({ executionProfile: 'agentic', purpose: 'cerbanimo-work', capabilityRequirements: { code: true } }),
  true,
  'Explicit code capability metadata may request Qwen.',
);

assert.equal(
  qwenHighComputeIntent({ executionProfile: 'interactive', purpose: 'cerbanimo-code-patch', capabilityRequirements: { code: true } }),
  false,
  'Even explicit code metadata must not bypass the agentic-profile gate.',
);

const normalHighCode = chooseQwenHighCompute({
  input: { executionProfile: 'agentic', purpose: 'cerbanimo-code-patch' },
  estimatedTokens: { inputTokens: 1_000, outputTokens: 1_150 },
  memberStatus: ampleStatus,
});
assert.equal(normalHighCode.selected, true);
assert.equal(normalHighCode.model, QWEN_HIGH_MODEL);
assert.equal(normalHighCode.pool, 'included');
assert.equal(normalHighCode.route, 'workers-ai-free');
assert.ok(normalHighCode.estimatedNeurons < 900);
assert.equal(normalHighCode.allowLifetimeCredits, false);

const lowDailyWithoutPermission = chooseQwenHighCompute({
  input: { executionProfile: 'agentic', purpose: 'cerbanimo-code-patch' },
  estimatedTokens: { inputTokens: 1_000, outputTokens: 1_150 },
  memberStatus: { ...paidStatus, quota: { ...paidStatus.quota, includedRemainingNeurons: 300 } },
});
assert.equal(lowDailyWithoutPermission.selected, false);
assert.equal(lowDailyWithoutPermission.reason, 'lifetime-permission-required');

const paidLifetimeAuthorized = chooseQwenHighCompute({
  input: { executionProfile: 'agentic', purpose: 'cerbanimo-code-patch', allowLifetimeCredits: true },
  estimatedTokens: { inputTokens: 1_000, outputTokens: 1_150 },
  memberStatus: { ...paidStatus, quota: { ...paidStatus.quota, includedRemainingNeurons: 300 } },
});
assert.equal(paidLifetimeAuthorized.selected, true);
assert.equal(paidLifetimeAuthorized.route, 'workers-ai-paid-overage');
assert.equal(paidLifetimeAuthorized.pool, 'lifetime');
assert.equal(paidLifetimeAuthorized.allowLifetimeCredits, true);
assert.equal(paidLifetimeAuthorized.reason, 'explicit-high-code-authorized-lifetime');

const freeWorkerCannotLifetimeFundQwen = chooseQwenHighCompute({
  input: { executionProfile: 'agentic', purpose: 'cerbanimo-code-patch', allowLifetimeCredits: true },
  estimatedTokens: { inputTokens: 1_000, outputTokens: 1_150 },
  memberStatus: { ...ampleStatus, quota: { ...ampleStatus.quota, includedRemainingNeurons: 300 } },
});
assert.equal(freeWorkerCannotLifetimeFundQwen.selected, false);
assert.equal(freeWorkerCannotLifetimeFundQwen.reason, 'workers-paid-required-for-lifetime-qwen');

const insufficientLifetime = chooseQwenHighCompute({
  input: { executionProfile: 'agentic', purpose: 'cerbanimo-code-patch', allowLifetimeCredits: true },
  estimatedTokens: { inputTokens: 1_000, outputTokens: 1_150 },
  memberStatus: {
    ...paidStatus,
    quota: { ...paidStatus.quota, includedRemainingNeurons: 300, lifetimeRemainingNeurons: 100 },
  },
});
assert.equal(insufficientLifetime.selected, false);
assert.equal(insufficientLifetime.reason, 'lifetime-credit-budget');

const lifetimeDebt = chooseQwenHighCompute({
  input: { executionProfile: 'agentic', purpose: 'cerbanimo-code-patch', allowLifetimeCredits: true },
  estimatedTokens: { inputTokens: 1_000, outputTokens: 1_150 },
  memberStatus: {
    ...paidStatus,
    quota: { ...paidStatus.quota, includedRemainingNeurons: 300, lifetimeRemainingNeurons: 5_000, debtNeurons: 1 },
  },
});
assert.equal(lifetimeDebt.selected, false);
assert.equal(lifetimeDebt.reason, 'lifetime-credit-debt');

const oversizedGeneration = chooseQwenHighCompute({
  input: { executionProfile: 'agentic', purpose: 'cerbanimo-code-patch' },
  estimatedTokens: { inputTokens: 1_000, outputTokens: 4_711 },
  memberStatus: ampleStatus,
});
assert.equal(oversizedGeneration.selected, false);
assert.equal(oversizedGeneration.reason, 'lifetime-permission-required');
assert.ok(oversizedGeneration.estimatedNeurons > 900);

const sharedFreeExhausted = chooseQwenHighCompute({
  input: { executionProfile: 'agentic', purpose: 'cerbanimo-code-patch' },
  estimatedTokens: { inputTokens: 500, outputTokens: 800 },
  memberStatus: {
    capacity: { workersPlan: 'free', workersAiFreeRemainingNeurons: 10 },
    quota: { includedRemainingNeurons: 900, lifetimeRemainingNeurons: 5_000, debtNeurons: 0, workersAiFreeRemainingNeurons: 10 },
  },
});
assert.equal(sharedFreeExhausted.selected, false);
assert.equal(sharedFreeExhausted.reason, 'shared-workers-free-budget');

const paidWorkersIncluded = chooseQwenHighCompute({
  input: { executionProfile: 'agentic', taskTier: 'programming', purpose: 'cerbanimo-work', allowLifetimeCredits: true },
  estimatedTokens: { inputTokens: 500, outputTokens: 800 },
  memberStatus: {
    capacity: { workersPlan: 'paid', workersAiFreeRemainingNeurons: 10 },
    quota: { includedRemainingNeurons: 900, lifetimeRemainingNeurons: 5_000, debtNeurons: 0, workersAiFreeRemainingNeurons: 10 },
  },
});
assert.equal(paidWorkersIncluded.selected, true);
assert.equal(paidWorkersIncluded.route, 'workers-ai-paid-overage');
assert.equal(paidWorkersIncluded.pool, 'included');
assert.equal(paidWorkersIncluded.allowLifetimeCredits, false, 'Included neurons are spent before lifetime credits even when permission exists.');

assert.equal(qwenNeuronsForTokens(1_000_000, 0), 40_909);
assert.equal(qwenNeuronsForTokens(0, 1_000_000), 290_909);

console.log(JSON.stringify({
  ok: true,
  revision: 'qwen-high-compute-routing-v1-paid-lifetime',
  model: QWEN_HIGH_MODEL,
  cases: {
    normalHighCode,
    lowDailyWithoutPermission,
    paidLifetimeAuthorized,
    freeWorkerCannotLifetimeFundQwen,
    insufficientLifetime,
    lifetimeDebt,
    oversizedGeneration,
    sharedFreeExhausted,
    paidWorkersIncluded,
  },
}, null, 2));
