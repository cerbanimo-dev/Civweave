export const TERRITORY_STEWARDSHIP_SCHEMA = 'civweave.territory-stewardship.v1';
export const TERRITORY_SETTLEMENT_SCHEMA = 'civweave.territory-stewardship-settlement.v1';

export const TERRITORY_STEWARDSHIP_POLICY = Object.freeze({
  cerbanimoGlobalShareBpsOfExistingCerbanimoShare: 5000,
  territoryStewardshipShareBpsOfExistingCerbanimoShare: 5000,
  hostNodeStewardShareInvariant: true,
  providerShareInvariant: true,
  systemReserveInvariant: true,
  vacancyDestination: 'territory-operations-reserve',
  precedence: 'most-specific-appointed-territory-then-parent',
  payoutGate: 'appointment-plus-agreement-plus-payout-onboarding',
  equityEffect: 'none'
});

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const iso = value => new Date(value).toISOString();
const integer = (value, label, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw Object.assign(new RangeError(`${label} must be an integer from ${min} through ${max}.`), { status: 400 });
  }
  return number;
};
const proportional = (total, part, whole) => {
  if (!whole || !total || !part) return 0;
  return Math.max(0, Math.min(total, Math.floor(total * part / whole)));
};

export function splitExistingCerbanimoShare(cerbanimoShareCents) {
  const total = integer(cerbanimoShareCents, 'cerbanimoShareCents');
  const cerbanimoGlobalCents = Math.floor(total * TERRITORY_STEWARDSHIP_POLICY.cerbanimoGlobalShareBpsOfExistingCerbanimoShare / 10_000);
  return Object.freeze({
    existingCerbanimoShareCents: total,
    cerbanimoGlobalCents,
    territoryStewardshipCents: total - cerbanimoGlobalCents,
    cerbanimoGlobalShareBps: TERRITORY_STEWARDSHIP_POLICY.cerbanimoGlobalShareBpsOfExistingCerbanimoShare,
    territoryStewardshipShareBps: TERRITORY_STEWARDSHIP_POLICY.territoryStewardshipShareBpsOfExistingCerbanimoShare
  });
}

async function territory(edge, territoryId) {
  const id = clean(territoryId, 120).toLowerCase();
  if (!id) return null;
  return edge.db.prepare(`SELECT territory_id,parent_territory_id,name,country_code,subdivision_code,locality,depth,active
    FROM money_edge_territories WHERE territory_id=?1`).bind(id).first();
}

async function nodeTerritory(edge, nodeId) {
  const node = await edge.db.prepare('SELECT node_id,territory_id FROM money_edge_nodes WHERE node_id=?1')
    .bind(clean(nodeId, 180)).first();
  if (!node?.territory_id) return null;
  return territory(edge, node.territory_id);
}

async function activeAppointment(edge, territoryId, at = iso(edge.now())) {
  if (!territoryId) return null;
  return edge.db.prepare(`WITH RECURSIVE lineage(territory_id,parent_territory_id,depth) AS (
      SELECT territory_id,parent_territory_id,depth FROM money_edge_territories WHERE territory_id=?1 AND active=1
      UNION ALL
      SELECT t.territory_id,t.parent_territory_id,t.depth
      FROM money_edge_territories t JOIN lineage l ON t.territory_id=l.parent_territory_id
      WHERE t.active=1
    )
    SELECT s.*,l.depth AS matched_depth,l.territory_id AS matched_territory_id
    FROM lineage l JOIN money_edge_territory_stewards s ON s.territory_id=l.territory_id
    WHERE s.appointment_status='appointed'
      AND s.effective_from<=?2
      AND (s.effective_until IS NULL OR s.effective_until>?2)
    ORDER BY l.depth DESC,s.effective_from DESC LIMIT 1`).bind(clean(territoryId, 120).toLowerCase(), at).first();
}

