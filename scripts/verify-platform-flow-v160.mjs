import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>readFile(path.join(root,file),'utf8');
const assert=(value,message)=>{if(!value)throw new Error(message)};
const [platform,css,rook,living,realm,livingHtml,fellow,anarchadia,campus,worker]=await Promise.all([
  read('public/app/platform-experience-v160.js'),read('public/app/platform-experience-v160.css'),read('public/app/rook-request-flow-v160.js'),read('public/app/cabinets/living-school/living-school-paths-v160.js'),read('public/app/realm-console-v140.html'),read('public/app/cabinets/living-school/index.html'),read('public/app/fellowfare-cabinet-v144.html'),read('public/app/anarchadia-console-v139.html'),read('public/app/working-campus-v156.html'),read('public/service-worker-v156.js')
]);
for(const token of ['commonweave.appearance.v160','dataset.commonweaveTheme','data-cw160-theme','data-cw160-review','explicitActionSystem','dark mode','feature request','CommonweaveAssistantV141','CommonweaveGuideContractsV141','commonweave.fellowfare.funding-plans.v160','awaiting-buttons','visibility:\'private\'','Nothing will be shared yet','function syncFrames','data-cw160-frame-theme'])assert(platform.includes(token),`Platform experience missing ${token}`);
for(const token of ['data-commonweave-resolved-theme="dark"','[data-cw160-theme]','.ff160-request-card','.ls160-pathbar'])assert(css.includes(token),`Platform experience CSS missing ${token}`);
for(const token of ['systemId:\'fellowfare\'','data-ff160-action-card','data-ff160-approve','Request preview saved','This plan is private and has not been shared to the market.','commonweave:rewards-changed'])assert(rook.includes(token),`Rook request flow missing ${token}`);
for(const token of ['commonweave.living-school.intake.v152','commonweave.intentions.v127','commonweave.living-school.path-library.v160','data-ls160-path-select','data-ls160-use','data-ls160-view','data-ls160-generate','LivingSchoolWorkbenchV158?.generate','LivingSchoolRuntimeStabilityV159?.research','curriculum-researched-and-generated'])assert(living.includes(token),`Living School path flow missing ${token}`);
for(const [name,html] of [['realm',realm],['living',livingHtml],['fellowfare',fellow],['anarchadia',anarchadia],['campus',campus]]){assert(html.includes('platform-experience-v160.css'),`${name} does not load the shared appearance CSS.`);assert(html.includes('platform-experience-v160.js'),`${name} does not load the shared appearance runtime.`)}
assert(livingHtml.includes('living-school-paths-v160.js'),'Living School does not load the active path and direct curriculum runtime.');
assert(fellow.includes('rook-request-flow-v160.js'),'FellowFare does not load Rook request previews.');
for(const token of ['working-campus-additions-v162-dark-review-rook-learning','settings-dialog-stability-v161','dark-review-rook-learning-v160','/app/platform-experience-v160.js','/app/platform-experience-v160.css','/app/rook-request-flow-v160.js','/app/cabinets/living-school/living-school-paths-v160.js'])assert(worker.includes(token),`Installed-device package missing ${token}`);
new Function(platform);new Function(rook);new Function(living);
console.log(JSON.stringify({ok:true,darkMode:'system-light-dark-persisted-and-propagated-to-embedded-apps',reviewHUD:'actions-and-intentions',universalChat:'explicit-actions-route-to-realm-with-review-card',rook:'private-preview-approval-and-funding-hold',livingSchool:'selectable-paths-direct-view-and-generation',foundation:'settings-dialog-stability-v161'},null,2));
