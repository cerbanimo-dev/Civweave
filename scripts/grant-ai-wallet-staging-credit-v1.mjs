import crypto from 'node:crypto';
const args = process.argv.slice(2);
const option = name => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : '';
};
const baseUrl = String(option('url') || process.env.AI_WALLET_STAGING_URL || '').replace(/\/$/, '');
const stagingSecret = String(process.env.AI_WALLET_STAGING_SECRET || '');
const userId = String(option('user') || '');
const amountCents = Number(option('cents') || 200);
const planId = String(option('plan') || 'thread');
const sourceId = String(option('source') || `staging:cli-credit:${crypto.randomUUID()}`);

if (!baseUrl) throw new Error('Provide --url or AI_WALLET_STAGING_URL.');
if (Buffer.byteLength(stagingSecret) < 32) throw new Error('AI_WALLET_STAGING_SECRET must contain at least 32 bytes.');
if (!userId.startsWith('staging:')) throw new Error('Provide --user with a staging: user ID.');
if (!Number.isSafeInteger(amountCents) || amountCents < 1 || amountCents > 10000) throw new Error('--cents must be an integer between 1 and 10000.');

const response = await fetch(`${baseUrl}/api/ai/staging/credits`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-commonweave-staging-key': stagingSecret
  },
  body: JSON.stringify({ userId, amountCents, planId, sourceId, note: 'CLI staging credit' })
});
const body = await response.json().catch(() => ({}));
if (!response.ok) throw new Error(body.error || `Staging credit failed with ${response.status}.`);
console.log(JSON.stringify(body, null, 2));
