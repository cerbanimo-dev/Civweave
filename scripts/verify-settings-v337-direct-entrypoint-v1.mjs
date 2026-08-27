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

if(!campus.includes('/app/settings-direct-entry-v338.js?v=1.3.0-settings-direct-entry-v338'))fail('Canonical campus lost the direct Settings recovery anchor.');
if(!pwaStart.includes('await registration.update()'))fail('Installed launch must explicitly refresh the service worker and its imported scripts.');
if(!worker.includes("importScripts('/service-worker-settings-v337-entrypoint.js?v=settings-v337-direct-gateway-bootstrap-v2-registered-worker-boundary')"))fail('Canonical worker no longer imports the Settings gateway recovery before cache handlers.');
if(worker.indexOf('service-worker-settings-v337-entrypoint.js')>worker.indexOf('service-worker-settings-v325-override.js'))fail('Settings recovery must register before the historical v325 override.');

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
if(!direct338.includes('serviceWorkerIndependent:true'))fail('Existing v338 page anchor no longer remains safe while v339 is injected by the gateway.');

console.log('PASS Local Models v339 renders saved state first, self-recovers independent of click ordering, keeps lifecycle code lazy, and exposes diagnostics instead of an endless placeholder.');
