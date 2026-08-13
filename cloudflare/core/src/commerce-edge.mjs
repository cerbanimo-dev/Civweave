export const CERBANIMO_COMMERCE_SCHEMA = 'civweave.cerbanimo-commerce-sale.v1';
export const CERBANIMO_COMMERCE_PAYOUT_SCHEMA = 'civweave.cerbanimo-commerce-payout.v1';
export const CERBANIMO_COMMERCE_FEE_BPS = 100;
export const CERBANIMO_SERVICE_ORIGIN_ROYALTY_BPS = 1000;

const enc = new TextEncoder();
const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const iso = value => new Date(value).toISOString();
const json = (value, status = 200) => new Response(JSON.stringify(value, null, 2), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});
const changes = result => Number(result?.meta?.changes ?? result?.changes ?? 0);

function integer(value, label, min = 0, max = 100_000_000) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw Object.assign(new RangeError(`${label} must be an integer from ${min} through ${max}.`), { status: 400 });
  }
  return number;
}
function bps(value, label) {
  return integer(value, label, 0, 10_000);
}
function required(value, label, max = 4000) {
  const out = clean(value, max);
  if (!out) throw Object.assign(new TypeError(`${label} is required.`), { status: 400 });
  return out;
}
function safeReturnUrl(value, expectedOrigin) {
  const url = new URL(required(value, 'Checkout return URL'));
  if (url.protocol !== 'https:' || url.origin !== expectedOrigin) {
    throw Object.assign(new RangeError('Commerce Checkout return URLs must stay on the registered HTTPS node origin.'), { status: 400 });
  }
  return url.href;
}
async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(String(value)));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
function parseJson(value, fallback) {
  try { return JSON.parse(value || ''); } catch { return fallback; }
}
function publicSale(row, payouts = []) {
  if (!row) return null;
  return Object.freeze({
    schema: CERBANIMO_COMMERCE_SCHEMA,
    saleId: row.sale_id,
    nodeId: row.node_id,
    buyerUserId: row.buyer_user_id || null,
    saleType: row.sale_type,
    endeavorId: row.endeavor_id || null,
    displayName: row.display_name,
    currency: row.currency,
    listedCents: Number(row.listed_cents),
    splitFeeBps: Number(row.split_fee_bps),
    splitFeeCents: Number(row.split_fee_cents),
    buyerChargeCents: Number(row.buyer_charge_cents),
    serviceOriginRoyaltyBps: Number(row.service_origin_royalty_bps),
    status: row.status,
    checkoutUrl: row.checkout_url || null,
    checkoutSessionId: row.checkout_session_id || null,
    processorFeeCents: Number(row.processor_fee_cents || 0),
    refundedGrossCents: Number(row.refunded_gross_cents || 0),
    disputedGrossCents: Number(row.disputed_gross_cents || 0),
    settledAt: row.settled_at || null,
    payouts: payouts.map(item => Object.freeze({
      schema: CERBANIMO_COMMERCE_PAYOUT_SCHEMA,
      recipientUserId: item.recipient_user_id,
      roles: parseJson(item.roles_json, []),
      weight: Number(item.weight),
      amountCents: Number(item.amount_cents),
      transferCreated: Boolean(item.stripe_transfer_id),
      refundReversedCents: Number(item.refund_reversed_cents || 0),
      disputeReversedCents: Number(item.dispute_reversed_cents || 0)
    }))
  });
}

