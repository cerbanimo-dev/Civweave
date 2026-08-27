import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const shellPath = path.join(root, 'public/app/persistent-system-shell-v1.js');
const shellHtmlPath = path.join(root, 'public/app/persistent-system-shell-v1.html');
const loaderPath = path.join(root, 'public/app/settings-local-loader-v337.js');
const bridgePath = path.join(root, 'public/app/settings-local-route-v325.js');
const aliasPath = path.join(root, 'public/app/settings-local-route-v323.js');
const freshPath = path.join(root, 'public/app/settings-local-route-v327.js');
const generationPath = path.join(root, 'public/app/settings-local-route-v331.js');
const coreWorkerPath = path.join(root, 'public/service-worker-core-v208.js');
const settingsWorkerPath = path.join(root, 'public/service-worker-settings-v325-override.js');

const shell = fs.readFileSync(shellPath, 'utf8');
const shellHtml = fs.readFileSync(shellHtmlPath, 'utf8');
const loader = fs.readFileSync(loaderPath, 'utf8');
const bridge = fs.readFileSync(bridgePath, 'utf8');
const alias = fs.readFileSync(aliasPath, 'utf8');
const fresh = fs.readFileSync(freshPath, 'utf8');
const generation = fs.readFileSync(generationPath, 'utf8');
const coreWorker = fs.readFileSync(coreWorkerPath, 'utf8');
const settingsWorker = fs.readFileSync(settingsWorkerPath, 'utf8');
const expectedVersion = '1.1.3-settings-local-route-v326-canonical-inert-hard-local';
const expectedShellVersion = '1.1.2-canonical-local-settings-refresh';
const fullRoute = '/app/settings-local-route-v331.js?cwAction=1&v=1.2.0-stage-full-route-v337';
const stageLoader = '/app/settings-local-loader-v337.js?v=1.2.0-stage-full-route';

const fail = message => { throw new Error(message); };

if (!coreWorker.includes('const cached = await findCached(url.pathname);')) {
  fail('Core worker cache behavior changed; revisit the pathname-generation regression assumptions.');
}
if (!coreWorker.includes('{ ignoreSearch: true }')) {
  fail('Core worker no longer ignores query strings; revisit the pathname-generation regression assumptions.');
}
if (!settingsWorker.includes("const CW_SETTINGS_V325_ACTION_PARAM='cwAction'")) {
  fail('Settings service worker no longer exposes the explicit full-route action bypass.');
}
if (!settingsWorker.includes("if(url.searchParams.get(CW_SETTINGS_V325_ACTION_PARAM)==='1')")) {
  fail('Settings service worker no longer distinguishes full action routes from display shims.');
}
if (!settingsWorker.includes('CW_SETTINGS_V325_SHIM')) {
  fail('Settings service-worker shim contract changed; revalidate shim rejection in the stage loader.');
}
if (!shellHtml.includes(stageLoader)) {
  fail('Persistent shell HTML does not load the cache-distinct full-route stage-iframe Local Models bridge.');
}
if (shellHtml.includes('<script src="/app/settings-local-route-v331.js')) {
  fail('Persistent shell HTML must not preload the Local Models renderer into the parent realm.');
}
if (!shellHtml.includes(`/app/persistent-system-shell-v1.js?v=${expectedShellVersion}`)) {
  fail('Persistent shell runtime version changed; revalidate Local Models stage integration.');
}
if (!loader.includes("const STAGE_ID='cw-persistent-system-stage'")) {
  fail('Local Models bridge no longer targets the canonical persistent stage iframe.');
}
if (!loader.includes(`const ROUTE_VERSION='${expectedVersion}'`)) {
  fail('Local Models bridge no longer pins the validated renderer version.');
}
if (!loader.includes(`const ROUTE_SRC='${fullRoute}'`)) {
  fail('Local Models bridge no longer requests the full v331 renderer through the service-worker action path.');
}
if (!loader.includes('api?.settingsV325DisplayShim!==true')) {
  fail('Local Models bridge can mistake the service-worker display shim for the full renderer.');
}
if (!loader.includes('api?.loaderBridge!==true')) {
  fail('Local Models bridge can mistake a compatibility bridge for the full renderer.');
}
if (!loader.includes('Array.isArray(api?.catalogue)&&api.catalogue.length>0')) {
  fail('Local Models bridge no longer positively identifies the full renderer catalogue.');
}
if (!loader.includes('frame.contentWindow')) {
  fail('Local Models bridge does not enter the child browsing context.');
}
if (!loader.includes("frame.addEventListener('load',attachChild)")) {
  fail('Local Models bridge does not reattach after stage navigation.');
}
if (!loader.includes("doc.addEventListener('click',onClick,true)")) {
  fail('Local Models bridge does not observe tab selection inside the child document.');
}
if (!loader.includes("form?.dataset?.activeSettingsTab==='local-models'")) {
  fail('Local Models bridge does not recognize the canonical selected-tab state.');
}
if (!loader.includes("doc.createElement('script')")) {
  fail('Local Models bridge is not loading the renderer into the target document realm.');
}
if (!loader.includes('route(realm).renderLocalModels(root)')) {
  fail('Local Models bridge is not invoking the child-realm renderer against the child settings layer.');
}
if (!loader.includes('stageIframeBridge:true') || !loader.includes('childRealmRenderer:true') || !loader.includes('fullRouteRequired:true')) {
  fail('Local Models bridge lost its explicit iframe/full-route recovery contract.');
}
if (!loader.includes('displayShimRejected:true') || !loader.includes('loaderBridgeRejected:true') || !loader.includes('actionRouteBypass:true')) {
  fail('Local Models bridge lost its shim-resistant delivery contract.');
}
if (generation !== fresh) {
  fail('v331 cache-generation route must remain byte-identical to the validated v327 inert renderer.');
}
if (!generation.includes(`const VERSION='${expectedVersion}'`)) {
  fail('v331 Local Models generation does not expose the version expected by persistent Settings.');
}
if (!generation.includes('savedStateOnlyView:true') || !generation.includes('viewWritesState:false')) {
  fail('v331 Local Models generation is no longer an inert saved-state-only view.');
}
if (/const m=manager\(\);let all,selected;\s*if\(m\?\.state&&m\?\.selection\)/.test(generation)) {
  fail('v331 Local Models renderer still consults the live download manager during snapshot rendering.');
}
if (!shell.includes(`const SETTINGS_LOCAL_ROUTE_VERSION='${expectedVersion}'`)) {
  fail('Persistent shell fallback loader does not pin the full Local Models API version.');
}
if (!shell.includes("const SETTINGS_LOCAL_ROUTE=`/app/settings-local-route-v325.js?v=${SETTINGS_LOCAL_ROUTE_VERSION}`")) {
  fail('Persistent shell lost its v325 compatibility fallback bridge.');
}
if (!bridge.includes("const ACTION_ROUTE='/app/settings-local-route-v331.js?cwAction=1&v=settings-v325-parent-action-v1'")) {
  fail('v325 compatibility bridge no longer has an explicit full-renderer action route.');
}
if (alias !== fresh) {
  fail('v323 compatibility alias drifted from the validated v327 saved-state implementation.');
}

console.log('PASS persistent Settings recovers Local Models inside the stage iframe, rejects shim/bridge lookalikes, and explicitly loads the validated full renderer.');
