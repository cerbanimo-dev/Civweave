import Stripe from 'stripe';

export const FELLOWFARE_DIRECT_COMMERCE_SCHEMA = 'civweave.fellowfare-direct-commerce.v1';
export const FELLOWFARE_DIRECT_COMMERCE_KINDS = Object.freeze(['service', 'learning', 'tutoring']);
export const FELLOWFARE_DEFAULT_SERVICE_FEE_BPS = 100;

const ELIGIBLE_KINDS = new Set(FELLOWFARE_DIRECT_COMMERCE_KINDS);
const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const iso = () => new Date().toISOString();
const enabled = value => ['1', 'true', 'yes', 'on'].includes(clean(value, 20).toLowerCase());
const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value, null, 2), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }
});

function required(value, label, max = 4000) {
  const out = clean(value, max);
  if (!out) throw Object.assign(new TypeError(`${label} is required.`), { status: 400 });
  return out;
}
function integer(value, label, min, max) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw Object.assign(new RangeError(`${label} must be an integer from ${min} through ${max}.`), { status: 400 });
  }
  return parsed;
}
function kind(value) {
  const out = clean(value, 40).toLowerCase();
  if (!ELIGIBLE_KINDS.has(out)) {
    throw Object.assign(new TypeError('Direct FellowFare checkout is only available for services, learning, and tutoring. Physical/community goods remain seller-direct outside FellowFare.'), { status: 400 });
  }
  return out;
}
function requireDb(env) {
  if (!env?.DB) throw Object.assign(new Error('Civweave D1 binding DB is required for FellowFare merchant mappings.'), { status: 503 });
  return env.DB;
}
function stripeSecret(env) {
  const key = clean(env?.STRIPE_SECRET_KEY, 10000);
  if (!key) throw Object.assign(new Error('STRIPE_SECRET_KEY is not configured.'), { status: 503 });
  const live = /^(?:sk|rk)_live_/.test(key);
  if (live && !enabled(env?.CIVWEAVE_MONEY_LIVE_ENABLED)) {
    throw Object.assign(new Error('Live Stripe payments remain disabled by the Civweave live-money gate.'), { status: 503 });
  }
  return key;
}
function createStripeClient(env, { fetchImpl = globalThis.fetch } = {}) {
  return new Stripe(stripeSecret(env), {
    httpClient: Stripe.createFetchHttpClient(fetchImpl),
    appInfo: { name: 'FellowFare Direct Commerce', version: '1' }
  });
}
function integrationIdentifier() {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return `fellowfare-service-${Array.from(bytes, value => alphabet[value % alphabet.length]).join('')}`;
}
function safeStatus(error) {
  return Number.isSafeInteger(error?.status) ? error.status : 500;
}
function safeError(error) {
  const status = safeStatus(error);
  return {
    status,
    body: {
      schema: FELLOWFARE_DIRECT_COMMERCE_SCHEMA,
      ok: false,
      error: status >= 500 ? 'FellowFare direct payment request failed.' : clean(error?.message || error, 1200)
    }
  };
}

async function mappingForUser(env, userId) {
  return requireDb(env).prepare('SELECT user_id AS userId, account_id AS accountId, created_at AS createdAt, updated_at AS updatedAt FROM stripe_connect_users WHERE user_id=?1')
    .bind(required(userId, 'userId', 180)).first();
}
async function mappingForAccount(env, accountId) {
  return requireDb(env).prepare('SELECT user_id AS userId, account_id AS accountId, created_at AS createdAt, updated_at AS updatedAt FROM stripe_connect_users WHERE account_id=?1')
    .bind(required(accountId, 'accountId', 180)).first();
}
async function saveMapping(env, userId, accountId) {
  const at = iso();
  await requireDb(env).prepare(`INSERT INTO stripe_connect_users(user_id,account_id,created_at,updated_at)
    VALUES(?1,?2,?3,?4)
    ON CONFLICT(user_id) DO UPDATE SET account_id=excluded.account_id,updated_at=excluded.updated_at`)
    .bind(required(userId, 'userId', 180), required(accountId, 'accountId', 180), at, at).run();
  return mappingForUser(env, userId);
}