function normalizeContributors(rows, role) {
  const merged = new Map();
  for (const raw of Array.isArray(rows) ? rows : []) {
    if (!raw || typeof raw !== 'object') continue;
    const userId = clean(raw.userId || raw.contributorId || raw.passportId || raw.id, 180);
    const weight = Number(raw.weight ?? raw.cotokens ?? raw.coCredits ?? raw.credits ?? 0);
    if (!userId || !Number.isFinite(weight) || weight <= 0) continue;
    const prior = merged.get(userId) || { userId, weight: 0, roles: [] };
    prior.weight += weight;
    prior.roles = [...new Set([...prior.roles, role])];
    merged.set(userId, prior);
  }
  return [...merged.values()].sort((a, b) => a.userId.localeCompare(b.userId));
}
function largestRemainder(total, rows) {
  const cents = integer(total, 'allocation total', 0);
  if (!cents) return rows.map(row => ({ ...row, amountCents: 0 }));
  if (!rows.length) throw Object.assign(new Error('At least one weighted contributor is required.'), { status: 400 });
  const totalWeight = rows.reduce((sum, row) => sum + Number(row.weight || 0), 0);
  if (!(totalWeight > 0)) throw Object.assign(new Error('Contributor weight total must be positive.'), { status: 400 });
  const allocated = rows.map(row => {
    const exact = cents * row.weight / totalWeight;
    const base = Math.floor(exact);
    return { ...row, amountCents: base, fraction: exact - base };
  });
  let remaining = cents - allocated.reduce((sum, row) => sum + row.amountCents, 0);
  for (const row of [...allocated].sort((a, b) => b.fraction - a.fraction || a.userId.localeCompare(b.userId))) {
    if (remaining <= 0) break;
    row.amountCents += 1;
    remaining -= 1;
  }
  return allocated.map(({ fraction, ...row }) => row);
}
function combinePayouts(rows) {
  const merged = new Map();
  for (const row of rows) {
    const prior = merged.get(row.userId) || { userId: row.userId, weight: 0, roles: [], amountCents: 0 };
    prior.weight += Number(row.weight || 0);
    prior.roles = [...new Set([...prior.roles, ...(row.roles || [])])];
    prior.amountCents += Number(row.amountCents || 0);
    merged.set(row.userId, prior);
  }
  return [...merged.values()].sort((a, b) => a.userId.localeCompare(b.userId));
}
export function buildCommerceDistribution(input = {}) {
  const saleType = clean(input.saleType, 20).toLowerCase();
  if (!['service', 'product'].includes(saleType)) throw Object.assign(new RangeError('saleType must be service or product.'), { status: 400 });
  const listedCents = integer(input.listedCents ?? input.saleAmountCents ?? input.amountCents, 'listedCents', 50, 100_000_000);
  const splitFeeBps = CERBANIMO_COMMERCE_FEE_BPS;
  const splitFeeCents = Math.round(listedCents * splitFeeBps / 10_000);
  const buyerChargeCents = listedCents + splitFeeCents;
  const originRoyaltyBps = bps(input.serviceOriginRoyaltyBps ?? CERBANIMO_SERVICE_ORIGIN_ROYALTY_BPS, 'serviceOriginRoyaltyBps');
  let rows = [];
  if (saleType === 'service') {
    const delivery = normalizeContributors(input.deliveryContributors, 'service-delivery');
    if (!delivery.length) throw Object.assign(new Error('Service sale requires delivery contributors.'), { status: 400 });
    const origin = normalizeContributors(input.originContributors, 'service-origin-royalty');
    const royaltyCents = origin.length ? Math.floor(listedCents * originRoyaltyBps / 10_000) : 0;
    const deliveryCents = listedCents - royaltyCents;
    rows = [
      ...largestRemainder(deliveryCents, delivery),
      ...(royaltyCents ? largestRemainder(royaltyCents, origin) : [])
    ];
  } else {
    const product = normalizeContributors(input.productContributors, 'product-generation');
    if (!product.length) throw Object.assign(new Error('Product sale requires product contributors.'), { status: 400 });
    rows = largestRemainder(listedCents, product);
  }
  const payouts = combinePayouts(rows);
  if (payouts.reduce((sum, row) => sum + row.amountCents, 0) !== listedCents) {
    throw Object.assign(new Error('Commerce distribution must preserve the complete listed amount.'), { status: 409 });
  }
  return Object.freeze({ saleType, listedCents, splitFeeBps, splitFeeCents, buyerChargeCents, originRoyaltyBps, payouts });
}

