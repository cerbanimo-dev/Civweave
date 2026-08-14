#!/usr/bin/env node

const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
const apiToken = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();

function parseArgs(argv) {
  let zoneName = 'civweave.cc';
  let target = '192.0.2.0';
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--zone') zoneName = String(argv[++i] || '').trim().toLowerCase();
    else if (arg === '--target') target = String(argv[++i] || '').trim();
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/ensure-cloudflare-shared-domain-dns-v1.mjs [--zone civweave.cc] [--target 192.0.2.0]');
      process.exit(0);
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!zoneName || !zoneName.includes('.') || /[:/]/.test(zoneName)) throw new Error('A valid --zone is required.');
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(target)) throw new Error('--target must be an IPv4 address.');
  return { zoneName, target };
}

if (!accountId) throw new Error('Missing CLOUDFLARE_ACCOUNT_ID.');
if (!apiToken) throw new Error('Missing CLOUDFLARE_API_TOKEN.');

const options = parseArgs(process.argv.slice(2));
const headers = {
  authorization: `Bearer ${apiToken}`,
  'content-type': 'application/json'
};

async function cloudflare(url, init = {}) {
  const response = await fetch(url, { ...init, headers: { ...headers, ...(init.headers || {}) } });
  const packet = await response.json().catch(() => ({}));
  if (!response.ok || packet.success !== true) {
    const detail = Array.isArray(packet.errors) && packet.errors.length ? JSON.stringify(packet.errors) : `${response.status} ${response.statusText}`;
    throw new Error(`Cloudflare API failed: ${detail}`);
  }
  return packet.result;
}

const zoneQuery = new URL('https://api.cloudflare.com/client/v4/zones');
zoneQuery.searchParams.set('name', options.zoneName);
zoneQuery.searchParams.set('account.id', accountId);
zoneQuery.searchParams.set('per_page', '50');
const zones = await cloudflare(zoneQuery);
const exact = (Array.isArray(zones) ? zones : []).filter(zone => String(zone?.name || '').toLowerCase() === options.zoneName && String(zone?.account?.id || '') === accountId);
if (exact.length !== 1) throw new Error(`Expected exactly one ${options.zoneName} zone in Cloudflare account ${accountId}; found ${exact.length}.`);
const zone = exact[0];
if (zone.status !== 'active') throw new Error(`Cloudflare zone ${options.zoneName} is not active; current status is ${zone.status || 'unknown'}.`);

const wildcardName = `*.${options.zoneName}`;
const recordsQuery = new URL(`https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zone.id)}/dns_records`);
recordsQuery.searchParams.set('name', wildcardName);
recordsQuery.searchParams.set('per_page', '100');
const records = await cloudflare(recordsQuery);
const exactRecords = (Array.isArray(records) ? records : []).filter(record => String(record?.name || '').toLowerCase() === wildcardName);

if (exactRecords.length > 1) {
  throw new Error(`Refusing to modify ${wildcardName}: multiple DNS records already exist at the wildcard name.`);
}

if (exactRecords.length === 1) {
  const record = exactRecords[0];
  if (record.type !== 'A' || String(record.content || '') !== options.target) {
    throw new Error(`Refusing to overwrite existing ${wildcardName} ${record.type || 'unknown'} record. Expected A ${options.target}.`);
  }
  if (record.proxied === true) {
    console.log(JSON.stringify({ ok: true, zone: options.zoneName, wildcard: wildcardName, recordId: record.id, status: 'already-ready', proxied: true }));
    process.exit(0);
  }
  const updated = await cloudflare(`https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zone.id)}/dns_records/${encodeURIComponent(record.id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ proxied: true })
  });
  console.log(JSON.stringify({ ok: true, zone: options.zoneName, wildcard: wildcardName, recordId: updated.id, status: 'proxy-enabled', proxied: updated.proxied }));
  process.exit(0);
}

const created = await cloudflare(`https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zone.id)}/dns_records`, {
  method: 'POST',
  body: JSON.stringify({
    type: 'A',
    name: wildcardName,
    content: options.target,
    ttl: 1,
    proxied: true,
    comment: 'Civweave shared hub aliases; traffic is terminated by civweave-domain-router.'
  })
});
console.log(JSON.stringify({ ok: true, zone: options.zoneName, wildcard: wildcardName, recordId: created.id, status: 'created', proxied: created.proxied }));
