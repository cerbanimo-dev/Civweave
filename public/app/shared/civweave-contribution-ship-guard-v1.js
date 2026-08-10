(()=>{
'use strict';

const VERSION='1.0.1';
const SECURITY_PROTOCOL='civweave.contribution-security.v1';
const OBJECT_KIND='civweave.contribution.mesh-envelope.v1';
const inner=globalThis.CivweaveContributionMeshV1;
if(!inner?.security)throw new Error('Civweave contribution security must load before the ship guard');

const listeners=new Set();
const encoder=new TextEncoder();
const now=()=>new Date().toISOString();
const clone=v=>v==null?v:structuredClone(v);
const canonical=v=>JSON.stringify(normalize(v));
function normalize(v){if(Array.isArray(v))return v.map(normalize);if(v&&typeof v==='object'){const out={};for(const key of Object.keys(v).sort())if(v[key]!==undefined)out[key]=normalize(v[key]);return out}return v}
function emit(type,detail={}){const event={type,detail,at:now()};for(const fn of listeners)try{fn(event)}catch{};try{dispatchEvent(new CustomEvent('civweave:contribution-ship-guard',{detail:event}))}catch{}}
function req(request){return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}

function openDb(name,version){return new Promise((resolve,reject)=>{const request=version?indexedDB.open(name,version):indexedDB.open(name);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}
async function meshRows(){const db=await openDb(inner.DB_NAME);try{return await req(db.transaction('events','readonly').objectStore('events').getAll())}finally{db.close()}}
async function securityMeta(key){const db=await openDb('civweave-contribution-security-v1');try{const row=await req(db.transaction('meta','readonly').objectStore('meta').get(String(key)));return row?row.value:null}finally{db.close()}}
async function anchorByHash(hash){return hash?clone(await securityMeta(`anchor:${hash}`)):null}

async function localCommitteeRoot(committee){const credential=await inner.credentials(),wallet=await inner.walletIdentity();return committee.committee.find(row=>row.rootId===wallet.walletId&&row.deviceId===credential.deviceId)||null}
function freezeRequestByHash(rows,hash){return rows.find(row=>row.status==='active'&&row.eventHash===String(hash)&&row.envelope?.event?.type==='WalletFreezeRequested')||null}

async function requestWalletFreeze(walletId,{reason='suspected-key-compromise',evidenceHashes=[]}={}){
  const target=String(walletId||'').trim();
  if(!target)throw new Error('walletId is required');
  const policy=await inner.security.activePolicyAnchor();
  const verified=policy&&await inner.security.verifyPolicyAnchor(policy);
  if(!verified?.ok)throw new Error('verified policy anchor required for wallet freeze requests');
  const event=await inner.createEvent('WalletFreezeRequested',{
    protocol:SECURITY_PROTOCOL,walletId:target,reason:String(reason).slice(0,200),
    evidenceHashes:[...new Set((evidenceHashes||[]).map(String).filter(Boolean))].slice(0,32),
    policyHash:policy.hash,requestedAt:now(),
  });
  const envelope=await inner.publishEvent(event);
  emit('freeze-requested',{walletId:target,requestHash:event.hash});
  return envelope;
}

async function freezeCommittee(requestRow){
  const request=requestRow.envelope.event,p=request.payload||{},anchor=await anchorByHash(p.policyHash);
  if(!anchor||!(await inner.security.verifyPolicyAnchor(anchor)).ok)throw new Error('freeze policy anchor is unavailable');
  const committee=await inner.security.committeeFor(request.hash,{at:Date.parse(request.createdAt),excludeRootIds:[p.walletId],anchor});
  if(!committee.safe)throw new Error('wallet freeze committee is not safely formed');
  return{anchor,committee};
}

async function witnessWalletFreeze(requestHash,{decision='freeze',evidenceHash=''}={}){
  if(decision!=='freeze')throw new Error('ship guard currently accepts only freeze decisions');
  const rows=await meshRows(),request=freezeRequestByHash(rows,requestHash);
  if(!request)throw new Error('wallet freeze request is unavailable');
  const {committee}=await freezeCommittee(request),local=await localCommitteeRoot(committee);
  if(!local)throw new Error('local validator root is not selected for this freeze committee');
  const prior=rows.find(row=>row.status==='active'&&row.envelope?.event?.type==='WalletFreezeWitnessed'&&row.envelope.event.payload?.requestHash===request.eventHash&&row.envelope.event.payload?.validatorRootId===local.rootId);
  if(prior)return prior.envelope;
  const event=await inner.createEvent('WalletFreezeWitnessed',{
    protocol:SECURITY_PROTOCOL,requestHash:request.eventHash,walletId:request.envelope.event.payload.walletId,
    policyHash:request.envelope.event.payload.policyHash,registryHash:committee.registryHash,
    committeeHash:committee.committeeHash,validatorRootId:local.rootId,decision:'freeze',
    evidenceHash:String(evidenceHash||request.envelope.event.payload.evidenceHashes?.[0]||''),
  },[request.eventHash]);
  return inner.publishEvent(event);
}

async function freezeEvidence(requestRow,rows=await meshRows()){
  const {anchor,committee}=await freezeCommittee(requestRow),byDevice=new Map(committee.committee.map(row=>[row.deviceId,row])),witnesses=[];
  for(const row of rows){
    const event=row.envelope?.event,p=event?.payload||{};
    if(row.status!=='active'||event?.type!=='WalletFreezeWitnessed'||p.requestHash!==requestRow.eventHash||p.policyHash!==anchor.hash||p.registryHash!==committee.registryHash||p.committeeHash!==committee.committeeHash||p.decision!=='freeze')continue;
    const validator=byDevice.get(row.signerDeviceId);
    if(!validator||validator.rootId!==p.validatorRootId||witnesses.some(item=>item.rootId===validator.rootId))continue;
    witnesses.push({rootId:validator.rootId,hash:row.eventHash,deviceId:row.signerDeviceId});
  }
  return{anchor,committee,witnesses};
}

async function certifyWalletFreeze(requestHash){
  const rows=await meshRows(),request=freezeRequestByHash(rows,requestHash);
  if(!request)throw new Error('wallet freeze request is unavailable');
  const evidence=await freezeEvidence(request,rows);
  if(evidence.witnesses.length<evidence.committee.quorum)throw new Error('wallet freeze does not have selected-root quorum');
  const chosen=evidence.witnesses.slice(0,evidence.committee.quorum),p=request.envelope.event.payload;
  const existing=rows.find(row=>row.status==='active'&&row.envelope?.event?.type==='WalletSecurityFrozen'&&row.envelope.event.payload?.requestHash===request.eventHash);
  if(existing)return existing.envelope;
  const event=await inner.createEvent('WalletSecurityFrozen',{
    protocol:SECURITY_PROTOCOL,requestHash:request.eventHash,walletId:p.walletId,reason:p.reason,
    policyHash:evidence.anchor.hash,registryHash:evidence.committee.registryHash,committeeHash:evidence.committee.committeeHash,
    quorum:evidence.committee.quorum,witnessHashes:chosen.map(item=>item.hash),frozenAt:now(),
  },[request.eventHash,...chosen.map(item=>item.hash)]);
  const result=await inner.publishEvent(event);
  emit('wallet-frozen',{walletId:p.walletId,freezeHash:event.hash});
  return result;
}

async function validFreezeCertificate(cert,rows){
  const p=cert.envelope.event.payload||{},request=freezeRequestByHash(rows,p.requestHash);
  if(!request||request.envelope.event.payload?.walletId!==p.walletId)return false;
  const evidence=await freezeEvidence(request,rows),valid=new Set(evidence.witnesses.map(item=>item.hash));
  return p.policyHash===evidence.anchor.hash&&p.registryHash===evidence.committee.registryHash&&p.committeeHash===evidence.committee.committeeHash&&Number(p.quorum)===evidence.committee.quorum&&Array.isArray(p.witnessHashes)&&new Set(p.witnessHashes).size>=evidence.committee.quorum&&p.witnessHashes.every(hash=>valid.has(hash));
}

async function walletFreezeStatus(walletId){
  const target=String(walletId||''),rows=await meshRows(),certs=rows.filter(row=>row.status==='active'&&row.envelope?.event?.type==='WalletSecurityFrozen'&&row.envelope.event.payload?.walletId===target).sort((a,b)=>Date.parse(a.envelope.event.createdAt)-Date.parse(b.envelope.event.createdAt));
  for(let index=certs.length-1;index>=0;index-=1){if(await validFreezeCertificate(certs[index],rows))return{walletId:target,frozen:true,freezeHash:certs[index].eventHash,reason:certs[index].envelope.event.payload.reason,frozenAt:certs[index].envelope.event.payload.frozenAt}}
  return{walletId:target,frozen:false};
}

async function pendingWallet(transferId){const rows=await meshRows(),row=rows.find(item=>item.status==='active'&&item.envelope?.event?.type==='TransferPending'&&item.envelope.event.payload?.transferId===String(transferId));return row?.envelope?.event?.payload?.fromId||null}
async function createPendingTransfer(input={},options={}){const wallet=await inner.walletIdentity(),status=await walletFreezeStatus(wallet.walletId);if(status.frozen)throw new Error('wallet is committee-frozen and cannot create transfers');return inner.createPendingTransfer(input,options)}
async function witnessTransfer(transferId,options={}){const walletId=await pendingWallet(transferId);if(walletId&&(await walletFreezeStatus(walletId)).frozen)throw new Error('wallet is committee-frozen and cannot gain transfer witnesses');return inner.witnessTransfer(transferId,options)}
async function finalizeTransfer(transferId,options={}){const walletId=await pendingWallet(transferId);if(walletId&&(await walletFreezeStatus(walletId)).frozen)throw new Error('wallet is committee-frozen and cannot gain finality');return inner.finalizeTransfer(transferId,options)}

async function quarantineOversizedContributionState(){
  const launch=await inner.security.launchStatus(),max=Number(launch.storage?.maxEnvelopeBytes||inner.security.defaults?.maxEnvelopeBytes||128*1024),summary={transportObjectsRemoved:0,meshRowsRejected:0};
  try{
    const db=await openDb('civweave-community-objects-v146');
    try{
      const tx=db.transaction('objects','readwrite'),store=tx.objectStore('objects'),rows=await req(store.getAll());
      for(const row of rows){if(row?.kind!==OBJECT_KIND)continue;const bytes=encoder.encode(JSON.stringify(row.payload||{})).byteLength;if(bytes>max){store.delete(row.id);summary.transportObjectsRemoved+=1}}
      await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('transport quarantine aborted'))});
    }finally{db.close()}
  }catch{}
  try{
    const db=await openDb(inner.DB_NAME);
    try{
      const tx=db.transaction('events','readwrite'),store=tx.objectStore('events'),rows=await req(store.getAll()),skew=Number(inner.security.defaults?.maxClockSkewMs||5*60*1000);
      for(const row of rows){
        const bytes=encoder.encode(JSON.stringify(row.envelope||{})).byteLength,created=Date.parse(row.envelope?.event?.createdAt||'');
        const invalidTime=!Number.isFinite(created),futureTime=Number.isFinite(created)&&created-Date.now()>skew,oversized=bytes>max;
        if(!oversized&&!invalidTime&&!futureTime)continue;
        row.status='rejected';
        row.reason=oversized?'ship-guard: oversized contribution envelope':invalidTime?'ship-guard: invalid contribution timestamp':'ship-guard: future-dated contribution envelope';
        store.put(row);summary.meshRowsRejected+=1;
      }
      await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('mesh quarantine aborted'))});
    }finally{db.close()}
  }catch{}
  if(summary.transportObjectsRemoved||summary.meshRowsRejected)emit('quarantine',summary);
  return summary;
}

