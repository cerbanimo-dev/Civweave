#!/usr/bin/env node
import { appendFileSync, writeFileSync } from 'node:fs';

const API = 'https://api.cloudflare.com/client/v4';
const token = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
const explicitZone = String(process.env.CIVWEAVE_RECOVERY_ZONE || '').trim().toLowerCase();
const outputPath = process.argv.includes('--output') ? process.argv[process.argv.indexOf('--output') + 1] : '';
const safeName = name => /(^|[.-])(civweave|cerbanimo)([.-]|$)/i.test(String(name || ''));
const forbidden = new Set(['commonweave.earth']);

function finish(result) {
  const packet = Object.freeze({
    schema: 'civweave.cloudflare-recovery-zone.v1',
    ...result,
    generatedAt: new Date().toISOString(),
  });
  if (outputPath) writeFileSync(outputPath, `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
  if (process.env.GITHUB_ENV) {
    const values = {
      RECOVERY_ZONE_ID: packet.zoneId || '',
      RECOVERY_ZONE: packet.zone || '',
      RECOVERY_ROUTING_DOMAIN: packet.routingDomain || '',
      RECOVERY_MAILBOX: packet.mailbox || '',
      RECOVERY_ZONE_STATUS: packet.status || 'pending',
    };
    appendFileSync(process.env.GITHUB_ENV, Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n') + '\n');
  }
  console.log(JSON.stringify(packet));
  return packet;
}

if (!token || !accountId) {
  finish({ status: 'pending', reason: 'cloudflare-credentials-unavailable', zoneId: null, zone: null, routingDomain: null, mailbox: null });
  process.exit(0);
}

const response = await fetch(`${API}/zones?account.id=${encodeURIComponent(accountId)}&per_page=100`, {
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
});
const payload = await response.json().catch(() => ({}));
if (!response.ok || payload.success !== true) {
  const detail = (payload.errors || []).map(item => item.message || item.code).join('; ') || `HTTP ${response.status}`;
  finish({ status: 'pending', reason: 'zone-list-unavailable', detail, zoneId: null, zone: null, routingDomain: null, mailbox: null });
  process.exit(0);
}

const zones = (Array.isArray(payload.result) ? payload.result : [])
  .filter(zone => zone?.id && zone?.name && zone.status === 'active')
  .map(zone => ({ id: String(zone.id), name: String(zone.name).toLowerCase() }));

let selected = null;
if (explicitZone) {
  if (forbidden.has(explicitZone)) {
    finish({ status: 'blocked', reason: 'forbidden-recovery-zone', zoneId: null, zone: null, routingDomain: null, mailbox: null });
    process.exit(0);
  }
  selected = zones.find(zone => zone.name === explicitZone) || null;
  if (!selected) {
    finish({ status: 'pending', reason: 'configured-zone-not-visible', configuredZone: explicitZone, zoneId: null, zone: null, routingDomain: null, mailbox: null });
    process.exit(0);
  }
} else {
  const candidates = zones.filter(zone => safeName(zone.name) && !forbidden.has(zone.name));
  if (candidates.length !== 1) {
    finish({
      status: 'pending',
      reason: candidates.length ? 'recovery-zone-ambiguous' : 'no-safe-owned-recovery-zone-visible',
      candidates: candidates.map(zone => zone.name),
      zoneId: null,
      zone: null,
      routingDomain: null,
      mailbox: null,
    });
    process.exit(0);
  }
  selected = candidates[0];
}

const routingDomain = `recovery.${selected.name}`;
const mailbox = `recover@${routingDomain}`;
finish({ status: 'ready', reason: 'owned-zone-selected', zoneId: selected.id, zone: selected.name, routingDomain, mailbox });
