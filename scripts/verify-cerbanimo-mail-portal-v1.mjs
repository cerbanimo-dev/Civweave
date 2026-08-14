import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [worker, wrangler, workflow] = await Promise.all([
  read('cloudflare/cerbanimo-mail/src/index.mjs'),
  read('cloudflare/cerbanimo-mail/wrangler.jsonc'),
  read('.github/workflows/deploy-cerbanimo-mail.yml')
]);

const config = JSON.parse(wrangler);
assert.equal(config.name, 'cerbanimo-mail');
assert.equal(config.workers_dev, false);
assert.ok(config.routes?.some(route => route.pattern === 'mail.cerbanimo.cc' && route.custom_domain === true), 'mail.cerbanimo.cc must be a Worker Custom Domain');
assert.ok(worker.includes("const BACKING_GMAIL = 'cerbanimo@gmail.com'"), 'portal must target the Cerbanimo Gmail account');
assert.ok(worker.includes('mail.google.com'), 'portal must hand mailbox access to Gmail');
assert.ok(worker.includes('accounts.google.com/AccountChooser'), 'portal must support a Google-owned account chooser');
assert.ok(!/password|passwd|credential\s*=|authorization\s*=/.test(worker.replaceAll('password or session cookie', '')), 'portal must not implement local credential collection');
assert.ok(worker.includes("'frame-ancestors 'none''") || worker.includes("frame-ancestors 'none'"), 'portal must deny framing');
assert.ok(worker.includes("'referrer-policy': 'no-referrer'"), 'portal must avoid leaking the doorway URL to Google');
assert.ok(workflow.includes('scripts/verify-cerbanimo-mail-portal-v1.mjs'), 'deployment must run the portal verifier');
assert.ok(workflow.includes('https://mail.cerbanimo.cc/api/health'), 'deployment must probe the public custom domain');

console.log(JSON.stringify({
  ok: true,
  schema: 'cerbanimo.mail-portal.v1',
  publicOrigin: 'https://mail.cerbanimo.cc',
  provider: 'gmail',
  backingAccount: 'cerbanimo@gmail.com',
  localPasswordHandling: false
}, null, 2));
