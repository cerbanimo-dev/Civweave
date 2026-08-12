import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const [wranglerText,setup,docs,topology,manifest,reminder,canonicalWorkflow,hostWorkflow]=await Promise.all([
  readFile(new URL('../wrangler.jsonc',import.meta.url),'utf8'),
  readFile(new URL('./setup-cloudflare-node.mjs',import.meta.url),'utf8'),
  readFile(new URL('../docs/operations/cloudflare-setup.md',import.meta.url),'utf8'),
  readFile(new URL('../config/launch-topology-v1.json',import.meta.url),'utf8'),
  readFile(new URL('../public/app/manifest.webmanifest',import.meta.url),'utf8'),
  readFile(new URL('../public/app/host-steward-reminder-v1.js',import.meta.url),'utf8'),
  readFile(new URL('../.github/workflows/deploy-civweave-pages.yml',import.meta.url),'utf8'),
  readFile(new URL('../.github/workflows/deploy-civweave-host-pages.yml',import.meta.url),'utf8')
]);
const wrangler=JSON.parse(wranglerText);
const launch=JSON.parse(topology);
const webmanifest=JSON.parse(manifest);
assert.equal(wrangler.name,'civweave','Wrangler must reserve the civweave Pages project for the canonical root.');
assert.equal(wrangler.pages_build_output_dir,'./.cloudflare-pages','Wrangler Pages output directory drifted.');
assert.equal(launch.canonicalInstallOrigin,'https://civweave.pages.dev','Launch topology must use civweave.pages.dev as the canonical root.');
assert.equal(launch.backbone.staticProject,'civweave','Launch topology must reserve the civweave Pages project.');
assert.match(setup,/canonicalProjectName = "civweave"/,'Cloudflare setup helper does not reserve the civweave project.');
assert.match(setup,/CIVWEAVE_EXPECT_CLOUDFLARE_EMAIL/,'Canonical setup is missing the private account guard.');
assert.match(setup,/--host-id/,'Cloudflare setup helper does not expose community host IDs.');
assert.match(setup,/host-deployment-v1\.json/,'Cloudflare setup helper does not stamp host deployment metadata.');
assert.match(setup,/function projectAlreadyExists\(output\)/,'Cloudflare setup helper cannot recognize an existing Pages project after a retry.');
assert.match(setup,/8000002/,'Cloudflare setup helper does not recognize Cloudflare Pages already-exists error code 8000002.');
assert.match(setup,/allowFailure: true/,'Cloudflare setup helper cannot recover from an eventually-consistent project-list miss.');
assert.match(setup,/Continuing with the existing project/,'Cloudflare setup helper does not explicitly resume an existing Pages project.');
assert.match(setup,/Initial hosting is complete; GitHub authorization is intentionally not a launch-time requirement/,'Community host setup does not preserve non-blocking first deployment.');
assert.match(setup,/CIVWEAVE_PAGES_PROJECT=/,'Community host setup does not print its automatic-update project variable.');
assert.match(docs,/Canonical production URL: https:\/\/civweave\.pages\.dev/,'Cloudflare guide does not name the canonical production origin.');
assert.match(docs,/node scripts\/setup-cloudflare-node\.mjs --host-id garden/,'Cloudflare guide does not document clone-and-Wrangler community host creation.');
assert.match(docs,/Do not install from preview\/branch aliases/,'Cloudflare guide does not warn against preview-origin PWA installs.');
assert.match(docs,/Automatic host updates without blocking installation/,'Cloudflare guide does not explain the non-blocking update handoff.');
assert.match(canonicalWorkflow,/--project-name civweave/,'Canonical Pages workflow does not deploy the reserved project.');
assert.match(canonicalWorkflow,/push:/,'Canonical Pages workflow is not triggered by GitHub pushes.');
assert.match(canonicalWorkflow,/api\.cloudflare\.com\/client\/v4\/accounts\//,'Canonical Pages workflow does not validate the exact Cloudflare project.');
assert.match(canonicalWorkflow,/const project = 'civweave'/,'Canonical Pages workflow credential check is not pinned to the OG project.');
assert.doesNotMatch(canonicalWorkflow,/wrangler whoami/,'Canonical Pages workflow must support account-scoped Pages tokens.');
assert.match(canonicalWorkflow,/Provision optional account Worker and starter nodes[\s\S]*continue-on-error: true/,'Optional account-edge provisioning can still block the canonical Pages host.');
assert.doesNotMatch(canonicalWorkflow,/Canonical Cloudflare account edge is not fully provisioned/,'Canonical host metadata still requires optional account-edge provisioning.');
assert.match(docs,/broader permission is not required for the Pages host/,'Cloudflare guide does not preserve Pages-only installation.');
assert.match(canonicalWorkflow,/Verify stable production origin/,'Canonical workflow does not verify the stable hostname after deployment.');
assert.match(canonicalWorkflow,/https:\/\/civweave\.pages\.dev/,'Canonical workflow does not poll the stable production origin.');
assert.match(canonicalWorkflow,/marker\.sourceCommit === expectedCommit/,'Canonical workflow does not prove the deployed commit reached production.');
assert.match(docs,/green workflow therefore proves the canonical hostname updated/,'Cloudflare guide does not explain the stable-origin proof.');
assert.match(hostWorkflow,/CIVWEAVE_PAGES_PROJECT/,'Community Pages workflow does not use a steward-owned project variable.');
assert.match(hostWorkflow,/vars\.CIVWEAVE_PAGES_PROJECT != 'civweave'/,'Community Pages workflow does not protect the canonical root.');
assert.match(hostWorkflow,/api\.cloudflare\.com\/client\/v4\/accounts\//,'Community Pages workflow does not validate its exact Cloudflare project.');
assert.match(hostWorkflow,/const project = process\.env\.CIVWEAVE_PAGES_PROJECT/,'Community Pages workflow credential check does not use its configured project.');
assert.doesNotMatch(hostWorkflow,/wrangler whoami/,'Community Pages workflow must support account-scoped Pages tokens.');
assert.match(docs,/specifically for the OG `civweave\.pages\.dev` host/,'Cloudflare guide does not distinguish OG credentials from community host credentials.');
assert.match(reminder,/civweave\.host-anchor\.paired\.v1/,'Host steward reminder does not persist Anchor completion.');
assert.match(reminder,/Remind me tomorrow/,'Host steward reminder is not persistent-but-snoozable.');
assert.equal(webmanifest.related_applications[0]?.url,'https://civweave.pages.dev/app/manifest.webmanifest','Manifest must prefer the new canonical root.');
console.log(JSON.stringify({ok:true,revision:'cloudflare-production-origin-v257-stable-origin-proof',project:'civweave',production:'https://civweave.pages.dev',communityPattern:'https://<project>.pages.dev',previewInstallSupported:false,localAnchorReminder:true,idempotentProjectCreate:true,automaticCanonicalUpdates:true,nonBlockingCommunityAutomation:true},null,2));
