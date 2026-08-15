import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const runtimePath='public/app/core-interface-runtime-v1.js';
const boundaryPath='public/app/install-boundary-v146.js';
const routesPath='public/app/system-routes-v227.js';
const shellPath='public/app/family-shell-v104.js';
const criticalPath='public/service-worker-critical-v199.js';
const registryPath='config/system-ownership.json';
const [runtime,boundary,routes,shell,critical,registryText]=await Promise.all([
  read(runtimePath),read(boundaryPath),read(routesPath),read(shellPath),read(criticalPath),read(registryPath)
]);
const registry=JSON.parse(registryText);
const owner=registry.systems['interface-runtime'];
const expectedSystems=['civweave','living-school','cerbanimo','fellowfare','anarchadia'];
const expectedRoutes=[
  'public/app/working-campus-v156.html',
  'public/app/cabinets/living-school/index.html',
  'public/app/realm-console-v140.html',
  'public/app/fellowfare-cabinet-v144.html',
  'public/app/anarchadia-console-v139.html'
];

assert.doesNotThrow(()=>new Function(runtime),`${runtimePath} does not compile.`);
assert.doesNotThrow(()=>new Function(boundary),`${boundaryPath} does not compile.`);
assert.doesNotThrow(()=>new Function(routes),`${routesPath} does not compile.`);
assert.doesNotThrow(()=>new Function(shell),`${shellPath} does not compile.`);

assert.ok(owner,'Interface runtime ownership is not registered.');
assert.equal(owner.owner,runtimePath);
assert.equal(owner.bootstrapCaller,boundaryPath);
assert.equal(owner.routeContract,routesPath);
assert.equal(owner.navigationSubscriber,shellPath);
assert.equal(owner.canonicalApi,'globalThis.CivweaveCoreInterfaceRuntimeV1');
assert.deepEqual(owner.activeEntryRoutes,expectedRoutes);

for(const id of expectedSystems)assert.match(runtime,new RegExp(`['\"]${id.replace('-','\\-')}['\"]`),`Runtime manifest is missing ${id}.`);
for(const route of expectedRoutes)assert.ok(runtime.includes(route.replace('public','')),`Runtime route manifest is missing ${route}.`);
assert.match(runtime,/const SYSTEM_ORDER=Object\.freeze\(\['civweave','living-school','cerbanimo','fellowfare','anarchadia'\]\)/);
assert.match(runtime,/function registerAdapter\(/);
assert.match(runtime,/function registerFeature\(/);
assert.match(runtime,/async function requestFeature\(/);
assert.match(runtime,/function navigate\(/);
assert.match(runtime,/function ensureStructuralSlots\(/);
assert.match(runtime,/civweave:interface-runtime-phase/);
assert.match(runtime,/civweave:interface-runtime-ready/);
assert.match(runtime,/civweave:interface-system-ready/);
assert.match(runtime,/addEventListener\?\.\('pagehide'/);
assert.match(runtime,/addEventListener\?\.\('pageshow'/);
assert.match(runtime,/familyNavigationOwner:'family-shell-v104'/);
assert.match(runtime,/settingsInputOwner:'settings-gateway-v317'/);
assert.doesNotMatch(runtime,/data-open-unified-ai-settings/,'Core runtime may not become a second Settings input owner.');
assert.doesNotMatch(runtime,/addEventListener\?*\.?\('click'/,'Core runtime may not own arbitrary global click input.');

assert.match(boundary,/const CORE_INTERFACE_RUNTIME='\/app\/core-interface-runtime-v1\.js'/);
const experience=boundary.match(/const SYSTEM_EXPERIENCE_SCRIPTS=\[([\s\S]*?)\n\];/)?.[1]||'';
assert.match(experience,/CORE_INTERFACE_RUNTIME/,'Install boundary does not request the core interface runtime for canonical systems.');
assert.ok(experience.indexOf('CORE_INTERFACE_RUNTIME')<experience.indexOf('SETTINGS_GATEWAY'),'Core interface runtime must establish lifecycle before optional shared feature gateways are requested.');
assert.equal((experience.match(/CORE_INTERFACE_RUNTIME/g)||[]).length,1,'Core interface runtime must appear exactly once in the canonical experience list.');
assert.ok(critical.includes("'/app/core-interface-runtime-v1.js'"),'Offline critical cache does not include the core interface runtime.');

assert.equal(registry.systems.settings.inputOwner,'public/app/settings-gateway-v317.js');
assert.equal(registry.systems['family-navigation'].owner,'public/app/family-shell-v104.js');
assert.equal(registry.systems['family-navigation'].routeContract,routesPath);
assert.match(shell,/settingsInputOwnership:false/);

console.log(JSON.stringify({
  ok:true,
  schema:'civweave.core-interface-runtime.verification.v1',
  runtime:runtimePath,
  systems:expectedSystems,
  activeRoutes:expectedRoutes,
  invariants:{
    oneCoreRuntime:true,
    oneSettingsInputOwner:true,
    familyNavigationOwnerPreserved:true,
    adapterContract:true,
    lifecycleContract:true,
    offlineCritical:true
  }
},null,2));
