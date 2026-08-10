import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [manifestText,rawLauncher,installedEntryHtml,installedEntry,redirects,routesSource,navSource,boundary,workspace,viewport,sharedLoader,sharedCore,workingPart5,workerRepair,workerEntry,releaseSync,coherenceSync,release,pkgText]=await Promise.all([
  read('public/app/manifest.webmanifest'),
  read('public/index.html'),
  read('public/app/installed-entry-v146.html'),
  read('public/app/installed-entry-v146.js'),
  read('public/_redirects'),
  read('public/app/system-routes-v227.js'),
  read('public/app/themed-system-nav-v178.js'),
  read('public/app/install-boundary-v146.js'),
  read('public/app/guide-workspace-v242.js'),
  read('public/app/persistent-guide-viewport-v216.js'),
  read('public/app/shared-guide-surface-v236.js'),
  read('public/app/shared-guide-surface-v236-core-v244.js'),
  read('public/app/working-campus-v156.part5.txt'),
  read('public/service-worker-chat-repair-v245.js'),
  read('public/service-worker-v203.js'),
  read('scripts/sync-release-version-assets.mjs'),
  read('scripts/sync-release-coherence-v220.mjs'),
  read('VERSION'),
  read('package.json')
]);
const shared=`${sharedLoader}\n${sharedCore}`;
for(const source of [installedEntry,routesSource,navSource,boundary,workspace,viewport,sharedLoader,sharedCore,workerRepair,workerEntry])new Function(source.replace(/^\s*importScripts\([^\n]+\);/gm,''));
const manifest=JSON.parse(manifestText),pkg=JSON.parse(pkgText),version=release.trim(),checks=[];
const check=(name,condition)=>{assert.ok(condition,name);checks.push(name)};

check('release is coherent',/^\d+\.\d+\.\d+$/.test(version)&&pkg.version===version&&manifest.name.includes(`v${version}`));
check('installed launch enters installed-entry boundary',manifest.start_url==='/app/installed-entry-v146.html?installed=1');
check('all manifest shortcuts enter installed-entry boundary',(manifest.shortcuts||[]).length===5&&(manifest.shortcuts||[]).every(item=>String(item.url).startsWith('/app/installed-entry-v146.html?')));
check('manifest has no frozen Working Campus version pin',!manifestText.includes('working-campus-v156.html?installed=1&version='));
check('Cloudflare leaves installed-entry HTML reachable',!redirects.split(/\r?\n/).includes('/app/installed-entry-v146.html /app/ 302'));
check('extensionless installed entry normalizes to installed-entry HTML',redirects.split(/\r?\n/).includes('/app/installed-entry-v146 /app/installed-entry-v146.html 302'));
check('checked-in web launcher carries current release identity',rawLauncher.includes(`/app/civweave-brand.js?v=${version}`)&&rawLauncher.includes(`/app/installed-entry-v146.js?v=${version}`));
check('checked-in installed-entry HTML carries current installed-entry identity',installedEntryHtml.includes(`/app/installed-entry-v146.js?v=${version}`));
check('checked-in installed-entry runtime carries current fallback identity',installedEntry.includes(`const FALLBACK_VERSION='${version}';`)&&installedEntry.includes(`version:'${version}-chat-convergence-v250'`));
check('installed entry declares local-first boot policy',installedEntry.includes("bootPolicy:'local-first-no-host-gate-v283'")&&installedEntry.includes('const LOCAL_ROUTES=Object.freeze({'));
check('checked-in route contract carries current release identity',routesSource.includes(`const VERSION='${version}';`));
check('checked-in themed navigation carries current release identity',navSource.includes(`const VERSION='${version}-five-system-navigation-v227';`)&&navSource.includes(`version:'${version}'`));
check('checked-in install boundary carries current release identity',boundary.includes(`const VERSION='${version}';`));
check('checked-in worker requests current route and core identities',workerEntry.includes(`/app/system-routes-v227.js?v=${version}-five-system-route-contract-v227`)&&workerEntry.includes(`/service-worker-core-v208.js?v=${version}-chat-convergence-v250`));
check('explicit release helper is bounded no-store',installedEntry.includes("fetch(`/app/manifest.webmanifest?boot=${Date.now()}`,{cache:'no-store',signal:controller.signal})"));
check('explicit worker refresh remains available',installedEntry.includes("updateViaCache:'none'")&&installedEntry.includes('await registration.update()')&&installedEntry.includes("candidate.postMessage({type:'SKIP_WAITING'})"));
const bootStart=installedEntry.indexOf('function boot(){'),bootEnd=installedEntry.indexOf('boot();'),bootBlock=installedEntry.slice(bootStart,bootEnd);
check('installed boot routes locally without release fetch',bootStart>=0&&bootEnd>bootStart&&bootBlock.includes("const requested=params.get('system')||params.get('target')||'civweave';")&&bootBlock.includes('location.replace(localDestination(system,releaseVersion).href)')&&!bootBlock.includes('refreshWorker(')&&!bootBlock.includes('resolveReleaseVersion(')&&!bootBlock.includes('fetch('));

