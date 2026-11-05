import test from 'node:test';
import assert from 'node:assert/strict';
import {createMeeting,projectMeeting} from '../lib/starling-meeting-operations.mjs';
import {ingestCommittedTurn} from '../lib/starling-meeting-live-adapter.mjs';

const meeting=()=>createMeeting({meetingId:'room-1',guildId:'g1',createdBy:'human:keeper',participants:[
{id:'human:keeper',kind:'human',role:'guildkeeper'},
{id:'agent:mica',kind:'agent',role:'agent'}
]});
const turn=(extra={})=>({
meetingId:'room-1',eventId:'evt1',turnId:'t1',participantId:'agent:mica',
at:'2026-11-05T12:00:00.000Z',stage:'committed',floorGranted:true,spoken:true,
text:'Hello everyone',...extra
});
const authorized={recordingEnabled:true,authorizedParticipantIds:['agent:mica']};
test('records a final spoken turn exactly once',()=>{
let m=ingestCommittedTurn(meeting(),turn(),authorized);
m=ingestCommittedTurn(m,turn(),authorized);
assert.equal(projectMeeting(m).transcript.length,1);
assert.equal(projectMeeting(m).transcript[0].actorId,'agent:mica');
});
test('silence, internal thought, partial ASR, and floorless reactions never enter transcript',()=>{
for (const t of [turn({stage:'listening'}),turn({stage:'partial'}),turn({spoken:false}),turn({floorGranted:false})]) {
assert.equal(ingestCommittedTurn(meeting(),t,authorized).events.length,0);
}
});
test('recording consent defaults off and unauthorized actors are refused',()=>{
assert.equal(ingestCommittedTurn(meeting(),turn()).events.length,0);
assert.throws(()=>ingestCommittedTurn(meeting(),turn(),{...authorized,authorizedParticipantIds:[]}),/authenticated/i);
assert.throws(()=>ingestCommittedTurn(meeting(),turn({participantId:'agent:unlisted'}),authorized),/authenticated/i);
assert.throws(()=>ingestCommittedTurn(meeting(),turn({meetingId:'wrong'}),authorized),/meeting/i);
});
