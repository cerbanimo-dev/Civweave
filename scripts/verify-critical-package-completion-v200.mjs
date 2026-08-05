import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFileSync(path.join(root,relative),'utf8');
const assert=(value,message)=>{if(!value)throw new Error(message)};

const critical=read('public/service-worker-critical-v199.js');
const imageWorker=read('public/service-worker-shared-images-v203.js');
const wrapper=read('public/service-worker-v203.js');
const shell=read('public/app/cabinets/living-school/index.html');
const bootstrap=read('public/app/cabinets/living-school/living-school-bootstrap-v194.js');
const loader=read('public/app/cabinets/living-school/living-school-flat-loader-v203.js');
const engine=read('public/app/cabinets/living-school/living-school-cabinet-v151.mjs');
const nav=read('public/app/themed-system-nav-v178.js');
const relay=read('public/app/cabinets/living-school/living-school-two-agent-relay-v165.js');
const guard=read('public/app/cabinets/living-school/living-school-mutation-guard-v196.js');
const workbench=read('public/app/cabinets/living-school/living-school-workbench-v158.js');
const installer=read('public/install-v130.js');
const pwa=read('public/app/pwa-v130.js');

for(const [name,source] of [['critical worker',critical],['shared image worker',imageWorker],['worker wrapper',wrapper],['flat bootstrap',bootstrap],['flat loader',loader],['installer',installer],['pwa',pwa]]){
  try{new Function(source)}catch(error){throw new Error(`${name} does not parse: ${error.message}`)}
}

const combinedRevision='fellowfare-active-v203-parent-mobile-v205-cerbanimo-boundary-v204-memory-bridge-v205';
assert(critical.includes(`VERSION='${combinedRevision}'`),'The combined FellowFare mobile, Cerbanimo, and memory bridge critical core is not active.');
assert(critical.includes(`CRITICAL_CACHE='cwboot-critical-${combinedRevision}'`),'The combined critical cache is not active.');
assert(critical.includes('BASE_EXPECTED_FILES=111'),'The 111-file core package boundary changed unexpectedly.');
assert(critical.includes('EXTENSION_EXPECTED_FILES=53'),'The 53-file shared package boundary changed unexpectedly.');
assert(critical.includes('runCaptured(event)'),'Incomplete packages no longer replay the complete installers.');
assert(critical.includes("mode:'flat'"),'Critical status no longer identifies the flat interface.');
assert(critical.includes('self.CommonweaveCriticalBootV205=api'),'The combined critical API alias is missing.');

const essential=[
  '/app/assets/ai/moss-acorn.png',
  '/app/assets/ai/weaveling-compass.png',
  '/app/assets/navigation/200-commonweave-nav.webp',
  '/app/assets/navigation/200-cerbanimo-nav.webp',
  '/app/assets/navigation/200-living-school-nav.webp',
  '/app/assets/navigation/200-fellowfare-nav.webp',
  '/app/assets/navigation/200-anarchadia-nav.webp'
];
for(const pathname of essential){
  assert(imageWorker.includes(pathname),`Dedicated image worker omits ${pathname}.`);
  assert(critical.includes(pathname),`Legacy worker repair path omits ${pathname}.`);
  assert(shell.includes(pathname),`Living School does not request ${pathname} during initial parsing.`);
}
for(const pathname of [
  '/app/fast-interactive-runtime-v192.js',
  '/app/weaveling-memory-bridge-v191.js',
  '/app/fellowfare-cabinet-v144.html',
  '/app/fellowfare-cabinet-v144.css',
  '/app/fellowfare-parent-theme-v205.css',
  '/app/fellowfare-mobile-flow-v205.js',
  '/app/services/fellowfare/cabinet-embed.css',
  '/app/realm-console-v140.html',
  '/app/cerbanimo-deterministic-boundary-v203.js'
])assert(critical.includes(pathname),`Combined critical refresh omits ${pathname}.`);
assert(imageWorker.includes("event.stopImmediatePropagation()"),'Shared images are not protected from the generic /app fetch route.');
assert(imageWorker.includes("type:'COMMONWEAVE_SHARED_IMAGE_STATUS'"),'Shared image readiness is not inspectable.');
assert(wrapper.indexOf('service-worker-shared-images-v203.js')<wrapper.indexOf('service-worker-v156.js'),'The image repair lane must register before the generic package worker.');
assert(wrapper.includes('flat-living-school-v203-memory-bridge-v205'),'The v203 wrapper does not refresh the changed inner worker.');

