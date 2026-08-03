import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root=process.cwd();
const read=file=>fs.readFile(path.join(root,file),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const [realmArchive,loom,assistant,contracts,planner,realmHtml,loomHtml,cabinetHtml,serviceWorker]=await Promise.all([
  read('public/app/realm-v141.js'),
  read('public/app/loom-v141.js'),
  read('public/app/assistant-runtime-v141.js'),
  read('public/app/guide-contracts-v141.js'),
  read('public/app/intention-planner-v141.js'),
  read('public/app/realm-v128.html'),
  read('public/app/loom-v128.html'),
  read('public/app/cabinet-mode-v142.html'),
  read('public/service-worker.js')
]);

assert(realmArchive.includes('node.innerHTML=html'),'Archived realm controller must preserve its dialog implementation for source history.');
assert(!realmArchive.includes('function guideAnswer'),'Archived realm controller must not contain the canned guide speaker.');
assert(!realmArchive.includes("querySelector('form').onsubmit"),'Archived realm controller must not install a competing canned submit handler.');
assert(realmArchive.includes('CommonweaveAssistantV141?.attach?.(node)'),'Archived realm source must retain shared assistant integration.');
assert(loom.includes('CommonweaveAssistantV141?.attach?.(node)'),'Weaveling must attach the shared assistant runtime.');
assert(!loom.includes('function answerFor'),'Loom controller must not contain the legacy canned answer router.');
assert(!loom.includes("querySelector('form').onsubmit"),'Loom controller must not install a competing canned submit handler.');
assert(loom.includes('CommonweaveParity.cabinetUrl'),'Hub realm entry must route into Cabinet Mode.');

assert(planner.includes("currentSystem(context)!=='commonweave'"),'Automatic intention planning must be scoped to Weaveling/Commonweave.');
assert(planner.includes('time looper')&&planner.includes('time traveler'),'Planner must retain the specialized temporal game route.');
assert(planner.includes('function restore'),'Planner must support restoring a gate from its chat snapshot.');
assert(planner.includes('plan.id=duplicate.id'),'Duplicate plans must retain one stable stored ID.');

for(const required of ['cerbanimo','fellowfare','anarchadia','living','Approve request & begin rails','Approve & publish request'])assert(contracts.includes(required),`Guide contracts are missing: ${required}`);
for(const required of ['CommonweaveIntentionPlanner?.restore','Never identify yourself as being "from" the current room'])assert(assistant.includes(required),`Assistant runtime is missing contract: ${required}`);
assert(contracts.includes("a.kind==='feature-request'")&&contracts.includes('cerbanimo.quest.linked'),'Dark-mode approval must create a linked Cerbanimo quest.');
assert(contracts.includes("a.kind==='trade-request'")&&contracts.includes('fellowfare.need-card.published'),'Food requests must publish through the FellowFare contract after approval.');
assert(contracts.includes('Do you mean the Dougie dance'),'Moss must clarify “duggy” rather than creating a global intention.');

assert(loomHtml.includes('/app/intention-planner-v141.js'),'Hub HTML must load the v141 planner.');
assert(loomHtml.includes('/app/assistant-runtime-v141.js'),'Hub HTML must load the v141 assistant.');
assert(loomHtml.includes('/app/loom-v141.js'),'Hub HTML must load the active hub controller.');
assert(realmHtml.includes('/app/cabinet-mode-v142.html'),'Legacy realm HTML must redirect to Cabinet Mode.');
assert(!realmHtml.includes('/app/realm-v141.js'),'Legacy realm HTML must not load the archived location-scene controller.');
assert(cabinetHtml.includes('CABINET MODE'),'Cabinet Mode HTML is missing its canonical mode label.');
assert(serviceWorker.includes('guide-orchestration-r21'),'Service worker revision must evict the stale canned guide cache.');
assert(serviceWorker.includes('/app/assistant-runtime-v141.js')&&serviceWorker.includes('/app/guide-contracts-v141.js'),'Service worker must cache the active guide runtimes.');
assert(serviceWorker.includes('/app/loom-v141.js'),'Service worker must cache the active hub controller.');
assert(!serviceWorker.includes("'/app/realm-v141.js'"),'Service worker must not precache the archived location-scene controller.');

console.log('Guide orchestration v141 verification passed in Cabinet Mode.');
