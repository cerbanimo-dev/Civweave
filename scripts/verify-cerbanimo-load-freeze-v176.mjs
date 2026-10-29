import fs from 'node:fs';
import assert from 'node:assert/strict';
import './verify-cerbanimo-universal-nav-stability-v1.mjs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const realmNavigationWorker=read('public/service-worker-five-system-pages-v1.js');
const releaseWorker=read('public/service-worker-release-generation-v1.js');
const activeWorker=read('public/service-worker-v203.js');
const realm=read('public/app/realm-console-v140.html');
const shell=read('public/app/persistent-system-shell-v1.html');
const shellRuntime=read('public/app/persistent-system-shell-v1.js');
const generationLifecycle=read('public/app/generation-lifecycle-v2.js');
const shellAssets=read('public/service-worker-shell-assets-v1.js');
const guildBuilder=read('scripts/build-guild-release-package-v1.mjs');
const hostSelection=read('public/app/host-node-status-selection-v1.js');
const scriptTag=(html,path)=>[...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/g)].find(match=>match[1].split('?')[0]===path)?.[0]||'';
const declaration=(source,name)=>source.match(new RegExp(`const ${name}=['"]([^'"]+)['"]`))?.[1];
const realmWorkerVersion=declaration(realmNavigationWorker,'VERSION');
const realmCache=declaration(realmNavigationWorker,'CACHE');
const releaseRevision=declaration(releaseWorker,'REVISION');
const shellRevision=declaration(shellAssets,'REVISION');
const assertBoundedNumber=(source,name,maximum)=>{const value=Number(source.match(new RegExp(`const ${name}=(\\d+)`))?.[1]);assert(value>0&&value<=maximum,`${name} must be positive and at most ${maximum}.`)};

assert(/^five-system-pages-v1-.+-r\d+$/.test(realmWorkerVersion||''),'Realm navigation must expose a revisioned current worker identity.');
assert(/^cw-five-system-pages-v\d+/.test(realmCache||''),'Embedded realm HTML must remain on a cache-distinct realm cache.');
assertBoundedNumber(realmNavigationWorker,'NETWORK_TIMEOUT_MS',5000);
assert(realmNavigationWorker.includes('new AbortController()'),'Embedded realm navigation must abort stalled requests.');
assert(realmNavigationWorker.includes("shellRedirect(url,spec.system)"),'Top-level realm navigation must move into the persistent shell rather than replacing its navbar.');

assert(/^release-generation-boundary-v\d+-/.test(releaseRevision||''),'Runtime release generation must expose a revisioned release boundary.');
assertBoundedNumber(releaseWorker,'NETWORK_TIMEOUT_MS',5000);
assertBoundedNumber(releaseWorker,'WARM_TIMEOUT_MS',4000);
assertBoundedNumber(releaseWorker,'WARM_CONCURRENCY',8);
assert(releaseWorker.includes('async function boundedFetch(request,timeout=NETWORK_TIMEOUT_MS)'),'Runtime fetches must go through one bounded fetch primitive.');
assert(releaseWorker.includes("const controller=typeof AbortController==='function'?new AbortController():null"),'Bounded runtime fetches must abort stalled network work.');
assert(releaseWorker.includes("'/app/realm-console-v140.css'"),'The Cerbanimo first-paint stylesheet must be warmed with the current release.');
assert(releaseWorker.includes("'/app/realm-console-v140.js'"),'The Cerbanimo console runtime must be warmed with the current release.');
assert(releaseWorker.includes("'/app/cerbanimo-quest-engine-v144.js'"),'The Cerbanimo quest engine must be warmed with the current release.');
for(const path of [
  '/app/generation-lifecycle-v2.js',
  '/app/settings-local-route-v331.js',
  '/app/settings-local-loader-v337.js',
  '/app/shared-guide-surface-v236.js',
  '/app/local-ai/gemma4-current-registry-authority-v1.js',
  '/app/local-ai/gemma4-weave-draft-pipeline-v1.js',
  '/app/generation-failure-inspector-v1.js',
  '/app/human-message-bubble-v1.js',
  '/app/human-chat-network-v1.js',
  '/app/human-chat-guild-context-v1.js'
]) assert(releaseWorker.includes(`'${path}'`),`Guild releases must require persistent-shell dependency ${path}.`);
assert(releaseWorker.includes('queue=[...WARM_PATHS]'),'Release warming must use a bounded work queue rather than unbounded request fanout.');
assert(releaseWorker.includes('async function activeGuildRelease()'),'Guild transport must validate the active cached release before serving application assets.');
assert(releaseWorker.includes('if(active)return activeGuildResponse(pathname,request.method,active)'),'A complete signed Guild release must remain exclusive transport once active.');
assert(releaseWorker.includes('A selected Guild does not become exclusive application transport until a complete signed release is installed.'),'Legacy or incomplete Guilds must not pin clients to stale application releases.');
assert(releaseWorker.includes("data.type==='CIVWEAVE_GUILD_RELEASE_CLEAR'"),'The client must be able to clear a stale or legacy Guild release source.');
assert(hostSelection.includes("selection.loginMode==='legacy-mobile-selection'"),'Legacy Mobile Guild selection must be distinguished from release capability.');
assert(hostSelection.includes("type:'CIVWEAVE_GUILD_RELEASE_CLEAR'"),'Legacy Mobile Guild selection must clear stale release authority.');
for(const path of [
  '/app/generation-lifecycle-v2.js',
  '/app/settings-local-route-v331.js',
  '/app/settings-local-loader-v337.js',
  '/app/shared-guide-surface-v236.js',
  '/app/local-ai/gemma4-weave-draft-pipeline-v1.js',
  '/app/human-message-bubble-v1.js',
  '/app/human-chat-network-v1.js',
  '/app/human-chat-guild-context-v1.js'
]) assert(guildBuilder.includes(`'${path}'`),`Signed Guild package builder must include current shell dependency ${path}.`);