assert((nav.match(/200-[a-z-]+-nav\.webp/g)||[]).length===5,'The shared family navigation does not reference all five image buttons.');
assert(nav.includes('grid-template-columns:repeat(5'),'The family navigation is not mounted as five equal slots.');
assert(shell.includes('<nav class="ls-tray" aria-label="Living School navigation" hidden>'),'The legacy Living School text tray can still occupy the bottom edge.');
assert(shell.includes('living-school-flat-loader-v203.js'),'The flat enhancement loader is missing.');
assert(!shell.includes('living-school-two-agent-relay-v165.js?v='),'The risky media relay still starts during initial boot.');
assert(!shell.includes('living-school-workbench-v158.js?v='),'The workbench still races the flat core import.');
assert(!shell.includes('/app/assets/living-school/'),'Spatial scene assets were pulled into the flat cabinet.');
assert(!shell.includes('ls-world-art'),'Spatial scene markup was pulled into the flat cabinet.');

assert(bootstrap.includes("VERSION='living-school-flat-bootstrap-v203'"),'The bootstrap is not the flat v203 boot path.');
assert(bootstrap.includes('firstShellPaint()'),'Shared controls do not receive a paint before the core import.');
assert(bootstrap.includes("mode:'flat'"),'Ready events no longer identify flat mode.');
assert(loader.includes("document.addEventListener('commonweave:living-school-ready',loadCore"),'Enhancements no longer wait for the core content.');
assert(loader.indexOf('living-school-mutation-guard-v196.js')<loader.indexOf('living-school-workbench-v158.js'),'The mutation guard must precede workbench observers.');
assert(loader.indexOf('living-school-mutation-guard-v196.js')<loader.indexOf('living-school-two-agent-relay-v165.js'),'The mutation guard must precede the optional relay.');
assert(loader.includes('commonweave:living-school-enable-rich-media'),'The risky rich-media relay is not explicit opt-in.');

for(const token of ['Pathway Desk','Curriculum Forge','Learning Map','Open lesson','Assessment Studio','Practicum Workshop','Credential Forge','window.LivingSchoolCabinetV151'])assert(engine.includes(token),`Flat learning engine lost ${token}.`);
assert(guard.includes("callback?.name==='queuePatch'"),'The reader mutation guard no longer recognizes the relay observer.');
assert(relay.includes("action==='lesson'?openLesson(module,state):openAssessment(module,state)"),'Optional rich-media lesson routing changed unexpectedly.');
assert(workbench.includes("if(action==='lesson')openNative('lesson',0)"),'The flat workbench no longer routes lessons through the cabinet.');
assert(installer.includes("WORKER_URL=`/service-worker-v203.js"),'The installer does not request the v203 wrapper.');
assert(installer.includes("GET_SHARED_IMAGE_STATUS"),'The installer does not verify shared images.');
assert(installer.includes("critical.mode!=='flat'"),'The installer does not reject spatial-mode packages.');
assert(pwa.includes("WORKER_URL=`/service-worker-v203.js"),'The installed app does not request the v203 wrapper.');

console.log(JSON.stringify({
  ok:true,
  repair:'flat-living-school-v203-memory-bridge-v205',
  combinedCritical:combinedRevision,
  coreBoundary:111,
  sharedBoundary:53,
  flatContentPreserved:true,
  optionalRelayAtBoot:false,
  navigationImageCount:5,
  topAiMarks:2,
  sharedImageLane:true,
  legacyImageRepair:true,
  fellowFareRefresh:true,
  fellowFareParentMobileRefresh:true,
  cerbanimoBoundaryRefresh:true,
  memoryBridgeRefresh:true,
  wrapperRefresh:true,
  spatialMode:false,
},null,2));