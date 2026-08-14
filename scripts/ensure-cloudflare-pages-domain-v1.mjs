#!/usr/bin/env node

const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
const apiToken = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();

function clean(value) {
  return String(value ?? '').trim().toLowerCase();
}

function parseArgs(argv) {
  let project = '';
  let domain = '';
  let attempts = 18;
  let intervalMs = 5000;
  let repair = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project') project = clean(argv[++i]);
    else if (arg === '--domain') domain = clean(argv[++i]);
    else if (arg === '--attempts') attempts = Number(argv[++i]);
    else if (arg === '--interval-ms') intervalMs = Number(argv[++i]);
    else if (arg === '--repair') repair = true;
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/ensure-cloudflare-pages-domain-v1.mjs --project civweave --domain civweave.cc [--repair] [--attempts 60] [--interval-ms 15000]');
      process.exit(0);
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!project || !/^[a-z0-9][a-z0-9-]*$/.test(project)) throw new Error('A valid --project is required.');
  if (!domain || !domain.includes('.') || /[:/]/.test(domain)) throw new Error('A valid DNS --domain is required.');
  if (!Number.isSafeInteger(attempts) || attempts < 1 || attempts > 60) throw new Error('--attempts must be an integer from 1 through 60.');
  if (!Number.isSafeInteger(intervalMs) || intervalMs < 250 || intervalMs > 30000) throw new Error('--interval-ms must be an integer from 250 through 30000.');
  return { project, domain, attempts, intervalMs, repair };
}

if (!accountId) throw new Error('Missing CLOUDFLARE_ACCOUNT_ID.');
if (!apiToken) throw new Error('Missing CLOUDFLARE_API_TOKEN.');