async function recipientByUser(edge, userId) {
  return edge.db.prepare('SELECT * FROM money_edge_commerce_recipients WHERE user_id=?1').bind(required(userId, 'userId', 180)).first();
}
async function saveRecipient(edge, userId, accountId) {
  const at = iso(edge.now());
  await edge.db.prepare(`INSERT INTO money_edge_commerce_recipients(user_id,connected_account_id,created_at,updated_at)
    VALUES(?1,?2,?3,?4)
    ON CONFLICT(user_id) DO UPDATE SET connected_account_id=excluded.connected_account_id,updated_at=excluded.updated_at`)
    .bind(userId, accountId, at, at).run();
  return recipientByUser(edge, userId);
}
function publicRecipient(userId, account, onboarding = null) {
  const transferStatus = clean(account?.civweave_recipient_transfer_status || account?.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status || 'unknown', 80).toLowerCase();
  const currentlyDue = account?.requirements?.currently_due || [];
  const pastDue = account?.requirements?.past_due || [];
  return Object.freeze({
    schema: 'civweave.commerce-recipient.v1',
    userId,
    connectedAccountId: account?.id || null,
    accountModel: account?.civweave_account_model || 'accounts-v2-marketplace-recipient',
    transferStatus,
    readyToReceiveTransfers: transferStatus === 'active' && !currentlyDue.length && !pastDue.length,
    requirementsCurrentlyDue: currentlyDue,
    requirementsPastDue: pastDue,
    onboardingUrl: onboarding?.url || null,
    onboardingExpiresAt: onboarding?.expires_at ? new Date(Number(onboarding.expires_at) * 1000).toISOString() : null
  });
}
export async function onboardCommerceRecipient(edge, input, raw, signatureHeader) {
  const nodeId = required(input?.nodeId, 'nodeId', 180);
  const userId = required(input?.userId, 'userId', 180);
  const node = await edge.verifyNodeRequest(nodeId, raw, signatureHeader);
  let mapping = await recipientByUser(edge, userId);
  let accountId = mapping?.connected_account_id || null;
  if (!accountId) {
    const displayName = required(input?.displayName || input?.name || userId, 'displayName', 180);
    const email = clean(input?.email, 320);
    const country = clean(input?.country || 'US', 4).toLowerCase();
    const accountInput = {
      display_name: displayName,
      dashboard: 'express',
      defaults: { responsibilities: { fees_collector: 'application', losses_collector: 'application' } },
      configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } } }
    };
    if (email) accountInput.contact_email = email;
    if (country) accountInput.identity = { country };
    const stable = (await sha256Hex(`commerce-recipient:${userId}`)).slice(0, 48);
    const account = await edge.provider.stripeClient().v2.core.accounts.create(accountInput, { idempotencyKey: `civweave-recipient-${stable}` });
    accountId = account.id;
    mapping = await saveRecipient(edge, userId, accountId);
  }
  const account = await edge.provider.retrieveAccount(accountId);
  if (account?.civweave_recipient_transfer_status === 'active' && !(account?.requirements?.currently_due || []).length && !(account?.requirements?.past_due || []).length) {
    return publicRecipient(userId, account, null);
  }
  const onboarding = await edge.provider.createAccountLink({
    accountId,
    refreshUrl: safeReturnUrl(input.refreshUrl || input.returnUrl, node.callback_origin),
    returnUrl: safeReturnUrl(input.returnUrl, node.callback_origin)
  });
  return publicRecipient(userId, account, onboarding);
}
export async function commerceRecipientStatus(edge, input, raw, signatureHeader) {
  const nodeId = required(input?.nodeId, 'nodeId', 180);
  const userId = required(input?.userId, 'userId', 180);
  await edge.verifyNodeRequest(nodeId, raw, signatureHeader);
  const mapping = await recipientByUser(edge, userId);
  if (!mapping) throw Object.assign(new Error('This Civweave user has no commerce payout account yet.'), { status: 404 });
  const account = await edge.provider.retrieveAccount(mapping.connected_account_id);
  return publicRecipient(userId, account, null);
}
async function resolveReadyPayouts(edge, payouts) {
  const resolved = [];
  for (const payout of payouts) {
    const mapping = await recipientByUser(edge, payout.userId);
    if (!mapping) throw Object.assign(new Error(`Contributor ${payout.userId} must finish payout onboarding before this sale can open.`), { status: 409 });
    const account = await edge.provider.retrieveAccount(mapping.connected_account_id);
    const status = publicRecipient(payout.userId, account, null);
    if (!status.readyToReceiveTransfers) {
      throw Object.assign(new Error(`Contributor ${payout.userId} is not ready to receive Stripe transfers.`), { status: 409 });
    }
    resolved.push({ ...payout, destinationAccountId: mapping.connected_account_id });
  }
  return resolved;
}

