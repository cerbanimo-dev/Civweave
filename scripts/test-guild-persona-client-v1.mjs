import test from 'node:test';
import assert from 'node:assert/strict';
import {createGuildPersonaClient} from '../public/app/shared/guild-persona-client-v1.mjs';
const member={origin:'https://guild.example.test',nodeId:'fictional-guild',
 userId:'fictional-member',token:'abc123DEF456_fooBAR.baz789xyz0'};
const pack={id:'private-source',version:3,characters:[
 {id:'landry',name:'Landry',voice:'SECRET PRIVATE DIRECTOR INFO',privateMemories:['SECRET SPOILER']},
 {id:'delia',name:'Delia',voice:'SECRET AUTHOR-ONLY TRAIT'}]};
const room={schema:'civweave.persona-campaign.v1',id:'room:abc',ownerId:'member:fictional-member',
 packId:'private-source',packVersion:3,branchId:'what-if:abc',scenario:'A hallway',
 stage:2,cast:['landry','delia'],revision:0,turn:0,events:[],seats:{},pilots:{},
 willpower:{points:2,max:2,renewEvery:4,lastRenewedTurn:0}};
test('explicit Guild hosting sends only selected cast ID/name and scene, never unpublished persona traits',async()=>{
 const requests=[];
 const client=createGuildPersonaClient({getSession:async()=>member,send:async(url,options)=>{
  requests.push({url:String(url),options});
  return Response.json({ok:true,schema:'civweave.guild-persona-room.v1',
    serverAuthoritative:true,room});
 }});
 await assert.rejects(()=>client.create({pack,cast:['landry','delia'],
  stage:2,scenario:'A hallway'}),/consent/i);
 assert.equal(requests.length,0);
 const output=await client.create({pack,cast:['landry','delia'],
  stage:2,scenario:'A hallway',confirmedShare:true});
 assert.equal(output.room.id,'room:abc');
 const text=requests[0].options.body;
 assert.doesNotMatch(text,/SECRET|privateMemories|voice|events|source/i);
 assert.match(text,/"packId":"private-source"/);
 assert.equal(requests[0].options.credentials,'omit');
 assert.match(requests[0].options.headers.authorization,/^Bearer /);
});
test('member-scoped requests are never silently replayed after revision conflict',async()=>{
 let calls=0;
 const client=createGuildPersonaClient({getSession:async()=>member,send:async()=>{
  calls++;return Response.json({ok:false,error:'Revision conflict'}, {status:409});
 }});
 await assert.rejects(()=>client.dispatch('room:abc',0,{type:'player-cue',text:'I speak'}),/revision conflict/i);
 assert.equal(calls,1);
});
test('responses for mismatched room IDs are rejected',async()=>{
 const client=createGuildPersonaClient({getSession:async()=>member,send:async()=>
  Response.json({ok:true,schema:'civweave.guild-persona-room.v1',
   serverAuthoritative:true,room})});
 await assert.rejects(()=>client.snapshot('room:other'),/different campaign/i);
});
