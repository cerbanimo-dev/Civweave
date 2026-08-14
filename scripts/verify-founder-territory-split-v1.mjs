import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [publicSite, canonicalPages, territoryWorkflow, founderWorkflow, founderHealth] = await Promise.all([
  read('.github/workflows/deploy-cerbanimo-site.yml'),
  read('.github/workflows/deploy-civweave-pages.yml'),
  read('.github/workflows/deploy-new-new-york-territory-host-v1.yml'),
  read('.github/workflows/maintain-founder-source-node-v1.yml'),
  read('scripts/ensure-founder-source-node-v1.mjs')
]);

assert.match(publicSite, /PAGES_PROJECT:\s*cerbanimo-cc/);
assert.match(publicSite, /PUBLIC_DOMAIN:\s*cerbanimo\.cc/);
assert.match(canonicalPages, /--project-name civweave/);
assert.match(canonicalPages, /origin = 'https:\/\/civweave\.cc'/);

assert.match(territoryWorkflow, /NEW_NEW_YORK_CLOUDFLARE_API_TOKEN/);
assert.match(territoryWorkflow, /NEW_NEW_YORK_CLOUDFLARE_ACCOUNT_ID/);
assert.match(territoryWorkflow, /PAGES_PROJECT:\s*civweave-new-new-york/);
assert.match(territoryWorkflow, /CIVWEAVE_HOST_ID:\s*new-new-york/);
assert.match(territoryWorkflow, /TERRITORY_ID:\s*us/);
assert.match(territoryWorkflow, /STEWARD_APPOINTMENT_ID:\s*steward-us-cami-20260814/);
assert.match(territoryWorkflow, /browserTraffic:\s*'pages-only'/);
assert.match(territoryWorkflow, /nodeFabricTraffic:\s*'account-edge-only'/);
assert.match(territoryWorkflow, /founderRootSecretsPresent:\s*false/);
assert.match(territoryWorkflow, /Refuse the founder Cloudflare account by accident/);
assert.match(territoryWorkflow, /new-new-york-a/);
assert.match(territoryWorkflow, /bind-territory-authority:/);
assert.match(territoryWorkflow, /bind-territory-host-authority-v1\.mjs/);

const splitAt = territoryWorkflow.indexOf('\n  bind-territory-authority:');
assert.ok(splitAt > 0, 'Territory workflow must have a distinct root-binding job.');
const territoryJob = territoryWorkflow.slice(0, splitAt);
const rootJob = territoryWorkflow.slice(splitAt);
assert.doesNotMatch(territoryJob, /NODE_FABRIC_BINDING_TOKEN/);
assert.match(rootJob, /NODE_FABRIC_BINDING_TOKEN/);
assert.doesNotMatch(rootJob, /NEW_NEW_YORK_CLOUDFLARE_API_TOKEN|NEW_NEW_YORK_CLOUDFLARE_ACCOUNT_ID/);

assert.match(founderWorkflow, /cron:\s*'17 \*\/6 \* \* \*'/);
assert.match(founderWorkflow, /ensure-founder-source-node-v1\.mjs --repair/);
assert.match(founderWorkflow, /Browser traffic policy: not a public web origin/);
assert.match(founderHealth, /browserTrafficPolicy:\s*'not-a-public-web-origin'/);
assert.match(founderHealth, /machineTrafficPolicy:\s*'node-fabric-and-steward-operations'/);
assert.match(founderHealth, /starterNodeIds\(hostId\)/);
assert.match(founderHealth, /provisionCloudflareAccountEdge\(\{ hostId, strict: true \}\)/);

console.log(JSON.stringify({
  ok: true,
  schema: 'civweave.founder-territory-split.v1',
  checks: [
    'cerbanimo-public-site-remains-pages',
    'canonical-web-remains-pages',
    'new-new-york-uses-separate-cloudflare-credentials',
    'new-new-york-browser-and-node-traffic-separated',
    'territory-job-never-receives-root-binding-token',
    'root-binding-job-never-receives-territory-cloudflare-token',
    'founder-source-node-has-periodic-self-heal',
    'founder-source-node-is-not-a-public-web-origin'
  ]
}, null, 2));
