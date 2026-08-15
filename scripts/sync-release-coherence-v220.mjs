import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const version=(await readFile(path.join(root,'VERSION'),'utf8')).trim();
const ownership=JSON.parse(await readFile(path.join(root,'config/system-ownership.json'),'utf8'));
const guideChatOwner=ownership?.systems?.['guide-chat']?.owner;
if(typeof guideChatOwner!=='string'||!/^public\/app\/[a-z0-9-]+\.js$/i.test(guideChatOwner))throw new Error('System ownership must declare a canonical guide-chat JavaScript owner.');
const guideChatPath=`/${guideChatOwner.slice('public/'.length)}`;
const guideChatRevision=guideChatOwner.match(/-(v\d+)\.js$/i)?.[1];
if(!guideChatRevision)throw new Error(`Canonical guide-chat owner must expose a revisioned filename: ${guideChatOwner}.`);
const guideChatCanonicalPolicy=`five-system-first-class-routes-${guideChatRevision}-canonical-chat-owner`;
const guideChatWorkspaceRevision=`${guideChatRevision}-single-current-chat-surface`;
const guideChatOwnershipPolicy=`${guideChatRevision}-single-current-surface-five-private-ledgers-handover-only-cross-realm`;
const revision='release-coherence-v226';
const chatRevision='chat-convergence-v250';
const chatCachePurgeRevision='chat-convergence-v251-legacy-purge';
const installedEntryRevision='boot-recovery-v428-launch-session-v1';
const activeChatRepairRevision='chat-avatar-visible-v346';
const lifecycleRevision='document-lifecycle-v222';
const campusRevision='canonical-campus-startup-v227';
const boundaryRevision='browser-install-boundary-v228-chat-escape-install-only-pwa-v1';
const boundaryRuntimeRevision='browser-install-boundary-v228-chat-escape-install-only-pwa-v1';
const routeRevision='five-system-route-contract-v227';
const offlineRevision='offline-campus-current-graph-v280';
const offlinePolicy='resumable-pause-v280';
const retiredChatPaths=[
  '/app/guide-chat-v153.js',
  '/app/cabinet-home-v142.js',
  '/app/cabinet-home-v142.css',
  '/app/cabinet-surfaces-v143.js',
  '/app/cabinet-surfaces-v143.css',
  '/app/sharing-library-v143.js',
  '/app/persistent-guide-chat-v214.js',
  '/app/persistent-guide-chat-v215.js',
  '/app/persistent-guide-viewport-v216.js',
  '/app/chat-single-owner-v245.js'
];
const retiredRootCorePaths=[
  '/app/cabinet-home-v142.js',
  '/app/cabinet-home-v142.css',
  '/app/cabinet-surfaces-v143.js',
  '/app/cabinet-surfaces-v143.css',
  '/app/sharing-library-v143.js'
];
if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error('VERSION must contain a semantic release version.');

const changed=[];
async function patch(relative,transform){
  const file=path.join(root,relative);
  const before=await readFile(file,'utf8');
  const after=transform(before);
  if(after===before)return;
  await writeFile(file,after,'utf8');
  changed.push(relative);
}
function replaceRequired(source,pattern,replacement,label){
  if(!pattern.test(source))throw new Error(`${label} was not found while applying ${revision}.`);
  return source.replace(pattern,replacement);
}

