import { createNodeAiHttpHandler, signCanonicalNodePaymentEvent } from './node-ai-http-v1.mjs';

// Compatibility names kept for one release boundary. These endpoints now route
// to node-owned prepaid balances and service manifests; no central plan catalog,
// provider reserve, or shared database remains behind them.
export const signCanonicalPaymentEvent = signCanonicalNodePaymentEvent;

export function createAiWalletHttpHandler({ walletService, requested = false, authSecret = '', paymentSecret = '', internalSecret = '', capabilitySecret = '', paymentToleranceSeconds = 300, now = () => Date.now() } = {}) {
  return createNodeAiHttpHandler({
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
}
