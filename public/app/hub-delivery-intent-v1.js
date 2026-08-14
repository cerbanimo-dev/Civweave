(()=>{
'use strict';
function openDelivery(delivery){
 if(delivery?.transport!=='inbound-email-proof'||!String(delivery?.mailto||'').startsWith('mailto:'))return false;
 try{sessionStorage.setItem('civweave.hub-delivery-intent.v1',JSON.stringify({purpose:String(delivery.subject||'').includes(' recover-account ')?'recover-account':'verify-email',token:String(delivery.proofToken||''),mailto:String(delivery.mailto||'')}))}catch{}
 setTimeout(()=>{location.href=delivery.mailto},120);return true
}
function showCodeStep(){for(const node of document.querySelectorAll('[data-cw-recovery-step]'))node.hidden=node.dataset.cwRecoveryStep!=='complete'}
async function requestFromPanel(event){
 const button=event.target?.closest?.('#cw-hub-recover-request');if(!button)return;
 event.preventDefault();event.stopImmediatePropagation();
 try{const packet=await globalThis.CivweaveHubRecoveryApiV1?.requestRecovery?.(document.getElementById('cw-hub-recover-email')?.value);if(!openDelivery(packet?.delivery))showCodeStep()}catch(error){const status=document.getElementById('cw-hub-recovery-status');if(status)status.textContent=`Recovery request failed: ${error?.message||error}`}
}
addEventListener('civweave:hub-account-enrolled',event=>openDelivery(event.detail?.delivery));
document.addEventListener('click',requestFromPanel,true);
globalThis.CivweaveHubDeliveryIntentV1=Object.freeze({openDelivery});
})();