function publicAppointment(row) {
  if (!row) return null;
  return Object.freeze({
    appointmentId: row.appointment_id,
    territoryId: row.territory_id,
    publicName: row.public_name,
    homeRegion: row.home_region || null,
    effectiveFrom: row.effective_from,
    effectiveUntil: row.effective_until || null,
    appointmentStatus: row.appointment_status,
    agreementStatus: row.agreement_status,
    payoutStatus: row.payout_status,
    matchedTerritoryId: row.matched_territory_id || row.territory_id
  });
}

export async function publicTerritoryRegistry(edge) {
  const territories = await edge.db.prepare(`SELECT territory_id,parent_territory_id,name,country_code,subdivision_code,locality,depth,active
    FROM money_edge_territories WHERE active=1 ORDER BY country_code,depth,territory_id`).all();
  const appointments = await edge.db.prepare(`SELECT appointment_id,territory_id,public_name,home_region,effective_from,effective_until,
    appointment_status,agreement_status,payout_status FROM money_edge_territory_stewards
    WHERE appointment_status='appointed' ORDER BY territory_id,effective_from DESC`).all();
  return Object.freeze({
    schema: TERRITORY_STEWARDSHIP_SCHEMA,
    policy: TERRITORY_STEWARDSHIP_POLICY,
    territories: territories?.results || [],
    appointments: (appointments?.results || []).map(publicAppointment)
  });
}

export async function assignNodeTerritory(edge, { nodeId, territoryId } = {}, raw, signatureHeader) {
  const id = clean(nodeId, 180);
  if (!id) throw Object.assign(new TypeError('nodeId is required.'), { status: 400 });
  await edge.verifyNodeRequest(id, raw, signatureHeader);
  const selected = await territory(edge, territoryId);
  if (!selected || Number(selected.active) !== 1) throw Object.assign(new Error('Unknown or inactive Civweave territory.'), { status: 404 });
  const at = iso(edge.now());
  await edge.db.prepare('UPDATE money_edge_nodes SET territory_id=?1,updated_at=?2 WHERE node_id=?3')
    .bind(selected.territory_id, at, id).run();
  const appointment = await activeAppointment(edge, selected.territory_id, at);
  return Object.freeze({
    schema: TERRITORY_STEWARDSHIP_SCHEMA,
    nodeId: id,
    territory: selected,
    activeSteward: publicAppointment(appointment),
    routing: appointment?.matched_territory_id === selected.territory_id ? 'exact-territory' : appointment ? 'parent-fallback' : 'vacancy-reserve'
  });
}

async function settlementBySource(edge, sourceKind, sourceId) {
  return edge.db.prepare(`SELECT * FROM money_edge_territory_settlements WHERE source_kind=?1 AND source_id=?2`)
    .bind(clean(sourceKind, 80), clean(sourceId, 220)).first();
}

function publicSettlement(row) {
  if (!row) return null;
  return Object.freeze({
    schema: TERRITORY_SETTLEMENT_SCHEMA,
    settlementId: row.settlement_id,
    sourceKind: row.source_kind,
    sourceId: row.source_id,
    nodeId: row.node_id,
    territoryId: row.territory_id || null,
    appointmentId: row.appointment_id || null,
    stewardPublicName: row.steward_public_name || null,
    existingCerbanimoShareCents: Number(row.existing_cerbanimo_share_cents || 0),
    cerbanimoGlobalCents: Number(row.cerbanimo_global_cents || 0),
    territoryStewardshipCents: Number(row.territory_share_cents || 0),
    territoryTransferredCents: Number(row.transferred_cents || 0),
    territoryRefundReversedCents: Number(row.refund_reversed_cents || 0),
    territoryDisputeReversedCents: Number(row.dispute_reversed_cents || 0),
    currency: row.currency,
    transferId: row.transfer_id || null,
    status: row.status,
    settlementError: row.settlement_error || null,
    updatedAt: row.updated_at
  });
}

