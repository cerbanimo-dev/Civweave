import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = async path => readFile(new URL(path, root), 'utf8');
const must = (condition, message) => { if (!condition) throw new Error(message); };

const [mail, client, architecture, feedback] = await Promise.all([
  read('cloudflare/mail/src/index-v3.mjs'),
  read('public/app/civweave-private-messaging-v1.js'),
  read('docs/architecture/private-messaging-mail-relay-v1.md'),
  read('docs/architecture/feedback-discernment-pipeline-v1.md'),
]);

for (const token of [
  "PM_SUFFIX = '_pm'",
  "message.setReject('This Civweave address is an internal private-messaging transport identity",
  "'/api/pm/claim'",
  "'/api/pm/send'",
  "'/api/pm/inbox'",
  'paidMailSeparate: true',
  'Hidden _pm transport identities cannot use public mail APIs.',
  'Public @civweave.cc mailboxes are not part of the free messaging identity.',
  'ECDH-P256+HKDF-SHA256+AES-256-GCM',
]) must(mail.includes(token), `Mail relay is missing ${token}`);

for (const token of [
  "KIND='civweave.pm.envelope.v1'",
  "MESH_KIND='civweave.private-message-envelope.v1'",
  "MAIL_ORIGIN='https://mail.civweave.cc'",
  "crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'}",
  "AES-GCM",
  "HKDF",
  "CivweaveLocalMeshV146",
  "pendingOnline:true",
  "source:'relay'",
  'publishMesh(envelope)',
  'acceptEnvelope(envelope',
]) must(client.includes(token), `Private messaging client is missing ${token}`);

must(!/riverfox_pm@civweave\.cc.*public email/i.test(architecture), 'Architecture must not treat hidden PM slots as public email.');
for (const token of ['offline first', 'hidden `_pm`', 'external internet email', 'same `civweave.pm.envelope.v1` object']) {
  must(architecture.toLowerCase().includes(token.toLowerCase()), `Architecture document is missing ${token}`);
}
for (const token of ['Default window: 12 hours.', '`dev` integration branch', 'never merges itself from `dev` to `main`', 'Email intake is evidence, not authority.']) {
  must(feedback.includes(token), `Feedback pipeline is missing ${token}`);
}

console.log(JSON.stringify({
  ok: true,
  privateMessaging: 'mesh-first-encrypted-envelope',
  onlineRelay: 'hidden-username_pm',
  externalMailToPm: 'rejected',
  publicPaidMail: 'separate-entitlement-lane',
  feedbackIntake: 'guide-mail-only',
  feedbackVetoWindowHours: 12,
  automatedMergeTarget: 'dev',
  automatedMainPromotion: false,
}, null, 2));
