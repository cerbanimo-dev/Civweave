import fs from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const read=file=>fs.readFile(path.join(root,file),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const [outerHtml,outerCss,parentTheme,mobileFlow,innerHtml,marketplaceCss,marketplaceJs,bridge,legacyShim,embedCss,themedNav,legacyWorker,workerWrapper,workerCore,offlineManifestText,critical]=await Promise.all([
  read('public/app/fellowfare-cabinet-v144.html'),
  read('public/app/fellowfare-cabinet-v144.css'),
  read('public/app/fellowfare-parent-theme-v205.css'),
  read('public/app/fellowfare-mobile-flow-v205.js'),
  read('public/app/services/fellowfare/cabinet.html'),
  read('public/app/services/fellowfare/marketplace-v2.css'),
  read('public/app/services/fellowfare/marketplace-v2.js'),
  read('public/app/services/fellowfare/cabinet-bridge.js'),
  read('public/app/services/fellowfare/app.js'),
  read('public/app/services/fellowfare/cabinet-embed.css'),
  read('public/app/themed-system-nav-v178.js'),
  read('public/service-worker-v156.js'),
  read('public/service-worker-v203.js'),
  read('public/service-worker-core-v208.js'),
  read('public/app/offline-package-v208.json'),
  read('public/service-worker-critical-v199.js')
]);
const offlineManifest=JSON.parse(offlineManifestText);

assert(outerHtml.includes('data-build="fellowfare-parent-market-v2"'),'Outer FellowFare cabinet did not rotate to the live marketplace revision.');
assert(outerHtml.includes('/app/services/fellowfare/cabinet.html?civweave=1&cabinet=1&market=2#market'),'Outer cabinet is not pointing at the live FellowFare marketplace v2.');
assert(outerHtml.indexOf('/app/fellowfare-cabinet-v144.css')<outerHtml.indexOf('/app/fellowfare-parent-theme-v205.css'),'The complete FellowFare parent theme must load after the legacy cabinet stylesheet.');
assert(outerHtml.indexOf('/app/fellowfare-cabinet-v144.js')<outerHtml.indexOf('/app/fellowfare-mobile-flow-v205.js'),'The mobile flow must layer on top of the working FellowFare cabinet runtime.');
for(const token of ['--ffc-parchment-soft: #fff4d8','--ffc-blue: #1e4b64','color: var(--ffc-ink) !important','.ffc144-rook-log .ffc144-rook-message'])assert(outerCss.includes(token),`Outer active Rook contrast is missing ${token}`);

for(const token of [
  '--cwf104-surface:var(--ff205-parchment)',
  'html[data-civweave-system="fellowfare"] .cwf104-head',
  'html[data-civweave-system="fellowfare"] .cwf104-tray',
  'html[data-civweave-system="fellowfare"] .ffc144-header',
  'html[data-civweave-system="fellowfare"] .ch142-control-band',
  'body.ffc144-mobile-flow .ffc144-frame',
  'background:linear-gradient(180deg,rgba(30,75,100,.98),rgba(20,47,63,.99))!important'
])assert(parentTheme.includes(token),`Complete FellowFare parent theme is missing ${token}`);
for(const retired of ['#07131ded','#061019f7','#08151ef5'])assert(!parentTheme.includes(retired),`Civweave default dark chrome leaked into the FellowFare parent override: ${retired}`);

for(const token of [
  "const VERSION='fellowfare-mobile-flow-v205'",
  "const INNER_LAYOUT_SELECTOR='.app-shell,#main,.ff-world-main,.ff-projected-main,.ff-route-scene,.ff-world-projection'",
  'new ResizeObserver(scheduleMeasure)',
  'new MutationObserver(scheduleMeasure)',
  "doc.querySelector('.bottom-nav')",
  "iframe.setAttribute('scrolling','no')",
  "document.body.classList.add('ffc144-mobile-flow')",
  'naturalHeight(doc)'
])assert(mobileFlow.includes(token),`FellowFare mobile single-scroll runtime is missing ${token}`);

assert(innerHtml.indexOf('/app/fellowfare-parchment-type-v266.css')<innerHtml.indexOf('marketplace-v2.css'),'Marketplace v2 styles must load after the shared parchment typography.');
for(const token of [
  'data-fellowfare-renderer="marketplace-v2"',
  '/app/cw-reward-ledger-v2.js',
  '/app/cerbanimo-commerce-distribution-v1.js',
  '/app/civweave-live-data.js',
  'marketplace-v2.js?v=live-market-v2',
  'cabinet-bridge.js?v=marketplace-v2',
  '>Sell<','>Orders<','>Wallet<span'
])assert(innerHtml.includes(token),`Active FellowFare marketplace shell is missing ${token}`);
assert(!innerHtml.includes('src="app.js"'),'The retired FellowFare runtime is still active in the current cabinet.');
for(const token of [
  '--ff-paper:#f7e7bd','--ff-ink:#153849','.ffv2-listing-grid','.ffv2-balance-grid','@media(max-width:640px)'
])assert(marketplaceCss.includes(token),`Marketplace v2 styling is missing ${token}`);
for(const token of [
  "const SCHEMA='fellowfare.marketplace.v2'",
  "const KINDS=['product','service','learning','tutoring','resource','request','collective']",
  "const MONEY_EDGE='https://civweave-core.cerbanimo.workers.dev'",
  "listings:[],orders:[]",
  'No live comparables are loaded for this type. Rook will not invent a market price.',
  'serviceOriginRoyaltyBps:kind===\'service\'?1000:0',
  'splitFeeBps:100'
])assert(marketplaceJs.includes(token),`Marketplace v2 runtime is missing ${token}`);
assert(legacyShim.includes("import './marketplace-v2.js'"),'Old cached FellowFare cabinets do not recover into marketplace v2.');
for(const retired of ['starterState','Friday bread circle','North Country maker room'])assert(!legacyShim.includes(retired),`Legacy FellowFare app shim still contains retired demo state: ${retired}`);
assert(bridge.includes("version:'2.0.0-live-market'"),'Cabinet bridge is not announcing marketplace v2.');
assert(bridge.includes('civweave:exchange-import'),'Reviewed exchange imports no longer reach marketplace v2.');

// Keep the old embed override healthy because already-installed cached cabinet HTML can still reference it during upgrade.
for(const token of [
  'body.ff-cabinet-embedded.ff-cardinal-visual .ff-world-projection h1',
  'body.ff-cabinet-embedded.ff-cardinal-visual .ff-world-projection .hero',
  'background:linear-gradient(150deg,#142f3f,#255a73)!important',
  '.ff-cabinet-embedded #cw-themed-system-nav',
  'html.cw-themed-system-nav-active body.ff-cabinet-embedded{padding-bottom:0!important}'
])assert(embedCss.includes(token),`Legacy upgrade-safe FellowFare embed override is missing ${token}`);

assert(themedNav.includes("const EMBEDDED=window.self!==window.top"),'The realm switcher does not detect iframe embedding.');
assert(themedNav.includes('if(EMBEDDED)'),'The embedded realm switcher suppression path is missing.');
assert(themedNav.includes('target="_top"'),'Realm links can still recurse a cabinet inside its iframe.');
assert(themedNav.includes("glow:'#4f8ca8'"),'FellowFare selected navigation accent is not ink blue.');

assert(legacyWorker.includes("importScripts('/service-worker-v203.js"),'Legacy registrations do not reach the active worker wrapper.');
const cleanIndex=workerWrapper.indexOf("importScripts('/service-worker-living-school-cleanroom-v218.js");
const coreIndex=workerWrapper.indexOf("importScripts('/service-worker-core-v208.js");
const retryIndex=workerWrapper.indexOf("importScripts('/service-worker-offline-v211-override.js");
assert(cleanIndex>=0&&coreIndex>cleanIndex&&retryIndex>coreIndex,'Active worker composition order is incorrect.');
assert(workerCore.includes('discoverReferences')&&workerCore.includes('DOWNLOAD_OFFLINE_PACKAGE'),'Retained offline core no longer discovers or stores dependencies.');
assert(offlineManifest.seeds.includes('/app/fellowfare-cabinet-v144.html'),'Offline campus no longer seeds the active FellowFare parent cabinet.');
assert(offlineManifest.includePrefixes.includes('/app/'),'Offline campus excludes FellowFare app assets.');
for(const token of [
  '/app/fellowfare-cabinet-v144.css',
  '/app/fellowfare-parent-theme-v205.css',
  '/app/fellowfare-mobile-flow-v205.js'
])assert(outerHtml.includes(token),`FellowFare seed cannot discover ${token}`);
assert(outerHtml.includes('/app/services/fellowfare/cabinet.html?civweave=1&cabinet=1&market=2#market'),'FellowFare seed cannot discover its marketplace v2 embed.');

assert(critical.includes("const VERSION='fellowfare-active-v203-parent-mobile-v205-cerbanimo-boundary-v204-memory-bridge-v205'"),'Compatibility coordinator lost the current parent/mobile or memory-bridge revision.');
assert(critical.includes("const CRITICAL_CACHE='cwboot-critical-fellowfare-active-v203-parent-mobile-v205-cerbanimo-boundary-v204-memory-bridge-v205'"),'Compatibility cache identity changed unexpectedly.');
for(const token of [
  '/app/fellowfare-cabinet-v144.html',
  '/app/fellowfare-cabinet-v144.css',
  '/app/fellowfare-parent-theme-v205.css',
  '/app/fellowfare-mobile-flow-v205.js',
  '/app/services/fellowfare/cabinet-embed.css',
  '/app/themed-system-nav-v178.js',
  '/app/weaveling-memory-bridge-v191.js',
  'event.stopImmediatePropagation()',
  'self.CivweaveCriticalBootV205=api'
])assert(critical.includes(token),`Compatibility coordinator is missing ${token}`);

for(const [name,source] of [['marketplace v2',marketplaceJs],['cabinet bridge',bridge],['mobile flow',mobileFlow],['themed navigation',themedNav],['compatibility coordinator',critical],['active worker wrapper',workerWrapper],['retained worker core',workerCore]]){
  try{new Function(source)}catch(error){throw new Error(`${name} has invalid JavaScript: ${error.message}`)}
}
for(const [name,source] of [['outer CSS',outerCss],['parent theme CSS',parentTheme],['marketplace v2 CSS',marketplaceCss],['legacy embed CSS',embedCss]])assert((source.match(/{/g)||[]).length===(source.match(/}/g)||[]).length,`${name} has unbalanced braces.`);

console.log('FellowFare v2 verification passed: the parent cabinet remains responsive and offline-discoverable, the embedded surface is the live marketplace, fresh state is empty, legacy demo state cannot boot, and current product/service/learning/wallet contracts are present.');
