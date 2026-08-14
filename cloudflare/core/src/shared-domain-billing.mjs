import {
  normalizePagesOrigin,
  normalizeSharedDomainLabel,
  sharedDomainForLabel
} from './shared-domain-policy.mjs';
import {
  sharedDomainEntitlementByLabel,
  upsertSharedDomainEntitlement
} from './shared-domain-entitlements.mjs';

export const SHARED_DOMAIN_HOSTING_SCHEMA = 'civweave.shared-domain-hosting.v1';
export const SHARED_DOMAIN_HOSTING_POLICY = Object.freeze({
  freeMaxMembers: 28,
  hostedMaxMembers: 400,
  standardMonthlyCents: 500,
  scaleMonthlyCents: 1000,
  scaleThresholdMembers: 200,
  currency: 'usd'
});

const enc = new TextEncoder();
const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);

function required(value, label, max = 4000) {
  const out = clean(value, max);
  if (!out) throw Object.assign(new TypeError(`${label} is required.`), { status: 400 });
  return out;
}

export function sharedDomainHostingBand(memberCount = 0) {
  const count = Number(memberCount);
  if (!Number.isSafeInteger(count) || count < 0 || count > SHARED_DOMAIN_HOSTING_POLICY.hostedMaxMembers) {
    throw Object.assign(new RangeError(`Hub member count must be from 0 through ${SHARED_DOMAIN_HOSTING_POLICY.hostedMaxMembers}.`), { status: 409 });
  }
  return Object.freeze(count >= SHARED_DOMAIN_HOSTING_POLICY.scaleThresholdMembers
    ? { id: 'scale', quantity: 2, monthlyCents: SHARED_DOMAIN_HOSTING_POLICY.scaleMonthlyCents, minMembers: 200, maxMembers: 400 }
    : { id: 'standard', quantity: 1, monthlyCents: SHARED_DOMAIN_HOSTING_POLICY.standardMonthlyCents, minMembers: 0, maxMembers: 199 });
}

function hostingBandForMonthlyCents(value) {
  const cents = Number(value);
  if (cents === SHARED_DOMAIN_HOSTING_POLICY.standardMonthlyCents) return sharedDomainHostingBand(0);
  if (cents === SHARED_DOMAIN_HOSTING_POLICY.scaleMonthlyCents) return sharedDomainHostingBand(SHARED_DOMAIN_HOSTING_POLICY.scaleThresholdMembers);
  throw Object.assign(new Error('Stripe hub-hosting invoice is not one of the Civweave $5/$10 billing bands.'), { status: 409 });
}

function safePagesReturnUrl(value, pagesOrigin, label) {
  const url = new URL(required(value, label));
  if (url.protocol !== 'https:' || url.origin !== pagesOrigin) {
    throw Object.assign(new RangeError(`${label} must stay on the verified free Pages origin.`), { status: 400 });
  }
  return url.href;
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(String(value)));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function lettersFromHex(value, count = 8) {
  const hex = String(value || '').replace(/[^0-9a-f]/gi, '').padEnd(count * 2, '0');
  return Array.from({ length: count }, (_, index) => String.fromCharCode(97 + (parseInt(hex.slice(index * 2, index * 2 + 2), 16) % 26))).join('');
}

async function verifyCommunityPagesOrigin(edge, nodeId, value) {
  const pagesOrigin = normalizePagesOrigin(value);
  const response = await edge.fetch(new URL('/app/host-deployment-v1.json', pagesOrigin), {
    cache: 'no-store',
    headers: { accept: 'application/json', 'cache-control': 'no-cache' }
  });
  const marker = await response.json().catch(() => ({}));
  if (!response.ok || marker?.schema !== 'civweave.host-deployment.v1' || marker?.role !== 'community') {
    throw Object.assign(new Error('The requested Pages origin is not a live Civweave community host.'), { status: 400 });
  }
  if (clean(marker.hostId, 180) !== nodeId) {
    throw Object.assign(new Error('The Pages host identity does not match the authenticated Civweave host.'), { status: 409 });
  }
  const markerPagesOrigin = normalizePagesOrigin(marker.pagesOrigin || marker.publicOrigin || pagesOrigin);
  if (markerPagesOrigin !== pagesOrigin) {
    throw Object.assign(new Error('The Pages host deployment marker points at a different free origin.'), { status: 409 });
  }
  return { pagesOrigin, marker };
}

