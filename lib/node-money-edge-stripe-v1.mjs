import crypto from 'node:crypto';

export const STRIPE_CONNECT_DIRECT_PROVIDER = 'stripe-connect-direct-v1';

function text(value, label, max = 4000) {
  const normalized = String(value ?? '').trim().slice(0, max);
  if (!normalized) throw new TypeError(`${label} is required.`);
  return normalized;
}
function cents(value, label, { positive = false } = {}) {
  if (!Number.isSafeInteger(value) || value < (positive ? 1 : 0)) throw new TypeError(`${label} must be ${positive ? 'a positive' : 'a non-negative'} integer number of cents.`);
  return value;
}
function safeUrl(value, label) {
  const url = new URL(text(value, label));
  if (!['https:', 'http:'].includes(url.protocol)) throw new RangeError(`${label} must use HTTP or HTTPS.`);
  return url.href;
}
function cleanMetadata(input = {}) {
  return Object.fromEntries(Object.entries(input || {}).filter(([, value]) => value != null && String(value).length).map(([key, value]) => [String(key).slice(0, 40), String(value).slice(0, 500)]));
}
function bodyFrom(entries = {}) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(entries)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const item of value) body.append(key, String(item));
    } else body.set(key, String(value));
  }
  return body;
}
function parseSignature(header) {
  const parts = String(header || '').split(',').map(part => part.trim()).filter(Boolean);
  const timestamp = Number(parts.find(part => part.startsWith('t='))?.slice(2));
  const signatures = parts.filter(part => part.startsWith('v1=')).map(part => part.slice(3));
  if (!Number.isSafeInteger(timestamp) || !signatures.length) throw new Error('Malformed Stripe-Signature header.');
  return { timestamp, signatures };
}
function constantTimeHex(left, right) {
  const a = Buffer.from(String(left), 'hex');
  const b = Buffer.from(String(right), 'hex');
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

export class StripeConnectDirectProvider {
  constructor({
    secretKey = process.env.STRIPE_SECRET_KEY || '',
    webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET || '',
    apiBase = 'https://api.stripe.com',
    apiVersion = process.env.STRIPE_API_VERSION || '',
    fetchImpl = globalThis.fetch,
    webhookToleranceSeconds = 300,
    now = () => Date.now()
  } = {}) {
    this.id = STRIPE_CONNECT_DIRECT_PROVIDER;
    this.mode = String(secretKey).startsWith('sk_live_') ? 'live' : 'sandbox';
    this.secretKey = String(secretKey || '').trim();
    this.webhookSecret = String(webhookSecret || '').trim();
    this.apiBase = new URL(apiBase).origin;
    this.apiVersion = String(apiVersion || '').trim();
    this.fetch = fetchImpl;
    this.webhookToleranceSeconds = webhookToleranceSeconds;
    this.now = now;
    this.credentialsPresent = Boolean(this.secretKey);
    this.webhookVerificationReady = Boolean(this.webhookSecret);
    this.refundsReady = true;
    this.reconciliationReady = true;
    this.operatorPayouts = 'stripe-connected-account-native';
  }

  async #request(pathname, { method = 'POST', accountId = null, idempotencyKey = null, form = null, query = null } = {}) {
    if (!this.secretKey) throw new Error('STRIPE_SECRET_KEY is not configured.');
    if (typeof this.fetch !== 'function') throw new Error('Stripe provider requires fetch().');
    const url = new URL(pathname, this.apiBase);
    if (query) for (const [key, value] of Object.entries(query)) {
      if (Array.isArray(value)) for (const item of value) url.searchParams.append(key, String(item));
      else if (value != null) url.searchParams.set(key, String(value));
    }
    const headers = { authorization: `Bearer ${this.secretKey}`, accept: 'application/json' };
    if (this.apiVersion) headers['stripe-version'] = this.apiVersion;
    if (accountId) headers['stripe-account'] = text(accountId, 'Stripe connected account ID', 180);
    if (idempotencyKey) headers['idempotency-key'] = text(idempotencyKey, 'Stripe idempotency key', 255);
    let body;
    if (form) { headers['content-type'] = 'application/x-www-form-urlencoded'; body = bodyFrom(form).toString(); }
    const response = await this.fetch(url, { method, headers, body });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload?.error?.message || payload?.error?.code || `Stripe request failed with HTTP ${response.status}.`;
      const error = new Error(String(message)); error.status = response.status; error.stripe = payload?.error || null; throw error;
    }
    return payload;
  }

  async createStandardAccount({ nodeId, operatorId, email = null, country = null, metadata = {} } = {}) {
    const form = { type: 'standard' };
    if (email) form.email = String(email).trim();
    if (country) form.country = String(country).trim().toUpperCase();
    const meta = cleanMetadata({ civweave_node_id: text(nodeId, 'nodeId', 180), civweave_operator_id: text(operatorId, 'operatorId', 180), ...metadata });
    for (const [key, value] of Object.entries(meta)) form[`metadata[${key}]`] = value;
    return this.#request('/v1/accounts', { form, idempotencyKey: `civweave-account-${crypto.createHash('sha256').update(`${nodeId}\0${operatorId}`).digest('hex').slice(0, 48)}` });
  }

  async retrieveAccount(accountId) {
    return this.#request(`/v1/accounts/${encodeURIComponent(text(accountId, 'accountId', 180))}`, { method: 'GET' });
  }

  async createAccountLink({ accountId, refreshUrl, returnUrl } = {}) {
    return this.#request('/v1/account_links', { form: {
      account: text(accountId, 'accountId', 180),
      refresh_url: safeUrl(refreshUrl, 'refreshUrl'),
      return_url: safeUrl(returnUrl, 'returnUrl'),
      type: 'account_onboarding',
      'collection_options[fields]': 'eventually_due'
    } });
  }

  async createTopUpCheckout({
    accountId,
    nodeId,
    userId,
    topupId,
    grossCents,
    applicationFeeCents,
    currency = 'usd',
    successUrl,
    cancelUrl,
    idempotencyKey,
    displayName = 'Civweave node credit'
  } = {}) {
    const gross = cents(grossCents, 'grossCents', { positive: true });
    const fee = cents(applicationFeeCents, 'applicationFeeCents');
    if (fee > gross) throw new RangeError('applicationFeeCents cannot exceed grossCents.');
    const metadata = {
      civweave_schema: 'civweave.node-money-topup.v1',
      civweave_node_id: text(nodeId, 'nodeId', 180),
      civweave_user_id: text(userId, 'userId', 180),
      civweave_topup_id: text(topupId, 'topupId', 180)
    };
    const form = {
      mode: 'payment',
      success_url: safeUrl(successUrl, 'successUrl'),
      cancel_url: safeUrl(cancelUrl, 'cancelUrl'),
      'line_items[0][price_data][currency]': String(currency || 'usd').trim().toLowerCase(),
      'line_items[0][price_data][product_data][name]': String(displayName || 'Civweave node credit').slice(0, 120),
      'line_items[0][price_data][unit_amount]': gross,
      'line_items[0][quantity]': 1,
      'payment_intent_data[application_fee_amount]': fee
    };
    for (const [key, value] of Object.entries(metadata)) {
      form[`metadata[${key}]`] = value;
      form[`payment_intent_data[metadata][${key}]`] = value;
    }
    return this.#request('/v1/checkout/sessions', { accountId, form, idempotencyKey });
  }

  async retrieveCheckoutSession({ accountId, sessionId } = {}) {
    return this.#request(`/v1/checkout/sessions/${encodeURIComponent(text(sessionId, 'sessionId', 220))}`, {
      method: 'GET', accountId, query: { 'expand[]': ['payment_intent.latest_charge.balance_transaction'] }
    });
  }

  async verifyTopUpSession({ accountId, sessionId, nodeId, userId, topupId, grossCents, currency = 'usd' } = {}) {
    const session = await this.retrieveCheckoutSession({ accountId, sessionId });
    const metadata = session?.metadata || {};
    if (session.payment_status !== 'paid') throw new Error('Stripe Checkout Session is not paid.');
    if (Number(session.amount_total) !== cents(grossCents, 'grossCents', { positive: true })) throw new Error('Stripe Checkout amount does not match the top-up.');
    if (String(session.currency || '').toLowerCase() !== String(currency || 'usd').toLowerCase()) throw new Error('Stripe Checkout currency does not match the top-up.');
    if (metadata.civweave_node_id !== String(nodeId) || metadata.civweave_user_id !== String(userId) || metadata.civweave_topup_id !== String(topupId)) throw new Error('Stripe Checkout metadata does not match the Civweave top-up.');
    const paymentIntent = session.payment_intent;
    if (!paymentIntent || typeof paymentIntent !== 'object' || paymentIntent.status !== 'succeeded') throw new Error('Stripe PaymentIntent has not succeeded.');
    const charge = paymentIntent.latest_charge;
    if (!charge || typeof charge !== 'object' || charge.status !== 'succeeded') throw new Error('Stripe charge has not succeeded.');
    const balance = charge.balance_transaction;
    if (!balance || typeof balance !== 'object') throw new Error('Stripe charge balance transaction is unavailable.');
    const applicationFeeCents = Number(paymentIntent.application_fee_amount || 0);
    const totalFeeCents = Number(balance.fee || 0);
    const processorFeeCents = Math.max(0, totalFeeCents - applicationFeeCents);
    return Object.freeze({
      ok: true,
      provider: this.id,
      receiptId: session.id,
      sessionId: session.id,
      paymentIntentId: paymentIntent.id,
      chargeId: charge.id,
      balanceTransactionId: balance.id,
      grossCents: Number(session.amount_total),
      applicationFeeCents,
      processorFeeCents,
      nodeNetCashCents: Number(session.amount_total) - totalFeeCents,
      currency: String(session.currency || '').toUpperCase(),
      connectedAccountId: accountId,
      proof: { sessionId: session.id, paymentIntentId: paymentIntent.id, chargeId: charge.id, balanceTransactionId: balance.id }
    });
  }

  async refundTopUp({ accountId, chargeId, amountCents, idempotencyKey } = {}) {
    return this.#request('/v1/refunds', { accountId, idempotencyKey, form: {
      charge: text(chargeId, 'chargeId', 220),
      amount: cents(amountCents, 'amountCents', { positive: true }),
      refund_application_fee: 'true'
    } });
  }

  verifyWebhook(rawBody, signatureHeader) {
    if (!this.webhookSecret) throw new Error('STRIPE_CONNECT_WEBHOOK_SECRET is not configured.');
    const raw = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody || ''));
    const { timestamp, signatures } = parseSignature(signatureHeader);
    const nowSeconds = Math.floor(this.now() / 1000);
    if (Math.abs(nowSeconds - timestamp) > this.webhookToleranceSeconds) throw new Error('Stripe webhook signature timestamp is outside the replay window.');
    const expected = crypto.createHmac('sha256', this.webhookSecret).update(`${timestamp}.`).update(raw).digest('hex');
    if (!signatures.some(signature => constantTimeHex(signature, expected))) throw new Error('Stripe webhook signature is invalid.');
    let event; try { event = JSON.parse(raw.toString('utf8')); } catch { throw new TypeError('Stripe webhook body is not valid JSON.'); }
    if (typeof event?.livemode !== 'boolean') throw new Error('Stripe webhook event is missing livemode.');
    const expectedLiveMode = this.mode === 'live';
    if (event.livemode !== expectedLiveMode) throw new Error(`Stripe webhook livemode does not match the configured ${this.mode} provider.`);
    return event;
  }
}
