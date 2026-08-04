import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
const root=process.cwd(),read=file=>fs.readFile(path.join(root,file),'utf8'),assert=(condition,message)=>{if(!condition)throw new Error(message)};
const [realmArchive,loom,assistant,contracts,planner,coreLoop,guideChat,capabilityReadiness,realmHtml,loomHtml,cabinetHtml,realmConsoleHtml,livingHtml,fellowfareHtml,anarchadiaHtml,compatHost,familyRuntime,aiLoader,serviceWorker]=await Promise.all([
  read('public/app/realm-v141.js'),read('public/app/loom-v141.js'),read('public/app/assistant-runtime-v141.js'),read('public/app/guide-contracts-v141.js'),read('public/app/intention-planner-v141.js'),read('public/app/core-loop-v152.js'),read('public/app/guide-chat-v153.js'),read('public/app/capability-readiness-v154.js'),read('public/app/realm-v128.html'),read('public/app/loom-v128.html'),read('public/app/cabinet-mode-v142.html'),read('public/app/realm-console-v140.html'),read('public/app/cabinets/living-school/index.html'),read('public/app/fellowfare-cabinet-v144.html'),read('public/app/anarchadia-console-v139.html'),read('public/app/fullscreen-family-v104.html'),read('public/app/family-shell-v104.js'),read('public/app/family-ai-loader-v105.js'),read('public/service-worker.js')
]);
assert(realmArchive.includes('node.innerHTML=html'),'Archived realm controller must preserve its dialog implementation.');
assert(!realmArchive.includes('function guideAnswer')&&!realmArchive.includes("querySelector('form').onsubmit"),'Archived realm controller contains a competing canned guide.');
assert(realmArchive.includes('CommonweaveAssistantV141?.attach?.(node)'),'Archived realm source lost shared assistant integration.');
assert(loom.includes('CommonweaveAssistantV141?.attach?.(node)')&&!loom.includes('function answerFor')&&!loom.includes("querySelector('form').onsubmit"),'Weaveling source lost shared assistant integration or regained canned routing.');
assert(loom.includes('CommonweaveParity.cabinetUrl'),'Legacy hub must use canonical software route helper.');
for(const required of ["currentSystem(context)!=='commonweave'",'time looper','time traveler','function restore','plan.id=duplicate.id'])assert(planner.includes(required),`Planner missing ${required}`);
for(const required of ['cerbanimo','fellowfare','anarchadia','living','Approve request & begin rails','Approve & publish request'])assert(contracts.includes(required),`Guide contracts missing ${required}`);
for(const required of ['CommonweaveIntentionPlanner?.restore','Never identify yourself as being "from" the current room'])assert(assistant.includes(required),`Assistant runtime missing ${required}`);
assert(contracts.includes("a.kind==='feature-request'")&&contracts.includes('cerbanimo.quest.linked'),'Dark-mode approval must create linked Cerbanimo quest.');
assert(contracts.includes("a.kind==='trade-request'")&&contracts.includes('fellowfare.need-card.published'),'Food requests must publish through FellowFare after approval.');
assert(contracts.includes('Do you mean the Dougie dance'),'Moss must clarify “duggy.”');
for(const required of ['commonweave.core-loop.v152','commonweave.living-school.intake.v152','commonweave.cerbanimo.quest-queue.v1','commonweave.fellowfare.resource-queue.v152','commonweave.anarchadia.passport.v152'])assert(coreLoop.includes(required),`Core loop missing ${required}`);
assert(coreLoop.includes('ui.activate=x=>'),'Intention activation must materialize child routes.');
for(const token of ["receipt(plan,'living-school','learning-path'","receipt(plan,'cerbanimo','project-blueprint'","receipt(plan,'fellowfare','material-route'","receipt(plan,'anarchadia','passport-thread'"])assert(coreLoop.includes(token),`Core loop handoff missing ${token}`);
assert(coreLoop.includes("closest?.('#moss')")&&coreLoop.includes("chat('living-school')"),'Moss object must open live chat.');
assert(coreLoop.includes("source:'commonweave-core-loop-v152'")&&coreLoop.includes('assessmentPassed:false'),'Living School intake must become curriculum state.');
for(const required of ["commonweave:{name:'Commonweave'","'living-school':{name:'Living School'","cerbanimo:{name:'Cerbanimo'","fellowfare:{name:'FellowFare'","anarchadia:{name:'Anarchadia'"])assert(guideChat.includes(required),`Five-system chat missing ${required}`);
assert(guideChat.includes('CommonweaveAssistantV141.respond'),'Guide chat must use shared assistant runtime.');
assert(guideChat.includes('data-gc-gate="activate-plan"')&&guideChat.includes('data-gc-gate="approve-action"'),'Guide chat approval controls missing.');
assert(guideChat.includes('commonweave.guide-chat.${system}.v153'),'Guide conversation persistence missing.');
for(const required of ['commonweave.capability-readiness.v154','commonweave.capability-map.v154','Learn first','Practice while doing','Recruit help','Simplify scope','[0,1,2,3,4]','Current level','currentScore','preparedScore','cr154-summary','cr154-dialog',"document.querySelector('#gc153-dialog .gc153-shell')",'Complete the capability map before activating this weave.','Learn and demonstrate','supported checkpoint','collaborator or provider','Reduce the requirement',"globalThis.CommonweaveCoreLoopV152?.activate?.(located.plan)"])assert(capabilityReadiness.includes(required),`Capability readiness missing ${required}`);
assert(loomHtml.includes('/app/guide-chat-v153.js')&&loomHtml.includes('/app/capability-readiness-v154.js'),'Legacy hub source lost functional chat/readiness stack.');
assert(realmHtml.includes('/app/cabinet-mode-v142.html')&&!realmHtml.includes('/app/realm-v141.js'),'Legacy realm compatibility source regressed.');
assert(cabinetHtml.includes('CABINET MODE'),'Marketing Cabinet Mode lost its label.');
for(const [name,html] of [['Commonweave/Cerbanimo',realmConsoleHtml],['Living School',livingHtml],['FellowFare',fellowfareHtml],['Anarchadia',anarchadiaHtml]]){
  assert(html.includes('/app/family-ai-loader-v105.js'),`${name} software does not mount the lazy guide loader.`);
  for(const eager of ['/app/guide-chat-v153.js','/app/capability-readiness-v154.js','/app/core-loop-v152.js','/app/assistant-runtime-v141.js','/app/shared/commonweave-model-runtime.js'])assert(!html.includes(eager),`${name} eagerly loads ${eager}`);
}
assert(compatHost.includes('location.replace')&&!compatHost.includes('<iframe'),'Compatibility host still mounts the blocking iframe.');
for(const token of ['/app/shared/commonweave-model-runtime.js','/app/minilm-reflex-runtime-v138.js','/app/minilm-model-settings-v138.js','/app/intention-planner-v141.js','/app/guide-contracts-v141.js','/app/assistant-runtime-v141.js','/app/core-loop-v152.js','/app/guide-chat-v153.js','/app/capability-readiness-v154.js','for(const [src,ready] of SCRIPTS)'])assert(aiLoader.includes(token),`Lazy guide loader missing ${token}`);
for(const token of ['CommonweaveGuideChatV153','CommonweaveModelSettingsV133'])assert(aiLoader.includes(token),`Lazy guide loader missing ${token}`);
for(const token of ['CommonweaveFamilyAILoaderV105?.openChat?.','CommonweaveFamilyAILoaderV105?.openSettings?.',"Talk to ${esc(item.guide)}"])assert(familyRuntime.includes(token),`Direct family runtime missing lazy delegation ${token}`);
assert(serviceWorker.includes("GUIDE_REVISION='lazy-five-system-chat-r35'"),'Service worker revision must evict eager guide caches.');
for(const token of ['/app/family-ai-loader-v105.js','/app/assistant-runtime-v141.js','/app/guide-contracts-v141.js','/app/core-loop-v152.js','/app/guide-chat-v153.js','/app/capability-readiness-v154.js','/app/realm-console-v140.html'])assert(serviceWorker.includes(token),`Service worker must cache ${token}`);
assert(!serviceWorker.includes("'/app/realm-v141.js'")&&!serviceWorker.includes("'/app/loom-v141.js'"),'Worker precaches retired location controllers.');
new Function(familyRuntime);new Function(aiLoader);
console.log('Guide orchestration, lazy five-system live chat, capability readiness, and routed handoffs passed in the direct software family.');
