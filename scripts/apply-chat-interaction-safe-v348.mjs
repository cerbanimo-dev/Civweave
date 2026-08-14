import fs from 'node:fs';

const filesWithFreezeTag = [
  'public/app/chat-fullscreen-v295.js',
  'public/service-worker-chat-repair-v245.js',
  'public/service-worker-v203.js',
  'scripts/build-service-worker-v211.mjs',
  'scripts/verify-mobile-chat-layout-v248.mjs',
  'scripts/verify-chat-convergence-v250.mjs',
  'scripts/verify-chat-launch-readiness-v295.mjs'
];

function read(path){ return fs.readFileSync(path,'utf8'); }
function write(path,source){ fs.writeFileSync(path,source,'utf8'); }
function replaceOnce(source,from,to,label){
  const first=source.indexOf(from);
  if(first<0) throw new Error(`Missing ${label}`);
  if(source.indexOf(from,first+from.length)>=0) throw new Error(`Ambiguous ${label}`);
  return source.slice(0,first)+to+source.slice(first+from.length);
}
function replaceRequired(source,from,to,label){
  if(!source.includes(from)) throw new Error(`Missing ${label}`);
  return source.split(from).join(to);
}

for(const path of filesWithFreezeTag){
  let source=read(path);
  source=replaceRequired(source,'mobile-chat-freeze-v347','chat-interaction-safe-v348',`${path} freeze tag`);
  write(path,source);
}

{
  const path='public/app/chat-fullscreen-v295.js';
  let source=read(path);
  source=replaceOnce(source,
    '[0,32,80,150,260,420,700]',
    '[0,80,220,500]',
    'bounded viewport settlement');
  source=replaceOnce(source,
    "observer=new MutationObserver(()=>queueMicrotask(()=>{ensureStructure();viewport();enforceFullScreen()}));observer.observe(document.documentElement,{childList:true,subtree:true});",
    "if(!root()){observer=new MutationObserver(()=>{if(!root())return;try{observer.disconnect()}catch{}observer=null;ensureStructure();viewport();settleViewport()});observer.observe(document.documentElement,{childList:true,subtree:true})}",
    'permanent document mutation observer');
  source=replaceOnce(source,
    'mutationLoopGuard:true,styleMutationObserverDisabled:true,viewport',
    'mutationLoopGuard:true,styleMutationObserverDisabled:true,permanentDocumentObserver:false,rootMountObserverOneShot:true,boundedViewportSettlement:true,viewport',
    'fullscreen safety metadata');
  write(path,source);
}

{
  const path='public/app/local-chat-owner-v295.js';
  let source=read(path);
  source=replaceOnce(source,
    "const VERSION='1.0.115-local-chat-owner-v302',SYSTEMS=",
    "const VERSION='1.0.115-local-chat-owner-v302',REVISION='chat-interaction-safe-v348',SYSTEMS=",
    'local chat owner revision');
  source=replaceOnce(source,
    "if(globalThis.CivweaveLocalChatOwnerV295?.version===VERSION&&globalThis.CivweaveLocalChatOwnerV295?.intentPrewarm===true&&globalThis.CivweaveLocalChatOwnerV295?.chatOpenPrewarm===true)return;",
    "if(globalThis.CivweaveLocalChatOwnerV295?.version===VERSION&&globalThis.CivweaveLocalChatOwnerV295?.revision===REVISION)return;",
    'local owner stale-runtime guard');
  source=replaceOnce(source,
    "addEventListener('civweave:guide-workspace-state',prewarmWorkspace);\ndocument.addEventListener('focusin',prewarmIntent,true);\n",
    '',
    'automatic open/focus prewarm listeners');
  source=replaceOnce(source,
    "intentPrewarm:true,chatOpenPrewarm:true,prewarmTrigger:'chat-open-or-input-focus-v314'",
    "revision:REVISION,intentPrewarm:false,chatOpenPrewarm:false,automaticInteractionPrewarm:false,modelLoadOnSubmit:true,interactionSafe:true,prewarmTrigger:'submit-owned-runtime-v348'",
    'local owner interaction policy');
  write(path,source);
}

{
  const path='public/app/experience-orchestrator-v232.js';
  let source=read(path);
  source=replaceOnce(source,
    "const REVISION='experience-orchestrator-v317-settings-neutral';",
    "const REVISION='experience-orchestrator-v317-chat-v348';",
    'orchestrator revision');
  source=replaceOnce(source,
    "['/app/chat-fullscreen-v295.js',()=>globalThis.CivweaveChatFullscreenV295?.version==='1.0.106-chat-fullscreen-v299'],",
    "['/app/chat-fullscreen-v295.js?freeze=chat-interaction-safe-v348',()=>globalThis.CivweaveChatFullscreenV295?.version==='1.0.106-chat-fullscreen-v299'&&globalThis.CivweaveChatFullscreenV295?.revision==='chat-interaction-safe-v348'],",
    'fullscreen revision-aware readiness');
  source=replaceOnce(source,
    "['/app/local-chat-owner-v295.js?v=1.0.115-v302',()=>globalThis.CivweaveLocalChatOwnerV295?.version==='1.0.115-local-chat-owner-v302'&&globalThis.CivweaveLocalChatOwnerV295?.intentPrewarm===true&&globalThis.CivweaveLocalChatOwnerV295?.chatOpenPrewarm===true]",
    "['/app/local-chat-owner-v295.js?v=1.0.115-v302&freeze=chat-interaction-safe-v348',()=>globalThis.CivweaveLocalChatOwnerV295?.version==='1.0.115-local-chat-owner-v302'&&globalThis.CivweaveLocalChatOwnerV295?.revision==='chat-interaction-safe-v348'&&globalThis.CivweaveLocalChatOwnerV295?.interactionSafe===true&&globalThis.CivweaveLocalChatOwnerV295?.automaticInteractionPrewarm===false]",
    'local owner revision-aware readiness');
  source=replaceOnce(source,
    'bootstrapAuxiliaryFailureNonFatal:true,intentPrewarm:true,chatOpenPrewarm:true,smoothFitRuntime:true',
    'bootstrapAuxiliaryFailureNonFatal:true,automaticInteractionPrewarm:false,modelLoadOnSubmit:true,interactionSafe:true,smoothFitRuntime:true',
    'orchestrator readiness metadata');
  write(path,source);
}

