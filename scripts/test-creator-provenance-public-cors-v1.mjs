import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const source=await fs.readFile(new URL('../cloudflare/node-cloud/src/server-ai-entry-v6.mjs',import.meta.url),'utf8');
assert.match(source,/CREATOR_PROVENANCE_ROUTE=['"]\/api\/node\/creator-provenance['"]/);
assert.match(source,/function corsify\(response\)/,'Durable Object responses need an explicit public CORS bridge');
assert.match(source,/return corsify\(response\)/,'provenanceDo must restore CORS on successful/internal Durable Object responses');
assert.match(source,/access-control-allow-origin['"]?:['"]\*['"]/);
assert.match(source,/access-control-allow-headers['"]?:['"]authorization, content-type, x-civweave-node-id['"]/);
assert.match(source,/audit\/appeal/);assert.match(source,/audit\/human\/pending/);assert.match(source,/audit\/human\/finding/);
assert.match(source,/trusted=\{\.\.\.input,memberUserId:member\.userId\}/,'public wrapper must overwrite reviewer/creator member identity with the authenticated Guild session');
assert.doesNotMatch(source,/trusted=\{\.\.\.input,memberUserId:input\./,'client-supplied member IDs must never be authoritative');
console.log('Creator provenance public CORS and authenticated-member bridge contract passed');
