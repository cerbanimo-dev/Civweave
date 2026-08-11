export const MEMBERSHIP_ECONOMY = Object.freeze({ systemBps: 5000, hostBps: 2500, cerbanimoBps: 2500 });
export const MEMBERSHIP_NEURON_COST_MICROCENTS = 1100;
export const MEMBERSHIP_TIERS = Object.freeze({
  member: Object.freeze({ id: 'member', serviceAmountCents: 500, monthlyLifetimeCredits: 100_000 }),
  maker: Object.freeze({ id: 'maker', serviceAmountCents: 1_000, monthlyLifetimeCredits: 250_000 }),
  builder: Object.freeze({ id: 'builder', serviceAmountCents: 2_000, monthlyLifetimeCredits: 600_000 }),
  steward: Object.freeze({ id: 'steward', serviceAmountCents: 4_000, monthlyLifetimeCredits: 1_500_000 })
});

const enc = new TextEncoder();
const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const integer = (value, label, min = 0, max = 50_000_000) => {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) throw Object.assign(new RangeError(`${label} must be an integer from ${min} through ${max}.`), { status: 400 });
  return number;
};
const iso = now => new Date(now).toISOString();
const tierById = value => MEMBERSHIP_TIERS[clean(value, 80).toLowerCase()] || null;

function safeReturnUrl(value, expectedOrigin) {
  const url = new URL(clean(value, 4000));
  if (url.protocol !== 'https:' || url.origin !== expectedOrigin) throw Object.assign(new RangeError('Checkout return URLs must stay on the registered HTTPS node origin.'), { status: 400 });
  return url.href;
}
async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(String(value)));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
export function splitMembershipServiceNet(serviceNetCents) {
  const net = integer(serviceNetCents, 'serviceNetCents');
  const systemReserveCents = Math.floor(net * MEMBERSHIP_ECONOMY.systemBps / 10_000);
  const hostShareCents = Math.floor(net * MEMBERSHIP_ECONOMY.hostBps / 10_000);
  return Object.freeze({
    serviceNetCents: net,
    systemReserveCents,
    hostShareCents,
    cerbanimoShareCents: net - systemReserveCents - hostShareCents
  });
}
export function minimumMembershipCreditBackingCents(monthlyLifetimeCredits, neuronCostMicrocents = MEMBERSHIP_NEURON_COST_MICROCENTS) {
  const credits = integer(monthlyLifetimeCredits, 'monthlyLifetimeCredits', 1, Number.MAX_SAFE_INTEGER);
  const cost = integer(neuronCostMicrocents, 'neuronCostMicrocents', 1, Number.MAX_SAFE_INTEGER);
  return Math.ceil(credits * cost / 1_000_000);
}
function publicMembership(row) {
  if (!row) return null;
  return Object.freeze({
    schema: 'civweave.node-membership.v1',
    nodeId: row.node_id,
    userId: row.user_id,
    tierId: row.tier_id,
    status: row.status,
    monthlyLifetimeCredits: Number(row.monthly_lifetime_credits),
    checkoutUrl: row.checkout_url || null,
    subscriptionId: row.stripe_subscription_id || null,
    customerId: row.stripe_customer_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });
}
function publicCycle(row) {
  if (!row) return null;
  return Object.freeze({
    schema: 'civweave.node-membership-cycle.v1',
    invoiceId: row.invoice_id,
    nodeId: row.node_id,
    userId: row.user_id,
    tierId: row.tier_id,
    subscriptionId: row.stripe_subscription_id,
    grossCents: Number(row.gross_cents),
    processorFeeCents: Number(row.processor_fee_cents),
    serviceNetCents: Number(row.service_net_cents),
    systemReserveCents: Number(row.system_reserve_cents),
    hostShareCents: Number(row.host_share_cents),
    cerbanimoShareCents: Number(row.cerbanimo_share_cents),
    lifetimeCreditsAdded: Number(row.lifetime_credits_neurons),
    hostTransferId: row.stripe_transfer_id || null,
    settledAt: row.settled_at
  });
}
async function membershipByUser(edge, nodeId, userId) {
  return edge.db.prepare('SELECT * FROM money_edge_memberships WHERE node_id=?1 AND user_id=?2').bind(nodeId, userId).first();
}
async function cycleByInvoice(edge, invoiceId) {
  return edge.db.prepare('SELECT * FROM money_edge_membership_cycles WHERE invoice_id=?1').bind(invoiceId).first();
}
function membershipMetadata(input) {
  if (input?.parent?.type === 'subscription_details') return input.parent.subscription_details?.metadata || {};
  return input?.metadata || {};
}
async function deliverSignedMembershipEvent(edge, nodeId, payload) {
  const node = await edge.node(nodeId);
  if (!node) throw Object.assign(new Error('Membership node is no longer registered.'), { status: 404 });
  const rawText = JSON.stringify(payload);
  const signature = await edge.signEvent(enc.encode(rawText));
  const response = await edge.fetch(new URL('/api/ai/node/live/payments/webhook', node.callback_origin), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-civweave-money-edge-signature': signature },
    body: rawText
  });
  if (!response.ok) {
    const problem = await response.json().catch(() => ({}));
    throw Object.assign(new Error(problem.error || `Membership node returned HTTP ${response.status}.`), { status: response.status >= 500 ? 503 : response.status });
  }
  return response.json().catch(() => ({ ok: true }));
}
function paidCyclePayload(row, providerEventId = '') {
  return Object.freeze({
    schema: 'civweave.node-payment-event.v1',
    id: `membership:${row.invoice_id}`,
    provider: 'stripe-connect-platform-reserve-v2',
    userId: row.user_id,
    type: 'membership.paid',
    grossCents: Number(row.gross_cents),
    processorFeeCents: Number(row.processor_fee_cents),
    serviceNetCents: Number(row.service_net_cents),
    systemReserveCents: Number(row.system_reserve_cents),
    hostShareCents: Number(row.host_share_cents),
    cerbanimoShareCents: Number(row.cerbanimo_share_cents),
    tierId: row.tier_id,
    monthlyLifetimeCredits: Number(row.lifetime_credits_neurons),
    metadata: {
      invoiceId: row.invoice_id,
      subscriptionId: row.stripe_subscription_id,
      stripeChargeId: row.stripe_charge_id,
      stripeTransferId: row.stripe_transfer_id || null,
      providerEventId: providerEventId || undefined,
      fundsModel: 'platform-reserve-separate-transfer',
      split: '50-system-25-host-25-cerbanimo'
    },
    mintEffect: 0,
    supplyEffect: 0
  });
}

