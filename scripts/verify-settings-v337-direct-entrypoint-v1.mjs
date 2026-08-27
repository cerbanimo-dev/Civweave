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
const entrypoint=read('public/service-worker-settings-v337-entrypoint.js');
const loader=read('public/app/settings-local-loader-v337.js');

if(!campus.includes('/app/settings-gateway-v317.js'))fail('Canonical Working Campus no longer loads the shared Settings gateway; revalidate the direct-route bootstrap.');
if(!campus.includes('/app/system-routes-v227.js'))fail('Canonical Working Campus no longer declares the direct-route contract.');
if(!routes.includes('function shouldUseDirect(){return true}'))fail('System routes are no longer direct-first; revalidate which document owns Settings.');
if(!routes.includes('singlePersistentShell:false'))fail('System route ownership changed; do not assume Settings opens in a first-class realm document.');
if(!manifest.includes('"start_url": "/app/pwa-start-v436.html'))fail('Installed launch no longer passes through the worker-refresh doorway.');
if(!pwaStart.includes("const SHELL_WORKER_PATH='/service-worker-v203.js'"))fail('PWA start no longer refreshes the canonical shell worker.');
if(!pwaStart.includes('await registration.update()'))fail('PWA start no longer explicitly checks for a changed shell worker before entering the direct route.');

const bootstrapImport="importScripts('/service-worker-settings-v337-entrypoint.js?v=settings-v337-direct-gateway-bootstrap-v1');";
const legacyImport="importScripts('/service-worker-settings-v325-override.js?v=settings-v325-direct-local-models-v1');";
if(!worker.includes(bootstrapImport))fail('Shell worker does not import the v337 direct-route Settings bootstrap.');
if(worker.indexOf(bootstrapImport)>worker.indexOf(legacyImport))fail('v337 direct-route bootstrap must run before the historical v325 Settings override.');
if(!worker.includes("const V203_STAGING_SETTINGS_RECOVERY_CACHE='cwrecovery-v454-settings-v337-direct-gateway'"))fail('Shell worker lost the cache-distinct staging activation marker for the v337 bootstrap.');
if(!worker.includes('if(await v203StagingSettingsRecoveryPending())await self.skipWaiting()'))fail('Staging worker can remain waiting instead of replacing the broken Settings controller.');
for(const pathname of ['/app/settings-gateway-v317.js','/app/settings-local-loader-v337.js','/app/settings-local-route-v331.js']){
  if(!worker.includes(`'${pathname}'`))fail(`Staging activation does not purge stale executable Settings asset ${pathname}.`);
}

if(!entrypoint.includes("const CW_SETTINGS_V337_GATEWAY='/app/settings-gateway-v317.js'"))fail('v337 entrypoint does not own the shared Settings gateway.');
if(!entrypoint.includes("/app/settings-local-loader-v337.js?v=1.2.0-stage-full-route-v337-direct-gateway"))fail('v337 entrypoint does not request a cache-distinct recovery loader.');
if(!entrypoint.includes("output.replaceAll('CIVWEAVE SETTINGS · v324','CIVWEAVE SETTINGS · v325')"))fail('Direct Settings response can still advertise the broken v324 generation.');
if(!entrypoint.includes('event.stopImmediatePropagation()'))fail('v337 bootstrap can be bypassed by a later cache handler for the same gateway request.');
if(!entrypoint.includes("headers.set('cache-control','no-store')"))fail('v337 gateway response can be re-cached as another mixed Settings generation.');
if(!entrypoint.includes("document.createElement('script')"))fail('v337 gateway response does not bootstrap the recovery loader in the document that actually owns Settings.');

if(!loader.includes("const ROUTE_SRC='/app/settings-local-route-v331.js?cwAction=1&v=1.2.0-stage-full-route-v337'"))fail('Recovery loader no longer bypasses the display shim and requests the full renderer.');
if(!loader.includes('api?.settingsV325DisplayShim!==true'))fail('Recovery loader can accept the service-worker display shim as the full renderer.');
if(!loader.includes('api?.loaderBridge!==true'))fail('Recovery loader can accept a compatibility bridge as the full renderer.');
if(!loader.includes('attachRealm(globalThis)'))fail('Recovery loader no longer supports the direct-route document itself.');

console.log('PASS installed direct-route Settings owns a cache-distinct v337 bootstrap, activates immediately on staging, rejects shim/bridge lookalikes, and loads the full Local Models renderer in the real Settings document.');
