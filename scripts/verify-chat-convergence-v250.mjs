import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const exists=async path=>access(new URL(path,root)).then(()=>true,()=>false);
const retiredPaths=[
  'public/app/guide-chat-v153.js',
  'public/app/cabinet-home-v142.js',
  'public/app/cabinet-home-v142.css',
  'public/app/cabinet-surfaces-v143.js',
  'public/app/cabinet-surfaces-v143.css',
  'public/app/sharing-library-v143.js',
  'public/app/persistent-guide-chat-v214.js',
  'public/app/persistent-guide-chat-v215.js',
  'public/app/persistent-guide-viewport-v216.js',
  'public/app/chat-single-owner-v245.js'
];

const ownership=JSON.parse(await read('config/system-ownership.json'));
const chatOwnership=ownership?.systems?.['guide-chat'];
const canonicalOwner=chatOwnership?.owner;
const compatibilityLoader=chatOwnership?.compatibilityLoader;
assert.equal(typeof canonicalOwner,'string','guide-chat owner must be declared');
assert.equal(typeof compatibilityLoader,'string','guide-chat compatibility loader must be declared');
const canonicalRevision=canonicalOwner.match(/-(v\d+)\.js$/i)?.[1];
assert.ok(canonicalRevision,'canonical guide-chat owner must have a revisioned filename');
const canonicalWebPath=`/${canonicalOwner.replace(/^public\//,'')}`;
const canonicalPolicy=`five-system-first-class-routes-${canonicalRevision}-canonical-chat-owner`;
const canonicalWorkspaceRevision=`${canonicalRevision}-single-current-chat-surface`;
const canonicalOwnershipPolicy=`${canonicalRevision}-single-current-surface-five-private-ledgers-handover-only-cross-realm`;

const [manifestText,rawLauncher,installedEntryHtml,installedEntry,redirects,routesSource,navSource,boundary,compatLoaderSource,canonicalSource,sharedLoader,sharedCore,guideStream,realmHtml,familyLoader,platformStability,workingPart5,workerRepair,workerEntry,releaseSync,coherenceSync,release,pkgText]=await Promise.all([
  read('public/app/manifest.webmanifest'),
  read('public/index.html'),
  read('public/app/installed-entry-v146.html'),
  read('public/app/installed-entry-v146.js'),
  read('public/_redirects'),
  read('public/app/system-routes-v227.js'),
  read('public/app/themed-system-nav-v178.js'),
  read('public/app/install-boundary-v146.js'),
  read(compatibilityLoader),
  read(canonicalOwner),
  read('public/app/shared-guide-surface-v236.js'),
  read('public/app/shared-guide-surface-v236-core-v244.js'),
  read('public/app/guide-stream-thinking-v249.js'),
  read('public/app/realm-console-v140.html'),
  read('public/app/family-ai-loader-v105.js'),
  read('public/app/platform-stability-v159.js'),
  read('public/app/working-campus-v156.part5.txt'),
  read('public/service-worker-chat-repair-v245.js'),
  read('public/service-worker-v203.js'),
  read('scripts/sync-release-version-assets.mjs'),
  read('scripts/sync-release-coherence-v220.mjs'),
  read('VERSION'),
  read('package.json')
]);
const shared=`${sharedLoader}\n${sharedCore}`;
for(const source of [installedEntry,routesSource,navSource,boundary,compatLoaderSource,canonicalSource,sharedLoader,sharedCore,guideStream,familyLoader,platformStability,workerRepair,workerEntry])new Function(source.replace(/^\s*importScripts\([^\n]+\);/gm,''));
const manifest=JSON.parse(manifestText),pkg=JSON.parse(pkgText),version=release.trim(),checks=[];
const check=(name,condition)=>{assert.ok(condition,name);checks.push(name)};

check('release is coherent',/^\d+\.\d+\.\d+$/.test(version)&&pkg.version===version&&manifest.name.includes(`v${version}`));
check('installed launch enters updater first through clean URL',manifest.start_url==='/app/installed-entry-v146.html?installed=1');
check('all manifest shortcuts enter updater first through clean URL',(manifest.shortcuts||[]).length===5&&(manifest.shortcuts||[]).every(item=>String(item.url).startsWith('/app/installed-entry-v146.html?')));
check('manifest has no frozen Working Campus version pin',!manifestText.includes('working-campus-v156.html?installed=1&version='));
check('Cloudflare has no custom installed-entry redirects',!redirects.split(/\r?\n/).some(line=>line.startsWith('/app/installed-entry-v146 ')||line.startsWith('/app/installed-entry-v146.html ')));
check('checked-in web launcher carries current release identity',rawLauncher.includes(`/app/civweave-brand.js?v=${version}`)&&rawLauncher.includes(`/app/installed-entry-v146.js?v=${version}`));
check('checked-in updater HTML carries current installed-entry identity',installedEntryHtml.includes(`/app/installed-entry-v146.js?v=${version}`));
check('installed entry carries current boot-recovery identity',installedEntry.includes('revision=boot-recovery-v426')&&installedEntry.includes(`version:'${version}-boot-recovery-v426`));
check('installed entry resolves release with bounded no-store manifest fetch',installedEntry.includes('/app/manifest.webmanifest?boot=${Date.now()}')&&installedEntry.includes("cache:'no-store'")&&installedEntry.includes('bounded(fetch('));
check('installed entry forces bounded worker update checks',installedEntry.includes("updateViaCache:'none'")&&installedEntry.includes('registration.update()')&&installedEntry.includes('bounded(registration.update()'));
check('installed entry activates waiting worker before route',installedEntry.includes("candidate.postMessage({type:'SKIP_WAITING'})")&&installedEntry.indexOf('await refreshWorker(releaseVersion)')<installedEntry.indexOf('const requested='));

