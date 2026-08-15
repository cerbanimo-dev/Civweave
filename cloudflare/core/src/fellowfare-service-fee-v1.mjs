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
const changes = result => Number(result?.meta?.changes ?? result?.changes ?? 0);

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
    hostTransferredCents: Number(row.host_transferred_cents || 0),
    refundedFeeCents: Number(row.refunded_fee_cents || 0),
    hostReversedCents: Number(row.host_reversed_cents || 0),
    status: row.status,
    settlementError: row.settlement_error || null,
    settledAt: row.settled_at || null,
    updatedAt: row.updated_at || null
  });
}

function availableBalanceError(error) {
  const code = clean(error?.code || error?.raw?.code, 120).toLowerCase();
  const message = clean(error?.message || error?.raw?.message, 1200).toLowerCase();
  return code === 'balance_insufficient'
    || code === 'insufficient_funds'
    || /insufficient.*(?:fund|balance)|available balance/.test(message);
}

function targetHostEntitlement(row, refundedFeeCents = Number(row.refunded_fee_cents || 0)) {
  const netFeeCents = Math.max(0, Number(row.fee_cents) - refundedFeeCents);
  return splitFellowFareServiceFee(netFeeCents).hostStewardShareCents;
}

async function markPendingFunds(edge, row, error) {
  const at = iso(edge.now());
  await edge.db.prepare(`UPDATE money_edge_fellowfare_service_fees
    SET status='pending-funds',settlement_error=?1,updated_at=?2
    WHERE application_fee_id=?3`)
    .bind(clean(error?.message || error, 1200), at, row.application_fee_id).run();
  return settlementByFee(edge, row.application_fee_id);
}

async function attemptHostSettlement(edge, row) {
  const node = await hostNode(edge, row.node_id);
  if (!node?.connected_account_id) throw Object.assign(new Error('The facilitating Guild has no registered Guildkeeper payout account.'), { status: 409 });

  const targetHostCents = targetHostEntitlement(row);
  const transferredCents = Number(row.host_transferred_cents || 0);
  const reversedCents = Number(row.host_reversed_cents || 0);
  const netHostPaidCents = Math.max(0, transferredCents - reversedCents);
  const dueCents = Math.max(0, targetHostCents - netHostPaidCents);
  if (dueCents === 0) {
    const status = Number(row.refunded_fee_cents || 0) >= Number(row.fee_cents) ? 'refunded' : 'settled';
    const at = iso(edge.now());
    await edge.db.prepare(`UPDATE money_edge_fellowfare_service_fees
      SET status=?1,settlement_error=NULL,settled_at=COALESCE(settled_at,?2),updated_at=?3
      WHERE application_fee_id=?4`)
      .bind(status, at, at, row.application_fee_id).run();
    return settlementByFee(edge, row.application_fee_id);
  }
  if (row.host_transfer_id) {
    throw Object.assign(new Error('FellowFare service-fee settlement requires an additional Guildkeeper transfer after an earlier transfer; refusing ambiguous double-transfer state.'), { status: 409 });
  }

  let transfer;
  try {
    transfer = await edge.provider.stripeClient().transfers.create({
      amount: dueCents,
      currency: clean(row.currency, 12).toLowerCase(),
      destination: node.connected_account_id,
      transfer_group: `fellowfare-service-fee:${row.application_fee_id}`,
      metadata: {
        civweave_schema: FELLOWFARE_SERVICE_FEE_SETTLEMENT_SCHEMA,
        fellowfare_application_fee_id: row.application_fee_id,
        fellowfare_charge_id: row.charge_id,
        fellowfare_node_id: row.node_id,
        fellowfare_fee_split: '50-host-steward-50-cerbanimo'
      }
    }, { idempotencyKey: `civweave-fellowfare-host-${row.application_fee_id}` });
  } catch (error) {
    if (availableBalanceError(error)) return markPendingFunds(edge, row, error);
    throw error;
  }

  const at = iso(edge.now());
  await edge.db.prepare(`UPDATE money_edge_fellowfare_service_fees
    SET host_transfer_id=?1,host_transferred_cents=host_transferred_cents+?2,
        status='settled',settlement_error=NULL,settled_at=COALESCE(settled_at,?3),updated_at=?4
    WHERE application_fee_id=?5`)
    .bind(transfer.id, dueCents, at, at, row.application_fee_id).run();
  return settlementByFee(edge, row.application_fee_id);
}