async function fetchHostCapacity(edge, node) {
  const callbackOrigin = required(node?.callback_origin, 'registered host callback origin');
  const response = await edge.fetch(new URL('/api/ai/node/capacity', callbackOrigin), {
    cache: 'no-store',
    headers: { accept: 'application/json', 'cache-control': 'no-cache' }
  });
  const envelope = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(`The registered host capacity endpoint returned HTTP ${response.status}.`), { status: 503 });
  const capacity = envelope?.capacity && typeof envelope.capacity === 'object' ? envelope.capacity : envelope;
  const memberCount = Number(capacity?.nodeMembers ?? capacity?.memberCount);
  if (!Number.isSafeInteger(memberCount) || memberCount < 0 || memberCount > SHARED_DOMAIN_HOSTING_POLICY.hostedMaxMembers) {
    throw Object.assign(new Error('The registered host did not report a valid Civweave member count.'), { status: 409 });
  }
  return Object.freeze({ capacity, memberCount, band: sharedDomainHostingBand(memberCount) });
}

function subscriptionMetadata(invoice) {
  if (invoice?.parent?.type !== 'subscription_details') return {};
  return invoice.parent.subscription_details?.metadata || {};
}

function subscriptionId(invoice) {
  const value = invoice?.parent?.type === 'subscription_details' ? invoice.parent.subscription_details?.subscription : null;
  return typeof value === 'string' ? value : clean(value?.id, 220) || null;
}

function billingPeriodEnd(invoice) {
  const candidates = [];
  const direct = Number(invoice?.period_end);
  if (Number.isFinite(direct) && direct > 0) candidates.push(direct);
  for (const line of Array.isArray(invoice?.lines?.data) ? invoice.lines.data : []) {
    const end = Number(line?.period?.end);
    if (Number.isFinite(end) && end > 0) candidates.push(end);
  }
  if (!candidates.length) throw Object.assign(new Error('Stripe hub-hosting invoice is missing its billing period end.'), { status: 409 });
  return new Date(Math.max(...candidates) * 1000).toISOString();
}

async function updateSubscriptionBand(edge, invoice, node, memberCount, band) {
  const id = required(subscriptionId(invoice), 'shared-domain subscription id', 220);
  const subscription = await edge.provider.request(`/v1/subscriptions/${encodeURIComponent(id)}`, { method: 'GET' });
  const items = Array.isArray(subscription?.items?.data) ? subscription.items.data : [];
  if (items.length !== 1 || !items[0]?.id) {
    throw Object.assign(new Error('Civweave hub hosting requires exactly one Stripe subscription item.'), { status: 409 });
  }
  const item = items[0];
  const currentQuantity = Number(item.quantity || 1);
  if (currentQuantity !== band.quantity) {
    await edge.provider.request(`/v1/subscription_items/${encodeURIComponent(item.id)}`, {
      form: { quantity: band.quantity, proration_behavior: 'none' },
      idempotencyKey: `civweave-host-band-${id}-${band.id}-${memberCount}`
    });
  }
  await edge.provider.request(`/v1/subscriptions/${encodeURIComponent(id)}`, {
    form: {
      'metadata[civweave_monthly_cents]': band.monthlyCents,
      'metadata[civweave_billing_band]': band.id,
      'metadata[civweave_last_member_count]': memberCount,
      'metadata[civweave_hosting_max_members]': SHARED_DOMAIN_HOSTING_POLICY.hostedMaxMembers,
      'metadata[civweave_scale_threshold_members]': SHARED_DOMAIN_HOSTING_POLICY.scaleThresholdMembers
    },
    idempotencyKey: `civweave-host-meta-${id}-${band.id}-${memberCount}`
  });
  return Object.freeze({
    subscriptionId: id,
    nodeId: node.node_id,
    memberCount,
    priorQuantity: currentQuantity,
    nextQuantity: band.quantity,
    nextMonthlyCents: band.monthlyCents,
    billingBand: band.id,
    changed: currentQuantity !== band.quantity,
    prorationBehavior: 'none'
  });
}

async function deliverHostingCapacity(edge, node, invoice, paidThrough, band) {
  const payload = Object.freeze({
    schema: 'civweave.node-payment-event.v1',
    id: `hosting:${required(invoice?.id, 'invoice id', 220)}`,
    type: 'hosting.plan.paid',
    nodeId: node.node_id,
    paidThrough,
    monthlyCents: band.monthlyCents,
    billingBand: band.id,
    maxMembers: SHARED_DOMAIN_HOSTING_POLICY.hostedMaxMembers,
    source: 'stripe-invoice-paid'
  });
  const rawText = JSON.stringify(payload);
  const signature = await edge.signEvent(enc.encode(rawText));
  const response = await edge.fetch(new URL('/api/ai/node/live/payments/webhook', node.callback_origin), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-civweave-money-edge-signature': signature },
    body: rawText
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(result.error || `Host rejected paid hosting settlement with HTTP ${response.status}.`), { status: 503 });
  return result;
}

