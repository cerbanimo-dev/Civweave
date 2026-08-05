import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFileSync(path.join(root,relative),'utf8');
const assert=(value,message)=>{if(!value)throw new Error(message)};

const critical=read('public/service-worker-critical-v199.js');
const imageWorker=read('public/service-worker-shared-images-v203.js');
const activeWorker=read('public/service-worker-v203.js');
const legacyWorker=read('public/service-worker-v156.js');
const shell=read('public/app/cabinets/living-school/index.html');
const bootstrap=read('public/app/cabinets/living-school/living-school-bootstrap-v194.js');
const loader=read('public/app/cabinets/living-school/living-school-flat-loader-v211.js');
const engine=read('public/app/cabinets/living-school/living-school-cabinet-v151.mjs');
const nav=read('public/app/themed-system-nav-v178.js');
const relay=read('public/app/cabinets/living-school/living-school-two-agent-relay-v165.js');
const guard=read('public/app/cabinets/living-school/living-school-mutation-guard-v196.js');
const workbench=read('public/app/cabinets/living-school/living-school-workbench-v158.js');
const installer=read('public/install-v130.js');
const pwa=read('public/app/pwa-v130.js');

for(const [name,source] of [['critical worker',critical],['shared image worker',imageWorker],['active worker',activeWorker],['legacy worker bridge',legacyWorker],['flat bootstrap',bootstrap],['flat loader',loader],['installer',installer],['pwa',pwa]]){
  try{new Function(source.replace(/^\s*importScripts\([^\n]+\);/m,''))}catch(error){throw new Error(`${name} does not parse: ${error.message}`)}
}

const combinedRevision='fellowfare-active-v203-parent-mobile-v205-cerbanimo-boundary-v204-memory-bridge-v205';
assert(critical.includes(`VERSION='${combinedRevision}'`),'The combined FellowFare mobile, Cerbanimo, and memory bridge compatibility core is not retained.');
assert(critical.includes(`CRITICAL_CACHE='cwboot-critical-${combinedRevision}'`),'The combined critical compatibility cache is not retained.');
assert(critical.includes('BASE_EXPECTED_FILES=111'),'The 111-file legacy core boundary changed unexpectedly.');
assert(critical.includes('EXTENSION_EXPECTED_FILES=53'),'The 53-file legacy shared boundary changed unexpectedly.');
assert(critical.includes('runCaptured(event)'),'Incomplete legacy packages no longer replay the complete installers.');
assert(critical.includes("mode:'flat'"),'Critical compatibility status no longer identifies the flat interface.');
assert(critical.includes('self.CommonweaveCriticalBootV205=api'),'The combined critical compatibility API alias is missing.');

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
  assert(imageWorker.includes(pathname),`Dedicated image compatibility worker omits ${pathname}.`);
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
])assert(critical.includes(pathname),`Combined critical compatibility refresh omits ${pathname}.`);
assert(imageWorker.includes("event.stopImmediatePropagation()"),'Shared image compatibility repair no longer protects assets from the old generic /app fetch route.');
assert(imageWorker.includes("type:'COMMONWEAVE_SHARED_IMAGE_STATUS'"),'Shared image compatibility readiness is not inspectable.');

