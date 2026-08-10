import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const [manifestText,bridge,installerHtml,wranglerText]=await Promise.all([
  read('public/app/manifest.webmanifest'),
  read('public/app/pwa-install-prompt-v246.js'),
  read('public/app/index.html'),
  read('wrangler.jsonc')
]);
const manifest=JSON.parse(manifestText);
const wrangler=JSON.parse(wranglerText);
const canonical='https://commonweave.pages.dev/app/manifest.webmanifest';
const render='https://civweave-host-node.onrender.com/app/manifest.webmanifest';
const related=manifest.related_applications||[];
assert.equal(wrangler.name,'civweave','Wrangler project identity must match the Cloudflare project name');
assert.equal(wrangler.pages_build_output_dir,'./.cloudflare-pages','Cloudflare Pages output directory drifted');
assert.ok(related.some(app=>app.platform==='webapp'&&app.url===canonical),'canonical PWA relation is missing');
const renderRelation=related.find(app=>app.platform==='webapp'&&app.url===render);
assert.ok(renderRelation,'Render legacy-PWA relation is missing');
assert.equal(Object.hasOwn(renderRelation,'id'),false,'cross-origin Render relation should use the documented Android webapp URL form without an unnecessary id');
assert.ok(bridge.includes("const COMMIT_VERIFY_TIMEOUT_MS=60000"),'Android install commit needs a bounded finalization window');
assert.ok(bridge.includes('navigator.getInstalledRelatedApps()'),'WebAPK finalization must verify installed-related-app registration');
assert.ok(bridge.includes('waitForCommittedInstall'),'accepted install must have a commit-verification phase');
assert.ok(bridge.includes("button.textContent='Finishing Android install…'")||bridge.includes("setButton(true,'Finishing Android install…')"),'installer must expose the Android finalization phase');
assert.ok(bridge.includes("setButton(false,'Check / retry install')"),'stalled WebAPK minting must surface a retry path');
assert.ok(bridge.includes("location.replace(current.href)"),'retry must reacquire a fresh beforeinstallprompt event');
assert.ok(!bridge.includes("if(choice?.outcome==='accepted'){\n      installed=true;"),'prompt acceptance must not be treated as committed installation');
assert.ok(installerHtml.includes('/app/pwa-install-prompt-v246.js?v=pwa-install-finalize-v282'),'installer HTML must use a fresh cache key for the v282 install bridge');
assert.ok(!installerHtml.includes('/app/pwa-install-prompt-v246.js?v=pwa-install-v246"'),'installer HTML must not keep the stale v246 install-bridge cache key');
new Function(bridge);
console.log(JSON.stringify({ok:true,revision:'pwa-webapk-finalization-v282',canonical,render,cloudflareProject:wrangler.name,commitVerification:true,retry:true,cacheKey:'pwa-install-finalize-v282',syntax:true},null,2));
