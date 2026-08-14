import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = async path => readFile(new URL(path, root), 'utf8');
const must = (condition, message) => { if (!condition) throw new Error(message); };

const [mailConfigText, mailSource, mailUi, mailPackageText, accountConfigText, claimSource] = await Promise.all([
  read('cloudflare/mail/wrangler.jsonc'),
  read('cloudflare/mail/src/index-v2.mjs'),
  read('cloudflare/mail/src/ui.mjs'),
  read('cloudflare/mail/package.json'),
  read('cloudflare/account-edge/wrangler.jsonc'),
  read('cloudflare/account-edge/src/recovery-entry-v11.mjs'),
]);
const mailConfig = JSON.parse(mailConfigText);
const mailPackage = JSON.parse(mailPackageText);
const accountConfig = JSON.parse(accountConfigText);

must(mailConfig.name === 'civweave-mail', 'Mail Worker name drifted.');
must(mailConfig.main === 'src/index-v2.mjs', 'Civweave Mail v2 is not the active entrypoint.');
must(mailConfig.routes?.some(route => route.pattern === 'mail.civweave.cc' && route.custom_domain === true), 'mail.civweave.cc custom domain is missing.');
must(mailConfig.durable_objects?.bindings?.some(binding => binding.name === 'MAILBOX' && binding.class_name === 'CivweaveMailbox'), 'Mailbox Durable Object binding is missing.');
must(mailConfig.r2_buckets?.some(binding => binding.binding === 'MAIL_BLOBS' && binding.bucket_name === 'civweave-mail-blobs'), 'Private raw-mail R2 binding is missing.');
must(mailConfig.services?.some(binding => binding.binding === 'ACCOUNT_EDGE' && binding.service === 'civweave-host-edge'), 'Hub claim verifier service binding is missing.');
must(!mailConfig.send_email, 'External arbitrary outbound mail must remain explicitly disabled until Email Sending is onboarded and funded.');
must(mailPackage.dependencies?.['postal-mime'] === '2.7.5', 'postal-mime must remain pinned for deterministic Worker builds.');

for (const token of [
  "MAIL_SCHEMA = 'civweave.mail.v2'",
  "'/api/claim'",
  'consumeHubClaim',
  'env.MAIL_BLOBS.put',
  'env.MAILBOX.getByName',
  "recipientDomain === domain",
  "External outbound mail is not enabled yet",
  'new EmailMessage',
]) must(mailSource.includes(token), `Active mail service is missing ${token}.`);
must(!mailSource.includes('crypto.subtle.timingSafeEqual'), 'Active mail service uses a nonexistent Web Crypto timingSafeEqual method.');
must(!/passport|stripe/i.test(mailSource), 'Mail runtime must not persist or depend on Passport or Stripe identity.');
for (const token of ['Civweave Mail', 'Save this recovery kit now', 'mail.css', 'mail.js']) must(mailUi.includes(token), `Mail client is missing ${token}.`);

must(accountConfig.main === 'src/recovery-entry-v11.mjs', 'Account edge is not deploying mail claim grants.');
for (const token of [
  '/api/account/mail/claim/request',
  '/api/account/mail/claim/consume',
  'verifyMemberLogin',
  'MAIL_CLAIM_TTL_MS',
  "this.state.storage.delete(key)",
]) must(claimSource.includes(token), `Hub mail claim service is missing ${token}.`);
must(claimSource.includes("claimUrl: `https://mail.civweave.cc/#claim="), 'Hub does not return the first-party mail claim URL.');

console.log(JSON.stringify({
  ok: true,
  schema: 'civweave.mail.v2',
  domain: 'civweave.cc',
  web: 'https://mail.civweave.cc',
  internalDelivery: 'free-first-party',
  externalInbound: 'email-routing',
  externalOutbound: 'disabled-until-paid-email-sending',
  rawStorage: 'private-r2',
  mailboxIdentity: 'separate-from-hub-passport-payment',
}, null, 2));
