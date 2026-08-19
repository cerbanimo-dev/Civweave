export const CHARTERKEEPER_SCHEMA = 'civweave.charterkeeper.v1';
export const CHARTERKEEPER_SETTLEMENT_SCHEMA = 'civweave.charterkeeper-settlement.v1';

export const CHARTERKEEPER_POLICY = Object.freeze({
  charterkeeperShareBpsOfExistingCerbanimoShare: 5000,
  cerbanimoRemainingShareBpsOfExistingCerbanimoShare: 5000,
  relationshipDepth: 1,
  recursiveAncestorShares: false,
  multipleChildGuildsAllowed: true,
  oneActiveCharterkeeperPerChildGuild: true,
  revenueStartsAt: 'child-guild-acceptance-after-training',
  revenueStopsAt: 'charter-ended-or-charterkeeper-no-longer-operates-source-guild',
  payoutGate: 'active-charter-plus-agreement-plus-connected-source-guild',
  sourceBoundary: 'existing-cerbanimo-share-only',
  hostGuildkeeperShareInvariant: true,
  systemReserveInvariant: true,
  memberPriceInvariant: true
});

export const CHARTERKEEPER_TRAINING_MODULES = Object.freeze([
  Object.freeze({ id: 'guild-purpose-and-charter', label: 'Guild purpose and charter' }),
  Object.freeze({ id: 'member-safety-and-governance', label: 'Member safety and governance' }),
  Object.freeze({ id: 'capacity-and-costs', label: 'Capacity and costs' }),
  Object.freeze({ id: 'payments-and-compliance', label: 'Payments and compliance' }),
  Object.freeze({ id: 'handoff-readiness', label: 'Handoff readiness' })
]);

const TRAINING_IDS = new Set(CHARTERKEEPER_TRAINING_MODULES.map(item => item.id));
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

export function splitCerbanimoForCharterkeeper(cerbanimoShareCents, shareBps = CHARTERKEEPER_POLICY.charterkeeperShareBpsOfExistingCerbanimoShare) {
  const total = integer(cerbanimoShareCents, 'cerbanimoShareCents');
  const bps = integer(shareBps, 'charterkeeperShareBps', 0, 10_000);
  const charterkeeperShareCents = Math.floor(total * bps / 10_000);
  return Object.freeze({
    existingCerbanimoShareCents: total,
    charterkeeperShareCents,
    cerbanimoRemainingCents: total - charterkeeperShareCents,
    charterkeeperShareBps: bps
  });
}

async function charterRow(edge, charterId) {
  const id = clean(charterId, 180);
  if (!id) return null;
  return edge.db.prepare('SELECT * FROM money_edge_charters WHERE charter_id=?1').bind(id).first();
}

async function trainingRows(edge, charterId) {
  const rows = await edge.db.prepare(`SELECT charter_id,module_id,completed_by_node_id,evidence_hash,note,completed_at
    FROM money_edge_charter_training WHERE charter_id=?1 ORDER BY completed_at,module_id`).bind(clean(charterId, 180)).all();
  return rows?.results || [];
}

function trainingSummary(rows = []) {
  const completed = new Set(rows.map(row => row.module_id));
  const modules = CHARTERKEEPER_TRAINING_MODULES.map(module => Object.freeze({
    ...module,
    completed: completed.has(module.id),
    completion: rows.find(row => row.module_id === module.id) || null
  }));
  return Object.freeze({
    required: modules.length,
    completed: modules.filter(module => module.completed).length,
    complete: modules.every(module => module.completed),
    modules: Object.freeze(modules)
  });
}

