/**
 * Headquarters-only, publicly funded Starling inference reserve.
 * A purchaser receives no personal compute balance and no Guild privileges.
 * The canonical money edge owns the Stripe gateway and D1 settlement.
 * This file must NOT be bundled into the reusable Guild node template.
 */
export const HQ_STARLING_FUNDING_SCHEMA = 'civweave.headquarters-starling-funding.v1';
export const HQ_STARLING_FUNDING_ROUTE = '/api/money-edge/headquarters/starling-funding';
export const HQ_STARLING_NEURON_MICRO_USD = 11; // Published Workers AI rate, Oct 2026; reverify before enabling.
export const HQ_STARLING_CONTRIBUTION_AMOUNTS = Object.freeze([500, 1000, 2500, 5000]);
const HQ_ORIGIN = 'https://civweave.cc';
const clean = (value, max = 180) => String(value ?? '').trim().slice(0, max);
const error = (message, status = 400) => Object.assign(new Error(message), { status });
const changed = result => Number(result?.meta?.changes ?? result?.changes ?? 0);

function moneyReady(edge) {
  return edge.readiness().liveReady && edge.env.CIVWEAVE_HEADQUARTERS_FUNDING_ENABLED === '1'
    && edge.env.CIVWEAVE_HEADQUARTERS_PAID_AI_ENABLED === '1'
    && Boolean(edge.env.HQ_FUNDING_RATE_LIMITER?.limit);
}
export function approximateFundedNeurons(backingCents, microUsdPerNeuron = HQ_STARLING_NEURON_MICRO_USD) {
  if (!Number.isSafeInteger(backingCents) || backingCents < 0) throw new RangeError('backingCents must be a non-negative integer.');
  if (!Number.isSafeInteger(microUsdPerNeuron) || microUsdPerNeuron < 1) throw new RangeError('Neuron price must be a positive micro-USD integer.');
  return Math.floor(backingCents * 10000 / microUsdPerNeuron);
}
export function residualBackingCents({ grossCents, backingCents, refundedGrossCents = 0, disputedGrossCents = 0 }) {
  if (![grossCents, backingCents, refundedGrossCents, disputedGrossCents].every(Number.isSafeInteger)
    || grossCents <= 0 || backingCents < 0 || refundedGrossCents < 0 || disputedGrossCents < 0) throw new RangeError('Invalid funding ledger amounts.');
  const reversed = Math.min(grossCents, refundedGrossCents + disputedGrossCents);
  return Math.max(0, backingCents - Math.ceil(backingCents * reversed / grossCents));
}
export async function publicHeadquartersFundingStatus(edge) {
  const enabled = moneyReady(edge);
  // No new privileges: the aggregate exposes neither buyer emails nor payment identifiers.
  let fundedCents = 0, paidContributions = 0;
  if (edge.db) {
    const aggregate = await edge.db.prepare(
      "SELECT COUNT(*) AS paid_count, COALESCE(SUM(MAX(0,backing_cents - CAST((backing_cents * MIN(gross_cents,refunded_gross_cents + disputed_gross_cents) + gross_cents - 1) / gross_cents AS INTEGER))),0) AS funded_cents FROM headquarters_starling_contributions WHERE settled_at IS NOT NULL"
    ).first();
    fundedCents = Math.max(0, Number(aggregate?.funded_cents || 0));
    paidContributions = Math.max(0, Number(aggregate?.paid_count || 0));
  }
  return Object.freeze({
    schema: HQ_STARLING_FUNDING_SCHEMA, enabled, donations: false, acceptsGuestCheckout: enabled,
    destination: 'headquarters-starling-paid-inference-only', currency: 'usd',
    choicesCents: HQ_STARLING_CONTRIBUTION_AMOUNTS,
    fundedCents, paidContributions, estimatedPurchasedNeurons: approximateFundedNeurons(fundedCents),
    neuronRateMicroUsd: HQ_STARLING_NEURON_MICRO_USD,
    note: 'All proceeds after actual processing fees are restricted to additional headquarters Starling inference. Not tax deductible. No personal neuron credits, membership benefits or guaranteed publication. Unused backing is held for future work.'
  });
}
export async function createHeadquartersFundingCheckout(edge, input, origin) {
  if (origin !== HQ_ORIGIN) throw error('Checkout is available only on civweave.cc.', 403);
  if (!moneyReady(edge)) throw error('Headquarters funding checkout is not enabled.', 503);
  const amount = input?.amountCents, key = clean(input?.idempotencyKey, 100);
  if (!Number.isSafeInteger(amount) || amount < 500 || amount > 100000 || amount % 100 !== 0) {
    throw error('Contribution must be a whole USD amount between $5 and $1,000.');
  }
  if (!/^[A-Za-z0-9_-]{16,100}$/.test(key)) throw error('A unique checkout request key is required.');
  const created = new Date().toISOString(), id = crypto.randomUUID();
  await edge.db.prepare(
    "INSERT OR IGNORE INTO headquarters_starling_contributions (contribution_id,idempotency_key,gross_cents,status,created_at,updated_at) VALUES (?1,?2,?3,'creating',?4,?4)"
  ).bind(id, key, amount, created).run();
  const existing = await edge.db.prepare(
    'SELECT * FROM headquarters_starling_contributions WHERE idempotency_key=?1'
  ).bind(key).first();
  if (!existing || Number(existing.gross_cents) !== amount) throw error('Checkout key was already used with another amount.', 409);
  if (existing.checkout_url) return { contributionId: existing.contribution_id, checkoutUrl: existing.checkout_url, status: existing.status };
  const metadata = {
    civweave_schema: HQ_STARLING_FUNDING_SCHEMA,
    civweave_contribution_id: existing.contribution_id,
    civweave_destination: 'headquarters-starling-compute'
  };
  const form = {
    mode: 'payment',
    success_url: HQ_ORIGIN + '/app/working-campus-v440.html?starlingFunding=return',
    cancel_url: HQ_ORIGIN + '/app/working-campus-v440.html?starlingFunding=cancelled',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][product_data][name]': 'Fund Civweave headquarters Starling AI compute',
    'line_items[0][price_data][unit_amount]': String(amount),
    'line_items[0][quantity]': '1',
    'submit_type': 'pay'
  };
  for (const [field, value] of Object.entries(metadata)) {
    form['metadata[' + field + ']'] = value;
    form['payment_intent_data[metadata][' + field + ']'] = value;
  }
  const session = await edge.provider.request('/v1/checkout/sessions', {
    form, idempotencyKey: 'civweave-starling-fund-' + key
  });
  if (!session?.id || !/^https:\/\/checkout\.stripe\.com\//.test(String(session.url || ''))) {
    throw error('Payment provider did not return a trusted hosted checkout.', 502);
  }
  await edge.db.prepare(
    "UPDATE headquarters_starling_contributions SET stripe_session_id=?1,checkout_url=?2,status='checkout-pending',updated_at=?3 WHERE contribution_id=?4 AND settled_at IS NULL"
  ).bind(session.id, session.url, created, existing.contribution_id).run();
  return Object.freeze({ contributionId: existing.contribution_id, checkoutUrl: session.url, status: 'checkout-pending' });
}
export async function settleHeadquartersFundingCheckout(edge, session) {
  if (session?.metadata?.civweave_schema !== HQ_STARLING_FUNDING_SCHEMA) return { matched: false };
  const id = clean(session.metadata.civweave_contribution_id);
  const row = await edge.db.prepare('SELECT * FROM headquarters_starling_contributions WHERE contribution_id=?1').bind(id).first();
  if (!row || (row.stripe_session_id && row.stripe_session_id !== session.id)) throw error('Unrecognized headquarters checkout session.', 409);
  if (row.settled_at) return { matched: true, duplicate: true };
  // Never settle from a browser redirect, client data, or the unexpanded webhook object.
  const verified = await edge.provider.retrieveCheckoutSession({ sessionId: session.id });
  if (verified?.payment_status !== 'paid' || verified?.mode !== 'payment' || verified?.currency !== 'usd'
    || Number(verified.amount_total) !== Number(row.gross_cents)
    || verified?.metadata?.civweave_contribution_id !== id
    || verified?.metadata?.civweave_schema !== HQ_STARLING_FUNDING_SCHEMA) {
    throw error('Stripe payment could not be verified for the registered contribution.', 409);
  }
  const pi = verified.payment_intent, charge = pi?.latest_charge, balance = charge?.balance_transaction;
  if (pi?.status !== 'succeeded' || charge?.status !== 'succeeded' || !balance?.id) {
    throw error('Verified Stripe charge and processing fee are not ready.', 409);
  }
  const fee = Number(balance.fee), amount = Number(row.gross_cents);
  if (!Number.isSafeInteger(fee) || fee < 0 || fee > amount) throw error('Stripe processor fee is invalid.', 409);
  const net = amount - fee;
  const refunded = Math.min(amount, Math.max(0, Number(charge.amount_refunded || 0)));
  const disputed = charge.disputed === true ? amount : 0;
  const updated = new Date().toISOString();
  const result = await edge.db.prepare(
    "UPDATE headquarters_starling_contributions SET stripe_session_id=?1,stripe_payment_intent_id=?2,stripe_charge_id=?3,processor_fee_cents=?4,backing_cents=?5,refunded_gross_cents=?6,disputed_gross_cents=?7,status='settled',settled_at=?8,updated_at=?8 WHERE contribution_id=?9 AND settled_at IS NULL"
  ).bind(session.id,pi.id,charge.id,fee,net,refunded,disputed,updated,id).run();
  return { matched: true, applied: changed(result) === 1, contributionId: id, backingCents: net };
}
export async function handleHeadquartersFundingPaymentEvent(edge, event) {
  const object = event?.data?.object || {};
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    if (object?.metadata?.civweave_schema !== HQ_STARLING_FUNDING_SCHEMA) return { matched: false };
    // Asynchronous payment checkout.completed may not yet be paid.
    if (object.payment_status !== 'paid') return { matched: true, pending: true };
    return settleHeadquartersFundingCheckout(edge, object);
  }
  if (!['charge.refunded','charge.dispute.created','charge.dispute.funds_withdrawn','charge.dispute.funds_reinstated'].includes(event.type)) return { matched: false };
  const chargeId = event.type.startsWith('charge.dispute.') ? clean(object.charge) : clean(object.id);
  if (!chargeId) return { matched: false };
  let row;
  try { row = await edge.db.prepare('SELECT * FROM headquarters_starling_contributions WHERE stripe_charge_id=?1').bind(chargeId).first(); }
  catch (cause) { if (/no such table: headquarters_starling_contributions/i.test(String(cause?.message||''))) return { matched:false }; throw cause; }
  if (!row) return { matched: false };
  const gross = Number(row.gross_cents), updated = new Date().toISOString();
  if (event.type === 'charge.refunded') {
    const refunded = Math.max(Number(row.refunded_gross_cents || 0), Math.min(gross,Number(object.amount_refunded || 0)));
    await edge.db.prepare("UPDATE headquarters_starling_contributions SET refunded_gross_cents=?1,status=CASE WHEN ?1>=gross_cents THEN 'refunded' ELSE 'partially-refunded' END,updated_at=?2 WHERE contribution_id=?3")
      .bind(refunded,updated,row.contribution_id).run();
  } else {
    const disputed = event.type === 'charge.dispute.funds_reinstated' ? 0 : Math.min(gross,Number(object.amount || 0));
    await edge.db.prepare("UPDATE headquarters_starling_contributions SET disputed_gross_cents=?1,updated_at=?2 WHERE contribution_id=?3")
      .bind(disputed,updated,row.contribution_id).run();
  }
  return { matched: true, applied: true };
}
const corsHeaders = {
  'access-control-allow-origin': HQ_ORIGIN,
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type',
  'cache-control': 'no-store',
  'vary': 'Origin'
};
const json = (value, status=200) => Response.json(value, { status, headers: corsHeaders });
export async function handleHeadquartersFundingRequest(request, env, createEdge) {
  const url = new URL(request.url);
  if (url.pathname !== HQ_STARLING_FUNDING_ROUTE) return null;
  if (request.method === 'OPTIONS') return new Response(null,{status:204,headers:corsHeaders});
  try {
    const edge = createEdge(env);
    if (request.method === 'GET') return json(await publicHeadquartersFundingStatus(edge));
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' },405);
    if (request.headers.get('origin') !== HQ_ORIGIN) return json({ error: 'Checkout must begin on civweave.cc.' },403);
    if (!env.HQ_FUNDING_RATE_LIMITER?.limit) return json({ error: 'Public checkout rate limiter is unavailable.' },503);
    const actor = clean(request.headers.get('cf-connecting-ip'),100);
    const permitted = await env.HQ_FUNDING_RATE_LIMITER.limit({key:'hq-fund:'+actor});
    if (!permitted?.success) return json({ error: 'Too many checkout attempts.' },429);
    if (Number(request.headers.get('content-length') || 0) > 2048) return json({ error: 'Checkout request is too large.' }, 413);
    const raw = await request.text();
    if (raw.length > 2048) return json({ error: 'Checkout request is too large.' }, 413);
    let input;
    try { input = JSON.parse(raw); } catch { return json({ error: 'Invalid checkout request.' }, 400); }
    return json({ checkout: await createHeadquartersFundingCheckout(edge,input,request.headers.get('origin')) },201);
  } catch (cause) {
    return json({ error: String(cause?.message||'Checkout is unavailable.') }, Number.isSafeInteger(cause?.status)?cause.status:503);
  }
}
