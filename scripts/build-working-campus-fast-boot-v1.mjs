import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const campusPath=new URL('public/app/working-campus-v156.js',root);
const homePath=new URL('public/app/working-campus-v440.html',root);
const packagePath=new URL('package.json',root);
const parts=[1,2,3,4,5].map(index=>new URL(`public/app/working-campus-v156.part${index}.txt`,root));
const START='/* CIVWEAVE_FAST_BOOT_CORE_START */';
const END='/* CIVWEAVE_FAST_BOOT_CORE_END */';
const FAST_BOOT_REVISION='working-campus-fast-boot-v1';
const checkOnly=process.argv.includes('--check');

const replaceRequired=(source,before,after,label)=>{
  assert.ok(source.includes(before),`Could not locate ${label}.`);
  return source.replace(before,()=>after);
};

function initialCampus(source,compiled){
  source=replaceRequired(source,
    "const HUB_REVISION='weaveling-hub-v233';\n",
    "const HUB_REVISION='weaveling-hub-v233';\nconst FAST_BOOT_REVISION='working-campus-fast-boot-v1';\nconst COMPILED_PART_COUNT=5;\n",
    'fast boot constants');
  source=replaceRequired(source,
    "const parts=['/app/working-campus-v156.part1.txt','/app/working-campus-v156.part2.txt','/app/working-campus-v156.part3.txt','/app/working-campus-v156.part4.txt','/app/working-campus-v156.part5.txt'];\n",
    '',
    'runtime source part list');
  source=replaceRequired(source,
`async function fetchPart(pathname){
  const url=new URL(pathname,location.origin);url.searchParams.set('revision',REVISION);
  const response=await fetch(url,{cache:'no-store',signal:controller.signal,redirect:'follow',headers:{'x-civweave-package':'working-campus-v227'}});if(!response.ok)throw new Error(\`Working Campus source \${pathname} returned \${response.status}\`);return response.text();
}
`,
    '',
    'runtime source fetcher');
  const compiledRuntime=`function afterFirstPaint(task){
  const run=()=>{try{task()}catch(error){console.warn('[Civweave] Post-paint startup task failed.',error)}};
  if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>requestAnimationFrame(run));else setTimeout(run,0);
}
function scheduleHubHydration(){
  const hydrate=()=>ensureHub().then(()=>{
    document.documentElement.dataset.civweaveHubHydration='ready';
    try{dispatchEvent(new CustomEvent('civweave:working-campus-hub-ready',{detail:{revision:HUB_REVISION,fastBootRevision:FAST_BOOT_REVISION,blocking:false}}))}catch{}
  }).catch(error=>{
    document.documentElement.dataset.civweaveHubHydration='unavailable';
    console.warn('[Civweave] Optional Weaveling hub did not hydrate after startup.',error);
  });
  if(typeof requestIdleCallback==='function')requestIdleCallback(()=>void hydrate(),{timeout:1800});
  else afterFirstPaint(()=>setTimeout(()=>void hydrate(),0));
}
function runCompiledCore(){
${START}
${compiled}
${END}
}
`;
  source=replaceRequired(source,'async function boot(){',`${compiledRuntime}async function boot(){`,'boot entry');
  source=replaceRequired(source,
`  await ensureRouteContract();
  installPersistentChatLauncherOwnership();
  await ensureHub();
  const source=await Promise.all(parts.map(fetchPart));
  if(!liveDocument())throw new DOMException('Working Campus navigation interrupted startup.','AbortError');
  Function(source.join(''))();document.documentElement.dataset.civweaveCampusRuntime='ready';
  dispatchEvent(new CustomEvent('civweave:working-campus-runtime-ready',{detail:{revision:REVISION,brandRevision:BRAND_REVISION,brandCycleRevision:BRAND_CYCLE_REVISION,webEntryRevision:WEB_ENTRY_REVISION,hubRevision:HUB_REVISION,stateRepairRevision:STATE_REPAIR_REVISION,parts:parts.length,at:new Date().toISOString(),policy:'canonical-core-only-single-shell-context',questStatePolicy:'current-quest-single-surface'}}));
`,
`  await ensureRouteContract();
  installPersistentChatLauncherOwnership();
  if(!liveDocument())throw new DOMException('Working Campus navigation interrupted startup.','AbortError');
  runCompiledCore();
  document.documentElement.dataset.civweaveCampusRuntime='ready';
  document.documentElement.dataset.civweaveFastBoot=FAST_BOOT_REVISION;
  dispatchEvent(new CustomEvent('civweave:working-campus-runtime-ready',{detail:{revision:REVISION,fastBootRevision:FAST_BOOT_REVISION,brandRevision:BRAND_REVISION,brandCycleRevision:BRAND_CYCLE_REVISION,webEntryRevision:WEB_ENTRY_REVISION,hubRevision:HUB_REVISION,stateRepairRevision:STATE_REPAIR_REVISION,parts:COMPILED_PART_COUNT,coreDelivery:'compiled-single-asset',runtimeSourceFetches:0,runtimeStringCompilation:false,hubBlocking:false,at:new Date().toISOString(),policy:'canonical-core-only-single-shell-context',questStatePolicy:'current-quest-single-surface'}}));
  scheduleHubHydration();
`,
    'blocking runtime assembly');
  return source;
}

