(()=>{
'use strict';
function openDelivery(delivery){
 if(delivery?.transport!=='inbound-email-proof'||!String(delivery?.mailto||'').startsWith('mailto:'))return false;
 setTimeout(()=>{location.href=delivery.mailto},120);return true
}
addEventListener('civweave:hub-account-enrolled',event=>openDelivery(event.detail?.delivery));
globalThis.CivweaveHubDeliveryIntentV1=Object.freeze({openDelivery});
})();