function availableBalanceError(error) {
  const code = clean(error?.code || error?.raw?.code, 120).toLowerCase();
  const message = clean(error?.message || error?.raw?.message, 1200).toLowerCase();
  return code === 'balance_insufficient' || code === 'insufficient_funds' || /insufficient.*(?:fund|balance)|available balance/.test(message);
}

async function markStatus(edge, row, status, error = null) {
  const at = iso(edge.now());
  await edge.db.prepare(`UPDATE money_edge_territory_settlements SET status=?1,settlement_error=?2,updated_at=?3 WHERE settlement_id=?4`)
    .bind(status, error ? clean(error?.message || error, 1200) : null, at, row.settlement_id).run();
  return settlementBySource(edge, row.source_kind, row.source_id);
}

async function ensureSettlement(edge, { sourceKind, sourceId, nodeId, cerbanimoShareCents, currency = 'usd', sourceTransaction = null } = {}) {
  const kind = clean(sourceKind, 80), source = clean(sourceId, 220), node = clean(nodeId, 180);
  if (!kind || !source || !node) throw Object.assign(new TypeError('sourceKind, sourceId, and nodeId are required.'), { status: 400 });
  const prior = await settlementBySource(edge, kind, source);
  if (prior) return prior;
  const split = splitExistingCerbanimoShare(cerbanimoShareCents);
  const mappedTerritory = await nodeTerritory(edge, node);
  const appointment = mappedTerritory ? await activeAppointment(edge, mappedTerritory.territory_id) : null;
  const payoutReady = appointment?.agreement_status === 'accepted' && appointment?.payout_status === 'ready' && clean(appointment?.payout_account_id, 180);
  const status = !mappedTerritory
    ? 'reserved-unassigned-territory'
    : !appointment
      ? 'reserved-vacancy'
      : !payoutReady
        ? 'reserved-pending-onboarding'
        : 'pending-funds';
  const at = iso(edge.now());
  const settlementId = `territory:${crypto.randomUUID()}`;
  await edge.db.prepare(`INSERT OR IGNORE INTO money_edge_territory_settlements
    (settlement_id,source_kind,source_id,node_id,territory_id,appointment_id,steward_public_name,payout_account_id,
     existing_cerbanimo_share_cents,cerbanimo_global_cents,territory_share_cents,currency,source_transaction_id,transfer_id,
     transferred_cents,refund_reversed_cents,dispute_reversed_cents,status,settlement_error,created_at,updated_at,settled_at)
    VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,NULL,0,0,0,?14,NULL,?15,?16,NULL)`)
    .bind(settlementId, kind, source, node, mappedTerritory?.territory_id || null, appointment?.appointment_id || null,
      appointment?.public_name || null, payoutReady ? appointment.payout_account_id : null,
      split.existingCerbanimoShareCents, split.cerbanimoGlobalCents, split.territoryStewardshipCents,
      clean(currency || 'usd', 12).toLowerCase(), clean(sourceTransaction, 220) || null, status, at, at).run();
  return settlementBySource(edge, kind, source);
}