export function sharedDomainHostingReadiness() {
  return Object.freeze({
    schema: SHARED_DOMAIN_HOSTING_SCHEMA,
    sharedDomain: 'civweave.cc',
    freeHostOrigin: 'cloudflare-pages',
    aliasModel: 'paid-hosting-revocable-alias',
    checkoutEnabled: true,
    pricingModel: 'stable-monthly-member-bands',
    free: Object.freeze({ monthlyCents: 0, maxMembers: SHARED_DOMAIN_HOSTING_POLICY.freeMaxMembers, address: 'pages.dev' }),
    standard: Object.freeze({ monthlyCents: 500, billingQuantity: 1, maxMembersBeforeNextBand: 199, hostedMaxMembers: 400, address: '<hub>.civweave.cc' }),
    scale: Object.freeze({ monthlyCents: 1000, billingQuantity: 2, thresholdMembers: 200, maxMembers: 400, address: '<hub>.civweave.cc' }),
    billingTransition: 'member-count-snapshot-before-renewal-no-proration',
    lapseBehavior: 'disable-shared-alias-free-cap-28-grandfather-existing-residents'
  });
}

export async function createSharedDomainHostingCheckout(edge, input, raw, signatureHeader) {
  const nodeId = required(input?.nodeId, 'nodeId', 180);
  const node = await edge.verifyNodeRequest(nodeId, raw, signatureHeader);
  const label = normalizeSharedDomainLabel(nodeId);
  const { pagesOrigin } = await verifyCommunityPagesOrigin(edge, nodeId, input?.pagesOrigin);
  const { memberCount, band } = await fetchHostCapacity(edge, node);
  const existing = await sharedDomainEntitlementByLabel(edge.db, label);
  if (existing && existing.hostId !== nodeId) {
    throw Object.assign(new Error(`The shared Civweave address ${label}.civweave.cc belongs to another host.`), {
      status: 409,
      code: 'SHARED_DOMAIN_LABEL_TAKEN'
    });
  }
  const idempotencyKey = required(input?.idempotencyKey, 'idempotencyKey', 180);
  const successUrl = safePagesReturnUrl(input?.successUrl, pagesOrigin, 'successUrl');
  const cancelUrl = safePagesReturnUrl(input?.cancelUrl, pagesOrigin, 'cancelUrl');
  const stable = (await sha256Hex(`${nodeId}:${label}:${pagesOrigin}:${band.id}:${idempotencyKey}`)).slice(0, 48);
  const meta = {
    civweave_schema: SHARED_DOMAIN_HOSTING_SCHEMA,
    civweave_node_id: nodeId,
    civweave_shared_label: label,
    civweave_pages_origin: pagesOrigin,
    civweave_monthly_cents: String(band.monthlyCents),
    civweave_billing_band: band.id,
    civweave_base_monthly_cents: String(SHARED_DOMAIN_HOSTING_POLICY.standardMonthlyCents),
    civweave_last_member_count: String(memberCount),
    civweave_hosting_max_members: String(SHARED_DOMAIN_HOSTING_POLICY.hostedMaxMembers),
    civweave_scale_threshold_members: String(SHARED_DOMAIN_HOSTING_POLICY.scaleThresholdMembers),
    civweave_host_account_id: clean(node.connected_account_id, 180)
  };
  const form = {
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: nodeId,
    integration_identifier: `civweave_hosting_${lettersFromHex(stable, 8)}`,
    'line_items[0][price_data][currency]': SHARED_DOMAIN_HOSTING_POLICY.currency,
    'line_items[0][price_data][product_data][name]': `Civweave hosted hub · ${label}.civweave.cc`,
    'line_items[0][price_data][recurring][interval]': 'month',
    'line_items[0][price_data][recurring][interval_count]': 1,
    'line_items[0][price_data][unit_amount]': SHARED_DOMAIN_HOSTING_POLICY.standardMonthlyCents,
    'line_items[0][quantity]': band.quantity,
    'subscription_data[description]': `Civweave hub hosting for ${label}.civweave.cc`,
    'subscription_data[billing_mode][type]': 'flexible'
  };
  for (const [key, value] of Object.entries(meta)) {
    form[`metadata[${key}]`] = value;
    form[`subscription_data[metadata][${key}]`] = value;
  }
  const session = await edge.provider.request('/v1/checkout/sessions', {
    form,
    idempotencyKey: `civweave-shared-domain-${stable}`
  });
  return Object.freeze({
    schema: SHARED_DOMAIN_HOSTING_SCHEMA,
    nodeId,
    label,
    pagesOrigin,
    sharedOrigin: sharedDomainForLabel(label),
    memberCount,
    billingBand: band.id,
    monthlyCostShareCents: band.monthlyCents,
    billingQuantity: band.quantity,
    maxMembers: SHARED_DOMAIN_HOSTING_POLICY.hostedMaxMembers,
    checkoutSessionId: session.id,
    checkoutUrl: session.url || null,
    status: 'checkout-pending',
    freeOriginPreserved: true
  });
}

