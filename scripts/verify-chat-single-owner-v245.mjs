import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [owner,viewport,workerRepair,workerEntry,workspace,persistent,release,pkgText]=await Promise.all([
  read('public/app/chat-single-owner-v245.js'),
  read('public/app/persistent-guide-viewport-v216.js'),
  read('public/service-worker-chat-repair-v245.js'),
  read('public/service-worker-v203.js'),
  read('public/app/guide-workspace-v242.js'),
  read('public/app/persistent-guide-chat-v215.js'),
  read('VERSION'),
  read('package.json')
]);
new Function(owner);new Function(viewport);new Function(workerRepair);new Function(workerEntry);
const pkg=JSON.parse(pkgText),version=release.trim(),checks=[];
const check=(name,condition)=>{assert.ok(condition,name);checks.push(name)};
const semver=value=>String(value).split('.').map(Number);
const atLeast=(value,floor)=>{const a=semver(value),b=semver(floor);for(let i=0;i<3;i+=1){if(a[i]>b[i])return true;if(a[i]<b[i])return false}return true};

check('release preserves v1.0.38 chat ownership or newer',/^\d+\.\d+\.\d+$/.test(version)&&pkg.version===version&&atLeast(version,'1.0.38'));
check('v242 remains the canonical workspace API',workspace.includes('workspace:true')&&workspace.includes('submitText:async')&&workspace.includes('switchGuide:(system,options={})=>switchWindow'));
check('legacy v215 and v242 can otherwise share one root id',persistent.includes("const ROOT_ID='cw-persistent-guide-chat-v215'")&&workspace.includes("const ROOT_ID='cw-persistent-guide-chat-v215'"));
check('repair detects legacy v215 switcher and form residue',owner.includes('.cwp215-switcher,.cwp215-guide,.cwp215-form,.cwp215-current'));
check('repair rebuilds only the canonical v242 switcher and send form',owner.includes('cw242-window-switcher')&&owner.includes('data-cw242-window')&&owner.includes('data-send type="submit"'));
check('guide faces are captured before document-level legacy listeners',owner.includes("addEventListener('click',onClickCapture,true)")&&owner.includes('[data-cw242-window],#${ROOT_ID} [data-guide-id]'));
check('send is captured before legacy submit ownership',owner.includes("addEventListener('submit',onSubmitCapture,true)")&&owner.includes('api.submitText(text,system)'));
check('repair uses no synthetic click relay',!owner.includes('.click()')&&!owner.includes("dispatchEvent(new MouseEvent"));
check('inline Rook/native chat is not claimed as a legacy form',!owner.includes('ffc144-rook'));
check('viewport loads ownership repair only after workspace readiness',viewport.includes("CHAT_OWNER_REPAIR='/app/chat-single-owner-v245.js?v=chat-owner-r1'")&&viewport.includes("addEventListener('civweave:guide-workspace-ready',installChatOwnerRepair,{once:true})"));
check('service worker imports chat cache repair',workerEntry.includes("importScripts('/service-worker-chat-repair-v245.js?v=chat-cache-single-owner-v245')"));
for(const path of ['/app/persistent-guide-chat-v215.js','/app/persistent-guide-viewport-v216.js','/app/guide-workspace-v242.js','/app/shared-guide-surface-v236.js','/app/regression-fixes-v243.js'])check(`cache repair includes ${path}`,workerRepair.includes(`'${path}'`));
check('cache repair deletes stale entries even when old requests have query strings',workerRepair.includes('cache.delete(request,{ignoreSearch:true})'));
check('cache repair runs on service-worker activation',workerRepair.includes("self.addEventListener('activate'"));

console.log(JSON.stringify({ok:true,version,revision:'chat-single-owner-v245',checks:checks.length,canonicalOwner:'guide-workspace-v242',windowCapture:true,staleCachePurge:true,rookNativeUntouched:true},null,2));
