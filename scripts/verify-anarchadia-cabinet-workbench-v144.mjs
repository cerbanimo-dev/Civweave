import fs from 'node:fs/promises';import path from 'node:path';
const root=process.cwd(),read=file=>fs.readFile(path.join(root,file),'utf8'),assert=(c,m)=>{if(!c)throw new Error(m)};
const [html,css,workbenchBridge,governanceBridge,sovereigntyBridge,localSovereignty,consoleHtml,consoleRuntime,stabilityCss,worker,additiveWorker,sourceApp,family,loader]=await Promise.all([
  read('public/app/services/anarchadia/workbench.html'),
  read('public/app/services/anarchadia/cabinet-workbench-v144.css'),
  read('public/app/anarchadia-cabinet-workbench-v144.js'),
  read('public/app/anarchadia-governance-bridge-v145.js'),
  read('public/app/anarchadia-sovereignty-bridge-v146.js'),
  read('public/app/anarchadia-local-sovereignty-v146.js'),
  read('public/app/anarchadia-console-v139.html'),
  read('public/app/anarchadia-console-v158.js'),
  read('public/app/anarchadia-chat-stability-v158.css'),
  read('public/service-worker.js'),
  read('public/service-worker-v156.js'),
  read('public/app/services/anarchadia/src/app.js'),
  read('public/app/family-shell-v104.js'),
  read('public/app/family-ai-loader-v105.js')
]);
for(const token of ['src/domain.js','src/store.js','cabinet-workbench-loader-v144.js','commonweave-handoff-consumer.js','Citizen Console'])assert(html.includes(token),`Workbench entry missing ${token}`);
assert(css.includes('.cabinet-workbench-return')&&css.includes('.cabinet-workbench-nav'),'Workbench styling incomplete.');
assert(sourceApp.includes('const visualRequested = true'),'Workbench source boundary changed unexpectedly.');
assert(consoleHtml.includes('anarchadia-cabinet-workbench-v144.js')&&consoleHtml.includes('anarchadia-governance-bridge-v145.js'),'Native console lost workbench/governance links.');
assert(!consoleHtml.includes('cabinet-home-v142.js')&&!consoleHtml.includes('cabinet-surfaces-v143.js'),'Legacy startup overlays were reintroduced into Anarchadia.');
for(const token of ['ac-merlin-chat','ac-merlin-log','ac-merlin-form','anarchadia-console-v158.js','anarchadia-chat-stability-v158.css'])assert(consoleHtml.includes(token),`Persistent Merlin chat surface missing ${token}`);
for(const [name,source] of [['workbench',workbenchBridge],['governance',governanceBridge],['sovereignty',sovereigntyBridge]]){assert(!source.includes('new MutationObserver'),`${name} bridge still installs a permanent document observer`);assert(source.includes('attempts')&&source.includes('schedule'),`${name} bridge lacks bounded mounting`)}
assert(localSovereignty.includes('MutationObserver')&&localSovereignty.includes('function needsObserver'),'Sovereignty runtime must reapply only when safe DOM operations exist.');
for(const token of ['operationSafe','BROAD_SELECTOR','slice(0,80)','slice(0,100)','quarantined','dataset.cwSovereigntyNetwork'])assert(localSovereignty.includes(token),`Sovereignty hardening missing ${token}`);
for(const token of ['function queueRender','const runningPipelines=new Set()','function currentScreen','if(renderQueued)return','runningPipelines.has(id)','modelStatusTicket','behavior:\'auto\''])assert(consoleRuntime.includes(token),`Anarchadia stability fix missing ${token}`);
assert(!consoleRuntime.includes('renderPulse();renderProposals();renderLedger();renderPipelines();renderObservatory()'),'Anarchadia still redraws every hidden screen on each change.');
assert(!consoleRuntime.includes('openPreview(p.id);'),'Pipeline completion still forces a modal preview open.');
for(const token of ['CHAT_KEY','renderMerlinChat','sendMerlin','CommonweaveGuideChatV153','api.ask(\'anarchadia\'','openFullMerlin'])assert(consoleRuntime.includes(token),`Merlin embedded chat wiring missing ${token}`);
assert(stabilityCss.includes('#gc153-launcher{display:none!important}')&&stabilityCss.includes('.ac-frame-noise{display:none!important}')&&stabilityCss.includes('.ac-merlin-chat'),'Anarchadia mobile stability or Merlin styling is incomplete.');
assert(worker.includes('/app/anarchadia-local-sovereignty-v146.js')&&worker.includes("GUIDE_REVISION='lazy-five-system-chat-r36-stable'"),'Repaired Anarchadia runtime is not in the fast core package.');
for(const token of ['/app/anarchadia-console-v139.html','/app/anarchadia-console-v158.js','/app/anarchadia-chat-stability-v158.css','anarchadia-merlin-living-school-generated-v158'])assert(additiveWorker.includes(token),`Additive package does not deliver ${token}`);
assert(family.includes("anarchadia:{label:'Anarchadia',guide:'Merlin'")&&loader.includes('CommonweaveGuideChatV153'),'Merlin shared guide integration missing.');
new Function(workbenchBridge);new Function(governanceBridge);new Function(sovereigntyBridge);new Function(localSovereignty);new Function(consoleRuntime);
console.log(JSON.stringify({ok:true,system:'anarchadia',merlinChat:'embedded-and-shared',rendering:'scheduled-current-screen-only',pipelineLock:true,forcedPreview:false,legacyOverlays:false},null,2));
