import * as territoryBase from './territory-stewardship-v1.mjs';
import {
  settleCharterForTopup,
  reverseCharterForTopup,
  settleCharterForMembership,
  settleCharterForFellowFareFee,
  reverseCharterForFellowFareFee,
  retryPendingCharterkeeperShares
} from './charterkeeper-v1.mjs';

export * from './territory-stewardship-v1.mjs';

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const remaining = (charter, fallback) => Number.isSafeInteger(Number(charter?.cerbanimoRemainingCents))
  ? Number(charter.cerbanimoRemainingCents)
  : Math.max(0, Number(fallback) || 0);

export async function settleTerritoryForTopup(edge, topupId) {
  const row = await edge.db.prepare(`SELECT topup_id,node_id,currency,cerbanimo_share_cents,stripe_charge_id FROM money_edge_topups WHERE topup_id=?1`)
    .bind(clean(topupId, 220)).first();
  if (!row) return { ignored: true, reason: 'topup-missing' };
  const charterkeeper = await settleCharterForTopup(edge, row.topup_id);
  const territory = await territoryBase.settleTerritoryShare(edge, {
    sourceKind: 'topup', sourceId: row.topup_id, nodeId: row.node_id,
    cerbanimoShareCents: remaining(charterkeeper, row.cerbanimo_share_cents), currency: row.currency,
    sourceTransaction: row.stripe_charge_id || null
  });
  return Object.freeze({ ...territory, charterkeeper });
}

export async function reverseTerritoryForTopup(edge, topupId, cumulativeGrossCents, kind, eventId) {
  const row = await edge.db.prepare(`SELECT topup_id,gross_cents FROM money_edge_topups WHERE topup_id=?1`).bind(clean(topupId, 220)).first();
  if (!row) return { ignored: true, reason: 'topup-missing' };
  const charterkeeper = await reverseCharterForTopup(edge, row.topup_id, cumulativeGrossCents, kind, eventId);
  const territory = await territoryBase.reverseTerritoryShare(edge, {
    sourceKind: 'topup', sourceId: row.topup_id, cumulativeGrossCents, grossCents: Number(row.gross_cents), kind, eventId
  });
  return Object.freeze({ ...territory, charterkeeper });
}

export async function settleTerritoryForMembership(edge, invoiceId) {
  const row = await edge.db.prepare(`SELECT invoice_id,node_id,cerbanimo_share_cents,stripe_charge_id FROM money_edge_membership_cycles WHERE invoice_id=?1`)
    .bind(clean(invoiceId, 220)).first();
  if (!row) return { ignored: true, reason: 'membership-cycle-missing' };
  const charterkeeper = await settleCharterForMembership(edge, row.invoice_id);
  const territory = await territoryBase.settleTerritoryShare(edge, {
    sourceKind: 'membership', sourceId: row.invoice_id, nodeId: row.node_id,
    cerbanimoShareCents: remaining(charterkeeper, row.cerbanimo_share_cents), currency: 'usd',
    sourceTransaction: row.stripe_charge_id || null
  });
  return Object.freeze({ ...territory, charterkeeper });
}

export async function settleTerritoryForFellowFareFee(edge, applicationFeeId) {
  const row = await edge.db.prepare(`SELECT application_fee_id,node_id,currency,cerbanimo_share_cents FROM money_edge_fellowfare_service_fees WHERE application_fee_id=?1`)
    .bind(clean(applicationFeeId, 220)).first();
  if (!row) return { ignored: true, reason: 'fellowfare-fee-missing' };
  const charterkeeper = await settleCharterForFellowFareFee(edge, row.application_fee_id);
  const territory = await territoryBase.settleTerritoryShare(edge, {
    sourceKind: 'fellowfare-service-fee', sourceId: row.application_fee_id, nodeId: row.node_id,
    cerbanimoShareCents: remaining(charterkeeper, row.cerbanimo_share_cents), currency: row.currency
  });
  return Object.freeze({ ...territory, charterkeeper });
}

export async function reverseTerritoryForFellowFareFee(edge, applicationFeeId, refundedFeeCents, eventId = '') {
  const row = await edge.db.prepare(`SELECT application_fee_id,fee_cents FROM money_edge_fellowfare_service_fees WHERE application_fee_id=?1`)
    .bind(clean(applicationFeeId, 220)).first();
  if (!row) return { ignored: true, reason: 'fellowfare-fee-missing' };
  const charterkeeper = await reverseCharterForFellowFareFee(edge, row.application_fee_id, refundedFeeCents, eventId);
  const territory = await territoryBase.reverseTerritoryShare(edge, {
    sourceKind: 'fellowfare-service-fee', sourceId: row.application_fee_id,
    cumulativeGrossCents: refundedFeeCents, grossCents: Number(row.fee_cents), kind: 'refund', eventId
  });
  return Object.freeze({ ...territory, charterkeeper });
}

export async function retryPendingTerritoryShares(edge, options = {}) {
  const charterkeeper = await retryPendingCharterkeeperShares(edge, options);
  const territory = await territoryBase.retryPendingTerritoryShares(edge, options);
  return Object.freeze({ ...territory, charterkeeper });
}
