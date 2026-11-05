import test from 'node:test';
import assert from 'node:assert/strict';
import {createMeeting,appendMeetingEvent} from '../lib/starling-meeting-operations.mjs';
import {createMeetingRepository,meetingSummary} from '../lib/starling-meeting-records.mjs';

const make=()=>createMeeting({meetingId:'m1',guildId:'g1',createdBy:'human:k',participants:[
{id:'human:k',kind:'human',role:'guildkeeper'},{id:'agent:m',kind:'agent',role:'agent'}]});
const event=(id,type,actorId,payload)=>({id,type,actorId,at:'2026-11-05T12:00:00.000Z',payload});
function storage() {const map=new Map();return {
getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};}

test('save/load is scoped to Guild and returns defensive copies',()=>{
const store=createMeetingRepository(storage());
const created=make();
assert.equal(store.save(created,{expectedRevision:0}).revision,1);
const loaded=store.load('g1','m1');
assert.equal(loaded.revision,1);
loaded.meeting.events.push({type:'forged'});
assert.equal(store.load('g1','m1').meeting.events.length,0);
assert.equal(store.load('g2','m1'),null);
});

test('stale or divergent writes fail closed instead of merging histories',()=>{
const store=createMeetingRepository(storage());
const m=make();store.save(m,{expectedRevision:0});
const changed=appendMeetingEvent(m,event('p','decision.proposed','agent:m',{decisionId:'d',title:'Plan'}));
store.save(changed,{expectedRevision:1});
assert.throws(()=>store.save(m,{expectedRevision:1}),/conflict/i);
assert.throws(()=>store.save(changed,{expectedRevision:0}),/conflict/i);
assert.equal(store.load('g1','m1').revision,2);
});

test('summary separates proposed work, approved decisions and pending handoffs from verified completion',()=>{
let m=make();
m=appendMeetingEvent(m,event('p','decision.proposed','agent:m',{decisionId:'d1',title:'Build space'}));
m=appendMeetingEvent(m,event('s','speech.committed','agent:m',{turnId:'t1',text:'I propose a space'}));
m=appendMeetingEvent(m,event('a','decision.approved','human:k',{decisionId:'d1'}));
m=appendMeetingEvent(m,event('h','quest.handoff','human:k',{decisionId:'d1',questId:'q1',ownerId:'agent:m'}));
const summary=meetingSummary(m);
assert.equal(summary.speakingTurns,1);
assert.deepEqual(summary.approvedDecisions.map(d=>d.decisionId),['d1']);
assert.equal(summary.pendingHandoffs.length,1);
assert.equal(summary.verifiedQuestCompletions,0);
assert.equal(summary.transcriptIsComplete,false);
});
