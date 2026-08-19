import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const shell=read('public/app/persistent-family-shell-v1.html');
const realm=read('public/app/realm-console-v140.html');
const parity=read('public/app/shared/civweave-parity-runtime.js');
const activeWorker=read('public/service-worker-v203.js');
const releaseCoherence=read('public/service-worker-release-coherence-v220.js');
const questPath=read('public/app/cerbanimo-quest-path-v266.js');
const questEngine=read('public/app/cerbanimo-quest-engine-v144.js');
const navStability=read('public/app/cerbanimo-nav-stability-v1.js');
const taskTools=read('public/app/cerbanimo-task-tool-links-v1.mjs');
const packs=read('public/app/cerbanimo-learning-packs-v1.js');
const videos=read('public/app/cerbanimo-video-task-contract-v1.mjs');
const proofs=read('public/app/cerbanimo-proof-attachments-v165.js');

assert(shell.includes("cerbanimo:'/app/realm-console-v140.html'"),'Persistent family shell no longer points Cerbanimo at the tested realm console.');
assert(shell.includes('id="cw-family-stage"'),'Persistent family shell must retain the canonical realm stage iframe.');
assert(realm.includes('data-build="realm-console-canonical-v248-persistent-shell-safe-boot-r1"'),'Cerbanimo console is missing the persistent-shell-safe boot marker.');

const parityIndex=realm.indexOf('/app/shared/civweave-parity-runtime.js');
const consoleIndex=realm.indexOf('/app/realm-console-v140.js');
const optionalIndex=realm.indexOf('/app/local-first-policy-v131.js');
assert(parityIndex>=0&&consoleIndex>=0&&optionalIndex>=0&&parityIndex<optionalIndex&&consoleIndex<optionalIndex,'Cerbanimo render-critical parity and console scripts must execute before optional deferred integrations.');
assert(realm.includes('canonical-r3-boot-first'),'Cerbanimo console must cache-bust the render-critical boot ordering.');

assert(realm.includes('parity-bounded-r1'),'Cerbanimo console must cache-bust the bounded parity runtime.');
assert(parity.includes('FETCH_TIMEOUT_MS'),'Parity ledger loading must have a finite startup deadline.');
assert(parity.includes('AbortController'),'Parity ledger loading must cancel a stalled network request when supported.');
assert(parity.includes('Promise.race([request,deadline])'),'Parity ledger loading must not await a fetch forever.');
assert(parity.includes('LEDGER_PART_URLS'),'Parity ledger loading must retain a static chunk fallback for generated-ledger failures.');
assert(parity.includes("new DecompressionStream('gzip')"),'Parity chunk fallback must reconstruct the compressed source ledger in-browser.');
assert(parity.includes('CACHE_KEY'),'A validated parity ledger must be reusable locally on later launches.');
assert(parity.includes("cache:force?'reload':'no-store'"),'Generated parity ledger startup must bypass a potentially wedged HTTP cache entry.');
assert(!parity.includes("cache:force?'reload':'force-cache'"),'Generated parity ledger startup must not return to the unbounded force-cache path.');

assert(activeWorker.includes('cerbanimo-boot-network-first-v1'),'The installed PWA worker must rotate when the Cerbanimo boot path changes.');
assert(activeWorker.includes("/service-worker-release-coherence-v220.js?v=release-coherence-v226"),'The active worker must retain release-coherence ownership.');
for(const path of [
  '/app/realm-console-v140.html',
  '/app/realm-console-v140.js',
  '/app/shared/civweave-parity-runtime.js',
  '/app/shared/civweave-parity-ledger.json',
  '/app/shared/civweave-parity-ledger.part1.b64',
  '/app/shared/civweave-parity-ledger.part2.b64',
  '/app/shared/civweave-parity-ledger.part3.b64',
  '/app/shared/civweave-parity-ledger.part4.b64',
  '/app/shared/cabinet-shells-v129.json'
])assert(releaseCoherence.includes(`'${path}'`),`Release coherence must force ${path} through the fresh boot path.`);
assert(releaseCoherence.includes("V220_TEXT_ASSET = /\\.(?:html?|css|m?js|json|webmanifest|txt|b64)$/i"),'Parity fallback chunks must be eligible for release-coherent text refresh.');
assert(releaseCoherence.includes('v220FreshAsset(request, url)'),'Cerbanimo boot assets must use the release-coherent network-first path while online.');
assert(releaseCoherence.includes("policy: 'version-pinned-html-js-css-json-txt-network-first-cached-fallback'"),'Release-coherence policy marker drifted unexpectedly.');

