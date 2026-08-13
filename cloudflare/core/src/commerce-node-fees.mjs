export const COMMERCE_HOST_FEE_SCHEMA = 'civweave.commerce-host-fee.v1';

const clean = (value, max = 220) => String(value ?? '').trim().slice(0, max);

function minor(value, label = 'hostFeeMinor') {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new RangeError(`${label} must be a non-negative integer number of minor currency units.`);
  }
  return parsed;
}

function host(raw, side) {
  if (!raw || typeof raw !== 'object') return null;
  const nodeId = clean(raw.nodeId || raw.homeNodeId || raw.id, 180);
  if (!nodeId) return null;
  return Object.freeze({
    side,
    nodeId,
    hostId: clean(raw.hostId || raw.contributorId || raw.operatorId || `node-host:${nodeId}`, 180),
    connectedAccountId: clean(raw.connectedAccountId || raw.stripeAccountId, 180) || null
  });
}

/**
 * Allocate exactly one commerce host fee between the buyer and seller home nodes.
 *
 * This function intentionally does not choose the host-fee rate. Checkout policy passes
 * the already-computed fee in minor currency units. Relay/transit nodes are not inputs.
 */
export function splitCommerceHostFee({ hostFeeMinor = 0, buyerHost = null, sellerHost = null } = {}) {
  const fee = minor(hostFeeMinor);
  const buyer = host(buyerHost, 'buyer');
  const seller = host(sellerHost, 'seller');
  const base = {
    schema: COMMERCE_HOST_FEE_SCHEMA,
    hostFeeMinor: fee,
    singleFee: true,
    maxHostPayoutMinor: fee,
    buyerNodeId: buyer?.nodeId || null,
    sellerNodeId: seller?.nodeId || null,
    relayNodesEligible: false
  };

  if (!fee) return Object.freeze({ ...base, mode: 'none', payouts: [], systemRetainedMinor: 0 });

  if (buyer && seller && buyer.nodeId === seller.nodeId) {
    return Object.freeze({
      ...base,
      mode: 'same-node',
      payouts: [Object.freeze({ ...buyer, side: 'same', amountMinor: fee })],
      systemRetainedMinor: 0
    });
  }

  if (buyer && seller) {
    const buyerMinor = Math.floor(fee / 2);
    const sellerMinor = fee - buyerMinor;
    return Object.freeze({
      ...base,
      mode: 'cross-node-50-50',
      payouts: [
        Object.freeze({ ...buyer, amountMinor: buyerMinor }),
        Object.freeze({ ...seller, amountMinor: sellerMinor })
      ],
      oddMinorRemainder: 'seller',
      systemRetainedMinor: 0
    });
  }

  const sole = buyer || seller;
  if (sole) {
    return Object.freeze({
      ...base,
      mode: 'single-participating-host',
      payouts: [Object.freeze({ ...sole, amountMinor: fee })],
      systemRetainedMinor: 0
    });
  }

  return Object.freeze({
    ...base,
    mode: 'system-only',
    payouts: [],
    systemRetainedMinor: fee
  });
}

export function assertCommerceHostFeeConservation(distribution) {
  const fee = minor(distribution?.hostFeeMinor ?? 0);
  const paid = Array.isArray(distribution?.payouts)
    ? distribution.payouts.reduce((sum, row) => sum + minor(row?.amountMinor ?? 0, 'host payout'), 0)
    : 0;
  const retained = minor(distribution?.systemRetainedMinor ?? 0, 'systemRetainedMinor');
  if (paid + retained !== fee) throw new Error('Commerce host fee must conserve exactly one host fee.');
  if (paid > fee) throw new Error('Commerce host payouts cannot exceed the single host fee.');
  return distribution;
}
