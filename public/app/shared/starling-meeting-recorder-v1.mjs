import {appendMeetingEvent,projectMeeting,exportMeetingMarkdown} from './starling-meeting-operations-v1.mjs';

export function createMeetingRecorder({repository,meeting,makeId=()=>crypto.randomUUID()}={}){
  if(!repository?.load||!repository?.save||!meeting)throw new TypeError('meeting repository and meeting required');
  const existing=repository.load(meeting.guildId,meeting.meetingId);
  let state=existing?.meeting||meeting,revision=existing?.revision||0,enabled=false;
  const id=()=>{const value=makeId();if(typeof value!=='string'||!value)throw new Error('event id required');return value};
  function commit(event){
    const next=appendMeetingEvent(state,event);
    if(next===state)return false;
    const saved=repository.save(next,{expectedRevision:revision});
    state=saved.meeting;revision=saved.revision;return true;
  }
  function recordTurn({speakerId,text,spoken,turnId}={}){
    if(!enabled||spoken!==true||typeof text!=='string'||!text.trim())return false;
    if(!state.participants.some(p=>p.id===speakerId))throw new Error('unknown meeting participant');
    return commit({id:id(),type:'speech.committed',actorId:speakerId,at:new Date().toISOString(),
      payload:{turnId:turnId||id(),text}});
  }
  function setAgenda(items){
    if(!enabled)throw new Error('recording disabled');
    return commit({id:id(),type:'agenda.updated',actorId:state.createdBy,at:new Date().toISOString(),payload:{items}});
  }
  return Object.freeze({
    enable(){enabled=true;return true},
    disable(){enabled=false},
    isEnabled:()=>enabled,
    recordTurn,setAgenda,
    snapshot:()=>projectMeeting(state),
    markdown:()=>exportMeetingMarkdown(state),
    meeting:()=>JSON.parse(JSON.stringify(state))
  });
}