await patch('public/app/index.html',source=>{
  if(/navigator\.serviceWorker\.register\s*\(/.test(source))throw new Error('Installer page must not register a second service worker; install-v130.js owns installer registration.');
  if(source.includes('open-online-campus-v225')||source.includes('Browser fallback'))throw new Error('Installer must not expose anonymous browser runtime fallback.');
  if(!source.includes('/app/pwa-install-prompt-v250.js'))throw new Error('Installer must retain the current install bridge.');
  if(source.includes('/app/pwa-install-prompt-v249.js'))throw new Error('Installer must not restore the stale-cache-prone v249 install bridge.');
  if(!source.includes('/app/installer-repair-only-v2.js'))throw new Error('Installer must retain the cache-distinct repair-only bridge v2.');
  if(source.includes('/app/installer-repair-only-v1.js'))throw new Error('Installer must not restore the stale shell-cached v1 repair bridge.');
  return source;
});
await patch('public/install-v130.js',source=>replaceRequired(source,/const WORKER_SCRIPT_REVISION = '[^']+';/,`const WORKER_SCRIPT_REVISION = '${revision}';`,'installer worker revision constant'));
await patch('public/app/installed-entry-v146.js',source=>{
  source=replaceRequired(source,/const FALLBACK_VERSION='\d+\.\d+\.\d+';/,`const FALLBACK_VERSION='${version}';`,'installed entry fallback release version');
  source=replaceRequired(source,/version:'\d+\.\d+\.\d+(-[^']+)'/,`version:'${version}$1'`,'installed entry exported release version');
  if(!source.includes("updateViaCache:'none'"))throw new Error('Installed entry must bypass HTTP cache when checking the active worker.');
  if(!/await\s+(?:bounded\()?registration\.update\(\)/.test(source))throw new Error('Installed entry must explicitly request a worker update before routing.');
  if(!source.includes("candidate.postMessage({type:'SKIP_WAITING'})"))throw new Error('Installed entry must activate a waiting worker before routing.');
  if(!source.includes(`revision=${installedEntryRevision}`))throw new Error('Installed entry does not register the current PWA-launch-session boot-recovery worker revision.');
  if(!source.includes("browserRuntimePolicy:'installed-display-or-pwa-launch-session'"))throw new Error('Installed entry must require installed display or a PWA launch session.');
  if(!source.includes("const LAUNCH_SESSION_KEY='civweave.pwa.launch-session.v1'"))throw new Error('Installed entry lost the PWA launch-session key.');
  if(!source.includes('async function installedLaunchAuthorized()'))throw new Error('Installed entry must await installed launch authorization.');
  return source;
});

await patch('public/app/install-boundary-v146.js',source=>{
  source=replaceRequired(source,/const VERSION='[^']+';/,`const VERSION='${version}';`,'install-boundary version');
  if(!source.includes(`const REVISION='${boundaryRuntimeRevision}';`))throw new Error('Install boundary must retain the install-only browser boundary revision.');
  if(!source.includes('const ADDITIONS_VERSION=`${requestedRelease}-chat-convergence-v250-navigation-lifecycle-v424-browser-boundary-v228-install-only-pwa-v1`;'))throw new Error('Install boundary must derive the install-only browser-safe experience cache identity from the requested release.');
  for(const token of [
    "['/app/working-campus-v156.html','civweave']",
    "['/app/cabinets/living-school/index.html','living-school']",
    "['/app/realm-console-v140.html','cerbanimo']",
    "['/app/fellowfare-cabinet-v144.html','fellowfare']",
    "['/app/anarchadia-console-v139.html','anarchadia']",
    "root.dataset.civweaveCanonicalCore='only'",
    `const GUIDE_WORKSPACE='${guideChatPath}';`,
    `canonicalPolicy:'${guideChatCanonicalPolicy}'`,
    `guideWorkspaceRevision:'${guideChatWorkspaceRevision}'`,
    `guideSurfaceOwnershipPolicy:'${guideChatOwnershipPolicy}'`,
    "navigationLifecycleRevision:'v424-head-capture-bfcache-resume'",
    "const LAUNCH_SESSION_KEY='civweave.pwa.launch-session.v1'",
    "function allowed(){return installedDisplay()||launchSession()||developer()}",
    "browserRuntimePolicy:'installed-display-or-pwa-launch-session'",
    'installedQueryIsAuthorization:false',
    'canonicalSystemCount:5',
    'canonicalAutoScripts:0'
  ])if(!source.includes(token))throw new Error(`Five-system install boundary is missing ${token}.`);
  if(source.includes('function allowed(){return installedDisplay()||developer()||embedded()}'))throw new Error('Embedded browser documents must not authorize Civweave runtime.');
  if(source.includes('civweave.pwa.installed-capability.v1'))throw new Error('A durable localStorage installed capability can reopen browser runtime and must stay retired.');
  const start=source.indexOf('const SYSTEM_EXPERIENCE_SCRIPTS=['),end=source.indexOf('];',start),experience=source.slice(start,end);
  if(!experience.includes('GUIDE_WORKSPACE'))throw new Error('Canonical system experience must boot the guide-chat owner from system ownership.');
  for(const retired of ['PERSISTENT_GUIDE_CHAT_SCRIPT','PERSISTENT_GUIDE_VIEWPORT_SCRIPT','/app/persistent-guide-chat-v215.js','/app/persistent-guide-viewport-v216.js'])if(source.includes(retired))throw new Error(`Release coherence must not resurrect ${retired}.`);
  if(source.includes('function startAdditions()'))throw new Error('Canonical boundary still contains delayed automatic additions.');
  return source;
});

await patch('public/app/system-routes-v227.js',source=>{
  source=replaceRequired(source,/const VERSION='[^']+';/,`const VERSION='${version}';`,'five-system route version');
  if(!source.includes(`const REVISION='${routeRevision}';`))throw new Error('Five-system route contract revision drifted.');
  return source;
});

await patch('public/app/working-campus-v156.html',source=>{
  const lifecycleScript=`<script src="/app/document-lifecycle-v221.js?v=${lifecycleRevision}"></script>`;
  if(source.includes('/app/document-lifecycle-v221.js'))source=source.replace(/<script src="\/app\/document-lifecycle-v221\.js\?v=[^"]+"><\/script>/,lifecycleScript);
  else source=source.replace('<script src="/app/install-boundary-v146.js',`${lifecycleScript}\n<script src="/app/install-boundary-v146.js`);
  source=replaceRequired(source,/\/app\/install-boundary-v146\.js\?v=[^"]+/,`/app/install-boundary-v146.js?v=${boundaryRevision}`,'Working Campus boundary revision');
  source=replaceRequired(source,/\/app\/working-campus-v156\.js\?v=[^"]+/,`/app/working-campus-v156.js?v=${campusRevision}`,'Working Campus loader revision');
  return source;
});

await patch('public/service-worker-core-v208.js',source=>{
  if(!source.includes("'/app/document-lifecycle-v221.js'"))source=source.replace("  '/app/installed-entry-v146.js',\n","  '/app/installed-entry-v146.js',\n  '/app/document-lifecycle-v221.js',\n");
  if(!source.includes("event.waitUntil(cacheShell());"))source=replaceRequired(source,/self\.addEventListener\('install', event => \{\n  event\.waitUntil\(\(async \(\) => \{\n    await cacheShell\(\);\n    await self\.skipWaiting\(\);\n  \}\)\(\)\);\n\}\);/,"self.addEventListener('install', event => {\n  event.waitUntil(cacheShell());\n});",'service-worker non-interrupting core install policy');
  return source;
});

await patch('public/service-worker.js',source=>{
  for(const retired of retiredRootCorePaths)source=source.replaceAll(`,'${retired}'`,'').replaceAll(`'${retired}',`, '');
  for(const retired of retiredRootCorePaths)if(source.includes(`'${retired}'`))throw new Error(`Root portable worker still requires retired runtime ${retired}.`);
  return source;
});

await patch('public/extensions/civweave-additions-v156.js',source=>{
  if(!source.includes('let civweaveAdditionsNavigating=false;'))source=source.replace("let readyPromise=null,activeTab='mesh',noticeTimer=null;","let readyPromise=null,activeTab='mesh',noticeTimer=null;\nlet civweaveAdditionsNavigating=false;\naddEventListener('pagehide',()=>{civweaveAdditionsNavigating=true},{once:true});\naddEventListener('beforeunload',()=>{civweaveAdditionsNavigating=true},{once:true});");
  source=source.replace('document.head.append(script)',"(()=>{const head=document.head;if(civweaveAdditionsNavigating||!head){resolve(false);return}head.append(script)})()");
  source=source.replace('document.body.append(tools)','document.body?.append(tools)');
  source=source.replace('document.body.append(dialog)','document.body?.append(dialog)');
  source=source.replace("}catch(error){console.error('[Civweave additions]',error)}","}catch(error){if(civweaveAdditionsNavigating||document.hidden||!document.documentElement?.isConnected)return;console.error('[Civweave additions]',error)}");
  return source;
});

const wrapper=await readFile(path.join(root,'public/service-worker-v203.js'),'utf8');
for(const token of [
  `/app/system-routes-v227.js?v=${version}-${routeRevision}`,
  `/service-worker-core-v208.js?v=${version}-chat-convergence-v250-installer-brand-v1-working-campus-return-v425-install-only-pwa-v1`,
  `/service-worker-offline-v211-override.js?v=${offlineRevision}&policy=${offlinePolicy}`,
  '/service-worker-shell-integrity-v281.js?v=shell-integrity-v281',
  `/service-worker-release-coherence-v220.js?v=${revision}`,
  '/service-worker-shell-repair-v225.js?v=shell-self-repair-v225-install-only-pwa-v1',
  '/service-worker-canonical-navigation-v227.js?v=canonical-five-system-navigation-v227',
  `/service-worker-chat-repair-v245.js?v=${activeChatRepairRevision}&purge=${activeChatRepairRevision}`,
  "self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting())})"
])if(!wrapper.includes(token))throw new Error(`The active worker wrapper is missing ${token}.`);
if(wrapper.indexOf('/service-worker-canonical-navigation-v227.js')<wrapper.indexOf('/service-worker-shell-repair-v225.js'))throw new Error('Canonical navigation must remain the final navigation policy.');
const chatRepair=await readFile(path.join(root,'public/service-worker-chat-repair-v245.js'),'utf8');
if(!chatRepair.includes(`const REVISION='${activeChatRepairRevision}';`))throw new Error('Chat cache repair revision drifted.');
for(const retired of retiredChatPaths)if(!chatRepair.includes(`'${retired}'`))throw new Error(`Chat cache repair does not purge retired runtime ${retired}.`);
const override=await readFile(path.join(root,'public/service-worker-release-coherence-v220.js'),'utf8');
for(const token of [revision,'|txt','working-campus-v156.part5.txt','version-pinned-html-js-css-json-txt-network-first-cached-fallback'])if(!override.includes(token))throw new Error(`Release-coherence worker is missing ${token}.`);
const campus=await readFile(path.join(root,'public/app/working-campus-v156.js'),'utf8');
for(const token of [campusRevision,'Promise.all(parts.map(fetchPart))','civweave:working-campus-runtime-ready',"policy:'canonical-core-only-five-system-routing'",'ensureRouteContract'])if(!campus.includes(token))throw new Error(`Working Campus canonical loader is missing ${token}.`);

console.log(JSON.stringify({ok:true,version,revision,chatRevision,chatCachePurgeRevision,installedEntryRevision,activeChatRepairRevision,lifecycleRevision,campusRevision,boundaryRevision,boundaryRuntimeRevision,routeRevision,offlineRevision,offlinePolicy,installOnlyPwa:'v1',pwaLaunchSession:'v1',installerRegistrationOwner:'install-v130.js',installerInstallBridge:'pwa-install-prompt-v250',installerRepairBridge:'installer-repair-only-v2',installedLaunchUpdater:'installed-entry-v146.js',canonicalSystems:5,canonicalChatOwner:guideChatOwner,navigationLifecycle:'v424',retiredChatRuntimeCount:retiredChatPaths.length,retiredRootCorePathCount:retiredRootCorePaths.length,changed},null,2));