async function attemptSettlement(edge, row) {
  const grossEntitlement = Number(row.territory_share_cents || 0);
  const reductions = Number(row.refund_reversed_cents || 0) + Number(row.dispute_reversed_cents || 0);
  const target = Math.max(0, grossEntitlement - reductions);
  const transferred = Number(row.transferred_cents || 0);
  const due = Math.max(0, target - transferred);
  if (due === 0) {
    const status = target === 0 ? 'reversed' : transferred > 0 ? 'settled' : row.status;
    return markStatus(edge, row, status);
  }
  if (!row.payout_account_id) return row;
  if (row.transfer_id && due > 0) return markStatus(edge, row, 'pending-error', new Error('Additional territory transfer would require a second transfer; settlement held for review.'));
  let transfer;
  try {
    const params = {
      amount: due,
      currency: clean(row.currency, 12).toLowerCase(),
      destination: row.payout_account_id,
      transfer_group: `civweave-territory:${row.source_kind}:${row.source_id}`,
      metadata: {
        civweave_schema: TERRITORY_SETTLEMENT_SCHEMA,
        civweave_source_kind: row.source_kind,
        civweave_source_id: row.source_id,
        civweave_node_id: row.node_id,
        civweave_territory_id: row.territory_id || '',
        civweave_appointment_id: row.appointment_id || '',
        civweave_split: 'existing-cerbanimo-share-50-global-50-territory'
      }
    };
    if (row.source_transaction_id) params.source_transaction = row.source_transaction_id;
    transfer = await edge.provider.stripeClient().transfers.create(params, {
      idempotencyKey: `civweave-territory-${row.source_kind}-${row.source_id}`.slice(0, 255)
    });
  } catch (error) {
    return markStatus(edge, row, availableBalanceError(error) ? 'pending-funds' : 'pending-error', error);
  }
  const at = iso(edge.now());
  await edge.db.prepare(`UPDATE money_edge_territory_settlements SET transfer_id=?1,transferred_cents=?2,status='settled',
    settlement_error=NULL,settled_at=?3,updated_at=?4 WHERE settlement_id=?5`)
    .bind(transfer.id, transferred + due, at, at, row.settlement_id).run();
  return settlementBySource(edge, row.source_kind, row.source_id);
}

export async function settleTerritoryShare(edge, input = {}) {
  const row = await ensureSettlement(edge, input);
  const settled = await attemptSettlement(edge, row);
  return Object.freeze({ applied: true, settlement: publicSettlement(settled) });
}

export async function reverseTerritoryShare(edge, { sourceKind, sourceId, cumulativeGrossCents, grossCents, kind = 'refund', eventId = '' } = {}) {
  let row = await settlementBySource(edge, sourceKind, sourceId);
  if (!row) return { ignored: true, reason: 'territory-settlement-missing' };
  const total = Number(row.territory_share_cents || 0);
  const numerator = integer(cumulativeGrossCents || 0, 'cumulativeGrossCents');
  const denominator = integer(grossCents || 0, 'grossCents');
  if (denominator <= 0) return { ignored: true, reason: 'zero-gross' };
  const ownColumn = kind === 'dispute' ? 'dispute_reversed_cents' : 'refund_reversed_cents';
  const otherColumn = kind === 'dispute' ? 'refund_reversed_cents' : 'dispute_reversed_cents';
  const current = Number(row[ownColumn] || 0), other = Number(row[otherColumn] || 0);
  const target = Math.min(proportional(total, numerator, denominator), Math.max(0, total - other));
  const delta = Math.max(0, target - current);
  if (delta > 0 && row.transfer_id) {
    await edge.provider.reverseHostTransfer({
      transferId: row.transfer_id,
      amountCents: delta,
      idempotencyKey: `civweave-territory-${kind}-${clean(eventId || sourceId, 120)}-${target}`.slice(0, 255),
      metadata: {
        civweave_schema: TERRITORY_SETTLEMENT_SCHEMA,
        civweave_source_kind: row.source_kind,
        civweave_source_id: row.source_id,
        civweave_reason: kind
      }
    });
  }
  const at = iso(edge.now());
  await edge.db.prepare(`UPDATE money_edge_territory_settlements SET ${ownColumn}=?1,status=?2,updated_at=?3 WHERE settlement_id=?4`)
    .bind(target, target + other >= total ? 'reversed' : 'partially-reversed', at, row.settlement_id).run();
  row = await settlementBySource(edge, sourceKind, sourceId);
  return Object.freeze({ applied: true, reversedCents: delta, settlement: publicSettlement(row) });
}

