import test from 'node:test';
import assert from 'node:assert/strict';
import {createMeeting} from '../lib/starling-meeting-operations.mjs';
import {createMeetingRepository} from '../lib/starling-meeting-records.mjs';
import {createMeetingRecorder} from '../public/app/shared/starling-meeting-recorder-v1.mjs';
function storage(){const d=new Map();return {getItem:k=>d.get(k)??null,setItem:(k,v)=>d.set(k,v),removeItem:k=>d.delete(k)}}
const seed=()=>createMeeting({meetingId:'test-rehearsal',guildId:'test-local',createdBy:'host',participants:[{id:'host',kind:'human',role:'guildkeeper'},{id:'agent',kind:'agent',role:'agent'}]});
test('recorder stays off until consent; stores only complete spoken turns',()=>{
 const repo=createMeetingRepository(storage());
 const rec=createMeetingRecorder({repository:repo,meeting:seed(),makeId:()=> 'id-1'});
 assert.equal(rec.recordTurn({speakerId:'agent',text:'private',spoken:true}),false);
 rec.enable();
 assert.equal(rec.recordTurn({speakerId:'agent',text:'draft',spoken:false}),false);
 assert.equal(rec.recordTurn({speakerId:'agent',text:'spoken',spoken:true,turnId:'turn-1'}),true);
 assert.equal(rec.recordTurn({speakerId:'agent',text:'replay',spoken:true,turnId:'turn-1'}),false);
 assert.equal(rec.snapshot().transcript.length,1);
 rec.disable();
 assert.equal(rec.recordTurn({speakerId:'host',text:'off',spoken:true}),false);
 assert.equal(repo.load('test-local','test-rehearsal').meeting.events.length,1);
});
test('recorder can append an agenda and produce an offline markdown report',()=>{
 const rec=createMeetingRecorder({repository:createMeetingRepository(storage()),meeting:seed(),makeId:()=>Math.random().toString(36).slice(2)});
 rec.enable();rec.setAgenda(['Opening','Decisions']);
 assert.deepEqual(rec.snapshot().agenda,['Opening','Decisions']);
 assert.match(rec.markdown(),/Opening/);
});
