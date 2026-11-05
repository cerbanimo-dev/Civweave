import {projectMeeting} from './starling-meeting-operations.mjs';

/** Stable, narrow cross-owner link. This module never creates or mutates Quests. */
export function questHandoffSourceId(meetingId,decisionId,requestId) {
  for (const value of [meetingId,decisionId,requestId]) {
    if (typeof value!=='string' || !/^[a-zA-Z0-9:_-]{1,100}$/.test(value))
      throw new TypeError('invalid Quest handoff identifier');
  }
  const value=`starling:${meetingId}:${decisionId}:${requestId}`;
  if (value.length>160) throw new TypeError('Quest source ID exceeds canonical engine limit');
  return value;
}

/**
 * Read-only reconciliation with CivweaveCerbanimoQuestV144.readState().
 * The trusted canonical Quest engine is the sole authority on existence/status.
 * The caller is responsible for checking that the engine is the authorized
 * local Guild context; an unrelated account's Quest ledger is not evidence.
 */
export function reconcileQuestHandoffs(meeting,questEngine) {
  const projected=projectMeeting(meeting);
  if (typeof questEngine?.readState!=='function') throw new TypeError('canonical Quest engine required');
  const state=questEngine.readState();
  if (!Array.isArray(state?.quests)) throw new TypeError('canonical Quest state unavailable');
  return projected.questHandoffs.map(handoff=>{
    const sourceId=questHandoffSourceId(meeting.meetingId,handoff.decisionId,handoff.questId);
    const candidates=state.quests.filter(q=>q && q.sourceActionId===sourceId && typeof q.id==='string' && q.id);
    const base={...handoff,sourceActionId:sourceId,canonicalQuestId:null,verifiedCompletion:false};
    if (candidates.length>1) return {...base,status:'conflict'};
    if (!candidates.length) return {...base,status:'handoff-pending'};
    return {...base,status:'confirmed',canonicalQuestId:candidates[0].id,verifiedCompletion:candidates[0].status==='completed'};
  });
}
