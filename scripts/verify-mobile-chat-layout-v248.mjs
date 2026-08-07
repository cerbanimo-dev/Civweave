import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [topbar,owner,viewport,workerRepair,workerEntry,release,pkgText]=await Promise.all([
  read('public/app/working-campus-topbar-v243.js'),
  read('public/app/chat-single-owner-v245.js'),
  read('public/app/persistent-guide-viewport-v216.js'),
  read('public/service-worker-chat-repair-v245.js'),
  read('public/service-worker-v203.js'),
  read('VERSION'),
  read('package.json')
]);
new Function(topbar);new Function(owner);new Function(viewport);new Function(workerRepair);new Function(workerEntry);
const pkg=JSON.parse(pkgText),version=release.trim(),checks=[];
const check=(name,condition)=>{assert.ok(condition,name);checks.push(name)};

check('release and package are v1.0.41',version==='1.0.41'&&pkg.version===version);
check('working campus repairs the brand to a known-good cache-safe icon',topbar.includes("const BRAND_ICON='/app/logos/civweave-pwa-192-v247.png'")&&topbar.includes('function repairBrand()'));
check('mobile topbar uses two safe columns instead of modes map settings in one row',topbar.includes('grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important')&&topbar.includes('grid-template-areas:"brand brand" "modes modes" "map settings" "review theme"!important')&&!topbar.includes('grid-template-areas:"brand brand brand" "modes map settings"'));
check('mobile mode switch can shrink inside the viewport',topbar.includes('grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important')&&topbar.includes('white-space:normal!important')&&topbar.includes('overflow-wrap:anywhere!important'));
check('mobile realm cards use a viewport-contained grid',topbar.includes('main.app>.campus')&&topbar.includes('grid-template-columns:repeat(2,minmax(0,1fr))!important')&&topbar.includes('overflow:visible!important'));
check('very narrow phones stack realm cards to one column',topbar.includes('@media(max-width:420px)')&&topbar.includes('grid-template-columns:1fr!important'));
check('working campus clips accidental horizontal overflow at the app boundary',topbar.includes('overflow-x:clip'));
check('persona taps are owned on pointerdown before document compatibility handlers',owner.includes("addEventListener('pointerdown',onPointerDownCapture,true)")&&owner.includes('data-cw242-window')&&owner.includes('activateSwitch'));
check('canonical and inline send are both owned at window capture',owner.includes('data-persistent-form')&&owner.includes('data-cwsg-form')&&owner.includes("addEventListener('submit',onSubmitCapture,true)"));
check('inline send becomes visible immediately instead of waiting for the model response',owner.includes('queueMicrotask(renderSharedNow)')&&owner.includes('CivweaveSharedGuideSurfaceV236?.renderTranscript'));
check('shared chat has model-runtime plus deterministic recovery',owner.includes('CivweaveModelRuntime')&&owner.includes('deterministicReply')&&owner.includes('recoverFailedTurn'));
check('chat interaction uses no synthetic clicks or requestSubmit relays',!owner.includes('.click()')&&!owner.includes('requestSubmit')&&!owner.includes('MouseEvent'));
check('viewport requests the v248 chat owner',viewport.includes('chat-owner-r2-mobile-v248'));
for(const path of ['/app/chat-single-owner-v245.js','/app/persistent-guide-viewport-v216.js','/app/working-campus-topbar-v243.js','/app/working-campus-v156.css','/app/working-campus-v156.html'])check(`phone cache repair evicts ${path}`,workerRepair.includes(`'${path}'`));
check('service worker activates the new cache repair revision',workerEntry.includes('mobile-chat-layout-v248')&&workerRepair.includes("const REVISION='mobile-chat-layout-v248'"));

console.log(JSON.stringify({ok:true,version,revision:'mobile-chat-layout-v248',checks:checks.length,mobile:{topbarRows:'brand / modes / map+settings / review+theme',realmCards:'2-column then 1-column'},chat:{personaPointerOwner:true,fullSubmit:true,inlineSubmit:true,optimisticPaint:true,modelFallback:true}},null,2));