async function syncFromLocalMesh(options={}){const result=await inner.syncFromLocalMesh(options),quarantine=await quarantineOversizedContributionState();return{...result,quarantine}}
async function launchStatus(){await quarantineOversizedContributionState();const status=await inner.security.launchStatus(),wallet=await inner.walletIdentity(),freeze=await walletFreezeStatus(wallet.walletId),blockers=[...status.blockers];if(freeze.frozen)blockers.push('local-wallet-frozen');return{...status,readyForContributionValue:blockers.length===0,blockers:[...new Set(blockers)],transferMode:blockers.length?'pending-only':status.transferMode,walletFreeze:freeze}}

const security=Object.freeze({...inner.security,
  requestWalletFreeze,witnessWalletFreeze,certifyWalletFreeze,walletFreezeStatus,quarantineOversizedContributionState,
  launchStatus,subscribeShipGuard(fn){listeners.add(fn);return()=>listeners.delete(fn)},
});
const api=Object.freeze({...inner,createPendingTransfer,witnessTransfer,finalizeTransfer,syncFromLocalMesh,security,shipGuardVersion:VERSION});
globalThis.CivweaveContributionMeshV1=api;
quarantineOversizedContributionState().then(()=>launchStatus()).then(status=>emit('ready',status)).catch(error=>emit('error',{error:String(error?.message||error)}));

})();