async function retrieveMerchantStatus(stripe, accountId) {
  const account = await stripe.v2.core.accounts.retrieve(required(accountId, 'accountId', 180), {
    include: ['configuration.merchant', 'requirements']
  });
  const cardPaymentsStatus = account?.configuration?.merchant?.capabilities?.card_payments?.status || 'unknown';
  const requirementsStatus = account?.requirements?.summary?.minimum_deadline?.status || null;
  return Object.freeze({
    account,
    readyToProcessPayments: cardPaymentsStatus === 'active',
    cardPaymentsStatus,
    requirementsStatus,
    onboardingComplete: requirementsStatus !== 'currently_due' && requirementsStatus !== 'past_due'
  });
}
function publicMerchantStatus(mapping, result) {
  return Object.freeze({
    schema: FELLOWFARE_DIRECT_COMMERCE_SCHEMA,
    userId: mapping?.userId || null,
    accountId: result.account.id,
    displayName: result.account.display_name || null,
    contactEmail: result.account.contact_email || null,
    readyToProcessPayments: result.readyToProcessPayments,
    cardPaymentsStatus: result.cardPaymentsStatus,
    requirementsStatus: result.requirementsStatus,
    onboardingComplete: result.onboardingComplete,
    dashboard: 'full',
    merchantOfRecord: 'connected-account',
    feesCollector: 'stripe',
    lossesCollector: 'stripe',
    recommendedEmbeddedComponents: ['notification_banner', 'account_onboarding', 'account_management', 'payments']
  });
}

export async function createFellowFareMerchant(env, input, options = {}) {
  const stripe = options.stripeClient || createStripeClient(env, options);
  const userId = required(input?.userId, 'userId', 180);
  const existing = await mappingForUser(env, userId);
  if (existing) return publicMerchantStatus(existing, await retrieveMerchantStatus(stripe, existing.accountId));

  const account = await stripe.v2.core.accounts.create({
    display_name: required(input?.displayName, 'displayName', 180),
    contact_email: required(input?.contactEmail, 'contactEmail', 320),
    identity: { country: clean(input?.country || 'us', 2).toLowerCase() },
    dashboard: 'full',
    defaults: {
      responsibilities: {
        fees_collector: 'stripe',
        losses_collector: 'stripe'
      }
    },
    configuration: {
      customer: {},
      merchant: {
        capabilities: {
          card_payments: { requested: true }
        }
      }
    }
  });
  const mapping = await saveMapping(env, userId, account.id);
  return publicMerchantStatus(mapping, await retrieveMerchantStatus(stripe, account.id));
}

export async function getFellowFareMerchant(env, userId, options = {}) {
  const stripe = options.stripeClient || createStripeClient(env, options);
  const mapping = await mappingForUser(env, userId);
  if (!mapping) throw Object.assign(new Error('No FellowFare Stripe merchant is connected for this identity yet.'), { status: 404 });
  return publicMerchantStatus(mapping, await retrieveMerchantStatus(stripe, mapping.accountId));
}

export async function createFellowFareMerchantOnboarding(request, env, userId, options = {}) {
  const stripe = options.stripeClient || createStripeClient(env, options);
  const mapping = await mappingForUser(env, userId);
  if (!mapping) throw Object.assign(new Error('Create the FellowFare merchant account before requesting onboarding.'), { status: 404 });
  const origin = new URL(request.url).origin;
  const cabinet = `${origin}/app/services/fellowfare/cabinet.html?civweave=1&cabinet=1&ffstripe=1#inbox`;
  const link = await stripe.v2.core.accountLinks.create({
    account: mapping.accountId,
    use_case: {
      type: 'account_onboarding',
      account_onboarding: {
        configurations: ['merchant', 'customer'],
        refresh_url: `${cabinet}&stripe_onboarding=refresh`,
        return_url: `${cabinet}&stripe_onboarding=return`
      }
    }
  });
  return Object.freeze({
    schema: FELLOWFARE_DIRECT_COMMERCE_SCHEMA,
    accountId: mapping.accountId,
    url: link.url,
    expiresAt: link.expires_at || null
  });
}

