(()=>{
'use strict';
let pocketPromise=null;
const clean=(value,max=500)=>String(value??'').trim().slice(0,max);
async function pocket(){if(globalThis.CivweavePocketGuildNodeV1)return globalThis.CivweavePocketGuildNodeV1;if(!pocketPromise)pocketPromise=import('/app/pocket-guild-node-v1.mjs').then(module=>module.CivweavePocketGuildNodeV1||globalThis.CivweavePocketGuildNodeV1).catch(error=>{pocketPromise=null;throw error});return pocketPromise}
async function publishReceipt(receipt={}){if(receipt?.schema!=='civweave.creation-receipt.v1')throw new Error('A finalized Creator creation receipt is required.');const owner=await pocket(),state=owner?.state?.();if(!state?.guildId)return{shared:false,reason:'not-enrolled-in-guild'};const guildId=clean(state.guildId,180),mesh=globalThis.CivweaveCreatorMeshProvenanceV1;if(!mesh?.commitReceipt)throw new Error('Creator signed receipt transport is unavailable.');const object=await mesh.commitReceipt(receipt,{id:`creation-receipt-guild:${guildId}:${clean(receipt.sessionId,240)}:${clean(receipt.headHash,128)}`,consent:'group',audience:[`guild:${guildId}`],publish:true,hopLimit:8});if(state.primaryOrigin)queueMicrotask(()=>owner.syncPrimary?.().catch?.(()=>{}));try{dispatchEvent(new CustomEvent('creator-suite:guild-receipt-shared',{detail:{guildId,receiptHash:receipt.receiptHash,objectId:object.id,cloudAttached:Boolean(state.primaryOrigin)}}))}catch{}return{shared:true,guildId,object,cloudAttached:Boolean(state.primaryOrigin)}}
globalThis.CivweaveCreatorGuildProvenanceV1=Object.freeze({publishReceipt,pocket});
})();