assert(realm.includes('/app/themed-system-nav-v178.js?v=1.0.163-five-guide-rail-direct-r1'),'Cerbanimo must load the canonical five-guide navigation directly.');
assert(realm.includes('/app/cerbanimo-nav-stability-v1.js?v=nav-stability-r2-persistent-shell-safe'),'Cerbanimo must cache-bust persistent-shell-safe navigation recovery.');
assert(navStability.includes('canonicalPersistentShell'),'Cerbanimo navigation recovery must distinguish the canonical persistent shell from accidental embedding.');
assert(navStability.includes("frame?.id==='cw-family-stage'"),'Cerbanimo must recognize the canonical persistent family stage.');
assert(navStability.includes("shellRevision==='persistent-family-shell-v1'"),'Cerbanimo must recognize the live persistent family shell revision.');
assert(navStability.includes('if(!canonicalPersistentShell&&standalone)'),'Only accidental standalone embedding may escape to the top-level realm route.');
assert(navStability.includes('window.top.location.replace(location.href)'),'Accidental standalone embedding must retain bounded escape recovery.');
assert(navStability.includes("[0,180,700,1800]"),'Navigation recovery must stay bounded rather than polling indefinitely.');
assert(navStability.includes("addEventListener('pageshow',ensure)"),'Navigation recovery must remount after page lifecycle restoration.');
assert(!navStability.includes('setInterval'),'Navigation recovery must not use a permanent polling timer.');

assert(!realm.includes('/app/family-shell-v104.js'),'Cerbanimo must not load the legacy family-shell polling runtime.');
assert(!realm.includes('/app/family-shell-v104.css'),'Cerbanimo must not depend on legacy family-shell presentation CSS.');

assert(realm.includes('/app/cerbanimo-quest-engine-v144.js?v=quest-engine-r25-frame-bounded'),'Cerbanimo must cache-bust the frame-bounded Quest engine.');
assert(questEngine.includes("const VERSION='1.0.33-cerbanimo-v144-frame-bounded'"),'Quest engine must expose the frame-bounded runtime revision.');
assert(questEngine.includes('requestAnimationFrame(run)'),'Quest engine rerenders must yield to a browser frame instead of chaining microtasks.');
assert(questEngine.includes("observer.observe(target,{childList:true,subtree:false})"),'Quest engine must observe only console-shell replacement, not every descendant mutation.');
assert(!questEngine.includes("observer.observe(document.querySelector('#rc-app')||document.documentElement,{childList:true,subtree:true})"),'Quest engine must not restore the broad subtree observer that wakes on every UI mutation.');

assert(realm.includes('/app/cerbanimo-task-tool-links-v1.mjs?v=task-tool-links-r2-frame-bounded'),'Cerbanimo must cache-bust bounded Creator task-tool decoration.');
assert(taskTools.includes('function relevantMutation(records)'),'Creator task-tool decoration must filter DOM mutations before doing state work.');
assert(taskTools.includes('requestAnimationFrame(run)'),'Creator task-tool decoration must yield to a browser frame.');
assert(taskTools.includes("if(params.get('system')!=='cerbanimo')return"),'Creator task-tool decoration must stay off non-Cerbanimo realm-console routes.');
assert(!taskTools.includes('new MutationObserver(schedule)'),'Creator task-tool decoration must not react to every subtree mutation.');
assert(!taskTools.includes('queueMicrotask(()=>{queued=false;renderTaskToolLinks()})'),'Creator task-tool decoration must not create a boot-time microtask feedback loop.');

