import {
  CIVWEAVE_SHARED_DOMAIN,
  RESERVED_CIVWEAVE_SHARED_LABELS,
  normalizePagesOrigin,
  normalizeSharedDomainLabel
} from '../../core/src/shared-domain-policy.mjs';

const reserved = new Set(RESERVED_CIVWEAVE_SHARED_LABELS);
const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value, null, 2), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...headers
  }
});

function cleanRoot(value) {
  const root = String(value || CIVWEAVE_SHARED_DOMAIN).trim().toLowerCase().replace(/^\.+|\.+$/g, '');
  if (!root || !root.includes('.')) throw new RangeError('Civweave shared-domain root is invalid.');
  return root;
}

export function sharedLabelFromHostname(hostname, rootDomain = CIVWEAVE_SHARED_DOMAIN) {
  const host = String(hostname || '').trim().toLowerCase().replace(/\.$/, '');
  const root = cleanRoot(rootDomain);
  const suffix = `.${root}`;
  if (!host.endsWith(suffix)) return null;
  const prefix = host.slice(0, -suffix.length);
  if (!prefix || prefix.includes('.')) return null;
  try {
    const label = normalizeSharedDomainLabel(prefix);
    return reserved.has(label) ? null : label;
  } catch {
    return null;
  }
}

function parseTime(value) {
  if (!value) return null;
  const time = Date.parse(String(value));
  return Number.isFinite(time) ? time : null;
}

export function sharedDomainEntitlementStatus(row, now = Date.now()) {
  if (!row) return 'missing';
  const status = String(row.entitlement_status || '').trim().toLowerCase();
  if (status === 'suspended' || status === 'inactive') return status;
  if (status === 'active') {
    const paidThrough = parseTime(row.paid_through);
    return paidThrough !== null && now > paidThrough ? 'expired' : 'active';
  }
  if (status === 'grace') {
    const graceUntil = parseTime(row.grace_until);
    return graceUntil !== null && now <= graceUntil ? 'grace' : 'expired';
  }
  return 'inactive';
}

function redirectToUnderlay(requestUrl, upstreamOrigin, label, status) {
  const source = new URL(requestUrl);
  const target = new URL(`${source.pathname}${source.search}`, upstreamOrigin);
  return new Response(null, {
    status: 307,
    headers: {
      location: target.href,
      'cache-control': 'no-store',
      'x-civweave-shared-domain': label,
      'x-civweave-shared-domain-status': status,
      'x-civweave-free-origin-preserved': 'true'
    }
  });
}

function rewriteLocation(headers, upstreamOrigin, publicOrigin) {
  const location = headers.get('location');
  if (!location) return;
  try {
    const target = new URL(location, upstreamOrigin);
    if (target.origin !== upstreamOrigin) return;
    const replacement = new URL(`${target.pathname}${target.search}${target.hash}`, publicOrigin);
    headers.set('location', replacement.href);
  } catch {}
}

async function lookupAlias(env, label) {
  if (!env?.DB) throw new Error('Shared-domain router is missing its D1 binding.');
  return env.DB.prepare(`SELECT label, host_id, pages_origin, entitlement_status, entitlement_source, paid_through, grace_until, updated_at
    FROM shared_domain_aliases WHERE label=?1`).bind(label).first();
}

export async function routeSharedDomainRequest(request, env) {
  const url = new URL(request.url);
  const root = cleanRoot(env?.CIVWEAVE_SHARED_DOMAIN || CIVWEAVE_SHARED_DOMAIN);
  const label = sharedLabelFromHostname(url.hostname, root);
  if (!label) return json({ ok: false, code: 'shared-domain-not-found' }, 404);

  const row = await lookupAlias(env, label);
  if (!row) return json({ ok: false, code: 'shared-domain-not-found' }, 404);

  let upstreamOrigin;
  try {
    upstreamOrigin = normalizePagesOrigin(row.pages_origin);
  } catch {
    return json({ ok: false, code: 'shared-domain-invalid-underlay' }, 502);
  }

  const entitlement = sharedDomainEntitlementStatus(row);
  if (entitlement !== 'active' && entitlement !== 'grace') {
    return redirectToUnderlay(request.url, upstreamOrigin, label, entitlement);
  }

  const upstreamUrl = new URL(`${url.pathname}${url.search}`, upstreamOrigin);
  const upstreamHeaders = new Headers(request.headers);
  upstreamHeaders.delete('host');
  upstreamHeaders.delete('x-forwarded-host');
  upstreamHeaders.delete('x-forwarded-proto');
  upstreamHeaders.set('x-civweave-shared-domain', label);
  upstreamHeaders.set('x-civweave-shared-domain-status', entitlement);

  const upstreamRequest = new Request(upstreamUrl, {
    method: request.method,
    headers: upstreamHeaders,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'manual'
  });
  const upstreamResponse = await fetch(upstreamRequest);
  const responseHeaders = new Headers(upstreamResponse.headers);
  const publicOrigin = `https://${label}.${root}`;
  rewriteLocation(responseHeaders, upstreamOrigin, publicOrigin);
  responseHeaders.set('x-civweave-shared-domain', label);
  responseHeaders.set('x-civweave-shared-domain-status', entitlement);
  responseHeaders.set('x-civweave-free-origin-preserved', 'true');

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders
  });
}

export default {
  fetch(request, env) {
    return routeSharedDomainRequest(request, env);
  }
};
