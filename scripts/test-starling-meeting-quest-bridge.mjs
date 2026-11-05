import test from 'node:test';
import assert from 'node:assert/strict';
import {createMeeting,appendMeetingEvent} from '../lib/starling-meeting-operations.mjs';
import {reconcileQuestHandoffs} from '../lib/starling-meeting-quest-bridge.mjs';
const event=(id,type,actorId,payload)=>({id,type,actorId,at:'2026-11-05T12:00:00.000Z',payload});
function meeting(){
  let m=createMeeting({meetingId:'meeting-one',guildId:'guild-one',createdBy:'human:keeper',participants:[{id:'human:keeper',kind:'human',role:'guildkeeper'},{id:'agent:mica',kind:'agent',role:'agent'}]});
  m=appendMeetingEvent(m,event('p','decision.proposed','agent:mica',{decisionId:'d1',title:'Make stage'}));
  m=appendMeetingEvent(m,event('a','decision.approved','human:keeper',{decisionId:'d1'}));
  return appendMeetingEvent(m,event('h','quest.handoff','human:keeper',{decisionId:'d1',questId:'q1',ownerId:'agent:mica'}));
}
const engine=quests=>({readState:()=>({quests})});
test('only matching canonical Quest source ID confirms handoff',()=>{
  const status=reconcileQuestHandoffs(meeting(),engine([{id:'canonical-1',sourceActionId:'starling:meeting-one:d1:q1',status:'active'}]));
  assert.equal(status[0].status,'confirmed');
  assert.equal(status[0].canonicalQuestId,'canonical-1');
  assert.equal(status[0].verifiedCompletion,false);
});
test('completed canonical Quest is the only verified completion claim',()=>{
 const status=reconcileQuestHandoffs(meeting(),engine([{id:'canonical-1',sourceActionId:'starling:meeting-one:d1:q1',status:'completed'}]));
 assert.equal(status[0].verifiedCompletion,true);
});
test('missing, conflicting, and unverifiable canonical evidence fails closed',()=>{
 assert.equal(reconcileQuestHandoffs(meeting(),engine([]))[0].status,'handoff-pending');
 assert.equal(reconcileQuestHandoffs(meeting(),engine([{id:'wrong',sourceActionId:'other',status:'completed'}]))[0].verifiedCompletion,false);
 assert.equal(reconcileQuestHandoffs(meeting(),engine([{id:'one',sourceActionId:'starling:meeting-one:d1:q1',status:'completed'},{id:'two',sourceActionId:'starling:meeting-one:d1:q1',status:'completed'}]))[0].status,'conflict');
 assert.throws(()=>reconcileQuestHandoffs(meeting(),{}),/Quest engine/i);
});
