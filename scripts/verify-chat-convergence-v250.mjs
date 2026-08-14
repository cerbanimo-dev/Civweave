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
const [manifestText,rawLauncher,installedEntryHtml,installedEntry,redirects,routesSource,navSource,boundary,workspace,sharedLoader,sharedCore,guideStream,realmHtml,familyLoader,platformStability,workingPart5,workerRepair,workerEntry,releaseSync,coherenceSync,release,pkgText]=await Promise.all([
  read('public/app/manifest.webmanifest'),
  read('public/index.html'),
  read('public/app/installed-entry-v146.html'),
  read('public/app/installed-entry-v146.js'),
  read('public/_redirects'),
  read('public/app/system-routes-v227.js'),
  read('public/app/themed-system-nav-v178.js'),
  read('public/app/install-boundary-v146.js'),
  read('public/app/guide-workspace-v242.js'),
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
for(const source of [installedEntry,routesSource,navSource,boundary,workspace,sharedLoader,sharedCore,guideStream,familyLoader,platformStability,workerRepair,workerEntry])new Function(source.replace(/^\s*importScripts\([^\n]+\);/gm,''));
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

const expStart=boundary.indexOf('const SYSTEM_EXPERIENCE_SCRIPTS=['),expEnd=boundary.indexOf('];',expStart),experience=boundary.slice(expStart,expEnd);
check('canonical experience includes v242 workspace',experience.includes('GUIDE_WORKSPACE'));
check('install boundary has no v215/v216 runtime constants',!boundary.includes('PERSISTENT_GUIDE_CHAT_SCRIPT')&&!boundary.includes('PERSISTENT_GUIDE_VIEWPORT_SCRIPT'));
check('install boundary cannot load retired guide runtimes',!boundary.includes('/app/persistent-guide-chat-v215.js')&&!boundary.includes('/app/persistent-guide-viewport-v216.js'));
check('boundary reports v242 as the sole guide workspace',boundary.includes("guideWorkspaceSubmissionPipelines:1")&&boundary.includes("guideWorkspaceRevision:'v250-v242-canonical-owner'")&&boundary.includes('v250-single-v242-runtime'));
check('install boundary resumes after pageshow and BFCache restore',boundary.includes("addEventListener('pageshow',resumeFromPageShow)")&&boundary.includes('unloading=false;')&&boundary.includes("navigationLifecycleRevision:'v424-head-capture-bfcache-resume'"));
check('install boundary captures a live head before dynamic append',boundary.includes('function liveHead(head=document.head)')&&boundary.includes('const head=document.head;')&&boundary.includes('head.append(script)'));

check('Cerbanimo route does not mount the retired cabinet overlay',!realmHtml.includes('cabinet-home-v142')&&!realmHtml.includes('cabinet-surfaces-v143')&&!realmHtml.includes('sharing-library-v143'));
check('Cerbanimo route loads the headless AI loader after native realm runtime',realmHtml.indexOf('/app/realm-console-v140.js')>=0&&realmHtml.indexOf('/app/family-ai-loader-v105.js')>realmHtml.indexOf('/app/realm-console-v140.js'));
check('family AI loader contains no inline chat DOM owner',!familyLoader.includes('ch142-control-band')&&!familyLoader.includes('makeBand(')&&!familyLoader.includes('ensureBand(')&&!familyLoader.includes('guide-chat-v153'));
check('family AI loader delegates opening to v242',familyLoader.includes('CivweaveGuideWorkspaceV242?.openWindow')&&familyLoader.includes("canonicalChatOwner:'guide-workspace-v242'"));
check('family AI loader no longer installs a document mutation observer',!familyLoader.includes('new MutationObserver'));
check('platform stability contains no legacy chat dock or minimize system',!platformStability.includes('cw159-chat-dock')&&!platformStability.includes('ch142-control-band')&&!platformStability.includes('setChatMinimized'));

check('v242 owns five guide windows',workspace.includes("const SYSTEMS=['civweave','living-school','cerbanimo','fellowfare','anarchadia']"));
check('v242 owns persona pointer taps',workspace.includes('switchControl')&&workspace.includes('data-cw242-window')&&workspace.includes("document.addEventListener('pointerdown',onPointerDownCapture,true)"));
check('v242 owns canonical submit',workspace.includes("target.matches(`#${ROOT_ID} [data-persistent-form]`)")&&workspace.includes("document.addEventListener('submit',onSubmitCapture,true)"));
check('v242 captures legacy Working Campus composer as surface only',workingPart5.includes("$('#weaveling-chat-form')?.addEventListener('submit',sendWeaveling)")&&workspace.includes("target.id==='weaveling-chat-form'"));
check('v242 supports model and deterministic fallback',workspace.includes('CivweaveModelRuntime')&&workspace.includes('fallbackReply')&&workspace.includes('deterministicReply'));
check('v242 exposes compatibility API while retaining canonical ownership',workspace.includes('globalThis.CivweavePersistentGuideChatV215=api')&&workspace.includes('canonicalOwner:true'));
check('v242 has no synthetic click or requestSubmit relay',!workspace.includes('.click()')&&!workspace.includes('requestSubmit')&&!workspace.includes('MouseEvent'));
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
check('worker runs the current avatar-visible cache repair, v347 freeze cache-bust, and retains the v343 migration marker',workerEntry.includes("importScripts('/service-worker-chat-repair-v245.js?v=chat-avatar-visible-v346&purge=chat-avatar-visible-v346&freeze=chat-interaction-safe-v348')")&&workerRepair.includes("const REVISION='chat-avatar-visible-v346'")&&workerRepair.includes("const FREEZE_REVISION='chat-interaction-safe-v348'")&&workerEntry.includes('chat-css-contract-v343')&&workerRepair.includes('chat-css-contract-v343'));
check('worker skips waiting on install',workerEntry.includes("self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting())})"));

check('release version sync preserves updater-first clean manifest',releaseSync.includes("manifest.start_url='/app/installed-entry-v146.html?installed=1'"));
check('release coherence generator preserves canonical chat, legacy worker rotation, and current avatar cache repair',coherenceSync.includes("const chatRevision='chat-convergence-v250'")&&coherenceSync.includes("const chatCachePurgeRevision='chat-convergence-v251-legacy-purge'")&&coherenceSync.includes("const activeChatRepairRevision='chat-avatar-visible-v346'")&&coherenceSync.includes('retiredChatPaths'));
check('release coherence generator no longer patches deleted v215/v216 files',!coherenceSync.includes("await patch('public/app/persistent-guide-chat-v215.js'")&&!coherenceSync.includes("await patch('public/app/persistent-guide-viewport-v216.js'"));

console.log(JSON.stringify({ok:true,version,revision:'chat-convergence-v250-with-chat-avatar-visible-v346-mobile-freeze-v347-navigation-lifecycle-v424',checks:checks.length,installedLaunch:'updater-first-clean-url',canonicalRuntime:'guide-workspace-v242',canonicalDuplicateChatOwners:0,retiredChatRuntimeCount:retiredPaths.length,embeddedSurfaceDelegates:true,cacheMigration:true,checkedInReleaseIdentitiesCurrent:true,releaseGeneratorsPreserveRetirement:true,navigationLifecycle:'v424'},null,2));
