#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const API = 'https://api.cloudflare.com/client/v4';
const configPath = resolve(process.cwd(), process.argv[2] || 'cloudflare/mail/aliases.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const token = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();

if (!token) throw new Error('Missing CLOUDFLARE_API_TOKEN.');
if (!accountId) throw new Error('Missing CLOUDFLARE_ACCOUNT_ID.');
if (config?.schema !== 'cerbanimo.mail-aliases.v1') throw new Error('Unsupported Cerbanimo mail alias schema.');

const zoneName = String(config.zone || '').trim().toLowerCase();
const destination = String(config.destination || '').trim().toLowerCase();
const aliases = Array.isArray(config.aliases) ? config.aliases : [];
if (!/^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(zoneName)) throw new Error(`Invalid zone ${zoneName}.`);
if (!destination.includes('@')) throw new Error('A forwarding destination email is required.');
if (!aliases.length) throw new Error('At least one Cerbanimo alias is required.');

const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

async function request(path, init = {}, { allowFailure = false } = {}) {
  const response = await fetch(`${API}${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if ((!response.ok || payload.success !== true) && !allowFailure) {
    const detail = (payload.errors || []).map(item => `${item.code || ''} ${item.message || ''}`.trim()).join('; ') || `HTTP ${response.status}`;
    throw new Error(`${path}: ${detail}`);
  }
  return { response, payload };
}

async function resolveZone() {
  const lookup = await request(`/zones?name=${encodeURIComponent(zoneName)}&account.id=${encodeURIComponent(accountId)}&status=active&per_page=50`);
  const zones = Array.isArray(lookup.payload.result) ? lookup.payload.result : [];
  const zone = zones.find(item => String(item?.name || '').toLowerCase() === zoneName);
  if (!zone?.id) throw new Error(`Cloudflare account does not expose an active ${zoneName} zone.`);
  return zone.id;
}

async function ensureDestination() {
  const listed = await request(`/accounts/${encodeURIComponent(accountId)}/email/routing/addresses?per_page=100`);
  let address = (Array.isArray(listed.payload.result) ? listed.payload.result : []).find(item => String(item?.email || '').toLowerCase() === destination);
  if (!address) {
    const created = await request(`/accounts/${encodeURIComponent(accountId)}/email/routing/addresses`, {
      method: 'POST',
      body: JSON.stringify({ email: destination }),
    });
    address = created.payload.result;
    console.log(`Created Cloudflare Email Routing destination ${destination}.`);
  }
  if (!address?.verified) {
    const error = new Error(`Destination ${destination} is awaiting Cloudflare verification. Open the verification email in that Gmail account, verify it, then rerun this workflow.`);
    error.code = 'CERBANIMO_MAIL_DESTINATION_UNVERIFIED';
    throw error;
  }
  console.log(`Verified forwarding destination: ${destination}`);
  return address;
}

async function ensureRoutingDns(zoneId) {
  const status = await request(`/zones/${zoneId}/email/routing/dns`, {}, { allowFailure: true });
  const records = Array.isArray(status.payload.result) ? status.payload.result : [];
  const hasRoutingMx = records.some(record => String(record?.type || '').toUpperCase() === 'MX');
  if (status.response.ok && status.payload.success === true && hasRoutingMx) {
    console.log(`Email Routing DNS already present for ${zoneName}.`);
    return;
  }
  const enabled = await request(`/zones/${zoneId}/email/routing/dns`, {
    method: 'POST',
    body: JSON.stringify({ name: zoneName }),
  });
  console.log(`Email Routing DNS enabled for ${zoneName}: ${enabled.payload.result?.status || 'configured'}`);
}

function aliasBody(alias) {
  const address = String(alias.address || '').trim().toLowerCase();
  const name = String(alias.name || address.split('@')[0] || 'Cerbanimo').trim();
  if (!address.endsWith(`@${zoneName}`)) throw new Error(`Alias ${address} must belong to ${zoneName}.`);
  return {
    address,
    body: {
      name: `Cerbanimo · ${name}`,
      enabled: true,
      matchers: [{ type: 'literal', field: 'to', value: address }],
      actions: [{ type: 'forward', value: [destination] }],
    },
  };
}

async function ensureAliases(zoneId) {
  const listed = await request(`/zones/${zoneId}/email/routing/rules?per_page=100`);
  const rules = Array.isArray(listed.payload.result) ? listed.payload.result : [];
  const results = [];
  for (const alias of aliases) {
    const { address, body } = aliasBody(alias);
    const existing = rules.find(rule => (rule.matchers || []).some(matcher => matcher.type === 'literal' && matcher.field === 'to' && String(matcher.value || '').toLowerCase() === address));
    const saved = existing?.id
      ? await request(`/zones/${zoneId}/email/routing/rules/${existing.id}`, { method: 'PUT', body: JSON.stringify(body) })
      : await request(`/zones/${zoneId}/email/routing/rules`, { method: 'POST', body: JSON.stringify(body) });
    const rule = saved.payload.result;
    const forwards = (rule?.actions || []).some(action => action.type === 'forward' && Array.isArray(action.value) && action.value.map(value => String(value).toLowerCase()).includes(destination));
    if (rule?.enabled !== true || !forwards) throw new Error(`Cloudflare did not activate forwarding for ${address}.`);
    console.log(`${address} → ${destination} (${existing?.id ? 'updated' : 'created'})`);
    results.push({ address, destination, ruleId: rule.id || existing?.id || null });
  }
  return results;
}

const zoneId = await resolveZone();
await ensureDestination();
await ensureRoutingDns(zoneId);
const routes = await ensureAliases(zoneId);
console.log(JSON.stringify({ ok: true, schema: config.schema, zone: zoneName, destination, routes }, null, 2));
