import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const [wranglerText,setup,docs]=await Promise.all([
  readFile(new URL('../wrangler.jsonc',import.meta.url),'utf8'),
  readFile(new URL('./setup-cloudflare-node.mjs',import.meta.url),'utf8'),
  readFile(new URL('../docs/operations/cloudflare-setup.md',import.meta.url),'utf8')
]);
const wrangler=JSON.parse(wranglerText);
assert.equal(wrangler.name,'commonweave','Wrangler must target the existing commonweave Pages project.');
assert.equal(wrangler.pages_build_output_dir,'./.cloudflare-pages','Wrangler Pages output directory drifted.');
assert.match(setup,/process\.argv\[2\]\s*\|\|\s*\n\s*"commonweave";/,'Cloudflare setup helper does not default to the stable commonweave project.');
assert.match(docs,/Pages project: commonweave/,'Cloudflare guide does not name the stable project.');
assert.match(docs,/Stable production URL: https:\/\/commonweave\.pages\.dev/,'Cloudflare guide does not name the stable production origin.');
assert.match(docs,/Do not install Civweave as a PWA from a hashed Pages preview/,'Cloudflare guide does not warn against preview-origin PWA installs.');
assert.doesNotMatch(docs,/Production URL: https:\/\/civweave\.pages\.dev/,'Cloudflare guide still advertises the nonexistent civweave.pages.dev origin as production.');
console.log(JSON.stringify({ok:true,revision:'cloudflare-production-origin-v251',project:'commonweave',production:'https://commonweave.pages.dev',previewInstallSupported:false},null,2));
