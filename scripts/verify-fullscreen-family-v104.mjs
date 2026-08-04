import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import process from 'node:process';
const root=process.cwd();
const read=file=>fs.readFile(path.join(root,file),'utf8');
const assert=(value,message)=>{if(!value)throw new Error(message)};
const [shell,host,entry,manifest,worker]=await Promise.all([
  read('public/app/family-shell-v104.js'),read('public/app/fullscreen-family-v104.html'),read('public/app/installed-entry-v146.js'),read('public/app/manifest.webmanifest'),read('public/service-worker.js')
]);
assert(host.includes('id="cwf104-frame"'),'Full-screen host needs the software iframe.');
assert(entry.includes("destination.searchParams.set('system'"),'Installed entry must preserve requested system.');
const data=JSON.parse(manifest);assert(data.start_url.includes('system=commonweave'),'Commonweave must be the first installed screen.');assert(data.shortcuts.length===5,'Every system needs a direct shortcut.');
for(const token of ["const VERSION='1.0.4'",'.filter(([id])=>id!==current)','data-cwf-badge','data-cwf-state','CommonweaveModelSettingsV133','CommonweaveGuideChatV153','[data-ai-settings]','[data-capability="commonweave.model-setup"]'])assert(shell.includes(token),`Family shell contract missing ${token}`);
for(const pathName of ['/app/fullscreen-family-v104.html','/app/family-shell-v104.css','/app/family-shell-v104.js'])assert(worker.includes(pathName),`Offline package missing ${pathName}`);
for(const retired of ['/app/assets/cabinets/commonweave.webp','/app/assets/world/town-square-home.webp','/app/cabinet-calibrator-v144.html','/app/shared/cabinet-shells-v129.json'])assert(!worker.includes(retired),`Retired install payload remains: ${retired}`);
const sandbox={console,URLSearchParams,location:{search:'?system=commonweave',pathname:'/app/fullscreen-family-v104.html',assign(){},replace(){}},localStorage:{getItem(){return null}},document:{readyState:'loading'},addEventListener(){},setInterval(){},globalThis:null};sandbox.globalThis=sandbox;vm.createContext(sandbox);vm.runInContext(shell,sandbox);assert(Object.keys(sandbox.CommonweaveFamilyShellV104.systems).length===5,'Runtime must expose all five systems.');
console.log('Full-screen Commonweave family v1.0.4 verification passed.');
