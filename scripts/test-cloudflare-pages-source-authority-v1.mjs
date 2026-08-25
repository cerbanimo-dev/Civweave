import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const build=await readFile(new URL('scripts/build-cloudflare-pages.mjs',root),'utf8');

assert.ok(!/await\s+import\(['"]\.\/sync-release-version-assets\.mjs['"]\)/.test(build),'Cloudflare Pages must not run the retired release-version mutator on production builds.');
assert.ok(!/await\s+import\(['"]\.\/sync-release-coherence-v220\.mjs['"]\)/.test(build),'Cloudflare Pages must not run the retired single-shell coherence mutator on production builds.');
assert.ok(!/const\s+stagingBuild\s*=/.test(build),'Pages source authority must not diverge by branch: staging and production package the checked-in source graph the same way.');
assert.ok(build.includes('Pages source is authoritative'),'Cloudflare Pages build must document that checked-in source, not legacy release mutators, owns the deployed graph.');

console.log(JSON.stringify({ok:true,policy:'pages-checked-in-source-authoritative-v1',legacyReleaseMutators:false,branchSpecificMutation:false},null,2));
