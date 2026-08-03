import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const [html,css,js,launcher,launcherCss,shellsText,sw]=await Promise.all([
  read('public/app/realm-console-v140.html'),read('public/app/realm-console-v140.css'),read('public/app/realm-console-v140.js'),read('public/app/v130-cabinet-launcher.js'),read('public/app/v130-cabinet-launcher.css'),read('public/app/shared/cabinet-shells-v129.json'),read('public/service-worker.js')
]);
const chunks=[];for(let i=1;i<=4;i+=1)chunks.push(await read(`public/app/shared/commonweave-parity-ledger.part${i}.b64`));
const ledger=JSON.parse(gunzipSync(Buffer.from(chunks.join('').replace(/\s+/g,''),'base64')).toString('utf8'));
const shells=JSON.parse(shellsText).systems;
for(const token of ['Commonweave Realm Console','realm-console-v140.css','realm-console-v140.js'])assert(html.includes(token),`console HTML missing ${token}`);
for(const token of ['data-system="living-school"','data-system="cerbanimo"','data-system="fellowfare"','data-system="commonweave"','.rc-feature-grid','.rc-room-nav','.rc-cap-grid','.rc-form'])assert(css.includes(token),`console CSS missing ${token}`);
for(const token of ["commonweave.realm-console.v140","Commonweave","Living School","Cerbanimo","FellowFare","roomWorkspace","capabilityDetail","schemaFor","applyEffects","living-school.send-quest","cerbanimo.publish-need"])assert(js.includes(token),`console runtime missing ${token}`);
assert(!js.includes('sourceRoute'),'realm console still routes capabilities to legacy source pages');
for(const forbidden of ['eval(', 'new Function(', 'document.cookie'])assert(!js.includes(forbidden),`console runtime contains forbidden ${forbidden}`);
for(const system of ledger.systems){for(const room of system.rooms){for(const id of room.capabilityIds||[]){const cap=ledger.capabilities.find(item=>item.id===id);assert(cap,`room ${room.id} references missing capability ${id}`);assert(cap.system===system.id,`${id} is assigned to ${cap.system}, expected ${system.id}`);assert(cap.room===room.id,`${id} is assigned to room ${cap.room}, expected ${room.id}`)}}}
assert(launcher.includes('realmSrcdoc'),'non-Anarchadia realms are not mounted as cabinet screen documents');
assert(launcher.includes('/app/realm-console-v140.css'),'srcdoc does not load the shared realm presentation');
assert(launcher.includes('/app/realm-console-v140.js'),'srcdoc does not load the functional realm runtime');
assert(launcher.includes('/app/anarchadia-console-v139.html?embed=1'),'Anarchadia lost its dedicated citizen console');
for(const token of ['SHELLS_URL','cw-cabinet-frame-art','--cw-screen-x','--cw-screen-clip','data-cabinet-system'])assert(launcher.includes(token),`cabinet launcher missing ${token}`);
for(const token of ['.cw-cabinet-frame','.cw-cabinet-frame-art','.cw-cabinet-frame iframe','.cw-cabinet-frame-controls'])assert(launcherCss.includes(token),`cabinet CSS missing ${token}`);
for(const [id,shell] of Object.entries(shells)){assert(shell.asset===`/app/assets/cabinets/${id}.webp`,`wrong physical cabinet asset for ${id}`);assert(Number(shell.screen?.width)>50&&Number(shell.screen?.height)>50,`invalid screen aperture for ${id}`)}
assert(sw.includes("CACHE_REVISION='minilm-runtime-r19'"),'MiniLM cache contract changed unexpectedly');
assert(sw.includes("CABINET_REVISION='realm-cabinets-r18'"),'cabinet cache was not rotated');
for(const asset of ['/app/realm-console-v140.html','/app/realm-console-v140.css','/app/realm-console-v140.js'])assert(sw.includes(asset),`service worker missing ${asset}`);
console.log(JSON.stringify({ok:true,systems:ledger.systems.map(s=>({id:s.id,rooms:s.rooms.length,capabilities:ledger.capabilities.filter(c=>c.system===s.id).length})),physicalCabinets:Object.keys(shells),cacheRevision:'minilm-runtime-r17-realm-cabinets-r18'},null,2));
