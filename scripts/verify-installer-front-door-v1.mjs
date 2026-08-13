import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const readBytes=path=>readFile(new URL(`../${path}`,import.meta.url));
const [installerHtml,bridge,brand,logoSvg,hostSetup,anchor,setup,frontDoor]=await Promise.all([
  read('public/app/index.html'),
  read('public/app/pwa-install-prompt-v247.js'),
  read('public/app/civweave-brand.js'),
  read('public/app/logos/civweave.svg'),
  read('public/host-setup.html'),
  read('public/host-local-anchor.html'),
  read('scripts/setup-cloudflare-node.mjs'),
  read('public/app/front-door-prismatic-v301.css')
]);

const entry="/app/installed-entry-v146?installed=1&system=civweave";
const civweavePrismatic='/app/logos/civweave-prismatic-wordmark-v1.png';
const cerbanimoMark='/app/logos/cerbanimo-steward-mark-v1.png';
const frontDoorCss='/app/front-door-prismatic-v301.css';
const canonicalCivweave='/app/logos/civweave-pwa-512-v247.png';
const canonicalCerbanimo='/app/logos/cerbanimo-steward-mark-v1.png?v=white-rgb-v2';
const pngSignature=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);

for(const path of ['public/app/logos/civweave-prismatic-wordmark-v1.png']){
  const bytes=await readBytes(path);
  assert.ok(bytes.subarray(0,8).equals(pngSignature),`${path} must contain real PNG bytes`);
  assert.equal(bytes.subarray(12,16).toString('ascii'),'IHDR',`${path} must contain a PNG IHDR`);
  assert.ok(bytes.readUInt32BE(16)>=512&&bytes.readUInt32BE(20)>=512,`${path} must be at least 512px in both dimensions`);
}
const cerbanimoBytes=await readBytes('public/app/logos/cerbanimo-steward-mark-v1.png');
assert.ok(cerbanimoBytes.subarray(0,8).equals(pngSignature),'Cerbanimo steward mark must contain real PNG bytes');
assert.equal(cerbanimoBytes.subarray(12,16).toString('ascii'),'IHDR','Cerbanimo steward mark must contain a PNG IHDR');
assert.equal(cerbanimoBytes.readUInt32BE(16),192,'Cerbanimo steward mark width must stay at the verified display size');
assert.equal(cerbanimoBytes.readUInt32BE(20),288,'Cerbanimo steward mark height must stay at the verified display size');
assert.equal(cerbanimoBytes.readUInt8(25),2,'Cerbanimo steward mark must stay truecolor RGB, never indexed/paletted');

assert.ok(bridge.includes(`const ENTRY='${entry}'`),'installed Open Civweave button must use updater-first installed entry');
assert.ok(!bridge.includes("const ENTRY='/app/?system=civweave&installed=1'"),'PWA bridge must not route Open Civweave back into the installer');
assert.ok(bridge.includes("const HOST_SETUP_PATH='/host-setup.html'"),'PWA bridge must have a dedicated steward setup destination');
assert.ok(bridge.includes("current.searchParams.get('host_setup')!=='1'"),'legacy /app/?host_setup=1 links must redirect out of the app boundary');
assert.ok(installerHtml.includes('/app/pwa-install-prompt-v247.js'),'installer must load the cache-distinct PWA front-door bridge');
assert.ok(!installerHtml.includes('/app/pwa-install-prompt-v246.js?v=pwa-install-v246'),'installer must not boot the cache-colliding legacy bridge');
assert.ok(installerHtml.includes('<img src="/app/logos/civweave-pwa-192-v247.png" alt="Civweave">'),'installer header must keep the verified PNG compatibility mark directly');
assert.ok(installerHtml.includes('<link rel="icon" href="/app/logos/civweave-pwa-192-v247.png" type="image/png">'),'installer favicon must use the verified PNG directly');
assert.ok(hostSetup.includes(`${entry}&source=host-setup`),'host setup must enter Civweave through installed entry');
assert.ok(hostSetup.includes('/host-local-anchor.html'),'host setup must expose local Anchor setup');
assert.ok(hostSetup.includes('CONNECT STEWARD PAYOUTS'),'host setup must include connected payout onboarding for the steward');
assert.ok(hostSetup.includes('http://127.0.0.1:8787/app/node-ai-operator-v1.html#liveCommerce'),'host setup must route payout connection through the local operator console');
assert.ok(anchor.includes('5. Connect steward payouts'),'local Anchor setup must continue into Stripe connected-account onboarding');
assert.ok(hostSetup.includes("localStorage.setItem(STEWARD_KEY,'1')"),'host setup must mark the current browser as steward');
assert.ok(anchor.includes('href="/host-setup.html"'),'Anchor setup must return to dedicated steward setup');
assert.ok(setup.includes('Steward setup: ${productionUrl}/host-setup.html'),'Cloudflare host provisioning must print the dedicated steward setup URL');
assert.ok(brand.includes("const CANONICAL_LOGO='/app/logos/civweave-pwa-512-v247.png'"),'brand layer must use the verified Civweave PNG');
assert.ok(logoSvg.includes('/app/logos/civweave-pwa-512-v247.png'),'SVG compatibility wrapper must not reference the malformed canonical display PNG');

