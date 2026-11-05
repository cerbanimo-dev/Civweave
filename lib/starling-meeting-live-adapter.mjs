import {appendMeetingEvent,projectMeeting} from './starling-meeting-operations.mjs';

/**
 * Thread 2 -> Thread 5 boundary.
 *
 * Caller MUST derive authorizedParticipantIds from its authenticated session,
 * never from the model message. It MUST pass recordingEnabled only after the
 * local meeting's transcript recording consent/policy has been established.
 * This adapter is an offline pure mapper, NOT an authentication mechanism.
 */
export function ingestCommittedTurn(meeting,turn,context={}) {
  projectMeeting(meeting);
  if (context.recordingEnabled!==true) return meeting;
  if (!turn || typeof turn!=='object') throw new TypeError('turn required');
  if (turn.meetingId!==meeting.meetingId) throw new Error('meeting mismatch');
  if (!Array.isArray(context.authorizedParticipantIds) ||
      !context.authorizedParticipantIds.includes(turn.participantId) ||
      !meeting.participants.some(p=>p.id===turn.participantId))
    throw new Error('participant not authenticated');
  // An interim voice fragment, a silent model thought, an interrupted
  // draft, or a reaction without the speaking floor must not be recorded.
  if (turn.stage!=='committed' || turn.spoken!==true || turn.floorGranted!==true)
    return meeting;
  return appendMeetingEvent(meeting,{
    id:turn.eventId,
    type:'speech.committed',
    actorId:turn.participantId,
    at:turn.at,
    payload:{turnId:turn.turnId,text:turn.text}
  });
}
