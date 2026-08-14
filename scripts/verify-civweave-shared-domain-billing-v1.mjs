#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  SHARED_DOMAIN_HOSTING_SCHEMA,
  createSharedDomainHostingCheckout,
  settleSharedDomainHostingInvoice,
  sharedDomainHostingReadiness
} from '../cloudflare/core/src/shared-domain-billing.mjs';

assert.equal(sharedDomainHostingReadiness({}).checkoutEnabled, false);
assert.equal(sharedDomainHostingReadiness({ CIVWEAVE_SHARED_DOMAIN_MONTHLY_CENTS: '125' }).monthlyCostShareCents, 125);

class FakeDB {
  constructor(rows = []) { this.rows = rows; }
  prepare(sql) {
    return {
      bind: (...params) => ({
        first: async () => {
          if (/SELECT label, host_id, pages_origin/.test(sql)) return this.rows.find(row => row.label === params[0]) || null;
          if (/SELECT host_id FROM shared_domain_aliases WHERE label/.test(sql)) {
            const row = this.rows.find(item => item.label === params[0]);
            return row ? { host_id: row.host_id } : null;
          }
          if (/SELECT label FROM shared_domain_aliases WHERE host_id/.test(sql)) {
            const row = this.rows.find(item => item.host_id === params[0]);
            return row ? { label: row.label } : null;
          }
          throw new Error(`Unhandled fake D1 first query: ${sql}`);
        },
        run: async () => {
          if (!/INSERT INTO shared_domain_aliases/.test(sql)) throw new Error(`Unhandled fake D1 run query: ${sql}`);
          const [label, hostId, pagesOrigin, status, source, paidThrough, graceUntil, createdAt, updatedAt] = params;
          const prior = this.rows.find(row => row.label === label);
          if (prior) {
            Object.assign(prior, {
              pages_origin: pagesOrigin,
              entitlement_status: status,
              entitlement_source: source,
              paid_through: paidThrough,
              grace_until: graceUntil,
              updated_at: updatedAt
            });
          } else {
            this.rows.push({
              label,
              host_id: hostId,
              pages_origin: pagesOrigin,
              entitlement_status: status,
              entitlement_source: source,
              paid_through: paidThrough,
              grace_until: graceUntil,
              created_at: createdAt,
              updated_at: updatedAt
            });
          }
          return { success: true };
        }
      })
    };
  }
}

const db = new FakeDB();
let providerRequest = null;
let signatureVerified = false;
const edge = {
  env: { CIVWEAVE_SHARED_DOMAIN_MONTHLY_CENTS: '125' },
  db,
  now: () => Date.parse('2026-08-14T12:00:00Z'),
  fetch: async url => {
    assert.equal(String(url), 'https://civweave-garden.pages.dev/app/host-deployment-v1.json');
    return Response.json({
      schema: 'civweave.host-deployment.v1',
      role: 'community',
      hostId: 'garden',
      pagesOrigin: 'https://civweave-garden.pages.dev',
      publicOrigin: 'https://civweave-garden.pages.dev',
      canonicalOrigin: 'https://civweave.cc'
    });
  },
  verifyNodeRequest: async (nodeId, raw, signature) => {
    assert.equal(nodeId, 'garden');
    assert.equal(new TextDecoder().decode(raw), '{"nodeId":"garden"}');
    assert.equal(signature, 'signed');
    signatureVerified = true;
    return { node_id: 'garden', connected_account_id: 'acct_garden' };
  },
  node: async nodeId => nodeId === 'garden' ? { node_id: 'garden', connected_account_id: 'acct_garden' } : null,
  provider: {
    request: async (path, options) => {
      providerRequest = { path, options };
      return { id: 'cs_test_shared', url: 'https://checkout.stripe.test/shared' };
    }
  }
};

const checkout = await createSharedDomainHostingCheckout(edge, {
  nodeId: 'garden',
  pagesOrigin: 'https://civweave-garden.pages.dev',
  idempotencyKey: 'domain-test-1',
  successUrl: 'https://civweave-garden.pages.dev/host-setup.html?domain=success',
  cancelUrl: 'https://civweave-garden.pages.dev/host-setup.html?domain=cancel'
}, new TextEncoder().encode('{"nodeId":"garden"}'), 'signed');

assert.equal(signatureVerified, true);
assert.equal(checkout.sharedOrigin, 'https://garden.civweave.cc');
assert.equal(checkout.monthlyCostShareCents, 125);
assert.equal(providerRequest.path, '/v1/checkout/sessions');
assert.equal(providerRequest.options.form.mode, 'subscription');
assert.equal(providerRequest.options.form['subscription_data[metadata][civweave_schema]'], SHARED_DOMAIN_HOSTING_SCHEMA);
assert.equal(providerRequest.options.form['subscription_data[metadata][civweave_shared_label]'], 'garden');

await assert.rejects(() => createSharedDomainHostingCheckout({ ...edge, env: {} }, {
  nodeId: 'garden',
  pagesOrigin: 'https://civweave-garden.pages.dev',
  idempotencyKey: 'domain-test-2',
  successUrl: 'https://civweave-garden.pages.dev/host-setup.html',
  cancelUrl: 'https://civweave-garden.pages.dev/host-setup.html'
}, new TextEncoder().encode('{"nodeId":"garden"}'), 'signed'), error => error?.code === 'SHARED_DOMAIN_COST_SHARE_UNCONFIGURED');

const invoice = {
  id: 'in_shared_1',
  status: 'paid',
  amount_paid: 125,
  period_end: Math.floor(Date.parse('2026-09-14T12:00:00Z') / 1000),
  parent: {
    type: 'subscription_details',
    subscription_details: {
      subscription: 'sub_shared_1',
      metadata: {
        civweave_schema: SHARED_DOMAIN_HOSTING_SCHEMA,
        civweave_node_id: 'garden',
        civweave_shared_label: 'garden',
        civweave_pages_origin: 'https://civweave-garden.pages.dev',
        civweave_monthly_cents: '125',
        civweave_host_account_id: 'acct_garden'
      }
    }
  },
  lines: { data: [] }
};

const settled = await settleSharedDomainHostingInvoice({ ...edge, env: { CIVWEAVE_SHARED_DOMAIN_MONTHLY_CENTS: '150' } }, invoice);
assert.equal(settled.applied, true);
assert.equal(settled.pricingStatus, 'legacy-paid-period-honored');
assert.equal(settled.entitlement.status, 'active');
assert.equal(settled.entitlement.publicOrigin, 'https://garden.civweave.cc');
assert.equal(settled.entitlement.paidThrough, '2026-09-14T12:00:00.000Z');

const replayOlder = await settleSharedDomainHostingInvoice({ ...edge, env: { CIVWEAVE_SHARED_DOMAIN_MONTHLY_CENTS: '150' } }, {
  ...invoice,
  id: 'in_shared_old',
  period_end: Math.floor(Date.parse('2026-09-01T00:00:00Z') / 1000)
});
assert.equal(replayOlder.entitlement.paidThrough, '2026-09-14T12:00:00.000Z');

console.log('Civweave shared-domain billing verification passed.');
