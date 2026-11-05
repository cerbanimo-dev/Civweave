import test from 'node:test';
import assert from 'node:assert/strict';
import { createMeeting, appendMeetingEvent, projectMeeting, exportMeetingMarkdown } from '../lib/starling-meeting-operations.mjs';

const base = () => createMeeting({ meetingId:'meeting-1', guildId:'guild-1', createdBy:'human:keeper', participants:[
  {id:'human:keeper', kind:'human', role:'guildkeeper'},
  {id:'human:member', kind:'human', role:'member'},
  {id:'agent:mica', kind:'agent', role:'agent'}
]});
const event = (type, actorId, payload={}, id=type+'-'+actorId) => ({id,type,actorId,at:'2026-11-05T12:00:00.000Z',payload});

test('only committed speech is transcribed and duplicate events cannot replay', () => {
  let m=base();
  m=appendMeetingEvent(m,event('listening','agent:mica',{text:'internal thought'}));
  m=appendMeetingEvent(m,event('speech.committed','agent:mica',{text:'A proposal',turnId:'turn-1'}));
  m=appendMeetingEvent(m,event('speech.committed','agent:mica',{text:'Replay',turnId:'turn-1'},'another-id'));
  m=appendMeetingEvent(m,event('speech.committed','agent:mica',{text:'A proposal',turnId:'turn-1'}));
  assert.equal(projectMeeting(m).transcript.length,1);
  assert.equal(projectMeeting(m).transcript[0].text,'A proposal');
  assert.equal(m.events.length,2);
});

test('agent proposals and votes never approve execution', () => {
  let m=base();
  m=appendMeetingEvent(m,event('decision.proposed','agent:mica',{decisionId:'d1',title:'Build a room'}));
  assert.throws(()=>appendMeetingEvent(m,event('decision.approved','agent:mica',{decisionId:'d1'})),/permission/i);
  assert.throws(()=>appendMeetingEvent(m,event('quest.handoff','agent:mica',{decisionId:'d1',questId:'q1'})),/permission/i);
  assert.equal(projectMeeting(m).decisions[0].status,'proposed');
});

test('guildkeeper approval permits a handoff record, not automatic Quest creation', () => {
  let m=base();
  m=appendMeetingEvent(m,event('decision.proposed','agent:mica',{decisionId:'d1',title:'Prepare room'}));
  m=appendMeetingEvent(m,event('decision.approved','human:keeper',{decisionId:'d1'}));
  m=appendMeetingEvent(m,event('quest.handoff','human:keeper',{decisionId:'d1',questId:'q1',ownerId:'human:member'}));
  assert.equal(projectMeeting(m).decisions[0].status,'approved');
  assert.equal(projectMeeting(m).questHandoffs[0].status,'handoff-pending');
  assert.match(exportMeetingMarkdown(m),/Prepare room/);
});

test('unknown actors, agenda permissions, invalid timestamps, and missing decisions fail closed', () => {
  let m=base();
  assert.throws(()=>appendMeetingEvent(m,event('speech.committed','unknown',{text:'hello',turnId:'t'})),/participant/i);
  assert.throws(()=>appendMeetingEvent(m,event('agenda.updated','agent:mica',{items:['Hi']})),/permission/i);
  assert.throws(()=>appendMeetingEvent(m,{...event('speech.committed','human:member',{text:'Hello',turnId:'t'}),at:'invalid'}),/timestamp/i);
  assert.throws(()=>appendMeetingEvent(m,event('decision.approved','human:keeper',{decisionId:'missing'})),/decision/i);
  m=appendMeetingEvent(m,event('agenda.updated','human:keeper',{items:['Opening','Decision']})); 
  assert.deepEqual(projectMeeting(m).agenda,['Opening','Decision']);
});