function refreshCompiledCore(source,compiled){
  const start=source.indexOf(START),end=source.indexOf(END);
  assert.ok(start>=0&&end>start,'Working Campus fast-boot core markers are missing or out of order.');
  const bodyStart=start+START.length;
  return `${source.slice(0,bodyStart)}\n${compiled}\n${source.slice(end)}`;
}

const FAST_SCHEDULER=`<script>
(()=>{
'use strict';
const REVISION='working-campus-fast-boot-v1';
const POST_PAINT=[
  '/app/guild-symbol-v1.js?v=working-campus-v440-purpose-icons-v2',
  '/app/new-user-onboarding-v1.js?v=working-campus-v440',
  '/app/guide-chat-surface-v350.js?v=working-campus-v440',
  '/app/working-campus-topbar-v243.js?v=working-campus-v440',
  '/app/themed-system-nav-v178.js?v=working-campus-v440',
  '/app/working-campus-home-relocation-v441.js?v=working-campus-v441-purpose-icons-v2',
  '/app/shared-review-surface-v234.js?v=working-campus-v440',
  '/app/shared-guide-surface-v236.js?v=working-campus-v440-live-guild-balance-v1'
];
const IDLE=[
  '/app/campus-background-download-v241.js?v=working-campus-v440',
  '/app/local-object-mesh-v146.js?v=working-campus-v440'
];
const AI=[
  '/app/mobile-ai-hardening-v302.js?v=working-campus-v440',
  '/app/family-ai-loader-v105.js?v=working-campus-v440',
  '/app/merlinites-semantic-planner-v164.js?v=working-campus-v440'
];
const loads=new Map();
let aiPromise=null,replayingSubmit=false;
const pathOf=src=>new URL(src,location.href).pathname;
function loadScript(src){
  const pathname=pathOf(src);
  if(loads.has(pathname))return loads.get(pathname);
  const promise=new Promise((resolve,reject)=>{
    const existing=[...document.scripts].find(script=>script.src&&pathOf(script.src)===pathname);
    const done=script=>{script.dataset.cwFastBootLoaded=REVISION;resolve(true)};
    if(existing){
      if(existing.dataset.cwFastBootLoaded===REVISION||existing.dataset.cwFastBootReady==='1'){resolve(true);return}
      existing.addEventListener('load',()=>done(existing),{once:true});
      existing.addEventListener('error',()=>reject(new Error(\`Could not load \${pathname}.\`)),{once:true});
      setTimeout(()=>{if(document.documentElement.contains(existing))resolve(true)},0);
      return;
    }
    const script=document.createElement('script');
    script.src=src;script.async=false;script.dataset.cwFastBootPending=REVISION;
    script.onload=()=>done(script);
    script.onerror=()=>reject(new Error(\`Could not load \${pathname}.\`));
    document.head.append(script);
  }).catch(error=>{loads.delete(pathname);throw error});
  loads.set(pathname,promise);
  return promise;
}
function loadOrdered(list){for(const src of list)void loadScript(src).catch(error=>console.warn('[Civweave] Deferred startup script failed.',src,error))}
function afterFirstPaint(task){
  const run=()=>{try{task()}catch(error){console.warn('[Civweave] Post-paint startup failed.',error)}};
  if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>requestAnimationFrame(run));else setTimeout(run,0);
}
function scheduleIdle(task){if(typeof requestIdleCallback==='function')requestIdleCallback(()=>task(),{timeout:2200});else setTimeout(task,900)}
function ensureAI(){
  if(aiPromise)return aiPromise;
  aiPromise=Promise.all(AI.map(loadScript)).then(()=>true).catch(error=>{aiPromise=null;throw error});
  return aiPromise;
}
function aiSurface(target){return target instanceof Element?target.closest('#weaveling-chat-form,#cw-persistent-guide-chat-v215'):null}
function primeAI(event){if(aiSurface(event.target))void ensureAI().catch(()=>{})}
document.addEventListener('pointerdown',primeAI,{capture:true,passive:true});
document.addEventListener('focusin',primeAI,true);
document.addEventListener('keydown',event=>{if(aiSurface(event.target))void ensureAI().catch(()=>{})},true);
document.addEventListener('submit',event=>{
  if(replayingSubmit||!aiSurface(event.target))return;
  const form=event.target instanceof HTMLFormElement?event.target:null;
  if(!form)return;
  event.preventDefault();event.stopImmediatePropagation();
  ensureAI().then(()=>{
    replayingSubmit=true;
    try{if(typeof form.requestSubmit==='function')form.requestSubmit();else form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))}
    finally{queueMicrotask(()=>{replayingSubmit=false})}
  }).catch(error=>{
    const status=form.querySelector('#weaveling-chat-status,[data-chat-status],[role="status"]');
    if(status)status.textContent=\`AI startup could not finish: \${String(error?.message||error)}\`;
  });
},true);
afterFirstPaint(()=>loadOrdered(POST_PAINT));
scheduleIdle(()=>{
  loadOrdered(IDLE);
  import('/app/open-learning-media-cache-v1.mjs?v=working-campus-v440').catch(error=>console.warn('[Civweave] Deferred media cache failed.',error));
});
document.documentElement.dataset.civweaveFastBootScheduler=REVISION;
globalThis.CivweaveWorkingCampusFastBootV1=Object.freeze({revision:REVISION,ensureAI,postPaint:[...POST_PAINT],idle:[...IDLE],ai:[...AI],settingsLocalRouteSelfLoading:true});
})();
</script>`;

