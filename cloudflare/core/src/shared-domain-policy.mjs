export const CIVWEAVE_SHARED_DOMAIN = 'civweave.cc';

export const RESERVED_CIVWEAVE_SHARED_LABELS = Object.freeze([
  'www',
  'app',
  'api',
  'hub',
  'node',
  'nodes',
  'docs',
  'status',
  'support',
  'admin',
  'mail',
  'recovery'
]);

const reserved = new Set(RESERVED_CIVWEAVE_SHARED_LABELS);

export function normalizeSharedDomainLabel(value) {
  const label = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 63)
    .replace(/-$/g, '');
  if (!label) throw new TypeError('A Civweave shared-domain label is required.');
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) {
    throw new RangeError('Civweave shared-domain labels must be valid single DNS labels.');
  }
  if (reserved.has(label)) throw new RangeError(`The Civweave shared-domain label "${label}" is reserved.`);
  return label;
}

export function normalizePagesOrigin(value) {
  const url = new URL(String(value ?? '').trim());
  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    throw new RangeError('A shared Civweave domain must point to a credential-free HTTPS Pages origin.');
  }
  if (!url.hostname.endsWith('.pages.dev') || url.hostname.split('.').length !== 3) {
    throw new RangeError('A shared Civweave domain must preserve a Cloudflare Pages project origin as its underlay.');
  }
  return url.origin;
}

export function sharedDomainForLabel(value, domain = CIVWEAVE_SHARED_DOMAIN) {
  const label = normalizeSharedDomainLabel(value);
  const root = String(domain || CIVWEAVE_SHARED_DOMAIN).trim().toLowerCase().replace(/^\.+|\.+$/g, '');
  if (!root || !root.includes('.')) throw new RangeError('Shared-domain root must be a DNS domain.');
  return `https://${label}.${root}`;
}

export function communityHostAddress({ hostId, pagesOrigin, contributionActive = false, sharedLabel = hostId } = {}) {
  const underlayOrigin = normalizePagesOrigin(pagesOrigin);
  const label = normalizeSharedDomainLabel(sharedLabel);
  const sharedOrigin = sharedDomainForLabel(label);
  return Object.freeze({
    schema: 'civweave.community-host-address.v1',
    hostId: String(hostId ?? '').trim(),
    underlayOrigin,
    publicOrigin: contributionActive ? sharedOrigin : underlayOrigin,
    sharedOrigin,
    sharedDomainStatus: contributionActive ? 'active-hosting-cost-share' : 'inactive-free-host',
    freeOriginPreserved: true,
    lapseBehavior: 'disable-shared-alias-keep-pages-origin-live'
  });
}
