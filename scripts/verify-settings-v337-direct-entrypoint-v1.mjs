import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const fail=message=>{throw new Error(message)};

const campus=read('public/app/working-campus-v440.html');
const routes=read('public/app/system-routes-v227.js');
const pwaStart=read('public/app/pwa-start-v436.html');
const manifest=read('public/app/manifest.webmanifest');
const worker=read('public/service-worker-v203.js');
const workerEntrypoint=read('public/service-worker-settings-v337-entrypoint.js');
const directEntrypoint=read('public/app/settings-direct-entry-v338.js');
const loader=read('public/app/settings-local-loader-v337.js');

if(!campus.includes('/app/settings-gateway-v317.js?v=1.0.135-settings-v338-direct-entry'))fail('Canonical Working Campus can still request the v324 Settings gateway generation.');
if(campus.includes('/app/settings-gateway-v317.js?v=1.0.133-settings-v324-direct-local-model-view'))fail('Broken v324 Settings gateway request returned to the canonical Working Campus.');
if(!campus.includes('/app/settings-direct-entry-v338.js?v=1.3.0-settings-direct-entry-v338'))fail('Canonical Working Campus does not load the service-worker-independent Settings v338 entrypoint.');
if(!campus.includes('/app/system-routes-v227.js'))fail('Canonical Working Campus no longer declares the direct-route contract.');
if(!routes.includes('function shouldUseDirect(){return true}'))fail('System routes are no longer direct-first; revalidate which document owns Settings.');
if(!routes.includes('singlePersistentShell:false'))fail('System route ownership changed; do not assume Settings opens in a first-class realm document.');
if(!manifest.includes('"start_url": "/app/pwa-start-v436.html'))fail('Installed launch no longer passes through the worker-refresh doorway.');
if(!pwaStart.includes("const SHELL_WORKER_PATH='/service-worker-v203.js'"))fail('PWA start no longer refreshes the canonical shell worker.');
if(!pwaStart.includes("revision=settings-v338-direct-entry-r1"))fail('Installed launch does not request the Settings v338 worker generation.');
if(!pwaStart.includes("url.searchParams.set('settingsRecovery','v338')"))fail('Installed navigation is not cache-distinct for the Settings v338 recovery generation.');
if(!pwaStart.includes('await registration.update()'))fail('PWA start no longer explicitly checks for a changed shell worker before entering the direct route.');

if(!directEntrypoint.includes("const VERSION='1.3.0-settings-direct-entry-v338'"))fail('Direct Settings entrypoint lost its v338 generation marker.');
if(!directEntrypoint.includes("const LOADER_SRC='/app/settings-local-loader-v337.js?v=1.3.0-settings-direct-entry-v338'"))fail('Direct Settings entrypoint does not request a cache-distinct full-route loader.');
if(!directEntrypoint.includes("label.textContent='CIVWEAVE SETTINGS · v338'"))fail('The visible Settings generation cannot prove that the direct entrypoint is active.');
if(!directEntrypoint.includes('loader.recover(globalThis)'))fail('Direct Settings entrypoint no longer invokes the full Local Models recovery in the actual page realm.');
if(!directEntrypoint.includes('navigator.serviceWorker?.controller?.scriptURL'))fail('Failure diagnostics no longer expose the active service-worker controller.');
if(!directEntrypoint.includes('serviceWorkerIndependent:true'))fail('Direct page ownership contract is missing.');

const bootstrapImport="importScripts('/service-worker-settings-v337-entrypoint.js?v=settings-v337-direct-gateway-bootstrap-v1');";
const legacyImport="importScripts('/service-worker-settings-v325-override.js?v=settings-v325-direct-local-models-v1');";
if(!worker.includes(bootstrapImport))fail('Shell worker does not import the v337 direct-route Settings bootstrap.');
if(worker.indexOf(bootstrapImport)>worker.indexOf(legacyImport))fail('v337 direct-route bootstrap must run before the historical v325 Settings override.');
if(!worker.includes("const V203_STAGING_SETTINGS_RECOVERY_CACHE='cwrecovery-v454-settings-v337-direct-gateway'"))fail('Shell worker lost the cache-distinct staging activation marker for the v337 bootstrap.');
if(!worker.includes('if(await v203StagingSettingsRecoveryPending())await self.skipWaiting()'))fail('Staging worker can remain waiting instead of replacing the broken Settings controller.');
for(const pathname of ['/app/settings-gateway-v317.js','/app/settings-local-loader-v337.js','/app/settings-local-route-v331.js']){
  if(!worker.includes(`'${pathname}'`))fail(`Staging activation does not purge stale executable Settings asset ${pathname}.`);
}

if(!workerEntrypoint.includes("const CW_SETTINGS_V337_GATEWAY='/app/settings-gateway-v317.js'"))fail('v337 worker entrypoint does not own the shared Settings gateway.');
if(!workerEntrypoint.includes("/app/settings-local-loader-v337.js?v=1.2.0-stage-full-route-v337-direct-gateway"))fail('v337 worker entrypoint does not request a cache-distinct recovery loader.');
if(!workerEntrypoint.includes("output.replaceAll('CIVWEAVE SETTINGS · v324','CIVWEAVE SETTINGS · v325')"))fail('Worker fallback can still advertise the broken v324 generation.');
if(!workerEntrypoint.includes('event.stopImmediatePropagation()'))fail('v337 worker bootstrap can be bypassed by a later cache handler for the same gateway request.');

if(!loader.includes("const ROUTE_SRC='/app/settings-local-route-v331.js?cwAction=1&v=1.2.0-stage-full-route-v337'"))fail('Recovery loader no longer bypasses the display shim and requests the full renderer.');
if(!loader.includes('api?.settingsV325DisplayShim!==true'))fail('Recovery loader can accept the service-worker display shim as the full renderer.');
if(!loader.includes('api?.loaderBridge!==true'))fail('Recovery loader can accept a compatibility bridge as the full renderer.');
if(!loader.includes('attachRealm(globalThis)'))fail('Recovery loader no longer supports the direct-route document itself.');

console.log('PASS canonical Working Campus loads Settings recovery directly, installed launch is cache-distinct, v324 is rejected, worker fallback remains available, and failures expose the active worker/controller generation.');