{
  const path='scripts/verify-chat-launch-readiness-v295.mjs';
  let source=read(path);
  source=replaceOnce(source,
    "assert.match(orchestrator,/REVISION='experience-orchestrator-v317-settings-neutral'/);",
    "assert.match(orchestrator,/REVISION='experience-orchestrator-v317-chat-v348'/);",
    'chat readiness orchestrator revision assertion');
  source=replaceOnce(source,
    "assert.match(orchestrator,/intentPrewarm===true/);\nassert.match(orchestrator,/chatOpenPrewarm:true/);",
    "assert.match(orchestrator,/revision==='chat-interaction-safe-v348'/);\nassert.match(orchestrator,/automaticInteractionPrewarm===false/);\nassert.match(orchestrator,/modelLoadOnSubmit:true/);",
    'chat readiness orchestrator prewarm assertions');
  source=replaceOnce(source,
    "assert.match(fullscreen,/styleMutationObserverDisabled:true/);",
    "assert.match(fullscreen,/styleMutationObserverDisabled:true/);\nassert.match(fullscreen,/permanentDocumentObserver:false/);\nassert.match(fullscreen,/rootMountObserverOneShot:true/);\nassert.match(fullscreen,/boundedViewportSettlement:true/);\nassert.match(fullscreen,/if\\(!root\\(\\)\\)\\{observer=new MutationObserver/);",
    'fullscreen observer guard assertions');
  source=replaceOnce(source,
    "assert.match(localOwner,/document\\.addEventListener\\('focusin',prewarmIntent,true\\)/);\nassert.match(localOwner,/intentPrewarm:true/);",
    "assert.doesNotMatch(localOwner,/document\\.addEventListener\\('focusin',prewarmIntent,true\\)/);\nassert.doesNotMatch(localOwner,/addEventListener\\('civweave:guide-workspace-state',prewarmWorkspace\\)/);\nassert.match(localOwner,/REVISION='chat-interaction-safe-v348'/);\nassert.match(localOwner,/automaticInteractionPrewarm:false/);\nassert.match(localOwner,/modelLoadOnSubmit:true/);\nassert.match(localOwner,/interactionSafe:true/);",
    'local owner interaction safety assertions');
  source=replaceOnce(source,
    "revision:'chat-launch-readiness-v347-mobile-freeze-guard'",
    "revision:'chat-launch-readiness-v348-interaction-safe'",
    'chat readiness output revision');
  source=replaceOnce(source,
    'intentPrewarm:true,adaptiveResidency:true,smoothFitRuntime:true,mutationLoopGuard:true,fullChatRepairCoverage:true',
    'automaticInteractionPrewarm:false,modelLoadOnSubmit:true,interactionSafe:true,adaptiveResidency:true,smoothFitRuntime:true,mutationLoopGuard:true,fullChatRepairCoverage:true',
    'chat readiness output features');
  write(path,source);
}

{
  const path='scripts/verify-local-ai-smooth-fit-v314.mjs';
  let source=read(path);
  source=replaceOnce(source,
    "assert.match(owner,/document\\.addEventListener\\('focusin',prewarmIntent,true\\)/);\nassert.match(owner,/addEventListener\\('civweave:guide-workspace-state',prewarmWorkspace\\)/);\nassert.match(owner,/detail\\.open===true&&detail\\.minimized!==true/);\nassert.match(owner,/intentPrewarm:true/);\nassert.match(owner,/chatOpenPrewarm:true/);\nassert.match(orchestrator,/CivweaveLocalChatOwnerV295\\?\\.intentPrewarm===true&&globalThis\\.CivweaveLocalChatOwnerV295\\?\\.chatOpenPrewarm===true/);\nassert.match(orchestrator,/chatOpenPrewarm:true/);",
    "assert.doesNotMatch(owner,/document\\.addEventListener\\('focusin',prewarmIntent,true\\)/);\nassert.doesNotMatch(owner,/addEventListener\\('civweave:guide-workspace-state',prewarmWorkspace\\)/);\nassert.match(owner,/automaticInteractionPrewarm:false/);\nassert.match(owner,/modelLoadOnSubmit:true/);\nassert.match(owner,/interactionSafe:true/);\nassert.match(orchestrator,/automaticInteractionPrewarm===false/);\nassert.match(orchestrator,/modelLoadOnSubmit:true/);",
    'smooth-fit interaction prewarm assertions');
  source=replaceOnce(source,
    "prewarm:'chat-open-or-input-focus'",
    "prewarm:'submit-owned-runtime'",
    'smooth-fit output prewarm policy');
  write(path,source);
}

console.log('Applied chat interaction safety v348 hotfix.');
