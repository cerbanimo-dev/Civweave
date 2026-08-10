import {readFile} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const parts=['public/app/working-campus-v156.part1.txt','public/app/working-campus-v156.part2.txt','public/app/working-campus-v156.part3.txt','public/app/working-campus-v156.part4.txt','public/app/working-campus-v156.part5.txt'];
const [host,html,css,loader,entry,settings,...sources]=await Promise.all([
  read('public/app/fullscreen-family-v104.html'),
  read('public/app/working-campus-v156.html'),
  read('public/app/working-campus-v156.css'),
  read('public/app/working-campus-v156.js'),
  read('public/app/installed-entry-v146.js'),
  read('public/app/model-settings-controller-v173.js'),
  ...parts.map(read)
]);
const source=sources.join(''),surface=`${html}\n${css}\n${source}`;
for(const token of[
  'Civweave Working Campus','What is your wish?','Aptitude and learning choice',
  'Build reviewable weave','Activate weave','Guided rails','Free roam',
  'civweave.working-campus.v1','civweave.intentions.v127',
  'civweave.realm-inbox.v1','civweave.context.v1',
  'civweave.active-handoff.v1','civweave.intention-weave.v1',
  '/app/assets/ai/weaveling.png','/app/assets/ai/moss.png','/app/assets/ai/kamiya.png',
  '/app/assets/ai/rook.png','/app/assets/ai/merlin.png'
])assert(surface.toLowerCase().includes(token.toLowerCase()),`Working Campus is missing ${token}`);
for(const token of[
  'Google Gemini','gemini-3.5-flash-lite','https://generativelanguage.googleapis.com/v1beta',
  'civweave-model-profiles-v1','Remember on this device','single-cleanroom-controller'
])assert(settings.toLowerCase().includes(token.toLowerCase()),`Canonical AI settings are missing ${token}`);
assert(!surface.includes('Test Gemini')&&!surface.includes('Test Antigravity'),'Working Campus should not own retired provider-test controls.');
for(const route of[
  '/app/working-campus-v156.html',
  '/app/cabinets/living-school/index.html',
  '/app/realm-console-v140.html?system=cerbanimo',
  '/app/fellowfare-cabinet-v144.html',
  '/app/anarchadia-console-v139.html'
])assert(host.includes(route)||source.includes(route),`Working Campus is missing route ${route}`);
assert(host.includes('location.replace')&&!host.includes('<iframe'),'Compatibility host must remain direct and iframe-free.');
assert(loader.includes("source.join('')")&&parts.every(file=>loader.includes('/app/'+path.basename(file))),'Working Campus loader does not assemble every cached source part.');
assert(entry.includes("const requested=params.get('system')||params.get('target')||'civweave'")&&entry.includes("const LOCAL_ROUTES=Object.freeze({")&&entry.includes("civweave:'/app/working-campus-v156.html'")&&entry.includes('location.replace(localDestination(system,releaseVersion).href)'),'Installed entry does not route Civweave through the built-in local-first five-system contract with a direct Working Campus destination.');
new vm.Script(source,{filename:'working-campus-v156.js'});
new vm.Script(loader,{filename:'working-campus-v156-loader.js'});
new vm.Script(settings,{filename:'model-settings-controller-v173.js'});
console.log(JSON.stringify({ok:true,surface:'working-campus-v156',sourceFiles:parts.length,coreLoop:'wish -> aptitude -> review -> activation -> realm handoffs',aiSettings:'shared clean-room controller with Gemini defaults',providerTests:'retired from Working Campus',navigation:'built-in local-first five-system route with direct Working Campus destination',offlineState:'local canonical'},null,2));
