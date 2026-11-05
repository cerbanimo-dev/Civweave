import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMeetingContext,proposeMeetingTurn,acceptSpeechProposal} from '../tools/starling/meeting-model-bridges-v1.mjs';

const meetingId='guild-meeting-1',participantId='moss';
const grant=()=>({meetingId,participantId,capability:'propose',expiresAt:Date.now()+10000});
const speech=()=>({meetingId,participantId,capability:'speak',expiresAt:Date.now()+10000,id:'turn-1'});
const events=[
  {role:'user',visibility:'public',text:'Discuss agenda'},
  {role:'user',visibility:'private',text:'PRIVATE SECRET'},
  {role:'assistant',visibility:'participant',recipientId:'moss',text:'Moss notes'},
  {role:'assistant',visibility:'participant',recipientId:'merlin',text:'Merlin notes'}
];
const base={meetingId,participantId,grant:grant(),events,prompt:'What should we do next?'};
const trusted={verifyProposalGrant:async()=>true};
const controlled={verifySpeechGrant:async()=>true};
test('context excludes private and other-participant events',()=>{
  assert.deepEqual(normalizeMeetingContext(events,'moss').map(m=>m.content),['Discuss agenda','Moss notes']);
});
test('OpenAI bridge creates proposal without speaking',async()=>{
  let body,headers;
  const proposal=await proposeMeetingTurn({...base,provider:'openai',config:{model:'gpt-4.1-mini',apiKey:'test',externalConsent:true}},{
    ...trusted,fetchImpl:async(url,init)=>{
      assert.equal(url,'https://api.openai.com/v1/chat/completions');
      body=JSON.parse(init.body);headers=init.headers;
      return {ok:true,json:async()=>({choices:[{message:{content:'Agenda proposal'}}]})};
    }});
  assert.equal(headers.Authorization,'Bearer test');
  assert.equal(body.messages.some(m=>m.content.includes('PRIVATE SECRET')),false);
  assert.equal(proposal.kind,'speech_proposal');
  assert.equal(proposal.requiresSpeechGrant,true);
  await assert.rejects(acceptSpeechProposal(proposal,{...speech(),participantId:'merlin'},controlled),{code:'SPEECH_DENIED'});
  assert.equal((await acceptSpeechProposal(proposal,speech(),controlled)).kind,'authorized_speech');
});
test('Gemini bridge uses native generateContent and consent',async()=>{
  let sent;
  const p=await proposeMeetingTurn({...base,provider:'gemini',config:{model:'gemini-2.5-flash',apiKey:'secret',externalConsent:true}},{
    ...trusted,fetchImpl:async(url,init)=>{sent={url,headers:init.headers,body:JSON.parse(init.body)};
      return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'Gemini proposal'}]}}]})};}});
  assert.match(sent.url,/gemini-2.5-flash:generateContent$/);
  assert.equal(sent.headers['x-goog-api-key'],'secret');
  assert.equal(p.text,'Gemini proposal');
});
test('local Qwen uses Ollama chat and never needs cloud consent',async()=>{
  let endpoint;
  const p=await proposeMeetingTurn({...base,provider:'local',config:{model:'qwen3.5:4b'}},{
    ...trusted,fetchImpl:async(url,init)=>{endpoint=url;assert.equal(JSON.parse(init.body).stream,false);
      return {ok:true,json:async()=>({message:{content:'Local proposal'}})};}});
  assert.equal(endpoint,'http://127.0.0.1:11434/api/chat');
  assert.equal(p.text,'Local proposal');
});
test('local llama.cpp OpenAI-compatible endpoint',async()=>{
  const p=await proposeMeetingTurn({...base,provider:'local',config:{model:'qwen35-4b-native',endpoint:'http://127.0.0.1:8080/v1/chat/completions'}},{
    ...trusted,fetchImpl:async()=>({ok:true,json:async()=>({choices:[{message:{content:'Termux model'}}]})})});
  assert.equal(p.text,'Termux model');
});
test('no generation without a valid grant or while silent',async()=>{
  const config={model:'qwen3.5:4b'};
  await assert.rejects(proposeMeetingTurn({...base,grant:null,provider:'local',config},trusted),{code:'NOT_AUTHORIZED'});
  await assert.rejects(proposeMeetingTurn({...base,silent:true,provider:'local',config},trusted),{code:'SILENT'});
  await assert.rejects(proposeMeetingTurn({...base,grant:{...grant(),expiresAt:0},provider:'local',config},trusted),{code:'NOT_AUTHORIZED'});
});
test('no implicit cloud opt-in or unapproved transport endpoints',async()=>{
  await assert.rejects(proposeMeetingTurn({...base,provider:'openai',config:{model:'gpt-4.1-mini',apiKey:'test'}},trusted),{code:'CONSENT_REQUIRED'});
  await assert.rejects(proposeMeetingTurn({...base,provider:'local',config:{model:'qwen3.5:4b',endpoint:'http://192.168.1.10:11434/api/chat'}},trusted),{code:'BAD_ENDPOINT'});
  await assert.rejects(proposeMeetingTurn({...base,provider:'openai',config:{model:'gpt-4.1-mini',apiKey:'test',externalConsent:true,endpoint:'https://evil.example/v1/chat/completions'}},trusted),{code:'BAD_ENDPOINT'});
});
test('provider failure does not create an authorized speech event',async()=>{
  await assert.rejects(proposeMeetingTurn({...base,provider:'local',config:{model:'qwen3.5:4b'}},{
    ...trusted,fetchImpl:async()=>({ok:false,status:429})}),{code:'PROVIDER_ERROR'});
});

test('unverified host grants cannot make provider requests or speak',async()=>{
  let called=false;
  await assert.rejects(proposeMeetingTurn({...base,provider:'local',config:{model:'qwen3.5:4b'}},{
    fetchImpl:async()=>{called=true;return {ok:true};}}),{code:'NOT_AUTHORIZED'});
  assert.equal(called,false);
  const proposal={kind:'speech_proposal',requiresSpeechGrant:true,meetingId,participantId,text:'draft'};
  await assert.rejects(acceptSpeechProposal(proposal,speech()),{code:'SPEECH_DENIED'});
  await assert.rejects(acceptSpeechProposal(proposal,speech(),{verifySpeechGrant:async()=>false}),{code:'SPEECH_DENIED'});
});
test('cancelled proposal does not reach the model',async()=>{
  const controller=new AbortController();controller.abort();
  await assert.rejects(proposeMeetingTurn({...base,provider:'local',config:{model:'qwen3.5:4b'}},{
    ...trusted,signal:controller.signal,fetchImpl:async()=>{throw Error('must not call');}}),{code:'MODEL_CANCELLED'});
});