check('ownership registry names V350 as canonical guide chat',canonicalOwner==='public/app/guide-chat-surface-v350.js'&&compatibilityLoader==='public/app/guide-workspace-v242.js');
const expStart=boundary.indexOf('const SYSTEM_EXPERIENCE_SCRIPTS=['),expEnd=boundary.indexOf('];',expStart),experience=boundary.slice(expStart,expEnd);
check('canonical experience includes the registry-backed guide owner slot',experience.includes('GUIDE_WORKSPACE'));
check('install boundary points its guide slot at the canonical owner',boundary.includes(`const GUIDE_WORKSPACE='${canonicalWebPath}';`));
check('install boundary reports the canonical V350 ownership policy',boundary.includes(`canonicalPolicy:'${canonicalPolicy}'`)&&boundary.includes(`guideWorkspaceRevision:'${canonicalWorkspaceRevision}'`)&&boundary.includes(`guideSurfaceOwnershipPolicy:'${canonicalOwnershipPolicy}'`));
check('install boundary has no v215/v216 runtime constants',!boundary.includes('PERSISTENT_GUIDE_CHAT_SCRIPT')&&!boundary.includes('PERSISTENT_GUIDE_VIEWPORT_SCRIPT'));
check('install boundary cannot load retired guide runtimes',!boundary.includes('/app/persistent-guide-chat-v215.js')&&!boundary.includes('/app/persistent-guide-viewport-v216.js'));
check('install boundary resumes after pageshow and BFCache restore',boundary.includes("addEventListener('pageshow',resumeFromPageShow)")&&boundary.includes('unloading=false;')&&boundary.includes("navigationLifecycleRevision:'v424-head-capture-bfcache-resume'"));
check('install boundary captures a live head before dynamic append',boundary.includes('function liveHead(head=document.head)')&&boundary.includes('const head=document.head;')&&boundary.includes('head.append(script)'));

check('V242 path is compatibility-loader only',compatLoaderSource.includes('Compatibility loader only')&&compatLoaderSource.includes(`const TARGET='${canonicalWebPath}'`)&&!compatLoaderSource.includes('CivweaveGuideWorkspaceV242=')&&!compatLoaderSource.includes("document.addEventListener('pointerdown'"));
check('canonical V350 surface owns one current presentation',canonicalSource.includes("presentation:'single-current-chat-surface'")&&canonicalSource.includes("presentationOwner:'guide-chat-surface-v350'")&&canonicalSource.includes('globalThis.CivweaveGuideChatSurfaceV350=api'));
check('canonical V350 surface retains the V215 compatibility API alias',canonicalSource.includes('globalThis.CivweavePersistentGuideChatV215=api'));
check('canonical V350 surface owns five private guide threads',canonicalSource.includes("const SYSTEMS=['civweave','living-school','cerbanimo','fellowfare','anarchadia']")&&canonicalSource.includes('function threadKey(system)')&&canonicalSource.includes('function switchGuide('));
check('canonical V350 surface owns submit without document capture',canonicalSource.includes("root.querySelector('[data-persistent-form]').addEventListener('submit'")&&!canonicalSource.includes("document.addEventListener('submit'"));
check('canonical V350 surface has no synthetic click or requestSubmit relay',!canonicalSource.includes('.click()')&&!canonicalSource.includes('requestSubmit')&&!canonicalSource.includes('MouseEvent'));

