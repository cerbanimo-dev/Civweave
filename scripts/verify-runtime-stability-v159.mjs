import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(value,message)=>{if(!value)throw new Error(message)};
const [platform,platformCss,realm,validator,living,livingRuntime,livingCss,anarchadia,anarchadiaRuntime,worker]=await Promise.all([
  read('public/app/platform-stability-v159.js'),read('public/app/platform-stability-v159.css'),read('public/app/realm-console-v140.html'),read('public/app/cerbanimo-ai-validator-v159.js'),read('public/app/cabinets/living-school/index.html'),read('public/app/cabinets/living-school/living-school-runtime-stability-v159.js'),read('public/app/cabinets/living-school/living-school-runtime-stability-v159.css'),read('public/app/anarchadia-console-v139.html'),read('public/app/anarchadia-runtime-stability-v159.js'),read('public/service-worker-v156.js')
]);
for(const token of ['requestAnimationFrame.bind(globalThis)','data-cw159-chat-minimize','data-cw159-chat-dock','Minimize to tray','Close and return','cw159-is-minimized'])assert(platform.includes(token),`Platform escape runtime missing ${token}`);
for(const token of ['cw159-has-chat-dock','grid-template-columns:repeat(5','cw159-dialog-return','position:sticky','.cw159-is-minimized{display:none!important}'])assert(platformCss.includes(token),`Platform escape styling missing ${token}`);
assert(realm.indexOf('cerbanimo-ai-validator-v159.js')<realm.indexOf('cerbanimo-ai-validator-v156.js'),'Stable validator must load before the compatibility no-op.');
for(const token of ['observer?.disconnect()','ensureButton','cerbanimoAiValidator159','setTimeout(()=>{if(action===\'submit-task\'','runtimeVersion:VERSION'])assert(validator.includes(token),`Stable validator missing ${token}`);
assert(!validator.includes("footer.querySelector('[data-cq-ai-action]')?.remove()"),'Stable validator still removes and reinserts its review button on every observer pass.');
for(const token of ['living-school-runtime-stability-v159.js','living-school-runtime-stability-v159.css','platform-stability-v159.js'])assert(living.includes(token),`Living School entry missing ${token}`);
assert(living.indexOf('living-school-runtime-stability-v159.js')<living.indexOf('living-school-workbench-v158.js'),'Living School capture repair must bind before the old synthetic bridge.');
for(const token of ['api.crossref.org/works','en.wikipedia.org/w/api.php','researchOnline','researchPack','curriculum-researched-and-generated','function directOpen','data-lsw-action','Practice scaffold, not researched'])assert(livingRuntime.includes(token),`Living School research or lesson repair missing ${token}`);
assert(livingCss.includes('.ls159-research')&&livingCss.includes('.ls159-research-consent'),'Living School research provenance styling is missing.');
for(const retired of ['anarchadia-governance-bridge-v145.js','anarchadia-cabinet-workbench-v144.js','family-ai-loader-v105.js?v=direct'])assert(!anarchadia.includes(retired),`Anarchadia still boots delayed runtime ${retired}`);
for(const token of ['data-ag145-open','data-anarchadia-workbench="workbench"','anarchadia-runtime-stability-v159.js','platform-stability-v159.js'])assert(anarchadia.includes(token),`Anarchadia stable entry missing ${token}`);
for(const token of ['compactLegacyState','raw.length>1500000','anarchadia-lazy-loader-v159','CommonweaveGuideChatV153','askMerlin','loadFamily'])assert(anarchadiaRuntime.includes(token),`Anarchadia stability runtime missing ${token}`);
for(const token of ['working-campus-additions-v159-chat-tray-review-stability-researched-learning','/app/platform-stability-v159.js','/app/cerbanimo-ai-validator-v159.js','/app/cabinets/living-school/living-school-runtime-stability-v159.js','/app/anarchadia-runtime-stability-v159.js'])assert(worker.includes(token),`Installed-device patch missing ${token}`);
new Function(platform);new Function(validator);new Function(livingRuntime);new Function(anarchadiaRuntime);
console.log(JSON.stringify({ok:true,chat:'minimizable-to-tray',dialogs:'sticky-and-bottom-close',livingSchool:'direct-lessons-and-opt-in-public-research',cerbanimo:'idempotent-ai-review',anarchadia:'compacted-state-lazy-ai-static-links'},null,2));
