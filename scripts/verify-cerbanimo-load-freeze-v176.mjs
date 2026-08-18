import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const dispatcher=read('public/app/fullscreen-family-v104.html');
const realm=read('public/app/realm-console-v140.html');
const parity=read('public/app/shared/civweave-parity-runtime.js');
const activeWorker=read('public/service-worker-v203.js');
const releaseCoherence=read('public/service-worker-release-coherence-v220.js');
const questPath=read('public/app/cerbanimo-quest-path-v266.js');
const questEngine=read('public/app/cerbanimo-quest-engine-v144.js');
const familyShell=read('public/app/family-shell-v104.js');
const navStability=read('public/app/cerbanimo-nav-stability-v1.js');
const packs=read('public/app/cerbanimo-learning-packs-v1.js');
const videos=read('public/app/cerbanimo-video-task-contract-v1.mjs');
const proofs=read('public/app/cerbanimo-proof-attachments-v165.js');

assert(dispatcher.includes("cerbanimo:'/app/realm-console-v140.html?system=cerbanimo&cabinet=1'"),'Canonical dispatcher no longer points to the tested Cerbanimo console.');
assert(realm.includes('data-build="realm-console-canonical-v246-long-session-stability-r1"'),'Cerbanimo console is missing the long-session stability build marker.');

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
assert(realm.includes('/app/cerbanimo-nav-stability-v1.js?v=nav-stability-r1'),'Cerbanimo must retain bounded navigation recovery.');
assert(navStability.includes("[0,180,700,1800]"),'Navigation recovery must stay bounded rather than polling indefinitely.');
assert(navStability.includes("addEventListener('pageshow',ensure)"),'Navigation recovery must remount after page lifecycle restoration.');
assert(navStability.includes('window.top.location.replace(location.href)'),'An installed Cerbanimo surface must escape an accidental embedded route instead of silently deleting global navigation.');
assert(!navStability.includes('setInterval'),'Navigation recovery must not use a permanent polling timer.');

assert(!familyShell.includes('setInterval(refresh,30000)'),'The shared family shell must not wake every 30 seconds and rescan local state during an idle session.');
assert(familyShell.includes("addEventListener('cerbanimo:quest-engine-changed',refresh)"),'Cerbanimo family status must refresh from actual quest changes.');
assert(familyShell.includes('scheduleClickRefresh'),'Family-shell click refreshes must be coalesced.');

assert(realm.includes('/app/cerbanimo-quest-engine-v144.js?v=quest-engine-r25-frame-bounded'),'Cerbanimo must cache-bust the frame-bounded Quest engine.');
assert(questEngine.includes("const VERSION='1.0.33-cerbanimo-v144-frame-bounded'"),'Quest engine must expose the frame-bounded runtime revision.');
assert(questEngine.includes("requestAnimationFrame(run)"),'Quest engine rerenders must yield to a browser frame instead of chaining microtasks.');
assert(questEngine.includes("observer.observe(target,{childList:true,subtree:false})"),'Quest engine must observe only console-shell replacement, not every descendant mutation.');
assert(!questEngine.includes("observer.observe(document.querySelector('#rc-app')||document.documentElement,{childList:true,subtree:true})"),'Quest engine must not restore the broad subtree observer that wakes on every UI mutation.');

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

console.log('Cerbanimo load-freeze regression contract passed: navigation is directly owned and bounded-recoverable; idle family-shell polling is removed; Quest rerenders are frame-bounded; parity remains recoverable; generated paths, packs, and media stay lazy; proof decoration converges.');