assert(realm.includes('/app/cerbanimo-quest-path-v266.js'),'Cerbanimo must retain generated Quest-path materialization.');
assert(questPath.includes("addEventListener('load',scheduleBoot"),'Generated Cerbanimo Quest paths must wait until the console page has finished loading.');
assert(questPath.includes('requestIdleCallback'),'Generated Cerbanimo Quest paths must defer materialization until browser idle time.');
assert(questPath.includes('MATERIALIZED_KEY'),'Generated Cerbanimo Quest paths must remember a completed materialization and skip repeat boot work.');
assert(!questPath.includes("addEventListener('DOMContentLoaded',boot"),'Generated Cerbanimo Quest paths must not materialize from DOMContentLoaded.');
assert(!questPath.includes('tries++'),'Generated Cerbanimo Quest paths must not poll the boot path waiting for readiness.');
assert(!questPath.includes('setTimeout(run,50)'),'Generated Cerbanimo Quest paths must not run a 50ms boot retry loop.');
assert(realm.includes('quest-path-lazy-r2'),'Cerbanimo console must cache-bust the non-blocking Quest-path adapter.');

assert(packs.includes('openShelf'),'Cerbanimo learning packs need an explicit lazy open entrypoint.');
assert(packs.includes('data-cw-cerbanimo-pack-launcher')||packs.includes('cwCerbanimoPackLauncher'),'Cerbanimo learning packs need a lightweight boot launcher.');
assert(!packs.includes('queueMicrotask(()=>ready()'),'Cerbanimo must not bootstrap learning packs from the boot microtask queue.');
assert(!packs.match(/(?:^|[;{}])\s*ready\(\)\.then\(/m),'Cerbanimo must not call learning-pack ready() automatically at module load.');
assert(realm.includes('learning-packs-v1-lazy-r1'),'Cerbanimo console must cache-bust the lazy learning-pack adapter.');

assert(!realm.includes('<script type="module" src="/app/open-learning-media-cache-v1.mjs'),'Open Learning Media must not be parsed eagerly by the Cerbanimo entry.');
assert(videos.includes('import(CONTRACT)'),'Cerbanimo video support must load the shared video/media contract on demand.');
assert(videos.includes("addEventListener('civweave:assistant-runtime-ready'"),'Cerbanimo video AI harness must follow explicit assistant runtime activation.');
assert(videos.includes('ensureTaskVideo(task.dataset.taskId)'),'Cerbanimo task video hydration must begin from task interaction.');
assert(!videos.includes('const timer=setInterval'),'Cerbanimo video support must not poll and reconcile the whole quest ledger during boot.');
assert(!videos.includes('reconcile();'),'Cerbanimo video support must not automatically hydrate every stored task during install.');
assert(realm.includes('video-atlas-lazy-r1'),'Cerbanimo console must cache-bust the lazy video task contract.');

assert(proofs.includes('function relevantMutation(records)'),'Proof attachments must filter DOM mutations before decorating.');
assert(!proofs.includes('new MutationObserver(scheduleDecorate)'),'Proof attachments must not schedule decoration for every subtree mutation.');
assert(proofs.includes("if(span.textContent!==text)span.textContent=text"),'Attachment decoration must be idempotent.');
assert(proofs.includes("if(link.textContent!==value)link.textContent=value"),'Proof-link decoration must be idempotent.');
assert(realm.includes('file-link-image-proof-r2'),'Cerbanimo console must cache-bust the idempotent proof runtime.');

console.log('Cerbanimo load-freeze regression contract passed: the canonical persistent shell keeps ownership of navigation; render-critical scripts run before optional integrations; parity remains bounded and recoverable; Quest/task decorators are frame-bounded; generated paths, packs, and media stay lazy; proof decoration converges.');
