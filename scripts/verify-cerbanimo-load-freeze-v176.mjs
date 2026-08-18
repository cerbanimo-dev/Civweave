import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const dispatcher=read('public/app/fullscreen-family-v104.html');
const realm=read('public/app/realm-console-v140.html');
const questPath=read('public/app/cerbanimo-quest-path-v266.js');
const packs=read('public/app/cerbanimo-learning-packs-v1.js');
const videos=read('public/app/cerbanimo-video-task-contract-v1.mjs');
const proofs=read('public/app/cerbanimo-proof-attachments-v165.js');

assert(dispatcher.includes("cerbanimo:'/app/realm-console-v140.html?system=cerbanimo&cabinet=1'"),'Canonical dispatcher no longer points to the tested Cerbanimo console.');
assert(realm.includes('data-build="realm-console-canonical-v242-cerbanimo-lazy-boot-r2"'),'Cerbanimo console is missing the lazy-boot build marker.');

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

console.log('Cerbanimo load-freeze regression contract passed: first paint wins; Quest paths, packs, and media are lazy; proof decoration converges.');
