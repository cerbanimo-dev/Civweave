import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';

// Day/night branding is part of the mobile source-truth contract because shell repairs must never repaint it after boot.
const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const exists=path=>access(new URL(path,root)).then(()=>true,()=>false);
const [topbar,campusHtml,campusScript,campusSymbol,faces,workspace,hardening,boundary,workerRepair,workerEntry,manifestText,installedEntry,realmHtml,familyLoader,release,pkgText]=await Promise.all([
  read('public/app/working-campus-topbar-v243.js'),
  read('public/app/working-campus-v156.html'),
  read('public/app/working-campus-v156.js'),
  read('public/app/logos/civweave-symbol.svg'),
  read('public/app/shared-chat-face-icons-v255.js'),
  read('public/app/guide-workspace-v242.js'),
  read('public/app/mobile-ai-hardening-v302.js'),
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
for(const source of [topbar,campusScript,faces,workspace,hardening,boundary,workerRepair,workerEntry,installedEntry,familyLoader])new Function(source.replace(/^\s*importScripts\([^\n]+\);/gm,''));
const manifest=JSON.parse(manifestText),pkg=JSON.parse(pkgText),version=release.trim(),checks=[];
const check=(name,condition)=>{assert.ok(condition,name);checks.push(name)};

check('release and package are coherent',/^\d+\.\d+\.\d+$/.test(version)&&pkg.version===version);
check('working campus source owns the Civweave brand fallback before paint',campusHtml.includes('id="brand-home"')&&campusHtml.includes('src="/app/logos/civweave-symbol.svg"')&&campusSymbol.includes('/app/logos/civweave-night-logo.jpg'));
check('approved Civweave day and night logos are packaged',await exists('public/app/logos/civweave-day-logo.jpg')&&await exists('public/app/logos/civweave-night-logo.jpg'));
check('working campus follows the local clock for the visible Civweave logo',campusScript.includes("const BRAND_DAY='/app/logos/civweave-day-logo.jpg'")&&campusScript.includes("const BRAND_NIGHT='/app/logos/civweave-night-logo.jpg'")&&campusScript.includes('hour>=6&&hour<18')&&campusScript.includes('next.setHours(18,0,0,0)')&&campusScript.includes('next.setHours(6,0,0,0)')&&campusScript.includes("document.addEventListener('visibilitychange'")&&campusScript.includes("addEventListener('pageshow'")&&!campusScript.includes("brand.src='/app/logos/civweave-app-icon.png'"));
check('topbar respects source-owned branding instead of repairing it',topbar.includes('sourceTruthBrand:true')&&!topbar.includes('function repairBrand()')&&!topbar.includes('cw243ValidBrand')&&!topbar.includes('BRAND_ICON'));
check('mobile topbar uses two safe columns',topbar.includes('grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important')&&topbar.includes('grid-template-areas:"brand brand" "modes modes" "map downloads" "settings review" "theme theme"!important'));
check('mobile downloads control remains independently tappable',topbar.includes("DOWNLOADS_BUTTON_ID='cw-working-campus-downloads-v243'")&&topbar.includes("downloadsButton.innerHTML='<span aria-hidden=\"true\">⇩</span><span>Downloads</span>'")&&topbar.includes('grid-area:downloads'));
check('mobile mode switch can shrink inside viewport',topbar.includes('white-space:normal!important')&&topbar.includes('overflow-wrap:anywhere!important'));
check('mobile diagnostics row remains isolated when enabled',topbar.includes('data-civweave-diagnostics="true"')&&topbar.includes('"diagnostics diagnostics"'));
check('mobile realm cards use a viewport-contained grid',topbar.includes('main.app>.campus')&&topbar.includes('grid-template-columns:repeat(2,minmax(0,1fr))!important')&&topbar.includes('overscroll-behavior:auto!important'));
check('mobile realm cards cannot exceed their grid cell',topbar.includes('main.app>.campus .realm-node')&&topbar.includes('max-width:100%!important'));
check('shared guide surface remains viewport-contained',topbar.includes('#cw-shared-guide-surface-v236')&&topbar.includes('max-width:calc(100vw - 14px)!important'));
check('very narrow phones stack realm cards',topbar.includes('@media(max-width:420px)')&&topbar.includes('grid-template-columns:1fr!important'));
check('working campus clips accidental horizontal overflow',topbar.includes('overflow-x:clip'));
check('chat launcher retains circular fixed geometry without neutral-source rewrite',faces.includes("launcherShape:'circle'")&&faces.includes("launcherPosition:'fixed'")&&faces.includes('launcherDesktopPx:52')&&faces.includes('launcherMobilePx:48')&&faces.includes('launcherNarrowPx:46')&&faces.includes('neutralSourceRewrite:false')&&!faces.includes('OLD_SRC_TO_SYSTEM')&&!faces.includes('new MutationObserver'));

check('v242 owns persona taps directly on pointerdown',workspace.includes('switchControl')&&workspace.includes('data-cw242-window')&&workspace.includes("document.addEventListener('pointerdown',onPointerDownCapture,true)"));
check('v242 owns full chat send directly at capture phase',workspace.includes('data-persistent-form')&&workspace.includes("document.addEventListener('submit',onSubmitCapture,true)"));
check('embedded Working Campus send delegates into v242',workspace.includes("target.id==='weaveling-chat-form'")&&workspace.includes("openWindow('civweave');void submitActive(text)"));
check('v242 has model-runtime plus deterministic recovery',workspace.includes('CivweaveModelRuntime')&&workspace.includes('deterministicReply')&&workspace.includes('fallbackReply'));
check('v242 uses no synthetic clicks or requestSubmit relays',!workspace.includes('.click()')&&!workspace.includes('requestSubmit')&&!workspace.includes('MouseEvent'));
check('v242 keeps a single bounded viewport resize adaptation',workspace.includes('globalThis.visualViewport?.addEventListener')&&workspace.includes('--cw242-visual-height')&&!workspace.includes("visualViewport?.addEventListener('scroll'"));
check('v242 mobile CSS uses dynamic viewport height and safe areas',workspace.includes('100dvh')&&workspace.includes('env(safe-area-inset-bottom)')&&workspace.includes('@media(max-width:620px)'));
check('v242 advertises canonical ownership',workspace.includes('canonicalOwner:true')&&workspace.includes('v250-canonical-owner'));

const hardeningIndex=boundary.indexOf('MOBILE_AI_HARDENING,'),workspaceIndex=boundary.indexOf('GUIDE_WORKSPACE,');
check('mobile hardening loads before canonical chat workspace',hardeningIndex>=0&&workspaceIndex>hardeningIndex&&boundary.includes("const MOBILE_AI_HARDENING='/app/mobile-ai-hardening-v302.js'"));
check('phone chat replaces floating desktop geometry using CSS dynamic viewport units',hardening.includes('#cw-persistent-guide-chat-v215:not([hidden]):not(.is-minimized)')&&hardening.includes('height:100dvh!important')&&hardening.includes('width:100vw!important')&&hardening.includes('inset:0!important'));
check('phone chat is opaque and cannot reveal stacked page UI underneath',hardening.includes('background:var(--guide-panel,#111827)!important')&&hardening.includes('z-index:2147483646!important')&&hardening.includes('overflow:hidden!important'));
check('mobile hardening does not feed visualViewport events back into layout',hardening.includes("chatLayoutMode:'css-dvh-only'")&&hardening.includes('viewportEventOwnership:false')&&hardening.includes('viewportStyleWrites:false')&&!/visualViewport\?*\.addEventListener|visualViewport.*addEventListener/.test(hardening)&&!hardening.includes('--cw-mobile-visual-top')&&!hardening.includes('--cw-mobile-visual-height'));
check('interrupted local test recovery clears selection but preserves downloads',hardening.includes("active:false,id:null")&&hardening.includes('downloadPreserved:true')&&!hardening.includes('caches.delete'));

const experienceStart=boundary.indexOf('const SYSTEM_EXPERIENCE_SCRIPTS=['),experienceEnd=boundary.indexOf('];',experienceStart),experience=boundary.slice(experienceStart,experienceEnd);
check('canonical boot contains v242 workspace',experience.includes('GUIDE_WORKSPACE'));
check('canonical boot contains mobile AI hardening',experience.includes('MOBILE_AI_HARDENING'));
check('canonical boundary contains no retired persistent guide runtime constants',!boundary.includes('PERSISTENT_GUIDE_CHAT_SCRIPT')&&!boundary.includes('PERSISTENT_GUIDE_VIEWPORT_SCRIPT'));
check('Cerbanimo mounts no retired cabinet overlay',!realmHtml.includes('cabinet-home-v142')&&!realmHtml.includes('cabinet-surfaces-v143')&&!realmHtml.includes('sharing-library-v143'));
check('family AI loader is headless and delegates to v242',!familyLoader.includes('ch142-control-band')&&!familyLoader.includes('new MutationObserver')&&familyLoader.includes('CivweaveGuideWorkspaceV242?.openWindow'));

for(const retired of ['public/app/persistent-guide-viewport-v216.js','public/app/persistent-guide-chat-v215.js','public/app/chat-single-owner-v245.js'])check(`retired mobile chat runtime deleted: ${retired}`,!(await exists(retired)));
const manifestStart=new URL(manifest.start_url,'https://civweave.invalid');
check('manifest launches installed app through updater entry',['/app/installed-entry-v146','/app/installed-entry-v146.html'].includes(manifestStart.pathname)&&manifestStart.searchParams.get('installed')==='1'&&!manifestStart.searchParams.has('version'));
check('installed entry performs no-store release discovery and bounded worker update',installedEntry.includes("cache:'no-store'")&&installedEntry.includes('registration.update()')&&installedEntry.includes("updateViaCache:'none'")&&installedEntry.includes("bounded(registration.update(),WORKER_STEP_TIMEOUT_MS,'service worker update')"));
check('installed entry activates a waiting worker before routing',installedEntry.includes("candidate.postMessage({type:'SKIP_WAITING'})")&&installedEntry.indexOf('await refreshWorker(releaseVersion)')<installedEntry.indexOf('const requested='));
for(const path of ['/app/persistent-guide-chat-v215.js','/app/persistent-guide-viewport-v216.js','/app/chat-single-owner-v245.js'])check(`phone cache purge includes ${path}`,workerRepair.includes(`'${path}'`));
check('service worker rotates the main-thread-quiescent chat runtime and mobile hardening assets',workerEntry.includes('chat-avatar-visible-v346')&&workerEntry.includes('freeze=mobile-chat-main-thread-quiescence-v349')&&workerEntry.includes('layout=mobile-chat-css-dvh-v349')&&workerRepair.includes("const REVISION='chat-avatar-visible-v346'")&&workerRepair.includes("const FREEZE_REVISION='mobile-chat-main-thread-quiescence-v349'")&&workerRepair.includes("const HARDENING_REVISION='mobile-chat-css-dvh-v349'")&&workerRepair.includes("'/app/mobile-ai-hardening-v302.js'")&&workerRepair.includes("'/app/local-ai/test-pulse-v269.js'"));
check('worker preserves explicit waiting-worker activation policy',workerEntry.includes('atomic-update-handoff-v427')&&workerEntry.includes('self.addEventListener(\'install\',event=>{event.waitUntil(self.skipWaiting())})'));

console.log(JSON.stringify({ok:true,version,revision:'mobile-v349-main-thread-quiescence-day-night-branding',checks:checks.length,mobile:{topbarRows:'brand / modes / map+downloads / settings+review / theme',realmCards:'2-column then 1-column',dynamicViewport:'css-dvh',chat:'full-css-viewport',visualViewportFeedback:false},chat:{canonicalOwner:'v242',deletedLegacyOwners:3,embeddedComposerDelegates:true,modelFallback:true,freezeGuard:'v349',launcherSourceTruth:true},localAI:{interruptedTestRecovery:true,downloadsPreserved:true,mobileSafeHealth:true},installedBoot:{updaterFirst:true,boundedWorkerUpdate:true,workerActivation:true,legacyCachePurge:true},presentation:{brandSourceTruth:true,runtimeLogoRepair:false,dayNightClockCycle:true,nightFallbackBeforeClock:true}},null,2));
