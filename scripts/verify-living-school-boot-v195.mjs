import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(value,message)=>{if(!value)throw new Error(message)};
const [index,bootstrap,worker,pwa,nav,visual,enhancements]=await Promise.all([
  read('public/app/cabinets/living-school/index.html'),
  read('public/app/cabinets/living-school/living-school-bootstrap-v194.js'),
  read('public/service-worker-v156.js'),
  read('public/app/pwa-v130.js'),
  read('public/app/themed-system-nav-v178.js'),
  read('public/app/cabinets/living-school/living-school-visual-shell-v202.js'),
  read('public/app/cabinets/living-school/living-school-enhancements-v202.js')
]);

assert(index.includes('data-commonweave-system="living-school"'),'Living School does not expose its shared system identity.');
assert(index.includes('/app/themed-system-nav-v178.js'),'Living School does not load the image system navigation directly.');
assert(!/<script[^>]+type=["']module["'][^>]+living-school-cabinet-v151\.mjs/i.test(index),'The blocking Living School module tag is still present.');
assert(index.includes('living-school-bootstrap-v194.js'),'Living School does not use the non-blocking bootstrap.');
assert(index.includes('living-school-visual-shell-v202.js'),'Living School does not mount its illustrated shell before the engine.');
assert(index.includes('living-school-enhancements-v202.js'),'Living School does not isolate optional enhancers behind the core engine.');
assert(index.includes('id="ls-world-art"'),'Living School HTML does not request a scene image before script execution.');
assert(index.indexOf('family-shell-v104.js')<index.indexOf('living-school-bootstrap-v194.js'),'Shared controls must boot before the learning engine.');
assert(index.indexOf('living-school-visual-shell-v202.js')<index.indexOf('living-school-bootstrap-v194.js'),'Illustrated shell must boot before the learning engine.');
assert(index.indexOf('themed-system-nav-v178.js')<index.indexOf('install-boundary-v146.js'),'The direct image navigation must be discoverable before the install boundary injects additions.');
for(const token of ['import(`${MODULE}?v=${VERSION}&attempt=${attempt}`)','data-ls-boot-retry','data-ls-boot-reset','commonweave:living-school-ready','livingSchoolBoot','firstVisualPaint()'])assert(bootstrap.includes(token),`Living School bootstrap missing ${token}`);
new Function(bootstrap);
new Function(visual);
new Function(enhancements);
assert(worker.includes('/app/cabinets/living-school/living-school-bootstrap-v194.js'),'The bootstrap is absent from the offline package.');
assert(pwa.includes('living-school-image-runtime-v202'),'The installed PWA does not request the Living School image runtime worker.');
for(const token of ['.ls-tray','display:none!important','200-living-school-nav.webp'])assert(nav.includes(token),`Image navigation repair missing ${token}`);
assert(visual.includes("desk:'home.webp'"),'The Pathway Desk does not map to an illustrated scene.');
assert(visual.includes("lesson:'library.webp'"),'Lessons do not map to the illustrated library scene.');
assert(enhancements.includes("document.addEventListener('commonweave:living-school-ready',start"),'Optional enhancers no longer wait for the core engine.');
console.log(JSON.stringify({ok:true,system:'living-school',boot:'image-first-non-blocking',sharedControls:'before-learning-engine',imageNavigation:'direct-and-offline',sceneImage:'requested-in-html',enhancers:'after-core-ready',packageRevision:'v202'},null,2));
