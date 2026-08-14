import {readFile} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const parts=['public/app/working-campus-v156.part1.txt','public/app/working-campus-v156.part2.txt','public/app/working-campus-v156.part3.txt','public/app/working-campus-v156.part4.txt','public/app/working-campus-v156.part5.txt'];
const [host,html,css,loader,entry,settings,routes,...sources]=await Promise.all([
  read('public/app/fullscreen-family-v104.html'),
  read('public/app/working-campus-v156.html'),
  read('public/app/working-campus-v156.css'),
  read('public/app/working-campus-v156.js'),
  read('public/app/installed-entry-v146.js'),
  read('public/app/model-settings-controller-v173.js'),
  read('public/app/system-routes-v227.js'),
  ...parts.map(read)
]);
const source=sources.join(''),surface=`${html}\n${css}\n${source}`;
for(const token of [
  'Civweave Working Campus','What is your wish?','Aptitude and learning choice',
  'Build reviewable weave','Activate weave','Guided rails','Free roam',
  'civweave.working-campus.v1','civweave.intentions.v127',
  'civweave.realm-inbox.v1','civweave.context.v1',
  'civweave.active-handoff.v1','civweave.intention-weave.v1',
  '/app/assets/ai/weaveling.png','/app/assets/ai/moss.png','/app/assets/ai/kamiya.png',
  '/app/assets/ai/rook.png','/app/assets/ai/merlin.png'
])assert(surface.toLowerCase().includes(token.toLowerCase()),`Working Campus is missing ${token}`);

for(const token of [
  "activation:'settings-gateway-v317'",
  "route:'deterministic'",
  'civweave-model-profiles-v1',
  'Credential lifetime',
  'Remember on this device',
  'S.A.F.E. mode',
  'Nothing probes, starts, or tests a model merely because this panel opened.'
])assert(settings.includes(token),`Canonical AI settings are missing ${token}`);
assert(settings.includes('gemini-3.5-flash-lite')&&settings.includes('https://generativelanguage.googleapis.com/v1beta'),'Canonical settings must retain the explicit Gemini option without making it the startup default.');
assert(!surface.includes('Test Gemini')&&!surface.includes('Test Antigravity'),'Working Campus should not own retired provider-test controls.');

const expectedRoutes={
  civweave:'/app/working-campus-v156.html',
  'living-school':'/app/cabinets/living-school/index.html',
  cerbanimo:'/app/realm-console-v140.html',
  fellowfare:'/app/fellowfare-cabinet-v144.html',
  anarchadia:'/app/anarchadia-console-v139.html'
};
for(const [system,pathname] of Object.entries(expectedRoutes)){
  assert(routes.includes(`${system==='living-school'?"'living-school'":system}:Object.freeze`)||routes.includes(`'${system}':Object.freeze`),`Canonical route contract is missing ${system}.`);
  assert(routes.includes(`pathname:'${pathname}'`),`Canonical route contract is missing ${system} pathname ${pathname}.`);
}
assert(routes.includes("cerbanimo:Object.freeze({id:'cerbanimo'")&&routes.includes("params:Object.freeze({system:'cerbanimo',cabinet:'1'})"),'Cerbanimo canonical route must retain its system and cabinet parameters.');
assert(routes.includes("'living-school':Object.freeze")&&routes.includes("params:Object.freeze({cabinet:'1'})"),'Living School canonical route must remain cabinet-scoped.');
assert(host.includes('location.replace')&&!host.includes('<iframe'),'Compatibility host must remain direct and iframe-free.');
assert(loader.includes("source.join('')")&&parts.every(file=>loader.includes('/app/'+path.basename(file))),'Working Campus loader does not assemble every cached source part.');
assert(entry.includes("const requested=params.get('system')||params.get('target')||'civweave'")&&entry.includes('routes.urlFor(')&&entry.includes("new URL('/app/working-campus-v156.html',location.origin)"),'Installed entry does not route Civweave through the canonical five-system contract with a direct Working Campus fallback.');
assert(entry.includes("bounded(registration.update(),WORKER_STEP_TIMEOUT_MS,'service worker update')"),'Installed entry must bound service-worker update so startup cannot hang indefinitely.');
new vm.Script(source,{filename:'working-campus-v156.js'});
new vm.Script(loader,{filename:'working-campus-v156-loader.js'});
new vm.Script(settings,{filename:'model-settings-controller-v173.js'});
new vm.Script(routes,{filename:'system-routes-v227.js'});
console.log(JSON.stringify({ok:true,surface:'working-campus-v156',sourceFiles:parts.length,coreLoop:'wish -> aptitude -> review -> activation -> realm handoffs',aiSettings:'gateway-activated deterministic-default clean-room controller with explicit provider options',providerTests:'retired from Working Campus',navigation:'canonical five-system route owner with direct Working Campus fallback',installedBoot:'bounded service-worker update before routing',offlineState:'local canonical'},null,2));