export async function createFellowFareServicePrice(env, input, options = {}) {
  const stripe = options.stripeClient || createStripeClient(env, options);
  const listingKind = kind(input?.kind);
  const userId = required(input?.userId, 'userId', 180);
  const mapping = await mappingForUser(env, userId);
  if (!mapping) throw Object.assign(new Error('Connect Stripe before enabling USD checkout on this listing.'), { status: 404 });
  const status = await retrieveMerchantStatus(stripe, mapping.accountId);
  if (!status.readyToProcessPayments) throw Object.assign(new Error('Stripe onboarding is not complete enough to accept direct charges yet.'), { status: 409 });
  const amountMinor = integer(input?.amountMinor, 'amountMinor', 50, 100000000);
  const currency = clean(input?.currency || 'usd', 12).toLowerCase();
  const listingId = required(input?.listingId, 'listingId', 220);
  const product = await stripe.products.create({
    name: required(input?.name, 'name', 180),
    description: clean(input?.description, 1000) || undefined,
    metadata: {
      civweave_schema: FELLOWFARE_DIRECT_COMMERCE_SCHEMA,
      fellowfare_listing_id: listingId,
      fellowfare_kind: listingKind
    },
    default_price_data: {
      unit_amount: amountMinor,
      currency,
      metadata: {
        fellowfare_listing_id: listingId,
        fellowfare_kind: listingKind
      }
    }
  }, { stripeAccount: mapping.accountId });
  const price = product.default_price;
  const priceId = typeof price === 'string' ? price : price?.id;
  if (!priceId) throw Object.assign(new Error('Stripe did not return a default Price for this listing.'), { status: 502 });
  return Object.freeze({
    schema: FELLOWFARE_DIRECT_COMMERCE_SCHEMA,
    accountId: mapping.accountId,
    productId: product.id,
    priceId,
    listingId,
    kind: listingKind,
    amountMinor,
    currency,
    platformFeeBps: integer(env?.CIVWEAVE_FELLOWFARE_SERVICE_FEE_BPS ?? FELLOWFARE_DEFAULT_SERVICE_FEE_BPS, 'CIVWEAVE_FELLOWFARE_SERVICE_FEE_BPS', 0, 10000),
    merchantOfRecord: 'connected-account'
  });
}

