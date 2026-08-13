(()=>{
'use strict';
const VERSION='1.0.0';
if(globalThis.CivweaveFellowFareSellerRecordExportV1?.version===VERSION)return;
const columns=['orderId','listingId','title','jurisdiction','amountMinor','taxability','rateBps','taxMinor','confirmedAt'];
const quote=v=>`"${String(v??'').replaceAll('"','""')}"`;
function snapshot(){const api=globalThis.CivweaveFellowFareTaxRecordsV1,records=api?.ledger?.().records||[];return Object.freeze({schema:'fellowfare.seller-record-export.v1',records,summary:api?.summary?.()||[],exportedAt:new Date().toISOString(),platformProcessedPayments:false})}
function csv(){return[columns.join(','),...snapshot().records.map(r=>columns.map(c=>quote(r[c])).join(','))].join('\n')}
globalThis.CivweaveFellowFareSellerRecordExportV1=Object.freeze({version:VERSION,snapshot,csv});
})();