export async function createMembershipCheckout(edge, input, raw, signatureHeader) {
  const nodeId = clean(input?.nodeId, 180), userId = clean(input?.userId, 180);
  if (!nodeId || !userId) throw Object.assign(new TypeError('nodeId and userId are required.'), { status: 400 });
  const node = await edge.verifyNodeRequest(nodeId, raw, signatureHeader);
  const readiness = edge.readiness();
  if (edge.provider.mode === 'live' && !readiness.liveReady) throw Object.assign(new Error(`Live node money is blocked: ${readiness.operationalBlockers.join(', ')}`), { status: 503 });
  const tier = tierById(input.tierId);
  if (!tier) throw Object.assign(new RangeError('Unknown Civweave membership tier.'), { status: 400 });
  const idempotencyKey = clean(input.idempotencyKey, 180);
  if (!idempotencyKey) throw Object.assign(new TypeError('idempotencyKey is required.'), { status: 400 });
  const successUrl = safeReturnUrl(input.successUrl, node.callback_origin), cancelUrl = safeReturnUrl(input.cancelUrl, node.callback_origin);
  const priorKey = await edge.db.prepare('SELECT * FROM money_edge_memberships WHERE idempotency_key=?1').bind(idempotencyKey).first();
  if (priorKey) {
    if (priorKey.node_id !== nodeId || priorKey.user_id !== userId || priorKey.tier_id !== tier.id) throw Object.assign(new Error('Membership idempotency key was reused for a different request.'), { status: 409 });
    if (priorKey.checkout_url) return publicMembership(priorKey);
  }
  const existing = await membershipByUser(edge, nodeId, userId);
  if (existing && existing.idempotency_key !== idempotencyKey && !['canceled', 'ended'].includes(existing.status)) {
    throw Object.assign(new Error('This member already has an active or pending membership checkout.'), { status: 409 });
  }
  const stable = (await sha256Hex(`${nodeId}:${userId}:${tier.id}:${idempotencyKey}`)).slice(0, 48);
  const session = await edge.provider.createMembershipCheckout({
    accountId: node.connected_account_id,
    nodeId,
    userId,
    tierId: tier.id,
    grossCents: tier.serviceAmountCents,
    monthlyLifetimeCredits: tier.monthlyLifetimeCredits,
    currency: 'usd',
    successUrl,
    cancelUrl,
    idempotencyKey: `civweave-membership-${stable}`,
    displayName: `Civweave ${tier.id} membership`
  });
  const at = iso(edge.now());
  await edge.db.prepare(`INSERT INTO money_edge_memberships
    (node_id,user_id,tier_id,connected_account_id,idempotency_key,stripe_subscription_id,stripe_customer_id,checkout_session_id,checkout_url,status,monthly_lifetime_credits,created_at,updated_at)
    VALUES(?1,?2,?3,?4,?5,NULL,NULL,?6,?7,'checkout-pending',?8,?9,?10)
    ON CONFLICT(node_id,user_id) DO UPDATE SET
      tier_id=excluded.tier_id,connected_account_id=excluded.connected_account_id,idempotency_key=excluded.idempotency_key,
      stripe_subscription_id=NULL,stripe_customer_id=NULL,checkout_session_id=excluded.checkout_session_id,checkout_url=excluded.checkout_url,
      status='checkout-pending',monthly_lifetime_credits=excluded.monthly_lifetime_credits,updated_at=excluded.updated_at`)
    .bind(nodeId, userId, tier.id, node.connected_account_id, idempotencyKey, session.id, session.url || null, tier.monthlyLifetimeCredits, existing?.created_at || at, at).run();
  return publicMembership(await membershipByUser(edge, nodeId, userId));
}