async function publicCharter(edge, row) {
  if (!row) return null;
  const training = trainingSummary(await trainingRows(edge, row.charter_id));
  return Object.freeze({
    schema: CHARTERKEEPER_SCHEMA,
    charterId: row.charter_id,
    charterkeeperNodeId: row.charterkeeper_node_id,
    charterkeeperOperatorId: row.charterkeeper_operator_id,
    route: row.route,
    nomineeUserId: row.nominee_user_id,
    nomineeLabel: row.nominee_label || null,
    proposedGuildName: row.proposed_guild_name,
    proposedNodeId: row.proposed_node_id || null,
    childNodeId: row.child_node_id || null,
    childOperatorId: row.child_operator_id || null,
    status: row.status,
    agreementStatus: row.agreement_status,
    agreementVersion: row.agreement_version || null,
    charterkeeperShareBps: Number(row.charterkeeper_share_bps),
    training,
    activatedAt: row.activated_at || null,
    endedAt: row.ended_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });
}

async function verifyNode(edge, nodeId, raw, signatureHeader) {
  const id = clean(nodeId, 180);
  if (!id) throw Object.assign(new TypeError('nodeId is required.'), { status: 400 });
  const node = await edge.verifyNodeRequest(id, raw, signatureHeader);
  if (!node) throw Object.assign(new Error('Guild is not registered with the Civweave money edge.'), { status: 404 });
  return node;
}

export async function createCharter(edge, input = {}, raw, signatureHeader) {
  const charterkeeperNodeId = clean(input.charterkeeperNodeId || input.nodeId, 180);
  const node = await verifyNode(edge, charterkeeperNodeId, raw, signatureHeader);
  const route = clean(input.route, 40).toLowerCase();
  if (!['founder-transfer', 'mentor-direct'].includes(route)) throw Object.assign(new RangeError('Charter route must be founder-transfer or mentor-direct.'), { status: 400 });
  const nomineeUserId = clean(input.nomineeUserId, 180);
  const proposedGuildName = clean(input.proposedGuildName, 180);
  if (!nomineeUserId || !proposedGuildName) throw Object.assign(new TypeError('nomineeUserId and proposedGuildName are required.'), { status: 400 });
  const proposedNodeId = clean(input.proposedNodeId, 180) || null;
  if (proposedNodeId && proposedNodeId === charterkeeperNodeId) throw Object.assign(new RangeError('A Charterkeeper source Guild cannot charter itself.'), { status: 409 });
  const idempotencyKey = clean(input.idempotencyKey, 180);
  if (!idempotencyKey) throw Object.assign(new TypeError('idempotencyKey is required.'), { status: 400 });
  const prior = await edge.db.prepare('SELECT * FROM money_edge_charters WHERE idempotency_key=?1').bind(idempotencyKey).first();
  if (prior) return Object.freeze({ charter: await publicCharter(edge, prior), idempotent: true });
  const charterId = `charter:${crypto.randomUUID()}`;
  const at = iso(edge.now());
  await edge.db.prepare(`INSERT INTO money_edge_charters
    (charter_id,idempotency_key,charterkeeper_node_id,charterkeeper_operator_id,route,nominee_user_id,nominee_label,
     proposed_guild_name,proposed_node_id,child_node_id,child_operator_id,status,agreement_status,agreement_version,
     agreement_accepted_at,charterkeeper_share_bps,activated_at,ended_at,ended_by_node_id,created_at,updated_at)
    VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,NULL,NULL,'nominated','pending-signature',NULL,NULL,?10,NULL,NULL,NULL,?11,?12)`)
    .bind(charterId, idempotencyKey, charterkeeperNodeId, node.operator_id, route, nomineeUserId,
      clean(input.nomineeLabel, 180) || null, proposedGuildName, proposedNodeId,
      CHARTERKEEPER_POLICY.charterkeeperShareBpsOfExistingCerbanimoShare, at, at).run();
  return Object.freeze({ charter: await publicCharter(edge, await charterRow(edge, charterId)), idempotent: false });
}

