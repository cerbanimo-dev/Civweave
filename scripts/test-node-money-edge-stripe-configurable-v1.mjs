import assert from 'node:assert/strict';
import test from 'node:test';
import { StripeConnectDirectProvider, STRIPE_CONNECT_ACCOUNT_MODEL } from '../lib/node-money-edge-stripe-v1.mjs';

function fakeStripe() {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const body = new URLSearchParams(options.body || '');
    calls.push({ url: String(url), options, body });
    return {
      ok: true,
      status: 200,
      async json() {
        if (String(url).endsWith('/v1/account_links')) return { id: 'link_123', url: 'https://connect.stripe.test/onboard', expires_at: 1_900_000_000 };
        return {
          id: 'acct_host_123',
          type: 'standard',
          controller: {
            fees: { payer: 'account' },
            losses: { payments: 'stripe' },
            requirement_collection: 'stripe',
            stripe_dashboard: { type: 'full' }
          }
        };
      }
    };
  };
  return { calls, fetchImpl };
}

test('new host-node accounts use configurable controller properties instead of legacy type=standard creation', async () => {
  const stripe = fakeStripe();
  const provider = new StripeConnectDirectProvider({ secretKey: 'sk_test_example', fetchImpl: stripe.fetchImpl });
  const result = await provider.createConnectedAccount({
    nodeId: 'node-alpha',
    operatorId: 'operator-alpha',
    email: 'operator@example.test',
    country: 'us',
    metadata: { civweave_callback_origin: 'https://node.example.test' }
  });

  assert.equal(result.id, 'acct_host_123');
  assert.equal(provider.connectedAccountModel, STRIPE_CONNECT_ACCOUNT_MODEL);
  assert.equal(provider.connectedAccountDashboard, 'full');
  assert.equal(provider.connectedAccountFeePayer, 'account');
  assert.equal(provider.connectedAccountLosses, 'stripe');
  assert.equal(provider.connectedAccountRequirements, 'stripe');

  assert.equal(stripe.calls.length, 1);
  const call = stripe.calls[0];
  assert.equal(new URL(call.url).pathname, '/v1/accounts');
  assert.equal(call.options.method, 'POST');
  assert.equal(call.body.get('type'), null, 'legacy typed-account creation must stay disabled');
  assert.equal(call.body.get('controller[fees][payer]'), 'account');
  assert.equal(call.body.get('controller[losses][payments]'), 'stripe');
  assert.equal(call.body.get('controller[requirement_collection]'), 'stripe');
  assert.equal(call.body.get('controller[stripe_dashboard][type]'), 'full');
  assert.equal(call.body.get('email'), 'operator@example.test');
  assert.equal(call.body.get('country'), 'US');
  assert.equal(call.body.get('metadata[civweave_node_id]'), 'node-alpha');
  assert.equal(call.body.get('metadata[civweave_operator_id]'), 'operator-alpha');
  assert.equal(call.body.get('metadata[civweave_connect_model]'), STRIPE_CONNECT_ACCOUNT_MODEL);
  assert.equal(call.body.get('metadata[civweave_callback_origin]'), 'https://node.example.test');
  assert.match(call.options.headers['idempotency-key'], /^civweave-account-/);
});

test('legacy service method name is only an alias and emits the modern configurable request', async () => {
  const stripe = fakeStripe();
  const provider = new StripeConnectDirectProvider({ secretKey: 'sk_test_example', fetchImpl: stripe.fetchImpl });
  await provider.createStandardAccount({ nodeId: 'node-compat', operatorId: 'operator-compat' });
  assert.equal(stripe.calls.length, 1);
  assert.equal(stripe.calls[0].body.get('type'), null);
  assert.equal(stripe.calls[0].body.get('controller[stripe_dashboard][type]'), 'full');
});

test('hosted onboarding remains upfront and Stripe-collected', async () => {
  const stripe = fakeStripe();
  const provider = new StripeConnectDirectProvider({ secretKey: 'sk_test_example', fetchImpl: stripe.fetchImpl });
  const link = await provider.createAccountLink({
    accountId: 'acct_host_123',
    refreshUrl: 'https://node.example.test/app/node-ai-operator-v1.html?money=refresh',
    returnUrl: 'https://node.example.test/app/node-ai-operator-v1.html?money=return'
  });
  assert.equal(link.id, 'link_123');
  const call = stripe.calls[0];
  assert.equal(new URL(call.url).pathname, '/v1/account_links');
  assert.equal(call.body.get('type'), 'account_onboarding');
  assert.equal(call.body.get('collection_options[fields]'), 'eventually_due');
});
