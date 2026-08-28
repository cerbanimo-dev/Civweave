import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const fail=message=>{throw new Error(message)};

const campus=read('public/app/working-campus-v440.html');
const pwaStart=read('public/app/pwa-start-v436.html');
const worker=read('public/service-worker-v203.js');
const workerEntrypoint=read('public/service-worker-settings-v337-entrypoint.js');
const direct338=read('public/app/settings-direct-entry-v338.js');
const direct339=read('public/app/settings-direct-entry-v339.js');
const directRenderer=read('public/app/settings-local-models-direct-v325.js');
const loader=read('public/app/settings-local-loader-v337.js');

if(!campus.includes('/app/settings-direct-entry-v339.js?v=1.4.0-settings-direct-entry-v339'))fail('Canonical campus is not directly anchored to Settings v339.');
if(campus.includes('/app/settings-direct-entry-v338.js?v=1.3.0-settings-direct-entry-v338'))fail('Canonical campus still reloads the superseded v338 direct Settings entry.');
if(!campus.includes('settingsRecovery=v339'))fail('Canonical campus recovery link can still fall back to the v338 generation.');
if(!pwaStart.includes("const START_REVISION='pwa-start-v448-settings-v339-exact-worker-generation'"))fail('Installed launcher revision is not the exact v339 worker generation.');
if(!pwaStart.includes("revision=settings-v339-saved-state-first-r1"))fail('Installed launcher does not request the v339 worker generation.');
if(!pwaStart.includes("navigator.serviceWorker.register(SHELL_WORKER_URL,{scope:'/',updateViaCache:'none'})"))fail('Installed launcher no longer registers the exact cache-distinct worker URL.');
if(!pwaStart.includes('workerURL(navigator.serviceWorker.controller)===expected'))fail('Installed launcher can still accept a worker by pathname instead of exact generation URL.');
if(!pwaStart.includes('exactWorkerGeneration:true'))fail('Installed launcher exact-worker contract marker missing.');
if(!pwaStart.includes("url.searchParams.set('settingsRecovery','v339')"))fail('Installed launcher still routes the campus to an older Settings recovery generation.');
if(!pwaStart.includes("settingsRecovery:'v339'"))fail('Installed launcher diagnostics do not identify v339.');
if(!worker.includes("const V203_REGISTERED_SETTINGS_GENERATION='v339-settings-saved-state-first-worker-boundary'"))fail('Canonical service-worker bytes were not advanced to the v339 Settings generation.');
if(!worker.includes("importScripts('/service-worker-settings-v337-entrypoint.js?v=settings-v339-saved-state-first-registered-worker-v1')"))fail('Canonical worker no longer imports the v339 Settings gateway recovery before cache handlers.');
if(worker.indexOf('service-worker-settings-v337-entrypoint.js')>worker.indexOf('service-worker-settings-v325-override.js'))fail('Settings recovery must register before the historical v325 override.');
if(!worker.includes("const V203_STAGING_SETTINGS_RECOVERY_CACHE='cwrecovery-v456-settings-v339-saved-state-first'"))fail('Staging worker activation boundary is not cache-distinct for v339.');
for(const pathname of ['/app/settings-gateway-v317.js','/app/settings-direct-entry-v338.js','/app/settings-direct-entry-v339.js','/app/settings-local-models-direct-v325.js','/app/settings-local-loader-v337.js','/app/settings-local-route-v331.js']){
  if(!worker.includes(`'${pathname}'`))fail(`v339 activation does not purge stale executable Settings asset ${pathname}.`);
}

if(!workerEntrypoint.includes("const CW_SETTINGS_V339_ENTRY='/app/settings-direct-entry-v339.js?v=1.4.0-settings-direct-entry-v339'"))fail('Gateway does not bootstrap the cache-distinct v339 page recovery.');
if(!workerEntrypoint.includes("const CW_SETTINGS_V339_BOOTSTRAP_MARKER='v339-saved-state-first-bootstrap'"))fail('v339 gateway bootstrap marker missing.');
if(!workerEntrypoint.includes("output.replaceAll('CIVWEAVE SETTINGS · v324','CIVWEAVE SETTINGS · v339')"))fail('Gateway can still present the broken v324 generation.');
if(!workerEntrypoint.includes('event.stopImmediatePropagation()'))fail('Settings gateway recovery can be bypassed by a later cache handler.');

if(!direct339.includes("const VERSION='1.4.0-settings-direct-entry-v339'"))fail('v339 direct recovery generation missing.');
if(!direct339.includes('function renderSavedState()'))fail('v339 does not have a synchronous saved-state display path.');
if(!direct339.includes("typeof renderer?.render!=='function'"))fail('v339 does not directly invoke the read-only Local Models renderer.');
if(!direct339.includes("setStatus('Opening saved local model controls…')"))fail('v339 can still leave the old Reading placeholder unchanged while recovery starts.');
if(!direct339.includes('new MutationObserver'))fail('v339 still depends only on click/event ordering.');
if(!direct339.includes('const watchdog=setInterval'))fail('v339 lacks a bounded self-recovery watch while Local models remains selected.');
if(!direct339.includes('await loadDirectRenderer();if(renderSavedState())return true'))fail('v339 does not prioritize saved-state rendering before the full route.');
if(!direct339.includes('const loader=await loadFullLoader()'))fail('v339 lost the full-route fallback for explicit actions/recovery.');
if(!direct339.includes('savedStateFirst:true'))fail('v339 saved-state-first contract marker missing.');
if(!direct339.includes('serviceWorkerIndependentDisplay:true'))fail('v339 direct display ownership marker missing.');
if(!direct339.includes('data-settings-v339-diagnostics'))fail('v339 failure diagnostics missing.');

if(!directRenderer.includes('Model lifecycle, cache, service-worker, GPU, and inference code stay unloaded until you choose an action.'))fail('Read-only direct renderer no longer keeps model lifecycle code lazy while displaying saved state.');
if(!directRenderer.includes('ACTION_ROUTE='))fail('Direct renderer no longer lazy-loads the action route.');
if(!loader.includes("cwAction=1"))fail('Full-route fallback no longer explicitly bypasses the display shim.');
if(!direct338.includes('serviceWorkerIndependent:true'))fail('Legacy v338 fallback lost its bounded safety contract.');

console.log('PASS Settings v339 is pinned end-to-end across exact installed worker URL, canonical campus, canonical worker, saved-state renderer, and diagnostics; pathname-only matching cannot reassert v338.');
