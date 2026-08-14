import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = async path => readFile(new URL(path, root), 'utf8');
const must = (condition, message) => { if (!condition) throw new Error(message); };

const [mailConfigText, mailSource, mailSystemSource, mailTrafficPolicy, mailUi, mailPackageText, accountConfigText, claimSource, claimUi, installer] = await Promise.all([
  read('cloudflare/mail/wrangler.jsonc'),
  read('cloudflare/mail/src/index-v2.mjs'),
  read('cloudflare/mail/src/index-v3.mjs'),
  read('cloudflare/mail/src/low-traffic-policy.mjs'),
  read('cloudflare/mail/src/ui.mjs'),
  read('cloudflare/mail/package.json'),
  read('cloudflare/account-edge/wrangler.jsonc'),
  read('cloudflare/account-edge/src/recovery-entry-v11.mjs'),
  read('public/app/hub-mail-claim-v1.js'),
  read('public/app/installer-online-fallback-v225.js'),
]);
const mailConfig = JSON.parse(mailConfigText);
const mailPackage = JSON.parse(mailPackageText);
const accountConfig = JSON.parse(accountConfigText);

must(mailConfig.name === 'civweave-mail', 'Mail Worker name drifted.');
must(mailConfig.main === 'src/index-v3.mjs', 'Civweave Mail system-mail entrypoint is not active.');
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
  'env.MAIL_BLOBS.delete(rawKey)',
  'env.MAILBOX.getByName',
  "recipientDomain === domain",
  "External outbound mail is not enabled yet",
  'new EmailMessage',
]) must(mailSource.includes(token), `Base mail service is missing ${token}.`);
must(!mailSource.includes('crypto.subtle.timingSafeEqual'), 'Base mail service uses a nonexistent Web Crypto timingSafeEqual method.');
must(!/passport|stripe/i.test(mailSource), 'Mail runtime must not persist or depend on Passport or Stripe identity.');

for (const localPart of ['weaveling', 'moss', 'kamiya', 'rook', 'merlin']) {
  must(mailSystemSource.includes(`'${localPart}'`), `System mailbox ${localPart}@civweave.cc is missing.`);
}
for (const token of [
  'SYSTEM_ACCESS_HASH',
  'ensureSystem',
  '/api/system-mailboxes',
  '/api/worker-interval',
  'That address belongs to a Civweave system guide.',
]) must(mailSystemSource.includes(token), `System mail entrypoint is missing ${token}.`);
must(!mailSystemSource.includes('ByTheTimeIGetToAriz0n4'), 'The shared bootstrap password must never be committed in plaintext.');
for (const token of [
  'SYSTEM_MAIL_POLL_BACKOFF_MS',
  'recommendedWorkerInterval',
  "return 'low-traffic'",
  "inboundDelivery: 'event-driven-immediate'",
]) must(mailTrafficPolicy.includes(token), `Low-traffic policy is missing ${token}.`);

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
for (const token of [
  'Claim @civweave.cc address',
  '/api/account/mail/claim/request',
  'CivweaveHostNodeSessionExportV1',
  "url.hostname!=='mail.civweave.cc'",
]) must(claimUi.includes(token), `Hub mail claim UI is missing ${token}.`);
must(installer.includes("'/app/hub-mail-claim-v1.js'"), 'Installer does not load the Hub mail claim companion.');

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
  hubClaim: 'authenticated-one-use-grant',
  systemMailboxes: ['weaveling', 'moss', 'kamiya', 'rook', 'merlin'],
  systemCredential: 'shared-bootstrap-password-hash-only',
  lowTraffic: 'event-driven-inbound-plus-adaptive-background-backoff',
  failedSendCleanup: 'raw-r2-delete-before-error',
}, null, 2));
