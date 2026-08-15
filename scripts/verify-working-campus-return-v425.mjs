import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const version=(await read('VERSION')).trim();
const [guard,campus,workerCore,workerWrapper,integrityText,releaseVerifier,syncSource,topbar,lifecycle]=await Promise.all([
  read('public/app/working-campus-return-guard-v425.js'),
  read('public/app/working-campus-v156.html'),
  read('public/service-worker-core-v208.js'),
  read('public/service-worker-v203.js'),
  read('public/app/shell-integrity-v281.json'),
  read('scripts/verify-release-version-sync.mjs'),
  read('scripts/sync-release-version-assets.mjs'),
  read('public/app/working-campus-topbar-v243.js'),
  read('public/app/document-lifecycle-v221.js')
]);
const integrity=JSON.parse(integrityText);

assert.doesNotThrow(()=>new vm.Script(guard,{filename:'working-campus-return-guard-v425.js'}),'Return guard does not compile.');
for(const token of [
  "const VERSION='working-campus-return-v425'",
  "addEventListener('pagehide',holdBfCache,true)",
  "addEventListener('pageshow',resume,true)",
  'if(!event?.persisted)return;',
  'event.stopImmediatePropagation?.()',
  'verifyOrRecover',
  'forceReveal',
  'renderFailSafe',
  'RECOVERY_WINDOW_MS=30_000',
  'location.replace(canonicalUrl(reason))',
  "location.assign('/app/index.html?manage=downloads&source=working-campus-recovery')"
])assert(guard.includes(token),`Return guard is missing ${token}.`);

const guardIndex=campus.indexOf('/app/working-campus-return-guard-v425.js');
const lifecycleIndex=campus.indexOf('/app/document-lifecycle-v221.js');
const boundaryIndex=campus.indexOf('/app/install-boundary-v146.js');
const campusRuntimeIndex=campus.indexOf('/app/working-campus-v156.js');
assert(guardIndex>=0,'Working Campus no longer loads the return guard.');
assert(guardIndex<lifecycleIndex&&guardIndex<boundaryIndex&&guardIndex<campusRuntimeIndex,'Return guard must load before every canonical lifecycle/runtime teardown owner.');
assert(campus.includes('/app/install-boundary-v146.js?v=browser-install-boundary-v228-chat-escape-install-only-pwa-v1'),'Working Campus lost the current install-only boundary cache identity.');
assert(campus.includes(`Civweave Working Campus · v${version}`)&&campus.includes(`<b class="version-chip">v${version}</b>`),'Working Campus visible release is stale.');

assert(workerCore.includes(`const VERSION = '${version}';`),'Service-worker core release is stale.');
assert.equal(integrity.version,version,'Shell-integrity manifest and worker core release must match or worker installation can fail.');
assert(workerCore.includes("const BUILD = 'lightweight-shell-v208-installer-brand-v1-working-campus-return-v425';"),'Worker cache epoch lost v425.');
assert(workerCore.includes("'/app/working-campus-return-guard-v425.js'"),'Return guard is not in the shell precache graph.');
assert(workerWrapper.includes(`service-worker-core-v208.js?v=${version}-chat-convergence-v250-installer-brand-v1-working-campus-return-v425`),'Worker wrapper no longer forces a v425 core refresh.');

assert(topbar.includes("target.searchParams.set('manage','downloads')")&&topbar.includes('location.assign(downloadsUrl())'),'Downloads navigation contract drifted; update the return test with any intentional navigation change.');
assert(lifecycle.includes('function stopOnPageHide(event){if(!event?.persisted)active=false}'),'Document lifecycle once again tears down BFCache pages.');
assert(lifecycle.includes("addEventListener('pageshow',revive)"),'Document lifecycle no longer revives on pageshow.');
assert(lifecycle.includes("settingsOwner:'settings-v320'")&&lifecycle.includes("serviceRole:'downloaded-model-settings-content'")&&lifecycle.includes('inputOwnership:false')&&lifecycle.includes('presentationOwnership:false'),'Document lifecycle must remain a non-owning Settings content service.');

