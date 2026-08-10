import { createNodeAiHttpHandler, signCanonicalNodePaymentEvent } from './node-ai-http-v1.mjs';
import { createNodeAiInferenceHttpHandler } from './node-ai-inference-http-v1.mjs';
import { createNodeAiTrialCommerceHandler } from './node-ai-trial-commerce-v1.mjs';
import { createNodeAiLiveCommerceHandler } from './node-ai-live-commerce-v1.mjs';
import { createNodeMoneyEdgeHttpHandler } from './node-money-edge-http-v1.mjs';

// Compatibility names kept for one release boundary. These endpoints now route
// to node-owned prepaid balances and service manifests; no central plan catalog,
// provider reserve, or shared database remains behind them.
export const signCanonicalPaymentEvent = signCanonicalNodePaymentEvent;

export function createAiWalletHttpHandler({ walletService, requested = false, authSecret = '', paymentSecret = '', internalSecret = '', capabilitySecret = '', paymentToleranceSeconds = 300, now = () => Date.now() } = {}) {
  const moneyEdge = createNodeMoneyEdgeHttpHandler({
    requested: process.env.CIVWEAVE_MONEY_EDGE_ENABLED === '1',
    now
  });
  const marketplace = createNodeAiHttpHandler({
    ledger: walletService,
    manifest: walletService?.manifest || null,
    requested,
    authSecret,
    paymentSecret,
    internalSecret,
    capabilitySecret,
    receiptPrivateKey: process.env.NODE_AI_RECEIPT_PRIVATE_KEY || '',
    receiptKeyId: process.env.NODE_AI_RECEIPT_KEY_ID || 'node-default',
    paymentToleranceSeconds,
    now
  });
  const inference = createNodeAiInferenceHttpHandler({
    ledger: walletService,
    manifest: walletService?.manifest || null,
    inferenceGate: walletService?.inferenceGate || null,
    capabilitySecret,
    now
  });
  const trial = createNodeAiTrialCommerceHandler({
    ledger: walletService,
    manifest: walletService?.manifest || null,
    inferenceGate: walletService?.inferenceGate || null,
    requested: process.env.NODE_AI_TRIAL_COMMERCE_ENABLED === '1',
    authSecret,
    internalSecret,
    maxTopUpCents: Number(process.env.NODE_AI_TRIAL_MAX_TOPUP_CENTS || 10_000),
    now
  });
  const live = createNodeAiLiveCommerceHandler({
    ledger: walletService,
    manifest: walletService?.manifest || null,
    requested: process.env.NODE_AI_LIVE_COMMERCE_ENABLED === '1',
    authSecret,
    internalSecret,
    receiptPrivateKey: process.env.NODE_AI_RECEIPT_PRIVATE_KEY || '',
    receiptKeyId: process.env.NODE_AI_RECEIPT_KEY_ID || 'node-default',
    moneyEdgeUrl: process.env.CIVWEAVE_MONEY_EDGE_URL || '',
    moneyEdgePublicKey: process.env.CIVWEAVE_MONEY_EDGE_PUBLIC_KEY || '',
    maxTopUpCents: Number(process.env.NODE_AI_LIVE_MAX_TOPUP_CENTS || 100_000),
    now
  });
  return Object.freeze({
    status() {
      return Object.freeze({ ...marketplace.status(), inference: inference.status(), trial: trial.status(), live: live.status(), moneyEdge: moneyEdge.status() });
    },
    async handle(req, res, url) {
      if (await moneyEdge.handle(req, res, url)) return true;
      if (await live.handle(req, res, url)) return true;
      if (await trial.handle(req, res, url)) return true;
      if (await inference.handle(req, res, url)) return true;
      return marketplace.handle(req, res, url);
    }
  });
}
