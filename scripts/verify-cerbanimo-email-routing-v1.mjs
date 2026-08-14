import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const config = JSON.parse(await readFile(new URL('../cloudflare/mail/aliases.json', import.meta.url), 'utf8'));
const script = await readFile(new URL('./ensure-cerbanimo-email-routing-v1.mjs', import.meta.url), 'utf8');

assert.equal(config.schema, 'cerbanimo.mail-aliases.v1');
assert.equal(config.zone, 'cerbanimo.cc');
assert.equal(config.destination, 'cerbanimo@gmail.com');
assert.ok(config.aliases.some(alias => alias.address === 'kamiya@cerbanimo.cc' && alias.name === 'Kamiya'));
assert.ok(script.includes('/email/routing/addresses'), 'provisioner must manage forwarding destinations');
assert.ok(script.includes('/email/routing/dns'), 'provisioner must ensure Email Routing DNS');
assert.ok(script.includes('/email/routing/rules'), 'provisioner must manage literal forwarding rules');
assert.ok(script.includes("type: 'forward'"), 'provisioner must use Cloudflare forwarding actions');
assert.ok(script.includes('CERBANIMO_MAIL_DESTINATION_UNVERIFIED'), 'unverified destination must fail closed with a clear state');

console.log(JSON.stringify({
  ok: true,
  revision: 'cerbanimo-email-routing-v1',
  zone: config.zone,
  destination: config.destination,
  aliases: config.aliases.map(alias => alias.address),
}, null, 2));