assert(activeWorker.includes(`/service-worker-five-system-pages-v1.js?v=${realmWorkerVersion}`),'Installed staging PWA must import the current realm navigation revision.');
assert(activeWorker.includes(`/service-worker-release-generation-v1.js?v=${releaseRevision}`),'Installed staging must import the current complete-shell runtime revision.');
assert(/staging-installed-entry-takeover-v\d+-/.test(activeWorker),'Staging must retain a revisioned installed-entry worker generation.');
assert(/persistent-stage-viewport-r\d+/.test(activeWorker),'Active staging worker must carry the persistent-stage viewport repair.');
assert(/^shell-assets-v1-repair-v\d+-/.test(shellRevision||''),'Shell assets must expose a revisioned repair generation.');
assert(activeWorker.includes(`/service-worker-shell-assets-v1.js?v=${shellRevision}`),'Installed staging must import the current shell asset revision.');
assert(shellAssets.includes("'/app/generation-lifecycle-v2.js'"),'Bounded generation lifecycle must be a required installed shell asset.');

assert(/data-build="persistent-system-shell-v1-r\d+[^\"]*"/.test(shell),'Persistent shell must expose a revisioned build identity.');
assert(scriptTag(shell,'/app/generation-lifecycle-v2.js'),'Persistent shell must load the canonical generation lifecycle runtime.');
assert(shell.includes('height:calc(100dvh - var(--cw-persistent-nav-space))'),'Persistent stage must explicitly fill the dynamic viewport above the universal navbar.');
assert(!/#cw-persistent-system-stage\{[^}]*height:auto/.test(shell),'Persistent stage must never regress to intrinsic iframe height:auto.');
assert(/data-build="persistent-system-shell-v1-r\d+[^\"]*"/.test(shell),'Persistent shell must retain its revisioned first-frame recovery build.');
assert(shell.includes('cw-persistent-first-frame-rescue-v1'),'Shell must launch the selected system without awaiting external JavaScript.');
for(const path of [
  '/app/system-routes-v227.js',
  '/app/persistent-system-shell-v1.js',
  '/app/themed-system-nav-v178.js',
  '/app/persistent-shell-actions-v1.js',
  '/app/generation-lifecycle-v2.js'
]) assert(/\sdefer(?:\s|>)/.test(scriptTag(shell,path)),`Paint-first shell is missing deferred critical runtime: ${path}`);
assert(shell.indexOf('/app/persistent-system-shell-v1.js')<shell.indexOf('/app/settings-local-route-v331.js'),'Shell navigation runtime must precede optional Settings startup.');
assert(shell.indexOf('/app/themed-system-nav-v178.js')<shell.indexOf('/app/settings-local-route-v331.js'),'Canonical navbar must precede optional Settings startup.');

assert(/data-build="realm-console-canonical-v\d+[^\"]*"/.test(realm),'Cerbanimo must expose a revisioned canonical build.');
assert(!realm.includes('/app/install-boundary-v146.js'),'Cerbanimo frame must not boot the global install/shell observer stack.');
assert(!realm.includes('/app/local-object-mesh-v146.js'),'Cerbanimo frame must not boot the global object-mesh observer stack.');
for(const src of [
  '/app/cw-reward-ledger-v2.js',
  '/app/civweave-basic-value-v1.js',
  '/app/cw-reward-receivers-v2.js',
  '/app/civweave-basic-value-model-v1.js'
]){
  assert(/\sdefer(?:\s|>)/.test(scriptTag(realm,src)),`${src} must never block Cerbanimo HTML parsing.`);
}
assert(realm.includes('<div class="rc-loading">Opening Cerbanimo…</div>'),'Cerbanimo must expose a paintable first-frame loading surface before workbench runtimes finish.');

assert(shellRuntime.includes('host.src=target.href'),'System navigation must change only the content stage.');
assert(shellRuntime.includes('persistentNavbar:true'),'Persistent shell API must explicitly guarantee navbar persistence.');
assert(generationLifecycle.includes('const wiredFrames=new WeakSet()'),'Cross-frame lifecycle discovery must bind each persistent iframe only once.');
assert(!generationLifecycle.includes('new MutationObserver'),'Cross-frame lifecycle discovery must not watch the entire shell DOM.');
assert(generationLifecycle.includes('for(const delay of [0,100,500,1500,4000,9000])setTimeout(refreshBindings,delay)'),'Cross-frame lifecycle discovery must remain finite.');

console.log('Cerbanimo freeze regression contract passed: the parent shell paints before external runtimes, incomplete/legacy Guild releases cannot pin the client, signed package closure matches the shell dependency graph, Cerbanimo first paint is parser-independent, and cross-frame lifecycle discovery remains bounded.');
