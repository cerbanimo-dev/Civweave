#!/usr/bin/env node

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const args = process.argv.slice(2);
const input = {
  territoryId: '',
  hostId: '',
  nodeId: '',
  operatorId: '',
  callbackUrl: ''
};
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--territory-id') input.territoryId = clean(args[++i], 120);
  else if (arg === '--host-id') input.hostId = clean(args[++i], 120);
  else if (arg === '--node-id') input.nodeId = clean(args[++i], 180);
  else if (arg === '--operator-id') input.operatorId = clean(args[++i], 180);
  else if (arg === '--callback-url') input.callbackUrl = clean(args[++i], 4000);
  else if (arg === '--help' || arg === '-h') {
    console.log('Usage: node scripts/admit-root-host-v1.mjs --territory-id <id> --host-id <id> --node-id <id> --operator-id <id> --callback-url <https-url>');
    process.exit(0);
  } else throw new Error(`Unknown argument: ${arg}`);
}
for (const [key, value] of Object.entries(input)) if (!value) throw new Error(`${key} is required.`);
const token = clean(process.env.NODE_FABRIC_BINDING_TOKEN, 10000);
if (!token) throw new Error('NODE_FABRIC_BINDING_TOKEN is required. Run this only from the canonical root operator environment.');
const coreOrigin = new URL(clean(process.env.CIVWEAVE_CORE_URL, 4000) || 'https://civweave-core.cerbanimo.workers.dev').origin;
const response = await fetch(new URL('/internal/federation/host-admissions/root', coreOrigin), {
  method: 'POST',
  headers: {
    accept: 'application/json',
    'content-type': 'application/json',
    'x-civweave-fabric-token': token
  },
  body: JSON.stringify(input)
});
const payload = await response.json().catch(() => ({}));
if (!response.ok) throw new Error(payload?.error || payload?.message || `Root Host admission failed with HTTP ${response.status}.`);
console.log(JSON.stringify(payload, null, 2));