function migrateHome(source){
  source=source.replace(
    'data-build="working-campus-v440-live-guild-balance-local-settings-v342-canonical-route-only"',
    'data-build="working-campus-v440-fast-boot-v1-live-guild-balance-local-settings-v342-canonical-route-only"');
  if(source.includes("const REVISION='working-campus-fast-boot-v1'"))return source;
  const old=`<script src="/app/system-routes-v227.js?v=working-campus-v440-live-guild-balance-v1"></script>
<script src="/app/release-version-v2.js?v=working-campus-v440"></script>
<script src="/app/platform-experience-v160.js?v=working-campus-v440"></script>
<script src="/app/settings-gateway-v317.js?v=1.0.134-settings-v324-local-route-self-loading"></script>
<script src="/app/settings-local-route-v327.js?v=1.1.3-settings-local-route-v326-canonical-inert-hard-local-fresh-path"></script>
<script src="/app/model-settings-controller-v173.js?v=working-campus-v440"></script>
<script src="/app/mobile-ai-hardening-v302.js?v=working-campus-v440"></script>
<script src="/app/family-ai-loader-v105.js?v=working-campus-v440"></script>
<script src="/app/merlinites-semantic-planner-v164.js?v=working-campus-v440"></script>
<script src="/app/working-campus-v156.js?v=working-campus-v440"></script>
<script src="/app/working-campus-home-declutter-v1.js?v=working-campus-v440"></script>
<script src="/app/guild-symbol-v1.js?v=working-campus-v440-purpose-icons-v2"></script>
<script src="/app/new-user-onboarding-v1.js?v=working-campus-v440"></script>
<script src="/app/guide-chat-surface-v350.js?v=working-campus-v440"></script>
<script src="/app/working-campus-topbar-v243.js?v=working-campus-v440"></script>
<script src="/app/themed-system-nav-v178.js?v=working-campus-v440"></script>
<script src="/app/working-campus-home-relocation-v441.js?v=working-campus-v441-purpose-icons-v2"></script>
<script src="/app/campus-background-download-v241.js?v=working-campus-v440"></script>
<script src="/app/shared-review-surface-v234.js?v=working-campus-v440"></script>
<script src="/app/shared-guide-surface-v236.js?v=working-campus-v440-live-guild-balance-v1"></script>
<script src="/app/local-object-mesh-v146.js?v=working-campus-v440" defer></script>
<script type="module" src="/app/open-learning-media-cache-v1.mjs?v=working-campus-v440"></script>`;
  const next=`<script src="/app/system-routes-v227.js?v=working-campus-v440-live-guild-balance-v1"></script>
<script src="/app/release-version-v2.js?v=working-campus-v440"></script>
<script src="/app/platform-experience-v160.js?v=working-campus-v440"></script>
<script src="/app/settings-gateway-v317.js?v=1.0.134-settings-v324-local-route-self-loading"></script>
${FAST_SCHEDULER}
<script src="/app/working-campus-v156.js?v=working-campus-fast-boot-v1"></script>`;
  return replaceRequired(source,old,next,'v440 eager runtime stack');
}