const expStart=boundary.indexOf('const SYSTEM_EXPERIENCE_SCRIPTS=['),expEnd=boundary.indexOf('];',expStart),experience=boundary.slice(expStart,expEnd);
check('canonical experience includes v242 workspace',experience.includes('GUIDE_WORKSPACE'));
check('canonical experience excludes v215 runtime',!experience.includes('PERSISTENT_GUIDE_CHAT_SCRIPT'));
check('canonical experience excludes viewport v216 runtime',!experience.includes('PERSISTENT_GUIDE_VIEWPORT_SCRIPT'));
check('canonical boundary no longer uses frozen v1.0.36 cache identity',boundary.includes('requestedRelease')&&boundary.includes('chat-convergence-v250')&&!boundary.includes("ADDITIONS_VERSION='v1.0.36"));
check('boundary reports one submission pipeline',boundary.includes('persistentGuideChatSubmissionPipelines:1'));
check('boundary names v242 canonical owner',boundary.includes("guideWorkspaceRevision:'v250-v242-canonical-owner'")&&boundary.includes('v250-single-v242-runtime'));

check('v242 owns five guide windows',workspace.includes("const SYSTEMS=['civweave','living-school','cerbanimo','fellowfare','anarchadia']"));
check('v242 owns persona pointer taps',workspace.includes('switchControl')&&workspace.includes('data-cw242-window')&&workspace.includes("document.addEventListener('pointerdown',onPointerDownCapture,true)"));
check('v242 owns canonical submit',workspace.includes("target.matches(`#${ROOT_ID} [data-persistent-form]`)")&&workspace.includes("document.addEventListener('submit',onSubmitCapture,true)"));
check('v242 captures legacy Working Campus composer',workspace.includes("target.id==='weaveling-chat-form'")&&workspace.includes("openWindow('civweave');void submitActive(text)"));
check('legacy Working Campus composer still exists only as a surface',workingPart5.includes("$('#weaveling-chat-form')?.addEventListener('submit',sendWeaveling)")&&workspace.includes("target.id==='weaveling-chat-form'"));
check('v242 supports model and deterministic fallback',workspace.includes('CivweaveModelRuntime')&&workspace.includes('fallbackReply')&&workspace.includes('deterministicReply'));
check('v242 exposes compatibility API while retaining canonical ownership',workspace.includes('globalThis.CivweavePersistentGuideChatV215=api')&&workspace.includes('canonicalOwner:true'));
check('v242 has no synthetic click or requestSubmit relay',!workspace.includes('.click()')&&!workspace.includes('requestSubmit')&&!workspace.includes('MouseEvent'));

check('viewport compatibility file is css-only',viewport.includes('v250-css-only-workspace-owned'));
check('viewport cannot inject v245 owner',!viewport.includes('CHAT_OWNER_REPAIR')&&!viewport.includes('chat-single-owner-v245.js')&&!viewport.includes('CivweaveChatSingleOwnerV245'));
check('shared guide loader mounts canonical core',sharedLoader.includes('/app/shared-guide-surface-v236-core-v244.js'));
check('shared surface delegates to compatibility API',shared.includes('CivweavePersistentGuideChatV215')&&shared.includes('api.submitText(value,currentSystem)'));

check('release version sync preserves installed-entry manifest',releaseSync.includes("manifest.start_url='/app/installed-entry-v146.html?installed=1'")&&releaseSync.includes('chat-convergence-v250'));
check('release coherence generator preserves v250 boundary instead of rebuilding v227 chat stack',coherenceSync.includes("const chatRevision='chat-convergence-v250'")&&coherenceSync.includes("const boundaryRevision='chat-convergence-v250'")&&coherenceSync.includes('Release coherence must not resurrect v215/v216'));
check('release coherence generator recognizes installed-entry fallback constant',coherenceSync.includes("const FALLBACK_VERSION='\\d+\\.\\d+\\.\\d+'"));
check('release coherence generator does not write canonical-core-only-v226 additions identity',!coherenceSync.includes("const ADDITIONS_VERSION='v${version}-canonical-core-only-v226'"));

for(const path of ['/app/manifest.webmanifest','/app/installed-entry-v146.js','/app/install-boundary-v146.js','/app/persistent-guide-chat-v215.js','/app/persistent-guide-viewport-v216.js','/app/guide-workspace-v242.js','/app/chat-single-owner-v245.js','/app/working-campus-v156.part5.txt'])check(`worker purge contains ${path}`,workerRepair.includes(`'${path}'`));
check('worker purge ignores stale query identities',workerRepair.includes('cache.delete(request,{ignoreSearch:true})'));
check('worker imports v250 chat repair',workerEntry.includes("importScripts('/service-worker-chat-repair-v245.js?v=chat-convergence-v250')"));
check('worker skips waiting on install',workerEntry.includes("self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting())})"));

console.log(JSON.stringify({ok:true,version,revision:'chat-convergence-v250-local-first-entry',checks:checks.length,installedLaunch:'local-first-through-installed-entry',canonicalRuntime:'guide-workspace-v242',canonicalDuplicateChatOwners:0,embeddedSurfaceDelegates:true,sharedGuideLoaderAware:true,cacheMigration:true,checkedInReleaseIdentitiesCurrent:true,releaseGeneratorsPreserveConvergence:true,hubBootDependency:false},null,2));