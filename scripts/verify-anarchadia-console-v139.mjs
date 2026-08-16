import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const [html,css,js,launcher,adapter,worker,serviceWorker]=await Promise.all([
  read('public/app/anarchadia-console-v139.html'),read('public/app/anarchadia-console-v139.css'),read('public/app/anarchadia-console-v139.js'),read('public/app/v130-cabinet-launcher.js'),read('public/app/models/all-minilm-l6-v2/adapter.js'),read('public/app/models/all-minilm-l6-v2/worker.js'),read('public/service-worker.js')
]);
for(const required of ['ANARCHADIA','// CITIZEN CONSOLE','OPEN PROPOSALS','VIEW LEDGER','AUTOMATION','OBSERVATORY','BUGFIX REQUEST','FEATURE REQUEST','VOTE!','ac-request-form','ac-preview-frame','ac-display','ac-console-bar'])assert(html.includes(required),`console HTML missing ${required}`);
for(const required of ['title','problem','expected','acceptance','risk','evidence','autoRun'])assert(html.includes(`name="${required}"`),`request form missing ${required}`);
for(const required of ['--pink:#ff2f87','--gold:#ffc21a','--cyan:#1fd8ff','--lime:#8dff2b','.ac-display','.ac-console-bar','.ac-pipeline-track','.ac-observatory','repeating-linear-gradient'])assert(css.includes(required),`console CSS missing ${required}`);
assert(!css.includes('/app/assets/cabinets/anarchadia.webp'),'console interior must not draw a second cabinet exterior');
assert(!html.includes('ac-masthead'),'console interior still contains the duplicate exterior masthead');
for(const required of ["const STAGES=['intake','rail-check','code-generation','validation','sandbox-install','preview-ready']",'civweave.anarchadia.citizen-console.v139','CivweaveReflexRuntime','CivweaveModelRuntime','civweave-safe-scaffolder','validatePatch','sandbox-install','preview-ready','vote-signal','HUB_PROPOSALS','No external action occurred.'])assert(js.includes(required),`console runtime missing ${required}`);
assert(js.includes('const fresh=defaultState()'),'fresh Passport state is not created when storage is empty');
assert(js.includes('localStorage.setItem(STORAGE_KEY,JSON.stringify(fresh))'),'newly generated Passport is not persisted immediately');
for(const forbidden of ['eval(', 'new Function(', 'document.cookie'])assert(!js.includes(forbidden),`console runtime contains forbidden executable ${forbidden}`);
assert(launcher.includes('/app/anarchadia-console-v139.html?embed=1'),'cabinet launcher does not route Anarchadia to the citizen console');
assert(launcher.includes('cw-cabinet-frame-art'),'Anarchadia citizen console is not wrapped in the physical cabinet shell');
assert(launcher.includes("'Citizen Console'"),'cabinet launcher does not label the Anarchadia console');
assert(adapter.includes('BODY_PROBE_LIMIT=2_000_000'),'MiniLM status checker lacks the small-file body probe');
assert(adapter.includes("response.blob()).size"),'MiniLM status checker does not measure cached response bodies');
assert(adapter.includes("probeBody:false"),'MiniLM graph checks could accidentally download full ONNX bodies');
assert(worker.includes("pipeline('feature-extraction'"),'MiniLM worker no longer performs semantic feature extraction');
assert(worker.includes("['wasm','q8']"),'MiniLM worker no longer offers the stable WASM route');
assert(serviceWorker.includes("CACHE_REVISION='minilm-runtime-r19'"),'service worker revision was not rotated');
assert(serviceWorker.includes('binaryStreamFirst'),'service worker does not stream ONNX binaries directly');
for(const required of ['/app/anarchadia-console-v139.html','/app/anarchadia-console-v139.css','/app/anarchadia-console-v139.js'])assert(serviceWorker.includes(required),`service worker does not precache ${required}`);
console.log(JSON.stringify({ok:true,console:'Anarchadia Citizen Console v139 interior correction',visualBoundary:'existing cabinet remains outside iframe; console renders only the display interior',modules:['proposals','ledger','automation','observatory'],requestKinds:['bugfix','feature'],pipeline:['intake','rail-check','code-generation','validation','sandbox-install','preview-ready'],passportPersistence:'fresh Passport state is stored before other systems read it',publicationBoundary:'sandbox auto-install; production requires explicit community approval',minilmStatusProbe:'small cached files measured; ONNX binaries stream without blocking on Cache Storage',cacheRevision:'minilm-runtime-r19'},null,2));
