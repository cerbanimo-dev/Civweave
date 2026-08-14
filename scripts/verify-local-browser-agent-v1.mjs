import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const browser=read('public/app/browser-tool-v1.js');
const agent=read('public/app/local-ai/browser-agent-v1.js');
const edge=read('cloudflare/node-cloud/src/browser-tool-entry-v1.mjs');
const entry=read('cloudflare/node-cloud/src/server-ai-entry-v3.mjs');
const wrangler=read('cloudflare/node-cloud/wrangler.jsonc');
const bootstrap=read('public/app/local-ai/bootstrap-v266.js');
const offline=JSON.parse(read('public/app/offline-package-v208.json'));

assert.match(browser,/registerArchiveProvider\('knowledge-schools',knowledgeSchoolSearch\)/,'Knowledge Schools must remain the default offline archive provider.');
assert.match(browser,/allowNetwork!==true/,'Live browser calls must require explicit network allowance.');
assert.match(browser,/modelInference:'remained on-device'/,'Live-tool disclosure must state that inference stays on-device.');
assert.match(browser,/registerArchiveProvider/,'Archive search must remain pluggable for future web mirrors.');

assert.match(agent,/searchArchive\(querySeed,\{limit:10\}\)/,'The agent must perform archive search before considering live browsing.');
assert.match(agent,/return runtime\.generate\(/,'The browser controller must call the downloaded local runtime directly.');
assert.match(agent,/provider:'downloaded-local\+browser-tools'/,'Results must identify the local-inference plus delegated-tool route.');
assert.match(agent,/query\|\|querySeed\.slice\(0,1200\)/,'Blank live-search queries may only fall back to the bounded current research request.');
assert.doesNotMatch(agent,/api\/ai\/node\/generate|server-auto-v301/,'The local browser agent must not route its reasoning through cloud inference.');

assert.match(edge,/verifyCapacitySession/,'Browser Run must require the existing member capacity session.');
assert.match(edge,/safeUrl/,'Browser Run targets must pass URL safety checks.');
assert.match(edge,/quickAction\(action,payload\)/,'Live research must use the Browser Run binding.');
assert.match(edge,/html\.duckduckgo\.com\/html\/\?q=/,'Live search must send only a bounded query to the search surface.');
assert.match(entry,/\/api\/browser\/tool/,'Node-cloud entry must expose the delegated browser endpoint.');
assert.match(wrangler,/"browser"\s*:\s*\{[\s\S]*"binding"\s*:\s*"BROWSER"/,'Node-cloud must declare the Browser Run binding.');

assert.match(bootstrap,/browser-tool-v1\.js\?v=1\.0\.0/,'Local AI bootstrap must load the browser tool.');
assert.match(bootstrap,/browser-agent-v1\.js\?v=1\.0\.1/,'Local AI bootstrap must load the hardened browser agent.');
assert.equal(offline.assets.includes('/app/browser-tool-v1.js'),true,'Browser tool must be part of the offline core.');
assert.equal(offline.assets.includes('/app/local-ai/browser-agent-v1.js'),true,'Local browser agent must be part of the offline core.');
assert.equal(offline.assets.includes('/app/knowledge-school-runtime-v243.mjs'),true,'Offline archive search runtime must be cached.');

console.log('local-browser-agent-v1 verification passed');
