import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root=process.cwd();
const read=file=>fs.readFile(path.join(root,file),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const [realmArchive,loom,assistant,contracts,planner,coreLoop,guideChat,capabilityReadiness,realmHtml,loomHtml,cabinetHtml,realmConsoleHtml,livingHtml,fellowfareHtml,anarchadiaHtml,serviceWorker]=await Promise.all([
  read('public/app/realm-v141.js'),
  read('public/app/loom-v141.js'),
  read('public/app/assistant-runtime-v141.js'),
  read('public/app/guide-contracts-v141.js'),
  read('public/app/intention-planner-v141.js'),
  read('public/app/core-loop-v152.js'),
  read('public/app/guide-chat-v153.js'),
  read('public/app/capability-readiness-v154.js'),
  read('public/app/realm-v128.html'),
  read('public/app/loom-v128.html'),
  read('public/app/cabinet-mode-v142.html'),
  read('public/app/realm-console-v140.html'),
  read('public/app/cabinets/living-school/index.html'),
  read('public/app/fellowfare-cabinet-v144.html'),
  read('public/app/anarchadia-console-v139.html'),
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

for(const required of ['commonweave.core-loop.v152','commonweave.living-school.intake.v152','commonweave.cerbanimo.quest-queue.v1','commonweave.fellowfare.resource-queue.v152','commonweave.anarchadia.passport.v152'])assert(coreLoop.includes(required),`Core loop is missing durable contract: ${required}`);
assert(coreLoop.includes('ui.activate=x=>'),'Intention activation must materialize the child-system route.');
assert(coreLoop.includes("receipt(plan,'living-school','learning-path'"),'Activation must create a Living School handoff.');
assert(coreLoop.includes("receipt(plan,'cerbanimo','project-blueprint'"),'Activation must create a Cerbanimo handoff.');
assert(coreLoop.includes("receipt(plan,'fellowfare','material-route'"),'Activation must create a FellowFare handoff.');
assert(coreLoop.includes("receipt(plan,'anarchadia','passport-thread'"),'Activation must preserve the intention in Anarchadia.');
assert(coreLoop.includes("closest?.('#moss')")&&coreLoop.includes("chat('living-school')"),'The Moss object must open a live guide chat instead of a stale information panel.');
assert(coreLoop.includes("source:'commonweave-core-loop-v152'")&&coreLoop.includes('assessmentPassed:false'),'Living School intake must become native curriculum state.');

for(const required of ["commonweave:{name:'Commonweave'","'living-school':{name:'Living School'","cerbanimo:{name:'Cerbanimo'","fellowfare:{name:'FellowFare'","anarchadia:{name:'Anarchadia'"])assert(guideChat.includes(required),`Five-system chat runtime is missing: ${required}`);
assert(guideChat.includes('CommonweaveAssistantV141.respond'),'Guide chat must send through the shared assistant runtime.');
assert(guideChat.includes('data-gc-gate="activate-plan"')&&guideChat.includes('data-gc-gate="approve-action"'),'Guide chat must expose plan and action approval controls.');
assert(guideChat.includes('gc153-launcher')&&guideChat.includes('Talk to ${esc(item.guide)}'),'Every system must receive a visible guide launcher.');
assert(guideChat.includes('commonweave.guide-chat.${system}.v153'),'Every guide conversation must persist locally by system.');

for(const required of ['commonweave.capability-readiness.v154','commonweave.capability-map.v154','Learn first','Practice while doing','Recruit help','Simplify scope'])assert(capabilityReadiness.includes(required),`Capability readiness is missing contract: ${required}`);
assert(capabilityReadiness.includes('[0,1,2,3,4]')&&capabilityReadiness.includes('Current level'),'Capability readiness must expose the 0–4 starting-level assessment.');
assert(capabilityReadiness.includes('currentScore')&&capabilityReadiness.includes('preparedScore'),'Capability readiness must calculate current and prepared readiness.');
assert(capabilityReadiness.includes('cr154-summary')&&capabilityReadiness.includes('cr154-dialog'),'Capability readiness must have a visible summary and assessment surface.');
assert(capabilityReadiness.includes("document.querySelector('#gc153-dialog .gc153-shell')"),'Capability lanes must render inside the live guide conversation.');
assert(capabilityReadiness.includes("document.querySelectorAll('.cw138-plan[data-plan-id]')"),'The full capability map must render in the weave review interface.');
assert(capabilityReadiness.includes('Complete the capability map before activating this weave.'),'Incomplete readiness must block accidental activation.');
assert(capabilityReadiness.includes('Learn and demonstrate'),'Learn-first choices must alter the Living School path.');
assert(capabilityReadiness.includes('supported checkpoint'),'Practice choices must alter the Cerbanimo path.');
assert(capabilityReadiness.includes('collaborator or provider'),'Recruit choices must alter the FellowFare path.');
assert(capabilityReadiness.includes('Reduce the requirement'),'Simplify choices must become explicit scope changes.');
assert(capabilityReadiness.includes("globalThis.CommonweaveCoreLoopV152?.activate?.(located.plan)"),'Readiness changes to an active weave must rematerialize downstream handoffs.');

assert(loomHtml.includes('/app/intention-planner-v141.js'),'Hub HTML must load the v141 planner.');
assert(loomHtml.includes('/app/assistant-runtime-v141.js'),'Hub HTML must load the v141 assistant.');
assert(loomHtml.includes('/app/core-loop-v152.js'),'Hub HTML must load the restored operational core.');
assert(loomHtml.includes('/app/guide-chat-v153.js'),'Commonweave must load the visible live chat runtime.');
assert(loomHtml.includes('/app/capability-readiness-v154.js'),'Commonweave must show capability readiness in chat and weave review.');
assert(loomHtml.includes('/app/loom-v141.js'),'Hub HTML must load the active hub controller.');
assert(realmHtml.includes('/app/cabinet-mode-v142.html'),'Legacy realm HTML must redirect to Cabinet Mode.');
assert(!realmHtml.includes('/app/realm-v141.js'),'Legacy realm HTML must not load the archived location-scene controller.');
assert(cabinetHtml.includes('CABINET MODE'),'Cabinet Mode HTML is missing its canonical mode label.');
for(const [name,html] of [['Cerbanimo',realmConsoleHtml],['Living School',livingHtml],['FellowFare',fellowfareHtml],['Anarchadia',anarchadiaHtml]]){
  assert(html.includes('/app/guide-chat-v153.js'),`${name} cabinet must load the visible live chat runtime.`);
  assert(html.includes('/app/capability-readiness-v154.js'),`${name} cabinet must show its capability lane inside guide chat.`);
}
for(const [name,html] of [['Living School',livingHtml],['FellowFare',fellowfareHtml],['Anarchadia',anarchadiaHtml]])assert(html.includes('/app/core-loop-v152.js'),`${name} cabinet must load the restored core loop.`);
assert(livingHtml.includes('/app/assistant-runtime-v141.js')&&livingHtml.includes('/app/shared/commonweave-model-runtime.js'),'Living School must load the same live guide stack as the other cabinets.');
assert(serviceWorker.includes('guide-orchestration-r21-chat-r27-readiness-r28'),'Service worker revision must evict stale chat and readiness caches.');
assert(serviceWorker.includes('/app/assistant-runtime-v141.js')&&serviceWorker.includes('/app/guide-contracts-v141.js'),'Service worker must cache the active guide runtimes.');
assert(serviceWorker.includes('/app/core-loop-v152.js'),'Service worker must cache the restored operational core.');
assert(serviceWorker.includes('/app/guide-chat-v153.js'),'Service worker must cache the visible five-system chat runtime.');
assert(serviceWorker.includes('/app/capability-readiness-v154.js'),'Service worker must cache the visible capability readiness runtime.');
assert(serviceWorker.includes('/app/loom-v141.js'),'Service worker must cache the active hub controller.');
assert(!serviceWorker.includes("'/app/realm-v141.js'"),'Service worker must not precache the archived location-scene controller.');

console.log('Guide orchestration, five-system live chat, capability readiness, and routed handoff verification passed in Cabinet Mode.');
