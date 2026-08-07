import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [legacyOwner,viewport,workerRepair,workerEntry,workspace,boundary,release,pkgText]=await Promise.all([
  read('public/app/chat-single-owner-v245.js'),
  read('public/app/persistent-guide-viewport-v216.js'),
  read('public/service-worker-chat-repair-v245.js'),
  read('public/service-worker-v203.js'),
  read('public/app/guide-workspace-v242.js'),
  read('public/app/install-boundary-v146.js'),
  read('VERSION'),
  read('package.json')
]);
for(const source of [legacyOwner,viewport,workerRepair,workerEntry,workspace,boundary])new Function(source);
const pkg=JSON.parse(pkgText),version=release.trim(),checks=[];
const check=(name,condition)=>{assert.ok(condition,name);checks.push(name)};

check('release and package are coherent',/^\d+\.\d+\.\d+$/.test(version)&&pkg.version===version);
check('v242 declares itself the canonical workspace owner',workspace.includes('workspace:true')&&workspace.includes('canonicalOwner:true')&&workspace.includes('submitText:async'));
check('v242 owns persona taps directly on pointerdown',workspace.includes("const switchControl=event.target.closest?.(`#${ROOT_ID} [data-cw242-window]`)")&&workspace.includes("document.addEventListener('pointerdown',onPointerDownCapture,true)"));
check('v242 owns native full-chat submit directly',workspace.includes("target.matches(`#${ROOT_ID} [data-persistent-form]`)")&&workspace.includes("document.addEventListener('submit',onSubmitCapture,true)"));
check('v242 owns the Working Campus embedded Weaveling composer before its bubble listener',workspace.includes("target.id==='weaveling-chat-form'")&&workspace.includes("openWindow('civweave');void submitActive(text)"));
check('v242 has model-runtime plus deterministic recovery',workspace.includes('CivweaveModelRuntime')&&workspace.includes('deterministicReply')&&workspace.includes('fallbackReply'));
check('v242 does not use synthetic click or requestSubmit relays',!workspace.includes('.click()')&&!workspace.includes('requestSubmit')&&!workspace.includes('MouseEvent'));
const experienceStart=boundary.indexOf('const SYSTEM_EXPERIENCE_SCRIPTS=['),experienceEnd=boundary.indexOf('];',experienceStart),experience=boundary.slice(experienceStart,experienceEnd);
check('canonical experience boot includes v242',experience.includes('GUIDE_WORKSPACE'));
check('canonical experience boot excludes v215',!experience.includes('PERSISTENT_GUIDE_CHAT_SCRIPT'));
check('canonical experience boot excludes viewport v216',!experience.includes('PERSISTENT_GUIDE_VIEWPORT_SCRIPT'));
check('canonical experience boot uses release-aware cache identity',boundary.includes('requestedRelease')&&boundary.includes('chat-convergence-v250')&&!boundary.includes("ADDITIONS_VERSION='v1.0.36"));
check('viewport no longer injects the v245 event owner',!viewport.includes('CHAT_OWNER_REPAIR')&&!viewport.includes('CivweaveChatSingleOwnerV245')&&!viewport.includes('chat-single-owner-v245.js'));
check('retained v245 file is compatibility-only and not booted canonically',legacyOwner.includes('CivweaveChatSingleOwnerV245')&&!experience.includes('chat-single-owner-v245'));
check('service worker imports v250 cache repair',workerEntry.includes("importScripts('/service-worker-chat-repair-v245.js?v=chat-convergence-v250')"));
for(const path of ['/app/manifest.webmanifest','/app/installed-entry-v146.js','/app/install-boundary-v146.js','/app/persistent-guide-chat-v215.js','/app/persistent-guide-viewport-v216.js','/app/guide-workspace-v242.js','/app/chat-single-owner-v245.js','/app/working-campus-v156.part5.txt'])check(`cache repair includes ${path}`,workerRepair.includes(`'${path}'`));
check('cache repair deletes stale entries despite query strings',workerRepair.includes('cache.delete(request,{ignoreSearch:true})'));
check('cache repair runs on worker activation',workerRepair.includes("self.addEventListener('activate'"));

console.log(JSON.stringify({ok:true,version,revision:'chat-convergence-v250',checks:checks.length,canonicalOwner:'guide-workspace-v242',canonicalDuplicateOwners:0,workingCampusDelegates:true,transportFallback:true,staleCachePurge:true},null,2));