export async function recordCharterTraining(edge, charterId, input = {}, raw, signatureHeader) {
  const row = await charterRow(edge, charterId);
  if (!row) throw Object.assign(new Error('Charter not found.'), { status: 404 });
  await verifyNode(edge, row.charterkeeper_node_id, raw, signatureHeader);
  if (row.status === 'ended' || row.status === 'active') throw Object.assign(new Error('Training cannot be changed after a Charter is active or ended.'), { status: 409 });
  const moduleId = clean(input.moduleId, 120);
  if (!TRAINING_IDS.has(moduleId)) throw Object.assign(new RangeError('Unknown Charterkeeper training module.'), { status: 400 });
  const evidenceHash = clean(input.evidenceHash, 180) || null;
  const note = clean(input.note, 1000) || null;
  const at = iso(edge.now());
  await edge.db.prepare(`INSERT INTO money_edge_charter_training(charter_id,module_id,completed_by_node_id,evidence_hash,note,completed_at)
    VALUES(?1,?2,?3,?4,?5,?6)
    ON CONFLICT(charter_id,module_id) DO UPDATE SET completed_by_node_id=excluded.completed_by_node_id,
      evidence_hash=excluded.evidence_hash,note=excluded.note,completed_at=excluded.completed_at`)
    .bind(row.charter_id, moduleId, row.charterkeeper_node_id, evidenceHash, note, at).run();
  const training = trainingSummary(await trainingRows(edge, row.charter_id));
  const nextStatus = training.complete ? (row.proposed_node_id ? 'handoff-pending' : 'ready-for-guild') : 'training';
  await edge.db.prepare('UPDATE money_edge_charters SET status=?1,updated_at=?2 WHERE charter_id=?3')
    .bind(nextStatus, at, row.charter_id).run();
  return Object.freeze({ charter: await publicCharter(edge, await charterRow(edge, row.charter_id)) });
}

export async function prepareCharterChild(edge, charterId, input = {}, raw, signatureHeader) {
  const row = await charterRow(edge, charterId);
  if (!row) throw Object.assign(new Error('Charter not found.'), { status: 404 });
  await verifyNode(edge, row.charterkeeper_node_id, raw, signatureHeader);
  if (row.status === 'active' || row.status === 'ended') throw Object.assign(new Error('Active or ended Charters cannot change their proposed child Guild.'), { status: 409 });
  const proposedNodeId = clean(input.proposedNodeId || input.childNodeId, 180);
  if (!proposedNodeId || proposedNodeId === row.charterkeeper_node_id) throw Object.assign(new RangeError('A different proposed child Guild node ID is required.'), { status: 400 });
  const training = trainingSummary(await trainingRows(edge, row.charter_id));
  const at = iso(edge.now());
  await edge.db.prepare('UPDATE money_edge_charters SET proposed_node_id=?1,status=?2,updated_at=?3 WHERE charter_id=?4')
    .bind(proposedNodeId, training.complete ? 'handoff-pending' : 'training', at, row.charter_id).run();
  return Object.freeze({ charter: await publicCharter(edge, await charterRow(edge, row.charter_id)) });
}

export async function acceptCharter(edge, charterId, input = {}, raw, signatureHeader) {
  const row = await charterRow(edge, charterId);
  if (!row) throw Object.assign(new Error('Charter not found.'), { status: 404 });
  if (row.status === 'ended') throw Object.assign(new Error('Ended Charters cannot be reactivated.'), { status: 409 });
  const childNodeId = clean(input.childNodeId || input.nodeId, 180);
  if (!childNodeId || childNodeId === row.charterkeeper_node_id) throw Object.assign(new RangeError('A different child Guild node ID is required.'), { status: 400 });
  if (row.proposed_node_id && row.proposed_node_id !== childNodeId) throw Object.assign(new Error('Child Guild does not match the Charterkeeper-prepared Guild ID.'), { status: 409 });
  const child = await verifyNode(edge, childNodeId, raw, signatureHeader);
  const training = trainingSummary(await trainingRows(edge, row.charter_id));
  if (!training.complete) throw Object.assign(new Error('Charterkeeper training must be complete before the child Guild accepts the Charter.'), { status: 409 });
  const occupied = await edge.db.prepare(`SELECT charter_id FROM money_edge_charters WHERE child_node_id=?1 AND status='active' AND charter_id<>?2`)
    .bind(childNodeId, row.charter_id).first();
  if (occupied) throw Object.assign(new Error('This Guild already has an active Charterkeeper relationship.'), { status: 409 });
  const at = iso(edge.now());
  await edge.db.prepare(`UPDATE money_edge_charters SET proposed_node_id=?1,child_node_id=?2,child_operator_id=?3,
    status='active',activated_at=COALESCE(activated_at,?4),updated_at=?5 WHERE charter_id=?6`)
    .bind(childNodeId, childNodeId, child.operator_id, at, at, row.charter_id).run();
  return Object.freeze({ charter: await publicCharter(edge, await charterRow(edge, row.charter_id)), revenueShareActive: true });
}

