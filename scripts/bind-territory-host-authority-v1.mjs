#!/usr/bin/env node

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);

function parseArgs(argv) {
  const out = {
    coreUrl: clean(process.env.CIVWEAVE_CORE_URL || 'https://civweave-core.cerbanimo.workers.dev'),
    appointmentId: '', nodeId: '', operatorId: '', callbackUrl: '', maxGrantTtlSeconds: 3600, revoke: ''
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--core-url') out.coreUrl = clean(argv[++i]);
    else if (arg === '--appointment-id') out.appointmentId = clean(argv[++i], 180);
    else if (arg === '--node-id') out.nodeId = clean(argv[++i], 180);
    else if (arg === '--operator-id') out.operatorId = clean(argv[++i], 180);
    else if (arg === '--callback-url') out.callbackUrl = clean(argv[++i]);
    else if (arg === '--max-grant-ttl-seconds') out.maxGrantTtlSeconds = Number(argv[++i]);
    else if (arg === '--revoke') out.revoke = clean(argv[++i], 180);
    else if (arg === '--help' || arg === '-h') {
      console.log(`Civweave root-only Territory Host Authority binding\n\nBind:\n  NODE_FABRIC_BINDING_TOKEN=... node scripts/bind-territory-host-authority-v1.mjs \\\n    --appointment-id steward-us-cami-20260814 \\\n    --node-id <territory-steward-node-id> \\\n    --operator-id <territory-steward-operator-id> \\\n    --callback-url https://<public-node-base>/\n\nRevoke:\n  NODE_FABRIC_BINDING_TOKEN=... node scripts/bind-territory-host-authority-v1.mjs --revoke <authority-id>\n\nThis command is for the canonical root operator only. Never give NODE_FABRIC_BINDING_TOKEN to a Territory Steward or community host.`);
      process.exit(0);
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return out;
}

async function request(coreUrl, pathname, token, body = {}) {
  if (!token || Buffer.byteLength(token) < 32) throw new Error('NODE_FABRIC_BINDING_TOKEN is missing or too short. Run this only from the canonical root operator environment.');
  const core = new URL(coreUrl);
  if (core.protocol !== 'https:') throw new Error('CIVWEAVE_CORE_URL must use HTTPS.');
  const response = await fetch(new URL(pathname, core), {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', 'x-civweave-fabric-token': token },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || payload?.message || `Civweave core returned HTTP ${response.status}.`);
  return payload;
}

const options = parseArgs(process.argv.slice(2));
const rootToken = clean(process.env.NODE_FABRIC_BINDING_TOKEN, 10000);

if (options.revoke) {
  const result = await request(options.coreUrl, `/internal/federation/territory-host-authorities/${encodeURIComponent(options.revoke)}/revoke`, rootToken);
  console.log(JSON.stringify(result, null, 2));
} else {
  for (const [key, value] of Object.entries({ appointmentId: options.appointmentId, nodeId: options.nodeId, operatorId: options.operatorId, callbackUrl: options.callbackUrl })) {
    if (!value) throw new Error(`--${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)} is required.`);
  }
  const result = await request(options.coreUrl, '/internal/federation/territory-host-authorities/bind', rootToken, {
    appointmentId: options.appointmentId,
    nodeId: options.nodeId,
    operatorId: options.operatorId,
    callbackUrl: options.callbackUrl,
    maxGrantTtlSeconds: options.maxGrantTtlSeconds
  });
  console.log(JSON.stringify(result, null, 2));
}