export async function recordMembershipCheckoutCompletion(edge, session) {
  const meta = session?.metadata || {};
  if (session?.mode !== 'subscription' || meta.civweave_schema !== 'civweave.node-membership.v1') return { ignored: true, reason: 'not-membership-checkout' };
  const nodeId = clean(meta.civweave_node_id, 180), userId = clean(meta.civweave_user_id, 180), tierId = clean(meta.civweave_tier_id, 80);
  if (!nodeId || !userId || !tierById(tierId)) throw Object.assign(new Error('Membership Checkout metadata is incomplete.'), { status: 409 });
  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
  const at = iso(edge.now());
  await edge.db.prepare(`UPDATE money_edge_memberships SET stripe_subscription_id=?1,stripe_customer_id=?2,status='checkout-complete',updated_at=?3
    WHERE node_id=?4 AND user_id=?5 AND checkout_session_id=?6`)
    .bind(subscriptionId || null, customerId || null, at, nodeId, userId, session.id).run();
  return { applied: true, membership: publicMembership(await membershipByUser(edge, nodeId, userId)) };
}

export async function settleMembershipInvoice(edge, invoice, providerEventId = '') {
  const meta = membershipMetadata(invoice);
  if (meta.civweave_schema !== 'civweave.node-membership.v1') return { ignored: true, reason: 'not-membership-invoice' };
  const nodeId = clean(meta.civweave_node_id, 180), userId = clean(meta.civweave_user_id, 180), tierId = clean(meta.civweave_tier_id, 80);
  const tier = tierById(tierId);
  if (!nodeId || !userId || !tier) throw Object.assign(new Error('Membership invoice metadata is incomplete.'), { status: 409 });
  const prior = await cycleByInvoice(edge, invoice.id);
  if (prior) {
    await deliverSignedMembershipEvent(edge, nodeId, paidCyclePayload(prior, providerEventId));
    return { applied: true, duplicateCycle: true, cycle: publicCycle(prior) };
  }
  const node = await edge.node(nodeId);
  if (!node) throw Object.assign(new Error('Membership node is not registered with the money edge.'), { status: 404 });
  const verified = await edge.provider.verifyMembershipInvoice({
    invoice,
    accountId: node.connected_account_id,
    nodeId,
    userId,
    tierId,
    monthlyLifetimeCredits: tier.monthlyLifetimeCredits
  });
  const serviceNet = Math.max(0, Math.min(verified.grossCents, verified.netCents));
  const split = splitMembershipServiceNet(serviceNet);
  const requiredBacking = minimumMembershipCreditBackingCents(tier.monthlyLifetimeCredits, Number(edge.env.CIVWEAVE_NEURON_COST_MICROCENTS || MEMBERSHIP_NEURON_COST_MICROCENTS));
  if (split.systemReserveCents < requiredBacking) throw Object.assign(new Error('Paid membership invoice does not contain enough net system share to back its lifetime-credit grant.'), { status: 409 });
  let transfer = null;
  if (split.hostShareCents > 0) {
    transfer = await edge.provider.createHostTransfer({
      accountId: node.connected_account_id,
      amountCents: split.hostShareCents,
      currency: verified.currency.toLowerCase(),
      sourceTransaction: verified.chargeId,
      transferGroup: `civweave-membership:${invoice.id}`,
      idempotencyKey: `civweave-member-host-${(await sha256Hex(invoice.id)).slice(0, 48)}`,
      metadata: { civweave_invoice_id: invoice.id, civweave_node_id: nodeId, civweave_split: 'host-25' }
    });
  }
  const at = iso(edge.now());
  await edge.db.prepare(`INSERT OR IGNORE INTO money_edge_membership_cycles
    (invoice_id,node_id,user_id,tier_id,stripe_subscription_id,stripe_customer_id,stripe_payment_intent_id,stripe_charge_id,stripe_balance_transaction_id,stripe_transfer_id,
     gross_cents,processor_fee_cents,service_net_cents,system_reserve_cents,host_share_cents,cerbanimo_share_cents,lifetime_credits_neurons,settled_at,created_at)
    VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19)`)
    .bind(invoice.id, nodeId, userId, tier.id, verified.subscriptionId, verified.customerId, verified.paymentIntentId, verified.chargeId,
      verified.balanceTransactionId, transfer?.id || null, verified.grossCents, verified.processorFeeCents, split.serviceNetCents,
      split.systemReserveCents, split.hostShareCents, split.cerbanimoShareCents, tier.monthlyLifetimeCredits, at, at).run();
  await edge.db.prepare(`UPDATE money_edge_memberships SET tier_id=?1,stripe_subscription_id=?2,stripe_customer_id=?3,status='active',monthly_lifetime_credits=?4,updated_at=?5
    WHERE node_id=?6 AND user_id=?7`)
    .bind(tier.id, verified.subscriptionId, verified.customerId, tier.monthlyLifetimeCredits, at, nodeId, userId).run();
  const cycle = await cycleByInvoice(edge, invoice.id);
  if (!cycle) throw Object.assign(new Error('Membership cycle could not be recorded.'), { status: 503 });
  await deliverSignedMembershipEvent(edge, nodeId, paidCyclePayload(cycle, providerEventId));
  return { applied: true, cycle: publicCycle(cycle), membership: publicMembership(await membershipByUser(edge, nodeId, userId)) };
}

