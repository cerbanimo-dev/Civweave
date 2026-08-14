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
const enc = new TextEncoder();
const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);

function required(value, label, max = 4000) {
  const out = clean(value, max);
  if (!out) throw Object.assign(new TypeError(`${label} is required.`), { status: 400 });
  return out;
}

function monthlyCents(env) {
  const value = Number(env?.CIVWEAVE_SHARED_DOMAIN_MONTHLY_CENTS);
  if (!Number.isSafeInteger(value) || value < 1 || value > 100_000) {
    throw Object.assign(new Error('Shared Civweave domain cost-share pricing is not configured.'), {
      status: 503,
      code: 'SHARED_DOMAIN_COST_SHARE_UNCONFIGURED'
    });
  }
  return value;
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

function subscriptionMetadata(invoice) {
  if (invoice?.parent?.type !== 'subscription_details') return {};
  return invoice.parent.subscription_details?.metadata || {};
}

function billingPeriodEnd(invoice) {
  const candidates = [];
  const direct = Number(invoice?.period_end);
  if (Number.isFinite(direct) && direct > 0) candidates.push(direct);
  for (const line of Array.isArray(invoice?.lines?.data) ? invoice.lines.data : []) {
    const end = Number(line?.period?.end);
    if (Number.isFinite(end) && end > 0) candidates.push(end);
  }
  if (!candidates.length) throw Object.assign(new Error('Stripe shared-domain invoice is missing its billing period end.'), { status: 409 });
  return new Date(Math.max(...candidates) * 1000).toISOString();
}

export function sharedDomainHostingReadiness(env = {}) {
  const value = Number(env.CIVWEAVE_SHARED_DOMAIN_MONTHLY_CENTS);
  const configured = Number.isSafeInteger(value) && value >= 1 && value <= 100_000;
  return Object.freeze({
    schema: SHARED_DOMAIN_HOSTING_SCHEMA,
    sharedDomain: 'civweave.cc',
    freeHostOrigin: 'cloudflare-pages',
    aliasModel: 'hosting-cost-share-revocable-alias',
    monthlyCostShareCents: configured ? value : null,
    checkoutEnabled: configured,
    lapseBehavior: 'disable-shared-alias-keep-pages-origin-live'
  });
}

export async function createSharedDomainHostingCheckout(edge, input, raw, signatureHeader) {
  const nodeId = required(input?.nodeId, 'nodeId', 180);
  const node = await edge.verifyNodeRequest(nodeId, raw, signatureHeader);
  const amount = monthlyCents(edge.env);
  const label = normalizeSharedDomainLabel(nodeId);
  const { pagesOrigin } = await verifyCommunityPagesOrigin(edge, nodeId, input?.pagesOrigin);
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
  const stable = (await sha256Hex(`${nodeId}:${label}:${pagesOrigin}:${amount}:${idempotencyKey}`)).slice(0, 48);
  const meta = {
    civweave_schema: SHARED_DOMAIN_HOSTING_SCHEMA,
    civweave_node_id: nodeId,
    civweave_shared_label: label,
    civweave_pages_origin: pagesOrigin,
    civweave_monthly_cents: String(amount),
    civweave_host_account_id: clean(node.connected_account_id, 180)
  };
  const form = {
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: nodeId,
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][product_data][name]': `Civweave shared hub address · ${label}.civweave.cc`,
    'line_items[0][price_data][recurring][interval]': 'month',
    'line_items[0][price_data][recurring][interval_count]': 1,
    'line_items[0][price_data][unit_amount]': amount,
    'line_items[0][quantity]': 1,
    'subscription_data[description]': `Hosting cost share for ${label}.civweave.cc`,
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
    monthlyCostShareCents: amount,
    checkoutSessionId: session.id,
    checkoutUrl: session.url || null,
    status: 'checkout-pending',
    freeOriginPreserved: true
  });
}

export async function settleSharedDomainHostingInvoice(edge, invoice) {
  const meta = subscriptionMetadata(invoice);
  if (meta.civweave_schema !== SHARED_DOMAIN_HOSTING_SCHEMA) return { ignored: true, reason: 'not-shared-domain-hosting-invoice' };
  if (invoice?.status !== 'paid' && Number(invoice?.amount_paid || 0) < 1) {
    throw Object.assign(new Error('Stripe shared-domain hosting invoice is not paid.'), { status: 409 });
  }
  const configuredAmount = monthlyCents(edge.env);
  const billedAmount = Number(meta.civweave_monthly_cents);
  if (!Number.isSafeInteger(billedAmount) || billedAmount < 1 || Number(invoice?.amount_paid || 0) < billedAmount) {
    throw Object.assign(new Error('Stripe shared-domain invoice does not contain the promised hosting cost share.'), { status: 409 });
  }
  if (billedAmount !== configuredAmount) {
    throw Object.assign(new Error('Shared-domain hosting price changed before this invoice settled; manual review is required.'), {
      status: 409,
      code: 'SHARED_DOMAIN_PRICE_CHANGED'
    });
  }
  const nodeId = required(meta.civweave_node_id, 'shared-domain nodeId', 180);
  const label = normalizeSharedDomainLabel(meta.civweave_shared_label);
  if (label !== normalizeSharedDomainLabel(nodeId)) {
    throw Object.assign(new Error('Shared-domain billing label no longer matches the host identity.'), { status: 409 });
  }
  const pagesOrigin = normalizePagesOrigin(meta.civweave_pages_origin);
  const node = await edge.node(nodeId);
  if (!node) throw Object.assign(new Error('Shared-domain hosting node is no longer registered.'), { status: 404 });
  if (meta.civweave_host_account_id !== clean(node.connected_account_id, 180)) {
    throw Object.assign(new Error('Shared-domain billing host account does not match the registered host.'), { status: 409 });
  }
  const invoicePaidThrough = billingPeriodEnd(invoice);
  const existing = await sharedDomainEntitlementByLabel(edge.db, label);
  const existingPaidThrough = existing?.paidThrough && Date.parse(existing.paidThrough) > Date.parse(invoicePaidThrough)
    ? existing.paidThrough
    : invoicePaidThrough;
  const entitlement = await upsertSharedDomainEntitlement(edge.db, {
    label,
    hostId: nodeId,
    pagesOrigin,
    status: 'active',
    source: 'hosting-cost-share',
    paidThrough: existingPaidThrough
  }, edge.now());
  return Object.freeze({
    applied: true,
    schema: SHARED_DOMAIN_HOSTING_SCHEMA,
    invoiceId: invoice.id,
    subscriptionId: invoice?.parent?.subscription_details?.subscription || null,
    monthlyCostShareCents: billedAmount,
    entitlement
  });
}
