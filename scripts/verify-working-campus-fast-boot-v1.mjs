import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const [campus,home,settings,...parts]=await Promise.all([
  read('public/app/working-campus-v156.js'),
  read('public/app/working-campus-v440.html'),
  read('public/app/settings-gateway-v317.js'),
  ...[1,2,3,4,5].map(index=>read(`public/app/working-campus-v156.part${index}.txt`))
]);

const START='/* CIVWEAVE_FAST_BOOT_CORE_START */';
const END='/* CIVWEAVE_FAST_BOOT_CORE_END */';
const start=campus.indexOf(START),end=campus.indexOf(END);
assert.ok(start>=0&&end>start,'Compiled core markers are missing.');
assert.equal(campus.slice(start+START.length,end),`\n${parts.join('')}\n`,'Compiled core drifted from the five maintained source parts.');
for(const retired of ['async function fetchPart(','Promise.all(parts.map(fetchPart))','Function(source.join('])assert.ok(!campus.includes(retired),`Fast boot still contains runtime source assembly: ${retired}`);
for(const token of [
  "const FAST_BOOT_REVISION='working-campus-fast-boot-v1'",
  'const COMPILED_PART_COUNT=5',
  'function runCompiledCore()',
  'runtimeSourceFetches:0',
  'runtimeStringCompilation:false',
  'hubBlocking:false',
  'scheduleHubHydration();'
])assert.ok(campus.includes(token),`Working Campus loader is missing ${token}.`);
const boot=campus.slice(campus.indexOf('async function boot(){'),campus.indexOf('boot().catch'));
assert.ok(boot.includes('runCompiledCore();'),'Compiled core is not executed by boot.');
assert.ok(!boot.includes('await ensureHub()'),'Weaveling hub still blocks the critical boot path.');
assert.ok(boot.indexOf('runCompiledCore();')<boot.indexOf('scheduleHubHydration();'),'Hub hydration must occur after the compiled core becomes interactive.');

const staticScripts=[...home.matchAll(/<script\s+src="([^"]+)"/g)].map(match=>new URL(match[1],'https://civweave.invalid').pathname);
const expectedStatic=[
  '/app/japanese-mode-v1.js',
  '/app/japanese-shell-copy-v1.js',
  '/app/document-lifecycle-v221.js',
  '/app/system-routes-v227.js',
  '/app/release-version-v2.js',
  '/app/platform-experience-v160.js',
  '/app/settings-gateway-v317.js',
  '/app/working-campus-v156.js'
];
assert.deepEqual(staticScripts,expectedStatic,'v440 eager script set drifted from the Fast Boot v1 critical boundary.');
for(const eagerForbidden of [
  '/app/settings-local-route-v327.js',
  '/app/model-settings-controller-v173.js',
  '/app/mobile-ai-hardening-v302.js',
  '/app/family-ai-loader-v105.js',
  '/app/merlinites-semantic-planner-v164.js',
  '/app/working-campus-home-declutter-v1.js',
  '/app/new-user-onboarding-v1.js',
  '/app/guide-chat-surface-v350.js',
  '/app/working-campus-topbar-v243.js',
  '/app/themed-system-nav-v178.js',
  '/app/campus-background-download-v241.js',
  '/app/shared-review-surface-v234.js',
  '/app/shared-guide-surface-v236.js',
  '/app/local-object-mesh-v146.js'
])assert.ok(!staticScripts.includes(eagerForbidden),`${eagerForbidden} must not block v440 startup.`);
for(const deferred of [
  '/app/guild-symbol-v1.js?v=working-campus-v440-purpose-icons-v2',
  '/app/new-user-onboarding-v1.js?v=working-campus-v440',
  '/app/guide-chat-surface-v350.js?v=working-campus-v440',
  '/app/working-campus-topbar-v243.js?v=working-campus-v440',
  '/app/themed-system-nav-v178.js?v=working-campus-v440',
  '/app/working-campus-home-relocation-v441.js?v=working-campus-v441-purpose-icons-v2',
  '/app/shared-review-surface-v234.js?v=working-campus-v440',
  '/app/shared-guide-surface-v236.js?v=working-campus-v440-live-guild-balance-v1',
  '/app/campus-background-download-v241.js?v=working-campus-v440',
  '/app/local-object-mesh-v146.js?v=working-campus-v440',
  '/app/mobile-ai-hardening-v302.js?v=working-campus-v440',
  '/app/family-ai-loader-v105.js?v=working-campus-v440',
  '/app/merlinites-semantic-planner-v164.js?v=working-campus-v440',
  "/app/open-learning-media-cache-v1.mjs?v=working-campus-v440"
])assert.ok(home.includes(deferred),`Fast-boot scheduler lost deferred dependency ${deferred}.`);
for(const token of [
  "const REVISION='working-campus-fast-boot-v1'",
  'afterFirstPaint(()=>loadOrdered(POST_PAINT));',
  'scheduleIdle(()=>{',
  "document.addEventListener('submit'",
  'ensureAI().then(()=>',
  'settingsLocalRouteSelfLoading:true',
  'data-build="working-campus-v440-fast-boot-v1'
])assert.ok(home.includes(token),`v440 fast-boot scheduler is missing ${token}.`);
assert.ok(settings.includes("localModelRouteSelfLoading:true"),'Settings gateway no longer self-loads the local model route.');
assert.ok(settings.includes("if(name==='local-models')"),'Settings gateway lost explicit Local models tab activation.');
assert.ok(settings.includes('afterPaint(()=>void ensureManagement(layer))'),'Local model management no longer waits until after the settings tab paints.');

console.log(JSON.stringify({
  ok:true,
  revision:'working-campus-fast-boot-v1',
  compiledParts:parts.length,
  eagerScripts:staticScripts,
  runtimeSourceFetches:0,
  runtimeStringCompilation:false,
  hubBlocking:false,
  settingsLocalRoute:'self-loading-on-tab',
  aiStartup:'first-interaction',
  enrichment:'post-paint-and-idle'
},null,2));