export async function createFellowFareDirectCheckout(request, env, input, options = {}) {
  const stripe = options.stripeClient || createStripeClient(env, options);
  const listingKind = kind(input?.kind);
  const accountId = required(input?.accountId, 'accountId', 180);
  const mapping = await mappingForAccount(env, accountId);
  if (!mapping) throw Object.assign(new Error('This connected account is not registered as a FellowFare merchant.'), { status: 404 });
  const merchant = await retrieveMerchantStatus(stripe, accountId);
  if (!merchant.readyToProcessPayments) throw Object.assign(new Error('The seller is not currently ready to accept Stripe direct charges.'), { status: 409 });
  const priceId = required(input?.priceId, 'priceId', 220);
  const listingId = required(input?.listingId, 'listingId', 220);
  const quantity = integer(input?.quantity ?? 1, 'quantity', 1, 99);
  const price = await stripe.prices.retrieve(priceId, {}, { stripeAccount: accountId });
  if (!Number.isSafeInteger(price?.unit_amount) || price.unit_amount <= 0 || price.active === false) {
    throw Object.assign(new Error('The seller Stripe Price must be active with a positive fixed unit amount.'), { status: 400 });
  }
  if (clean(price?.metadata?.fellowfare_listing_id, 220) !== listingId || clean(price?.metadata?.fellowfare_kind, 40) !== listingKind) {
    throw Object.assign(new Error('The Stripe Price does not match this FellowFare listing.'), { status: 400 });
  }
  const gross = price.unit_amount * quantity;
  const feeBps = integer(env?.CIVWEAVE_FELLOWFARE_SERVICE_FEE_BPS ?? FELLOWFARE_DEFAULT_SERVICE_FEE_BPS, 'CIVWEAVE_FELLOWFARE_SERVICE_FEE_BPS', 0, 10000);
  const applicationFeeAmount = Math.floor(gross * feeBps / 10000);
  const origin = new URL(request.url).origin;
  const successUrl = `${origin}/app/services/fellowfare/cabinet.html?civweave=1&cabinet=1&ffcash=success&listingId=${encodeURIComponent(listingId)}&session_id={CHECKOUT_SESSION_ID}#assemblies`;
  const cancelUrl = `${origin}/app/services/fellowfare/cabinet.html?civweave=1&cabinet=1&ffcash=cancelled&listingId=${encodeURIComponent(listingId)}#market`;
  const paymentIntentData = {
    metadata: {
      civweave_schema: FELLOWFARE_DIRECT_COMMERCE_SCHEMA,
      fellowfare_listing_id: listingId,
      fellowfare_kind: listingKind,
      fellowfare_merchant_user_id: mapping.userId
    }
  };
  if (applicationFeeAmount > 0) paymentIntentData.application_fee_amount = applicationFeeAmount;

  const session = await stripe.checkout.sessions.create({
    integration_identifier: integrationIdentifier(),
    line_items: [{ price: price.id, quantity }],
    payment_intent_data: paymentIntentData,
    metadata: {
      civweave_schema: FELLOWFARE_DIRECT_COMMERCE_SCHEMA,
      fellowfare_listing_id: listingId,
      fellowfare_kind: listingKind,
      fellowfare_charge_pattern: 'direct-charge'
    },
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl
  }, { stripeAccount: accountId });

  return Object.freeze({
    schema: FELLOWFARE_DIRECT_COMMERCE_SCHEMA,
    checkoutUrl: session.url,
    sessionId: session.id,
    accountId,
    listingId,
    kind: listingKind,
    grossMinor: gross,
    currency: price.currency,
    platformFeeBps: feeBps,
    applicationFeeAmount,
    chargePattern: 'direct-charge',
    merchantOfRecord: 'connected-account',
    platformCollectsGross: false,
    platformRoutesSellerProceeds: false
  });
}

export async function handleFellowFareDirectCommerce(request, env, options = {}) {
  const url = new URL(request.url);
  const pathname = decodeURIComponent(url.pathname);
  try {
    if (request.method === 'POST' && pathname === '/api/fellowfare/direct-commerce/accounts') {
      return json(await createFellowFareMerchant(env, await request.json(), options), 201);
    }
    const statusMatch = pathname.match(/^\/api\/fellowfare\/direct-commerce\/accounts\/([^/]+)$/);
    if (request.method === 'GET' && statusMatch) {
      return json(await getFellowFareMerchant(env, statusMatch[1], options));
    }
    const onboardMatch = pathname.match(/^\/api\/fellowfare\/direct-commerce\/accounts\/([^/]+)\/onboard$/);
    if (request.method === 'POST' && onboardMatch) {
      return json(await createFellowFareMerchantOnboarding(request, env, onboardMatch[1], options), 201);
    }
    if (request.method === 'POST' && pathname === '/api/fellowfare/direct-commerce/prices') {
      return json(await createFellowFareServicePrice(env, await request.json(), options), 201);
    }
    if (request.method === 'POST' && pathname === '/api/fellowfare/direct-commerce/checkout') {
      return json(await createFellowFareDirectCheckout(request, env, await request.json(), options), 201);
    }
    if (pathname.startsWith('/api/fellowfare/direct-commerce/')) {
      return json({ schema: FELLOWFARE_DIRECT_COMMERCE_SCHEMA, ok: false, error: 'FellowFare direct-commerce route not found.' }, 404);
    }
    return null;
  } catch (error) {
    const safe = safeError(error);
    return json(safe.body, safe.status);
  }
}
