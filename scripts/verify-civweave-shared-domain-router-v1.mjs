#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  routeSharedDomainRequest,
  sharedDomainEntitlementStatus,
  sharedLabelFromHostname
} from '../cloudflare/shared-domain/src/index.mjs';

assert.equal(sharedLabelFromHostname('garden.civweave.cc'), 'garden');
assert.equal(sharedLabelFromHostname('Garden.Civweave.CC.'), 'garden');
assert.equal(sharedLabelFromHostname('api.civweave.cc'), null);
assert.equal(sharedLabelFromHostname('deep.garden.civweave.cc'), null);
assert.equal(sharedLabelFromHostname('garden.example.com'), null);

const now = Date.parse('2026-08-14T12:00:00Z');
assert.equal(sharedDomainEntitlementStatus({ entitlement_status: 'active', paid_through: '2026-08-15T00:00:00Z' }, now), 'active');
assert.equal(sharedDomainEntitlementStatus({ entitlement_status: 'active', paid_through: '2026-08-13T00:00:00Z' }, now), 'expired');
assert.equal(sharedDomainEntitlementStatus({ entitlement_status: 'grace', grace_until: '2026-08-15T00:00:00Z' }, now), 'grace');
assert.equal(sharedDomainEntitlementStatus({ entitlement_status: 'grace', grace_until: '2026-08-13T00:00:00Z' }, now), 'expired');
assert.equal(sharedDomainEntitlementStatus({ entitlement_status: 'suspended' }, now), 'suspended');

function envFor(row) {
  return {
    CIVWEAVE_SHARED_DOMAIN: 'civweave.cc',
    DB: {
      prepare(sql) {
        assert.match(sql, /FROM shared_domain_aliases/);
        return {
          bind(label) {
            assert.equal(label, row?.label || 'garden');
            return { first: async () => row };
          }
        };
      }
    }
  };
}

const inactive = await routeSharedDomainRequest(
  new Request('https://garden.civweave.cc/app/working-campus.html?hello=world'),
  envFor({
    label: 'garden',
    host_id: 'garden',
    pages_origin: 'https://civweave-garden.pages.dev',
    entitlement_status: 'inactive'
  })
);
assert.equal(inactive.status, 307);
assert.equal(inactive.headers.get('location'), 'https://civweave-garden.pages.dev/app/working-campus.html?hello=world');
assert.equal(inactive.headers.get('x-civweave-free-origin-preserved'), 'true');

const originalFetch = globalThis.fetch;
try {
  let proxied = null;
  globalThis.fetch = async request => {
    proxied = request;
    return new Response('ok', {
      status: 302,
      headers: { location: 'https://civweave-garden.pages.dev/app/index.html?from=upstream' }
    });
  };
  const active = await routeSharedDomainRequest(
    new Request('https://garden.civweave.cc/start?hello=world'),
    envFor({
      label: 'garden',
      host_id: 'garden',
      pages_origin: 'https://civweave-garden.pages.dev',
      entitlement_status: 'active',
      paid_through: '2999-01-01T00:00:00Z'
    })
  );
  assert.equal(new URL(proxied.url).href, 'https://civweave-garden.pages.dev/start?hello=world');
  assert.equal(active.status, 302);
  assert.equal(active.headers.get('location'), 'https://garden.civweave.cc/app/index.html?from=upstream');
  assert.equal(active.headers.get('x-civweave-shared-domain-status'), 'active');
} finally {
  globalThis.fetch = originalFetch;
}

const missing = await routeSharedDomainRequest(
  new Request('https://garden.civweave.cc/'),
  envFor(null)
);
assert.equal(missing.status, 404);

console.log('Civweave shared-domain router verification passed.');
