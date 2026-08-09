import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const version=(await readFile(path.join(root,'VERSION'),'utf8')).trim();
const revision='release-coherence-v226';
const chatRevision='chat-convergence-v250';
const lifecycleRevision='document-lifecycle-v222';
const campusRevision='canonical-campus-startup-v227';
const boundaryRevision='chat-convergence-v250';
const routeRevision='five-system-route-contract-v227';
const runtimeRevision='downloaded-runtime-boundary-v266';
const runtimeWorkerCacheRevision='downloaded-runtime-v266';
const canonicalRuntimeRevision='canonical-package-navigation-v266';
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
  if(/Open online campus|launch=online|Open Civweave online/i.test(source))throw new Error('Installer must not expose a hosted campus runtime fallback.');
  return source;
});
await patch('public/install-v130.js',source=>replaceRequired(source,/const WORKER_SCRIPT_REVISION = '[^']+';/,`const WORKER_SCRIPT_REVISION = '${revision}';`,'installer worker revision constant'));
await patch('public/app/installed-entry-v146.js',source=>{
  source=replaceRequired(source,/const FALLBACK_VERSION='\d+\.\d+\.\d+';/,`const FALLBACK_VERSION='${version}';`,'installed entry fallback release version');
  source=replaceRequired(source,/version:'\d+\.\d+\.\d+-chat-convergence-v250'/,`version:'${version}-chat-convergence-v250'`,'installed entry exported release version');
  if(!source.includes("updateViaCache:'none'"))throw new Error('Installed entry must bypass HTTP cache when checking the active worker.');
  if(!source.includes('await registration.update()'))throw new Error('Installed entry must explicitly request a worker update before routing.');
  if(!source.includes("candidate.postMessage({type:'SKIP_WAITING'})"))throw new Error('Installed entry must activate a waiting worker before routing.');
  if(!source.includes(`revision=${chatRevision}`))throw new Error('Installed entry does not register the chat-convergence worker.');
  return source;
});

await patch('public/app/install-boundary-v146.js',source=>{
  source=replaceRequired(source,/const VERSION='[^']+';/,`const VERSION='${version}';`,'install-boundary version');
  if(!source.includes(`const REVISION='${boundaryRevision}';`))throw new Error('Install boundary must retain the chat-convergence revision.');
  if(!source.includes(`const RUNTIME_REVISION='${runtimeRevision}';`))throw new Error('Install boundary lost the downloaded-runtime revision.');
  if(!source.includes('const ADDITIONS_VERSION=`${requestedRelease}-chat-convergence-v250`;'))throw new Error('Install boundary must derive experience cache identity from the requested release.');
  for(const token of [
    "['/app/working-campus-v156.html','civweave']",
    "['/app/cabinets/living-school/index.html','living-school']",
    "['/app/realm-console-v140.html','cerbanimo']",
    "['/app/fellowfare-cabinet-v144.html','fellowfare']",
    "['/app/anarchadia-console-v139.html','anarchadia']",
    "root.dataset.civweaveCanonicalCore='only'",
    "canonicalPolicy:'five-system-first-class-routes-v242-canonical-chat-owner'",
    "runtimeCanonicalPolicy:'five-system-first-class-routes-v266-downloaded-runtime-only'",
    "runtimeAuthorizationPolicy:'standalone-or-preauthorized-session-never-route-intrinsic'",
    "runtimeSourcePolicy:'current-downloaded-package-never-live-site-fallback'",
    "guideWorkspaceRevision:'v250-v242-canonical-owner'",
    "guideSurfaceOwnershipPolicy:'v250-single-v242-runtime-five-local-window-ledgers-handover-only-cross-realm'",
    'canonicalSystemCount:5',
    'canonicalAutoScripts:0',
    'onlineSelfHeal:false'
  ])if(!source.includes(token))throw new Error(`Five-system install boundary is missing ${token}.`);
  const start=source.indexOf('const SYSTEM_EXPERIENCE_SCRIPTS=['),end=source.indexOf('];',start),experience=source.slice(start,end);
  if(!experience.includes('GUIDE_WORKSPACE'))throw new Error('Canonical system experience must boot the v242 workspace.');
  if(experience.includes('PERSISTENT_GUIDE_CHAT_SCRIPT')||experience.includes('PERSISTENT_GUIDE_VIEWPORT_SCRIPT'))throw new Error('Release coherence must not resurrect v215/v216 on canonical system surfaces.');
  if(source.includes('function startAdditions()'))throw new Error('Canonical boundary still contains delayed automatic additions.');
  if(/function systemSurface\(\)[\s\S]{0,300}authorize\(\)/.test(source))throw new Error('Canonical route identification must not authorize a hosted browser session.');
  return source;
});

await patch('public/app/system-routes-v227.js',source=>{
  source=replaceRequired(source,/const VERSION='[^']+';/,`const VERSION='${version}';`,'five-system route version');
  if(!source.includes(`const REVISION='${routeRevision}';`))throw new Error('Five-system route contract revision drifted.');
  if(!source.includes('intrinsicAuthorization:false'))throw new Error('Route contract may not authorize merely by recognizing a canonical pathname.');
  if(/if\(typeof document[^\n]+authorize\(\)/.test(source))throw new Error('Route contract still authorizes during script load.');
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

await patch('public/app/persistent-guide-viewport-v216.js',source=>{
  if(!source.includes("addEventListener('pagehide',destroy,{once:true});"))source=source.replace("document.readyState==='loading'?addEventListener('DOMContentLoaded',boot,{once:true}):boot();","addEventListener('pagehide',destroy,{once:true});\ndocument.readyState==='loading'?addEventListener('DOMContentLoaded',boot,{once:true}):boot();");
  if(source.includes('CHAT_OWNER_REPAIR')||source.includes('chat-single-owner-v245.js'))throw new Error('Legacy viewport compatibility must not inject another chat owner.');
  return source;
});
await patch('public/app/persistent-guide-chat-v215.js',source=>source);
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
  `/service-worker-offline-runtime-boundary-v266.js?v=${version}-${runtimeWorkerCacheRevision}`,
  '/service-worker-offline-v211-override.js?v=offline-campus-current-graph-v238',
  `/service-worker-release-coherence-v220.js?v=${revision}`,
  `/service-worker-canonical-navigation-v227.js?v=${canonicalRuntimeRevision}`,
  `/service-worker-chat-repair-v245.js?v=${chatRevision}`,
  "self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting())})"
])if(!wrapper.includes(token))throw new Error(`The active worker wrapper is missing ${token}.`);
if(wrapper.indexOf('/service-worker-offline-runtime-boundary-v266.js')>wrapper.indexOf('/service-worker-core-v208.js'))throw new Error('Downloaded runtime boundary must run before generic core fetch handling.');
if(wrapper.indexOf('/service-worker-canonical-navigation-v227.js')<wrapper.indexOf('/service-worker-shell-repair-v225.js'))throw new Error('Canonical package navigation must remain the final navigation policy.');
const canonicalNavigation=await readFile(path.join(root,'public/service-worker-canonical-navigation-v227.js'),'utf8');
if(!canonicalNavigation.includes('runtimeNetworkFallback:false'))throw new Error('Canonical runtime navigation re-enabled hosted-network fallback.');
const runtimeBranch=canonicalNavigation.slice(canonicalNavigation.indexOf('networkFirst=async function canonicalFiveSystemPackageFirst'),canonicalNavigation.indexOf('self.CivweaveCanonicalNavigationV227'));
if(!runtimeBranch||runtimeBranch.includes('fetch('))throw new Error('Canonical runtime navigation contains a live network fetch.');
const runtimeBoundary=await readFile(path.join(root,'public/service-worker-offline-runtime-boundary-v266.js'),'utf8');
for(const token of ['canonical-runtime-current-downloaded-package-only-no-live-site-fallback','event.stopImmediatePropagation()','package-miss'])if(!runtimeBoundary.includes(token))throw new Error(`Downloaded runtime boundary is missing ${token}.`);

const override=await readFile(path.join(root,'public/service-worker-release-coherence-v220.js'),'utf8');
for(const token of [revision,'|txt','working-campus-v156.part5.txt','version-pinned-html-js-css-json-txt-network-first-cached-fallback'])if(!override.includes(token))throw new Error(`Release-coherence worker is missing ${token}.`);
const campus=await readFile(path.join(root,'public/app/working-campus-v156.js'),'utf8');
for(const token of [campusRevision,'Promise.all(parts.map(fetchPart))','civweave:working-campus-runtime-ready',"policy:'canonical-core-only-five-system-routing'",'ensureRouteContract'])if(!campus.includes(token))throw new Error(`Working Campus canonical loader is missing ${token}.`);

console.log(JSON.stringify({ok:true,version,revision,chatRevision,lifecycleRevision,campusRevision,boundaryRevision,routeRevision,runtimeRevision,runtimeWorkerCacheRevision,canonicalRuntimeRevision,installerRegistrationOwner:'install-v130.js',installedLaunchUpdater:'installed-entry-v146.js',offlineRevision:'offline-campus-current-graph-v238',canonicalSystems:5,canonicalChatOwner:'guide-workspace-v242',canonicalRuntime:'downloaded-package-only',canonicalNetworkFallback:false,changed},null,2));
