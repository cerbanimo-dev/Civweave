import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import {
  NodeMoneyEdgeService,
  NODE_MONEY_CHALLENGE_DOMAIN,
  signNodeMoneyEdgeRequest
} from '../lib/node-money-edge-v1.mjs';

const pemPair = () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return {
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }),
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' })
  };
};
const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' }
});
const challengeSignature = ({ nodeId, challenge, privateKey }) => {
  const raw = Buffer.from(`${nodeId}\n${challenge}`);
  const message = Buffer.concat([Buffer.from(`${NODE_MONEY_CHALLENGE_DOMAIN}\n0\n`), raw]);
  return crypto.sign(null, message, privateKey).toString('base64url');
};
const liveConfig = () => ({
  liveMoneyEnabled: true,
  emergencyStop: false,
  complianceApproved: true,
  jurisdictionApproved: true,
  kycAmlReady: true,
  taxReportingReady: true,
  termsApproved: true
});

class AdverseProvider {
  constructor() {
    this.id = 'stripe-connect-direct-v1';
    this.mode = 'live';
    this.credentialsPresent = true;
    this.webhookVerificationReady = true;
    this.refundsReady = true;
    this.reconciliationReady = true;
    this.operatorPayouts = 'stripe-connected-account-native';
    this.verifyCalls = 0;
  }
  async createStandardAccount() { return { id: 'acct_adverse_1' }; }
  async createAccountLink() { return { url: 'https://connect.stripe.test/onboard', expires_at: 2_000_000_000 }; }
  async retrieveAccount() {
    return { id: 'acct_adverse_1', charges_enabled: true, payouts_enabled: true, details_submitted: true, requirements: { currently_due: [], past_due: [] } };
  }
  async createTopUpCheckout() { return { id: 'cs_adverse_1', url: 'https://checkout.stripe.test/cs_adverse_1' }; }
  async verifyWebhook() { return { ok: true }; }
  async verifyTopUpSession({ sessionId }) {
    this.verifyCalls += 1;
    assert.equal(sessionId, 'cs_adverse_1');
    return {
      ok: true,
      sessionId,
      paymentIntentId: 'pi_adverse_1',
      chargeId: 'ch_adverse_1',
      balanceTransactionId: 'txn_adverse_1',
      processorFeeCents: 59,
      applicationFeeCents: 150,
      nodeNetCashCents: 791
    };
  }
  async refundTopUp({ amountCents }) { return { id: 're_adverse_1', amount: amountCents, status: 'succeeded' }; }
}

