#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  normalizeSharedDomainEntitlement,
  upsertSharedDomainEntitlement
} from '../cloudflare/core/src/shared-domain-entitlements.mjs';

assert.throws(() => normalizeSharedDomainEntitlement({
  hostId: 'garden',
  pagesOrigin: 'https://civweave-garden.pages.dev',
  status: 'active',
  source: 'hosting-cost-share'
}), /paidThrough is required/i);

const sponsored = normalizeSharedDomainEntitlement({
  hostId: 'garden',
  pagesOrigin: 'https://civweave-garden.pages.dev',
  status: 'active',
  source: 'sponsored'
});
assert.equal(sponsored.publicOrigin, 'https://garden.civweave.cc');
assert.equal(sponsored.paidThrough, null);

class FakeDB {
  constructor() { this.rows = []; }
  prepare(sql) {
    return {
      bind: (...params) => ({
        first: async () => {
          if (/SELECT host_id FROM shared_domain_aliases WHERE label/.test(sql)) {
            const row = this.rows.find(item => item.label === params[0]);
            return row ? { host_id: row.host_id } : null;
          }
          if (/SELECT label FROM shared_domain_aliases WHERE host_id/.test(sql)) {
            const row = this.rows.find(item => item.host_id === params[0]);
            return row ? { label: row.label } : null;
          }
          if (/SELECT label, host_id, pages_origin/.test(sql)) {
            return this.rows.find(item => item.label === params[0]) || null;
          }
          throw new Error(`Unhandled fake D1 first query: ${sql}`);
        },
        run: async () => {
          if (!/INSERT INTO shared_domain_aliases/.test(sql)) throw new Error(`Unhandled fake D1 run query: ${sql}`);
          const [label, hostId, pagesOrigin, status, source, paidThrough, graceUntil, createdAt, updatedAt] = params;
          const prior = this.rows.find(item => item.label === label);
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
const first = await upsertSharedDomainEntitlement(db, {
  label: 'community-garden',
  hostId: 'garden',
  pagesOrigin: 'https://civweave-garden.pages.dev',
  status: 'active',
  source: 'hosting-cost-share',
  paidThrough: '2026-09-14T00:00:00Z'
}, Date.parse('2026-08-14T00:00:00Z'));
assert.equal(first.publicOrigin, 'https://community-garden.civweave.cc');
assert.equal(first.hostId, 'garden');
assert.equal(first.status, 'active');

const renewed = await upsertSharedDomainEntitlement(db, {
  label: 'community-garden',
  hostId: 'garden',
  pagesOrigin: 'https://civweave-garden.pages.dev',
  status: 'active',
  source: 'hosting-cost-share',
  paidThrough: '2026-10-14T00:00:00Z'
}, Date.parse('2026-09-14T00:00:00Z'));
assert.equal(renewed.paidThrough, '2026-10-14T00:00:00.000Z');
assert.equal(db.rows.length, 1);

await assert.rejects(() => upsertSharedDomainEntitlement(db, {
  label: 'community-garden',
  hostId: 'other-host',
  pagesOrigin: 'https://civweave-other-host.pages.dev',
  status: 'active',
  source: 'hosting-cost-share',
  paidThrough: '2026-10-14T00:00:00Z'
}), error => error?.code === 'SHARED_DOMAIN_LABEL_TAKEN');

await assert.rejects(() => upsertSharedDomainEntitlement(db, {
  label: 'different-label',
  hostId: 'garden',
  pagesOrigin: 'https://civweave-garden.pages.dev',
  status: 'active',
  source: 'hosting-cost-share',
  paidThrough: '2026-10-14T00:00:00Z'
}), error => error?.code === 'SHARED_DOMAIN_HOST_ALREADY_ASSIGNED');

console.log('Civweave shared-domain entitlement verification passed.');
