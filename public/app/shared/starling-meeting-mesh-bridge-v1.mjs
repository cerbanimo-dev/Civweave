import {projectMeeting} from './starling-meeting-operations-v1.mjs';

/**
 * Explicit human-controlled publishing adapter to the canonical signed mesh.
 * Callers must authenticate Guild membership, authorization, and consent.
 * This module does not expose transcripts, identifiers of private speakers,
 * or model drafts, and cannot certify delivery to another device.
 */
export async function publishMeetingSummary({
 meeting,mesh,audience,confirmed=false,authorizedGuildId,actorId
}={}){
 const projection=projectMeeting(meeting);
 if(confirmed!==true)throw new Error('Explicit human confirmation required');
 if(meeting.guildId!==authorizedGuildId)throw new Error('Guild scope mismatch');
 const actor=meeting.participants.find(p=>p.id===actorId);
 if(!actor || actor.kind!=='human' || actor.role!=='guildkeeper')
   throw new Error('Authorized human Guildkeeper required');
 if(!Array.isArray(audience)||!audience.length||audience.length>100||
    audience.some(id=>typeof id!=='string'||!/^device:[A-Za-z0-9:_-]{4,180}$/.test(id)))
   throw new TypeError('Valid direct device audience required');
 if(typeof mesh?.createObject!=='function')throw new TypeError('Canonical signed mesh required');
 const payload={
   schema:'civweave.starling.meeting-summary.v1',guildId:meeting.guildId,
   meetingId:meeting.meetingId,
   summary:{
     agenda:projection.agenda,
     speakingTurns:projection.transcript.length,
     decisions:projection.decisions.map(d=>({decisionId:d.decisionId,title:d.title,status:d.status})),
     pendingQuestHandoffs:projection.questHandoffs.map(h=>({decisionId:h.decisionId,questId:h.questId,status:'handoff-pending'})),
     transcriptIncluded:false,verifiedQuestCompletions:0,provenance:'device-local-unverified'
   }
 };
 const object=await mesh.createObject({
   kind:'civweave.starling.meeting-summary.v1',purpose:'Human-approved meeting summary (no transcript)',
   consent:'direct',audience:[...new Set(audience)],payload,
   publish:true,hopLimit:1,priority:80,
   expiresAt:new Date(Date.now()+7*86400000).toISOString()
 });
 if(!object?.signature||!object?.revisionHash)throw new Error('Signed mesh object not confirmed');
 return {id:object.id,revisionHash:object.revisionHash,status:'signed-queued-not-delivery-confirmed'};
}
