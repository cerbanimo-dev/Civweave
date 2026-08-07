import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [manifestText,installedEntry,redirects,boundary,workspace,viewport,shared,workingPart5,workerRepair,workerEntry,releaseSync,coherenceSync,release,pkgText]=await Promise.all([
  read('public/app/manifest.webmanifest'),
  read('public/app/installed-entry-v146.js'),
  read('public/_redirects'),
  read('public/app/install-boundary-v146.js'),
  read('public/app/guide-workspace-v242.js'),
  read('public/app/persistent-guide-viewport-v216.js'),
  read('public/app/shared-guide-surface-v236.js'),
  read('public/app/working-campus-v156.part5.txt'),
  read('public/service-worker-chat-repair-v245.js'),
  read('public/service-worker-v203.js'),
  read('scripts/sync-release-version-assets.mjs'),
  read('scripts/sync-release-coherence-v220.mjs'),
  read('VERSION'),
  read('package.json')
]);
for(const source of [installedEntry,boundary,workspace,viewport,shared,workerRepair,workerEntry])new Function(source.replace(/^\s*importScripts\([^\n]+\);/gm,''));
const manifest=JSON.parse(manifestText),pkg=JSON.parse(pkgText),version=release.trim(),checks=[];
const check=(name,condition)=>{assert.ok(condition,name);checks.push(name)};

check('release, package, and manifest versions agree',/^\d+\.\d+\.\d+$/.test(version)&&pkg.version===version&&manifest.name===`Civweave v${version}`);
check('installed launch enters updater first',manifest.start_url==='/app/installed-entry-v146.html?installed=1');
check('all manifest shortcuts enter updater first',(manifest.shortcuts||[]).length===5&&(manifest.shortcuts||[]).every(item=>String(item.url).startsWith('/app/installed-entry-v146.html?')));
check('manifest has no frozen Working Campus version pin',!manifestText.includes('working-campus-v156.html?installed=1&version='));
check('Cloudflare leaves updater HTML reachable',!redirects.split(/\r?\n/).includes('/app/installed-entry-v146.html /app/ 302'));
check('extensionless installed entry normalizes to updater HTML',redirects.split(/\r?\n/).includes('/app/installed-entry-v146 /app/installed-entry-v146.html 302'));
check('installed entry resolves release with no-store manifest fetch',installedEntry.includes("fetch(`/app/manifest.webmanifest?boot=${Date.now()}`,{cache:'no-store'})"));
check('installed entry forces worker update checks',installedEntry.includes("updateViaCache:'none'")&&installedEntry.includes('await registration.update()'));
check('installed entry activates waiting worker before route',installedEntry.includes("candidate.postMessage({type:'SKIP_WAITING'})")&&installedEntry.indexOf('await refreshWorker(releaseVersion)')<installedEntry.indexOf('const requested='));

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
check('shared surface delegates to compatibility API',shared.includes('CivweavePersistentGuideChatV215')&&shared.includes('api.submitText(value,currentSystem)'));

check('release version sync preserves updater-first manifest',releaseSync.includes("manifest.start_url='/app/installed-entry-v146.html?installed=1'")&&releaseSync.includes('chat-convergence-v250'));
check('release coherence generator preserves v250 boundary instead of rebuilding v227 chat stack',coherenceSync.includes("const chatRevision='chat-convergence-v250'")&&coherenceSync.includes("const boundaryRevision='chat-convergence-v250'")&&coherenceSync.includes('Release coherence must not resurrect v215/v216'));
check('release coherence generator recognizes installed-entry fallback constant',coherenceSync.includes("const FALLBACK_VERSION='\\d+\\.\\d+\\.\\d+'"));
check('release coherence generator does not write canonical-core-only-v226 additions identity',!coherenceSync.includes("const ADDITIONS_VERSION='v${version}-canonical-core-only-v226'"));

for(const path of ['/app/manifest.webmanifest','/app/installed-entry-v146.js','/app/install-boundary-v146.js','/app/persistent-guide-chat-v215.js','/app/persistent-guide-viewport-v216.js','/app/guide-workspace-v242.js','/app/chat-single-owner-v245.js','/app/working-campus-v156.part5.txt'])check(`worker purge contains ${path}`,workerRepair.includes(`'${path}'`));
check('worker purge ignores stale query identities',workerRepair.includes('cache.delete(request,{ignoreSearch:true})'));
check('worker imports v250 chat repair',workerEntry.includes("importScripts('/service-worker-chat-repair-v245.js?v=chat-convergence-v250')"));
check('worker skips waiting on install',workerEntry.includes("self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting())})"));

console.log(JSON.stringify({ok:true,version,revision:'chat-convergence-v250',checks:checks.length,installedLaunch:'updater-first',canonicalRuntime:'guide-workspace-v242',canonicalDuplicateChatOwners:0,embeddedSurfaceDelegates:true,cacheMigration:true,releaseGeneratorsPreserveConvergence:true},null,2));
