export const STRIPE_CONNECT_DIRECT_PROVIDER = 'stripe-connect-direct-v1';
export const STRIPE_CONNECT_ACCOUNT_MODEL = 'configurable-controller-v1';

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
export function stripeCredentialMode(value = '') {
  const key = clean(value, 10000);
  if (!key) return 'unconfigured';
  if (key.startsWith('sk_live_') || key.startsWith('rk_live_')) return 'live';
  if (key.startsWith('sk_test_') || key.startsWith('rk_test_')) return 'sandbox';
  return 'unrecognized';
}
function required(value, label, max = 4000) {
  const out = clean(value, max);
  if (!out) throw new TypeError(`${label} is required.`);
  return out;
}
function cents(value, label, { positive = false } = {}) {
  if (!Number.isSafeInteger(value) || value < (positive ? 1 : 0)) {
    throw new RangeError(`${label} must be ${positive ? 'a positive' : 'a non-negative'} integer number of cents.`);
  }
  return value;
}
function safeUrl(value, label) {
  const url = new URL(required(value, label));
  if (url.protocol !== 'https:') throw new RangeError(`${label} must use HTTPS.`);
  return url.href;
}
function formBody(entries = {}) {
  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(entries)) {
    if (value == null || value === '') continue;
    if (Array.isArray(value)) for (const item of value) form.append(key, String(item));
    else form.set(key, String(value));
  }
  return form;
}
function metadata(input = {}) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value != null && String(value).length).map(([key, value]) => [String(key).slice(0, 40), String(value).slice(0, 500)]));
}

export class StripeConnectWorkerProvider {
  constructor({ secretKey = '', webhookSecret = '', apiVersion = '', apiBase = 'https://api.stripe.com', fetchImpl = globalThis.fetch } = {}) {
    this.id = STRIPE_CONNECT_DIRECT_PROVIDER;
    this.secretKey = clean(secretKey, 10000);
    this.webhookSecret = clean(webhookSecret, 10000);
    this.apiVersion = clean(apiVersion, 120);
    this.apiBase = new URL(apiBase).origin;
    this.fetch = fetchImpl;
    this.mode = stripeCredentialMode(this.secretKey);
    this.credentialsPresent = Boolean(this.secretKey);
    this.webhookVerificationReady = Boolean(this.webhookSecret);
    this.operatorPayouts = 'stripe-connected-account-native';
    this.connectedAccountModel = STRIPE_CONNECT_ACCOUNT_MODEL;
  }

