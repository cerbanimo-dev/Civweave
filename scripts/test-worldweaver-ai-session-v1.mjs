import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorldweaverAISession} from '../public/app/shared/worldweaver-ai-session-v1.mjs';

const keys={
  openai:{provider:'openai-compatible',model:'gpt-6-luna',endpoint:'https://api.openai.com/v1',apiKey:'test-openai-secret',externalConsent:true},
  gemini:{provider:'gemini',model:'gemini-3.7-flash',endpoint:'https://generativelanguage.googleapis.com/v1beta',apiKey:'test-gemini-secret',externalConsent:true}
};
function fixture(options={}){
  const calls=[];
  const runtime={generate:async request=>{
    calls.push(structuredClone(request));
    return{status:'success',outputText:'Spoken fiction.',actual:{provider:request.config.provider,model:request.config.model},usage:{promptTokens:12,completionTokens:8}};
  }};
  const session=createWorldweaverAISession({
    runtime,readProviderConfig:name=>keys[name],mode:'binary',
    connected:['openai','gemini'],consent:true,
    budget:{maxCalls:3,maxEstimatedInputTokens:6000,maxOutputTokensPerCall:250,maxReservedUsd:1},
    pricePerMillion:{openai:{input:1,output:5},gemini:{input:1,output:5}},
    ...options
  });
  return{session,calls};
}
const request={role:'actors',worldId:'world-1',personaId:'maggie',actorPrompt:'Sarcastic narrator',worldContext:'A little courtyard.',scenePrompt:'Ask who built the gate.'};

test('Binary routes the Loom to OpenAI and all characters including Lari to Gemini',async()=>{
  const {session,calls}=fixture();
  await session.propose({...request,role:'loom'});
  await session.propose(request);
  await session.propose({...request,role:'lari',personaId:'lari'});
  assert.deepEqual(calls.map(x=>x.config.provider),['openai-compatible','gemini','gemini']);
  assert.deepEqual(calls.map(x=>x.config.model),['gpt-6-luna','gemini-3.7-flash','gemini-3.7-flash']);
  assert.equal(session.status().spentCalls,3);
  assert.equal(session.status().mode,'binary');
});

test('Character and world memory are distinct and not shared with other agents',async()=>{
  const {session,calls}=fixture({budget:{maxCalls:5,maxEstimatedInputTokens:10000,maxOutputTokensPerCall:200,maxReservedUsd:1}});
  await session.propose(request);
  await session.propose({...request,personaId:'landry',actorPrompt:'Curious explorer'});
  await session.propose({...request,worldId:'world-2'});
  await session.propose(request);
  assert.equal(calls[1].messages.some(x=>x.content==='Spoken fiction.'),false);
  assert.equal(calls[2].messages.some(x=>x.content==='Spoken fiction.'),false);
  assert.equal(calls[3].messages.some(x=>x.content==='Spoken fiction.'),true);
  assert.deepEqual(session.memorySummary().map(r=>r.messageCount).sort(),[2,2,4]);
});

test('No cloud requests without explicit opt in, and no silent provider fallback',async()=>{
  const noConsent=fixture({consent:false});
  await assert.rejects(noConsent.session.propose(request),/consent/i);
  assert.equal(noConsent.calls.length,0);
  const missing=fixture({connected:['openai']});
  await assert.rejects(missing.session.propose(request),/not configured/i);
  assert.equal(missing.calls.length,0);
});

test('No requests when provider key, provider consent, endpoint or model is invalid',async()=>{
  for(const providerConfig of [
    {...keys.gemini,apiKey:''},
    {...keys.gemini,externalConsent:false},
    {...keys.gemini,endpoint:'https://attacker.example/v1'},
    {...keys.gemini,model:''}
  ]){
    const {session,calls}=fixture({readProviderConfig:provider=>provider==='gemini'?providerConfig:keys.openai});
    await assert.rejects(session.propose(request));
    assert.equal(calls.length,0);
  }
});

