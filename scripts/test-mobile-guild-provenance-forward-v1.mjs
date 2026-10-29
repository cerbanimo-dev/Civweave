import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const wrapper=await fs.readFile(new URL('../cloudflare/mobile-guild-edge/src/creator-provenance-entry.mjs',import.meta.url),'utf8');
const config=await fs.readFile(new URL('../cloudflare/mobile-guild-edge/wrangler.jsonc',import.meta.url),'utf8');
const relay=await fs.readFile(new URL('../cloudflare/mobile-guild-edge/src/release-relay-entry.mjs',import.meta.url),'utf8');
assert.match(config,/"main"\s*:\s*"src\/release-relay-entry\.mjs"/,'active deployment must use current release relay wrapper');
assert.match(relay,/from ['"]\.\/creator-provenance-entry\.mjs['"]/,'release relay must import privacy-bounded provenance worker');
assert.match(relay,/return baseWorker\.fetch\(request,env,ctx\)/,'non-release requests must remain delegated to the provenance worker');
assert.match(wrapper,/from ['"]\.\/index\.mjs['"]/,'edge subscriber must delegate to the canonical envelope owner');
assert.doesNotMatch(wrapper,/from ['"]\.\.\//,'standalone edge wrapper must not import outside its deploy directory');
assert.match(wrapper,/civweave\.creation-receipt\.v1/);
assert.match(wrapper,/object\?\.consent!==['"]group['"]/,'only Guild-scoped receipt traffic may be forwarded');
assert.match(wrapper,/\/api\/node\/creator-provenance\/receipt/);
assert.match(wrapper,/if\(receipt&&response\.ok\)/,'receipt forwarding must happen only after canonical edge acceptance');
assert.match(wrapper,/ctx\?\.waitUntil/,'forwarding must not block envelope acceptance');
assert.doesNotMatch(wrapper,/creation-packet|ciphertext|rawPacket|packetHash/,'public edge forwarder must never handle detailed provenance packets');
console.log('Mobile Guild provenance receipt forwarding boundary passed');
