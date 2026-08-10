(()=>{
'use strict';

const VERSION='1.2.0';
const TRANSPORT_PATH='/app/local-object-mesh-v146.js';
const CONTRIBUTION_PATH='/app/shared/civweave-contribution-mesh-v1.js';
const SECURITY_PATH='/app/shared/civweave-contribution-security-v1.js';
const SHIP_GUARD_PATH='/app/shared/civweave-contribution-ship-guard-v1.js';
const listeners=new Set();
const now=()=>new Date().toISOString();

function emit(type,detail={}){const event={type,detail,at:now()};for(const listener of listeners){try{listener(event)}catch{}}try{globalThis.dispatchEvent(new CustomEvent('civweave:phone-ledger',{detail:event}))}catch{}}
function browserSupport(){return Boolean(globalThis.indexedDB&&globalThis.crypto?.subtle&&globalThis.document)}
function scriptFor(path){try{return[...document.scripts].find(script=>script.src&&new URL(script.src,location.href).pathname===path)||null}catch{return null}}
function waitForGlobal(name,{timeout=10000,interval=25}={}){if(globalThis[name])return Promise.resolve(globalThis[name]);return new Promise((resolve,reject)=>{const started=Date.now(),timer=setInterval(()=>{if(globalThis[name]){clearInterval(timer);resolve(globalThis[name]);return}if(Date.now()-started>=timeout){clearInterval(timer);reject(new Error(`${name} did not become ready`))}},interval)})}
function waitForSecurity({timeout=10000,interval=25}={}){if(globalThis.CivweaveContributionMeshV1?.security)return Promise.resolve(globalThis.CivweaveContributionMeshV1);return new Promise((resolve,reject)=>{const started=Date.now(),timer=setInterval(()=>{const contribution=globalThis.CivweaveContributionMeshV1;if(contribution?.security){clearInterval(timer);resolve(contribution);return}if(Date.now()-started>=timeout){clearInterval(timer);reject(new Error('contribution security did not become ready'))}},interval)})}
function waitForShipGuard({timeout=10000,interval=25}={}){if(globalThis.CivweaveContributionMeshV1?.shipGuardVersion)return Promise.resolve(globalThis.CivweaveContributionMeshV1);return new Promise((resolve,reject)=>{const started=Date.now(),timer=setInterval(()=>{const contribution=globalThis.CivweaveContributionMeshV1;if(contribution?.shipGuardVersion){clearInterval(timer);resolve(contribution);return}if(Date.now()-started>=timeout){clearInterval(timer);reject(new Error('contribution ship guard did not become ready'))}},interval)})}

async function ensureScript(path,globalName){if(globalThis[globalName])return globalThis[globalName];if(!scriptFor(path)){const script=document.createElement('script');script.src=path;script.async=false;script.dataset.civweavePhoneLedger='1';document.head.append(script)}return waitForGlobal(globalName)}
async function ensureSecurity(){if(globalThis.CivweaveContributionMeshV1?.security)return globalThis.CivweaveContributionMeshV1;if(!scriptFor(SECURITY_PATH)){const script=document.createElement('script');script.src=SECURITY_PATH;script.async=false;script.dataset.civweavePhoneLedgerSecurity='1';document.head.append(script)}return waitForSecurity()}
async function ensureShipGuard(){if(globalThis.CivweaveContributionMeshV1?.shipGuardVersion)return globalThis.CivweaveContributionMeshV1;if(!scriptFor(SHIP_GUARD_PATH)){const script=document.createElement('script');script.src=SHIP_GUARD_PATH;script.async=false;script.dataset.civweavePhoneLedgerShipGuard='1';document.head.append(script)}return waitForShipGuard()}
async function ensureRuntime(){await ensureScript(TRANSPORT_PATH,'CivweaveLocalMeshV146');const contribution=await ensureScript(CONTRIBUTION_PATH,'CivweaveContributionMeshV1');await contribution.ready();await ensureSecurity();return ensureShipGuard()}

async function snapshot(){const contribution=await ensureRuntime(),credential=await contribution.credentials(),wallet=await contribution.walletIdentity(),events=await contribution.activeEvents(),frontier=await contribution.frontier(),security=await contribution.security.launchStatus();return{version:VERSION,ready:true,valueReady:Boolean(security.readyForContributionValue),role:'phone-ledger-node',storage:'indexeddb',hostRequired:false,deviceId:credential.deviceId,transportDeviceId:credential.meshDeviceId,walletId:wallet.walletId,eventCount:events.length,frontier,security:{version:contribution.securityVersion,shipGuardVersion:contribution.shipGuardVersion,transferMode:security.transferMode,blockers:security.blockers,recoveryReady:security.recovery.recoveryReady,eligibleValidatorRoots:security.eligibleValidatorRoots,policyHash:security.policyHash,externalOfframpsEnabled:false,walletFreeze:security.walletFreeze,storage:security.storage}}}
async function sync(){const contribution=await ensureRuntime(),result=await contribution.syncFromLocalMesh(),security=await contribution.security.launchStatus();emit('sync',{...result,security});return{...result,security}}
async function exportBundle(){return(await ensureRuntime()).exportBundle()}
async function importBundle(bundle,options={}){const contribution=await ensureRuntime(),result=await contribution.importBundle(bundle,options);emit('bundle-imported',{count:result.length});return result}
async function securityStatus(){return(await ensureRuntime()).security.launchStatus()}
async function securityApi(){return(await ensureRuntime()).security}
function subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener)}

async function boot(){if(!browserSupport()){const status={version:VERSION,ready:false,valueReady:false,role:'phone-ledger-node',storage:'indexeddb',hostRequired:false,reason:'required browser storage or WebCrypto APIs are unavailable'};emit('unsupported',status);return status}const status=await snapshot();emit('ready',status);return status}
const readyPromise=boot().catch(error=>{const status={version:VERSION,ready:false,valueReady:false,role:'phone-ledger-node',storage:'indexeddb',hostRequired:false,reason:String(error?.message||error)};emit('error',status);return status});
const api=Object.freeze({version:VERSION,role:'phone-ledger-node',storage:'indexeddb',hostRequired:false,transportPath:TRANSPORT_PATH,contributionPath:CONTRIBUTION_PATH,securityPath:SECURITY_PATH,shipGuardPath:SHIP_GUARD_PATH,ready:()=>readyPromise,snapshot,sync,exportBundle,importBundle,securityStatus,securityApi,subscribe});
globalThis.CivweavePhoneLedgerV1=api;
try{globalThis.addEventListener('online',()=>{sync().catch(error=>emit('sync-error',{error:String(error?.message||error)}))});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')sync().catch(()=>{})})}catch{}

})();