async function saleById(edge, saleId) {
  return edge.db.prepare('SELECT * FROM money_edge_commerce_sales WHERE sale_id=?1').bind(required(saleId, 'saleId', 220)).first();
}
async function saleBySession(edge, sessionId) {
  return edge.db.prepare('SELECT * FROM money_edge_commerce_sales WHERE checkout_session_id=?1').bind(required(sessionId, 'sessionId', 220)).first();
}
async function saleByCharge(edge, chargeId) {
  return edge.db.prepare('SELECT * FROM money_edge_commerce_sales WHERE stripe_charge_id=?1').bind(required(chargeId, 'chargeId', 220)).first();
}
async function payoutRows(edge, saleId) {
  const result = await edge.db.prepare('SELECT * FROM money_edge_commerce_payouts WHERE sale_id=?1 ORDER BY recipient_user_id').bind(saleId).all();
  return result.results || [];
}
async function fullSale(edge, saleId) {
  const sale = await saleById(edge, saleId);
  return publicSale(sale, sale ? await payoutRows(edge, sale.sale_id) : []);
}
function saleMetadata(saleId, nodeId, distribution) {
  return Object.freeze({
    civweave_schema: CERBANIMO_COMMERCE_SCHEMA,
    civweave_sale_id: saleId,
    civweave_node_id: nodeId,
    civweave_sale_type: distribution.saleType,
    civweave_listed_cents: String(distribution.listedCents),
    civweave_split_fee_bps: String(distribution.splitFeeBps),
    civweave_split_fee_cents: String(distribution.splitFeeCents),
    civweave_buyer_charge_cents: String(distribution.buyerChargeCents),
    civweave_annual_pool: 'excluded',
    civweave_funds_model: 'platform-charge-separate-transfer'
  });
}
export async function createCommerceSale(edge, input, raw, signatureHeader) {
  const nodeId = required(input?.nodeId, 'nodeId', 180);
  const node = await edge.verifyNodeRequest(nodeId, raw, signatureHeader);
  const readiness = edge.readiness();
  if (edge.provider.mode === 'live' && !readiness.liveReady) {
    throw Object.assign(new Error(`Live commerce is blocked: ${readiness.operationalBlockers.join(', ')}`), { status: 503 });
  }
  const saleId = required(input?.saleId || input?.orderId, 'saleId', 220);
  const idempotencyKey = required(input?.idempotencyKey, 'idempotencyKey', 180);
  const displayName = required(input?.displayName || input?.title || `${input?.saleType || 'FellowFare'} sale`, 'displayName', 180);
  const endeavorId = clean(input?.endeavorId || input?.projectId || input?.templateEndeavorId, 220) || null;
  const buyerUserId = clean(input?.buyerUserId || input?.userId, 180) || null;
  const currency = clean(input?.currency || 'USD', 12).toUpperCase();
  if (currency !== 'USD') throw Object.assign(new RangeError('FellowFare commerce v1 currently accepts USD sales only.'), { status: 400 });
  const distribution = buildCommerceDistribution(input);
  const successUrl = safeReturnUrl(input?.successUrl, node.callback_origin);
  const cancelUrl = safeReturnUrl(input?.cancelUrl, node.callback_origin);
  const prior = await edge.db.prepare('SELECT * FROM money_edge_commerce_sales WHERE idempotency_key=?1').bind(idempotencyKey).first();
  if (prior) {
    if (prior.sale_id !== saleId || prior.node_id !== nodeId || Number(prior.listed_cents) !== distribution.listedCents || prior.sale_type !== distribution.saleType) {
      throw Object.assign(new Error('Commerce idempotency key was reused for a different sale.'), { status: 409 });
    }
    if (prior.checkout_url) return fullSale(edge, prior.sale_id);
  }
  const existingSale = await saleById(edge, saleId);
  if (existingSale && existingSale.idempotency_key !== idempotencyKey) {
    throw Object.assign(new Error('saleId is already registered with a different idempotency key.'), { status: 409 });
  }
  const payouts = await resolveReadyPayouts(edge, distribution.payouts);
  const at = iso(edge.now());
  if (!existingSale) {
    const statements = [
      edge.db.prepare(`INSERT INTO money_edge_commerce_sales
        (sale_id,idempotency_key,node_id,buyer_user_id,sale_type,endeavor_id,display_name,currency,listed_cents,split_fee_bps,split_fee_cents,buyer_charge_cents,
         service_origin_royalty_bps,status,checkout_session_id,checkout_url,stripe_payment_intent_id,stripe_charge_id,stripe_balance_transaction_id,processor_fee_cents,
         refunded_gross_cents,disputed_gross_cents,settled_at,created_at,updated_at)
        VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,'creating-checkout',NULL,NULL,NULL,NULL,NULL,0,0,0,NULL,?14,?15)`)
        .bind(saleId, idempotencyKey, nodeId, buyerUserId, distribution.saleType, endeavorId, displayName, currency,
          distribution.listedCents, distribution.splitFeeBps, distribution.splitFeeCents, distribution.buyerChargeCents, distribution.originRoyaltyBps, at, at)
    ];
    for (const payout of payouts) {
      statements.push(edge.db.prepare(`INSERT INTO money_edge_commerce_payouts
        (sale_id,recipient_user_id,destination_account_id,roles_json,weight,amount_cents,stripe_transfer_id,refund_reversed_cents,dispute_reversed_cents,created_at,updated_at)
        VALUES(?1,?2,?3,?4,?5,?6,NULL,0,0,?7,?8)`)
        .bind(saleId, payout.userId, payout.destinationAccountId, JSON.stringify(payout.roles), payout.weight, payout.amountCents, at, at));
    }
    if (typeof edge.db.batch === 'function') await edge.db.batch(statements);
    else for (const statement of statements) await statement.run();
  }
  const meta = saleMetadata(saleId, nodeId, distribution);
  const form = {
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: buyerUserId || undefined,
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][product_data][name]': displayName,
    'line_items[0][price_data][unit_amount]': distribution.listedCents,
    'line_items[0][quantity]': 1,
    'payment_intent_data[transfer_group]': `civweave-commerce:${saleId}`
  };
  if (distribution.splitFeeCents > 0) {
    form['line_items[1][price_data][currency]'] = 'usd';
    form['line_items[1][price_data][product_data][name]'] = 'Cerbanimo commerce split fee (1%)';
    form['line_items[1][price_data][unit_amount]'] = distribution.splitFeeCents;
    form['line_items[1][quantity]'] = 1;
  }
  for (const [key, value] of Object.entries(meta)) {
    form[`metadata[${key}]`] = value;
    form[`payment_intent_data[metadata][${key}]`] = value;
  }
  const stable = (await sha256Hex(`${nodeId}:${saleId}:${idempotencyKey}`)).slice(0, 48);
  const session = await edge.provider.request('/v1/checkout/sessions', { form, idempotencyKey: `civweave-commerce-${stable}` });
  const updatedAt = iso(edge.now());
  await edge.db.prepare(`UPDATE money_edge_commerce_sales SET checkout_session_id=?1,checkout_url=?2,status='checkout-pending',updated_at=?3 WHERE sale_id=?4`)
    .bind(session.id, session.url || null, updatedAt, saleId).run();
  return fullSale(edge, saleId);
}
export async function commerceSaleStatus(edge, input, raw, signatureHeader) {
  const nodeId = required(input?.nodeId, 'nodeId', 180);
  const saleId = required(input?.saleId, 'saleId', 220);
  await edge.verifyNodeRequest(nodeId, raw, signatureHeader);
  const sale = await saleById(edge, saleId);
  if (!sale || sale.node_id !== nodeId) throw Object.assign(new Error('Commerce sale was not found for this node.'), { status: 404 });
  return fullSale(edge, saleId);
}

