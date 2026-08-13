import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const [html,css,js,launcher,serviceWorker]=await Promise.all([
  read('public/app/anarchadia-console-v139.html'),read('public/app/anarchadia-console-v139.css'),read('public/app/anarchadia-console-v158.js'),read('public/app/fullscreen-family-v104.html'),read('public/service-worker.js')
]);
for(const required of ['ANARCHADIA','// CITIZEN CONSOLE','INTENTION COMMONS','CHANGE STEWARDSHIP','CONSENSUS LADDER','VIEW LEDGER','OBSERVATORY','BUGFIX REQUEST','FEATURE REQUEST','CHECK RAILS &amp; AUTHORITY','ac-request-form','ac-intention-form','ac-preview-frame','ac-display','ac-console-bar'])assert(html.includes(required),`console HTML missing ${required}`);
for(const required of ['title','problem','expected','area','impact','acceptance','risk','evidence'])assert(html.includes(`name="${required}"`),`request form missing ${required}`);
for(const required of ['--pink:#ff2f87','--gold:#ffc21a','--cyan:#1fd8ff','--lime:#8dff2b','.ac-display','.ac-console-bar','.ac-pipeline-track','.ac-observatory','repeating-linear-gradient'])assert(css.includes(required),`console CSS missing ${required}`);
assert(!css.includes('/app/assets/cabinets/anarchadia.webp'),'console interior must not draw a second cabinet exterior');
assert(!html.includes('ac-masthead'),'console interior still contains the duplicate exterior masthead');
for(const required of ["const STAGES=['intake','rail-check','code-generation','validation','sandbox-install','preview-ready']",'civweave.anarchadia.citizen-console.v139','CivweaveReflexRuntime','CivweaveModelRuntime','civweave-safe-scaffolder','validatePatch','assessProposal','proposal-consensus-required','sandbox-install','preview-ready','No external action occurred.'])assert(js.includes(required),`console runtime missing ${required}`);
for(const forbidden of ['eval(', 'new Function(', 'document.cookie'])assert(!js.includes(forbidden),`console runtime contains forbidden executable ${forbidden}`);
assert(launcher.includes('/app/anarchadia-console-v139.html?cabinet=1'),'family dispatcher does not route Anarchadia to the citizen console');
assert(launcher.includes('location.replace')&&!launcher.includes('<iframe'),'family dispatcher must preserve the direct canonical route');
assert(serviceWorker.includes("MODEL_CACHE='civweave-model-1.0.7-minilm-fixed-ort-r1'"),'service worker model cache is not the fixed ORT package');
assert(serviceWorker.includes('modelOnDemand'),'service worker no longer isolates model download from the core package');
for(const required of ['/app/anarchadia-console-v139.html','/app/anarchadia-console-v139.css','/app/anarchadia-consensus-v145.css','/app/anarchadia-consensus-v145.js'])assert(serviceWorker.includes(required),`service worker does not precache ${required}`);
console.log(JSON.stringify({ok:true,console:'Anarchadia Citizen Console v139 consensus and change-stewardship overhaul',visualBoundary:'existing cabinet remains outside iframe; console renders only the display interior',modules:['intention-commons','change-stewardship','ledger','approved-work','observatory'],requestKinds:['bugfix','feature'],pipeline:['preflight-rails','authority-routing','approval-or-consensus','code-generation','validation','sandbox-install','preview-adoption'],publicationBoundary:'preview adoption and production deployment remain separate receipt-bearing actions',minilmStatusProbe:'small cached files measured; ONNX binaries stream without blocking on Cache Storage'},null,2));