function migratePackage(source){
  if(!source.includes('"build:campus-fast-boot"')){
    source=replaceRequired(source,
      '    "test:ai-wallet-http": "npm run test:node-ai-http",\n',
      '    "test:ai-wallet-http": "npm run test:node-ai-http",\n    "build:campus-fast-boot": "node scripts/build-working-campus-fast-boot-v1.mjs",\n    "check:fast-boot": "node scripts/build-working-campus-fast-boot-v1.mjs --check && node scripts/verify-working-campus-fast-boot-v1.mjs",\n',
      'fast boot package scripts');
  }
  if(!source.includes('node scripts/build-working-campus-fast-boot-v1.mjs && npm run check:fast-boot')){
    source=replaceRequired(source,
      '"check": "node scripts/sync-release-version-assets.mjs && node scripts/build-service-worker-v211.mjs',
      '"check": "node scripts/sync-release-version-assets.mjs && node scripts/build-working-campus-fast-boot-v1.mjs && npm run check:fast-boot && node scripts/build-service-worker-v211.mjs',
      'main check pipeline');
  }
  return source;
}

const [campusSource,homeSource,packageSource,...partSource]=await Promise.all([
  readFile(campusPath,'utf8'),
  readFile(homePath,'utf8'),
  readFile(packagePath,'utf8'),
  ...parts.map(path=>readFile(path,'utf8'))
]);
const compiled=partSource.join('');
const campusNext=campusSource.includes(START)?refreshCompiledCore(campusSource,compiled):initialCampus(campusSource,compiled);
const homeNext=migrateHome(homeSource);
const packageNext=migratePackage(packageSource);
const changes=[
  [campusPath,campusSource,campusNext,'public/app/working-campus-v156.js'],
  [homePath,homeSource,homeNext,'public/app/working-campus-v440.html'],
  [packagePath,packageSource,packageNext,'package.json']
].filter(([,before,after])=>before!==after);

if(checkOnly){
  assert.equal(changes.length,0,`Fast Boot v1 generated files are stale: ${changes.map(row=>row[3]).join(', ')}`);
  console.log(JSON.stringify({ok:true,updated:false,revision:FAST_BOOT_REVISION,compiledParts:partSource.length,bytes:compiled.length,checkOnly:true},null,2));
}else{
  for(const [path,,after] of changes)await writeFile(path,after,'utf8');
  console.log(JSON.stringify({ok:true,updated:Boolean(changes.length),revision:FAST_BOOT_REVISION,changed:changes.map(row=>row[3]),compiledParts:partSource.length,bytes:compiled.length},null,2));
}
