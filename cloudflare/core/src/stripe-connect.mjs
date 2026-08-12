import Stripe from 'stripe';

export const STRIPE_CONNECT_DIRECT_PROVIDER = 'stripe-connect-platform-reserve-v2';
export const STRIPE_CONNECT_ACCOUNT_MODEL = 'accounts-v2-marketplace-recipient';

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
function recipientTransferStatus(account) {
  return clean(account?.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status || 'unknown', 80).toLowerCase();
}
function compatibilityRecipientAccount(account) {
  const transferStatus = recipientTransferStatus(account);
  const requirementsStatus = clean(account?.requirements?.summary?.minimum_deadline?.status, 80).toLowerCase() || null;
  const requirementsCurrentlyDue = requirementsStatus === 'currently_due' ? ['stripe-recipient-requirements'] : [];
  const requirementsPastDue = requirementsStatus === 'past_due' ? ['stripe-recipient-requirements'] : [];
  return Object.freeze({
    ...account,
    charges_enabled: false,
    payouts_enabled: transferStatus === 'active',
    details_submitted: !requirementsCurrentlyDue.length && !requirementsPastDue.length,
    requirements: {
      ...(account?.requirements || {}),
      currently_due: requirementsCurrentlyDue,
      past_due: requirementsPastDue
    },
    civweave_account_model: STRIPE_CONNECT_ACCOUNT_MODEL,
    civweave_recipient_transfer_status: transferStatus
  });
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
    this.operatorPayouts = 'platform-charge-separate-transfer';
    this.connectedAccountModel = STRIPE_CONNECT_ACCOUNT_MODEL;
    this.stripe = this.secretKey ? new Stripe(this.secretKey, {
      httpClient: Stripe.createFetchHttpClient(this.fetch),
      appInfo: { name: 'Civweave Money Edge', version: '2' }
    }) : null;
  }

  stripeClient() {
    if (!this.stripe) throw Object.assign(new Error('Stripe platform credential is not configured.'), { status: 503 });
    return this.stripe;
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
    const id = required(nodeId, 'nodeId', 180);
    const operator = required(operatorId, 'operatorId', 180);
    const input = {
      display_name: clean(`Civweave Host · ${id}`, 180),
      dashboard: 'express',
      defaults: {
        responsibilities: {
          fees_collector: 'application',
          losses_collector: 'application'
        }
      },
      configuration: {
        recipient: {
          capabilities: {
            stripe_balance: {
              stripe_transfers: { requested: true }
            }
          }
        }
      }
    };
    if (email) input.contact_email = clean(email, 320);
    if (country) input.identity = { country: clean(country, 4).toLowerCase() };
    const stable = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${id}\0${operator}`));
    const hash = [...new Uint8Array(stable)].map(b => b.toString(16).padStart(2, '0')).join('');
    return this.stripeClient().v2.core.accounts.create(input, { idempotencyKey: `civweave-account-${hash.slice(0, 48)}` });
  }

  async retrieveAccount(accountId) {
    const id = required(accountId, 'accountId', 180);
    try {
      const account = await this.stripeClient().v2.core.accounts.retrieve(id, {
        include: ['configuration.recipient', 'requirements']
      });
      if (account?.configuration?.recipient) return compatibilityRecipientAccount(account);
    } catch (error) {
      if (![400, 404].includes(Number(error?.statusCode || error?.status))) throw error;
    }
    // Compatibility only for sandbox/legacy node registrations created before the
    // marketplace-recipient migration. New accounts are always Accounts v2 recipients.
    return this.request(`/v1/accounts/${encodeURIComponent(id)}`, { method: 'GET' });
  }

  async createAccountLink({ accountId, refreshUrl, returnUrl } = {}) {
    const id = required(accountId, 'accountId', 180);
    const account = await this.retrieveAccount(id);
    if (account?.civweave_account_model === STRIPE_CONNECT_ACCOUNT_MODEL) {
      return this.stripeClient().v2.core.accountLinks.create({
        account: id,
        use_case: {
          type: 'account_onboarding',
          account_onboarding: {
            configurations: ['recipient'],
            refresh_url: safeUrl(refreshUrl, 'refreshUrl'),
            return_url: safeUrl(returnUrl, 'returnUrl')
          }
        }
      });
    }
    return this.request('/v1/account_links', { form: { account: id, refresh_url: safeUrl(refreshUrl, 'refreshUrl'), return_url: safeUrl(returnUrl, 'returnUrl'), type: 'account_onboarding', 'collection_options[fields]': 'eventually_due' } });
  }

  // Customer top-ups are platform charges. The host's connected account ID is metadata
  // until settlement, when only the host's earned share is transferred out. This keeps
  // user compute backing in the platform balance instead of entrusting it to hosts.
  async createTopUpCheckout({ accountId, nodeId, userId, topupId, grossCents, currency = 'usd', successUrl, cancelUrl, idempotencyKey, displayName = 'Civweave node credit' } = {}) {
    const gross = cents(grossCents, 'grossCents', { positive: true });
    const meta = metadata({
      civweave_schema: 'civweave.node-money-topup.v2',
      civweave_node_id: required(nodeId, 'nodeId', 180),
      civweave_user_id: required(userId, 'userId', 180),
      civweave_topup_id: required(topupId, 'topupId', 180),
      civweave_host_account_id: required(accountId, 'accountId', 180),
      civweave_funds_model: 'platform-reserve-separate-transfer'
    });
    const form = {
      mode: 'payment',
      success_url: safeUrl(successUrl, 'successUrl'),
      cancel_url: safeUrl(cancelUrl, 'cancelUrl'),
      'line_items[0][price_data][currency]': clean(currency, 12).toLowerCase(),
      'line_items[0][price_data][product_data][name]': clean(displayName || 'Civweave node credit', 120),
      'line_items[0][price_data][unit_amount]': gross,
      'line_items[0][quantity]': 1
    };
    for (const [key, value] of Object.entries(meta)) {
      form[`metadata[${key}]`] = value;
      form[`payment_intent_data[metadata][${key}]`] = value;
    }
    return this.request('/v1/checkout/sessions', { form, idempotencyKey });
  }

  // Memberships are also platform charges. The host ID stays metadata on the
  // subscription; each paid invoice is split only after Stripe's actual fee is known.
  async createMembershipCheckout({
    accountId,
    nodeId,
    userId,
    tierId,
    grossCents,
    monthlyLifetimeCredits,
    currency = 'usd',
    successUrl,
    cancelUrl,
    idempotencyKey,
    displayName = 'Civweave membership'
  } = {}) {
    const gross = cents(grossCents, 'grossCents', { positive: true });
    const credits = Number(monthlyLifetimeCredits);
    if (!Number.isSafeInteger(credits) || credits < 1) throw new RangeError('monthlyLifetimeCredits must be a positive integer.');
    const meta = metadata({
      civweave_schema: 'civweave.node-membership.v1',
      civweave_node_id: required(nodeId, 'nodeId', 180),
      civweave_user_id: required(userId, 'userId', 180),
      civweave_tier_id: required(tierId, 'tierId', 80),
      civweave_host_account_id: required(accountId, 'accountId', 180),
      civweave_monthly_lifetime_credits: credits,
      civweave_funds_model: 'platform-reserve-separate-transfer'
    });
    const form = {
      mode: 'subscription',
      success_url: safeUrl(successUrl, 'successUrl'),
      cancel_url: safeUrl(cancelUrl, 'cancelUrl'),
      client_reference_id: clean(userId, 200),
      'line_items[0][price_data][currency]': clean(currency, 12).toLowerCase(),
      'line_items[0][price_data][product_data][name]': clean(displayName || 'Civweave membership', 120),
      'line_items[0][price_data][recurring][interval]': 'month',
      'line_items[0][price_data][recurring][interval_count]': 1,
      'line_items[0][price_data][unit_amount]': gross,
      'line_items[0][quantity]': 1,
      'subscription_data[description]': `${clean(displayName || 'Civweave membership', 120)} · monthly`,
      'subscription_data[billing_mode][type]': 'flexible'
    };
    for (const [key, value] of Object.entries(meta)) {
      form[`metadata[${key}]`] = value;
      form[`subscription_data[metadata][${key}]`] = value;
    }
    return this.request('/v1/checkout/sessions', { form, idempotencyKey });
  }

  async retrieveCheckoutSession({ sessionId } = {}) {
    return this.request(`/v1/checkout/sessions/${encodeURIComponent(required(sessionId, 'sessionId', 220))}`, { method: 'GET', query: { 'expand[]': ['payment_intent.latest_charge.balance_transaction'] } });
  }
  async verifyTopUpSession({ accountId, sessionId, nodeId, userId, topupId, grossCents, currency = 'usd' } = {}) {
    const session = await this.retrieveCheckoutSession({ sessionId }), meta = session?.metadata || {};
    if (session.payment_status !== 'paid') throw new Error('Stripe Checkout Session is not paid.');
    if (Number(session.amount_total) !== cents(grossCents, 'grossCents', { positive: true })) throw new Error('Stripe Checkout amount does not match the top-up.');
    if (String(session.currency || '').toLowerCase() !== String(currency).toLowerCase()) throw new Error('Stripe Checkout currency does not match the top-up.');
    if (meta.civweave_node_id !== String(nodeId) || meta.civweave_user_id !== String(userId) || meta.civweave_topup_id !== String(topupId)) throw new Error('Stripe Checkout metadata does not match the Civweave top-up.');
    if (meta.civweave_host_account_id !== String(accountId)) throw new Error('Stripe Checkout host account metadata does not match the Civweave node.');
    const pi = session.payment_intent; if (!pi || typeof pi !== 'object' || pi.status !== 'succeeded') throw new Error('Stripe PaymentIntent has not succeeded.');
    const charge = pi.latest_charge; if (!charge || typeof charge !== 'object' || charge.status !== 'succeeded') throw new Error('Stripe charge has not succeeded.');
    const balance = charge.balance_transaction; if (!balance || typeof balance !== 'object') throw new Error('Stripe charge balance transaction is unavailable.');
    return Object.freeze({
      sessionId: session.id,
      paymentIntentId: pi.id,
      chargeId: charge.id,
      balanceTransactionId: balance.id,
      grossCents: Number(session.amount_total),
      applicationFeeCents: 0,
      processorFeeCents: Math.max(0, Number(balance.fee || 0)),
      netCents: Math.max(0, Number(balance.net ?? Number(session.amount_total) - Number(balance.fee || 0))),
      currency: String(session.currency || '').toUpperCase()
    });
  }

  async listInvoicePayments(invoiceId) {
    return this.request('/v1/invoice_payments', { method: 'GET', query: { invoice: required(invoiceId, 'invoiceId', 220), limit: 100 } });
  }
  async retrievePaymentIntent(paymentIntentId) {
    return this.request(`/v1/payment_intents/${encodeURIComponent(required(paymentIntentId, 'paymentIntentId', 220))}`, { method: 'GET', query: { 'expand[]': ['latest_charge.balance_transaction'] } });
  }
  async verifyMembershipInvoice({ invoice, accountId, nodeId, userId, tierId, monthlyLifetimeCredits } = {}) {
    if (!invoice || typeof invoice !== 'object') throw new TypeError('Stripe invoice is required.');
    if (invoice.status !== 'paid' && Number(invoice.amount_paid || 0) < 1) throw new Error('Stripe membership invoice is not paid.');
    const parent = invoice.parent;
    if (parent?.type !== 'subscription_details') throw new Error('Stripe invoice was not generated by a subscription.');
    const meta = parent?.subscription_details?.metadata || {};
    if (meta.civweave_schema !== 'civweave.node-membership.v1') throw new Error('Stripe invoice is not a Civweave membership invoice.');
    if (meta.civweave_node_id !== String(nodeId) || meta.civweave_user_id !== String(userId) || meta.civweave_tier_id !== String(tierId)) throw new Error('Stripe membership metadata does not match the Civweave member.');
    if (meta.civweave_host_account_id !== String(accountId)) throw new Error('Stripe membership host account metadata does not match the Civweave node.');
    if (Number(meta.civweave_monthly_lifetime_credits) !== Number(monthlyLifetimeCredits)) throw new Error('Stripe membership lifetime-credit metadata does not match the tier.');
    const payments = await this.listInvoicePayments(invoice.id);
    const paid = (Array.isArray(payments?.data) ? payments.data : []).find(item => item?.status === 'paid' && item?.payment?.type === 'payment_intent' && item?.payment?.payment_intent);
    if (!paid) throw new Error('Stripe invoice has no settled PaymentIntent payment.');
    const pi = await this.retrievePaymentIntent(paid.payment.payment_intent);
    if (!pi || pi.status !== 'succeeded') throw new Error('Stripe membership PaymentIntent has not succeeded.');
    const charge = pi.latest_charge;
    if (!charge || typeof charge !== 'object' || charge.status !== 'succeeded') throw new Error('Stripe membership charge has not succeeded.');
    const balance = charge.balance_transaction;
    if (!balance || typeof balance !== 'object') throw new Error('Stripe membership balance transaction is unavailable.');
    const gross = Math.max(0, Number(paid.amount_paid || invoice.amount_paid || 0));
    const fee = Math.max(0, Number(balance.fee || 0));
    return Object.freeze({
      invoiceId: invoice.id,
      subscriptionId: parent.subscription_details.subscription,
      customerId: typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id || null,
      paymentIntentId: pi.id,
      chargeId: charge.id,
      balanceTransactionId: balance.id,
      grossCents: gross,
      processorFeeCents: fee,
      netCents: Math.max(0, Number(balance.net ?? gross - fee)),
      currency: String(invoice.currency || charge.currency || '').toUpperCase(),
      metadata: Object.freeze({ ...meta })
    });
  }

  async createHostTransfer({ accountId, amountCents, currency = 'usd', sourceTransaction = '', transferGroup = '', idempotencyKey, metadata: extraMetadata = {} } = {}) {
    const amount = cents(amountCents, 'amountCents', { positive: true });
    const form = {
      amount,
      currency: clean(currency, 12).toLowerCase(),
      destination: required(accountId, 'accountId', 180),
      source_transaction: required(sourceTransaction, 'sourceTransaction', 220),
      transfer_group: clean(transferGroup, 180)
    };
    for (const [key, value] of Object.entries(metadata(extraMetadata))) form[`metadata[${key}]`] = value;
    return this.request('/v1/transfers', { form, idempotencyKey });
  }

  async reverseHostTransfer({ transferId, amountCents, idempotencyKey, metadata: extraMetadata = {} } = {}) {
    const form = { amount: cents(amountCents, 'amountCents', { positive: true }) };
    for (const [key, value] of Object.entries(metadata(extraMetadata))) form[`metadata[${key}]`] = value;
    return this.request(`/v1/transfers/${encodeURIComponent(required(transferId, 'transferId', 220))}/reversals`, { form, idempotencyKey });
  }

  async refundTopUp({ chargeId, amountCents, idempotencyKey } = {}) {
    return this.request('/v1/refunds', { idempotencyKey, form: { charge: required(chargeId, 'chargeId', 220), amount: cents(amountCents, 'amountCents', { positive: true }) } });
  }
}