export async function acceptCharterAgreement(edge, charterId, input = {}, raw, signatureHeader) {
  const row = await charterRow(edge, charterId);
  if (!row) throw Object.assign(new Error('Charter not found.'), { status: 404 });
  await verifyNode(edge, row.charterkeeper_node_id, raw, signatureHeader);
  const version = clean(input.version || input.termsVersion, 120);
  if (!version) throw Object.assign(new TypeError('Charterkeeper agreement version is required.'), { status: 400 });
  const at = iso(edge.now());
  await edge.db.prepare(`UPDATE money_edge_charters SET agreement_status='accepted',agreement_version=?1,
    agreement_accepted_at=?2,updated_at=?3 WHERE charter_id=?4`).bind(version, at, at, row.charter_id).run();
  return Object.freeze({ charter: await publicCharter(edge, await charterRow(edge, row.charter_id)) });
}

export async function endCharter(edge, charterId, input = {}, raw, signatureHeader) {
  const row = await charterRow(edge, charterId);
  if (!row) throw Object.assign(new Error('Charter not found.'), { status: 404 });
  if (row.status === 'ended') return Object.freeze({ charter: await publicCharter(edge, row), idempotent: true });
  const signerNodeId = clean(input.nodeId || input.signerNodeId, 180);
  if (![row.charterkeeper_node_id, row.child_node_id].filter(Boolean).includes(signerNodeId)) {
    throw Object.assign(new Error('Only the Charterkeeper Guild or child Guild may end this Charter.'), { status: 403 });
  }
  await verifyNode(edge, signerNodeId, raw, signatureHeader);
  const at = iso(edge.now());
  await edge.db.prepare(`UPDATE money_edge_charters SET status='ended',ended_at=?1,ended_by_node_id=?2,
    updated_at=?3 WHERE charter_id=?4`).bind(at, signerNodeId, at, row.charter_id).run();
  return Object.freeze({ charter: await publicCharter(edge, await charterRow(edge, row.charter_id)), idempotent: false });
}

export async function listCharters(edge, nodeId, raw, signatureHeader) {
  const id = clean(nodeId, 180);
  await verifyNode(edge, id, raw, signatureHeader);
  const rows = await edge.db.prepare(`SELECT * FROM money_edge_charters
    WHERE charterkeeper_node_id=?1 OR child_node_id=?1 OR proposed_node_id=?1
    ORDER BY created_at DESC`).bind(id).all();
  const charters = [];
  for (const row of rows?.results || []) charters.push(await publicCharter(edge, row));
  return Object.freeze({ schema: CHARTERKEEPER_SCHEMA, policy: CHARTERKEEPER_POLICY, trainingModules: CHARTERKEEPER_TRAINING_MODULES, charters: Object.freeze(charters) });
}

async function activeCharterForChild(edge, childNodeId) {
  const row = await edge.db.prepare(`SELECT * FROM money_edge_charters WHERE child_node_id=?1 AND status='active'
    ORDER BY activated_at DESC LIMIT 1`).bind(clean(childNodeId, 180)).first();
  if (!row) return null;
  const source = await edge.node(row.charterkeeper_node_id);
  if (!source || clean(source.operator_id, 180) !== clean(row.charterkeeper_operator_id, 180)) return null;
  return { charter: row, source };
}

