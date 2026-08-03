import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFile(path.join(root,p),'utf8');
const assert=(value,message)=>{if(!value)throw new Error(message)};
const [cabinet,school]=await Promise.all([
  read('public/app/cabinet-mode-v142.js'),
  read('public/app/cabinets/living-school/index.html')
]);
assert(cabinet.includes("system?.id==='living-school'"),'Cabinet Mode does not select the dedicated Living School runtime');
assert(cabinet.includes('/app/cabinets/living-school/index.html'),'Dedicated Living School cabinet URL is missing');
for(const token of ['Pathway Desk','Curriculum Forge','Lesson Atelier','Constellation Observatory','Practicum Workshop','Credential Forge'])assert(school.includes(token),`Living School cabinet missing ${token}`);
for(const token of ['school.forged','diagnostic.completed','lesson.completed','assessment.passed','practicum.saved','cerbanimo.quest.accepted','final.passed','credential.issued'])assert(school.includes(token),`Golden-path receipt missing ${token}`);
for(const token of ['data-room','data-object','data-action','aria-label="Room actions"'])assert(school.includes(token),`Shared visual/accessibility action contract missing ${token}`);
assert(school.includes('commonweave.living-school.cabinet.v150'),'Versioned Living School local state is missing');
assert(school.includes('clip-path:polygon'),'In-world shaped instruments are missing');
assert(school.includes("mode:'local-cabinet-test'"),'Local test receipt must be marked as a test receipt');
assert(!school.includes('realm-console-v140'),'Living School cabinet must not mount the generic realm console');
console.log(JSON.stringify({ok:true,mode:'cabinet-only',system:'living-school',rooms:6,goldenPath:['forge','diagnostic','lesson','assessment','practicum','cerbanimo-test-receipt','final','credential']},null,2));
