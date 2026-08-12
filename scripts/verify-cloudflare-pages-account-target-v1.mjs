#!/usr/bin/env node

import { readFileSync } from 'node:fs';

const [jsonPath, rawProject] = process.argv.slice(2);
const project = String(rawProject || '').trim().toLowerCase();
if (!jsonPath || !project) {
  console.error('Usage: node scripts/verify-cloudflare-pages-account-target-v1.mjs <deployments.json> <project>');
  process.exit(2);
}

let payload;
try {
  payload = JSON.parse(readFileSync(jsonPath, 'utf8'));
} catch (error) {
  throw new Error(`Could not parse Cloudflare Pages deployment JSON: ${error?.message || error}`);
}

const strings = [];
const visit = value => {
  if (typeof value === 'string') strings.push(value);
  else if (Array.isArray(value)) value.forEach(visit);
  else if (value && typeof value === 'object') Object.values(value).forEach(visit);
};
visit(payload);

const expectedStable = `https://${project}.pages.dev`;
const expectedSuffix = `.${project}.pages.dev`;
const deploymentUrls = strings
  .map(value => value.trim())
  .filter(value => /^https:\/\/[^\s]+\.pages\.dev\/?$/i.test(value));

const matched = deploymentUrls.some(value => {
  const normalized = value.replace(/\/+$/g, '').toLowerCase();
  return normalized === expectedStable || normalized.endsWith(expectedSuffix);
});

if (!matched) {
  const observed = [...new Set(deploymentUrls)].slice(0, 8);
  throw new Error(
    `Cloudflare credentials are not bound to the expected ${project}.pages.dev project. ` +
    `Expected ${expectedStable}; observed Pages deployment URLs: ${observed.length ? observed.join(', ') : '(none)'}. ` +
    'Update CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID to the account that owns the intended project before deploying.',
  );
}

console.log(JSON.stringify({
  ok: true,
  schema: 'civweave.cloudflare-pages-account-affinity.v1',
  project,
  expectedStable,
  matchedDeploymentUrls: [...new Set(deploymentUrls.filter(value => {
    const normalized = value.replace(/\/+$/g, '').toLowerCase();
    return normalized === expectedStable || normalized.endsWith(expectedSuffix);
  }))],
}, null, 2));