check('Cerbanimo route does not mount the retired cabinet overlay',!realmHtml.includes('cabinet-home-v142')&&!realmHtml.includes('cabinet-surfaces-v143')&&!realmHtml.includes('sharing-library-v143'));
check('Cerbanimo route loads the headless AI loader after native realm runtime',realmHtml.indexOf('/app/realm-console-v140.js')>=0&&realmHtml.indexOf('/app/family-ai-loader-v105.js')>realmHtml.indexOf('/app/realm-console-v140.js'));
check('family AI loader contains no inline chat DOM owner',!familyLoader.includes('ch142-control-band')&&!familyLoader.includes('makeBand(')&&!familyLoader.includes('ensureBand(')&&!familyLoader.includes('guide-chat-v153'));
check('family AI loader delegates opening directly to canonical V350 owner',familyLoader.includes('CivweaveGuideChatSurfaceV350')&&familyLoader.includes('owner.open({guide:target,prefill,focus:true})')&&familyLoader.includes('civweave:guide-chat-ready')&&!familyLoader.includes('CivweaveGuideWorkspaceV242'));
check('family AI loader no longer installs a document mutation observer',!familyLoader.includes('new MutationObserver'));
check('platform stability contains no legacy chat dock or minimize system',!platformStability.includes('cw159-chat-dock')&&!platformStability.includes('ch142-control-band')&&!platformStability.includes('setChatMinimized'));
check('Working Campus keeps its local composer form without claiming canonical floating-chat ownership',workingPart5.includes("$('#weaveling-chat-form')?.addEventListener('submit',sendWeaveling)")&&!workingPart5.includes('CivweaveGuideChatSurfaceV350='));
check('shared guide loader mounts canonical core',sharedLoader.includes('/app/shared-guide-surface-v236-core-v244.js'));
check('shared guide loader aborts detached-head injection without throwing',sharedLoader.includes('function liveHead()')&&sharedLoader.includes('if(!head)return null;')&&sharedLoader.includes('if(!head.isConnected)return null;'));
check('shared guide loader retries dependency installation on pageshow',sharedLoader.includes("addEventListener('pageshow',()=>queueMicrotask(install))")&&sharedLoader.includes('navigation-lifecycle-v424'));
check('guide stream style injection is detached-head safe',guideStream.includes('const head=document.head;')&&guideStream.includes('!head?.isConnected')&&guideStream.includes('head.append(style);return true'));
check('guide stream retries style install on pageshow',guideStream.includes("addEventListener('pageshow',()=>{installStyle();patchRuntime();rehydrate()})"));
check('shared surface delegates to canonical compatibility API',shared.includes('CivweavePersistentGuideChatV215')&&shared.includes('api.submitText(value,currentSystem)'));

for(const path of retiredPaths)check(`retired runtime deleted: ${path}`,!(await exists(path)));
for(const path of retiredPaths.map(path=>path.replace(/^public/,'')))check(`worker purge contains ${path}`,workerRepair.includes(`'${path}'`));
for(const path of ['/app/manifest.webmanifest','/app/installed-entry-v146.js','/app/install-boundary-v146.js','/app/realm-console-v140.html','/app/family-ai-loader-v105.js','/app/platform-stability-v159.js','/app/guide-workspace-v242.js','/app/working-campus-v156.part5.txt'])check(`worker refresh contains ${path}`,workerRepair.includes(`'${path}'`));
check('worker purge ignores stale query identities',workerRepair.includes('cache.delete(request,{ignoreSearch:true})'));
check('worker runs current avatar repair plus v349 main-thread quiescence cache-bust and retains the v343 migration marker',workerEntry.includes("importScripts('/service-worker-chat-repair-v245.js?v=chat-avatar-visible-v346&purge=chat-avatar-visible-v346&freeze=mobile-chat-main-thread-quiescence-v349&layout=mobile-chat-css-dvh-v349')")&&workerRepair.includes("const REVISION='chat-avatar-visible-v346'")&&workerRepair.includes("const FREEZE_REVISION='mobile-chat-main-thread-quiescence-v349'")&&workerRepair.includes("const HARDENING_REVISION='mobile-chat-css-dvh-v349'")&&workerEntry.includes('chat-css-contract-v343')&&workerRepair.includes('chat-css-contract-v343'));
check('worker retains explicit waiting-worker handoff rather than executable skipWaiting',workerEntry.includes('atomic-update-handoff-v427')&&workerEntry.includes('Legacy coherence marker only')&&workerEntry.includes("self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting())})"));

check('release version sync preserves updater-first clean manifest',releaseSync.includes("manifest.start_url='/app/installed-entry-v146.html?installed=1'"));
check('release coherence generator binds canonical chat to system ownership',coherenceSync.includes("ownership?.systems?.['guide-chat']?.owner")&&coherenceSync.includes('guideChatCanonicalPolicy')&&coherenceSync.includes('guideChatOwnershipPolicy'));
check('release coherence generator preserves legacy worker rotation and current avatar cache repair',coherenceSync.includes("const chatRevision='chat-convergence-v250'")&&coherenceSync.includes("const chatCachePurgeRevision='chat-convergence-v251-legacy-purge'")&&coherenceSync.includes("const activeChatRepairRevision='chat-avatar-visible-v346'")&&coherenceSync.includes('retiredChatPaths'));
check('release coherence generator no longer patches deleted v215/v216 files',!coherenceSync.includes("await patch('public/app/persistent-guide-chat-v215.js'")&&!coherenceSync.includes("await patch('public/app/persistent-guide-viewport-v216.js'"));

console.log(JSON.stringify({ok:true,version,revision:'chat-convergence-v250-v350-owner-navigation-lifecycle-v424',checks:checks.length,installedLaunch:'updater-first-clean-url',canonicalRuntime:canonicalOwner,compatibilityLoader,canonicalDuplicateChatOwners:0,retiredChatRuntimeCount:retiredPaths.length,embeddedSurfaceDelegates:true,cacheMigration:true,checkedInReleaseIdentitiesCurrent:true,releaseGeneratorsPreserveRetirement:true,navigationLifecycle:'v424',mobileFreezeGuard:'v349-main-thread-quiescence'},null,2));