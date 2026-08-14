import { createNodeAiHttpHandler, signCanonicalNodePaymentEvent } from './node-ai-http-v1.mjs';
import { createNodeAiInferenceHttpHandler } from './node-ai-inference-http-v1.mjs';
import { createNodeAiTrialCommerceHandler } from './node-ai-trial-commerce-v1.mjs';
import { createNodeAiLiveCommerceHandler } from './node-ai-live-commerce-v1.mjs';
import { createNodeMoneyEdgeHttpHandler } from './node-money-edge-http-v1.mjs';
import { createLocalHostCapacityStore } from './local-host-capacity-v1.mjs';
import { createNodeTerritoryHostAuthorityHandler } from './node-territory-host-authority-v1.mjs';

// Compatibility names kept for one release boundary. These endpoints now route
// to node-owned prepaid balances and service manifests; no central plan catalog,
// provider reserve, or shared database remains behind them.
export const signCanonicalPaymentEvent = signCanonicalNodePaymentEvent;

export function createAiWalletHttpHandler({ walletService, requested = false, authSecret = '', paymentSecret = '', internalSecret = '', capabilitySecret = '', paymentToleranceSeconds = 300, now = () => Date.now() } = {}) {
  const bootstrap = walletService?.bootstrap || {};
  const effectiveAuthSecret = String(authSecret || bootstrap.authSecret || '').trim();
  const effectivePaymentSecret = String(paymentSecret || bootstrap.paymentWebhookSecret || '').trim();
  const effectiveInternalSecret = String(internalSecret || bootstrap.internalSecret || '').trim();
  const effectiveCapabilitySecret = String(capabilitySecret || bootstrap.capabilitySecret || '').trim();
  const receiptPrivateKey = String(process.env.NODE_AI_RECEIPT_PRIVATE_KEY || bootstrap.receiptPrivateKey || '').trim();
  const receiptKeyId = String(process.env.NODE_AI_RECEIPT_KEY_ID || bootstrap.receiptKeyId || 'node-default').trim();
  const moneyEdgeUrl = String(process.env.CIVWEAVE_MONEY_EDGE_URL || bootstrap.moneyEdgeUrl || '').trim();
  const moneyEdgePublicKey = String(process.env.CIVWEAVE_MONEY_EDGE_PUBLIC_KEY || bootstrap.moneyEdgePublicKey || '').trim();
  const localCapacityStore = process.env.CIVWEAVE_FEDERATED_HOST === '1'
    ? createLocalHostCapacityStore({ dataDir: process.env.DATA_DIR || './data', nodeId: process.env.CIVWEAVE_FEDERATION_NODE_ID || walletService?.manifest?.nodeId || '' })
    : null;

  const moneyEdge = createNodeMoneyEdgeHttpHandler({
    requested: process.env.CIVWEAVE_MONEY_EDGE_ENABLED === '1',
    now
  });
  const marketplace = createNodeAiHttpHandler({
    ledger: walletService,
    manifest: walletService?.manifest || null,
    requested,
    authSecret: effectiveAuthSecret,
    paymentSecret: effectivePaymentSecret,
    internalSecret: effectiveInternalSecret,
    capabilitySecret: effectiveCapabilitySecret,
    receiptPrivateKey,
    receiptKeyId,
    paymentToleranceSeconds,
    now
  });
  const inference = createNodeAiInferenceHttpHandler({
    ledger: walletService,
    manifest: walletService?.manifest || null,
    inferenceGate: walletService?.inferenceGate || null,
    capabilitySecret: effectiveCapabilitySecret,
    now
  });
  const trial = createNodeAiTrialCommerceHandler({
    ledger: walletService,
    manifest: walletService?.manifest || null,
    inferenceGate: walletService?.inferenceGate || null,
    requested: process.env.NODE_AI_TRIAL_COMMERCE_ENABLED === '1',
    authSecret: effectiveAuthSecret,
    internalSecret: effectiveInternalSecret,
    maxTopUpCents: Number(process.env.NODE_AI_TRIAL_MAX_TOPUP_CENTS || 10_000),
    now
  });
  const live = createNodeAiLiveCommerceHandler({
    ledger: walletService,
    manifest: walletService?.manifest || null,
    requested: process.env.NODE_AI_LIVE_COMMERCE_ENABLED === '1',
    authSecret: effectiveAuthSecret,
    internalSecret: effectiveInternalSecret,
    receiptPrivateKey,
    receiptKeyId,
    moneyEdgeUrl,
    moneyEdgePublicKey,
    bootstrapStore: walletService?.bootstrapStore || null,
    capacityStore: localCapacityStore,
    maxTopUpCents: Number(process.env.NODE_AI_LIVE_MAX_TOPUP_CENTS || 100_000),
    now
  });
  const territoryHostAuthority = createNodeTerritoryHostAuthorityHandler({
    manifest: walletService?.manifest || null,
    internalSecret: effectiveInternalSecret,
    receiptPrivateKey,
    receiptKeyId,
    coreUrl: process.env.CIVWEAVE_CORE_URL || moneyEdgeUrl,
    now
  });
  return Object.freeze({
    status() {
      return Object.freeze({
        ...marketplace.status(),
        bootstrap: walletService?.bootstrapStore?.publicState?.() || null,
        inference: inference.status(),
        trial: trial.status(),
        live: live.status(),
        moneyEdge: moneyEdge.status(),
        territoryHostAuthority: territoryHostAuthority.status()
      });
    },
    async handle(req, res, url) {
      if (await moneyEdge.handle(req, res, url)) return true;
      if (await territoryHostAuthority.handle(req, res, url)) return true;
      if (await live.handle(req, res, url)) return true;
      if (await trial.handle(req, res, url)) return true;
      if (await inference.handle(req, res, url)) return true;
      return marketplace.handle(req, res, url);
    }
  });
}