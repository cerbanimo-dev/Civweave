import test from 'node:test';
import assert from 'node:assert/strict';
import {createMeeting,appendMeetingEvent} from '../lib/starling-meeting-operations.mjs';
import {publishMeetingSummary} from '../public/app/shared/starling-meeting-mesh-bridge-v1.mjs';
const event=(id,type,actorId,payload)=>({id,type,actorId,at:'2026-11-05T12:00:00.000Z',payload});
function meeting(){let m=createMeeting({meetingId:'m',guildId:'g',createdBy:'host',participants:[{id:'host',kind:'human',role:'guildkeeper'},{id:'agent',kind:'agent',role:'agent'}]});m=appendMeetingEvent(m,event('speech','speech.committed','agent',{text:'PRIVATE TURN',turnId:'one'}));return m;}
test('publish requires human-confirmed scope and never sends transcript',async()=>{
 let writes=[];const mesh={createObject:async input=>{writes.push(input);return {id:'signed',signature:'sig',revisionHash:'sha'}}};
 const m=meeting();
 await assert.rejects(publishMeetingSummary({meeting:m,mesh,audience:['device:peer-one']}),/confirmation/i);
 await assert.rejects(publishMeetingSummary({meeting:m,mesh,audience:[],confirmed:true,authorizedGuildId:'g',actorId:'host'}),/audience/i);
 assert.equal(writes.length,0);
 await publishMeetingSummary({meeting:m,mesh,audience:['device:peer-one'],confirmed:true,authorizedGuildId:'g',actorId:'host'});
 assert.equal(writes.length,1);
 assert.equal(writes[0].consent,'direct');
 assert.equal(writes[0].publish,true);
 assert.equal(JSON.stringify(writes[0]).includes('PRIVATE TURN'),false);
 assert.equal(writes[0].payload.summary.speakingTurns,1);
});
test('wrong Guild, agent, or missing signed mesh rejects',async()=>{
 const m=meeting(),mesh={createObject:async()=>({signature:'s',revisionHash:'h'})};
 await assert.rejects(publishMeetingSummary({meeting:m,mesh,audience:['device:peer-one'],confirmed:true,authorizedGuildId:'other',actorId:'host'}),/Guild/i);
 await assert.rejects(publishMeetingSummary({meeting:m,mesh,audience:['device:peer-one'],confirmed:true,authorizedGuildId:'g',actorId:'agent'}),/human/i);
 await assert.rejects(publishMeetingSummary({meeting:m,mesh:{},audience:['device:peer-one'],confirmed:true,authorizedGuildId:'g',actorId:'host'}),/mesh/i);
});
