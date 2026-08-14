#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  SHARED_DOMAIN_HOSTING_SCHEMA,
  SHARED_DOMAIN_HOSTING_POLICY,
  createSharedDomainHostingCheckout,
  reconcileSharedDomainHostingRenewal,
  settleSharedDomainHostingInvoice,
  sharedDomainHostingBand,
  sharedDomainHostingReadiness
} from '../cloudflare/core/src/shared-domain-billing.mjs';

const readiness = sharedDomainHostingReadiness();
assert.equal(readiness.checkoutEnabled, true);
assert.equal(readiness.free.maxMembers, 28);
assert.equal(readiness.standard.monthlyCents, 500);
assert.equal(readiness.scale.monthlyCents, 1000);
assert.equal(readiness.scale.thresholdMembers, 200);
assert.equal(sharedDomainHostingBand(199).monthlyCents, 500);
assert.equal(sharedDomainHostingBand(199).quantity, 1);
assert.equal(sharedDomainHostingBand(200).monthlyCents, 1000);
assert.equal(sharedDomainHostingBand(400).quantity, 2);
assert.throws(() => sharedDomainHostingBand(401), /0 through 400/i);

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
const providerCalls = [];
const deliveredEvents = [];
let reportedMembers = 50;
let reportedNodeMembers = 20;
let signatureVerified = false;
const nodeRow = {
  node_id: 'garden',
  connected_account_id: 'acct_garden',
  callback_origin: 'https://garden.nodes.civweave.invalid'
};

