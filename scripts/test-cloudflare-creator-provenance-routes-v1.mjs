import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const source=await fs.readFile(new URL('../cloudflare/node-cloud/src/server-ai-entry-v6.mjs',import.meta.url),'utf8');
assert.match(source,/creator-provenance\/receipt/);
assert.match(source,/creator-provenance\/audit\/requests/);
assert.match(source,/creator-provenance\/audit\/evidence/);
assert.match(source,/creator-provenance\/audit\/human\/pending/);
assert.match(source,/creator-provenance\/audit\/human\/finding/);
assert.match(source,/authenticatedMember\(request,env,ctx\)/,'audit request/evidence/reviewer routes must reuse canonical Guild member authentication');
assert.match(source,/memberUserId:member\.userId/,'trusted reviewer/creator identity must be injected from the authenticated Guild session');
assert.doesNotMatch(source,/memberUserId\s*=\s*input\./,'public routes must never trust a caller-supplied Guild member ID');
assert.match(source,/return baseWorker\.fetch\(request,env,ctx\)/,'unrelated node-cloud behavior must still delegate to the canonical worker');
assert.match(source,/enforceRateLimits/,'Creator provenance routes must remain under the existing Guild API rate limiter');
assert.doesNotMatch(source,/rawPacket|creation-packet|ciphertext/,'public provenance routes must proxy structured evidence without interpreting or retaining raw packet content');

console.log('Creator provenance public node-cloud route boundary passed');
