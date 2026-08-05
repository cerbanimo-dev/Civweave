import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(value,message)=>{if(!value)throw new Error(message)};
const [index,bootstrap,critical,pwa,nav,loader,engine,imageWorker,wrapper]=await Promise.all([
  read('public/app/cabinets/living-school/index.html'),
  read('public/app/cabinets/living-school/living-school-bootstrap-v194.js'),
  read('public/service-worker-critical-v199.js'),
  read('public/app/pwa-v130.js'),
  read('public/app/themed-system-nav-v178.js'),
  read('public/app/cabinets/living-school/living-school-flat-loader-v203.js'),
  read('public/app/cabinets/living-school/living-school-cabinet-v151.mjs'),
  read('public/service-worker-shared-images-v203.js'),
  read('public/service-worker-v203.js')
]);

assert(index.includes('data-commonweave-system="living-school"'),'Living School does not expose its shared system identity.');
assert(index.includes('data-build="living-school-flat-v203"'),'Living School is not marked as the flat v203 surface.');
assert(index.includes('/app/themed-system-nav-v178.js'),'Living School does not load the image system navigation directly.');
assert(!/<script[^>]+type=["']module["'][^>]+living-school-cabinet-v151\.mjs/i.test(index),'The blocking Living School module tag is still present.');
assert(index.includes('living-school-bootstrap-v194.js'),'Living School does not use the non-blocking bootstrap.');
assert(index.includes('living-school-flat-loader-v203.js'),'Living School does not use the post-core flat loader.');
assert(index.indexOf('family-shell-v104.js')<index.indexOf('living-school-bootstrap-v194.js'),'Shared controls must boot before the learning engine.');
assert(index.indexOf('living-school-bootstrap-v194.js')<index.indexOf('living-school-flat-loader-v203.js'),'The core bootstrap must be declared before optional enhancements.');
assert(index.indexOf('themed-system-nav-v178.js')<index.indexOf('install-boundary-v146.js'),'The direct image navigation must be discoverable before the install boundary.');
assert(!index.includes('/app/assets/living-school/'),'Spatial assets were introduced into the flat page.');
assert(!index.includes('living-school-two-agent-relay-v165.js?v='),'The relay still races initial content boot.');
for(const token of ['import(`${MODULE}?v=${VERSION}&attempt=${currentAttempt}`)','data-ls-boot-retry','data-ls-boot-reset','commonweave:living-school-ready','livingSchoolBoot','firstShellPaint()'])assert(bootstrap.includes(token),`Living School bootstrap missing ${token}`);
new Function(bootstrap);
new Function(loader);
assert(loader.includes("document.addEventListener('commonweave:living-school-ready',loadCore"),'Flat enhancements no longer wait for core readiness.');
assert(loader.includes('commonweave:living-school-enable-rich-media'),'Rich media is no longer explicit opt-in.');
assert(engine.includes('render();\nwindow.LivingSchoolCabinetV151'),'The saved flat learning engine no longer renders and publishes its API.');
assert(critical.includes("VERSION='fellowfare-active-v203-parent-mobile-v205-cerbanimo-boundary-v204-memory-bridge-v205'"),'The combined FellowFare parent/mobile, Cerbanimo, and memory bridge critical package is not active.');
assert(critical.includes("mode:'flat'"),'The combined critical package no longer identifies the flat interface.');
assert(critical.includes('/app/cabinets/living-school/living-school-flat-loader-v203.js'),'The flat loader is absent from the critical package.');
assert(critical.includes('/app/weaveling-memory-bridge-v191.js'),'The frozen-safe memory bridge is absent from the critical package.');
assert(pwa.includes('/service-worker-v203.js'),'The installed PWA does not request the v203 worker.');
assert(wrapper.indexOf('service-worker-shared-images-v203.js')<wrapper.indexOf('service-worker-v156.js'),'Shared image interception does not start before the generic package worker.');
assert(wrapper.includes('flat-living-school-v203-memory-bridge-v205'),'The active wrapper does not refresh the v205 memory bridge package.');
assert(imageWorker.includes('/app/assets/ai/moss-acorn.png'),'The Living School AI mark is absent from shared image repair.');
assert(imageWorker.includes('/app/assets/ai/weaveling-compass.png'),'The Commonweave AI mark is absent from shared image repair.');
for(const token of ['.ls-tray','display:none!important','200-living-school-nav.webp'])assert(nav.includes(token),`Image navigation repair missing ${token}`);
console.log(JSON.stringify({ok:true,system:'living-school',mode:'flat',boot:'core-before-enhancements',content:'preserved-local-state',imageNavigation:'direct-and-repaired',aiMarks:'repaired',packageRevision:'v203-v205-memory-bridge'},null,2));
