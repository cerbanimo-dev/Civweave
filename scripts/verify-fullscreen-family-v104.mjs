import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import process from 'node:process';
const root=process.cwd();
const read=file=>fs.readFile(path.join(root,file),'utf8');
const assert=(value,message)=>{if(!value)throw new Error(message)};
const [shell,host,entry,manifestRaw,worker,loader]=await Promise.all([
  read('public/app/family-shell-v104.js'),read('public/app/fullscreen-family-v104.html'),read('public/app/installed-entry-v146.js'),read('public/app/manifest.webmanifest'),read('public/service-worker.js'),read('public/app/family-ai-loader-v105.js')
]);
const expectedOrder=['commonweave','living-school','cerbanimo','fellowfare','anarchadia'];
const expectedSystems={
  commonweave:{guide:'Weaveling',artifact:'/app/assets/ai/weaveling-compass.png',avatar:'/app/assets/ai/weaveling.png'},
  'living-school':{guide:'Moss',artifact:'/app/assets/ai/moss-acorn.png',avatar:'/app/assets/ai/moss.png'},
  cerbanimo:{guide:'Kamiya',artifact:'/app/assets/ai/kamiya-gift.png',avatar:'/app/assets/ai/kamiya.png'},
  fellowfare:{guide:'Rook',artifact:'/app/assets/ai/rook-coin-button.png',avatar:'/app/assets/ai/rook.png'},
  anarchadia:{guide:'Merlin',artifact:'/app/assets/ai/merlin-hat.png',avatar:'/app/assets/ai/merlin.png'}
};
assert(host.includes('location.replace')&&!host.includes('<iframe'),'Compatibility family host must redirect without an iframe.');
for(const route of ['/app/working-campus-v156.html','/app/cabinets/living-school/index.html','/app/realm-console-v140.html?system=cerbanimo','/app/fellowfare-cabinet-v144.html','/app/anarchadia-console-v139.html'])assert(host.includes(route),`Compatibility host missing ${route}`);
assert(entry.includes("const requested=params.get('system')||params.get('target')||'commonweave'")&&entry.includes('(sites[system]||sites.commonweave)')&&entry.includes("destination.searchParams.set('installed','1')"),'Installed entry must resolve the requested system through direct installed routes.');
const manifest=JSON.parse(manifestRaw);assert(manifest.start_url.includes('system=commonweave'),'Commonweave must remain the first installed screen.');assert(manifest.shortcuts.length===5,'Every system needs a direct shortcut.');
for(const token of ["const VERSION='1.0.4'","const VISUAL_SHELLS={primary:'merlinites-r1',legacy:'sol-r1'}","const SYSTEM_ORDER=['commonweave','living-school','cerbanimo','fellowfare','anarchadia']",'tray.innerHTML=SYSTEM_ORDER.map','data-cwf-badge','data-cwf-state','data-cwf-chat','[data-ai-settings]','[data-capability="commonweave.model-setup"]',"document.documentElement.dataset.familyShell='direct'",'document.documentElement.dataset.visualShell=VISUAL_SHELLS.primary','document.documentElement.dataset.visualShellLegacy=VISUAL_SHELLS.legacy','Talk to Commonweave with Weaveling'])assert(shell.includes(token),`Family shell contract missing ${token}`);
assert(!shell.includes("filter(([id])=>id!==current)"),'The active realm is still being removed from the fixed dock.');
assert(!shell.includes('MutationObserver')&&!shell.includes('contentDocument'),'Family shell must not observe nested documents.');
for(const token of ['CommonweaveModelSettingsV133','CommonweaveGuideChatV153','async function ensure()'])assert(loader.includes(token),`Lazy family AI contract missing ${token}`);
for(const pathName of ['/app/fullscreen-family-v104.html','/app/family-shell-v104.css','/app/family-shell-v104.js'])assert(worker.includes(pathName),`Offline package missing ${pathName}`);
for(const retired of ['/app/assets/cabinets/commonweave.webp','/app/assets/world/town-square-home.webp','/app/cabinet-calibrator-v144.html','/app/shared/cabinet-shells-v129.json'])assert(!worker.includes(retired),`Retired install payload remains: ${retired}`);
const sandbox={console,URLSearchParams,location:{search:'?system=commonweave',pathname:'/app/fullscreen-family-v104.html',assign(){},replace(){}},localStorage:{getItem(){return null},setItem(){}},document:{readyState:'loading'},addEventListener(){},setInterval(){},globalThis:null};sandbox.globalThis=sandbox;vm.createContext(sandbox);vm.runInContext(shell,sandbox);
const runtime=sandbox.CommonweaveFamilyShellV104;assert(runtime,'Family shell did not expose its runtime contract.');assert(JSON.stringify(Array.from(runtime.systemOrder))===JSON.stringify(expectedOrder),'Runtime realm order does not match the fixed five-realm order.');assert(JSON.stringify(Object.keys(runtime.systems))===JSON.stringify(expectedOrder),'Runtime systems are missing or reordered.');
assert(runtime.visualShells?.primary==='merlinites-r1','Merlinites is not the primary local visual-shell identity.');assert(runtime.visualShells?.legacy==='sol-r1','Sol compatibility identity was removed during the rename.');
for(const id of expectedOrder){const actual=runtime.systems[id],expected=expectedSystems[id];assert(actual,`Runtime system ${id} is missing.`);for(const [key,value] of Object.entries(expected))assert(actual[key]===value,`${id} ${key} is ${actual[key]}, expected ${value}.`)}
console.log('Fixed five-realm Commonweave family v1.0.4 verification passed with Merlinites and Sol aliases.');
