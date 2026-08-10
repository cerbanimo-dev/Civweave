(()=>{
'use strict';
const $=id=>document.getElementById(id);
const show=(id,value)=>{const node=$(id);if(!node)return;node.classList.remove('hidden');node.textContent=typeof value==='string'?value:JSON.stringify(value,null,2)};
const parseJson=(value,label)=>{try{return JSON.parse(value)}catch{throw new Error(`${label} is not valid JSON`)}};
const guardianIds=()=>String($('guardians')?.value||'').split(/\n|,/).map(x=>x.trim()).filter(Boolean);
let api=null,security=null,lastRecovery=null;

async function runtime(){
  const phone=globalThis.CivweavePhoneLedgerV1;
  if(!phone)throw new Error('Phone ledger runtime is unavailable');
  await phone.ready();
  api=globalThis.CivweaveContributionMeshV1;
  if(!api?.security)throw new Error('Contribution security runtime is unavailable');
  security=api.security;
  return api;
}

async function refresh(){
  await runtime();
  const status=await security.launchStatus(),wallet=await api.walletIdentity();
  $('runtime-badge').textContent=status.readyForContributionValue?'value ready':'guarded';
  $('runtime-badge').className=`badge ${status.readyForContributionValue?'ok':'warn'}`;
  const readiness=$('readiness');
  readiness.className=`banner ${status.readyForContributionValue?'ready':'blocked'}`;
  readiness.textContent=status.readyForContributionValue?'Contribution value finality is ready under the installed federation policy.':'Value finality is fail-closed until every launch blocker is cleared.';
  const rows=[
    ['Wallet',wallet.walletId],
    ['Recovery',status.recovery?.recoveryReady?'ready':'required'],
    ['Policy',status.policyHash||'not installed'],
    ['Eligible validator roots',String(status.eligibleValidatorRoots||0)],
    ['Transfer mode',status.transferMode],
    ['External offramps',status.externalOfframpsEnabled?'ENABLED':'disabled'],
    ['Wallet freeze',status.walletFreeze?.frozen?'FROZEN':'clear'],
    ['Mesh events',String(status.storage?.eventCount||0)],
  ];
  $('metrics').innerHTML=rows.map(([key,value])=>`<div class="metric"><b>${key}</b><span>${escapeHtml(value)}</span></div>`).join('');
  if(status.blockers?.length)show('blockers',{blockers:status.blockers,storage:status.storage,walletFreeze:status.walletFreeze});else $('blockers').classList.add('hidden');
  return status;
}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}

async function makeRecovery(){
  const guardians=guardianIds(),threshold=Number($('threshold').value||2);
  lastRecovery=await security.configureRecovery({guardianIds:guardians,threshold});
  show('recovery-output',{IMPORTANT:'Copy each share to its named guardian before confirming distribution. Civweave will erase its stored share copies after confirmation.',bundle:lastRecovery.bundle,guardianShares:lastRecovery.shares});
}
async function confirmRecovery(){
  const draft=await security.recoveryDraft();
  if(!draft?.bundle)throw new Error('Create a recovery kit first');
  await security.confirmRecoveryDistribution(draft.bundle.guardianIds);
  lastRecovery=null;
  show('recovery-output',{confirmed:true,walletId:draft.bundle.walletId,bundleHash:draft.bundle.hash,guardianCount:draft.bundle.guardianIds.length,threshold:draft.bundle.threshold,sharesRetainedByApp:0});
  await refresh();
}

async function createAnchor(){
  const roots=parseJson($('genesis-json').value,'Genesis validators');
  if(!Array.isArray(roots))throw new Error('Genesis validators must be a JSON array of {rootId, publicKey} objects');
  const anchor=await security.createPolicyAnchorDraft({federationId:$('federation-id').value.trim()||'civweave-local-federation',genesisValidators:roots});
  $('anchor-json').value=JSON.stringify(anchor,null,2);
  show('anchor-output',{draft:true,anchorHash:anchor.hash,threshold:anchor.threshold,genesisRoots:anchor.genesisValidators.map(x=>x.rootId)});
}
async function signAnchor(){
  const anchor=parseJson($('anchor-json').value,'Anchor');
  const signature=await security.signPolicyAnchorDraft(anchor),signatures=new Map((anchor.signatures||[]).map(row=>[row.rootId,row]));
  signatures.set(signature.rootId,signature);
  anchor.signatures=[...signatures.values()].sort((a,b)=>a.rootId.localeCompare(b.rootId));
  $('anchor-json').value=JSON.stringify(anchor,null,2);
  const check=await security.verifyPolicyAnchor(anchor);
  show('anchor-output',{signatureAdded:signature.rootId,verification:check});
}
async function installAnchor(){
  const anchor=parseJson($('anchor-json').value,'Anchor'),check=await security.installPolicyAnchor(anchor);
  show('anchor-output',{installed:true,verification:check,policyHash:anchor.hash});
  await refresh();
}

async function registerValidator(){
  const result=await security.registerValidator();
  show('validator-output',{registered:true,eventHash:result.event.hash,rootId:result.event.payload.rootId,deviceId:result.event.payload.deviceId});
  await refresh();
}
async function attestValidator(){
  const target=$('attest-root').value.trim();
  if(!target)throw new Error('Enter a validator root ID to attest');
  const result=await security.attestValidator(target,{pairingReceiptId:$('attest-receipt').value.trim()});
  show('validator-output',{attested:true,eventHash:result.event.hash,targetRootId:target});
  await refresh();
}

async function requestFreeze(){
  const walletId=$('freeze-wallet').value.trim();
  if(!walletId)throw new Error('Enter the wallet ID to freeze');
  const result=await security.requestWalletFreeze(walletId,{reason:$('freeze-reason').value.trim()||'suspected-key-compromise'});
  $('freeze-request').value=result.event.hash;
  show('freeze-output',{requested:true,requestHash:result.event.hash,walletId});
}
async function witnessFreeze(){
  const hash=$('freeze-request').value.trim();
  if(!hash)throw new Error('Enter the freeze request hash');
  const result=await security.witnessWalletFreeze(hash);
  show('freeze-output',{witnessed:true,witnessHash:result.event.hash,validatorRootId:result.event.payload.validatorRootId});
}
async function certifyFreeze(){
  const hash=$('freeze-request').value.trim();
  if(!hash)throw new Error('Enter the freeze request hash');
  const result=await security.certifyWalletFreeze(hash);
  show('freeze-output',{frozen:true,certificateHash:result.event.hash,walletId:result.event.payload.walletId,quorum:result.event.payload.quorum});
  await refresh();
}
async function quarantine(){show('blockers',{quarantine:await security.quarantineOversizedContributionState(),status:await security.storageSecurityStatus()});await refresh()}

function bind(id,fn){$(id)?.addEventListener('click',()=>fn().catch(error=>show(outputFor(id),{error:String(error?.message||error)})))}
function outputFor(id){if(id.includes('recovery'))return'recovery-output';if(id.includes('anchor'))return'anchor-output';if(id.includes('validator')||id.includes('attest'))return'validator-output';if(id.includes('freeze'))return'freeze-output';return'blockers'}

bind('refresh',refresh);bind('quarantine',quarantine);bind('make-recovery',makeRecovery);bind('confirm-recovery',confirmRecovery);bind('create-anchor',createAnchor);bind('sign-anchor',signAnchor);bind('install-anchor',installAnchor);bind('register-validator',registerValidator);bind('attest-validator',attestValidator);bind('request-freeze',requestFreeze);bind('witness-freeze',witnessFreeze);bind('certify-freeze',certifyFreeze);
refresh().catch(error=>show('blockers',{error:String(error?.message||error)}));
})();