  async request(pathname, { method = 'POST', accountId = '', idempotencyKey = '', form = null, query = null } = {}) {
    if (!this.secretKey) throw Object.assign(new Error('Stripe platform credential is not configured.'), { status: 503 });
    if (typeof this.fetch !== 'function') throw new Error('Stripe provider requires fetch().');
    const url = new URL(pathname, this.apiBase);
    if (query) for (const [key, value] of Object.entries(query)) {
      if (Array.isArray(value)) for (const item of value) url.searchParams.append(key, String(item));
      else if (value != null) url.searchParams.set(key, String(value));
    }
    const headers = new Headers({ authorization: `Bearer ${this.secretKey}`, accept: 'application/json' });
    if (this.apiVersion) headers.set('stripe-version', this.apiVersion);
    if (accountId) headers.set('stripe-account', required(accountId, 'Stripe connected account ID', 180));
    if (idempotencyKey) headers.set('idempotency-key', required(idempotencyKey, 'Stripe idempotency key', 255));
    let body;
    if (form) { headers.set('content-type', 'application/x-www-form-urlencoded'); body = formBody(form).toString(); }
    const response = await this.fetch(url, { method, headers, body });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(String(payload?.error?.message || payload?.error?.code || `Stripe request failed with HTTP ${response.status}.`)); error.status = response.status; error.stripe = payload?.error || null; throw error; }
    return payload;
  }

  async createConnectedAccount({ nodeId, operatorId, email = '', country = '' } = {}) {
    const form = {
      'controller[fees][payer]': 'account',
      'controller[losses][payments]': 'stripe',
      'controller[requirement_collection]': 'stripe',
      'controller[stripe_dashboard][type]': 'full'
    };
    if (email) form.email = clean(email, 320);
    if (country) form.country = clean(country, 4).toUpperCase();
    const meta = metadata({ civweave_node_id: required(nodeId, 'nodeId', 180), civweave_operator_id: required(operatorId, 'operatorId', 180), civweave_connect_model: STRIPE_CONNECT_ACCOUNT_MODEL });
    for (const [key, value] of Object.entries(meta)) form[`metadata[${key}]`] = value;
    const stable = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${nodeId}\0${operatorId}`));
    const hash = [...new Uint8Array(stable)].map(b => b.toString(16).padStart(2, '0')).join('');
    return this.request('/v1/accounts', { form, idempotencyKey: `civweave-account-${hash.slice(0, 48)}` });
  }

  async retrieveAccount(accountId) { return this.request(`/v1/accounts/${encodeURIComponent(required(accountId, 'accountId', 180))}`, { method: 'GET' }); }
  async createAccountLink({ accountId, refreshUrl, returnUrl } = {}) {
    return this.request('/v1/account_links', { form: { account: required(accountId, 'accountId', 180), refresh_url: safeUrl(refreshUrl, 'refreshUrl'), return_url: safeUrl(returnUrl, 'returnUrl'), type: 'account_onboarding', 'collection_options[fields]': 'eventually_due' } });
  }
  async createTopUpCheckout({ accountId, nodeId, userId, topupId, grossCents, applicationFeeCents, currency = 'usd', successUrl, cancelUrl, idempotencyKey, displayName = 'Civweave node credit' } = {}) {
    const gross = cents(grossCents, 'grossCents', { positive: true }), fee = cents(applicationFeeCents, 'applicationFeeCents');
    if (fee > gross) throw new RangeError('applicationFeeCents cannot exceed grossCents.');
    const meta = metadata({ civweave_schema: 'civweave.node-money-topup.v1', civweave_node_id: required(nodeId, 'nodeId', 180), civweave_user_id: required(userId, 'userId', 180), civweave_topup_id: required(topupId, 'topupId', 180) });
    const form = { mode: 'payment', success_url: safeUrl(successUrl, 'successUrl'), cancel_url: safeUrl(cancelUrl, 'cancelUrl'), 'line_items[0][price_data][currency]': clean(currency, 12).toLowerCase(), 'line_items[0][price_data][product_data][name]': clean(displayName || 'Civweave node credit', 120), 'line_items[0][price_data][unit_amount]': gross, 'line_items[0][quantity]': 1, 'payment_intent_data[application_fee_amount]': fee };
    for (const [key, value] of Object.entries(meta)) { form[`metadata[${key}]`] = value; form[`payment_intent_data[metadata][${key}]`] = value; }
    return this.request('/v1/checkout/sessions', { accountId, form, idempotencyKey });
  }
  async retrieveCheckoutSession({ accountId, sessionId } = {}) {
    return this.request(`/v1/checkout/sessions/${encodeURIComponent(required(sessionId, 'sessionId', 220))}`, { method: 'GET', accountId, query: { 'expand[]': ['payment_intent.latest_charge.balance_transaction'] } });
  }
  async verifyTopUpSession({ accountId, sessionId, nodeId, userId, topupId, grossCents, currency = 'usd' } = {}) {
    const session = await this.retrieveCheckoutSession({ accountId, sessionId }), meta = session?.metadata || {};
    if (session.payment_status !== 'paid') throw new Error('Stripe Checkout Session is not paid.');
    if (Number(session.amount_total) !== cents(grossCents, 'grossCents', { positive: true })) throw new Error('Stripe Checkout amount does not match the top-up.');
    if (String(session.currency || '').toLowerCase() !== String(currency).toLowerCase()) throw new Error('Stripe Checkout currency does not match the top-up.');
    if (meta.civweave_node_id !== String(nodeId) || meta.civweave_user_id !== String(userId) || meta.civweave_topup_id !== String(topupId)) throw new Error('Stripe Checkout metadata does not match the Civweave top-up.');
    const pi = session.payment_intent; if (!pi || typeof pi !== 'object' || pi.status !== 'succeeded') throw new Error('Stripe PaymentIntent has not succeeded.');
    const charge = pi.latest_charge; if (!charge || typeof charge !== 'object' || charge.status !== 'succeeded') throw new Error('Stripe charge has not succeeded.');
    const balance = charge.balance_transaction; if (!balance || typeof balance !== 'object') throw new Error('Stripe charge balance transaction is unavailable.');
    const applicationFeeCents = Number(pi.application_fee_amount || 0), totalFeeCents = Number(balance.fee || 0);
    return Object.freeze({ sessionId: session.id, paymentIntentId: pi.id, chargeId: charge.id, balanceTransactionId: balance.id, grossCents: Number(session.amount_total), applicationFeeCents, processorFeeCents: Math.max(0, totalFeeCents - applicationFeeCents), currency: String(session.currency || '').toUpperCase() });
  }
  async refundTopUp({ accountId, chargeId, amountCents, idempotencyKey } = {}) {
    return this.request('/v1/refunds', { accountId, idempotencyKey, form: { charge: required(chargeId, 'chargeId', 220), amount: cents(amountCents, 'amountCents', { positive: true }), refund_application_fee: 'true' } });
  }
}
