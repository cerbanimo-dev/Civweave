import {projectMeeting} from './starling-meeting-operations.mjs';

const PREFIX='civweave.starling.meetings.v1.';
const copy=value=>JSON.parse(JSON.stringify(value));
const key=(guildId,meetingId)=>{
  if(![guildId,meetingId].every(x=>typeof x==='string' && /^[a-zA-Z0-9:_-]{1,120}$/.test(x)))
    throw new TypeError('invalid meeting storage key');
  // Length delimiters make tuple encoding unambiguous.
  return PREFIX+guildId.length+':'+guildId+meetingId.length+':'+meetingId;
};
function validateMeeting(meeting) {
  projectMeeting(meeting);
  key(meeting.guildId,meeting.meetingId);
  if(!Array.isArray(meeting.events) || meeting.events.length>50000)
    throw new TypeError('invalid meeting event history');
  if(!Array.isArray(meeting.participants) || meeting.participants.length>500)
    throw new TypeError('invalid meeting roster');
  return meeting;
}

/**
 * Device-local revision storage, NOT distributed mesh conflict resolution.
 * Inject a trusted synchronous storage object implementing getItem/setItem.
 * Callers must serialise saves per meeting on a device; cross-device changes
 * must pass through the canonical signed mesh and never be field-merged here.
 */
export function createMeetingRepository(storage) {
  if(!storage || typeof storage.getItem!=='function' || typeof storage.setItem!=='function')
    throw new TypeError('storage adapter required');
  function load(guildId,meetingId) {
    const raw=storage.getItem(key(guildId,meetingId));
    if(raw===null || raw===undefined) return null;
    const record=JSON.parse(raw);
    if(record?.schema!=='civweave.starling.meeting-record.v1' ||
       !Number.isSafeInteger(record.revision) || record.revision<1 ||
       record.meeting?.guildId!==guildId || record.meeting?.meetingId!==meetingId)
      throw new Error('corrupt meeting record');
    validateMeeting(record.meeting);
    return copy({revision:record.revision,meeting:record.meeting});
  }
  function save(meeting,{expectedRevision}={}) {
    validateMeeting(meeting);
    if(!Number.isSafeInteger(expectedRevision) || expectedRevision<0)
      throw new TypeError('expectedRevision required');
    const existing=load(meeting.guildId,meeting.meetingId);
    if((existing?.revision??0)!==expectedRevision)
      throw new Error('meeting revision conflict; preserve both histories for manual reconciliation');
    const record={schema:'civweave.starling.meeting-record.v1',revision:expectedRevision+1,meeting:copy(meeting)};
    storage.setItem(key(meeting.guildId,meeting.meetingId),JSON.stringify(record));
    return copy({revision:record.revision,meeting:record.meeting});
  }
  return {load,save};
}

/** Conservative deterministic summary. No model-generated conclusions. */
export function meetingSummary(meeting) {
  validateMeeting(meeting);
  const projected=projectMeeting(meeting);
  return {
    meetingId:meeting.meetingId,
    guildId:meeting.guildId,
    speakingTurns:projected.transcript.length,
    agenda:copy(projected.agenda),
    openProposals:copy(projected.decisions.filter(d=>d.status==='proposed')),
    approvedDecisions:copy(projected.decisions.filter(d=>d.status==='approved')),
    rejectedDecisions:copy(projected.decisions.filter(d=>d.status==='rejected')),
    pendingHandoffs:copy(projected.questHandoffs),
    verifiedQuestCompletions:0,
    transcriptIsComplete:false,
    provenance:'deterministic-local-projection;unverified'
  };
}
