(()=>{
'use strict';
const PREFIX='journal:';
async function checkpoint(details={}){const session=details.session;if(!session?.id)throw new Error('Crash journal requires a creation session.');const record={id:`${PREFIX}${session.id}`,schema:'civweave.creator-crash-journal.v1',sessionId:session.id,kind:String(details.kind||session.mediaType||'unknown'),updatedAt:new Date().toISOString(),content:typeof details.content==='string'?details.content:'',contentDigest:String(details.contentDigest||''),recoverable:Boolean(details.recoverable!==false)};await globalThis.CivweaveCreatorStoreV1?.putArtifact(record);return record}
async function restore(sessionId){return globalThis.CivweaveCreatorStoreV1?.getArtifact(`${PREFIX}${sessionId}`)||null}
async function clear(sessionId){const store=globalThis.CivweaveCreatorStoreV1;if(store?.deleteArtifact)return store.deleteArtifact(`${PREFIX}${sessionId}`);return store?.putArtifact({id:`${PREFIX}${sessionId}`,schema:'civweave.creator-crash-journal.v1',sessionId,cleared:true,updatedAt:new Date().toISOString(),content:''})}
globalThis.CivweaveCreatorCrashJournalV1=Object.freeze({checkpoint,restore,clear});
})();
