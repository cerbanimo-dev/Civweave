import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [topbarBridge,topbarBase,workspace,viewport,boundary,workerRepair,workerEntry,manifestText,installedEntry,release,pkgText]=await Promise.all([
  read('public/app/working-campus-topbar-v243.js'),
  read('public/app/working-campus-topbar-v243-base.js'),
  read('public/app/guide-workspace-v242.js'),
  read('public/app/persistent-guide-viewport-v216.js'),
  read('public/app/install-boundary-v146.js'),
  read('public/service-worker-chat-repair-v245.js'),
  read('public/service-worker-v203.js'),
  read('public/app/manifest.webmanifest'),
  read('public/app/installed-entry-v146.js'),
  read('VERSION'),
  read('package.json')
]);
const topbar=`${topbarBridge}\n${topbarBase}`;
new Function(topbarBridge);new Function(topbarBase);new Function(workspace);new Function(viewport);new Function(boundary);new Function(workerRepair);new Function(workerEntry);new Function(installedEntry);
const manifest=JSON.parse(manifestText),pkg=JSON.parse(pkgText),version=release.trim(),checks=[];
const check=(name,condition)=>{assert.ok(condition,name);checks.push(name)};

check('release and package are coherent',/^\d+\.\d+\.\d+$/.test(version)&&pkg.version===version);
check('working campus repairs the brand to a known-good cache-safe icon',topbar.includes("const BRAND_ICON='/app/logos/civweave-pwa-192-v247.png'")&&topbar.includes('function repairBrand()'));
check('mobile topbar uses two safe columns',topbar.includes('grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important')&&topbar.includes('grid-template-areas:"brand brand" "modes modes" "map settings" "review theme"!important'));
check('mobile mode switch can shrink inside viewport',topbar.includes('white-space:normal!important')&&topbar.includes('overflow-wrap:anywhere!important'));
check('mobile realm cards use a viewport-contained grid',topbar.includes('main.app>.campus')&&topbar.includes('grid-template-columns:repeat(2,minmax(0,1fr))!important'));
check('very narrow phones stack realm cards',topbar.includes('@media(max-width:420px)')&&topbar.includes('grid-template-columns:1fr!important'));
check('working campus clips accidental horizontal overflow',topbar.includes('overflow-x:clip'));
check('canonical topbar bridge preserves mobile topbar implementation in base',topbarBridge.includes("BASE_TOPBAR='/app/working-campus-topbar-v243-base.js'")&&topbarBase.includes('working-campus-topbar-v243'));
check('persona taps are owned directly by workspace pointerdown',workspace.includes('switchControl')&&workspace.includes('data-cw242-window')&&workspace.includes("document.addEventListener('pointerdown',onPointerDownCapture,true)"));
check('full chat send is owned directly by workspace capture',workspace.includes('data-persistent-form')&&workspace.includes("document.addEventListener('submit',onSubmitCapture,true)"));
check('embedded Working Campus send delegates into workspace',workspace.includes("target.id==='weaveling-chat-form'")&&workspace.includes("openWindow('civweave');void submitActive(text)"));
check('shared chat has model-runtime plus deterministic recovery',workspace.includes('CivweaveModelRuntime')&&workspace.includes('deterministicReply')&&workspace.includes('fallbackReply'));
check('workspace uses no synthetic clicks or requestSubmit relays',!workspace.includes('.click()')&&!workspace.includes('requestSubmit')&&!workspace.includes('MouseEvent'));
const internalGuard=workspace.indexOf('if(root?.contains(event.target)||launcher?.contains(event.target))return;');
const legacyTrigger=workspace.indexOf("const trigger=event.target.closest?.('[data-cwf-chat]");
check('canonical chat clicks bypass legacy data-guide routing',internalGuard>=0&&legacyTrigger>internalGuard);
check('workspace advertises canonical v250 ownership',workspace.includes('canonicalOwner:true')&&workspace.includes('v250-canonical-owner'));
check('viewport is css-only and cannot inject another chat owner',viewport.includes('v250-css-only-workspace-owned')&&!viewport.includes('CHAT_OWNER_REPAIR')&&!viewport.includes('chat-single-owner-v245.js'));
const experienceStart=boundary.indexOf('const SYSTEM_EXPERIENCE_SCRIPTS=['),experienceEnd=boundary.indexOf('];',experienceStart),experience=boundary.slice(experienceStart,experienceEnd);
check('canonical boot contains exactly the v242 chat runtime family',experience.includes('GUIDE_WORKSPACE')&&!experience.includes('PERSISTENT_GUIDE_CHAT_SCRIPT')&&!experience.includes('PERSISTENT_GUIDE_VIEWPORT_SCRIPT'));
check('manifest launches installed app through updater entry',manifest.start_url==='/app/installed-entry-v146.html?installed=1');
check('installed entry performs no-store release discovery and worker update',installedEntry.includes("cache:'no-store'")&&installedEntry.includes('await registration.update()')&&installedEntry.includes("updateViaCache:'none'"));
check('installed entry activates a waiting worker before routing',installedEntry.includes("candidate.postMessage({type:'SKIP_WAITING'})")&&installedEntry.indexOf('await refreshWorker(releaseVersion)')<installedEntry.indexOf('const requested='));
for(const path of ['/app/manifest.webmanifest','/app/installed-entry-v146.js','/app/install-boundary-v146.js','/app/persistent-guide-chat-v215.js','/app/persistent-guide-viewport-v216.js','/app/guide-workspace-v242.js','/app/chat-single-owner-v245.js','/app/working-campus-v156.part5.txt'])check(`phone cache repair evicts ${path}`,workerRepair.includes(`'${path}'`));
check('service worker activates v250 chat convergence repair',workerEntry.includes('chat-convergence-v250')&&workerRepair.includes("const REVISION='chat-convergence-v250'"));
check('worker installs with skipWaiting',workerEntry.includes("self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting())})"));

console.log(JSON.stringify({ok:true,version,revision:'chat-convergence-v250',checks:checks.length,mobile:{topbarRows:'brand / modes / map+settings / review+theme',realmCards:'2-column then 1-column'},chat:{canonicalOwner:'v242',duplicateOwners:0,embeddedComposerDelegates:true,modelFallback:true},installedBoot:{updaterFirst:true,workerActivation:true}},null,2));
