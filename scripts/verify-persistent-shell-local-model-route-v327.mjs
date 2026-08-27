import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const shellPath = path.join(root, 'public/app/persistent-system-shell-v1.js');
const shellHtmlPath = path.join(root, 'public/app/persistent-system-shell-v1.html');
const loaderPath = path.join(root, 'public/app/settings-local-loader-v335.js');
const bridgePath = path.join(root, 'public/app/settings-local-route-v325.js');
const aliasPath = path.join(root, 'public/app/settings-local-route-v323.js');
const freshPath = path.join(root, 'public/app/settings-local-route-v327.js');
const generationPath = path.join(root, 'public/app/settings-local-route-v331.js');
const coreWorkerPath = path.join(root, 'public/service-worker-core-v208.js');

const shell = fs.readFileSync(shellPath, 'utf8');
const shellHtml = fs.readFileSync(shellHtmlPath, 'utf8');
const loader = fs.readFileSync(loaderPath, 'utf8');
const bridge = fs.readFileSync(bridgePath, 'utf8');
const alias = fs.readFileSync(aliasPath, 'utf8');
const fresh = fs.readFileSync(freshPath, 'utf8');
const generation = fs.readFileSync(generationPath, 'utf8');
const coreWorker = fs.readFileSync(coreWorkerPath, 'utf8');
const expectedVersion = '1.1.3-settings-local-route-v326-canonical-inert-hard-local';
const expectedShellVersion = '1.1.2-canonical-local-settings-refresh';
const generatedRoute = '/app/settings-local-route-v331.js?v=1.1.7-persistent-shell-cache-generation-v333';
const stageLoader = '/app/settings-local-loader-v335.js?v=1.1.0-stage-iframe-bridge';

const fail = message => { throw new Error(message); };

if (!coreWorker.includes('const cached = await findCached(url.pathname);')) {
  fail('Core worker cache behavior changed; revisit the pathname-generation regression assumptions.');
}
if (!coreWorker.includes('{ ignoreSearch: true }')) {
  fail('Core worker no longer ignores query strings; revisit the pathname-generation regression assumptions.');
}
if (!shellHtml.includes(stageLoader)) {
  fail('Persistent shell HTML does not load the cache-distinct stage-iframe Local Models bridge.');
}
if (shellHtml.includes(`<script src="${generatedRoute}"></script>`)) {
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
if (!loader.includes(`const ROUTE_SRC='${generatedRoute}'`)) {
  fail('Local Models bridge no longer loads the cache-distinct v331 route generation.');
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
if (!loader.includes('stageIframeBridge:true') || !loader.includes('childRealmRenderer:true')) {
  fail('Local Models bridge lost its explicit iframe-recovery contract.');
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
if (!bridge.includes("const FULL_ROUTE='/app/settings-local-route-v327.js?v=1.1.4-settings-local-route-v325-parent-bridge'")) {
  fail('v325 compatibility bridge no longer hands off to v327.');
}
if (alias !== fresh) {
  fail('v323 compatibility alias drifted from the validated v327 saved-state implementation.');
}

console.log('PASS persistent Settings recovers Local Models inside the stage iframe using a cache-distinct child-realm renderer.');
