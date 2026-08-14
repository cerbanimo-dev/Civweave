(()=>{
'use strict';
function status(text){const node=document.getElementById('cw-hub-recovery-status');if(node)node.textContent=text}
function openDelivery(delivery){
 if(delivery?.transport!=='inbound-email-proof'||!String(delivery?.mailto||'').startsWith('mailto:'))return false;
 setTimeout(()=>{location.href=delivery.mailto},120);return true
}
function showCodeStep(){for(const node of document.querySelectorAll('[data-cw-recovery-step]'))node.hidden=node.dataset.cwRecoveryStep!=='complete'}
async function requestFromPanel(event){
 const button=event.target?.closest?.('#cw-hub-recover-request');if(!button)return;
 event.preventDefault();event.stopImmediatePropagation();
 try{const packet=await globalThis.CivweaveHubRecoveryApiV1?.requestRecovery?.(document.getElementById('cw-hub-recover-email')?.value);const inbound=openDelivery(packet?.delivery);showCodeStep();if(inbound)status('Send the prefilled email from your recovery address, then return and paste the one-time code from that message.')}catch(error){status(`Recovery request failed: ${error?.message||error}`)}
}
addEventListener('civweave:hub-account-enrolled',event=>{if(openDelivery(event.detail?.delivery))status('Send the prefilled email from your recovery address, then return and paste its one-time verification code.')});
document.addEventListener('click',requestFromPanel,true);
globalThis.CivweaveHubDeliveryIntentV1=Object.freeze({openDelivery});
})();