export async function settleTerritoryForTopup(edge, topupId) {
  const row = await edge.db.prepare(`SELECT topup_id,node_id,currency,cerbanimo_share_cents,stripe_charge_id FROM money_edge_topups WHERE topup_id=?1`)
    .bind(clean(topupId, 220)).first();
  if (!row) return { ignored: true, reason: 'topup-missing' };
  return settleTerritoryShare(edge, {
    sourceKind: 'topup', sourceId: row.topup_id, nodeId: row.node_id,
    cerbanimoShareCents: Number(row.cerbanimo_share_cents || 0), currency: row.currency,
    sourceTransaction: row.stripe_charge_id || null
  });
}

export async function reverseTerritoryForTopup(edge, topupId, cumulativeGrossCents, kind, eventId) {
  const row = await edge.db.prepare(`SELECT topup_id,gross_cents FROM money_edge_topups WHERE topup_id=?1`).bind(clean(topupId, 220)).first();
  if (!row) return { ignored: true, reason: 'topup-missing' };
  return reverseTerritoryShare(edge, { sourceKind: 'topup', sourceId: row.topup_id, cumulativeGrossCents, grossCents: Number(row.gross_cents), kind, eventId });
}

export async function settleTerritoryForMembership(edge, invoiceId) {
  const row = await edge.db.prepare(`SELECT invoice_id,node_id,cerbanimo_share_cents,stripe_charge_id FROM money_edge_membership_cycles WHERE invoice_id=?1`)
    .bind(clean(invoiceId, 220)).first();
  if (!row) return { ignored: true, reason: 'membership-cycle-missing' };
  return settleTerritoryShare(edge, {
    sourceKind: 'membership', sourceId: row.invoice_id, nodeId: row.node_id,
    cerbanimoShareCents: Number(row.cerbanimo_share_cents || 0), currency: 'usd', sourceTransaction: row.stripe_charge_id || null
  });
}

export async function settleTerritoryForFellowFareFee(edge, applicationFeeId) {
  const row = await edge.db.prepare(`SELECT application_fee_id,node_id,currency,cerbanimo_share_cents FROM money_edge_fellowfare_service_fees WHERE application_fee_id=?1`)
    .bind(clean(applicationFeeId, 220)).first();
  if (!row) return { ignored: true, reason: 'fellowfare-fee-missing' };
  return settleTerritoryShare(edge, {
    sourceKind: 'fellowfare-service-fee', sourceId: row.application_fee_id, nodeId: row.node_id,
    cerbanimoShareCents: Number(row.cerbanimo_share_cents || 0), currency: row.currency
  });
}

export async function reverseTerritoryForFellowFareFee(edge, applicationFeeId, refundedFeeCents, eventId = '') {
  const row = await edge.db.prepare(`SELECT application_fee_id,fee_cents FROM money_edge_fellowfare_service_fees WHERE application_fee_id=?1`)
    .bind(clean(applicationFeeId, 220)).first();
  if (!row) return { ignored: true, reason: 'fellowfare-fee-missing' };
  return reverseTerritoryShare(edge, {
    sourceKind: 'fellowfare-service-fee', sourceId: row.application_fee_id,
    cumulativeGrossCents: refundedFeeCents, grossCents: Number(row.fee_cents), kind: 'refund', eventId
  });
}

export async function retryPendingTerritoryShares(edge, { limit = 100 } = {}) {
  const capped = Math.max(1, Math.min(500, Number(limit) || 100));
  const rows = await edge.db.prepare(`SELECT * FROM money_edge_territory_settlements
    WHERE status IN ('pending-funds','pending-error') ORDER BY created_at ASC LIMIT ?1`).bind(capped).all();
  const pending = rows?.results || [];
  const results = [];
  for (const row of pending) {
    const settled = await attemptSettlement(edge, row);
    results.push({ settlementId: row.settlement_id, status: settled?.status || 'unknown' });
  }
  return Object.freeze({
    schema: TERRITORY_SETTLEMENT_SCHEMA,
    attempted: results.length,
    settled: results.filter(result => result.status === 'settled').length,
    pending: results.filter(result => result.status !== 'settled').length,
    results
  });
}
