import {access,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const missing=async relative=>{try{await access(path.join(root,relative));return false}catch{return true}};
const files={
  settings:'public/app/unified-ai-settings-v175.js',
  controller:'public/app/model-settings-controller-v173.js',
  delegation:'public/app/settings-delegation-v175.js',
  campus:'public/app/working-campus-v156.html',
  campusCss:'public/app/working-campus-v156.css',
  worker:'public/service-worker.js',
  additive:'public/service-worker-v156.js',
  installer:'public/install-v130.js',
  pwa:'public/app/pwa-v130.js',
  boundary:'public/app/install-boundary-v146.js',
  index:'public/index.html',
  pkg:'package.json'
};
const source=Object.fromEntries(await Promise.all(Object.entries(files).map(async([key,file])=>[key,await read(file)])));
for(const key of ['settings','controller','delegation','worker','additive','installer','pwa','boundary'])new Function(source[key]);
assert(await missing('public/extensions/civweave-settings-safe-open-v171.js'),'v171 MiniLM settings capture extension still exists');
assert(await missing('public/extensions/civweave-settings-safe-open-v172.js'),'v172 window-capture MiniLM settings extension still exists');
for(const key of ['settings','controller','delegation','campus','worker','additive','installer','pwa','boundary']){
  assert(!source[key].includes('civweave-settings-safe-open-v171'),`${key} still references safe-open v171`);
  assert(!source[key].includes('civweave-settings-safe-open-v172'),`${key} still references safe-open v172`);
}
for(const token of ["VERSION='1.0.5-unified-ai-settings-v178'","APP_VERSION='1.0.5'",'LEGACY_PATTERN','migrateDeterministicDefault',"dialog.dataset.dismissal='explicit-only'","dialog.addEventListener('cancel'",'returnFocus'])assert(source.settings.includes(token),`settings runtime missing ${token}`);
for(const forbidden of ["event.target===dialog","dialog.addEventListener('click'",'Xenova/all-MiniLM-L6-v2','minilm-model-settings-v138','minilm-reflex-runtime-v138','GET_MODEL_PACKAGE_STATUS'])assert(!source.settings.includes(forbidden),`settings runtime still contains ${forbidden}`);
assert(source.settings.includes("provider:'deterministic'")&&source.settings.includes('civweave-deterministic-v178'),'settings migration does not force deterministic state');
for(const token of ['/app/logos/civweave-app-icon.png','LOCAL WORKING CAMPUS','v1.0.5','mode-switch','settings-pill','working-campus-v178-v105'])assert(source.campus.includes(token),`Working Campus header missing ${token}`);
assert(!source.campus.includes('/app/logos/civweave.webp'),'Working Campus still uses the old Civweave logo');
for(const token of ['width:176px','height:176px','grid-template-areas','version-chip','mode-switch'])assert(source.campusCss.includes(token),`Working Campus CSS missing ${token}`);
const pkg=JSON.parse(source.pkg);assert(pkg.version==='1.0.5',`package version is ${pkg.version}, expected 1.0.5`);
assert(pkg.scripts.check.includes('verify-v105-settings-header-v178.mjs'),'default check does not protect the v1.0.5 settings/header boundary');
for(const [key,tokens] of Object.entries({worker:["VERSION='1.0.5'",'device-package-r40-settings-stable'],additive:['working-campus-additions-v178-settings-stable'],installer:["VERSION='1.0.5'",'device-package-r40-settings-stable'],pwa:["VERSION='1.0.5'",'device-package-r40-settings-stable'],boundary:['v178-settings-stable'],index:['v1.0.5']}))for(const token of tokens)assert(source[key].includes(token),`${key} missing ${token}`);
console.log(JSON.stringify({ok:true,version:'1.0.5',settingsOwner:'controller-only',dismissal:'explicit-only',legacyCaptureExtensions:false,defaultRoute:'deterministic',campusIcon:'/app/logos/civweave-app-icon.png',campusIconPixels:176,devicePackage:'r40-settings-stable'},null,2));