async function settlementBySource(edge, sourceKind, sourceId) {
  return edge.db.prepare(`SELECT * FROM money_edge_charter_settlements WHERE source_kind=?1 AND source_id=?2`)
    .bind(clean(sourceKind, 80), clean(sourceId, 220)).first();
}

function publicSettlement(row) {
  if (!row) return null;
  return Object.freeze({
    schema: CHARTERKEEPER_SETTLEMENT_SCHEMA,
    settlementId: row.settlement_id,
    sourceKind: row.source_kind,
    sourceId: row.source_id,
    childNodeId: row.child_node_id,
    charterId: row.charter_id,
    charterkeeperNodeId: row.charterkeeper_node_id,
    existingCerbanimoShareCents: Number(row.existing_cerbanimo_share_cents || 0),
    charterkeeperShareCents: Number(row.charterkeeper_share_cents || 0),
    cerbanimoRemainingCents: Number(row.cerbanimo_remaining_cents || 0),
    charterkeeperTransferredCents: Number(row.transferred_cents || 0),
    refundReversedCents: Number(row.refund_reversed_cents || 0),
    disputeReversedCents: Number(row.dispute_reversed_cents || 0),
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

async function markSettlementStatus(edge, row, status, error = null) {
  const at = iso(edge.now());
  await edge.db.prepare(`UPDATE money_edge_charter_settlements SET status=?1,settlement_error=?2,updated_at=?3 WHERE settlement_id=?4`)
    .bind(status, error ? clean(error?.message || error, 1200) : null, at, row.settlement_id).run();
  return settlementBySource(edge, row.source_kind, row.source_id);
}

async function ensureSettlement(edge, { sourceKind, sourceId, childNodeId, cerbanimoShareCents, currency = 'usd', sourceTransaction = null } = {}) {
  const kind = clean(sourceKind, 80), sourceIdClean = clean(sourceId, 220), child = clean(childNodeId, 180);
  const total = integer(cerbanimoShareCents, 'cerbanimoShareCents');
  if (!kind || !sourceIdClean || !child) throw Object.assign(new TypeError('sourceKind, sourceId, and childNodeId are required.'), { status: 400 });
  const prior = await settlementBySource(edge, kind, sourceIdClean);
  if (prior) return { row: prior, applied: true };
  const active = await activeCharterForChild(edge, child);
  if (!active) return { row: null, applied: false, ignored: true, reason: 'no-active-charter', cerbanimoRemainingCents: total };
  const split = splitCerbanimoForCharterkeeper(total, Number(active.charter.charterkeeper_share_bps));
  const agreementReady = active.charter.agreement_status === 'accepted';
  const payoutAccountId = clean(active.source.connected_account_id, 180) || null;
  const status = !agreementReady ? 'reserved-pending-agreement' : !payoutAccountId ? 'reserved-payout-unavailable' : 'pending-funds';
  const at = iso(edge.now());
  const settlementId = `charter:${crypto.randomUUID()}`;
  await edge.db.prepare(`INSERT OR IGNORE INTO money_edge_charter_settlements
    (settlement_id,source_kind,source_id,child_node_id,charter_id,charterkeeper_node_id,payout_account_id,
     existing_cerbanimo_share_cents,charterkeeper_share_cents,cerbanimo_remaining_cents,currency,source_transaction_id,
     transfer_id,transferred_cents,refund_reversed_cents,dispute_reversed_cents,status,settlement_error,created_at,updated_at,settled_at)
    VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,NULL,0,0,0,?13,NULL,?14,?15,NULL)`)
    .bind(settlementId, kind, sourceIdClean, child, active.charter.charter_id, active.charter.charterkeeper_node_id,
      payoutAccountId, split.existingCerbanimoShareCents, split.charterkeeperShareCents, split.cerbanimoRemainingCents,
      clean(currency || 'usd', 12).toLowerCase(), clean(sourceTransaction, 220) || null, status, at, at).run();
  return { row: await settlementBySource(edge, kind, sourceIdClean), applied: true };
}

async function attemptSettlement(edge, row) {
  const grossEntitlement = Number(row.charterkeeper_share_cents || 0);
  const reductions = Number(row.refund_reversed_cents || 0) + Number(row.dispute_reversed_cents || 0);
  const target = Math.max(0, grossEntitlement - reductions);
  const transferred = Number(row.transferred_cents || 0);
  const due = Math.max(0, target - transferred);
  if (due === 0) return markSettlementStatus(edge, row, target === 0 ? 'reversed' : transferred > 0 ? 'settled' : row.status);
  if (!row.payout_account_id || !String(row.status).startsWith('pending-')) return row;
  if (row.transfer_id) return markSettlementStatus(edge, row, 'pending-error', new Error('Additional Charterkeeper transfer requires review.'));
  let transfer;
  try {
    const params = {
      amount: due,
      currency: clean(row.currency, 12).toLowerCase(),
      destination: row.payout_account_id,
      transfer_group: `civweave-charter:${row.source_kind}:${row.source_id}`,
      metadata: {
        civweave_schema: CHARTERKEEPER_SETTLEMENT_SCHEMA,
        civweave_source_kind: row.source_kind,
        civweave_source_id: row.source_id,
        civweave_child_node_id: row.child_node_id,
        civweave_charter_id: row.charter_id,
        civweave_charterkeeper_node_id: row.charterkeeper_node_id,
        civweave_split: 'existing-cerbanimo-share-50-charterkeeper-50-remaining'
      }
    };
    if (row.source_transaction_id) params.source_transaction = row.source_transaction_id;
    transfer = await edge.provider.stripeClient().transfers.create(params, {
      idempotencyKey: `civweave-charter-${row.source_kind}-${row.source_id}`.slice(0, 255)
    });
  } catch (error) {
    return markSettlementStatus(edge, row, availableBalanceError(error) ? 'pending-funds' : 'pending-error', error);
  }
  const at = iso(edge.now());
  await edge.db.prepare(`UPDATE money_edge_charter_settlements SET transfer_id=?1,transferred_cents=?2,status='settled',
    settlement_error=NULL,settled_at=?3,updated_at=?4 WHERE settlement_id=?5`)
    .bind(transfer.id, transferred + due, at, at, row.settlement_id).run();
  return settlementBySource(edge, row.source_kind, row.source_id);
}

export async function settleCharterkeeperShare(edge, input = {}) {
  const prepared = await ensureSettlement(edge, input);
  if (!prepared.applied) return Object.freeze(prepared);
  const settled = await attemptSettlement(edge, prepared.row);
  return Object.freeze({ applied: true, settlement: publicSettlement(settled), cerbanimoRemainingCents: Number(settled.cerbanimo_remaining_cents || 0) });
}

export async function reverseCharterkeeperShare(edge, { sourceKind, sourceId, cumulativeGrossCents, grossCents, kind = 'refund', eventId = '' } = {}) {
  let row = await settlementBySource(edge, sourceKind, sourceId);
  if (!row) return { ignored: true, reason: 'charterkeeper-settlement-missing' };
  const total = Number(row.charterkeeper_share_cents || 0);
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
      idempotencyKey: `civweave-charter-${kind}-${clean(eventId || sourceId, 120)}-${target}`.slice(0, 255),
      metadata: { civweave_schema: CHARTERKEEPER_SETTLEMENT_SCHEMA, civweave_source_kind: row.source_kind, civweave_source_id: row.source_id, civweave_reason: kind }
    });
  }
  const at = iso(edge.now());
  await edge.db.prepare(`UPDATE money_edge_charter_settlements SET ${ownColumn}=?1,status=?2,updated_at=?3 WHERE settlement_id=?4`)
    .bind(target, target + other >= total ? 'reversed' : 'partially-reversed', at, row.settlement_id).run();
  row = await settlementBySource(edge, sourceKind, sourceId);
  return Object.freeze({ applied: true, reversedCents: delta, settlement: publicSettlement(row) });
}