const edge = {
  env: {},
  db,
  now: () => Date.parse('2026-08-14T12:00:00Z'),
  signEvent: async () => 't=1,kid=test,sig=signed-event',
  fetch: async (url, init = {}) => {
    const href = String(url);
    if (href === 'https://civweave-garden.pages.dev/app/host-deployment-v1.json') {
      return Response.json({
        schema: 'civweave.host-deployment.v1',
        role: 'community',
        hostId: 'garden',
        pagesOrigin: 'https://civweave-garden.pages.dev',
        publicOrigin: 'https://civweave-garden.pages.dev',
        canonicalOrigin: 'https://civweave.cc'
      });
    }
    if (href === 'https://garden.nodes.civweave.invalid/api/ai/node/capacity') {
      return Response.json({
        schema: 'civweave.host-capacity.v2',
        nodeId: 'garden',
        memberCount: reportedMembers,
        nodeMembers: reportedNodeMembers,
        maxMembers: reportedMembers > 28 ? 400 : 28
      });
    }
    if (href === 'https://garden.nodes.civweave.invalid/api/ai/node/live/payments/webhook') {
      assert.equal(init.headers['x-civweave-money-edge-signature'], 't=1,kid=test,sig=signed-event');
      const event = JSON.parse(init.body);
      deliveredEvents.push(event);
      return Response.json({ ok: true, stored: true, eventId: event.id, capacity: { maxMembers: 400 } });
    }
    throw new Error(`Unexpected fake fetch: ${href}`);
  },
  verifyNodeRequest: async (nodeId, raw, signature) => {
    assert.equal(nodeId, 'garden');
    assert.equal(new TextDecoder().decode(raw), '{"nodeId":"garden"}');
    assert.equal(signature, 'signed');
    signatureVerified = true;
    return nodeRow;
  },
  node: async nodeId => nodeId === 'garden' ? nodeRow : null,
  provider: {
    request: async (path, options = {}) => {
      providerCalls.push({ path, options });
      if (path === '/v1/checkout/sessions') return { id: 'cs_test_shared', url: 'https://checkout.stripe.test/shared' };
      if (path === '/v1/subscriptions/sub_shared_1' && options.method === 'GET') {
        return { id: 'sub_shared_1', items: { data: [{ id: 'si_hosting_1', quantity: 1 }] } };
      }
      if (path === '/v1/subscription_items/si_hosting_1') return { id: 'si_hosting_1', quantity: Number(options.form.quantity) };
      if (path === '/v1/subscriptions/sub_shared_1') return { id: 'sub_shared_1', metadata: options.form };
      throw new Error(`Unexpected provider request: ${path}`);
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
assert.equal(checkout.memberCount, 50);
assert.equal(checkout.monthlyCostShareCents, 500);
assert.equal(checkout.billingQuantity, 1);
assert.equal(checkout.maxMembers, 400);
const checkoutCall = providerCalls.find(call => call.path === '/v1/checkout/sessions');
assert.ok(checkoutCall);
assert.equal(checkoutCall.options.form.mode, 'subscription');
assert.equal(checkoutCall.options.form['line_items[0][price_data][unit_amount]'], 500);
assert.equal(checkoutCall.options.form['line_items[0][quantity]'], 1);
assert.equal(checkoutCall.options.form['subscription_data[metadata][civweave_schema]'], SHARED_DOMAIN_HOSTING_SCHEMA);
assert.equal(checkoutCall.options.form['subscription_data[metadata][civweave_monthly_cents]'], '500');
assert.match(checkoutCall.options.form.integration_identifier, /^civweave_hosting_[a-z]{8}$/);

const upcoming = {
  id: 'in_upcoming_shared_1',
  parent: {
    type: 'subscription_details',
    subscription_details: {
      subscription: 'sub_shared_1',
      metadata: {
        civweave_schema: SHARED_DOMAIN_HOSTING_SCHEMA,
        civweave_node_id: 'garden',
        civweave_shared_label: 'garden',
        civweave_pages_origin: 'https://civweave-garden.pages.dev',
        civweave_monthly_cents: '500',
        civweave_host_account_id: 'acct_garden'
      }
    }
  }
};

reportedMembers = 200;
reportedNodeMembers = 70;
const renewal = await reconcileSharedDomainHostingRenewal(edge, upcoming);
assert.equal(renewal.applied, true);
assert.equal(renewal.memberCount, 200, 'renewal billing must use total hub membership, not one starter node');
assert.equal(renewal.nextMonthlyCents, 1000);
assert.equal(renewal.nextQuantity, 2);
assert.equal(renewal.changed, true);
const itemUpdate = providerCalls.find(call => call.path === '/v1/subscription_items/si_hosting_1');
assert.equal(itemUpdate.options.form.quantity, 2);
assert.equal(itemUpdate.options.form.proration_behavior, 'none');
const metadataUpdate = providerCalls.filter(call => call.path === '/v1/subscriptions/sub_shared_1').at(-1);
assert.equal(metadataUpdate.options.form['metadata[civweave_monthly_cents]'], 1000);
assert.equal(metadataUpdate.options.form['metadata[civweave_billing_band]'], 'scale');
assert.equal(metadataUpdate.options.form['metadata[civweave_last_member_count]'], 200);

const invoice = {
  id: 'in_shared_1',
  status: 'paid',
  amount_paid: 1000,
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
        civweave_monthly_cents: '1000',
        civweave_billing_band: 'scale',
        civweave_host_account_id: 'acct_garden'
      }
    }
  },
  lines: { data: [] }
};

const settled = await settleSharedDomainHostingInvoice(edge, invoice);
assert.equal(settled.applied, true);
assert.equal(settled.monthlyCostShareCents, 1000);
assert.equal(settled.billingBand, 'scale');
assert.equal(settled.maxMembers, SHARED_DOMAIN_HOSTING_POLICY.hostedMaxMembers);
assert.equal(settled.entitlement.status, 'active');
assert.equal(settled.entitlement.publicOrigin, 'https://garden.civweave.cc');
assert.equal(settled.entitlement.paidThrough, '2026-09-14T12:00:00.000Z');
assert.equal(deliveredEvents.at(-1).type, 'hosting.plan.paid');
assert.equal(deliveredEvents.at(-1).monthlyCents, 1000);
assert.equal(deliveredEvents.at(-1).maxMembers, 400);

const replayOlder = await settleSharedDomainHostingInvoice(edge, {
  ...invoice,
  id: 'in_shared_old',
  period_end: Math.floor(Date.parse('2026-09-01T00:00:00Z') / 1000)
});
assert.equal(replayOlder.entitlement.paidThrough, '2026-09-14T12:00:00.000Z');

console.log('Civweave shared-domain billing verification passed.');
