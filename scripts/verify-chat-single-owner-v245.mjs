import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [owner,viewport,workerRepair,workerEntry,workspace,release,pkgText]=await Promise.all([
  read('public/app/chat-single-owner-v245.js'),
  read('public/app/persistent-guide-viewport-v216.js'),
  read('public/service-worker-chat-repair-v245.js'),
  read('public/service-worker-v203.js'),
  read('public/app/guide-workspace-v242.js'),
  read('VERSION'),
  read('package.json')
]);
new Function(owner);new Function(viewport);new Function(workerRepair);new Function(workerEntry);
const pkg=JSON.parse(pkgText),version=release.trim(),checks=[];
const check=(name,condition)=>{assert.ok(condition,name);checks.push(name)};
const semver=value=>String(value).split('.').map(Number);
const atLeast=(value,floor)=>{const a=semver(value),b=semver(floor);for(let i=0;i<3;i+=1){if(a[i]>b[i])return true;if(a[i]<b[i])return false}return true};

check('release preserves v1.0.41 mobile chat repair or newer',/^\d+\.\d+\.\d+$/.test(version)&&pkg.version===version&&atLeast(version,'1.0.41'));
check('v242 remains the canonical workspace API',workspace.includes('workspace:true')&&workspace.includes('submitText:async')&&workspace.includes('switchGuide:(system,options={})=>switchWindow'));
check('owner normalizes legacy root residue into the canonical v242 form',owner.includes('.cwp215-switcher,.cwp215-guide,.cwp215-form,.cwp215-current')&&owner.includes('cw242-window-switcher')&&owner.includes('data-send type="submit"'));
check('guide faces have pointer ownership before document legacy listeners',owner.includes("addEventListener('pointerdown',onPointerDownCapture,true)")&&owner.includes('[data-cw242-window]')&&owner.includes('activateSwitch'));
check('compatibility clicks after touch switching are swallowed without synthetic activation',owner.includes('suppressSwitchClickUntil')&&owner.includes('suppressedSwitchControl')&&!owner.includes('.click()')&&!owner.includes('MouseEvent'));
check('one window-capture submit owner handles full and inline chat',owner.includes("addEventListener('submit',onSubmitCapture,true)")&&owner.includes('data-persistent-form')&&owner.includes('data-cwsg-form')&&owner.includes('submitOwned(text,system'));
check('inline full-chat control is owned by the same routing layer',owner.includes('data-cwsg-full')&&owner.includes("api.open?.({guide:system})"));
check('shared send paints optimistic thread state immediately',owner.includes('queueMicrotask(renderSharedNow)')&&owner.includes('CivweaveSharedGuideSurfaceV236?.renderTranscript'));
check('failed assistant turns fall back through the known-good model runtime lane',owner.includes('CivweaveModelRuntime')&&owner.includes("typeof runtime?.generate!=='function'")&&owner.includes('deterministicReply')&&owner.includes('recoverFailedTurn'));
check('chat owner never uses requestSubmit or synthetic click relays',!owner.includes('requestSubmit')&&!owner.includes('.click()')&&!owner.includes('dispatchEvent(new MouseEvent'));
check('inline Rook native chat remains unclaimed',!owner.includes('ffc144-rook'));
check('viewport loads v248 ownership repair after workspace readiness',viewport.includes("CHAT_OWNER_REPAIR='/app/chat-single-owner-v245.js?v=chat-owner-r2-mobile-v248'")&&viewport.includes("addEventListener('civweave:guide-workspace-ready',installChatOwnerRepair,{once:true})"));
check('service worker imports v248 cache repair',workerEntry.includes("importScripts('/service-worker-chat-repair-v245.js?v=mobile-chat-layout-v248')"));
for(const path of ['/app/persistent-guide-chat-v215.js','/app/persistent-guide-viewport-v216.js','/app/guide-workspace-v242.js','/app/shared-guide-surface-v236.js','/app/regression-fixes-v243.js','/app/chat-single-owner-v245.js','/app/working-campus-topbar-v243.js','/app/working-campus-v156.css','/app/working-campus-v156.html'])check(`cache repair includes ${path}`,workerRepair.includes(`'${path}'`));
check('cache repair deletes stale entries even when old requests have query strings',workerRepair.includes('cache.delete(request,{ignoreSearch:true})'));
check('cache repair runs on service-worker activation',workerRepair.includes("self.addEventListener('activate'"));

console.log(JSON.stringify({ok:true,version,revision:'mobile-chat-layout-v248',checks:checks.length,canonicalOwner:'guide-workspace-v242 + v245 capture',pointerSwitch:true,inlineSubmit:true,transportFallback:true,staleCachePurge:true,rookNativeUntouched:true},null,2));