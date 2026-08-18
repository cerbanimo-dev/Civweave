import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const dispatcher=read('public/app/fullscreen-family-v104.html');
const realm=read('public/app/realm-console-v140.html');
const parity=read('public/app/shared/civweave-parity-runtime.js');
const serviceWorker=read('public/service-worker.js');
const questPath=read('public/app/cerbanimo-quest-path-v266.js');
const packs=read('public/app/cerbanimo-learning-packs-v1.js');
const videos=read('public/app/cerbanimo-video-task-contract-v1.mjs');
const proofs=read('public/app/cerbanimo-proof-attachments-v165.js');

assert(dispatcher.includes("cerbanimo:'/app/realm-console-v140.html?system=cerbanimo&cabinet=1'"),'Canonical dispatcher no longer points to the tested Cerbanimo console.');
assert(realm.includes('data-build="realm-console-canonical-v243-parity-bounded-r1"'),'Cerbanimo console is missing the bounded parity-load build marker.');

assert(realm.includes('parity-bounded-r1'),'Cerbanimo console must cache-bust the bounded parity runtime.');
assert(parity.includes('FETCH_TIMEOUT_MS'),'Parity ledger loading must have a finite startup deadline.');
assert(parity.includes('AbortController'),'Parity ledger loading must cancel a stalled network request when supported.');
assert(parity.includes('Promise.race([request,deadline])'),'Parity ledger loading must not await a fetch forever.');
assert(parity.includes('LEDGER_PART_URLS'),'Parity ledger loading must retain a static chunk fallback for generated-ledger failures.');
assert(parity.includes("new DecompressionStream('gzip')"),'Parity chunk fallback must reconstruct the compressed source ledger in-browser.');
assert(parity.includes('CACHE_KEY'),'A validated parity ledger must be reusable locally on later launches.');
assert(parity.includes("cache:force?'reload':'no-store'"),'Generated parity ledger startup must bypass a potentially wedged HTTP cache entry.');
assert(!parity.includes("cache:force?'reload':'force-cache'"),'Generated parity ledger startup must not return to the unbounded force-cache path.');

assert(serviceWorker.includes("CABINET_REVISION='direct-software-r39-cerbanimo-parity-bounded'"),'Installed PWAs must advance the cabinet cache namespace when the Cerbanimo boot runtime changes.');
assert(serviceWorker.includes("LEDGER_HYDRATION_REVISION='direct-software-r36-bounded-parity'"),'Installed package metadata must identify the bounded parity-ledger revision.');
assert(serviceWorker.includes("'/app/realm-console-v140.html'"),'The installed device package must include the Cerbanimo realm console.');
assert(serviceWorker.includes("'/app/shared/civweave-parity-runtime.js','/app/shared/civweave-parity-ledger.json'"),'The installed device package must include the parity runtime and materialized ledger.');
assert(serviceWorker.includes('civweave-static-${VERSION}-${CACHE_REVISION}-${GUIDE_REVISION}-${CABINET_REVISION}'),'The device cache namespace must incorporate the cabinet revision so a cabinet hotfix refreshes installed assets.');

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

console.log('Cerbanimo load-freeze regression contract passed: installed caches refresh; parity data is bounded and recoverable; first paint wins; Quest paths, packs, and media are lazy; proof decoration converges.');
