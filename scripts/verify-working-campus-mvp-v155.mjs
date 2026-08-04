import {readFile} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const parts=['public/app/working-campus-v156.part1.txt','public/app/working-campus-v156.part2.txt','public/app/working-campus-v156.part3.txt','public/app/working-campus-v156.part4.txt','public/app/working-campus-v156.part5.txt'];
const [host,html,css,loader,entry,...sources]=await Promise.all([
  read('public/app/fullscreen-family-v104.html'),
  read('public/app/working-campus-v156.html'),
  read('public/app/working-campus-v156.css'),
  read('public/app/working-campus-v156.js'),
  read('public/app/installed-entry-v146.js'),
  ...parts.map(read)
]);
const source=sources.join(''),surface=`${html}\n${css}\n${source}`;
for(const token of [
  'Commonweave Working Campus','What is your wish?','Aptitude and learning choice',
  'Build reviewable weave','Activate weave','Guided rails','Free roam',
  'commonweave.working-campus.v1','commonweave.intentions.v127',
  'commonweave.realm-inbox.v1','commonweave.context.v1',
  'commonweave.active-handoff.v1','commonweave.intention-weave.v1',
  'Google Gemini','gemini-3.5-flash-lite','Test Gemini','Test Antigravity',
  'working-campus-antigravity-test','commonweave-model-profiles-v1',
  '/app/assets/ai/weaveling.png','/app/assets/ai/moss.png','/app/assets/ai/kamiya.png',
  '/app/assets/ai/rook.png','/app/assets/ai/merlin.png'
])assert(surface.toLowerCase().includes(token.toLowerCase()),`Working Campus is missing ${token}`);
for(const route of [
  '/app/working-campus-v156.html',
  '/app/cabinets/living-school/index.html',
  '/app/realm-console-v140.html?system=cerbanimo',
  '/app/fellowfare-cabinet-v144.html',
  '/app/anarchadia-console-v139.html'
])assert(host.includes(route)||source.includes(route),`Working Campus is missing route ${route}`);
assert(host.includes('location.replace')&&!host.includes('<iframe'),'Compatibility host must remain direct and iframe-free.');
assert(loader.includes("source.join('')")&&parts.every(file=>loader.includes('/app/'+path.basename(file))),'Working Campus loader does not assemble every cached source part.');
assert(entry.includes("system==='commonweave'?'/app/fullscreen-family-v104.html?system=commonweave'"),'Installed entry does not boot the Working Campus.');
new vm.Script(source,{filename:'working-campus-v156.js'});
new vm.Script(loader,{filename:'working-campus-v156-loader.js'});
console.log(JSON.stringify({ok:true,surface:'working-campus-v156',sourceFiles:parts.length,coreLoop:'wish -> aptitude -> review -> activation -> realm handoffs',modelTests:['gemini','antigravity'],navigation:'direct full-screen',offlineState:'local canonical'},null,2));
