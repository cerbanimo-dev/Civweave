import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
await import('./verify-living-school-cleanroom-v218.mjs');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>readFile(path.join(root,file),'utf8');
const assert=(value,message)=>{if(!value)throw new Error(message)};
const [platform,identity,contracts,css,rook,living,realm,fellow,anarchadia,campus]=await Promise.all([
  read('public/app/platform-experience-v160.js'),read('public/app/guide-identity-integrity-v216.js'),read('public/app/guide-contracts-v141.js'),read('public/app/platform-experience-v160.css'),read('public/app/rook-request-flow-v160.js'),read('public/app/cabinets/living-school/index.html'),read('public/app/realm-console-v140.html'),read('public/app/fellowfare-cabinet-v144.html'),read('public/app/anarchadia-console-v139.html'),read('public/app/working-campus-v156.html')
]);
for(const token of ['civweave.appearance.v160','dataset.civweaveTheme','data-cw160-theme','data-cw160-review','function syncFrames',"ownership:'appearance-and-review-hud-only'",'assistantPatching:false','contractPatching:false'])assert(platform.includes(token),`Platform experience missing ${token}`);
for(const forbidden of ['installPatchedGlobal','patchAssistant','patchContracts',"Object.defineProperty(globalThis,'CivweaveAssistantV141'","Object.defineProperty(globalThis,'CivweaveGuideContractsV141'"])assert(!platform.includes(forbidden),`Platform experience regained foreign runtime ownership: ${forbidden}`);
for(const token of ['explicitActionSystem','dark mode','feature request',"routingPolicy:'explicit-actions-route-before-generation'","reason:explicit?'explicit-handoff':routed?'explicit-action-route'"])assert(identity.includes(token),`Guide identity routing owner missing ${token}`);
for(const token of ['civweave.fellowfare.funding-plans.v160','buttonBudget','buttonBalance','awaiting-buttons','visibility:\'private\'','Nothing will be shared yet',"fundingOwner:'guide-contracts-v141'"])assert(contracts.includes(token),`Realm action contract owner missing ${token}`);
for(const token of ['data-civweave-resolved-theme="dark"','[data-cw160-theme]','.ff160-request-card','--cw-themed-nav-height:clamp(92px,10vw,100px)','width:84px!important;height:84px!important','width:76px!important;height:76px!important','width:68px!important;height:68px!important'])assert(css.includes(token),`Platform experience CSS missing ${token}`);
for(const token of ['systemId:\'fellowfare\'','data-ff160-action-card','data-ff160-approve','Request preview saved','This plan is private and has not been shared to the market.','civweave:rewards-changed'])assert(rook.includes(token),`Rook request flow missing ${token}`);
for(const [name,html] of [['realm',realm],['living',living],['fellowfare',fellow],['anarchadia',anarchadia],['campus',campus]]){assert(html.includes('platform-experience-v160.css'),`${name} does not load shared appearance CSS.`);assert(html.includes('platform-experience-v160.js'),`${name} does not load shared appearance runtime.`)}
assert(living.includes('data-living-school-runtime="cleanroom-v218"')&&living.includes('living-school-cleanroom-v218.mjs'),'Living School does not use the single-owner clean-room surface.');
assert(!/data-room|living-school-paths|living-school-workbench|living-school-flat-loader/.test(living),'Living School reintroduced legacy room routing.');
new Function(platform);new Function(identity);new Function(contracts);new Function(rook);
console.log(JSON.stringify({ok:true,darkMode:'preserved',routingOwner:'guide-identity-integrity-v216',fundingOwner:'guide-contracts-v141',platformOwner:'appearance-and-review-hud-only',foreignGlobalPatching:false,rook:'private-preview-and-funding-preserved',livingSchool:'cleanroom-single-owner-v218',reactiveNavAvatars:'2x'},null,2));