test('adverse payment outcomes never double-credit or double-debit node credit', async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'cw-money-adverse-'));
  const nodeKeys = pemPair();
  const edgeKeys = pemPair();
  const provider = new AdverseProvider();
  const delivered = [];
  const nowMs = 1_700_000_000_000;
  const fetchImpl = async (url, options = {}) => {
    const u = new URL(url);
    if (u.origin === 'https://node.example' && u.pathname === '/api/ai/node/manifest') {
      return jsonResponse({ manifest: { nodeId: 'node-adverse', operatorId: 'operator-adverse', publicKey: nodeKeys.publicKey } });
    }
    if (u.origin === 'https://node.example' && u.pathname === '/api/ai/node/live/challenge') {
      const body = JSON.parse(String(options.body || '{}'));
      return jsonResponse({
        nodeId: body.nodeId,
        signature: challengeSignature({ nodeId: body.nodeId, challenge: body.challenge, privateKey: nodeKeys.privateKey })
      });
    }
    if (u.origin === 'https://node.example' && u.pathname === '/api/ai/node/live/payments/webhook') {
      delivered.push(JSON.parse(String(options.body || '{}')));
      return jsonResponse({ ok: true });
    }
    throw new Error(`unexpected fetch ${u.href}`);
  };

  const service = new NodeMoneyEdgeService({
    databasePath: path.join(dir, 'edge.sqlite'),
    provider,
    privateKey: edgeKeys.privateKey,
    keyId: 'edge-adverse-key',
    platformFeeBps: 1500,
    config: liveConfig(),
    fetchImpl,
    now: () => nowMs
  });

  try {
    const enrollment = await service.createEnrollmentGrant({
      nodeId: 'node-adverse',
      operatorId: 'operator-adverse',
      callbackUrl: 'https://node.example'
    });
    await service.registerNode({
      nodeId: 'node-adverse',
      operatorId: 'operator-adverse',
      callbackUrl: 'https://node.example',
      enrollmentGrant: enrollment.token,
      email: 'operator@example.test',
      country: 'US'
    });

    const input = {
      nodeId: 'node-adverse',
      userId: 'user-adverse',
      grossCents: 1000,
      currency: 'USD',
      idempotencyKey: 'adverse-idem-1',
      successUrl: 'https://node.example/success',
      cancelUrl: 'https://node.example/cancel'
    };
    const raw = Buffer.from(JSON.stringify(input));
    const signature = signNodeMoneyEdgeRequest(raw, {
      privateKey: nodeKeys.privateKey,
      keyId: 'node-key',
      timestamp: Math.floor(nowMs / 1000)
    });
    await service.createTopUp(input, raw, signature);

    const unpaid = await service.handleProviderEvent({
      id: 'evt_unpaid_1',
      type: 'checkout.session.completed',
      account: 'acct_adverse_1',
      livemode: true,
      data: { object: { id: 'cs_adverse_1', payment_status: 'unpaid' } }
    });
    assert.deepEqual(unpaid, { ignored: true, reason: 'checkout-not-paid' });
    assert.equal(provider.verifyCalls, 0, 'unpaid Checkout must not reach settlement verification');
    assert.equal(delivered.length, 0, 'unpaid Checkout must not credit a node');

    const mismatch = { ...input, grossCents: 2000 };
    const mismatchRaw = Buffer.from(JSON.stringify(mismatch));
    const mismatchSignature = signNodeMoneyEdgeRequest(mismatchRaw, {
      privateKey: nodeKeys.privateKey,
      keyId: 'node-key',
      timestamp: Math.floor(nowMs / 1000)
    });
    await assert.rejects(
      () => service.createTopUp(mismatch, mismatchRaw, mismatchSignature),
      /idempotency key was reused for a different request/i
    );

    await service.handleProviderEvent({
      id: 'evt_paid_1',
      type: 'checkout.session.completed',
      account: 'acct_adverse_1',
      livemode: true,
      data: { object: { id: 'cs_adverse_1', payment_status: 'paid' } }
    });
    assert.equal(provider.verifyCalls, 1);
    assert.equal(delivered.at(-1).type, 'topup.paid');
    assert.equal(delivered.at(-1).userCreditCents, 1000);

    const dispute = await service.handleProviderEvent({
      id: 'evt_dispute_1',
      type: 'charge.dispute.created',
      account: 'acct_adverse_1',
      livemode: true,
      data: { object: { id: 'dp_adverse_1', charge: 'ch_adverse_1', amount: 600 } }
    });
    assert.equal(dispute.applied, true);
    assert.equal(dispute.deltaCents, 600);
    assert.equal(delivered.at(-1).type, 'payment.chargeback');
    assert.equal(delivered.at(-1).userCreditCents, 600);

    const duplicateDispute = await service.handleProviderEvent({
      id: 'evt_dispute_withdrawn_1',
      type: 'charge.dispute.funds_withdrawn',
      account: 'acct_adverse_1',
      livemode: true,
      data: { object: { id: 'dp_adverse_1', charge: 'ch_adverse_1', amount: 600 } }
    });
    assert.deepEqual(duplicateDispute, { ignored: true, reason: 'dispute-already-applied' });
    assert.equal(delivered.filter(event => event.type === 'payment.chargeback').length, 1);

    const refund = await service.handleProviderEvent({
      id: 'evt_refund_adverse_1',
      type: 'charge.refunded',
      account: 'acct_adverse_1',
      livemode: true,
      data: { object: { id: 'ch_adverse_1', amount_refunded: 400 } }
    });
    assert.equal(refund.applied, true);
    assert.equal(refund.deltaCents, 400);
    assert.equal(delivered.at(-1).type, 'topup.refunded');

    const duplicateRefund = await service.handleProviderEvent({
      id: 'evt_refund_adverse_2',
      type: 'charge.refunded',
      account: 'acct_adverse_1',
      livemode: true,
      data: { object: { id: 'ch_adverse_1', amount_refunded: 400 } }
    });
    assert.deepEqual(duplicateRefund, { ignored: true, reason: 'refund-already-applied' });
    assert.equal(delivered.filter(event => event.type === 'topup.refunded').length, 1);
  } finally {
    service.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