test('Budget reserves before invocation and never exceeds call or approximate dollar cap',async()=>{
  const {session,calls}=fixture({budget:{maxCalls:1,maxEstimatedInputTokens:800,maxOutputTokensPerCall:40,maxReservedUsd:.001},pricePerMillion:{openai:{input:1,output:5},gemini:{input:1,output:5}}});
  await session.propose({...request,maxOutputTokens:30});
  await assert.rejects(session.propose({...request,maxOutputTokens:30}),/budget|limit/i);
  assert.equal(calls.length,1);
});

test('Untrusted model text is a proposal, not an authorized Worldweaver dispatch',async()=>{
  const {session,calls}=fixture();
  const result=await session.propose(request);
  assert.equal(result.kind,'fiction-proposal');
  assert.equal(result.text,'Spoken fiction.');
  assert.equal(result.applied,false);
  assert.equal(JSON.stringify(result).includes('test-gemini-secret'),false);
  assert.equal(session.status().modelRequestsHaveAuthority,false);
  assert.equal(calls[0].messages.some(x=>x.content.includes('Do not claim world events are committed')),true);
});

test('Hard cap failures do not append model memory or leak credentials',async()=>{
  const {session,calls}=fixture({runtime:{generate:async request=>{calls.push(request);return{status:'provider-error',error:{code:'TEST',message:'synthetic unavailable'}}}}});
  await assert.rejects(session.propose(request),/synthetic unavailable/);
  assert.deepEqual(session.memorySummary(),[]);
});

test('Multiverse foil is blocked while Grok remains unapproved',async()=>{
  const {session,calls}=fixture({mode:'multiverse',connected:['openai','gemini','grok','deepseek']});
  await assert.rejects(session.propose({...request,role:'lari',personaId:'lari'}),/not approved|provider-testing/i);
  assert.equal(calls.length,0);
});

test('Local-only never sends to remote provider despite a saved cloud key',async()=>{
  const {session,calls}=fixture({mode:'local-only',connected:['openai','gemini'],localModelAvailable:false});
  await assert.rejects(session.propose(request),/local model|local rules/i);
  assert.equal(calls.length,0);
});

test('An explicit zero budget cannot be promoted to the default spending allowance',async()=>{
  const {session,calls}=fixture({budget:{maxCalls:0,maxReservedUsd:0}});
  await assert.rejects(session.propose(request),/budget|limit/i);
  assert.equal(calls.length,0);
});

test('Worldweaver rejects a successful response from any other provider or model',async()=>{
  for(const actual of [
    {provider:'gemini',model:'gpt-6-luna'},
    {provider:'openai-compatible',model:'different-model'},
    undefined
  ]){
    let count=0;
    const {session}=fixture({runtime:{generate:async()=>{
      count++;return{status:'success',outputText:'Unverified response',actual};
    }}});
    await assert.rejects(session.propose({...request,role:'loom'}),/provider|identity|model|unverified/i);
    assert.equal(count,1);
    assert.deepEqual(session.memorySummary(),[]);
  }
});

test('aborted playtest requests do not call a provider or append character memory',async()=>{
  const controller=new AbortController();
  controller.abort('end-session');
  const {session,calls}=fixture();
  await assert.rejects(session.propose({...request,signal:controller.signal}),/cancelled|aborted/i);
  assert.equal(calls.length,0);
  assert.deepEqual(session.memorySummary(),[]);
});
test('abort signal is passed to canonical runtime, and a result after cancellation is discarded',async()=>{
  const controller=new AbortController();let received=null;
  const {session}=fixture({runtime:{generate:async payload=>{
    received=payload.signal;
    controller.abort('user-ended-session');
    return{status:'success',outputText:'Should never render',actual:{provider:'gemini',model:'gemini-3.7-flash'}};
  }}});
  await assert.rejects(session.propose({...request,signal:controller.signal}),/cancelled|aborted/i);
  assert.equal(received,controller.signal);
  assert.deepEqual(session.memorySummary(),[]);
});
