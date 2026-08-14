export const USER_AI_POOL_ROUTER_SCHEMA = 'civweave.user-ai-pool-router.v2';

export function chooseUserAiPoolRoute({
  workersPlan = 'free',
  includedRemainingNeurons = 0,
  sharedFreeRemainingNeurons = 0,
  workersEstimateNeurons = 1,
  gatewayEstimateNeurons = 1,
} = {}) {
  const includedFits = Number(workersEstimateNeurons) <= Number(includedRemainingNeurons);
  const sharedFreeFits = Number(workersEstimateNeurons) <= Number(sharedFreeRemainingNeurons);
  const paidWorkers = String(workersPlan).toLowerCase() === 'paid';

  if (includedFits && sharedFreeFits) return Object.freeze({
    schema: USER_AI_POOL_ROUTER_SCHEMA,
    route: 'workers-ai-free',
    pool: 'included',
    quotaNeurons: Number(workersEstimateNeurons),
    providerNeurons: Number(workersEstimateNeurons),
  });

  if (includedFits && paidWorkers) return Object.freeze({
    schema: USER_AI_POOL_ROUTER_SCHEMA,
    route: 'workers-ai-paid-overage',
    pool: 'included',
    quotaNeurons: Number(workersEstimateNeurons),
    providerNeurons: Number(workersEstimateNeurons),
  });

  if (includedFits) return Object.freeze({
    schema: USER_AI_POOL_ROUTER_SCHEMA,
    route: 'ai-gateway-unified-billing',
    pool: 'included',
    quotaNeurons: Number(workersEstimateNeurons),
    providerNeurons: Number(gatewayEstimateNeurons),
  });

  return Object.freeze({
    schema: USER_AI_POOL_ROUTER_SCHEMA,
    route: 'ai-gateway-unified-billing',
    pool: 'lifetime',
    quotaNeurons: Number(gatewayEstimateNeurons),
    providerNeurons: Number(gatewayEstimateNeurons),
  });
}
