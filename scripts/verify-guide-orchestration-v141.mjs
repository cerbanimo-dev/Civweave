import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root=process.cwd();
const read=file=>fs.readFile(path.join(root,file),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const [realm,loom,assistant,contracts,planner,realmHtml,loomHtml,serviceWorker]=await Promise.all([
  read('public/app/realm-v141.js'),
  read('public/app/loom-v141.js'),
  read('public/app/assistant-runtime-v141.js'),
  read('public/app/guide-contracts-v141.js'),
  read('public/app/intention-planner-v141.js'),
  read('public/app/realm-v128.html'),
  read('public/app/loom-v128.html'),
  read('public/service-worker.js')
]);

assert(realm.includes('node.innerHTML=html'),'Realm dialogs must insert their HTML on first open.');
assert(!realm.includes('function guideAnswer'),'Realm controller must not contain the canned guide speaker.');
assert(!realm.includes("querySelector('form').onsubmit"),'Realm controller must not install a competing canned submit handler.');
assert(realm.includes('CommonweaveAssistantV141?.attach?.(node)'),'Realm guide must attach the shared assistant runtime.');
assert(loom.includes('CommonweaveAssistantV141?.attach?.(node)'),'Weaveling must attach the shared assistant runtime.');
assert(!loom.includes('function answerFor'),'Loom controller must not contain the legacy canned answer router.');
assert(!loom.includes("querySelector('form').onsubmit"),'Loom controller must not install a competing canned submit handler.');

assert(planner.includes("currentSystem(context)!=='commonweave'"),'Automatic intention planning must be scoped to Weaveling/Commonweave.');
assert(planner.includes('time looper')&&planner.includes('time traveler'),'Planner must retain the specialized temporal game route.');
assert(planner.includes('function restore'),'Planner must support restoring a gate from its chat snapshot.');
assert(planner.includes('plan.id=duplicate.id'),'Duplicate plans must retain one stable stored ID.');

for(const required of ['cerbanimo','fellowfare','anarchadia','living','Approve request & begin rails','Approve & publish request'])assert(contracts.includes(required),`Guide contracts are missing: ${required}`);
for(const required of ['CommonweaveIntentionPlanner?.restore','Never identify yourself as being "from" the current room'])assert(assistant.includes(required),`Assistant runtime is missing contract: ${required}`);
assert(contracts.includes("a.kind==='feature-request'")&&contracts.includes('cerbanimo.quest.linked'),'Dark-mode approval must create a linked Cerbanimo quest.');
assert(contracts.includes("a.kind==='trade-request'")&&contracts.includes('fellowfare.need-card.published'),'Food requests must publish through the FellowFare contract after approval.');
assert(contracts.includes('Do you mean the Dougie dance'),'Moss must clarify “duggy” rather than creating a global intention.');

for(const html of [realmHtml,loomHtml]){
  assert(html.includes('/app/intention-planner-v141.js'),'Visual HTML must load the v141 planner.');
  assert(html.includes('/app/assistant-runtime-v141.js'),'Visual HTML must load the v141 assistant.');
}
assert(realmHtml.match(/intention-planner-v141\.js/g)?.length===1,'Realm HTML must load the intention planner exactly once.');
assert(realmHtml.includes('/app/realm-v141.js'),'Realm HTML must load the v141 controller.');
assert(loomHtml.includes('/app/loom-v141.js'),'Loom HTML must load the v141 controller.');
assert(serviceWorker.includes('guide-orchestration-r21'),'Service worker revision must evict the stale canned guide cache.');
assert(serviceWorker.includes('/app/assistant-runtime-v141.js')&&serviceWorker.includes('/app/guide-contracts-v141.js'),'Service worker must cache the active guide runtimes.');
assert(serviceWorker.includes('/app/realm-v141.js')&&serviceWorker.includes('/app/loom-v141.js'),'Service worker must cache active page controllers.');

console.log('Guide orchestration v141 verification passed.');