assert(!releaseVerifier.includes("await import('./sync-release-version-assets.mjs')"),'Release verifier self-heals the tree before verifying it.');
assert(!releaseVerifier.includes("await import('./sync-release-coherence-v220.mjs')"),'Release verifier still mutates coherence before verifying it.');
assert(releaseVerifier.includes('committedTreeVerified:true')&&releaseVerifier.includes('verifierMutation:false'),'Read-only release verification contract is missing.');
for(const token of ['working-campus-return-v425',"const BUILD = 'lightweight-shell-v208-installer-brand-v1-working-campus-return-v425';","'/app/working-campus-return-guard-v425.js'"])assert(syncSource.includes(token),`Release sync would erase ${token}.`);

const windowListeners=new Map(),documentListeners=new Map();
const listen=(map,type,fn)=>{const list=map.get(type)||[];list.push(fn);map.set(type,list)};
const app={isConnected:true,style:{setProperty(){}},removeAttribute(){},getBoundingClientRect:()=>({width:900,height:700})};
const generic={isConnected:true,style:{setProperty(){}},removeAttribute(){},getBoundingClientRect:()=>({width:900,height:700})};
const documentElement={isConnected:true,dataset:{},style:{setProperty(){}},removeAttribute(){}};
const body={isConnected:true,style:{setProperty(){}},removeAttribute(){},append(){}};
const selectors=new Map([
  ['main.app',app],['main.app>header.top',generic],['main.app>.campus',generic],['main.app>.main',generic],['nav.bottom',generic],['#conversation',generic],['#workspace',generic],['.version-chip',{...generic,textContent:`v${version}`}]
]);
const storage=new Map();
let replaceCalls=0;
const context={
  console,URL,URLSearchParams,Date,JSON,Promise,Number,String,Boolean,Object,Array,Map,setTimeout,clearTimeout,
  queueMicrotask:()=>{},requestAnimationFrame:fn=>{fn();return 1},innerWidth:1200,innerHeight:800,
  getComputedStyle:()=>({display:'block',visibility:'visible',opacity:'1'}),
  addEventListener:(type,fn)=>listen(windowListeners,type,fn),dispatchEvent:()=>true,
  CustomEvent:class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}},
  sessionStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)},
  location:{origin:'https://civweave.pages.dev',pathname:'/app/working-campus-v156.html',search:'',href:'https://civweave.pages.dev/app/working-campus-v156.html',replace:()=>{replaceCalls+=1},assign:()=>{}},
  document:{readyState:'loading',visibilityState:'visible',title:`Civweave Working Campus · v${version}`,documentElement,body,querySelector:selector=>selectors.get(selector)||null,addEventListener:(type,fn)=>listen(documentListeners,type,fn),createElement:()=>generic}
};
context.globalThis=context;
vm.runInNewContext(guard,context,{filename:'working-campus-return-guard-v425.js'});
assert.equal(typeof context.CivweaveWorkingCampusReturnGuardV425?.inspect,'function','Guard API did not install.');
assert.equal(context.CivweaveWorkingCampusReturnGuardV425.inspect().healthy,true,'Healthy Working Campus is misclassified.');
let stopped=0;
const pagehide=windowListeners.get('pagehide')?.[0];
assert(pagehide,'Guard did not register pagehide first.');
pagehide({persisted:true,stopImmediatePropagation(){stopped+=1}});
assert.equal(stopped,1,'Persisted pagehide was allowed to reach legacy teardown listeners.');
assert.equal(documentElement.dataset.civweaveBfcacheHold,'working-campus-return-v425','BFCache hold marker was not set.');
pagehide({persisted:false,stopImmediatePropagation(){stopped+=1}});
assert.equal(stopped,1,'Non-persisted navigation was incorrectly quarantined.');
assert.equal(replaceCalls,0,'Healthy guard simulation unexpectedly reloaded the campus.');

console.log(JSON.stringify({ok:true,version,revision:'working-campus-return-v425-v320-lifecycle',committedTreeReadOnly:true,workerIntegrityReleaseMatch:true,bfcachePagehideQuarantined:true,oneShotRecovery:true,visibleFailsafe:true,downloadsReturnCovered:true,settingsOwner:'settings-gateway-v317',settingsManagementOwner:'settings-v320'},null,2));
