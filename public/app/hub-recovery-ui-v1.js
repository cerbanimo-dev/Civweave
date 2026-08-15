(()=>{
'use strict';

const VERSION='1.0.156-hub-account-membership-control-v3';
const STEWARD_KEY='civweave.host-steward.v1';
const STEWARD_CLAIM_KEY='civweave.hub-location-claim.v1';
if(globalThis.CivweaveHubRecoveryUiV1?.version===VERSION)return;

const accounts=()=>globalThis.CivweaveHubPassportAccountV1||null;
const sessions=()=>globalThis.CivweaveHostNodeSessionV1||null;
const legacy=()=>globalThis.CivweaveHubRecoveryApiV1||null;
const el=id=>document.getElementById(id);
const clean=(value,max=1600)=>String(value??'').trim().slice(0,max);
const esc=value=>clean(value,5000).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
let accountModulePromise=null;
let busy=false;
let recoveryKit=null;
let lastActiveLimit=[];
let recoveryChallengePending=false;

function ensureAccountModule(){
  if(globalThis.CivweaveHubPassportAccountV1)return Promise.resolve(globalThis.CivweaveHubPassportAccountV1);
  if(accountModulePromise)return accountModulePromise;
  accountModulePromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src='/app/hub-passport-account-v1.js?v=membership-security-v3';
    script.async=false;
    script.onload=()=>globalThis.CivweaveHubPassportAccountV1?resolve(globalThis.CivweaveHubPassportAccountV1):reject(new Error('Passport account module loaded without its API.'));
    script.onerror=()=>reject(new Error('Passport account module could not load.'));
    document.head.append(script);
  }).catch(error=>{accountModulePromise=null;throw error});
  return accountModulePromise;
}
function status(message,state='info'){
  const node=el('cw-hub-recovery-status');
  if(node){node.textContent=message;node.dataset.state=state}
}
function selectedAccount(){return accounts()?.current?.()||null}
function passkeysAvailable(){return Boolean(globalThis.isSecureContext&&globalThis.PublicKeyCredential&&navigator.credentials?.create&&navigator.credentials?.get)}
function stewardPaired(){
  try{return localStorage.getItem(STEWARD_KEY)==='1'&&Boolean(localStorage.getItem(STEWARD_CLAIM_KEY))}
  catch{return false}
}
function styles(){
  if(el('cw-hub-recovery-style-v3'))return;
  const style=document.createElement('style');
  style.id='cw-hub-recovery-style-v3';
  style.textContent=`
    .cw-hub-recovery{margin-top:14px;padding:15px;border:1px solid #8de5ef36;border-radius:18px;background:#06111ce8;color:#f7fbff}
    .cw-hub-recovery>summary{cursor:pointer;font:900 .84rem system-ui;color:#dff8ff}
    .cw-hub-recovery p{margin:8px 0;color:#bcd0db;font:.77rem/1.48 system-ui}
    .cw-hub-recovery h3{margin:0 0 5px;font:900 .88rem system-ui;color:#fff}
    .cw-hub-recovery section{padding:12px 0}.cw-hub-recovery hr{border:0;border-top:1px solid #ffffff17;margin:4px 0}
    .cw-hub-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:9px}
    .cw-hub-recovery input,.cw-hub-recovery select{min-width:min(100%,230px);flex:1 1 210px;min-height:42px;padding:8px 10px;border:1px solid #ffffff2c;border-radius:11px;background:#09141f;color:#fff;font:800 .82rem system-ui}
    .cw-hub-recovery input[type="checkbox"]{min-width:20px;flex:0 0 auto;width:20px;height:20px;accent-color:#8de5ef}
    .cw-hub-recovery button{min-height:42px;padding:8px 13px;border:1px solid #8de5ef66;border-radius:11px;background:#123647;color:#fff;font:900 .78rem system-ui;cursor:pointer}
    .cw-hub-recovery button.primary{background:#16604f;border-color:#8ff2ce88}.cw-hub-recovery button.danger{background:#4b2027;border-color:#ff9fae66}
    .cw-hub-recovery button:disabled{opacity:.52;cursor:not-allowed}.cw-hub-recovery-status[data-state="ok"]{color:#9cf3ca}.cw-hub-recovery-status[data-state="error"]{color:#ffd08a}
    .cw-hub-note{font-size:.7rem!important;color:#91a8b5!important}.cw-account-name{display:inline-block;padding:5px 9px;border-radius:999px;background:#8de5ef16;color:#dff8ff;font:900 .82rem ui-monospace,SFMono-Regular,Consolas,monospace}
    .cw-checks{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin:10px 0}.cw-check{padding:9px;border:1px solid #ffffff1d;border-radius:11px;background:#09151f;font:800 .7rem system-ui;color:#8da3ae}.cw-check[data-ok="true"]{color:#a8f2ce;border-color:#6de0ae55;background:#0b211b}
    .cw-kit{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin:10px 0}.cw-kit code{display:block;padding:8px;border-radius:9px;background:#02090e;border:1px solid #ffffff1b;color:#dff8ff;overflow-wrap:anywhere;font-size:.72rem}
    .cw-device,.cw-passport,.cw-steward-member{padding:9px 10px;border:1px solid #ffffff1c;border-radius:11px;background:#08151f;margin-top:7px}.cw-device strong,.cw-passport strong,.cw-steward-member strong{display:block;font:850 .76rem system-ui;color:#eafaff}.cw-device small,.cw-passport small,.cw-steward-member small{display:block;color:#8fa6b2;margin-top:3px}
    .cw-inline-label{display:flex;gap:9px;align-items:flex-start;margin-top:10px;color:#c6d7df;font:.74rem/1.4 system-ui}.cw-offline-callout{padding:10px 12px;border-radius:12px;border:1px solid #e7c96d44;background:#2b230d55}.cw-online-ready{padding:10px 12px;border-radius:12px;border:1px solid #65dfaa44;background:#0d2c2255}
    .cw-stripe{border:1px solid #a98bff44!important;border-radius:14px;padding:12px!important;background:#17133177}.cw-steward{border:1px solid #e8c96b44!important;border-radius:14px;padding:12px!important;background:#2a210d55}.cw-hidden{display:none!important}
    @media(max-width:640px){.cw-checks,.cw-kit{grid-template-columns:1fr}.cw-hub-recovery button{flex:1 1 140px}}
  `;
  document.head.append(style);
}
function build(){
  const host=el('cw-host-node-lobby');
  if(!host)return null;
  let root=el('cw-hub-recovery-panel');
  if(root)return root;
  root=document.createElement('details');
  root.id='cw-hub-recovery-panel';
  root.className='cw-hub-recovery';
  root.innerHTML=`
    <summary>Hub account, Passports & devices</summary>
    <p id="cw-hub-recovery-status" class="cw-hub-recovery-status" role="status">Civweave works locally without an account. These security steps are required only when you join a Hub.</p>

    <section>
      <h3>1 · Choose your Hub username</h3>
      <p>Your username belongs to one account, not to a browser install or a Passport. Reconnecting the account does not consume another Hub seat.</p>
      <div class="cw-hub-row"><input id="cw-hub-account-name-input" autocomplete="username" maxlength="64" placeholder="your-weave-name"><button id="cw-hub-account-create-button" class="primary" type="button">Create / connect account</button></div>
      <div class="cw-hub-row"><input id="cw-hub-account-login-name" autocomplete="username" maxlength="64" placeholder="Existing username"><button id="cw-hub-passkey-login" type="button">Sign in with passkey</button></div>
    </section>

    <hr><section>
      <h3>2 · Secure Hub membership</h3>
      <p><strong>Account:</strong> <span id="cw-hub-account-name" class="cw-account-name">not created</span></p>
      <div class="cw-checks"><div class="cw-check" id="cw-check-recovery">Recovery kit</div><div class="cw-check" id="cw-check-email">Recovery email</div><div class="cw-check" id="cw-check-2fa">2FA</div></div>

      <div id="cw-recovery-kit-box" class="cw-hidden">
        <p><strong>Save these one-time recovery codes somewhere separate from this device.</strong></p>
        <div id="cw-recovery-kit-codes" class="cw-kit"></div>
        <label class="cw-inline-label"><input id="cw-kit-saved" type="checkbox"><span>I saved this recovery kit somewhere I can reach if this device is lost.</span></label>
        <div class="cw-hub-row"><button id="cw-kit-ack" type="button">Confirm saved kit</button><button id="cw-kit-regenerate" type="button">Replace kit</button></div>
      </div>
      <div id="cw-recovery-kit-missing" class="cw-hidden"><p class="cw-hub-note">If an unsaved kit was lost, replace it. The previous codes stop working.</p><div class="cw-hub-row"><button id="cw-kit-regenerate-missing" type="button">Create replacement recovery kit</button></div></div>

      <p><strong>Verified recovery account</strong></p>
      <p class="cw-hub-note">Online Hub membership requires a verified recovery email. Civweave local app use does not.</p>
      <div class="cw-hub-row"><input id="cw-hub-recovery-email" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com"><button id="cw-hub-recovery-save" type="button">Send verification code</button></div>
      <div class="cw-hub-row cw-hidden" id="cw-hub-email-code-row"><input id="cw-hub-verify-code" autocomplete="one-time-code" inputmode="numeric" maxlength="6" placeholder="6-digit code"><button id="cw-hub-verify-submit" type="button">Verify recovery email</button></div>

      <p><strong>Two-factor authentication</strong></p>
      <p class="cw-hub-note">Passkeys are preferred. Authenticator codes are the offline-safe fallback for reachable LAN Hubs that cannot provide a secure WebAuthn origin.</p>
      <div class="cw-hub-row"><button id="cw-hub-passkey-add" type="button">Create passkey</button><button id="cw-totp-begin" type="button">Use authenticator app</button></div>
      <div id="cw-totp-setup" class="cw-hidden"><p>Authenticator secret: <code id="cw-totp-secret"></code></p><p class="cw-hub-note">Add the secret to your authenticator, then enter its current six-digit code.</p><div class="cw-hub-row"><input id="cw-totp-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6-digit authenticator code"><button id="cw-totp-verify" type="button">Confirm authenticator</button></div></div>

      <div id="cw-offline-ready" class="cw-offline-callout cw-hidden"><strong>Offline-ready.</strong><p>This account has locally checkable recovery + 2FA material. A reachable physical Hub can admit an offline account while the public directory is unavailable.</p></div>
      <div id="cw-online-ready" class="cw-online-ready cw-hidden"><strong>Hub-ready.</strong><p>Username, recovery and 2FA are complete. Additional Passports and reconnects share this account seat.</p><div class="cw-hub-row"><button id="cw-secure-join" class="primary" type="button">Join this Hub</button></div></div>
    </section>

    <hr><section>
      <h3>Recover or pair another device</h3>
      <p class="cw-hub-note">Passkey sign-in is the easiest path. TOTP-only accounts can use one saved recovery code plus the authenticator code. Recovery codes are one-use.</p>
      <div class="cw-hub-row"><input id="cw-new-recovery-code" autocomplete="one-time-code" placeholder="Saved recovery code"><input id="cw-new-recovery-totp" inputmode="numeric" maxlength="6" placeholder="Authenticator code"><button id="cw-new-recovery-submit" type="button">Recover on this device</button></div>
    </section>

    <hr><section>
      <h3>Passports & devices</h3>
      <p id="cw-device-summary" class="cw-hub-note">Up to 10 paired devices, with 2 active at a time.</p>
      <div id="cw-device-list"></div>
      <p><strong>Passports on this account</strong></p><div id="cw-passport-list"></div>
    </section>

    <hr><section id="cw-stripe-section" class="cw-stripe cw-hidden">
      <h3>Optional · Connect Stripe</h3>
      <p>Connect a Stripe payment identity for payouts when you sell services, tutoring, or education. The same Accounts v2 identity also carries customer configuration for easier saved-method checkout where Civweave uses it as your buyer account. Current purchases still go through Stripe Checkout.</p>
      <label class="cw-inline-label"><input id="cw-rebate-optin" type="checkbox"><span><strong>Annual Member Rebate:</strong> connecting Stripe with this acknowledgement opts the account into any annual member surplus return approved under the program rules. This is a member rebate, not ownership or an equity dividend.</span></label>
      <div class="cw-hub-row"><input id="cw-stripe-email" type="email" autocomplete="email" placeholder="Stripe contact email"><select id="cw-stripe-country" aria-label="Stripe country"><option value="us">United States</option><option value="jp">Japan</option></select><button id="cw-stripe-connect" type="button">Connect Stripe</button><button id="cw-stripe-onboard" type="button">Continue Stripe setup</button></div>
      <p id="cw-stripe-status" class="cw-hub-note">Stripe is optional for Hub membership.</p>
    </section>

    <hr><section id="cw-steward-section" class="cw-steward cw-hidden">
      <h3>Host Steward · member access</h3>
      <p>Removing a member frees the Hub seat without deleting their Civweave account, Passports, or stored credit history. “Remove + block” also prevents automatic rejoin.</p>
      <div class="cw-hub-row"><button id="cw-steward-refresh" type="button">Refresh members</button></div><div id="cw-steward-members"></div>
    </section>

    <details><summary>Legacy recovery code</summary><p class="cw-hub-note">Accounts created before the current Passport account system may still use a saved legacy Hub recovery code.</p><div class="cw-hub-row"><input id="cw-hub-recover-code" autocomplete="one-time-code" placeholder="Saved legacy recovery code"><button id="cw-hub-recover-complete" type="button">Recover legacy account</button></div></details>
  `;
  host.append(root);
  bind(root);
  render();
  return root;
}
function setCheck(id,ok,label){const node=el(id);if(node){node.dataset.ok=String(Boolean(ok));node.textContent=`${ok?'✓':'○'} ${label}`}}
function renderRecoveryKit(account){
  const box=el('cw-recovery-kit-box'),codes=el('cw-recovery-kit-codes'),missing=el('cw-recovery-kit-missing');
  const list=Array.isArray(recoveryKit?.codes)?recoveryKit.codes:[];
  if(box)box.classList.toggle('cw-hidden',!list.length);
  if(codes)codes.innerHTML=list.map(code=>`<code>${esc(code)}</code>`).join('');
  if(missing)missing.classList.toggle('cw-hidden',!account||Boolean(account.recoveryKitAcknowledged)||Boolean(list.length));
}
function renderDevices(account){
  const summary=el('cw-device-summary'),list=el('cw-device-list');
  const rows=Array.isArray(account?.devices)?account.devices:[];
  if(summary)summary.textContent=account?`${account.pairedDeviceCount||0} / ${account.maxPairedDevices||10} devices paired · ${account.activeDeviceCount||0} / ${account.maxActiveDevices||2} active.`:'Up to 10 paired devices, with 2 active at a time.';
  if(!list)return;
  const current=sessions()?.deviceId?.();
  list.innerHTML=rows.length?rows.map(row=>`<div class="cw-device"><strong>${esc(row.label||'Civweave device')}${row.deviceId===current?' · this device':''}</strong><small>${row.active?'Active':'Paired, inactive'} · ${esc(row.deviceId)}</small><div class="cw-hub-row">${row.active?`<button data-device-action="deactivate" data-device-id="${esc(row.deviceId)}" type="button">Deactivate</button>`:''}<button data-device-action="remove" data-device-id="${esc(row.deviceId)}" type="button">Remove device</button>${lastActiveLimit.some(item=>item.deviceId===row.deviceId)?`<button class="primary" data-device-action="replace" data-device-id="${esc(row.deviceId)}" type="button">Replace with this device</button>`:''}</div></div>`).join(''):'<p class="cw-hub-note">No paired devices recorded yet.</p>';
}
function renderPassports(account){
  const list=el('cw-passport-list');if(!list)return;
  const rows=Array.isArray(account?.passportIds)?account.passportIds:[];
  const current=accounts()?.passport?.();
  list.innerHTML=rows.length?rows.map(id=>`<div class="cw-passport"><strong>${esc(id)}${id===current?' · current':''}</strong>${rows.length>1?`<div class="cw-hub-row"><button data-passport-remove="${esc(id)}" type="button">Detach Passport</button></div>`:''}</div>`).join(''):'<p class="cw-hub-note">No Passport associations yet.</p>';
}
function render(){
  const account=selectedAccount();
  if(el('cw-hub-account-name'))el('cw-hub-account-name').textContent=account?.accountName||'not created';
  setCheck('cw-check-recovery',account?.recoveryKitAcknowledged,'Recovery kit');
  setCheck('cw-check-email',account?.recoveryEmailVerified,'Recovery email');
  setCheck('cw-check-2fa',account?.secondFactorReady,'2FA');
  el('cw-offline-ready')?.classList.toggle('cw-hidden',!account?.offlineMembershipReady);
  el('cw-online-ready')?.classList.toggle('cw-hidden',!account?.onlineMembershipReady);
  el('cw-stripe-section')?.classList.toggle('cw-hidden',!account?.onlineMembershipReady);
  el('cw-steward-section')?.classList.toggle('cw-hidden',!stewardPaired());
  const passkey=el('cw-hub-passkey-add');
  if(passkey){passkey.disabled=busy||!account||!passkeysAvailable();passkey.textContent=!passkeysAvailable()?'Passkey unavailable here':account?.passkeyCount?`Add another passkey (${account.passkeyCount})`:'Create passkey'}
  for(const id of ['cw-hub-account-create-button','cw-hub-passkey-login','cw-totp-begin','cw-totp-verify','cw-hub-recovery-save','cw-hub-verify-submit','cw-kit-ack','cw-kit-regenerate','cw-kit-regenerate-missing','cw-secure-join','cw-new-recovery-submit','cw-stripe-connect','cw-stripe-onboard','cw-steward-refresh']){
    const button=el(id);if(button&&id!=='cw-hub-passkey-add')button.disabled=busy;
  }
  renderRecoveryKit(account);renderDevices(account);renderPassports(account);
}
async function run(label,fn){
  if(busy)throw new Error('Another account action is already running.');
  busy=true;render();status(label);
  try{return await fn()}
  catch(error){status(error?.message||String(error),'error');throw error}
  finally{busy=false;render()}
}
function rawAccountPayload(){
  const api=accounts(),identity=api?.identity?.();
  return {userId:identity?.userId,credential:identity?.credential,passportId:api?.passport?.(),deviceId:sessions()?.deviceId?.(),deviceLabel:sessions()?.deviceLabel?.()};
}
function accountEndpoint(path){
  const api=accounts(),h=api?.host?.(),n=api?.nodeId?.();
  if(!h||!n)throw new Error('Choose a Hub first.');
  const base=new URL(h),cloud=/^civweave-node-cloud\./i.test(base.hostname);
  return {url:new URL(cloud?`/n/${encodeURIComponent(n)}/api/account/${path}`:`/nodes/${encodeURIComponent(n)}/api/account/${path}`,h),origin:h,nodeId:n};
}
async function directAccountPost(path,body={},includeCurrentIdentity=true){
  const target=accountEndpoint(path);
  const payload=includeCurrentIdentity?{...rawAccountPayload(),...body}:body;
  const response=await fetch(target.url,{method:'POST',cache:'no-store',headers:{accept:'application/json','content-type':'application/json','x-civweave-node-id':target.nodeId},body:JSON.stringify(payload)});
  const packet=await response.json().catch(()=>({}));
  if(!response.ok||packet?.ok===false){const error=new Error(packet?.error||`Hub returned HTTP ${response.status}.`);error.status=response.status;error.code=packet?.code||'';error.payload=packet;throw error}
  return packet;
}
async function createAccount(root){
  const name=clean(root.querySelector('#cw-hub-account-name-input')?.value,64).toLowerCase();
  if(!name)return status('Choose a username first.','error');
  try{await run('Creating the Hub account without consuming a seat…',async()=>{const packet=await accounts()?.ensureAccount?.(name);if(packet?.recoveryKit)recoveryKit=packet.recoveryKit;root.setAttribute('open','');status(`Account ${packet.account?.accountName||name} created. Save recovery, add 2FA, and verify recovery email before joining.`,'ok');return packet})}catch{}
}
async function login(root){
  const name=clean(root.querySelector('#cw-hub-account-login-name')?.value,64).toLowerCase();
  if(!name)return status('Enter the account username first.','error');
  try{await run('Confirm the account passkey…',async()=>{const packet=await accounts()?.login?.(name);status(`Signed in to ${packet.account?.accountName||name}. This device is paired to the existing account.`,'ok');return packet})}catch{}
}
async function addPasskey(){try{await run('Waiting for this device to create a passkey…',async()=>{const packet=await accounts()?.registerCurrentPassport?.();status('Passkey 2FA is ready.','ok');return packet})}catch{}}
async function beginTotp(){try{await run('Creating offline-safe authenticator setup…',async()=>{const packet=await accounts()?.beginTotp?.();if(el('cw-totp-secret'))el('cw-totp-secret').textContent=packet?.secret||'';el('cw-totp-setup')?.classList.remove('cw-hidden');status('Add the secret to your authenticator, then confirm a code.','ok');return packet})}catch{}}
async function verifyTotp(root){
  const code=clean(root.querySelector('#cw-totp-code')?.value,20);if(!code)return status('Enter the current authenticator code.','error');
  try{await run('Checking authenticator code…',async()=>{const packet=await accounts()?.verifyTotp?.(code);root.querySelector('#cw-totp-code').value='';status('Authenticator 2FA is ready, including for offline Hub access.','ok');return packet})}catch{}
}
async function beginEmail(root){
  const email=clean(root.querySelector('#cw-hub-recovery-email')?.value,320);if(!email)return status('Enter a recovery email first.','error');
  try{await run('Sending recovery verification…',async()=>{await accounts()?.beginRecoveryEmail?.(email);recoveryChallengePending=true;el('cw-hub-email-code-row')?.classList.remove('cw-hidden');el('cw-hub-verify-code')?.focus();status('Check that address for the six-digit code.','ok')})}catch{}
}
async function verifyEmail(root){
  const code=clean(root.querySelector('#cw-hub-verify-code')?.value,40);if(!code||!recoveryChallengePending)return status('Request and enter the recovery verification code first.','error');
  try{await run('Verifying recovery account…',async()=>{const packet=await accounts()?.verifyRecoveryEmail?.(code);recoveryChallengePending=false;el('cw-hub-email-code-row')?.classList.add('cw-hidden');root.querySelector('#cw-hub-verify-code').value='';status(packet?.linked?'Passport linked to the existing secured account.':'Recovery email verified.','ok');return packet})}catch{}
}
async function ackKit(root){
  if(!root.querySelector('#cw-kit-saved')?.checked)return status('Confirm that you saved the recovery kit somewhere separate first.','error');
  try{await run('Sealing recovery-kit acknowledgement…',async()=>{const packet=await accounts()?.acknowledgeRecoveryKit?.();recoveryKit=null;root.querySelector('#cw-kit-saved').checked=false;status('Recovery kit saved and acknowledged.','ok');return packet})}catch{}
}
async function regenerateKit(){
  try{await run('Replacing recovery kit…',async()=>{const packet=await directAccountPost('recovery-kit/regenerate');recoveryKit=packet.recoveryKit;status('New recovery codes created. The previous kit is invalid now.','ok');return packet})}catch{}
}
async function recoverWithKit(root){
  const code=clean(root.querySelector('#cw-new-recovery-code')?.value,400),totpCode=clean(root.querySelector('#cw-new-recovery-totp')?.value,20);
  if(!code||!totpCode)return status('Enter one saved recovery code and the current authenticator code.','error');
  try{await run('Recovering this account onto the current device…',async()=>{
    const packet=await directAccountPost('recovery-kit/complete',{code,totpCode},false);
    const target=accountEndpoint('membership/readiness');
    if(!packet?.userId||!packet?.credential||!packet?.account?.accountName)throw new Error('Hub recovery did not return a complete account login.');
    globalThis.CivweaveHostNodeSessionImportV1?.install?.(target.origin,target.nodeId,packet.userId,packet.credential,packet.recoveredAt||new Date().toISOString());
    await accounts()?.ensureAccount?.(packet.account.accountName);
    root.querySelector('#cw-new-recovery-code').value='';root.querySelector('#cw-new-recovery-totp').value='';
    status(`Recovered ${packet.account.accountName} on this device.`,'ok');return packet;
  })}catch{}
}
async function secureJoin(){
  const api=accounts(),account=api?.current?.();if(!account?.onlineMembershipReady)return status('Complete recovery and 2FA first.','error');
  try{await run('Joining this Hub with the secured account…',async()=>{const packet=await sessions()?.join?.(api.host(),{nodeId:api.nodeId(),createCredential:false});status(packet?.idempotent?'Reconnected without consuming another seat.':'Hub membership created. One account, one seat.','ok');return packet})}catch{}
}
async function handleDeviceAction(button){
  const id=clean(button.dataset.deviceId,180),action=button.dataset.deviceAction;if(!id)return;
  try{
    if(action==='deactivate')await run('Deactivating device session…',()=>accounts()?.deactivateDevice?.(id));
    if(action==='remove')await run('Removing paired device…',()=>accounts()?.removeDevice?.(id));
    if(action==='replace')await run('Moving an active slot to this device…',async()=>{const api=accounts(),packet=await sessions()?.join?.(api.host(),{nodeId:api.nodeId(),createCredential:false,replaceDeviceId:id});lastActiveLimit=[];status('This device is active; the selected device was deactivated.','ok');return packet});
  }catch{}
}
async function detachPassport(id){try{await run('Detaching Passport…',()=>accounts()?.detachPassport?.(id))}catch{}}
async function stripeStatus(){
  const node=el('cw-stripe-status');
  try{const packet=await accounts()?.stripeStatus?.();if(node)node.textContent=packet?.connected?(packet.merchant?.readyToProcessPayments?'Stripe connected and ready for eligible paid services and education.':'Stripe connected; finish onboarding before accepting payments.'):'Stripe is not connected yet.';if(el('cw-rebate-optin'))el('cw-rebate-optin').checked=Boolean(packet?.annualMemberRebateOptIn);return packet}
  catch(error){if(node)node.textContent=`Stripe status unavailable: ${error.message}`;return null}
}
async function connectStripe(root){
  const email=clean(root.querySelector('#cw-stripe-email')?.value,320),country=clean(root.querySelector('#cw-stripe-country')?.value,2)||'us',optIn=Boolean(root.querySelector('#cw-rebate-optin')?.checked);
  if(!email)return status('Enter the email Stripe should use for your payment identity.','error');
  if(!optIn)return status('Confirm the Annual Member Rebate disclosure before connecting Stripe.','error');
  try{await run('Creating or reconnecting your Stripe payment identity…',async()=>{const packet=await accounts()?.connectStripe?.({email,country,annualMemberRebateOptIn:true});status('Stripe identity connected. Continue Stripe setup to complete payouts and payment capability.','ok');return packet});await stripeStatus()}catch{}
}
async function onboardStripe(){
  try{await run('Opening Stripe onboarding…',async()=>{const packet=await accounts()?.onboardStripe?.(),url=clean(packet?.onboarding?.url,2000);if(!url)throw new Error('Stripe did not return an onboarding URL.');location.assign(url);return packet})}catch{}
}
function stewardEndpoint(path){
  const api=accounts(),h=api?.host?.(),n=api?.nodeId?.();if(!h||!n)throw new Error('Choose this Hub first.');
  const base=new URL(h),cloud=/^civweave-node-cloud\./i.test(base.hostname);
  return {url:new URL(cloud?`/n/${encodeURIComponent(n)}/api/account/steward/${path}`:`/nodes/${encodeURIComponent(n)}/api/account/steward/${path}`,h),nodeId:n};
}
async function stewardPost(path,body={}){
  let stewardKey='';try{stewardKey=localStorage.getItem(STEWARD_CLAIM_KEY)||''}catch{}
  if(!stewardKey)throw new Error('This browser is not paired as the Hub Steward.');
  const target=stewardEndpoint(path),response=await fetch(target.url,{method:'POST',cache:'no-store',headers:{accept:'application/json','content-type':'application/json','x-civweave-node-id':target.nodeId},body:JSON.stringify({stewardKey,...body})});
  const packet=await response.json().catch(()=>({}));if(!response.ok||packet?.ok===false)throw new Error(packet?.error||`Hub returned HTTP ${response.status}.`);return packet;
}
function renderStewardMembers(rows=[]){
  const list=el('cw-steward-members');if(!list)return;
  list.innerHTML=rows.length?rows.map(row=>`<div class="cw-steward-member"><strong>${esc(row.accountName||row.userId)}</strong><small>${esc(row.userId)} · ${esc(row.seatClass||'member')} · ${esc(row.billingStatus||'free')} · ${(row.passportIds||[]).length} Passport(s)</small><div class="cw-hub-row"><button class="danger" data-steward-remove="${esc(row.userId)}" type="button">Remove from Hub</button><button class="danger" data-steward-block="${esc(row.userId)}" type="button">Remove + block rejoin</button></div></div>`).join(''):'<p class="cw-hub-note">No Hub members currently occupy seats.</p>';
}
async function loadStewardMembers(){const packet=await stewardPost('members');renderStewardMembers(packet?.members||[]);return packet}
async function refreshStewardMembers(){try{await run('Loading Hub members…',async()=>{const packet=await loadStewardMembers();status(`Loaded ${(packet?.members||[]).length} Hub member${(packet?.members||[]).length===1?'':'s'}.`,'ok');return packet})}catch{}}
async function stewardRemove(userId,blockRejoin){
  let packet;
  try{packet=await run(blockRejoin?'Removing and blocking member…':'Removing member from Hub…',()=>stewardPost('member/remove',{userId,blockRejoin,reason:'removed-by-host-steward'}))}catch{return}
  status(packet?.billingActionRequired?'Member removed and seat freed. Paid billing also needs money-edge cancellation.':'Member removed and Hub seat freed. Their Civweave account remains theirs.',packet?.billingActionRequired?'error':'ok');
  try{await run('Refreshing Hub members…',loadStewardMembers)}catch{}
}
async function legacyRecover(root){
  const code=clean(root.querySelector('#cw-hub-recover-code')?.value,400);if(!code)return status('Enter a saved legacy recovery code.','error');
  try{await run('Checking legacy recovery code…',async()=>{const packet=await legacy()?.complete?.(code);status('Legacy Hub access recovered. Secure the account with current recovery + 2FA before joining again.','ok');return packet})}catch{}
}
function bind(root){
  root.querySelector('#cw-hub-account-create-button')?.addEventListener('click',()=>createAccount(root));
  root.querySelector('#cw-hub-passkey-login')?.addEventListener('click',()=>login(root));
  root.querySelector('#cw-hub-passkey-add')?.addEventListener('click',addPasskey);
  root.querySelector('#cw-totp-begin')?.addEventListener('click',beginTotp);
  root.querySelector('#cw-totp-verify')?.addEventListener('click',()=>verifyTotp(root));
  root.querySelector('#cw-hub-recovery-save')?.addEventListener('click',()=>beginEmail(root));
  root.querySelector('#cw-hub-verify-submit')?.addEventListener('click',()=>verifyEmail(root));
  root.querySelector('#cw-kit-ack')?.addEventListener('click',()=>ackKit(root));
  root.querySelector('#cw-kit-regenerate')?.addEventListener('click',regenerateKit);
  root.querySelector('#cw-kit-regenerate-missing')?.addEventListener('click',regenerateKit);
  root.querySelector('#cw-new-recovery-submit')?.addEventListener('click',()=>recoverWithKit(root));
  root.querySelector('#cw-secure-join')?.addEventListener('click',secureJoin);
  root.querySelector('#cw-stripe-connect')?.addEventListener('click',()=>connectStripe(root));
  root.querySelector('#cw-stripe-onboard')?.addEventListener('click',onboardStripe);
  root.querySelector('#cw-steward-refresh')?.addEventListener('click',refreshStewardMembers);
  root.querySelector('#cw-hub-recover-complete')?.addEventListener('click',()=>legacyRecover(root));
  root.addEventListener('click',event=>{
    const device=event.target?.closest?.('[data-device-action]');if(device){void handleDeviceAction(device);return}
    const passport=event.target?.closest?.('[data-passport-remove]');if(passport){void detachPassport(passport.dataset.passportRemove);return}
    const remove=event.target?.closest?.('[data-steward-remove]');if(remove){void stewardRemove(remove.dataset.stewardRemove,false);return}
    const block=event.target?.closest?.('[data-steward-block]');if(block)void stewardRemove(block.dataset.stewardBlock,true);
  });
}
async function bootstrap(){
  try{
    await ensureAccountModule();const api=accounts();if(!api)return;
    const packet=await api.bootstrap?.();
    if(packet?.account)status(packet.account.onlineMembershipReady?'Hub account is ready.':'Finish the highlighted security steps before joining the Hub.',packet.account.onlineMembershipReady?'ok':'info');
    render();if(packet?.account?.onlineMembershipReady)void stripeStatus();
  }catch(error){status(`Account setup could not finish: ${error.message}`,'error')}
}
function observe(){
  if(build())return;
  const watcher=new MutationObserver(()=>{if(build())watcher.disconnect()});watcher.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>watcher.disconnect(),15000);
}
function boot(){
  styles();observe();
  void ensureAccountModule().then(()=>bootstrap()).catch(error=>status(`Account security could not load: ${error.message}`,'error'));
  addEventListener('civweave:host-node-selected',()=>{render();void bootstrap()});
  addEventListener('civweave:passport-account',()=>{render();if(selectedAccount()?.onlineMembershipReady)void stripeStatus()});
  addEventListener('civweave:passport-account-needed',()=>{el('cw-hub-recovery-panel')?.setAttribute('open','');status('Choose a username and secure the account before this Hub can consume a seat.','info')});
  addEventListener('civweave:hub-account-security-required',()=>{el('cw-hub-recovery-panel')?.setAttribute('open','');status('Hub membership is locked until username, recovery, and 2FA are complete.','error')});
  addEventListener('civweave:hub-recovery-kit-issued',event=>{recoveryKit=event.detail?.recoveryKit||null;el('cw-hub-recovery-panel')?.setAttribute('open','');render()});
  addEventListener('civweave:hub-active-device-limit',event=>{lastActiveLimit=Array.isArray(event.detail?.activeDevices)?event.detail.activeDevices:[];el('cw-hub-recovery-panel')?.setAttribute('open','');status('Two devices are already active. Choose one below to replace with this device.','error');render()});
  setTimeout(bootstrap,700);
}
if(document.readyState==='loading')addEventListener('DOMContentLoaded',boot,{once:true});else boot();
globalThis.CivweaveHubRecoveryUiV1=Object.freeze({version:VERSION,build,refresh:render,bootstrap});
})();