export async function settleCharterForTopup(edge, topupId) {
  const row = await edge.db.prepare(`SELECT topup_id,node_id,currency,cerbanimo_share_cents,stripe_charge_id FROM money_edge_topups WHERE topup_id=?1`)
    .bind(clean(topupId, 220)).first();
  if (!row) return { ignored: true, reason: 'topup-missing' };
  return settleCharterkeeperShare(edge, { sourceKind: 'topup', sourceId: row.topup_id, childNodeId: row.node_id,
    cerbanimoShareCents: Number(row.cerbanimo_share_cents || 0), currency: row.currency, sourceTransaction: row.stripe_charge_id || null });
}

export async function reverseCharterForTopup(edge, topupId, cumulativeGrossCents, kind, eventId) {
  const row = await edge.db.prepare(`SELECT topup_id,gross_cents FROM money_edge_topups WHERE topup_id=?1`).bind(clean(topupId, 220)).first();
  if (!row) return { ignored: true, reason: 'topup-missing' };
  return reverseCharterkeeperShare(edge, { sourceKind: 'topup', sourceId: row.topup_id, cumulativeGrossCents, grossCents: Number(row.gross_cents), kind, eventId });
}

export async function settleCharterForMembership(edge, invoiceId) {
  const row = await edge.db.prepare(`SELECT invoice_id,node_id,cerbanimo_share_cents,stripe_charge_id FROM money_edge_membership_cycles WHERE invoice_id=?1`)
    .bind(clean(invoiceId, 220)).first();
  if (!row) return { ignored: true, reason: 'membership-cycle-missing' };
  return settleCharterkeeperShare(edge, { sourceKind: 'membership', sourceId: row.invoice_id, childNodeId: row.node_id,
    cerbanimoShareCents: Number(row.cerbanimo_share_cents || 0), currency: 'usd', sourceTransaction: row.stripe_charge_id || null });
}