export async function reconcileSharedDomainHostingRenewal(edge, invoice) {
  const meta = subscriptionMetadata(invoice);
  if (meta.civweave_schema !== SHARED_DOMAIN_HOSTING_SCHEMA) return { ignored: true, reason: 'not-shared-domain-hosting-invoice' };
  const nodeId = required(meta.civweave_node_id, 'shared-domain nodeId', 180);
  const node = await edge.node(nodeId);
  if (!node) throw Object.assign(new Error('Hub-hosting node is no longer registered.'), { status: 404 });
  if (meta.civweave_host_account_id !== clean(node.connected_account_id, 180)) {
    throw Object.assign(new Error('Hub-hosting account does not match the registered host.'), { status: 409 });
  }
  const { memberCount, band } = await fetchHostCapacity(edge, node);
  return Object.freeze({ applied: true, schema: SHARED_DOMAIN_HOSTING_SCHEMA, ...(await updateSubscriptionBand(edge, invoice, node, memberCount, band)) });
}

export async function settleSharedDomainHostingInvoice(edge, invoice) {
  const meta = subscriptionMetadata(invoice);
  if (meta.civweave_schema !== SHARED_DOMAIN_HOSTING_SCHEMA) return { ignored: true, reason: 'not-shared-domain-hosting-invoice' };
  if (invoice?.status !== 'paid' && Number(invoice?.amount_paid || 0) < 1) {
    throw Object.assign(new Error('Stripe hub-hosting invoice is not paid.'), { status: 409 });
  }
  const band = hostingBandForMonthlyCents(meta.civweave_monthly_cents);
  if (Number(invoice?.amount_paid || 0) < band.monthlyCents) {
    throw Object.assign(new Error('Stripe hub-hosting invoice does not contain the promised monthly hosting charge.'), { status: 409 });
  }
  const nodeId = required(meta.civweave_node_id, 'shared-domain nodeId', 180);
  const label = normalizeSharedDomainLabel(meta.civweave_shared_label);
  if (label !== normalizeSharedDomainLabel(nodeId)) {
    throw Object.assign(new Error('Shared-domain billing label no longer matches the host identity.'), { status: 409 });
  }
  const pagesOrigin = normalizePagesOrigin(meta.civweave_pages_origin);
  const node = await edge.node(nodeId);
  if (!node) throw Object.assign(new Error('Hub-hosting node is no longer registered.'), { status: 404 });
  if (meta.civweave_host_account_id !== clean(node.connected_account_id, 180)) {
    throw Object.assign(new Error('Hub-hosting account does not match the registered host.'), { status: 409 });
  }
  const invoicePaidThrough = billingPeriodEnd(invoice);
  const existing = await sharedDomainEntitlementByLabel(edge.db, label);
  const paidThrough = existing?.paidThrough && Date.parse(existing.paidThrough) > Date.parse(invoicePaidThrough)
    ? existing.paidThrough
    : invoicePaidThrough;
  const entitlement = await upsertSharedDomainEntitlement(edge.db, {
    label,
    hostId: nodeId,
    pagesOrigin,
    status: 'active',
    source: 'hosting-cost-share',
    paidThrough
  }, edge.now());
  const capacitySettlement = await deliverHostingCapacity(edge, node, invoice, paidThrough, band);
  return Object.freeze({
    applied: true,
    schema: SHARED_DOMAIN_HOSTING_SCHEMA,
    invoiceId: invoice.id,
    subscriptionId: subscriptionId(invoice),
    monthlyCostShareCents: band.monthlyCents,
    billingBand: band.id,
    maxMembers: SHARED_DOMAIN_HOSTING_POLICY.hostedMaxMembers,
    pricingStatus: 'fixed-band-paid-period-honored',
    entitlement,
    capacitySettlement
  });
}
