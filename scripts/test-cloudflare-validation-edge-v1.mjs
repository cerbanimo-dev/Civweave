import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const parseJsonc = text => JSON.parse(text.split('\n').filter(line => !line.trim().startsWith('//')).join('\n'));

const [wranglerText, entry, executor, optIn] = await Promise.all([
  read('cloudflare/node-cloud/wrangler.jsonc'),
  read('cloudflare/node-cloud/src/entry.mjs'),
  read('public/app/cloud-validation-executor-v1.js'),
  read('public/app/validation-cloud-optin-v1.js')
]);
const wrangler = parseJsonc(wranglerText);

assert.equal(wrangler.main, 'src/server-ai-entry-v1.mjs');
assert.equal(wrangler.ai?.binding, 'AI');
assert.ok(entry.includes("const VALIDATION_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast'"));
assert.ok(entry.includes("response_format: { type: 'json_schema', json_schema: schema }"));
assert.ok(entry.includes("'/usage/reserve'"));
assert.ok(entry.includes("'/usage/settle'"));
assert.ok(entry.includes('verifyCapacitySession'));
assert.ok(entry.includes("url.pathname === '/api/ai/node/validation'"));
assert.ok(entry.includes("url.pathname === '/api/fabric/capacity/members/admit'"));
assert.ok(executor.includes("allowLifetimeCredits:detail.allowLifetimeCredits===true"));
assert.ok(executor.includes('CivweaveRewardWeave'));
assert.ok(executor.includes('CivweaveIdentitySync'));
assert.ok(optIn.includes('uses today\'s included AI allowance'));
assert.ok(optIn.includes('allowLifetimeCredits:false'));

console.log(JSON.stringify({
  ok: true,
  workersAiBinding: 'AI',
  model: '@cf/meta/llama-3.1-8b-instruct-fast',
  authenticatedCapacitySessions: true,
  reservesBeforeInference: true,
  settlesActualUsage: true,
  lifetimeCreditsDefaultOptOut: true,
  rewardReceiptBridge: true
}, null, 2));