export async function settleCharterForFellowFareFee(edge, applicationFeeId) {
  const row = await edge.db.prepare(`SELECT application_fee_id,node_id,currency,cerbanimo_share_cents FROM money_edge_fellowfare_service_fees WHERE application_fee_id=?1`)
    .bind(clean(applicationFeeId, 220)).first();
  if (!row) return { ignored: true, reason: 'fellowfare-fee-missing' };
  return settleCharterkeeperShare(edge, { sourceKind: 'fellowfare-service-fee', sourceId: row.application_fee_id, childNodeId: row.node_id,
    cerbanimoShareCents: Number(row.cerbanimo_share_cents || 0), currency: row.currency });
}

export async function reverseCharterForFellowFareFee(edge, applicationFeeId, refundedFeeCents, eventId = '') {
  const row = await edge.db.prepare(`SELECT application_fee_id,fee_cents FROM money_edge_fellowfare_service_fees WHERE application_fee_id=?1`)
    .bind(clean(applicationFeeId, 220)).first();
  if (!row) return { ignored: true, reason: 'fellowfare-fee-missing' };
  return reverseCharterkeeperShare(edge, { sourceKind: 'fellowfare-service-fee', sourceId: row.application_fee_id,
    cumulativeGrossCents: refundedFeeCents, grossCents: Number(row.fee_cents), kind: 'refund', eventId });
}

export async function retryPendingCharterkeeperShares(edge, { limit = 100 } = {}) {
  const capped = Math.max(1, Math.min(500, Number(limit) || 100));
  const rows = await edge.db.prepare(`SELECT * FROM money_edge_charter_settlements
    WHERE status IN ('pending-funds','pending-error') ORDER BY created_at ASC LIMIT ?1`).bind(capped).all();
  const pending = rows?.results || [];
  const results = [];
  for (const row of pending) {
    const settled = await attemptSettlement(edge, row);
    results.push({ settlementId: row.settlement_id, status: settled?.status || 'unknown' });
  }
  return Object.freeze({ schema: CHARTERKEEPER_SETTLEMENT_SCHEMA, attempted: results.length,
    settled: results.filter(result => result.status === 'settled').length,
    pending: results.filter(result => result.status !== 'settled').length, results });
}
