(()=>{
'use strict';

const VERSION='1.4.0';
const TRANSPORT_PATH='/app/local-object-mesh-v146.js';
const CONTRIBUTION_PATH='/app/shared/civweave-contribution-mesh-v1.js';
const SECURITY_PATH='/app/shared/civweave-contribution-security-v1.js';
const COMMITTEE_PATH='/app/shared/civweave-validator-committee-v2.js';
const SHIP_GUARD_PATH='/app/shared/civweave-contribution-ship-guard-v1.js';
const REWARD_BRIDGE_PATH='/app/shared/civweave-canonical-reward-mesh-bridge-v1.js';
const SETTINGS_ENTRY_PATH='/app/contribution-security-settings-entry-v1.js';
const listeners=new Set();
const now=()=>new Date().toISOString();
function emit(type,detail={}){const event={type,detail,at:now()};for(const listener of listeners){try{listener(event)}catch{}}try{globalThis.dispatchEvent(new CustomEvent('civweave:phone-ledger',{detail:event}))}catch{}}
function browserSupport(){return Boolean(globalThis.indexedDB&&globalThis.crypto?.subtle&&globalThis.document)}
function scriptFor(path){try{return[...document.scripts].find(script=>script.src&&new URL(script.src,location.href).pathname===path)||null}catch{return null}}
function waitFor(check,label,{timeout=10000,interval=25}={}){try{const value=check();if(value)return Promise.resolve(value)}catch{}return new Promise((resolve,reject)=>{const started=Date.now(),timer=setInterval(()=>{try{const value=check();if(value){clearInterval(timer);resolve(value);return}}catch{}if(Date.now()-started>=timeout){clearInterval(timer);reject(new Error(`${label} did not become ready`))}},interval)})}
function inject(path,key='civweavePhoneLedger'){if(scriptFor(path))return;const script=document.createElement('script');script.src=path;script.async=false;script.dataset[key]='1';document.head.append(script)}
async function ensureScript(path,name){if(globalThis[name])return globalThis[name];inject(path);return waitFor(()=>globalThis[name],name)}
async function ensureSecurity(){if(globalThis.CivweaveContributionMeshV1?.securityVersion)return globalThis.CivweaveContributionMeshV1;inject(SECURITY_PATH,'civweavePhoneLedgerSecurity');return waitFor(()=>globalThis.CivweaveContributionMeshV1?.securityVersion&&globalThis.CivweaveContributionMeshV1,'contribution security')}
async function ensureCommittee(){if(globalThis.CivweaveContributionMeshV1?.committeeVersion==='2.0.0')return globalThis.CivweaveContributionMeshV1;inject(COMMITTEE_PATH,'civweavePhoneLedgerCommittee');return waitFor(()=>globalThis.CivweaveContributionMeshV1?.committeeVersion==='2.0.0'&&globalThis.CivweaveContributionMeshV1,'validator committee v2')}
async function ensureShipGuard(){if(globalThis.CivweaveContributionMeshV1?.shipGuardVersion)return globalThis.CivweaveContributionMeshV1;inject(SHIP_GUARD_PATH,'civweavePhoneLedgerShipGuard');return waitFor(()=>globalThis.CivweaveContributionMeshV1?.shipGuardVersion&&globalThis.CivweaveContributionMeshV1,'contribution ship guard')}
async function ensureRewardBridge(){if(globalThis.CivweaveCanonicalRewardMeshBridgeV1)return globalThis.CivweaveCanonicalRewardMeshBridgeV1;inject(REWARD_BRIDGE_PATH,'civweavePhoneLedgerRewardBridge');return waitFor(()=>globalThis.CivweaveCanonicalRewardMeshBridgeV1,'canonical reward mesh bridge')}
async function ensureRuntime(){await ensureScript(TRANSPORT_PATH,'CivweaveLocalMeshV146');const base=await ensureScript(CONTRIBUTION_PATH,'CivweaveContributionMeshV1');await base.ready();await ensureSecurity();await ensureCommittee();await ensureShipGuard();await ensureRewardBridge();await ensureScript(SETTINGS_ENTRY_PATH,'CivweaveContributionSecuritySettingsV1');return globalThis.CivweaveContributionMeshV1}
async function snapshot(){const contribution=await ensureRuntime(),credential=await contribution.credentials(),wallet=await contribution.walletIdentity(),events=await contribution.activeEvents(),frontier=await contribution.frontier(),security=await contribution.security.launchStatus(),rewardBridge=globalThis.CivweaveCanonicalRewardMeshBridgeV1?.status?.()||null;return{version:VERSION,ready:true,valueReady:Boolean(security.readyForContributionValue),role:'phone-ledger-node',storage:'indexeddb',hostRequired:false,deviceId:credential.deviceId,transportDeviceId:credential.meshDeviceId,walletId:wallet.walletId,eventCount:events.length,frontier,security:{version:contribution.securityVersion,committeeVersion:contribution.committeeVersion,shipGuardVersion:contribution.shipGuardVersion,transferMode:security.transferMode,blockers:security.blockers,recoveryReady:security.recovery?.recoveryReady??security.recoveryReady,eligibleValidatorRoots:security.eligibleValidatorRoots,policyHash:security.policyHash,externalOfframpsEnabled:false,walletFreeze:security.walletFreeze,storage:security.storage},rewardMeshBridge:rewardBridge}}
async function sync(){const contribution=await ensureRuntime(),result=await contribution.syncFromLocalMesh();try{await globalThis.CivweaveCanonicalRewardMeshBridgeV1?.retry?.()}catch{}const security=await contribution.security.launchStatus();emit('sync',{...result,security});return{...result,security}}
async function exportBundle(){return(await ensureRuntime()).exportBundle()}
async function importBundle(bundle,options={}){const contribution=await ensureRuntime(),result=await contribution.importBundle(bundle,options);emit('bundle-imported',{count:result.length});return result}
async function securityStatus(){return(await ensureRuntime()).security.launchStatus()}
async function securityApi(){return(await ensureRuntime()).security}
function subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener)}
async function boot(){if(!browserSupport()){const status={version:VERSION,ready:false,valueReady:false,role:'phone-ledger-node',storage:'indexeddb',hostRequired:false,reason:'required browser storage or WebCrypto APIs are unavailable'};emit('unsupported',status);return status}const status=await snapshot();emit('ready',status);return status}
const readyPromise=boot().catch(error=>{const status={version:VERSION,ready:false,valueReady:false,role:'phone-ledger-node',storage:'indexeddb',hostRequired:false,reason:String(error?.message||error)};emit('error',status);return status});
const api=Object.freeze({version:VERSION,role:'phone-ledger-node',storage:'indexeddb',hostRequired:false,transportPath:TRANSPORT_PATH,contributionPath:CONTRIBUTION_PATH,securityPath:SECURITY_PATH,committeePath:COMMITTEE_PATH,shipGuardPath:SHIP_GUARD_PATH,rewardBridgePath:REWARD_BRIDGE_PATH,settingsEntryPath:SETTINGS_ENTRY_PATH,ready:()=>readyPromise,snapshot,sync,exportBundle,importBundle,securityStatus,securityApi,subscribe});
globalThis.CivweavePhoneLedgerV1=api;
try{globalThis.addEventListener('online',()=>{sync().catch(error=>emit('sync-error',{error:String(error?.message||error)}))});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')sync().catch(()=>{})})}catch{}
})();