const lightweightMode=activeWorker.includes("const BUILD = 'lightweight-shell-v208'");
if(lightweightMode){
  assert(legacyWorker.includes("importScripts('/service-worker-v203.js?v=1.0.7-lightweight-shell-v208-legacy-v156-bridge-v209')"),'Existing v156 registrations do not bridge to the v1.0.7 direct lightweight worker.');
  assert(!/^[ \t]*importScripts\(/m.test(activeWorker),'The direct lightweight worker reintroduced the layered worker stack.');
  assert(activeWorker.includes('const IMAGE_EXTENSION'),'The direct worker no longer validates image responses.');
  assert(activeWorker.includes("'/service-worker-shared-images-v203.js'"),'The direct worker no longer recognizes the retired image-worker URL during updates.');
  assert(activeWorker.includes("'/service-worker-v156.js'"),'The direct worker no longer recognizes the legacy registration URL during updates.');
  assert(activeWorker.includes('DOWNLOAD_OFFLINE_PACKAGE'),'The direct worker no longer exposes resumable campus hydration.');
}else{
  assert(activeWorker.indexOf('service-worker-shared-images-v203.js')<activeWorker.indexOf('service-worker-v156.js'),'The image repair lane must register before the generic package worker.');
  assert(activeWorker.includes('flat-living-school-v203-memory-bridge-v205'),'The v203 wrapper does not refresh the changed inner worker.');
}

assert((nav.match(/200-[a-z-]+-nav\.webp/g)||[]).length===5,'The shared family navigation does not reference all five image buttons.');
assert(nav.includes('grid-template-columns:repeat(5'),'The family navigation is not mounted as five equal slots.');
assert(nav.includes('--cw-themed-nav-button-width:200px'),'The family navigation no longer caps each image button at 200 pixels.');
assert(shell.includes('<nav class="ls-tray" aria-label="Living School navigation" hidden>'),'The legacy Living School text tray can still occupy the bottom edge.');
assert(shell.includes('living-school-flat-loader-v211.js'),'The stable Living School enhancement loader is missing.');
assert(!shell.includes('living-school-two-agent-relay-v165.js?v='),'The risky media relay still starts during initial boot.');
assert(!shell.includes('living-school-workbench-v158.js?v='),'The workbench still races the flat core import.');
assert(!shell.includes('/app/assets/living-school/'),'Spatial scene assets were pulled into the flat cabinet.');
assert(!shell.includes('ls-world-art'),'Spatial scene markup was pulled into the flat cabinet.');

assert(bootstrap.includes("VERSION='living-school-flat-bootstrap-v203'"),'The bootstrap is not the flat v203 boot path.');
assert(bootstrap.includes('firstShellPaint()'),'Shared controls do not receive a paint before the core import.');
assert(bootstrap.includes("mode:'flat'"),'Ready events no longer identify flat mode.');
assert(loader.includes("VERSION='living-school-flat-loader-v211-stable-path-controls'"),'The stable v211 Living School loader is not active.');
assert(loader.includes("document.addEventListener('commonweave:living-school-ready',loadCore"),'Enhancements no longer wait for the core content.');
assert(loader.indexOf('living-school-mutation-guard-v196.js')<loader.indexOf('living-school-workbench-v158.js'),'The mutation guard must precede workbench observers.');
assert(loader.indexOf('living-school-mutation-guard-v196.js')<loader.indexOf('living-school-two-agent-relay-v165.js'),'The mutation guard must precede the optional relay.');
assert(loader.includes('living-school-paths-v211.js'),'The guarded v211 learning-path controls are not loaded.');
assert(loader.includes('commonweave:living-school-enable-rich-media'),'The risky rich-media relay is not explicit opt-in.');

for(const token of ['Pathway Desk','Curriculum Forge','Learning Map','Open lesson','Assessment Studio','Practicum Workshop','Credential Forge','window.LivingSchoolCabinetV151'])assert(engine.includes(token),`Flat learning engine lost ${token}.`);
assert(guard.includes("callback?.name==='queuePatch'"),'The reader mutation guard no longer recognizes the relay observer.');
assert(relay.includes("action==='lesson'?openLesson(module,state):openAssessment(module,state)"),'Optional rich-media lesson routing changed unexpectedly.');
assert(workbench.includes("if(action==='lesson')openNative('lesson',0)"),'The flat workbench no longer routes lessons through the cabinet.');
assert(installer.includes("WORKER_URL = `/service-worker-v203.js"),'The installer does not request the direct v203 worker.');
assert(pwa.includes("WORKER_URL=`/service-worker-v203.js")||pwa.includes("WORKER_URL = `/service-worker-v203.js"),'The installed app does not request the v203 worker.');
if(lightweightMode){
  assert(installer.includes('GET_DEVICE_PACKAGE_STATUS'),'The lightweight installer does not verify its shell package.');
  assert(installer.includes('GET_OFFLINE_PACKAGE_STATUS'),'The lightweight installer does not inspect resumable campus state.');
  assert(!installer.includes('GET_SHARED_IMAGE_STATUS'),'The lightweight installer still blocks on the retired image-worker lane.');
  assert(!installer.includes("critical.mode!=='flat'"),'The lightweight installer still blocks on the retired critical package mode.');
}else{
  assert(installer.includes('GET_SHARED_IMAGE_STATUS'),'The layered installer does not verify shared images.');
  assert(installer.includes("critical.mode!=='flat'"),'The layered installer does not reject spatial-mode packages.');
}

console.log(JSON.stringify({
  ok:true,
  repair:lightweightMode?'lightweight-shell-v208-legacy-bridge-v209':'flat-living-school-v203-memory-bridge-v205',
  combinedCritical:combinedRevision,
  coreBoundary:111,
  sharedBoundary:53,
  flatContentPreserved:true,
  optionalRelayAtBoot:false,
  navigationImageCount:5,
  navigationButtonCap:'200x100',
  topAiMarks:2,
  sharedImageCompatibility:true,
  legacyImageRepair:true,
  fellowFareRefresh:true,
  fellowFareParentMobileRefresh:true,
  cerbanimoBoundaryRefresh:true,
  memoryBridgeRefresh:true,
  livingSchoolStableControls:true,
  installedWorkerMode:lightweightMode?'v209-direct-lightweight':'v203-layered-wrapper',
  spatialMode:false,
},null,2));