for(const [name,source] of [['installer',installerHtml],['host steward',hostSetup],['local Anchor',anchor]]){
  assert.ok(source.includes(civweavePrismatic),`${name} must retain the legacy Civweave compatibility path`);
  assert.ok(source.includes(cerbanimoMark),`${name} must retain the legacy Cerbanimo compatibility path`);
  assert.ok(source.includes(frontDoorCss),`${name} must load the shared prismatic front-door design`);
  assert.ok(source.includes('cw-frontdoor'),`${name} must opt into the shared front-door surface`);
}
assert.ok(installerHtml.includes('cw-installer'),'installer must use the installer-specific prismatic layout');
assert.ok(hostSetup.includes('cw-steward'),'host setup must use the steward-specific prismatic layout');
assert.ok(anchor.includes('cw-anchor'),'Anchor setup must use the Anchor-specific prismatic layout');
assert.ok(frontDoor.includes('--fd-pink:#ff69c8'),'front-door design must retain the pink convergence lane');
assert.ok(frontDoor.includes('--fd-cyan:#6fddff'),'front-door design must retain the cyan convergence lane');
assert.ok(frontDoor.includes('--fd-gold:#ffc96d'),'front-door design must retain the gold convergence lane');
assert.ok(frontDoor.includes('--fd-violet:#9b72ff'),'front-door design must retain the violet convergence lane');
assert.ok(frontDoor.includes('.cw-brand-lockup'),'front-door design must keep the shared dual-brand lockup');
assert.ok(frontDoor.includes('body.cw-installer'),'front-door design must cover the installer');
assert.ok(frontDoor.includes('body.cw-steward'),'front-door design must cover host stewardship');
assert.ok(frontDoor.includes('body.cw-anchor'),'front-door design must cover local Anchor setup');
assert.ok(frontDoor.includes('@media(prefers-reduced-motion:reduce)'),'front-door ambient motion must respect reduced-motion preferences');
assert.ok(frontDoor.includes(canonicalCivweave),'front-door display must bypass the damaged v1 Civweave raster and use the verified canonical logo');
assert.ok(frontDoor.includes(canonicalCerbanimo),'front-door display must use the verified white-background truecolor Cerbanimo steward mark');
assert.ok(frontDoor.includes('.cw-platform-logo,.cw-steward-logo{display:none!important}'),'damaged compatibility rasters must not be rendered directly');
assert.ok(frontDoor.includes("background:#fff url('/app/logos/cerbanimo-steward-mark-v1.png?v=white-rgb-v2')"),'Cerbanimo steward mark must render its verified RGB asset on an opaque white field');

console.log(JSON.stringify({
  ok:true,
  revision:'installer-front-door-v5-cerbanimo-white-rgb',
  installedEntry:entry,
  hostSetup:'/host-setup.html',
  launcher:'/app/pwa-install-prompt-v247.js',
  compatibilityLogo:'/app/logos/civweave-pwa-512-v247.png',
  civweavePrismatic,
  cerbanimoMark,
  canonicalCivweave,
  canonicalCerbanimo,
  frontDoorCss
},null,2));
