import {
  FELLOWFARE_DIRECT_COMMERCE_SCHEMA,
  FELLOWFARE_SERVICE_FEE_HOST_SHARE_BPS,
  FELLOWFARE_SERVICE_FEE_CERBANIMO_SHARE_BPS
} from './fellowfare-direct-commerce-v1.mjs';

export const FELLOWFARE_SERVICE_FEE_SETTLEMENT_SCHEMA = 'civweave.fellowfare-service-fee.v1';

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const iso = value => new Date(value).toISOString();
const integer = (value, label, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw Object.assign(new RangeError(`${label} must be an integer from ${min} through ${max}.`), { status: 400 });
  }
  return number;
};

export function splitFellowFareServiceFee(feeCents) {
  const total = integer(feeCents, 'feeCents');
  const hostStewardShareCents = Math.floor(total * FELLOWFARE_SERVICE_FEE_HOST_SHARE_BPS / 10_000);
  return Object.freeze({
    feeCents: total,
    hostStewardShareCents,
    cerbanimoShareCents: total - hostStewardShareCents,
    hostStewardShareBps: FELLOWFARE_SERVICE_FEE_HOST_SHARE_BPS,
    cerbanimoShareBps: FELLOWFARE_SERVICE_FEE_CERBANIMO_SHARE_BPS
  });
}

async function settlementByFee(edge, applicationFeeId) {
  return edge.db.prepare('SELECT * FROM money_edge_fellowfare_service_fees WHERE application_fee_id=?1')
    .bind(clean(applicationFeeId, 220)).first();
}

async function hostNode(edge, nodeId) {
  return edge.db.prepare('SELECT node_id,connected_account_id FROM money_edge_nodes WHERE node_id=?1')
    .bind(clean(nodeId, 180)).first();
}

function publicSettlement(row) {
  if (!row) return null;
  return Object.freeze({
    schema: FELLOWFARE_SERVICE_FEE_SETTLEMENT_SCHEMA,
    applicationFeeId: row.application_fee_id,
    chargeId: row.charge_id,
    providerAccountId: row.provider_account_id,
    nodeId: row.node_id,
    feeCents: Number(row.fee_cents),
    hostStewardShareCents: Number(row.host_share_cents),
    cerbanimoShareCents: Number(row.cerbanimo_share_cents),
    hostTransferId: row.host_transfer_id || null,
    refundedFeeCents: Number(row.refunded_fee_cents || 0),
    hostReversedCents: Number(row.host_reversed_cents || 0),
    status: row.status,
    settledAt: row.settled_at || null,
    updatedAt: row.updated_at || null
  });
}

