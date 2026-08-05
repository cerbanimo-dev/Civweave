import fs from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const read=file=>fs.readFile(path.join(root,file),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const [outerHtml,outerCss,innerHtml,embedCss,themedNav,worker,hotfix]=await Promise.all([
  read('public/app/fellowfare-cabinet-v144.html'),
  read('public/app/fellowfare-cabinet-v144.css'),
  read('public/app/services/fellowfare/cabinet.html'),
  read('public/app/services/fellowfare/cabinet-embed.css'),
  read('public/app/themed-system-nav-v178.js'),
  read('public/service-worker-v156.js'),
  read('public/service-worker-fellowfare-active-v203.js')
]);

assert(outerHtml.includes('/app/services/fellowfare/cabinet.html?commonweave=1&cabinet=1#market'),'Outer cabinet is not pointing at the active embedded FellowFare market.');
assert(outerHtml.indexOf('/app/mobile-regression-v170.css')<outerHtml.indexOf('/app/fellowfare-cabinet-v144.css'),'FellowFare cabinet CSS must load after shared platform/mobile CSS.');
for(const token of ['--ffc-parchment-soft:#fff4d8'.replace(':',': '),'--ffc-blue: #1e4b64','color: var(--ffc-ink) !important','.ffc144-rook-log .ffc144-rook-message'])assert(outerCss.includes(token),`Outer active Rook contrast is missing ${token}`);

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

const hotfixImport="importScripts('/service-worker-fellowfare-active-v203.js?v=active-surface-r1')";
assert(worker.includes(hotfixImport),'The active service worker does not import the FellowFare hotfix.');
assert(worker.indexOf(hotfixImport)<worker.indexOf("importScripts('/service-worker-critical-v199.js"),'The FellowFare hotfix must register before legacy cache fetch handlers.');
for(const token of ['/app/fellowfare-cabinet-v144.html','/app/fellowfare-cabinet-v144.css','/app/services/fellowfare/cabinet-embed.css','/app/themed-system-nav-v178.js','event.stopImmediatePropagation()'])assert(hotfix.includes(token),`FellowFare hotfix is missing ${token}`);

for(const [name,source] of [['themed navigation',themedNav],['FellowFare hotfix worker',hotfix],['active service worker',worker]]){
  try{new Function(source)}catch(error){throw new Error(`${name} has invalid JavaScript: ${error.message}`)}
}
for(const [name,source] of [['outer CSS',outerCss],['embed CSS',embedCss]])assert((source.match(/{/g)||[]).length===(source.match(/}/g)||[]).length,`${name} has unbalanced braces.`);

console.log('FellowFare active v203 verification passed: parchment/amber market, dark readable text, ink-blue accent, one top-level realm switcher, and fresh small-package delivery.');
