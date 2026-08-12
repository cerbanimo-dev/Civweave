import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [installerHtml,bridge,brand,logoSvg,hostSetup,anchor,setup]=await Promise.all([
  read('public/app/index.html'),
  read('public/app/pwa-install-prompt-v247.js'),
  read('public/app/civweave-brand.js'),
  read('public/app/logos/civweave.svg'),
  read('public/host-setup.html'),
  read('public/host-local-anchor.html'),
  read('scripts/setup-cloudflare-node.mjs')
]);

const entry="/app/installed-entry-v146?installed=1&system=civweave";
assert.ok(bridge.includes(`const ENTRY='${entry}'`),'installed Open Civweave button must use updater-first installed entry');
assert.ok(!bridge.includes("const ENTRY='/app/?system=civweave&installed=1'"),'PWA bridge must not route Open Civweave back into the installer');
assert.ok(bridge.includes("const HOST_SETUP_PATH='/host-setup.html'"),'PWA bridge must have a dedicated steward setup destination');
assert.ok(bridge.includes("current.searchParams.get('host_setup')!=='1'"),'legacy /app/?host_setup=1 links must redirect out of the app boundary');
assert.ok(installerHtml.includes('/app/pwa-install-prompt-v247.js'),'installer must load the cache-distinct PWA front-door bridge');
assert.ok(!installerHtml.includes('/app/pwa-install-prompt-v246.js?v=pwa-install-v246'),'installer must not boot the cache-colliding legacy bridge');
assert.ok(installerHtml.includes('<img src="/app/logos/civweave-pwa-192-v247.png" alt="Civweave">'),'installer header must use the verified PNG directly');
assert.ok(installerHtml.includes('<link rel="icon" href="/app/logos/civweave-pwa-192-v247.png" type="image/png">'),'installer favicon must use the verified PNG directly');
assert.ok(hostSetup.includes(`${entry}&source=host-setup`),'host setup must enter Civweave through installed entry');
assert.ok(hostSetup.includes('/host-local-anchor.html'),'host setup must expose local Anchor setup');
assert.ok(hostSetup.includes("localStorage.setItem(STEWARD_KEY,'1')"),'host setup must mark the current browser as steward');
assert.ok(anchor.includes('href="/host-setup.html"'),'Anchor setup must return to dedicated steward setup');
assert.ok(setup.includes('Steward setup: ${productionUrl}/host-setup.html'),'Cloudflare host provisioning must print the dedicated steward setup URL');
assert.ok(brand.includes("const CANONICAL_LOGO='/app/logos/civweave-pwa-512-v247.png'"),'brand layer must use the verified Civweave PNG');
assert.ok(logoSvg.includes('/app/logos/civweave-pwa-512-v247.png'),'SVG compatibility wrapper must not reference the malformed canonical display PNG');

console.log(JSON.stringify({ok:true,revision:'installer-front-door-v2-cache-distinct',installedEntry:entry,hostSetup:'/host-setup.html',launcher:'/app/pwa-install-prompt-v247.js',logo:'/app/logos/civweave-pwa-512-v247.png'},null,2));