export async function settleFellowFareServiceFee(edge, fee) {
  if (fee?.object !== 'application_fee') return { ignored: true, reason: 'not-application-fee' };
  const applicationFeeId = clean(fee.id, 220);
  const providerAccountId = clean(typeof fee.account === 'string' ? fee.account : fee.account?.id, 180);
  const chargeId = clean(typeof fee.charge === 'string' ? fee.charge : fee.charge?.id, 220);
  const feeCents = integer(fee.amount, 'application fee amount');
  const currency = clean(fee.currency, 12).toLowerCase();
  if (!applicationFeeId || !providerAccountId || !chargeId || !currency) {
    throw Object.assign(new Error('FellowFare application fee is missing Stripe identity fields.'), { status: 409 });
  }

  const prior = await settlementByFee(edge, applicationFeeId);
  if (prior?.host_transfer_id) return { applied: true, duplicate: true, settlement: publicSettlement(prior) };

  const charge = await edge.provider.stripeClient().charges.retrieve(chargeId, {}, { stripeAccount: providerAccountId });
  const metadata = charge?.metadata || {};
  if (clean(metadata.civweave_schema, 180) !== FELLOWFARE_DIRECT_COMMERCE_SCHEMA) {
    return { ignored: true, reason: 'not-fellowfare-direct-commerce' };
  }
  const nodeId = clean(metadata.fellowfare_node_id, 180);
  if (!nodeId) throw Object.assign(new Error('FellowFare service charge is missing its facilitating Hub Node ID.'), { status: 409 });
  const node = await hostNode(edge, nodeId);
  if (!node?.connected_account_id) throw Object.assign(new Error('The facilitating Hub Node has no registered Host Steward payout account.'), { status: 409 });

  const split = splitFellowFareServiceFee(feeCents);
  let transfer = null;
  if (split.hostStewardShareCents > 0) {
    transfer = await edge.provider.stripeClient().transfers.create({
      amount: split.hostStewardShareCents,
      currency,
      destination: node.connected_account_id,
      transfer_group: `fellowfare-service-fee:${applicationFeeId}`,
      metadata: {
        civweave_schema: FELLOWFARE_SERVICE_FEE_SETTLEMENT_SCHEMA,
        fellowfare_application_fee_id: applicationFeeId,
        fellowfare_charge_id: chargeId,
        fellowfare_node_id: nodeId,
        fellowfare_fee_split: '50-host-steward-50-cerbanimo'
      }
    }, { idempotencyKey: `civweave-fellowfare-host-${applicationFeeId}` });
  }

  const at = iso(edge.now());
  await edge.db.prepare(`INSERT INTO money_edge_fellowfare_service_fees
    (application_fee_id,charge_id,provider_account_id,node_id,fee_cents,currency,host_share_cents,cerbanimo_share_cents,host_transfer_id,refunded_fee_cents,host_reversed_cents,status,settled_at,created_at,updated_at)
    VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,0,0,'settled',?10,?11,?12)
    ON CONFLICT(application_fee_id) DO UPDATE SET
      charge_id=excluded.charge_id,provider_account_id=excluded.provider_account_id,node_id=excluded.node_id,
      fee_cents=excluded.fee_cents,currency=excluded.currency,host_share_cents=excluded.host_share_cents,
      cerbanimo_share_cents=excluded.cerbanimo_share_cents,host_transfer_id=COALESCE(money_edge_fellowfare_service_fees.host_transfer_id,excluded.host_transfer_id),
      status='settled',settled_at=COALESCE(money_edge_fellowfare_service_fees.settled_at,excluded.settled_at),updated_at=excluded.updated_at`)
    .bind(applicationFeeId, chargeId, providerAccountId, nodeId, split.feeCents, currency,
      split.hostStewardShareCents, split.cerbanimoShareCents, transfer?.id || null, at, at, at).run();

  return { applied: true, settlement: publicSettlement(await settlementByFee(edge, applicationFeeId)) };
}

export async function refundFellowFareServiceFee(edge, fee) {
  if (fee?.object !== 'application_fee') return { ignored: true, reason: 'not-application-fee' };
  const applicationFeeId = clean(fee.id, 220);
  let row = await settlementByFee(edge, applicationFeeId);
  if (!row) {
    const settled = await settleFellowFareServiceFee(edge, fee);
    if (settled?.ignored) return settled;
    row = await settlementByFee(edge, applicationFeeId);
  }
  if (!row) throw Object.assign(new Error('FellowFare service-fee settlement could not be recovered for refund handling.'), { status: 409 });

  const refundedFeeCents = Math.min(Number(row.fee_cents), integer(fee.amount_refunded ?? 0, 'application fee refunded amount'));
  const desiredHostReversal = Math.min(Number(row.host_share_cents), splitFellowFareServiceFee(refundedFeeCents).hostStewardShareCents);
  const priorHostReversal = Number(row.host_reversed_cents || 0);
  const reverseCents = Math.max(0, desiredHostReversal - priorHostReversal);
  if (reverseCents > 0) {
    if (!row.host_transfer_id) throw Object.assign(new Error('FellowFare Host Steward fee share cannot be reversed because its transfer ID is missing.'), { status: 409 });
    await edge.provider.reverseHostTransfer({
      transferId: row.host_transfer_id,
      amountCents: reverseCents,
      idempotencyKey: `civweave-fellowfare-host-reversal-${applicationFeeId}-${desiredHostReversal}`,
      metadata: {
        civweave_schema: FELLOWFARE_SERVICE_FEE_SETTLEMENT_SCHEMA,
        fellowfare_application_fee_id: applicationFeeId,
        fellowfare_node_id: row.node_id,
        fellowfare_fee_split: '50-host-steward-50-cerbanimo'
      }
    });
  }

  const at = iso(edge.now());
  const status = refundedFeeCents >= Number(row.fee_cents) ? 'refunded' : refundedFeeCents > 0 ? 'partially-refunded' : 'settled';
  await edge.db.prepare(`UPDATE money_edge_fellowfare_service_fees
    SET refunded_fee_cents=?1,host_reversed_cents=?2,status=?3,updated_at=?4
    WHERE application_fee_id=?5`)
    .bind(refundedFeeCents, desiredHostReversal, status, at, applicationFeeId).run();
  return { applied: true, settlement: publicSettlement(await settlementByFee(edge, applicationFeeId)) };
}
