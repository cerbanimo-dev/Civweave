import assert from 'node:assert/strict';
import { chooseUserAiPoolRoute } from '../cloudflare/node-cloud/src/user-ai-pool-router-v2.mjs';

const freeIncluded = chooseUserAiPoolRoute({ workersPlan:'free', includedRemainingNeurons:500, sharedFreeRemainingNeurons:9000, workersEstimateNeurons:100, gatewayEstimateNeurons:400 });
assert.equal(freeIncluded.route,'workers-ai-free');
assert.equal(freeIncluded.pool,'included');
assert.equal(freeIncluded.quotaNeurons,100);

const personalPoolExhaustedFirst = chooseUserAiPoolRoute({ workersPlan:'free', includedRemainingNeurons:50, sharedFreeRemainingNeurons:9000, workersEstimateNeurons:100, gatewayEstimateNeurons:400 });
assert.equal(personalPoolExhaustedFirst.route,'ai-gateway-unified-billing','Personal allowance exhaustion must switch the next whole request even while the account has shared free neurons.');
assert.equal(personalPoolExhaustedFirst.pool,'lifetime');
assert.equal(personalPoolExhaustedFirst.quotaNeurons,400);

const sharedPoolExhaustedFirst = chooseUserAiPoolRoute({ workersPlan:'free', includedRemainingNeurons:500, sharedFreeRemainingNeurons:50, workersEstimateNeurons:100, gatewayEstimateNeurons:400 });
assert.equal(sharedPoolExhaustedFirst.route,'ai-gateway-unified-billing');
assert.equal(sharedPoolExhaustedFirst.pool,'included');
assert.equal(sharedPoolExhaustedFirst.quotaNeurons,100);
assert.equal(sharedPoolExhaustedFirst.providerNeurons,400);

const paidWorkersSharedPoolExhausted = chooseUserAiPoolRoute({ workersPlan:'paid', includedRemainingNeurons:500, sharedFreeRemainingNeurons:50, workersEstimateNeurons:100, gatewayEstimateNeurons:400 });
assert.equal(paidWorkersSharedPoolExhausted.route,'workers-ai-paid-overage');
assert.equal(paidWorkersSharedPoolExhausted.pool,'included');

const paidWorkersPersonalPoolExhausted = chooseUserAiPoolRoute({ workersPlan:'paid', includedRemainingNeurons:50, sharedFreeRemainingNeurons:9000, workersEstimateNeurons:100, gatewayEstimateNeurons:400 });
assert.equal(paidWorkersPersonalPoolExhausted.route,'ai-gateway-unified-billing','Personal allowance exhaustion takes precedence over unused shared free capacity even on Workers Paid.');
assert.equal(paidWorkersPersonalPoolExhausted.pool,'lifetime');

console.log(JSON.stringify({ok:true,revision:'user-ai-pool-routing-v2',cases:{freeIncluded,personalPoolExhaustedFirst,sharedPoolExhaustedFirst,paidWorkersSharedPoolExhausted,paidWorkersPersonalPoolExhausted}},null,2));