function verifiedCheckout(session, sale) {
  const meta = session?.metadata || {};
  if (session?.payment_status !== 'paid') throw Object.assign(new Error('Stripe commerce Checkout is not paid.'), { status: 409 });
  if (meta.civweave_schema !== CERBANIMO_COMMERCE_SCHEMA || meta.civweave_sale_id !== sale.sale_id || meta.civweave_node_id !== sale.node_id) {
    throw Object.assign(new Error('Stripe commerce Checkout metadata does not match the registered sale.'), { status: 409 });
  }
  if (Number(session.amount_total) !== Number(sale.buyer_charge_cents)) throw Object.assign(new Error('Stripe commerce Checkout amount does not match the registered buyer charge.'), { status: 409 });
  if (String(session.currency || '').toUpperCase() !== String(sale.currency).toUpperCase()) throw Object.assign(new Error('Stripe commerce Checkout currency does not match the registered sale.'), { status: 409 });
  const paymentIntent = session.payment_intent;
  if (!paymentIntent || typeof paymentIntent !== 'object' || paymentIntent.status !== 'succeeded') throw Object.assign(new Error('Stripe commerce PaymentIntent has not succeeded.'), { status: 409 });
  const charge = paymentIntent.latest_charge;
  if (!charge || typeof charge !== 'object' || charge.status !== 'succeeded') throw Object.assign(new Error('Stripe commerce charge has not succeeded.'), { status: 409 });
  const balance = charge.balance_transaction;
  if (!balance || typeof balance !== 'object') throw Object.assign(new Error('Stripe commerce balance transaction is unavailable.'), { status: 409 });
  return { paymentIntent, charge, balance };
}
export async function settleCommerceCheckout(edge, session, providerEventId = '') {
  const meta = session?.metadata || {};
  if (meta.civweave_schema !== CERBANIMO_COMMERCE_SCHEMA) return { matched: false, ignored: true, reason: 'not-commerce-checkout' };
  if (session?.payment_status && session.payment_status !== 'paid') return { matched: true, ignored: true, reason: 'commerce-checkout-not-paid' };
  const sale = await saleBySession(edge, session.id);
  if (!sale) throw Object.assign(new Error('Stripe commerce Checkout Session is not registered with Civweave.'), { status: 404 });
  if (sale.status === 'settled' || sale.status === 'partially-refunded' || sale.status === 'refunded' || sale.status === 'disputed') {
    return { matched: true, applied: true, duplicate: true, sale: await fullSale(edge, sale.sale_id) };
  }
  const fresh = await edge.provider.retrieveCheckoutSession({ sessionId: sale.checkout_session_id });
  const { paymentIntent, charge, balance } = verifiedCheckout(fresh, sale);
  const payouts = await payoutRows(edge, sale.sale_id);
  if (!payouts.length || payouts.reduce((sum, row) => sum + Number(row.amount_cents), 0) !== Number(sale.listed_cents)) {
    throw Object.assign(new Error('Registered commerce payouts do not preserve the complete listed amount.'), { status: 409 });
  }
  for (const payout of payouts) {
    if (payout.stripe_transfer_id || Number(payout.amount_cents) <= 0) continue;
    const account = await edge.provider.retrieveAccount(payout.destination_account_id);
    const status = publicRecipient(payout.recipient_user_id, account, null);
    if (!status.readyToReceiveTransfers) throw Object.assign(new Error(`Contributor ${payout.recipient_user_id} can no longer receive Stripe transfers.`), { status: 409 });
    const hash = (await sha256Hex(`${sale.sale_id}:${payout.recipient_user_id}`)).slice(0, 48);
    const transfer = await edge.provider.createHostTransfer({
      accountId: payout.destination_account_id,
      amountCents: Number(payout.amount_cents),
      currency: sale.currency.toLowerCase(),
      sourceTransaction: charge.id,
      transferGroup: `civweave-commerce:${sale.sale_id}`,
      idempotencyKey: `civweave-commerce-payout-${hash}`,
      metadata: {
        civweave_schema: CERBANIMO_COMMERCE_SCHEMA,
        civweave_sale_id: sale.sale_id,
        civweave_sale_type: sale.sale_type,
        civweave_recipient_id: payout.recipient_user_id,
        civweave_roles: parseJson(payout.roles_json, []).join(','),
        civweave_annual_pool: 'excluded',
        civweave_split_fee_bps: String(sale.split_fee_bps),
        civweave_split_fee_cents: String(sale.split_fee_cents)
      }
    });
    const at = iso(edge.now());
    await edge.db.prepare('UPDATE money_edge_commerce_payouts SET stripe_transfer_id=?1,updated_at=?2 WHERE sale_id=?3 AND recipient_user_id=?4 AND stripe_transfer_id IS NULL')
      .bind(transfer.id, at, sale.sale_id, payout.recipient_user_id).run();
  }
  const settledPayouts = await payoutRows(edge, sale.sale_id);
  if (settledPayouts.some(row => Number(row.amount_cents) > 0 && !row.stripe_transfer_id)) {
    throw Object.assign(new Error('One or more commerce contributor transfers are still incomplete.'), { status: 503 });
  }
  const at = iso(edge.now());
  await edge.db.prepare(`UPDATE money_edge_commerce_sales SET stripe_payment_intent_id=?1,stripe_charge_id=?2,stripe_balance_transaction_id=?3,
    processor_fee_cents=?4,status='settled',settled_at=COALESCE(settled_at,?5),updated_at=?6 WHERE sale_id=?7`)
    .bind(paymentIntent.id, charge.id, balance.id, Math.max(0, Number(balance.fee || 0)), at, at, sale.sale_id).run();
  return { matched: true, applied: true, providerEventId: providerEventId || null, sale: await fullSale(edge, sale.sale_id) };
}

