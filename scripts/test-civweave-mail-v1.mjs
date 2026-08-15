import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = async path => readFile(new URL(path, root), 'utf8');
const must = (condition, message) => { if (!condition) throw new Error(message); };

const [mailConfigText, mailBase, mailPm, mailFeedback, mailTrafficPolicy, mailUi, mailPackageText, accountConfigText, claimSource, claimUi, installer] = await Promise.all([
  read('cloudflare/mail/wrangler.jsonc'),
  read('cloudflare/mail/src/index-v2.mjs'),
  read('cloudflare/mail/src/index-v3.mjs'),
  read('cloudflare/mail/src/index-v4.mjs'),
  read('cloudflare/mail/src/low-traffic-policy.mjs'),
  read('cloudflare/mail/src/ui.mjs'),
  read('cloudflare/mail/package.json'),
  read('cloudflare/account-edge/wrangler.jsonc'),
  read('cloudflare/account-edge/src/recovery-entry-v11.mjs'),
  read('public/app/hub-mail-claim-v1.js'),
  read('public/app/installer-repair-only-v2.js'),
]);
const mailConfig = JSON.parse(mailConfigText);
const mailPackage = JSON.parse(mailPackageText);
const accountConfig = JSON.parse(accountConfigText);

must(mailConfig.name === 'civweave-mail', 'Mail Worker name drifted.');
must(mailConfig.main === 'src/index-v4.mjs', 'Civweave Mail PM + feedback entrypoint is not active.');
must(mailConfig.routes?.some(route => route.pattern === 'mail.civweave.cc' && route.custom_domain === true), 'mail.civweave.cc custom domain is missing.');
must(mailConfig.durable_objects?.bindings?.some(binding => binding.name === 'MAILBOX' && binding.class_name === 'CivweaveMailbox'), 'Mailbox Durable Object binding is missing.');
must(mailConfig.r2_buckets?.some(binding => binding.binding === 'MAIL_BLOBS' && binding.bucket_name === 'civweave-mail-blobs'), 'Private raw-mail R2 binding is missing.');
must(mailConfig.services?.some(binding => binding.binding === 'ACCOUNT_EDGE' && binding.service === 'civweave-host-edge'), 'Hub claim verifier service binding is missing.');
must(!mailConfig.send_email, 'External arbitrary outbound mail must remain disabled until paid Email Sending is intentionally enabled.');
must(mailPackage.dependencies?.['postal-mime'] === '2.7.5', 'postal-mime must remain pinned for deterministic Worker builds.');

for (const token of ["MAIL_SCHEMA = 'civweave.mail.v2'", "'/api/claim'", 'consumeHubClaim', 'env.MAIL_BLOBS.put', 'env.MAIL_BLOBS.delete(rawKey)', 'env.MAILBOX.getByName', "recipientDomain === domain", "External outbound mail is not enabled yet"]) must(mailBase.includes(token), `Base mail service is missing ${token}.`);
must(!mailBase.includes('crypto.subtle.timingSafeEqual'), 'Base mail service uses a nonexistent Web Crypto timingSafeEqual method.');
must(!/passport|stripe/i.test(mailBase), 'Mail runtime must not persist or depend on Passport or Stripe identity.');

for (const localPart of ['weaveling', 'moss', 'kamiya', 'rook', 'merlin']) must(mailPm.includes(`'${localPart}'`), `System mailbox ${localPart}@civweave.cc is missing.`);
for (const token of ['SYSTEM_ACCESS_HASH', 'ensureSystem', '/api/system-mailboxes', '/api/worker-interval', "PM_SUFFIX = '_pm'", "'/api/pm/claim'", "'/api/pm/send'", 'Hidden _pm transport identities cannot use public mail APIs.', 'internal private-messaging transport identity and cannot receive internet email', 'paidMailSeparate: true']) must(mailPm.includes(token), `PM/system mail entrypoint is missing ${token}.`);
must(!mailPm.includes('ByTheTimeIGetToAriz0n4'), 'The shared bootstrap password must never be committed in plaintext.');

for (const token of [
  "FEEDBACK_SCHEMA = 'civweave.feedback-mail-batch.v1'",
  "GITHUB_OIDC_ISSUER = 'https://token.actions.githubusercontent.com'",
  "GITHUB_OIDC_AUDIENCE = 'civweave-feedback-batch'",
  "FEEDBACK_WORKFLOW_PATH = '.github/workflows/daily-feedback-discernment-v1.yml'",
  'verifyGithubOidc',
  'workflow_ref',
  "claims?.ref !== 'refs/heads/main'",
  'FEEDBACK_BATCH_TOKEN',
  "'/api/feedback/batch'",
  "'/api/feedback/ack'",
  'senderIdentityIncluded: false',
  'feedback_batch_state',
]) must(mailFeedback.includes(token), `Feedback mail feed is missing ${token}.`);
for (const token of ['SYSTEM_MAIL_POLL_BACKOFF_MS', 'recommendedWorkerInterval', "return 'low-traffic'", "inboundDelivery: 'event-driven-immediate'"]) must(mailTrafficPolicy.includes(token), `Low-traffic policy is missing ${token}.`);
for (const token of ['Civweave Mail', 'Save this recovery kit now', 'mail.css', 'mail.js']) must(mailUi.includes(token), `Mail client is missing ${token}.`);

must(accountConfig.main === 'src/recovery-entry-v11.mjs', 'Account edge is not deploying one-use identity claim grants.');
for (const token of ['/api/account/mail/claim/request', '/api/account/mail/claim/consume', 'verifyMemberLogin', 'MAIL_CLAIM_TTL_MS', "this.state.storage.delete(key)"]) must(claimSource.includes(token), `Hub identity claim service is missing ${token}.`);
for (const token of ['Private messaging', 'Claim username', 'setupPrivateMessaging', '/api/account/mail/claim/request', 'CivweaveHostNodeSessionExportV1', 'CivweavePrivateMessagingV1', 'not an email address']) must(claimUi.includes(token), `Hub PM setup UI is missing ${token}.`);
must(!claimUi.includes('Claim @civweave.cc address'), 'Free Hub UI still advertises a public email claim.');
must(installer.includes("'/app/hub-mail-claim-v1.js'"), 'Current installer Hub/account tools do not retain the private-messaging setup companion.');
must(installer.includes("hubToolsPolicy:'explicit-user-load-only'"), 'Mail/account companion can boot on installer first paint.');
must(installer.includes('firstPaintHubWork:false'), 'Installer no longer declares Hub/account first-paint work disabled.');

console.log(JSON.stringify({
  ok: true,
  schema: 'civweave.mail.v2',
  domain: 'civweave.cc',
  externalInbound: 'guide-and-paid-mail-only',
  publicFreeMail: false,
  freePrivateMessaging: 'mesh-first-hidden-_pm-relay',
  freeIdentityUi: '@username-only',
  pmExternalSmtp: 'rejected',
  paidMail: 'separate-entitlement-lane',
  guideMailboxes: ['weaveling', 'moss', 'kamiya', 'rook', 'merlin'],
  feedbackBatchFeed: 'github-oidc-authenticated-redacted-sender',
  feedbackStaticToken: 'optional-emergency-fallback',
  lowTraffic: 'event-driven-inbound-plus-adaptive-background-backoff',
  installerHubTools: 'explicit-user-load-only',
}, null, 2));
