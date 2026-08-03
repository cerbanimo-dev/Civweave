import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const [html,css,loader,router,worker,...parts]=await Promise.all([
  read('public/app/living-school-cabinet-v150.html'),
  read('public/app/living-school-cabinet-v150.css'),
  read('public/app/living-school-cabinet-v150.js'),
  read('public/app/cabinet-mode-v142.js'),
  read('public/service-worker.js'),
  read('public/app/living-school-cabinet-v150.c0.b64'),
  read('public/app/living-school-cabinet-v150.c1.b64'),
  read('public/app/living-school-cabinet-v150.c2.b64')
]);
const runtime=gunzipSync(Buffer.from(parts.join('').replace(/\s+/g,''),'base64')).toString('utf8');
new Function(runtime);
for(const token of ['data-build="living-school-cabinet-v150"','living-school-cabinet-v150.css','living-school-cabinet-v150.js','Opening Living School'])assert(html.includes(token),`Living School HTML missing ${token}`);
for(const token of ['ls-room-scene','ls-object-shape','ls-surface-overlay','ls-constellation','ls-action-list','prefers-reduced-motion'])assert(css.includes(token),`Living School CSS missing ${token}`);
for(const token of ['DecompressionStream','living-school-cabinet-v150.c0.b64','living-school-cabinet-v150.c1.b64','living-school-cabinet-v150.c2.b64'])assert(loader.includes(token),`Living School loader missing ${token}`);
const rooms=['Pathway Desk','Moss’s Study','Curriculum Forge','Research Conservatory','Great Library','Learning Map','Lesson Atelier','Constellation Observatory','Practicum Workshop','Cerbanimo Bridge','Peer Review Hall','Credential Forge','Cohort Commons','Human Help Exchange','Creator & Systems Loft'];
for(const room of rooms)assert(runtime.includes(room),`Living School runtime missing room ${room}`);
const capabilities=['start-path','diagnostic','curriculum','assessment','models','research','sources','media','starters','library','market','portable','route','lesson','quiz','exercise','constellation','retrieval','misconceptions','practicum','practica','artifacts','quest','project-gate','final-test','peer-review','rubric','appeals','passport','badges','xp','cohorts','assignments','institution','help','experts','engagements','credits','creator','storefront','settings','backup'];
for(const capability of capabilities)assert(runtime.includes(`'${capability}'`)||runtime.includes(`data-action="${capability}"`),`Living School runtime missing ${capability}`);
for(const token of ['commonweave.living-school.cabinet.v150','commonweave.realm-console.v140','Explicit confirmation is required','Accepted status requires evidence or a review ID','living-school.send-quest',"'project-gate'",'living-school-public-passport.json','living-school-cabinet-backup.json'])assert(runtime.includes(token),`Living School state or safety contract missing ${token}`);
assert(router.includes("system?.id==='living-school'"),'Cabinet router does not select the dedicated Living School runtime');
assert(router.includes('/app/living-school-cabinet-v150.html'),'Cabinet router is missing the Living School document');
for(const asset of ['/app/living-school-cabinet-v150.html','/app/living-school-cabinet-v150.css','/app/living-school-cabinet-v150.js','/app/living-school-cabinet-v150.c0.b64','/app/living-school-cabinet-v150.c1.b64','/app/living-school-cabinet-v150.c2.b64'])assert(worker.includes(asset),`Device package is missing ${asset}`);
assert(worker.includes("CACHE_REVISION='cabinet-mode-r23-living-school'"),'Living School cache revision was not rotated');
console.log(JSON.stringify({ok:true,mode:'Cabinet Mode',system:'living-school',rooms:rooms.length,capabilitySurfaces:capabilities.length,runtimeBytes:Buffer.byteLength(runtime),offlineParts:parts.length,projectEvidenceGate:true,migration:true},null,2));