async function ensureSettlementRow(edge, fee) {
  if (fee?.object !== 'application_fee') return { ignored: true, reason: 'not-application-fee' };
  const applicationFeeId = clean(fee.id, 220);
  const providerAccountId = clean(typeof fee.account === 'string' ? fee.account : fee.account?.id, 180);
  const chargeId = clean(typeof fee.charge === 'string' ? fee.charge : fee.charge?.id, 220);
  const feeCents = integer(fee.amount, 'application fee amount');
  const refundedFeeCents = Math.min(feeCents, integer(fee.amount_refunded ?? 0, 'application fee refunded amount'));
  const currency = clean(fee.currency, 12).toLowerCase();
  if (!applicationFeeId || !providerAccountId || !chargeId || !currency) {
    throw Object.assign(new Error('FellowFare application fee is missing Stripe identity fields.'), { status: 409 });
  }

  const prior = await settlementByFee(edge, applicationFeeId);
  if (prior) {
    if (refundedFeeCents > Number(prior.refunded_fee_cents || 0)) {
      const at = iso(edge.now());
      await edge.db.prepare(`UPDATE money_edge_fellowfare_service_fees
        SET refunded_fee_cents=?1,updated_at=?2 WHERE application_fee_id=?3`)
        .bind(refundedFeeCents, at, applicationFeeId).run();
      return settlementByFee(edge, applicationFeeId);
    }
    return prior;
  }

  const charge = await edge.provider.stripeClient().charges.retrieve(chargeId, {}, { stripeAccount: providerAccountId });
  const metadata = charge?.metadata || {};
  if (clean(metadata.civweave_schema, 180) !== FELLOWFARE_DIRECT_COMMERCE_SCHEMA) {
    return { ignored: true, reason: 'not-fellowfare-direct-commerce' };
  }
  const nodeId = clean(metadata.fellowfare_node_id, 180);
  if (!nodeId) throw Object.assign(new Error('FellowFare service charge is missing its facilitating Guild ID.'), { status: 409 });
  const node = await hostNode(edge, nodeId);
  if (!node?.connected_account_id) throw Object.assign(new Error('The facilitating Guild has no registered Guildkeeper payout account.'), { status: 409 });

  const split = splitFellowFareServiceFee(feeCents);
  const at = iso(edge.now());
  await edge.db.prepare(`INSERT OR IGNORE INTO money_edge_fellowfare_service_fees
    (application_fee_id,charge_id,provider_account_id,node_id,fee_cents,currency,host_share_cents,cerbanimo_share_cents,
     host_transfer_id,host_transferred_cents,refunded_fee_cents,host_reversed_cents,status,settlement_error,settled_at,created_at,updated_at)
    VALUES(?1,?2,?3,?4,?5,?6,?7,?8,NULL,0,?9,0,'pending-funds',NULL,NULL,?10,?11)`)
    .bind(applicationFeeId, chargeId, providerAccountId, nodeId, split.feeCents, currency,
      split.hostStewardShareCents, split.cerbanimoShareCents, refundedFeeCents, at, at).run();
  return settlementByFee(edge, applicationFeeId);
}

export async function settleFellowFareServiceFee(edge, fee) {
  const row = await ensureSettlementRow(edge, fee);
  if (row?.ignored) return row;
  const settled = await attemptHostSettlement(edge, row);
  return { applied: true, pendingFunds: settled?.status === 'pending-funds', settlement: publicSettlement(settled) };
}

export async function refundFellowFareServiceFee(edge, fee) {
  let row = await ensureSettlementRow(edge, fee);
  if (row?.ignored) return row;
  const refundedFeeCents = Math.min(Number(row.fee_cents), integer(fee.amount_refunded ?? row.refunded_fee_cents ?? 0, 'application fee refunded amount'));
  const targetHostCents = targetHostEntitlement(row, refundedFeeCents);
  const transferredCents = Number(row.host_transferred_cents || 0);
  const desiredHostReversal = Math.max(0, transferredCents - targetHostCents);
  const priorHostReversal = Number(row.host_reversed_cents || 0);
  const reverseCents = Math.max(0, desiredHostReversal - priorHostReversal);

  if (reverseCents > 0) {
    if (!row.host_transfer_id) throw Object.assign(new Error('FellowFare Guildkeeper fee share cannot be reversed because its transfer ID is missing.'), { status: 409 });
    await edge.provider.reverseHostTransfer({
      transferId: row.host_transfer_id,
      amountCents: reverseCents,
      idempotencyKey: `civweave-fellowfare-host-reversal-${row.application_fee_id}-${desiredHostReversal}`,
      metadata: {
        civweave_schema: FELLOWFARE_SERVICE_FEE_SETTLEMENT_SCHEMA,
        fellowfare_application_fee_id: row.application_fee_id,
        fellowfare_node_id: row.node_id,
        fellowfare_fee_split: '50-host-steward-50-cerbanimo'
      }
    });
  }

  const at = iso(edge.now());
  const status = refundedFeeCents >= Number(row.fee_cents)
    ? 'refunded'
    : row.host_transfer_id || targetHostEntitlement(row) === 0
      ? 'partially-refunded'
      : 'pending-funds';
  await edge.db.prepare(`UPDATE money_edge_fellowfare_service_fees
    SET refunded_fee_cents=?1,host_reversed_cents=?2,status=?3,settlement_error=NULL,updated_at=?4
    WHERE application_fee_id=?5`)
    .bind(refundedFeeCents, desiredHostReversal, status, at, row.application_fee_id).run();
  row = await settlementByFee(edge, row.application_fee_id);
  if (!row.host_transfer_id && targetHostEntitlement(row) > 0) row = await attemptHostSettlement(edge, row);
  return { applied: true, pendingFunds: row?.status === 'pending-funds', settlement: publicSettlement(row) };
}

export async function retryPendingFellowFareServiceFees(edge, { limit = 100 } = {}) {
  const capped = Math.max(1, Math.min(500, Number(limit) || 100));
  const rows = await edge.db.prepare(`SELECT * FROM money_edge_fellowfare_service_fees
    WHERE status='pending-funds' ORDER BY created_at ASC LIMIT ?1`).bind(capped).all();
  const pending = Array.isArray(rows?.results) ? rows.results : [];
  const results = [];
  for (const row of pending) {
    try {
      const settled = await attemptHostSettlement(edge, row);
      results.push({ applicationFeeId: row.application_fee_id, status: settled?.status || 'unknown' });
    } catch (error) {
      if (availableBalanceError(error)) {
        await markPendingFunds(edge, row, error);
        results.push({ applicationFeeId: row.application_fee_id, status: 'pending-funds' });
        break;
      }
      throw error;
    }
  }
  return Object.freeze({
    schema: FELLOWFARE_SERVICE_FEE_SETTLEMENT_SCHEMA,
    attempted: results.length,
    settled: results.filter(result => result.status !== 'pending-funds').length,
    pending: results.filter(result => result.status === 'pending-funds').length,
    results
  });
}
