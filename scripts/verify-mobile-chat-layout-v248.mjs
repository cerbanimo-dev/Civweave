import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const exists=path=>access(new URL(path,root)).then(()=>true,()=>false);
const [topbar,campusHtml,campusScript,campusSymbol,faces,chat,hardening,boundary,workerRepair,workerEntry,manifestText,installedEntry,realmHtml,familyLoader,ownershipText,release,pkgText]=await Promise.all([
  read('public/app/working-campus-topbar-v243.js'),
  read('public/app/working-campus-v156.html'),
  read('public/app/working-campus-v156.js'),
  read('public/app/logos/civweave-symbol.svg'),
  read('public/app/shared-chat-face-icons-v255.js'),
  read('public/app/guide-chat-surface-v350.js'),
  read('public/app/mobile-ai-hardening-v302.js'),
  read('public/app/install-boundary-v146.js'),
  read('public/service-worker-chat-repair-v245.js'),
  read('public/service-worker-v203.js'),
  read('public/app/manifest.webmanifest'),
  read('public/app/installed-entry-v146.js'),
  read('public/app/realm-console-v140.html'),
  read('public/app/family-ai-loader-v105.js'),
  read('config/system-ownership.json'),
  read('VERSION'),
  read('package.json')
]);
for(const source of [topbar,campusScript,faces,chat,hardening,boundary,workerRepair,workerEntry,installedEntry,familyLoader])new Function(source.replace(/^\s*importScripts\([^\n]+\);/gm,''));
const manifest=JSON.parse(manifestText),ownership=JSON.parse(ownershipText),pkg=JSON.parse(pkgText),version=release.trim(),checks=[];
const check=(name,condition)=>{assert.ok(condition,name);checks.push(name)};
check('release and package are coherent',/^\d+\.\d+\.\d+$/.test(version)&&pkg.version===version);
check('working campus source owns the Civweave brand fallback before paint',campusHtml.includes('id="brand-home"')&&campusHtml.includes('src="/app/logos/civweave-symbol.svg"')&&campusSymbol.includes('/app/logos/civweave-night-logo.jpg'));
check('approved Civweave day and night logos are packaged',await exists('public/app/logos/civweave-day-logo.jpg')&&await exists('public/app/logos/civweave-night-logo.jpg'));
check('working campus follows the local clock for the visible Civweave logo',campusScript.includes("const BRAND_DAY='/app/logos/civweave-day-logo.jpg'")&&campusScript.includes("const BRAND_NIGHT='/app/logos/civweave-night-logo.jpg'")&&campusScript.includes('hour>=6&&hour<18')&&campusScript.includes("document.addEventListener('visibilitychange'")&&campusScript.includes("addEventListener('pageshow'"));
check('topbar respects source-owned branding instead of repairing it',topbar.includes('sourceTruthBrand:true')&&!topbar.includes('function repairBrand()')&&!topbar.includes('BRAND_ICON'));
check('mobile topbar uses two safe columns',topbar.includes('grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important')&&topbar.includes('grid-template-areas:"brand brand" "modes modes" "map downloads" "settings review" "theme theme"!important'));
check('mobile downloads control remains independently tappable',topbar.includes("DOWNLOADS_BUTTON_ID='cw-working-campus-downloads-v243'")&&topbar.includes('grid-area:downloads'));
check('mobile mode switch can shrink inside viewport',topbar.includes('white-space:normal!important')&&topbar.includes('overflow-wrap:anywhere!important'));
check('mobile realm cards use a viewport-contained grid',topbar.includes('main.app>.campus')&&topbar.includes('grid-template-columns:repeat(2,minmax(0,1fr))!important'));
check('very narrow phones stack realm cards',topbar.includes('@media(max-width:420px)')&&topbar.includes('grid-template-columns:1fr!important'));
check('working campus clips accidental horizontal overflow',topbar.includes('overflow-x:clip'));
check('chat launcher retains circular fixed geometry without neutral-source rewrite',faces.includes("launcherShape:'circle'")&&faces.includes("launcherPosition:'fixed'")&&faces.includes('launcherDesktopPx:52')&&faces.includes('launcherMobilePx:48')&&faces.includes('neutralSourceRewrite:false')&&!faces.includes('new MutationObserver'));
check('system ownership points mobile chat at V350',ownership.systems?.['guide-chat']?.owner==='public/app/guide-chat-surface-v350.js');
check('V350 owns guide selection locally',chat.includes('function switchGuide(system,options={})')&&chat.includes('[data-guide-select]'));
check('V350 owns full-chat send on its form only',chat.includes("root.querySelector('[data-persistent-form]').addEventListener('submit'")&&chat.includes('void submitActive(text)'));
check('V350 exposes model-runtime deterministic recovery',chat.includes('CivweaveModelRuntime')&&chat.includes('deterministicReply')&&chat.includes('fallbackReply'));
for(const forbidden of ["document.addEventListener('pointerdown'","document.addEventListener('submit'",'visualViewport?.addEventListener','new MutationObserver','requestSubmit','.click()'])check(`V350 avoids ${forbidden}`,!chat.includes(forbidden));
check('V350 mobile CSS uses dynamic viewport height and safe areas',chat.includes('height:100dvh')&&chat.includes('env(safe-area-inset-bottom)')&&chat.includes('@media(max-width:720px)'));
check('V350 advertises canonical single-surface ownership',chat.includes("presentationOwner:'guide-chat-surface-v350'")&&chat.includes('canonicalOwner:true')&&chat.includes("presentation:'single-current-chat-surface'"));
const hardeningIndex=boundary.indexOf('MOBILE_AI_HARDENING,'),chatIndex=boundary.indexOf('GUIDE_WORKSPACE,');
check('mobile hardening loads before canonical V350 chat',hardeningIndex>=0&&chatIndex>hardeningIndex&&boundary.includes("const MOBILE_AI_HARDENING='/app/mobile-ai-hardening-v302.js'")&&boundary.includes("const GUIDE_WORKSPACE='/app/guide-chat-surface-v350.js'"));
check('phone chat hardening uses full CSS dynamic viewport geometry',hardening.includes('#cw-persistent-guide-chat-v215:not([hidden]):not(.is-minimized)')&&hardening.includes('height:100dvh!important')&&hardening.includes('width:100vw!important')&&hardening.includes('inset:0!important'));
check('phone chat is opaque and top-layered',hardening.includes('background:var(--guide-panel,#111827)!important')&&hardening.includes('z-index:2147483646!important')&&hardening.includes('overflow:hidden!important'));
check('mobile hardening does not feed visualViewport events back into layout',hardening.includes("chatLayoutMode:'css-dvh-only'")&&hardening.includes('viewportEventOwnership:false')&&hardening.includes('viewportStyleWrites:false')&&!/visualViewport\?*\.addEventListener|visualViewport.*addEventListener/.test(hardening));
check('interrupted local test recovery clears selection but preserves downloads',hardening.includes("active:false,id:null")&&hardening.includes('downloadPreserved:true')&&!hardening.includes('caches.delete'));
const experienceStart=boundary.indexOf('const SYSTEM_EXPERIENCE_SCRIPTS=['),experienceEnd=boundary.indexOf('];',experienceStart),experience=boundary.slice(experienceStart,experienceEnd);
check('canonical boot contains V350 chat and mobile hardening',experience.includes('GUIDE_WORKSPACE')&&experience.includes('MOBILE_AI_HARDENING'));
check('canonical boundary contains no retired persistent guide runtime constants',!boundary.includes('PERSISTENT_GUIDE_CHAT_SCRIPT')&&!boundary.includes('PERSISTENT_GUIDE_VIEWPORT_SCRIPT'));
check('Cerbanimo mounts no retired cabinet overlay',!realmHtml.includes('cabinet-home-v142')&&!realmHtml.includes('cabinet-surfaces-v143')&&!realmHtml.includes('sharing-library-v143'));
check('family AI loader is headless and delegates directly to V350',!familyLoader.includes('ch142-control-band')&&!familyLoader.includes('new MutationObserver')&&familyLoader.includes('CivweaveGuideChatSurfaceV350')&&!familyLoader.includes('CivweaveGuideWorkspaceV242'));
for(const retired of ['public/app/persistent-guide-viewport-v216.js','public/app/persistent-guide-chat-v215.js','public/app/chat-single-owner-v245.js'])check(`retired mobile chat runtime deleted: ${retired}`,!(await exists(retired)));
const manifestStart=new URL(manifest.start_url,'https://civweave.invalid');
check('manifest launches installed app through updater entry',['/app/installed-entry-v146','/app/installed-entry-v146.html'].includes(manifestStart.pathname)&&manifestStart.searchParams.get('installed')==='1'&&!manifestStart.searchParams.has('version'));
check('installed entry performs no-store release discovery and bounded worker update',installedEntry.includes("cache:'no-store'")&&installedEntry.includes('registration.update()')&&installedEntry.includes("updateViaCache:'none'"));
for(const path of ['/app/persistent-guide-chat-v215.js','/app/persistent-guide-viewport-v216.js','/app/chat-single-owner-v245.js'])check(`phone cache purge includes ${path}`,workerRepair.includes(`'${path}'`));
check('service worker rotates current chat repair and mobile hardening assets',workerEntry.includes('chat-avatar-visible-v346')&&workerEntry.includes('freeze=mobile-chat-main-thread-quiescence-v349')&&workerEntry.includes('layout=mobile-chat-css-dvh-v349')&&workerRepair.includes("'/app/mobile-ai-hardening-v302.js'"));
console.log(JSON.stringify({ok:true,version,revision:'mobile-v350-single-surface-v349-quiescence-day-night-branding',checks:checks.length,mobile:{realmCards:'2-column then 1-column',dynamicViewport:'css-dvh',chat:'V350-full-css-viewport',visualViewportFeedback:false},chat:{canonicalOwner:'guide-chat-surface-v350',documentCapture:false,deletedLegacyOwners:3,modelFallback:true,freezeGuard:'v349',launcherSourceTruth:true},localAI:{interruptedTestRecovery:true,downloadsPreserved:true},installedBoot:{updaterFirst:true,legacyCachePurge:true},presentation:{brandSourceTruth:true,dayNightClockCycle:true}},null,2));