export async function endMembershipFromSubscription(edge, subscription, providerEventId = '') {
  const meta = subscription?.metadata || {};
  if (meta.civweave_schema !== 'civweave.node-membership.v1') return { ignored: true, reason: 'not-membership-subscription' };
  const nodeId = clean(meta.civweave_node_id, 180), userId = clean(meta.civweave_user_id, 180), tierId = clean(meta.civweave_tier_id, 80);
  if (!nodeId || !userId || !tierById(tierId)) throw Object.assign(new Error('Membership subscription metadata is incomplete.'), { status: 409 });
  const at = iso(edge.now());
  await edge.db.prepare(`UPDATE money_edge_memberships SET status='ended',updated_at=?1 WHERE node_id=?2 AND user_id=?3`).bind(at, nodeId, userId).run();
  const payload = Object.freeze({
    schema: 'civweave.node-payment-event.v1',
    id: `membership-ended:${subscription.id}`,
    provider: 'stripe-connect-platform-reserve-v2',
    userId,
    type: 'membership.ended',
    tierId,
    metadata: { subscriptionId: subscription.id, providerEventId: providerEventId || undefined },
    mintEffect: 0,
    supplyEffect: 0
  });
  await deliverSignedMembershipEvent(edge, nodeId, payload);
  return { applied: true, membership: publicMembership(await membershipByUser(edge, nodeId, userId)) };
}
