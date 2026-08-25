import assert from 'node:assert/strict';
import {
  QWEN_HIGH_MODEL,
  chooseQwenHighCompute,
  qwenHighComputeIntent,
  qwenNeuronsForTokens,
} from '../cloudflare/node-cloud/src/qwen-high-compute-policy-v1.mjs';

const ampleStatus = {
  capacity: { workersPlan: 'free', workersAiFreeRemainingNeurons: 8_000 },
  quota: { includedRemainingNeurons: 900, workersAiFreeRemainingNeurons: 8_000 },
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

const lowDailyBalance = chooseQwenHighCompute({
  input: { executionProfile: 'agentic', purpose: 'cerbanimo-code-patch', allowLifetimeCredits: true },
  estimatedTokens: { inputTokens: 1_000, outputTokens: 1_150 },
  memberStatus: { ...ampleStatus, quota: { ...ampleStatus.quota, includedRemainingNeurons: 300 } },
});
assert.equal(lowDailyBalance.selected, false);
assert.equal(lowDailyBalance.reason, 'included-daily-budget');

const oversizedGeneration = chooseQwenHighCompute({
  input: { executionProfile: 'agentic', purpose: 'cerbanimo-code-patch' },
  estimatedTokens: { inputTokens: 1_000, outputTokens: 4_711 },
  memberStatus: ampleStatus,
});
assert.equal(oversizedGeneration.selected, false);
assert.equal(oversizedGeneration.reason, 'included-daily-budget');
assert.ok(oversizedGeneration.estimatedNeurons > 900);

const sharedFreeExhausted = chooseQwenHighCompute({
  input: { executionProfile: 'agentic', purpose: 'cerbanimo-code-patch' },
  estimatedTokens: { inputTokens: 500, outputTokens: 800 },
  memberStatus: {
    capacity: { workersPlan: 'free', workersAiFreeRemainingNeurons: 10 },
    quota: { includedRemainingNeurons: 900, workersAiFreeRemainingNeurons: 10 },
  },
});
assert.equal(sharedFreeExhausted.selected, false);
assert.equal(sharedFreeExhausted.reason, 'shared-workers-free-budget');

const paidWorkersIncluded = chooseQwenHighCompute({
  input: { executionProfile: 'agentic', taskTier: 'programming', purpose: 'cerbanimo-work' },
  estimatedTokens: { inputTokens: 500, outputTokens: 800 },
  memberStatus: {
    capacity: { workersPlan: 'paid', workersAiFreeRemainingNeurons: 10 },
    quota: { includedRemainingNeurons: 900, workersAiFreeRemainingNeurons: 10 },
  },
});
assert.equal(paidWorkersIncluded.selected, true);
assert.equal(paidWorkersIncluded.route, 'workers-ai-paid-overage');
assert.equal(paidWorkersIncluded.pool, 'included');
assert.equal(paidWorkersIncluded.allowLifetimeCredits, false);

assert.equal(qwenNeuronsForTokens(1_000_000, 0), 40_909);
assert.equal(qwenNeuronsForTokens(0, 1_000_000), 290_909);

console.log(JSON.stringify({
  ok: true,
  revision: 'qwen-high-compute-routing-v1',
  model: QWEN_HIGH_MODEL,
  cases: { normalHighCode, lowDailyBalance, oversizedGeneration, sharedFreeExhausted, paidWorkersIncluded },
}, null, 2));
