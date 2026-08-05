import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFileSync(path.join(root,relative),'utf8');
const bytes=relative=>readFileSync(path.join(root,relative)).byteLength;
const assert=(value,message)=>{if(!value)throw new Error(message)};

const worker=read('public/service-worker-critical-v199.js');
const shell=read('public/app/cabinets/living-school/index.html');
const nav=read('public/app/themed-system-nav-v178.js');
const bootstrap=read('public/app/cabinets/living-school/living-school-bootstrap-v194.js');
const visual=read('public/app/cabinets/living-school/living-school-visual-shell-v202.js');
const enhancements=read('public/app/cabinets/living-school/living-school-enhancements-v202.js');
const relay=read('public/app/cabinets/living-school/living-school-two-agent-relay-v165.js');
const guard=read('public/app/cabinets/living-school/living-school-mutation-guard-v196.js');
const workbench=read('public/app/cabinets/living-school/living-school-workbench-v158.js');
const installer=read('public/install-v130.js');
const pwa=read('public/app/pwa-v130.js');

assert(worker.includes("VERSION='living-school-image-runtime-v202'"),'The v202 critical worker revision is not active.');
assert(worker.includes('BASE_EXPECTED_FILES=111'),'The 111-file core package boundary changed unexpectedly.');
assert(worker.includes('EXTENSION_EXPECTED_FILES=53'),'The 53-file shared package boundary changed unexpectedly.');
assert(worker.includes('runCapturedInstallListeners(event)'),'Incomplete packages no longer replay the complete installers.');

const criticalList=worker.slice(worker.indexOf('const CRITICAL_FILES=['),worker.indexOf('const CRITICAL_PATHS='));
for(const pathname of [
  '/app/assets/navigation/200-commonweave-nav.webp',
  '/app/assets/navigation/200-cerbanimo-nav.webp',
  '/app/assets/navigation/200-living-school-nav.webp',
  '/app/assets/navigation/200-fellowfare-nav.webp',
  '/app/assets/navigation/200-anarchadia-nav.webp',
  '/app/assets/living-school/home.webp',
  '/app/assets/living-school/forge.webp',
  '/app/assets/living-school/library.webp',
  '/app/assets/living-school/moss.webp',
  '/app/assets/living-school/workshop.webp'
])assert(criticalList.includes(pathname),`Critical image package omits ${pathname}.`);

assert((nav.match(/200-[a-z-]+-nav\.webp/g)||[]).length===5,'The shared family navigation does not reference all five image buttons.');
assert(nav.includes('grid-template-columns:repeat(5'),'The family navigation is not mounted as five equal button slots.');
assert(shell.includes('id="ls-world-art"'),'The Living School shell does not render an image before JavaScript boot.');
assert(shell.includes('/app/assets/living-school/home.webp'),'The first illustrated room is not requested during HTML parsing.');
assert(shell.includes('living-school-enhancements-v202.js'),'The optional enhancers are not isolated behind the core engine.');
assert(!shell.includes('living-school-two-agent-relay-v165.js?v='),'The relay still boots directly before the core engine is ready.');
assert(shell.includes('<nav class="ls-tray" aria-label="Living School navigation" hidden>'),'The legacy Living School text tray can still occupy the bottom edge.');

assert(bootstrap.includes('firstVisualPaint()'),'The learning engine no longer waits for an initial illustrated paint.');
assert(bootstrap.includes('await frame();await frame();'),'The initial image and family buttons do not receive two paint frames before module import.');
assert(enhancements.indexOf('living-school-mutation-guard-v196.js')<enhancements.indexOf('living-school-two-agent-relay-v165.js'),'The mutation guard must load before the relay observer.');
assert(enhancements.includes("document.addEventListener('commonweave:living-school-ready',start"),'Enhancers no longer wait for the core ready event.');
assert(guard.includes("callback?.name==='queuePatch'"),'The reader mutation guard no longer recognizes the relay observer.');
assert(relay.includes("action==='lesson'?openLesson(module,state):openAssessment(module,state)"),'Open full lesson is no longer intercepted into the lesson dialog.');
assert(workbench.includes("if(action==='lesson')openNative('lesson',0)"),'The workbench no longer routes the lesson action through the cabinet.');
assert(installer.includes('living-school-image-runtime-v202'),'The installer does not request the v202 image package.');
assert(installer.includes('critical.navigationImages!==5'),'The installer does not verify all five family button images.');
assert(pwa.includes('living-school-image-runtime-v202'),'The installed app does not request the v202 image package.');

for(const file of ['home.webp','forge.webp','library.webp','moss.webp','workshop.webp']){
  assert(bytes(`public/app/assets/living-school/${file}`)>200000,`Restored Living School scene ${file} is missing or is only a placeholder.`);
}

console.log(JSON.stringify({
  ok:true,
  repair:'living-school-image-runtime-v202',
  coreBoundary:111,
  sharedBoundary:53,
  navigationImageCount:5,
  packagedSceneImageCount:5,
  firstPaintBeforeEngine:true,
  optionalEnhancersAfterCore:true,
  legacyTrayHidden:true,
},null,2));
