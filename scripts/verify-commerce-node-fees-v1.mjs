import assert from 'node:assert/strict';
import { splitCommerceHostFee, assertCommerceHostFeeConservation } from '../cloudflare/core/src/commerce-node-fees.mjs';

const same = assertCommerceHostFeeConservation(splitCommerceHostFee({
  hostFeeMinor: 100,
  buyerHost: { nodeId: 'node-a', hostId: 'host-a', connectedAccountId: 'acct_a' },
  sellerHost: { nodeId: 'node-a', hostId: 'host-a', connectedAccountId: 'acct_a' }
}));
assert.equal(same.mode, 'same-node');
assert.equal(same.payouts.length, 1);
assert.equal(same.payouts[0].amountMinor, 100);

const cross = assertCommerceHostFeeConservation(splitCommerceHostFee({
  hostFeeMinor: 101,
  buyerHost: { nodeId: 'node-buyer', hostId: 'host-buyer', connectedAccountId: 'acct_buyer' },
  sellerHost: { nodeId: 'node-seller', hostId: 'host-seller', connectedAccountId: 'acct_seller' }
}));
assert.equal(cross.mode, 'cross-node-50-50');
assert.equal(cross.payouts.length, 2);
assert.equal(cross.payouts[0].amountMinor, 50);
assert.equal(cross.payouts[1].amountMinor, 51);
assert.equal(cross.oddMinorRemainder, 'seller');
assert.equal(cross.payouts.reduce((sum, row) => sum + row.amountMinor, 0), 101);
assert.equal(cross.relayNodesEligible, false);
assert.equal(cross.maxHostPayoutMinor, 101);

const buyerOnly = assertCommerceHostFeeConservation(splitCommerceHostFee({
  hostFeeMinor: 75,
  buyerHost: { nodeId: 'node-buyer', hostId: 'host-buyer' }
}));
assert.equal(buyerOnly.mode, 'single-participating-host');
assert.equal(buyerOnly.payouts[0].amountMinor, 75);

const sellerOnly = assertCommerceHostFeeConservation(splitCommerceHostFee({
  hostFeeMinor: 75,
  sellerHost: { nodeId: 'node-seller', hostId: 'host-seller' }
}));
assert.equal(sellerOnly.mode, 'single-participating-host');
assert.equal(sellerOnly.payouts[0].amountMinor, 75);

const systemOnly = assertCommerceHostFeeConservation(splitCommerceHostFee({ hostFeeMinor: 60 }));
assert.equal(systemOnly.mode, 'system-only');
assert.equal(systemOnly.payouts.length, 0);
assert.equal(systemOnly.systemRetainedMinor, 60);

const zero = assertCommerceHostFeeConservation(splitCommerceHostFee({
  hostFeeMinor: 0,
  buyerHost: { nodeId: 'node-a' },
  sellerHost: { nodeId: 'node-b' }
}));
assert.equal(zero.mode, 'none');
assert.equal(zero.maxHostPayoutMinor, 0);

console.log(JSON.stringify({
  ok: true,
  schema: cross.schema,
  policy: {
    oneHostFeeMaximum: true,
    sameNode: '100% to the single home-node host',
    crossNode: '50/50 buyer-home and seller-home hosts',
    singleParticipatingHost: '100% to the participating home-node host',
    noParticipatingHost: 'system retained',
    relayNodesEligible: false,
    oddMinorRemainder: 'seller'
  },
  checks: ['same-node','cross-node-50-50','single-host','system-only','single-fee-conservation','relay-exclusion']
}, null, 2));