const options = parseArgs(process.argv.slice(2));
const pagesOriginHost = `${options.project}.pages.dev`;
const pagesOrigin = `https://${pagesOriginHost}`;
const pagesBase = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/pages/projects/${encodeURIComponent(options.project)}/domains`;
const headers = {
  authorization: `Bearer ${apiToken}`,
  'content-type': 'application/json'
};

function detailFrom(packet, response) {
  if (Array.isArray(packet?.errors) && packet.errors.length) return JSON.stringify(packet.errors);
  return `${response.status} ${response.statusText}`;
}

async function cloudflare(url, init = {}, label = 'Cloudflare API') {
  const response = await fetch(url, { ...init, headers: { ...headers, ...(init.headers || {}) } });
  const packet = await response.json().catch(() => ({}));
  if (!response.ok || packet.success !== true) {
    const detail = detailFrom(packet, response);
    const permissionHint = response.status === 403
      ? ' The deployment token needs Cloudflare Zone Read and DNS Edit in addition to Pages access for automatic cutover repair.'
      : '';
    throw new Error(`${label} failed: ${detail}.${permissionHint}`);
  }
  return packet.result;
}

async function getDomain() {
  const response = await fetch(`${pagesBase}/${encodeURIComponent(options.domain)}`, { headers });
  if (response.status === 404) return null;
  const packet = await response.json().catch(() => ({}));
  if (!response.ok || packet.success !== true) {
    throw new Error(`Cloudflare Pages domain lookup failed: ${detailFrom(packet, response)}`);
  }
  return packet.result || null;
}

function compactStatus(value) {
  if (!value || typeof value !== 'object') return null;
  const out = {};
  for (const key of ['status', 'message', 'error', 'reason', 'method']) {
    const item = value[key];
    if (item !== undefined && item !== null && String(item).trim()) out[key] = String(item).slice(0, 500);
  }
  return Object.keys(out).length ? out : null;
}

async function resolveZone() {
  const query = new URL('https://api.cloudflare.com/client/v4/zones');
  query.searchParams.set('name', options.domain);
  query.searchParams.set('account.id', accountId);
  query.searchParams.set('per_page', '50');
  const rows = await cloudflare(query, {}, 'Cloudflare zone lookup');
  const exact = (Array.isArray(rows) ? rows : []).filter(zone => clean(zone?.name) === options.domain && String(zone?.account?.id || '') === accountId);
  if (exact.length !== 1) throw new Error(`Expected exactly one active ${options.domain} zone in Cloudflare account ${accountId}; found ${exact.length}.`);
  const zone = exact[0];
  if (clean(zone.status) !== 'active') throw new Error(`Cloudflare zone ${options.domain} is not active; current status is ${zone.status || 'unknown'}.`);
  return zone;
}

async function recordsAt(zone, name) {
  const query = new URL(`https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zone.id)}/dns_records`);
  query.searchParams.set('name', name);
  query.searchParams.set('per_page', '100');
  const rows = await cloudflare(query, {}, `Cloudflare DNS lookup for ${name}`);
  return (Array.isArray(rows) ? rows : []).filter(record => clean(record?.name) === clean(name));
}

async function deleteRecord(zone, record) {
  await cloudflare(
    `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zone.id)}/dns_records/${encodeURIComponent(record.id)}`,
    { method: 'DELETE' },
    `Delete stale ${record.type || 'DNS'} record ${record.name || ''}`
  );
}

async function createRecord(zone, record) {
  return cloudflare(
    `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zone.id)}/dns_records`,
    { method: 'POST', body: JSON.stringify(record) },
    `Create ${record.type} record ${record.name}`
  );
}

async function patchRecord(zone, record, patch) {
  return cloudflare(
    `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zone.id)}/dns_records/${encodeURIComponent(record.id)}`,
    { method: 'PATCH', body: JSON.stringify(patch) },
    `Update ${record.type || 'DNS'} record ${record.name || ''}`
  );
}

async function ensureApexDns(zone) {
  const rows = await recordsAt(zone, options.domain);
  const addressRows = rows.filter(record => ['A', 'AAAA', 'CNAME'].includes(String(record?.type || '').toUpperCase()));
  const desired = addressRows.find(record => String(record.type).toUpperCase() === 'CNAME' && clean(record.content).replace(/\.$/, '') === pagesOriginHost);

  if (desired && addressRows.length === 1) {
    if (desired.proxied !== true && options.repair) {
      await patchRecord(zone, desired, { proxied: true });
      console.log(JSON.stringify({ repair: 'apex-proxy-enabled', domain: options.domain, target: pagesOriginHost }));
    }
    return;
  }

  console.log(JSON.stringify({
    diagnostic: 'apex-pages-dns',
    domain: options.domain,
    expected: { type: 'CNAME', content: pagesOriginHost, proxied: true },
    currentAddressRecords: addressRows.map(record => ({ id: record.id, type: record.type, content: record.content, proxied: record.proxied }))
  }));

  if (!options.repair) return;

  for (const record of addressRows) await deleteRecord(zone, record);
  await createRecord(zone, {
    type: 'CNAME',
    name: options.domain,
    content: pagesOriginHost,
    ttl: 1,
    proxied: true,
    comment: 'Canonical Civweave Pages apex; managed by ensure-cloudflare-pages-domain-v1.mjs.'
  });
  console.log(JSON.stringify({ repair: 'apex-pages-cname-created', domain: options.domain, target: pagesOriginHost }));
}

const requiredCaa = Object.freeze([
  { tag: 'issue', value: 'letsencrypt.org' },
  { tag: 'issue', value: 'pki.goog; cansignhttpexchanges=yes' },
  { tag: 'issue', value: 'ssl.com' },
  { tag: 'issuewild', value: 'letsencrypt.org' },
  { tag: 'issuewild', value: 'pki.goog; cansignhttpexchanges=yes' },
  { tag: 'issuewild', value: 'ssl.com' }
]);

async function ensureCertificateAuthorities(zone) {
  const rows = (await recordsAt(zone, options.domain)).filter(record => String(record?.type || '').toUpperCase() === 'CAA');
  if (!rows.length) return;

  const present = new Set(rows.map(record => `${clean(record?.data?.tag || record?.tag)}|${clean(record?.data?.value || record?.value || record?.content)}`));
  const missing = requiredCaa.filter(item => !present.has(`${item.tag}|${clean(item.value)}`));
  if (!missing.length) return;

  console.log(JSON.stringify({
    diagnostic: 'caa-restriction',
    domain: options.domain,
    missing: missing.map(item => `${item.tag}:${item.value}`)
  }));

  if (!options.repair) return;
  for (const item of missing) {
    await createRecord(zone, {
      type: 'CAA',
      name: options.domain,
      ttl: 300,
      data: { flags: 0, tag: item.tag, value: item.value },
      comment: 'Allow Cloudflare Pages certificate issuance.'
    });
  }
  console.log(JSON.stringify({ repair: 'caa-pages-authorities-added', domain: options.domain, count: missing.length }));
}

async function reportPotentialWorkerConflicts(zone) {
  try {
    const routes = await cloudflare(
      `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zone.id)}/workers/routes`,
      {},
      'Cloudflare Worker route lookup'
    );
    const conflicts = (Array.isArray(routes) ? routes : []).filter(route => {
      const pattern = clean(route?.pattern);
      return pattern === `${options.domain}/*` || pattern === `*${options.domain}/*`;
    });
    if (conflicts.length) {
      console.log(JSON.stringify({
        diagnostic: 'possible-http-validation-worker-conflict',
        domain: options.domain,
        routes: conflicts.map(route => ({ id: route.id, pattern: route.pattern, script: route.script || null }))
      }));
    }
  } catch (error) {
    console.log(JSON.stringify({ diagnostic: 'worker-route-check-unavailable', message: String(error?.message || error).slice(0, 800) }));
  }
}

let domain = await getDomain();
if (!domain) {
  console.log(`Attaching ${options.domain} to Cloudflare Pages project ${options.project}...`);
  domain = await cloudflare(pagesBase, {
    method: 'POST',
    body: JSON.stringify({ name: options.domain })
  }, 'Cloudflare Pages domain attachment');
} else {
  console.log(`${options.domain} is already attached to ${options.project} with status ${domain.status || 'unknown'}.`);
}

if (clean(domain?.status) !== 'active') {
  const zone = await resolveZone();
  await ensureApexDns(zone);
  await ensureCertificateAuthorities(zone);
  await reportPotentialWorkerConflicts(zone);
}

for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
  domain = await getDomain();
  const status = clean(domain?.status || 'missing');
  const validationStatus = clean(domain?.validation_data?.status || '');
  const verificationStatus = clean(domain?.verification_data?.status || '');
  console.log(JSON.stringify({
    attempt,
    domain: options.domain,
    project: options.project,
    pagesOrigin,
    status,
    validationStatus: validationStatus || null,
    verificationStatus: verificationStatus || null,
    validation: compactStatus(domain?.validation_data),
    verification: compactStatus(domain?.verification_data)
  }));
  if (status === 'active') {
    console.log(`Cloudflare Pages custom domain active: https://${options.domain}`);
    process.exit(0);
  }
  if (['blocked', 'error', 'deactivated'].includes(status)) {
    throw new Error(`Cloudflare Pages custom domain ${options.domain} entered terminal status ${status}.`);
  }
  if (attempt < options.attempts) await new Promise(resolve => setTimeout(resolve, options.intervalMs));
}

throw new Error(`Cloudflare Pages custom domain ${options.domain} did not become active after ${options.attempts} checks. Review the emitted apex DNS, CAA, Worker-route, validation and verification diagnostics.`);
