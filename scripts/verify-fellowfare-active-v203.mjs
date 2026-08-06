import fs from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const read=file=>fs.readFile(path.join(root,file),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const [outerHtml,outerCss,parentTheme,mobileFlow,innerHtml,embedCss,themedNav,legacyWorker,workerWrapper,workerCore,offlineManifestText,critical]=await Promise.all([
  read('public/app/fellowfare-cabinet-v144.html'),
  read('public/app/fellowfare-cabinet-v144.css'),
  read('public/app/fellowfare-parent-theme-v205.css'),
  read('public/app/fellowfare-mobile-flow-v205.js'),
  read('public/app/services/fellowfare/cabinet.html'),
  read('public/app/services/fellowfare/cabinet-embed.css'),
  read('public/app/themed-system-nav-v178.js'),
  read('public/service-worker-v156.js'),
  read('public/service-worker-v203.js'),
  read('public/service-worker-core-v208.js'),
  read('public/app/offline-package-v208.json'),
  read('public/service-worker-critical-v199.js')
]);
const offlineManifest=JSON.parse(offlineManifestText);

assert(outerHtml.includes('data-build="fellowfare-parent-mobile-v205"'),'Outer FellowFare cabinet did not rotate to the parent/mobile revision.');
assert(outerHtml.includes('/app/services/fellowfare/cabinet.html?commonweave=1&cabinet=1#market'),'Outer cabinet is not pointing at the active embedded FellowFare market.');
assert(outerHtml.indexOf('/app/fellowfare-cabinet-v144.css')<outerHtml.indexOf('/app/fellowfare-parent-theme-v205.css'),'The complete FellowFare parent theme must load after the legacy cabinet stylesheet.');
assert(outerHtml.indexOf('/app/fellowfare-cabinet-v144.js')<outerHtml.indexOf('/app/fellowfare-mobile-flow-v205.js'),'The mobile flow must layer on top of the working FellowFare cabinet runtime.');
for(const token of ['--ffc-parchment-soft: #fff4d8','--ffc-blue: #1e4b64','color: var(--ffc-ink) !important','.ffc144-rook-log .ffc144-rook-message'])assert(outerCss.includes(token),`Outer active Rook contrast is missing ${token}`);

for(const token of [
  '--cwf104-surface:var(--ff205-parchment)',
  'html[data-commonweave-system="fellowfare"] .cwf104-head',
  'html[data-commonweave-system="fellowfare"] .cwf104-tray',
  'html[data-commonweave-system="fellowfare"] .ffc144-header',
  'html[data-commonweave-system="fellowfare"] .ch142-control-band',
  'body.ffc144-mobile-flow .ffc144-frame',
  'background:linear-gradient(180deg,rgba(30,75,100,.98),rgba(20,47,63,.99))!important'
])assert(parentTheme.includes(token),`Complete FellowFare parent theme is missing ${token}`);
for(const retired of ['#07131ded','#061019f7','#08151ef5'])assert(!parentTheme.includes(retired),`Commonweave default dark chrome leaked into the FellowFare parent override: ${retired}`);

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

assert(innerHtml.indexOf('styles.css')<innerHtml.indexOf('cabinet-embed.css'),'Active embed overrides must load after the legacy FellowFare stylesheet.');
for(const token of [
  'body.ff-cabinet-embedded.ff-cardinal-visual .ff-world-projection h1',
  'body.ff-cabinet-embedded.ff-cardinal-visual .ff-world-projection .hero',
  'background:linear-gradient(150deg,#142f3f,#255a73)!important',
  '.ff-cabinet-embedded #cw-themed-system-nav',
  'html.cw-themed-system-nav-active body.ff-cabinet-embedded{padding-bottom:0!important}'
])assert(embedCss.includes(token),`Active embedded FellowFare override is missing ${token}`);
for(const retired of ['#07120e','rgba(4,24,20','.ff-world-projection{position:absolute'])assert(!embedCss.includes(retired),`Legacy cardinal styling leaked into active embed override: ${retired}`);

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
assert(outerHtml.includes('/app/services/fellowfare/cabinet.html?commonweave=1&cabinet=1#market'),'FellowFare seed cannot discover its embedded market.');

assert(critical.includes("const VERSION='fellowfare-active-v203-parent-mobile-v205-cerbanimo-boundary-v204-memory-bridge-v205'"),'Compatibility coordinator lost the FellowFare parent/mobile or memory-bridge revision.');
assert(critical.includes("const CRITICAL_CACHE='cwboot-critical-fellowfare-active-v203-parent-mobile-v205-cerbanimo-boundary-v204-memory-bridge-v205'"),'Compatibility cache did not rotate for the mobile parent and memory bridge.');
for(const token of [
  '/app/fellowfare-cabinet-v144.html',
  '/app/fellowfare-cabinet-v144.css',
  '/app/fellowfare-parent-theme-v205.css',
  '/app/fellowfare-mobile-flow-v205.js',
  '/app/services/fellowfare/cabinet-embed.css',
  '/app/themed-system-nav-v178.js',
  '/app/weaveling-memory-bridge-v191.js',
  'event.stopImmediatePropagation()',
  'self.CommonweaveCriticalBootV205=api'
])assert(critical.includes(token),`Compatibility coordinator is missing ${token}`);

for(const [name,source] of [['mobile flow',mobileFlow],['themed navigation',themedNav],['compatibility coordinator',critical],['active worker wrapper',workerWrapper],['retained worker core',workerCore]]){
  try{new Function(source)}catch(error){throw new Error(`${name} has invalid JavaScript: ${error.message}`)}
}
for(const [name,source] of [['outer CSS',outerCss],['parent theme CSS',parentTheme],['embed CSS',embedCss]])assert((source.match(/{/g)||[]).length===(source.match(/}/g)||[]).length,`${name} has unbalanced braces.`);

console.log('FellowFare v205 verification passed: the full parent cabinet is parchment/amber/ink-blue, embedded platform navigation cannot recurse, phones use one dynamically measured page scroll, and the active cabinet is retained through discovered offline-campus packaging.');