function targetReversalRows(payouts, targetTotal) {
  const rows = payouts.map(row => ({ userId: row.recipient_user_id, weight: Number(row.amount_cents) }));
  const allocated = targetTotal > 0 ? largestRemainder(targetTotal, rows) : rows.map(row => ({ ...row, amountCents: 0 }));
  return new Map(allocated.map(row => [row.userId, row.amountCents]));
}
async function reverseCommerceTransfers(edge, sale, grossAmountCents, kind, providerEventId) {
  const buyerCharge = Number(sale.buyer_charge_cents);
  const listed = Number(sale.listed_cents);
  const cumulativeGross = Math.max(0, Math.min(integer(grossAmountCents, 'grossAmountCents', 0, buyerCharge), buyerCharge));
  const contributorTargetTotal = cumulativeGross >= buyerCharge ? listed : Math.floor(listed * cumulativeGross / buyerCharge);
  const payouts = await payoutRows(edge, sale.sale_id);
  const targets = targetReversalRows(payouts, contributorTargetTotal);
  let reversedDelta = 0;
  for (const payout of payouts) {
    const currentColumn = kind === 'dispute' ? 'dispute_reversed_cents' : 'refund_reversed_cents';
    const otherColumn = kind === 'dispute' ? 'refund_reversed_cents' : 'dispute_reversed_cents';
    const current = Number(payout[currentColumn] || 0);
    const other = Number(payout[otherColumn] || 0);
    const maxForKind = Math.max(0, Number(payout.amount_cents) - other);
    const desired = Math.min(Number(targets.get(payout.recipient_user_id) || 0), maxForKind);
    const delta = Math.max(0, desired - current);
    if (!delta) continue;
    if (!payout.stripe_transfer_id) throw Object.assign(new Error('Commerce transfer reversal is waiting for the original contributor transfer.'), { status: 503 });
    const hash = (await sha256Hex(`${providerEventId}:${sale.sale_id}:${payout.recipient_user_id}:${kind}:${desired}`)).slice(0, 48);
    await edge.provider.reverseHostTransfer({
      transferId: payout.stripe_transfer_id,
      amountCents: delta,
      idempotencyKey: `civweave-commerce-${kind}-${hash}`,
      metadata: { civweave_sale_id: sale.sale_id, civweave_recipient_id: payout.recipient_user_id, civweave_reason: kind }
    });
    const at = iso(edge.now());
    await edge.db.prepare(`UPDATE money_edge_commerce_payouts SET ${currentColumn}=${currentColumn}+?1,updated_at=?2 WHERE sale_id=?3 AND recipient_user_id=?4`)
      .bind(delta, at, sale.sale_id, payout.recipient_user_id).run();
    reversedDelta += delta;
  }
  return { cumulativeGross, contributorTargetTotal, reversedDelta };
}
export async function handleCommerceRefund(edge, event, charge) {
  if (!charge?.id) return { matched: false };
  const sale = await saleByCharge(edge, charge.id);
  if (!sale) return { matched: false };
  const gross = Math.min(Number(charge.amount_refunded || 0), Number(sale.buyer_charge_cents));
  if (gross <= Number(sale.refunded_gross_cents || 0)) return { matched: true, ignored: true, reason: 'commerce-refund-already-applied' };
  const reversal = await reverseCommerceTransfers(edge, sale, gross, 'refund', event.id);
  const at = iso(edge.now());
  const status = gross >= Number(sale.buyer_charge_cents) ? 'refunded' : 'partially-refunded';
  await edge.db.prepare('UPDATE money_edge_commerce_sales SET refunded_gross_cents=?1,status=?2,updated_at=?3 WHERE sale_id=?4')
    .bind(gross, status, at, sale.sale_id).run();
  return { matched: true, applied: true, reversedContributorCents: reversal.reversedDelta, sale: await fullSale(edge, sale.sale_id) };
}
export async function handleCommerceDispute(edge, event, dispute) {
  const chargeId = typeof dispute?.charge === 'string' ? dispute.charge : dispute?.charge?.id;
  if (!chargeId) return { matched: false };
  const sale = await saleByCharge(edge, chargeId);
  if (!sale) return { matched: false };
  const gross = Math.min(Number(dispute.amount || sale.buyer_charge_cents || 0), Number(sale.buyer_charge_cents));
  if (gross <= Number(sale.disputed_gross_cents || 0)) return { matched: true, ignored: true, reason: 'commerce-dispute-already-applied' };
  const reversal = await reverseCommerceTransfers(edge, sale, gross, 'dispute', event.id);
  const at = iso(edge.now());
  await edge.db.prepare("UPDATE money_edge_commerce_sales SET disputed_gross_cents=?1,status='disputed',updated_at=?2 WHERE sale_id=?3")
    .bind(gross, at, sale.sale_id).run();
  return { matched: true, applied: true, reversedContributorCents: reversal.reversedDelta, sale: await fullSale(edge, sale.sale_id) };
}
export async function restoreCommerceDisputeTransfers(edge, event, dispute) {
  const chargeId = typeof dispute?.charge === 'string' ? dispute.charge : dispute?.charge?.id;
  if (!chargeId) return { matched: false };
  const sale = await saleByCharge(edge, chargeId);
  if (!sale) return { matched: false };
  const payouts = await payoutRows(edge, sale.sale_id);
  let restored = 0;
  for (const payout of payouts) {
    const amount = Number(payout.dispute_reversed_cents || 0);
    if (!amount) continue;
    const account = await edge.provider.retrieveAccount(payout.destination_account_id);
    const status = publicRecipient(payout.recipient_user_id, account, null);
    if (!status.readyToReceiveTransfers) throw Object.assign(new Error(`Contributor ${payout.recipient_user_id} cannot receive restored dispute funds yet.`), { status: 409 });
    const hash = (await sha256Hex(`${event.id}:${sale.sale_id}:${payout.recipient_user_id}:restore`)).slice(0, 48);
    await edge.provider.createHostTransfer({
      accountId: payout.destination_account_id,
      amountCents: amount,
      currency: sale.currency.toLowerCase(),
      sourceTransaction: chargeId,
      transferGroup: `civweave-commerce:${sale.sale_id}`,
      idempotencyKey: `civweave-commerce-dispute-restore-${hash}`,
      metadata: { civweave_sale_id: sale.sale_id, civweave_recipient_id: payout.recipient_user_id, civweave_reason: 'dispute-funds-reinstated' }
    });
    const at = iso(edge.now());
    await edge.db.prepare('UPDATE money_edge_commerce_payouts SET dispute_reversed_cents=0,updated_at=?1 WHERE sale_id=?2 AND recipient_user_id=?3')
      .bind(at, sale.sale_id, payout.recipient_user_id).run();
    restored += amount;
  }
  const at = iso(edge.now());
  await edge.db.prepare("UPDATE money_edge_commerce_sales SET disputed_gross_cents=0,status=CASE WHEN refunded_gross_cents>0 THEN 'partially-refunded' ELSE 'settled' END,updated_at=?1 WHERE sale_id=?2")
    .bind(at, sale.sale_id).run();
  return { matched: true, applied: true, restoredContributorCents: restored, sale: await fullSale(edge, sale.sale_id) };
}
export async function requestCommerceRefund(edge, input, raw, signatureHeader, routeSaleId = '') {
  const nodeId = required(input?.nodeId, 'nodeId', 180);
  const saleId = required(routeSaleId || input?.saleId, 'saleId', 220);
  await edge.verifyNodeRequest(nodeId, raw, signatureHeader);
  const sale = await saleById(edge, saleId);
  if (!sale || sale.node_id !== nodeId) throw Object.assign(new Error('Commerce sale was not found for this node.'), { status: 404 });
  if (!sale.stripe_charge_id || !['settled', 'partially-refunded', 'disputed'].includes(sale.status)) {
    throw Object.assign(new Error('Commerce sale is not settled and refundable.'), { status: 400 });
  }
  const remaining = Number(sale.buyer_charge_cents) - Number(sale.refunded_gross_cents || 0);
  const amount = integer(input?.amountCents, 'amountCents', 1, remaining);
  const stable = (await sha256Hex(`${sale.sale_id}:${amount}:${sale.refunded_gross_cents || 0}`)).slice(0, 48);
  const refund = await edge.provider.refundTopUp({ chargeId: sale.stripe_charge_id, amountCents: amount, idempotencyKey: `civweave-commerce-refund-${stable}` });
  return Object.freeze({ schema: CERBANIMO_COMMERCE_SCHEMA, saleId: sale.sale_id, refundId: refund.id, amountCents: amount, status: refund.status || 'pending-webhook' });
}

