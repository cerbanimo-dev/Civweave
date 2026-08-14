#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  CIVWEAVE_SHARED_DOMAIN,
  RESERVED_CIVWEAVE_SHARED_LABELS,
  communityHostAddress,
  normalizePagesOrigin,
  normalizeSharedDomainLabel,
  sharedDomainForLabel
} from '../cloudflare/core/src/shared-domain-policy.mjs';

assert.equal(CIVWEAVE_SHARED_DOMAIN, 'civweave.cc');
assert.ok(RESERVED_CIVWEAVE_SHARED_LABELS.includes('api'));
assert.ok(RESERVED_CIVWEAVE_SHARED_LABELS.includes('recovery'));

assert.equal(normalizeSharedDomainLabel(' Community Garden '), 'community-garden');
assert.equal(sharedDomainForLabel('garden'), 'https://garden.civweave.cc');
assert.equal(normalizePagesOrigin('https://civweave-garden.pages.dev/path?q=1'), 'https://civweave-garden.pages.dev');

assert.throws(() => normalizeSharedDomainLabel('api'), /reserved/i);
assert.throws(() => normalizeSharedDomainLabel('---'), /required/i);
assert.throws(() => normalizePagesOrigin('https://garden.example.com'), /Pages.*origin/i);
assert.throws(() => normalizePagesOrigin('http://civweave-garden.pages.dev'), /HTTPS/i);

const free = communityHostAddress({
  hostId: 'garden',
  pagesOrigin: 'https://civweave-garden.pages.dev',
  contributionActive: false
});
assert.equal(free.publicOrigin, 'https://civweave-garden.pages.dev');
assert.equal(free.sharedOrigin, 'https://garden.civweave.cc');
assert.equal(free.sharedDomainStatus, 'inactive-free-host');
assert.equal(free.freeOriginPreserved, true);

const contributor = communityHostAddress({
  hostId: 'garden',
  pagesOrigin: 'https://civweave-garden.pages.dev',
  contributionActive: true
});
assert.equal(contributor.publicOrigin, 'https://garden.civweave.cc');
assert.equal(contributor.underlayOrigin, 'https://civweave-garden.pages.dev');
assert.equal(contributor.sharedDomainStatus, 'active-hosting-cost-share');
assert.equal(contributor.lapseBehavior, 'disable-shared-alias-keep-pages-origin-live');

console.log('Civweave shared-domain policy verification passed.');
