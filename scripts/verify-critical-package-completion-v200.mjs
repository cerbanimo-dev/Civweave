import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFileSync(path.join(root,relative),'utf8');
const assert=(value,message)=>{if(!value)throw new Error(message)};

const worker=read('public/service-worker-critical-v199.js');
const shell=read('public/app/cabinets/living-school/index.html');
const nav=read('public/app/themed-system-nav-v178.js');
const relay=read('public/app/cabinets/living-school/living-school-two-agent-relay-v165.js');
const guard=read('public/app/cabinets/living-school/living-school-mutation-guard-v196.js');
const workbench=read('public/app/cabinets/living-school/living-school-workbench-v158.js');
const installer=read('public/install-v130.js');
const pwa=read('public/app/pwa-v130.js');

const criticalRevision=worker.includes("VERSION='fellowfare-active-v203-fast-runtime-proxy'")
  ?'fellowfare-active-v203-fast-runtime-proxy'
  :worker.includes("VERSION='living-school-lesson-nav-v202-fast-runtime-proxy'")
    ?'living-school-lesson-nav-v202-fast-runtime-proxy'
    :'';
assert(criticalRevision,'No recognized v202+ critical worker revision is active.');
assert(
  worker.includes("CRITICAL_CACHE='cwboot-critical-fellowfare-active-v203-fast-runtime-proxy'")||
  worker.includes("CRITICAL_CACHE='cwboot-critical-living-school-v202-fast-runtime-proxy'"),
  'The critical cache did not rotate for a recognized repaired runtime.'
);
assert(worker.includes('BASE_EXPECTED_FILES=111'),'The 111-file core package boundary changed unexpectedly.');
assert(worker.includes('EXTENSION_EXPECTED_FILES=53'),'The 53-file shared package boundary changed unexpectedly.');
assert(worker.includes('runCapturedInstallListeners(event)'),'Incomplete packages no longer replay the complete installers.');

const criticalList=worker.slice(worker.indexOf('const CRITICAL_FILES=['),worker.indexOf('const CRITICAL_PATHS='));
assert(!criticalList.includes('/app/assets/navigation/'),'Family navigation images are still trapped in the critical fetch lane.');
assert(criticalList.includes('/app/fast-interactive-runtime-v192.js'),'The corrected fast interactive runtime is not refreshed through critical boot.');
if(criticalRevision.startsWith('fellowfare-active-v203')){
  for(const pathname of [
    '/app/fellowfare-cabinet-v144.html',
    '/app/fellowfare-cabinet-v144.css',
    '/app/services/fellowfare/cabinet-embed.css',
    '/app/themed-system-nav-v178.js'
  ])assert(criticalList.includes(pathname),`Active FellowFare package path is missing from critical refresh: ${pathname}`);
}
assert((nav.match(/200-[a-z-]+-nav\.webp/g)||[]).length===5,'The shared family navigation does not reference all five image buttons.');
assert(nav.includes('grid-template-columns:repeat(5'),'The family navigation is not mounted as five equal button slots.');
assert(shell.includes('<nav class="ls-tray" aria-label="Living School navigation" hidden>'),'The legacy Living School text tray can still occupy the bottom edge.');

const guardIndex=shell.indexOf('living-school-mutation-guard-v196.js');
const relayIndex=shell.indexOf('living-school-two-agent-relay-v165.js');
assert(guardIndex>=0&&relayIndex>=0&&guardIndex<relayIndex,'The mutation guard must load before the relay creates its observer.');
assert(guard.includes("callback?.name==='queuePatch'"),'The reader mutation guard no longer recognizes the relay observer.');
assert(relay.includes("action==='lesson'?openLesson(module,state):openAssessment(module,state)"),'Open full lesson is no longer intercepted into the lesson dialog.');
assert(workbench.includes("if(action==='lesson')openNative('lesson',0)"),'The workbench no longer routes the lesson action through the cabinet.');
assert(installer.includes('living-school-lesson-nav-v201'),'The installer no longer requests the current Living School repaired package.');
assert(pwa.includes('living-school-lesson-nav-v201'),'The installed app no longer requests the current Living School repaired package.');

console.log(JSON.stringify({
  ok:true,
  repair:criticalRevision,
  coreBoundary:111,
  sharedBoundary:53,
  mutationGuardLoadsBeforeRelay:true,
  navigationImageCount:5,
  navigationImagesOutsideCriticalLane:true,
  fastRuntimeCritical:true,
  activeFellowfareCritical:criticalRevision.startsWith('fellowfare-active-v203'),
  legacyTrayHidden:true,
},null,2));