export async function handleCommerceApiRequest(request, env, edge) {
  const url = new URL(request.url);
  const pathname = decodeURIComponent(url.pathname);
  if (!pathname.startsWith('/api/money-edge/commerce/')) return null;
  if (request.method !== 'POST') return json({ error: 'Commerce money-edge routes require POST.' }, 405);
  let rawText = '';
  let input = {};
  try {
    rawText = await request.text();
    input = JSON.parse(rawText || '{}');
  } catch {
    return json({ error: 'Commerce request body must be valid JSON.' }, 400);
  }
  const raw = enc.encode(rawText);
  const signature = request.headers.get('x-civweave-node-signature');
  try {
    if (pathname === '/api/money-edge/commerce/recipients/onboard') {
      return json({ recipient: await onboardCommerceRecipient(edge, input, raw, signature) }, 201);
    }
    if (pathname === '/api/money-edge/commerce/recipients/status') {
      return json({ recipient: await commerceRecipientStatus(edge, input, raw, signature) });
    }
    if (pathname === '/api/money-edge/commerce/sales') {
      return json({ sale: await createCommerceSale(edge, input, raw, signature) }, 201);
    }
    if (pathname === '/api/money-edge/commerce/sales/status') {
      return json({ sale: await commerceSaleStatus(edge, input, raw, signature) });
    }
    const refundMatch = pathname.match(/^\/api\/money-edge\/commerce\/sales\/([^/]+)\/refund$/);
    if (refundMatch) {
      return json({ refund: await requestCommerceRefund(edge, input, raw, signature, decodeURIComponent(refundMatch[1])) }, 202);
    }
    return json({ error: 'Commerce money-edge route not found.' }, 404);
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500;
    const message = status >= 500 ? 'Civweave commerce money-edge request failed.' : clean(error?.message || error, 1200);
    return json({ error: message }, status);
  }
}
