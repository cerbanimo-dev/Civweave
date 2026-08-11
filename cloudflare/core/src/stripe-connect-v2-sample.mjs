import Stripe from 'stripe';

// This sample intentionally uses one Stripe Client for every Stripe API request.
// The SDK version is pinned by cloudflare/core/package.json. We do not pass an
// apiVersion here because stripe-node 22.4.0 automatically uses 2026-07-29.dahlia.
export const STRIPE_CONNECT_SAMPLE_SCHEMA = 'civweave.stripe-connect-v2-sample.v1';
export const STRIPE_CONNECT_SAMPLE_SDK = 'stripe-node@22.4.0';
export const STRIPE_CONNECT_SAMPLE_THIN_EVENTS = Object.freeze([
  'v2.core.account[requirements].updated',
  'v2.core.account[configuration.merchant].capability_status_updated',
  'v2.core.account[configuration.customer].capability_status_updated'
]);

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const iso = () => new Date().toISOString();
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
function htmlEscape(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
function safeStatus(error) {
  return Number.isSafeInteger(error?.status) ? error.status : 500;
}
function sampleError(error) {
  const status = safeStatus(error);
  const detail = status >= 500 ? 'Stripe Connect sample request failed.' : clean(error?.message || error, 1200);
  return { status, body: { ok: false, error: detail } };
}

// PLACEHOLDER/SECRET: add STRIPE_SECRET_KEY as a Cloudflare Worker secret (and,
// for this repo's deployment workflow, as a GitHub repository secret). We fail
// with a useful 503 instead of constructing a half-configured client.
export function createStripeClient(env, { fetchImpl = globalThis.fetch } = {}) {
  const secretKey = clean(env?.STRIPE_SECRET_KEY, 10000);
  if (!secretKey) {
    throw Object.assign(new Error(
      'STRIPE_SECRET_KEY is not configured. Add a Stripe test secret key as the STRIPE_SECRET_KEY repository/Worker secret before using the Connect sample.'
    ), { status: 503 });
  }
  return new Stripe(secretKey, {
    // Cloudflare Workers expose the Web Fetch API. Supplying Stripe's fetch HTTP
    // adapter keeps all outbound Stripe requests inside the Stripe Client while
    // remaining compatible with the Worker runtime.
    httpClient: Stripe.createFetchHttpClient(fetchImpl),
    appInfo: { name: 'Civweave Connect Sample', version: '1' }
  });
}

function requireDb(env) {
  if (!env?.DB) throw Object.assign(new Error('Civweave D1 binding DB is required for the Connect user-to-account mapping.'), { status: 503 });
  return env.DB;
}

async function mappingForUser(env, userId) {
  const db = requireDb(env);
  return db.prepare('SELECT user_id AS userId, account_id AS accountId, created_at AS createdAt, updated_at AS updatedAt FROM stripe_connect_users WHERE user_id=?1')
    .bind(required(userId, 'userId', 180)).first();
}

async function saveUserMapping(env, userId, accountId) {
  const db = requireDb(env);
  const at = iso();
  await db.prepare(`INSERT INTO stripe_connect_users(user_id,account_id,created_at,updated_at)
    VALUES(?1,?2,?3,?4)
    ON CONFLICT(user_id) DO UPDATE SET account_id=excluded.account_id,updated_at=excluded.updated_at`)
    .bind(required(userId, 'userId', 180), required(accountId, 'Stripe account ID', 180), at, at).run();
  return mappingForUser(env, userId);
}

// Always retrieve onboarding state from Stripe. The database only stores the
// Civweave user -> Stripe account ID mapping, never the requirements/capability
// state itself, because regulators/card networks can change requirements later.
export async function retrieveConnectStatus(stripeClient, accountId) {
  const account = await stripeClient.v2.core.accounts.retrieve(required(accountId, 'accountId', 180), {
    include: ['configuration.merchant', 'requirements']
  });
  const cardStatus = account?.configuration?.merchant?.capabilities?.card_payments?.status || 'unknown';
  const requirementsStatus = account?.requirements?.summary?.minimum_deadline?.status || null;
  return Object.freeze({
    account,
    readyToProcessPayments: cardStatus === 'active',
    cardPaymentsStatus: cardStatus,
    requirementsStatus,
    onboardingComplete: requirementsStatus !== 'currently_due' && requirementsStatus !== 'past_due'
  });
}

async function accountForUser(env, stripeClient, userId) {
  const mapping = await mappingForUser(env, userId);
  if (!mapping) throw Object.assign(new Error('No Stripe connected account is mapped to this user yet. Create one first.'), { status: 404 });
  const status = await retrieveConnectStatus(stripeClient, mapping.accountId);
  return { mapping, ...status };
}

function publicStatus(result) {
  return Object.freeze({
    schema: STRIPE_CONNECT_SAMPLE_SCHEMA,
    userId: result.mapping?.userId || null,
    accountId: result.account.id,
    displayName: result.account.display_name || null,
    contactEmail: result.account.contact_email || null,
    readyToProcessPayments: result.readyToProcessPayments,
    cardPaymentsStatus: result.cardPaymentsStatus,
    requirementsStatus: result.requirementsStatus,
    onboardingComplete: result.onboardingComplete,
    requirements: result.account.requirements || null
  });
}

export async function createConnectedAccount(env, input, options = {}) {
  const stripeClient = options.stripeClient || createStripeClient(env, options);
  const userId = required(input?.userId, 'userId', 180);
  const existing = await mappingForUser(env, userId);
  if (existing) return publicStatus(await accountForUser(env, stripeClient, userId));

  // Stripe Accounts V2: only the requested properties are sent. Do NOT add a
  // top-level type ('standard', 'express', or 'custom') to this request.
  const account = await stripeClient.v2.core.accounts.create({
    display_name: required(input?.displayName, 'displayName', 180),
    contact_email: required(input?.contactEmail, 'contactEmail', 320),
    identity: { country: 'us' },
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

  await saveUserMapping(env, userId, account.id);
  return publicStatus(await accountForUser(env, stripeClient, userId));
}

export async function createOnboardingLink(request, env, userId, options = {}) {
  const stripeClient = options.stripeClient || createStripeClient(env, options);
  const { mapping } = await accountForUser(env, stripeClient, userId);
  const origin = new URL(request.url).origin;

  // Account Links are single-use. The refresh URL returns here so the app can
  // create a fresh link if the old one expired; return_url lands on the status UI.
  const accountLink = await stripeClient.v2.core.accountLinks.create({
    account: mapping.accountId,
    use_case: {
      type: 'account_onboarding',
      account_onboarding: {
        configurations: ['merchant', 'customer'],
        refresh_url: `${origin}/connect-demo?userId=${encodeURIComponent(mapping.userId)}&onboarding=refresh`,
        return_url: `${origin}/connect-demo?userId=${encodeURIComponent(mapping.userId)}&onboarding=return`
      }
    }
  });
  return Object.freeze({ schema: STRIPE_CONNECT_SAMPLE_SCHEMA, accountId: mapping.accountId, url: accountLink.url, expiresAt: accountLink.expires_at || null });
}

async function accountIdForUser(env, userId) {
  const mapping = await mappingForUser(env, userId);
  if (!mapping) throw Object.assign(new Error('No Stripe account mapping exists for this user.'), { status: 404 });
  return mapping.accountId;
}

export async function createConnectedProduct(env, input, options = {}) {
  const stripeClient = options.stripeClient || createStripeClient(env, options);
  const accountId = await accountIdForUser(env, input?.userId);
  const priceInCents = integer(input?.priceInCents, 'priceInCents', 50, 100000000);
  const currency = clean(input?.currency || 'usd', 12).toLowerCase();

  // The request option becomes Stripe-Account, so the Product and its default
  // Price live on the connected account rather than on the Civweave platform.
  const product = await stripeClient.products.create({
    name: required(input?.name, 'name', 180),
    description: clean(input?.description, 1000) || undefined,
    default_price_data: {
      unit_amount: priceInCents,
      currency
    }
  }, { stripeAccount: accountId });
  return Object.freeze({ schema: STRIPE_CONNECT_SAMPLE_SCHEMA, accountId, product });
}

export async function listConnectedProducts(env, accountId, options = {}) {
  const stripeClient = options.stripeClient || createStripeClient(env, options);
  const products = await stripeClient.products.list({
    limit: 20,
    active: true,
    expand: ['data.default_price']
  }, { stripeAccount: required(accountId, 'accountId', 180) });
  return products.data || [];
}

export async function createDirectCheckout(request, env, accountId, input, options = {}) {
  const stripeClient = options.stripeClient || createStripeClient(env, options);
  const connectedAccountId = required(accountId, 'accountId', 180);
  const priceId = required(input?.priceId, 'priceId', 220);
  const quantity = integer(input?.quantity ?? 1, 'quantity', 1, 99);

  // Retrieve the selected Price through the connected account header. This both
  // validates ownership and gives us the amount needed to calculate the sample
  // application fee before creating Checkout.
  const price = await stripeClient.prices.retrieve(priceId, {}, { stripeAccount: connectedAccountId });
  if (!Number.isSafeInteger(price?.unit_amount) || price.unit_amount <= 0) {
    throw Object.assign(new Error('The selected Stripe Price must have a positive fixed unit_amount for this sample.'), { status: 400 });
  }
  const gross = price.unit_amount * quantity;
  const feeBps = integer(env?.CIVWEAVE_PLATFORM_FEE_BPS ?? 1500, 'CIVWEAVE_PLATFORM_FEE_BPS', 0, 10000);
  const applicationFeeAmount = Math.floor(gross * feeBps / 10000);
  const origin = new URL(request.url).origin;

  // Direct charge: Stripe-Account makes the connected account the charge owner.
  // application_fee_amount transfers Civweave's platform fee to the platform.
  const session = await stripeClient.checkout.sessions.create({
    line_items: [{ price: price.id, quantity }],
    payment_intent_data: { application_fee_amount: applicationFeeAmount },
    mode: 'payment',
    success_url: `${origin}/connect-demo/success?accountId=${encodeURIComponent(connectedAccountId)}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/store/${encodeURIComponent(connectedAccountId)}?checkout=cancelled`
  }, { stripeAccount: connectedAccountId });
  return Object.freeze({ schema: STRIPE_CONNECT_SAMPLE_SCHEMA, accountId: connectedAccountId, checkoutUrl: session.url, sessionId: session.id, applicationFeeAmount });
}

export async function retrieveCheckoutResult(env, accountId, sessionId, options = {}) {
  const stripeClient = options.stripeClient || createStripeClient(env, options);
  const session = await stripeClient.checkout.sessions.retrieve(required(sessionId, 'session_id', 220), {}, {
    stripeAccount: required(accountId, 'accountId', 180)
  });
  return session;
}

async function markThinEvent(env, eventId, eventType, accountId) {
  const db = requireDb(env);
  const result = await db.prepare(`INSERT OR IGNORE INTO stripe_connect_thin_events(event_id,event_type,account_id,received_at)
    VALUES(?1,?2,?3,?4)`)
    .bind(eventId, eventType, accountId || null, iso()).run();
  return Number(result?.meta?.changes ?? result?.changes ?? 0) === 1;
}

export async function handleThinConnectWebhook(request, env, options = {}) {
  const stripeClient = options.stripeClient || createStripeClient(env, options);
  // PLACEHOLDER/SECRET: this is the signing secret from the THIN event
  // destination, not the snapshot payment webhook. Keep the two secrets separate.
  const webhookSecret = clean(env?.STRIPE_CONNECT_THIN_WEBHOOK_SECRET, 10000);
  if (!webhookSecret) {
    throw Object.assign(new Error(
      'STRIPE_CONNECT_THIN_WEBHOOK_SECRET is not configured. Add the whsec_... secret from the Connect thin-event destination.'
    ), { status: 503 });
  }
  const signature = required(request.headers.get('stripe-signature'), 'Stripe-Signature header', 4000);
  const rawBody = await request.text();

  // stripe-node 22.x names the current thin-event parser parseEventNotification.
  // The async variant works naturally with WebCrypto in Cloudflare Workers.
  const notification = await stripeClient.parseEventNotificationAsync(rawBody, signature, webhookSecret);
  const event = await notification.fetchEvent();
  const accountId = notification.related_object?.id || event.related_object?.id || null;
  const firstSeen = await markThinEvent(env, event.id, event.type, accountId);
  if (!firstSeen) return { received: true, duplicate: true, eventId: event.id, type: event.type, accountId };

  let status = null;
  switch (event.type) {
    case 'v2.core.account[requirements].updated':
      // Requirements changed. Fetch the Account now instead of trusting stale DB
      // state so the UI can immediately show the current Stripe requirements.
      if (accountId) status = publicStatus({ mapping: null, ...(await retrieveConnectStatus(stripeClient, accountId)) });
      break;
    case 'v2.core.account[configuration.merchant].capability_status_updated':
      // Merchant capability changes include card_payments activation/restriction.
      if (accountId) status = publicStatus({ mapping: null, ...(await retrieveConnectStatus(stripeClient, accountId)) });
      break;
    case 'v2.core.account[configuration.customer].capability_status_updated':
      // Customer configuration is requested on account creation and onboarding.
      if (accountId) status = publicStatus({ mapping: null, ...(await retrieveConnectStatus(stripeClient, accountId)) });
      break;
    default:
      return { received: true, ignored: true, eventId: event.id, type: event.type, accountId };
  }
  console.log(JSON.stringify({ source: 'stripe-connect-thin', eventId: event.id, type: event.type, accountId, status }));
  return { received: true, eventId: event.id, type: event.type, accountId, status };
}

function shell(title, body, script = '') {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${htmlEscape(title)}</title><style>
  :root{color-scheme:dark;--bg:#111326;--panel:#1b1f3a;--ink:#f5f3ed;--muted:#b9bfd8;--line:#343a63;--accent:#73e0d1;--gold:#ffd66b;--danger:#ff8fa3}*{box-sizing:border-box}body{margin:0;background:linear-gradient(180deg,#101225,#171a31);color:var(--ink);font:16px/1.45 system-ui,sans-serif}main{max-width:920px;margin:auto;padding:24px 16px 60px}h1{font-size:clamp(1.8rem,6vw,3rem);margin:.2em 0}h2{margin-top:0}.panel{background:rgba(27,31,58,.96);border:1px solid var(--line);border-radius:18px;padding:18px;margin:14px 0;box-shadow:0 18px 48px #0004}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}label{display:grid;gap:6px;color:var(--muted)}input,textarea,select,button,a.button{font:inherit;border-radius:12px;border:1px solid var(--line);padding:11px 12px}input,textarea,select{width:100%;background:#11152c;color:var(--ink)}button,a.button{background:var(--accent);color:#08151a;font-weight:750;cursor:pointer;text-decoration:none;display:inline-block}button.secondary,a.secondary{background:#252a4d;color:var(--ink)}code,pre{background:#0c0f20;border-radius:10px;padding:2px 6px}pre{white-space:pre-wrap;overflow:auto;padding:12px}.muted{color:var(--muted)}.ok{color:var(--accent)}.warn{color:var(--gold)}.error{color:var(--danger)}.products{display:grid;gap:12px}.product{border:1px solid var(--line);border-radius:14px;padding:14px}.row{display:flex;gap:9px;flex-wrap:wrap;align-items:center}</style></head><body><main>${body}</main>${script ? `<script type="module">${script}</script>` : ''}</body></html>`;
}

function connectDemoHtml(request) {
  const preset = htmlEscape(new URL(request.url).searchParams.get('userId') || 'demo-provider');
  const body = `<p class="muted">Civweave · Stripe Connect V2 sample</p><h1>Provider payments lab</h1><p>This is a sandbox-oriented integration surface. It creates an Accounts V2 connected account, reads onboarding state directly from Stripe, creates connected-account products, and links to a simple storefront.</p>
  <section class="panel"><h2>1. Connected account</h2><div class="grid"><label>Civweave user/operator ID<input id="userId" value="${preset}"></label><label>Display name<input id="displayName" value="Demo Civweave Provider"></label><label>Contact email<input id="contactEmail" type="email" placeholder="provider@example.com"></label></div><div class="row" style="margin-top:12px"><button id="create">Create / load account</button><button class="secondary" id="refresh">Refresh status from Stripe</button><button class="secondary" id="onboard">Onboard to collect payments</button></div><pre id="status">Waiting.</pre></section>
  <section class="panel"><h2>2. Product</h2><div class="grid"><label>Name<input id="productName" value="Sample Civweave service"></label><label>Description<input id="productDescription" value="A connected-account product created by the sample."></label><label>Price in cents<input id="price" type="number" min="50" value="1200"></label><label>Currency<input id="currency" value="usd"></label></div><div class="row" style="margin-top:12px"><button id="product">Create product</button><a class="button secondary" id="store" href="#">Open storefront</a></div><pre id="productOut">Create or load an account first.</pre></section>`;
  const script = `const $=id=>document.getElementById(id);let accountId='';async function api(url,init={}){const r=await fetch(url,{headers:{'content-type':'application/json',...(init.headers||{})},...init});const p=await r.json().catch(()=>({error:'Invalid JSON response'}));if(!r.ok)throw new Error(p.error||('HTTP '+r.status));return p}function user(){return $('userId').value.trim()}function show(p){$('status').textContent=JSON.stringify(p,null,2);accountId=p.accountId||accountId;if(accountId)$('store').href='/store/'+encodeURIComponent(accountId)}$('create').onclick=async()=>{try{show(await api('/api/connect-demo/accounts',{method:'POST',body:JSON.stringify({userId:user(),displayName:$('displayName').value,contactEmail:$('contactEmail').value})}))}catch(e){$('status').textContent=e.message}};$('refresh').onclick=async()=>{try{show(await api('/api/connect-demo/accounts/'+encodeURIComponent(user())))}catch(e){$('status').textContent=e.message}};$('onboard').onclick=async()=>{try{const p=await api('/api/connect-demo/accounts/'+encodeURIComponent(user())+'/onboard',{method:'POST'});location.href=p.url}catch(e){$('status').textContent=e.message}};$('product').onclick=async()=>{try{const p=await api('/api/connect-demo/products',{method:'POST',body:JSON.stringify({userId:user(),name:$('productName').value,description:$('productDescription').value,priceInCents:Number($('price').value),currency:$('currency').value})});$('productOut').textContent=JSON.stringify(p,null,2);accountId=p.accountId;$('store').href='/store/'+encodeURIComponent(accountId)}catch(e){$('productOut').textContent=e.message}};if(user())$('refresh').click();`;
  return shell('Civweave Connect V2 sample', body, script);
}

function storefrontHtml(accountId) {
  const safe = htmlEscape(accountId);
  // Demo-only routing uses acct_... in the URL. Production should expose an
  // opaque merchant slug/ID and resolve it server-side instead of revealing the
  // Stripe account identifier in public URLs.
  const body = `<p class="muted">Civweave connected storefront · sample</p><h1>Provider storefront</h1><p class="muted">Connected account <code>${safe}</code></p><section class="panel"><div id="products" class="products">Loading products…</div></section><p><a class="button secondary" href="/connect-demo">Back to provider lab</a></p>`;
  const script = `const accountId=${JSON.stringify(accountId)};const root=document.getElementById('products');async function load(){const r=await fetch('/api/connect-demo/store/'+encodeURIComponent(accountId)+'/products');const p=await r.json();if(!r.ok){root.textContent=p.error||'Could not load products';return}if(!p.products.length){root.textContent='No active products yet.';return}root.innerHTML='';for(const item of p.products){const price=item.default_price&&typeof item.default_price==='object'?item.default_price:null;const el=document.createElement('article');el.className='product';const amount=price&&Number.isInteger(price.unit_amount)?new Intl.NumberFormat(undefined,{style:'currency',currency:(price.currency||'usd').toUpperCase()}).format(price.unit_amount/100):'No fixed price';el.innerHTML='<h2></h2><p class="muted"></p><p><strong></strong></p><button '+(!price?'disabled':'')+'>Buy with Stripe Checkout</button>';el.querySelector('h2').textContent=item.name;el.querySelector('p').textContent=item.description||'';el.querySelector('strong').textContent=amount;el.querySelector('button').onclick=async()=>{const rr=await fetch('/api/connect-demo/store/'+encodeURIComponent(accountId)+'/checkout',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({priceId:price.id,quantity:1})});const out=await rr.json();if(!rr.ok){alert(out.error||'Checkout failed');return}location.href=out.checkoutUrl};root.append(el)}}load();`;
  return shell('Civweave provider storefront', body, script);
}

function successHtml(accountId, session) {
  const paid = session?.payment_status === 'paid';
  return shell('Civweave checkout result', `<p class="muted">Civweave connected storefront · sample</p><h1>${paid ? 'Payment received' : 'Checkout returned'}</h1><section class="panel"><p class="${paid ? 'ok' : 'warn'}"><strong>${htmlEscape(session?.payment_status || session?.status || 'unknown')}</strong></p><p>Checkout session <code>${htmlEscape(session?.id || '')}</code></p><a class="button" href="/store/${encodeURIComponent(accountId)}">Return to storefront</a></section>`);
}

export async function handleStripeConnectV2Sample(request, env, options = {}) {
  const url = new URL(request.url);
  const pathname = decodeURIComponent(url.pathname);
  try {
    if (request.method === 'GET' && pathname === '/connect-demo') {
      return new Response(connectDemoHtml(request), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
    }
    const storeMatch = pathname.match(/^\/store\/([^/]+)$/);
    if (request.method === 'GET' && storeMatch) {
      return new Response(storefrontHtml(storeMatch[1]), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
    }
    if (request.method === 'GET' && pathname === '/connect-demo/success') {
      const accountId = required(url.searchParams.get('accountId'), 'accountId', 180);
      const sessionId = required(url.searchParams.get('session_id'), 'session_id', 220);
      const session = await retrieveCheckoutResult(env, accountId, sessionId, options);
      return new Response(successHtml(accountId, session), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
    }
    if (request.method === 'POST' && pathname === '/api/connect-demo/accounts') {
      return json(await createConnectedAccount(env, await request.json(), options), 201);
    }
    const accountMatch = pathname.match(/^\/api\/connect-demo\/accounts\/([^/]+)$/);
    if (request.method === 'GET' && accountMatch) {
      const stripeClient = options.stripeClient || createStripeClient(env, options);
      return json(publicStatus(await accountForUser(env, stripeClient, accountMatch[1])));
    }
    const onboardMatch = pathname.match(/^\/api\/connect-demo\/accounts\/([^/]+)\/onboard$/);
    if (request.method === 'POST' && onboardMatch) {
      return json(await createOnboardingLink(request, env, onboardMatch[1], options), 201);
    }
    if (request.method === 'POST' && pathname === '/api/connect-demo/products') {
      return json(await createConnectedProduct(env, await request.json(), options), 201);
    }
    const productsMatch = pathname.match(/^\/api\/connect-demo\/store\/([^/]+)\/products$/);
    if (request.method === 'GET' && productsMatch) {
      return json({ schema: STRIPE_CONNECT_SAMPLE_SCHEMA, accountId: productsMatch[1], products: await listConnectedProducts(env, productsMatch[1], options) });
    }
    const checkoutMatch = pathname.match(/^\/api\/connect-demo\/store\/([^/]+)\/checkout$/);
    if (request.method === 'POST' && checkoutMatch) {
      return json(await createDirectCheckout(request, env, checkoutMatch[1], await request.json(), options), 201);
    }
    if (request.method === 'POST' && pathname === '/api/connect-demo/webhooks/stripe-thin') {
      return json(await handleThinConnectWebhook(request, env, options));
    }
    if (pathname.startsWith('/api/connect-demo/') || pathname.startsWith('/connect-demo') || pathname.startsWith('/store/')) {
      return json({ ok: false, error: 'Stripe Connect sample route not found.' }, 404);
    }
    return null;
  } catch (error) {
    const safe = sampleError(error);
    return json(safe.body, safe.status);
  }
}
