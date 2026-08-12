import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const exists=path=>access(new URL(path,root)).then(()=>true,()=>false);
const [topbar,workspace,boundary,workerRepair,workerEntry,manifestText,installedEntry,realmHtml,familyLoader,release,pkgText]=await Promise.all([
  read('public/app/working-campus-topbar-v243.js'),
  read('public/app/guide-workspace-v242.js'),
  read('public/app/install-boundary-v146.js'),
  read('public/service-worker-chat-repair-v245.js'),
  read('public/service-worker-v203.js'),
  read('public/app/manifest.webmanifest'),
  read('public/app/installed-entry-v146.js'),
  read('public/app/realm-console-v140.html'),
  read('public/app/family-ai-loader-v105.js'),
  read('VERSION'),
  read('package.json')
]);
for(const source of [topbar,workspace,boundary,workerRepair,workerEntry,installedEntry,familyLoader])new Function(source.replace(/^\s*importScripts\([^\n]+\);/gm,''));
const manifest=JSON.parse(manifestText),pkg=JSON.parse(pkgText),version=release.trim(),checks=[];
const check=(name,condition)=>{assert.ok(condition,name);checks.push(name)};

check('release and package are coherent',/^\d+\.\d+\.\d+$/.test(version)&&pkg.version===version);
check('working campus repairs the brand to a known-good cache-safe icon',topbar.includes("const BRAND_ICON='/app/logos/civweave-pwa-192-v247.png'")&&topbar.includes('function repairBrand()'));
check('mobile topbar uses two safe columns',topbar.includes('grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important')&&topbar.includes('grid-template-areas:"brand brand" "modes modes" "map settings" "review theme"!important'));
check('mobile mode switch can shrink inside viewport',topbar.includes('white-space:normal!important')&&topbar.includes('overflow-wrap:anywhere!important'));
check('mobile realm cards use a viewport-contained grid',topbar.includes('main.app>.campus')&&topbar.includes('grid-template-columns:repeat(2,minmax(0,1fr))!important'));
check('very narrow phones stack realm cards',topbar.includes('@media(max-width:420px)')&&topbar.includes('grid-template-columns:1fr!important'));
check('working campus clips accidental horizontal overflow',topbar.includes('overflow-x:clip'));

check('v242 owns persona taps directly on pointerdown',workspace.includes('switchControl')&&workspace.includes('data-cw242-window')&&workspace.includes("document.addEventListener('pointerdown',onPointerDownCapture,true)"));
check('v242 owns full chat send directly at capture phase',workspace.includes('data-persistent-form')&&workspace.includes("document.addEventListener('submit',onSubmitCapture,true)"));
check('embedded Working Campus send delegates into v242',workspace.includes("target.id==='weaveling-chat-form'")&&workspace.includes("openWindow('civweave');void submitActive(text)"));
check('v242 has model-runtime plus deterministic recovery',workspace.includes('CivweaveModelRuntime')&&workspace.includes('deterministicReply')&&workspace.includes('fallbackReply'));
check('v242 uses no synthetic clicks or requestSubmit relays',!workspace.includes('.click()')&&!workspace.includes('requestSubmit')&&!workspace.includes('MouseEvent'));
check('v242 owns visual viewport adaptation itself',workspace.includes('globalThis.visualViewport?.addEventListener')&&workspace.includes('--cw242-visual-height'));
check('v242 mobile CSS uses dynamic viewport height and safe areas',workspace.includes('100dvh')&&workspace.includes('env(safe-area-inset-bottom)')&&workspace.includes('@media(max-width:620px)'));
check('v242 advertises canonical ownership',workspace.includes('canonicalOwner:true')&&workspace.includes('v250-canonical-owner'));

const experienceStart=boundary.indexOf('const SYSTEM_EXPERIENCE_SCRIPTS=['),experienceEnd=boundary.indexOf('];',experienceStart),experience=boundary.slice(experienceStart,experienceEnd);
check('canonical boot contains v242 workspace',experience.includes('GUIDE_WORKSPACE'));
check('canonical boundary contains no retired persistent guide runtime constants',!boundary.includes('PERSISTENT_GUIDE_CHAT_SCRIPT')&&!boundary.includes('PERSISTENT_GUIDE_VIEWPORT_SCRIPT'));
check('Cerbanimo mounts no retired cabinet overlay',!realmHtml.includes('cabinet-home-v142')&&!realmHtml.includes('cabinet-surfaces-v143')&&!realmHtml.includes('sharing-library-v143'));
check('family AI loader is headless and delegates to v242',!familyLoader.includes('ch142-control-band')&&!familyLoader.includes('new MutationObserver')&&familyLoader.includes('CivweaveGuideWorkspaceV242?.openWindow'));

for(const retired of ['public/app/persistent-guide-viewport-v216.js','public/app/persistent-guide-chat-v215.js','public/app/chat-single-owner-v245.js'])check(`retired mobile chat runtime deleted: ${retired}`,!(await exists(retired)));
const manifestStart=new URL(manifest.start_url,'https://civweave.invalid');
check('manifest launches installed app through updater entry',['/app/installed-entry-v146','/app/installed-entry-v146.html'].includes(manifestStart.pathname)&&manifestStart.searchParams.get('installed')==='1'&&!manifestStart.searchParams.has('version'));
check('installed entry performs no-store release discovery and worker update',installedEntry.includes("cache:'no-store'")&&installedEntry.includes('await registration.update()')&&installedEntry.includes("updateViaCache:'none'"));
check('installed entry activates a waiting worker before routing',installedEntry.includes("candidate.postMessage({type:'SKIP_WAITING'})")&&installedEntry.indexOf('await refreshWorker(releaseVersion)')<installedEntry.indexOf('const requested='));
for(const path of ['/app/persistent-guide-chat-v215.js','/app/persistent-guide-viewport-v216.js','/app/chat-single-owner-v245.js'])check(`phone cache purge includes ${path}`,workerRepair.includes(`'${path}'`));
check('service worker activates v342 chat repair',workerEntry.includes('chat-bubble-anchor-v342')&&workerRepair.includes("const REVISION='chat-bubble-anchor-v342'"));
check('worker installs with skipWaiting',workerEntry.includes("self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting())})"));

console.log(JSON.stringify({ok:true,version,revision:'mobile-v248-on-v242-canonical-owner',checks:checks.length,mobile:{topbarRows:'brand / modes / map+settings / review+theme',realmCards:'2-column then 1-column',dynamicViewport:true},chat:{canonicalOwner:'v242',deletedLegacyOwners:3,embeddedComposerDelegates:true,modelFallback:true},installedBoot:{updaterFirst:true,workerActivation:true,legacyCachePurge:true}},null,2));