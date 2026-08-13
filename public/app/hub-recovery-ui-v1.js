(()=>{
'use strict';
const VERSION='1.0.133-hub-recovery-ui-v1';
if(globalThis.CivweaveHubRecoveryUiV1?.version===VERSION)return;
const api=()=>globalThis.CivweaveHubRecoveryApiV1||null;
const clean=(v,m=600)=>String(v??'').trim().slice(0,m);
let resuming=false;
function status(message,state='info'){const node=document.getElementById('cw-hub-recovery-status');if(node){node.textContent=message;node.dataset.state=state}}
function step(name){for(const node of document.querySelectorAll('[data-cw-recovery-step]'))node.hidden=node.dataset.cwRecoveryStep!==name}
function masked(value){return clean(value,320).replace(/^(.{1,2}).*(@.*)$/,'$1••••$2')}
function styles(){
 if(document.getElementById('cw-hub-recovery-style-v1'))return;const s=document.createElement('style');s.id='cw-hub-recovery-style-v1';s.textContent=`
 .cw-hub-recovery{margin-top:14px;padding:15px;border:1px solid #8de5ef36;border-radius:18px;background:#06111cc7;color:#f7fbff}.cw-hub-recovery summary{cursor:pointer;font:900 .82rem system-ui;color:#dff8ff}.cw-hub-recovery p{margin:8px 0;color:#bcd0db;font:.76rem/1.45 system-ui}.cw-hub-recovery-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:10px}.cw-hub-recovery input{min-width:min(100%,260px);flex:1 1 220px;min-height:42px;padding:8px 10px;border:1px solid #ffffff2c;border-radius:11px;background:#09141f;color:#fff;font:800 .82rem system-ui}.cw-hub-recovery button{min-height:42px;padding:8px 13px;border:1px solid #8de5ef66;border-radius:11px;background:#123647;color:#fff;font:900 .78rem system-ui;cursor:pointer}.cw-hub-recovery-status[data-state="ok"]{color:#9cf3ca}.cw-hub-recovery-status[data-state="error"]{color:#ffd08a}.cw-hub-recovery-note{font-size:.7rem!important;color:#91a8b5!important}`;document.head.append(s)
}
function build(){
 const host=document.getElementById('cw-host-node-lobby');if(!host)return null;let root=document.getElementById('cw-hub-recovery-panel');if(root)return root;
 root=document.createElement('details');root.id='cw-hub-recovery-panel';root.className='cw-hub-recovery';root.innerHTML=`<summary>Hub account & recovery</summary><p id="cw-hub-recovery-status" class="cw-hub-recovery-status" role="status">Use a verified email so this Hub account can be recovered on another device.</p>
 <section data-cw-recovery-step="enroll"><div class="cw-hub-recovery-row"><input id="cw-hub-recovery-email" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com"><button id="cw-hub-recovery-save" type="button">Use this recovery email</button></div><p class="cw-hub-recovery-note">Email stays in the Hub account layer. It is not written into your Passport or exposed to FellowFare.</p><button id="cw-hub-recovery-start" type="button">I need to recover this account</button></section>
 <section data-cw-recovery-step="verify" hidden><p>Paste the one-time verification code from your email.</p><div class="cw-hub-recovery-row"><input id="cw-hub-verify-code" autocomplete="one-time-code" placeholder="Verification code"><button id="cw-hub-verify-submit" type="button">Verify email</button></div></section>
 <section data-cw-recovery-step="request" hidden><p>Enter the email used with this Hub.</p><div class="cw-hub-recovery-row"><input id="cw-hub-recover-email" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com"><button id="cw-hub-recover-request" type="button">Send recovery code</button></div><button id="cw-hub-recovery-back" type="button">Back</button></section>
 <section data-cw-recovery-step="complete" hidden><p>Paste the one-time recovery code from your email.</p><div class="cw-hub-recovery-row"><input id="cw-hub-recover-code" autocomplete="one-time-code" placeholder="Recovery code"><button id="cw-hub-recover-complete" type="button">Recover this Hub account</button></div></section>`;
 host.append(root);bind(root);refresh();return root
}
function refresh(){const mail=api()?.email?.()||'';const input=document.getElementById('cw-hub-recovery-email');if(input&&!input.value)input.value=mail}
async function enroll(){try{const packet=await api()?.enroll?.();if(!packet)return;const delivery=packet.delivery||{};if(packet.account?.emailVerified){status('Email recovery is verified for this Hub account.','ok');step('enroll')}else if(delivery.sent){status('Verification sent. Paste the code from your email to finish setup.','ok');step('verify');document.getElementById('cw-hub-recovery-panel')?.setAttribute('open','')}else{status('This Hub saved the recovery email, but its email delivery transport is not configured yet.','error')}}catch(error){status(`Recovery setup could not finish: ${error.message}`,'error')}}
async function verify(){try{await api()?.verify?.(document.getElementById('cw-hub-verify-code')?.value);status('Recovery email verified. This Hub account can now be recovered on another device.','ok');step('enroll')}catch(error){status(`Verification failed: ${error.message}`,'error')}}
async function requestRecovery(){try{const packet=await api()?.requestRecovery?.(document.getElementById('cw-hub-recover-email')?.value);status(packet?.message||'If that email is verified here, a recovery code has been sent.','ok');step('complete')}catch(error){status(`Recovery request failed: ${error.message}`,'error')}}
async function complete(){try{const packet=await api()?.complete?.(document.getElementById('cw-hub-recover-code')?.value);const count=packet?.passportIds?.length||0;status(`Hub access recovered${count?` with ${count} linked Passport ID${count===1?'':'s'}`:''}. Logging in…`,'ok');step('enroll');resuming=true;try{await globalThis.CivweaveHostNodeInstallerLobbyV1?.joinHostNode?.()}finally{resuming=false}}catch(error){status(`Recovery failed: ${error.message}`,'error')}}
function bind(root){
 root.querySelector('#cw-hub-recovery-save')?.addEventListener('click',()=>{try{const mail=api()?.saveEmail?.(root.querySelector('#cw-hub-recovery-email')?.value);status(`Recovery email saved (${masked(mail)}). Join this Hub to send verification.`,'ok')}catch(error){status(error.message,'error')}});
 root.querySelector('#cw-hub-recovery-start')?.addEventListener('click',()=>step('request'));root.querySelector('#cw-hub-recovery-back')?.addEventListener('click',()=>step('enroll'));root.querySelector('#cw-hub-verify-submit')?.addEventListener('click',verify);root.querySelector('#cw-hub-recover-request')?.addEventListener('click',requestRecovery);root.querySelector('#cw-hub-recover-complete')?.addEventListener('click',complete)
}
function intercept(event){const button=event.target?.closest?.('#cw-host-node-join');if(!button||resuming||button.dataset?.mode==='search'||!api()?.needsEmail?.())return;event.preventDefault();event.stopImmediatePropagation();const root=build();if(root)root.open=true;step('enroll');status('Add a recovery email before creating this Hub account. It stays separate from your Passport.');document.getElementById('cw-hub-recovery-email')?.focus()}
function observe(){if(build())return;const watcher=new MutationObserver(()=>{if(build())watcher.disconnect()});watcher.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>watcher.disconnect(),15000)}
function boot(){styles();observe();document.addEventListener('click',intercept,true);addEventListener('civweave:host-node-logged-in',enroll);addEventListener('civweave:host-node-selected',refresh)}
if(document.readyState==='loading')addEventListener('DOMContentLoaded',boot,{once:true});else boot();
globalThis.CivweaveHubRecoveryUiV1=Object.freeze({version:VERSION,build,refresh});
})();
