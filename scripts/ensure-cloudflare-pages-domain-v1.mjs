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
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project') project = clean(argv[++i]);
    else if (arg === '--domain') domain = clean(argv[++i]);
    else if (arg === '--attempts') attempts = Number(argv[++i]);
    else if (arg === '--interval-ms') intervalMs = Number(argv[++i]);
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/ensure-cloudflare-pages-domain-v1.mjs --project civweave --domain civweave.cc');
      process.exit(0);
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!project || !/^[a-z0-9][a-z0-9-]*$/.test(project)) throw new Error('A valid --project is required.');
  if (!domain || !domain.includes('.') || /[:/]/.test(domain)) throw new Error('A valid DNS --domain is required.');
  if (!Number.isSafeInteger(attempts) || attempts < 1 || attempts > 60) throw new Error('--attempts must be an integer from 1 through 60.');
  if (!Number.isSafeInteger(intervalMs) || intervalMs < 250 || intervalMs > 30000) throw new Error('--interval-ms must be an integer from 250 through 30000.');
  return { project, domain, attempts, intervalMs };
}

if (!accountId) throw new Error('Missing CLOUDFLARE_ACCOUNT_ID.');
if (!apiToken) throw new Error('Missing CLOUDFLARE_API_TOKEN.');

const options = parseArgs(process.argv.slice(2));
const base = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/pages/projects/${encodeURIComponent(options.project)}/domains`;
const headers = {
  authorization: `Bearer ${apiToken}`,
  'content-type': 'application/json'
};

async function api(url, init = {}) {
  const response = await fetch(url, { ...init, headers: { ...headers, ...(init.headers || {}) } });
  const packet = await response.json().catch(() => ({}));
  if (!response.ok || packet.success !== true) {
    const detail = Array.isArray(packet.errors) && packet.errors.length ? JSON.stringify(packet.errors) : `${response.status} ${response.statusText}`;
    throw new Error(`Cloudflare Pages domain API failed: ${detail}`);
  }
  return packet.result;
}

async function getDomain() {
  const response = await fetch(`${base}/${encodeURIComponent(options.domain)}`, { headers });
  if (response.status === 404) return null;
  const packet = await response.json().catch(() => ({}));
  if (!response.ok || packet.success !== true) {
    const detail = Array.isArray(packet.errors) && packet.errors.length ? JSON.stringify(packet.errors) : `${response.status} ${response.statusText}`;
    throw new Error(`Cloudflare Pages domain lookup failed: ${detail}`);
  }
  return packet.result || null;
}

let domain = await getDomain();
if (!domain) {
  console.log(`Attaching ${options.domain} to Cloudflare Pages project ${options.project}...`);
  domain = await api(base, {
    method: 'POST',
    body: JSON.stringify({ name: options.domain })
  });
} else {
  console.log(`${options.domain} is already attached to ${options.project} with status ${domain.status || 'unknown'}.`);
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
    status,
    validationStatus: validationStatus || null,
    verificationStatus: verificationStatus || null
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

throw new Error(`Cloudflare Pages custom domain ${options.domain} did not become active after ${options.attempts} checks.`);
