import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function runBrowserScript(path,extra={}){
  const listeners=new Map();
  const storage=new Map();
  const context={
    console,
    setTimeout,clearTimeout,queueMicrotask,
    navigator:{language:'en-US'},
    localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)},
    addEventListener:(name,fn)=>{const rows=listeners.get(name)||[];rows.push(fn);listeners.set(name,rows)},
    dispatchEvent:()=>true,
    CustomEvent:class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail}},
    ...extra
  };
  context.globalThis=context;
  vm.runInNewContext(fs.readFileSync(path,'utf8'),context,{filename:path});
  return context;
}

test('specialized local model plan reuses speech and language models beyond voice chat',()=>{
  const ctx=runBrowserScript('public/app/local-ai/specialized-model-capabilities-v1.js');
  const api=ctx.CivweaveLocalSpecializedAI;
  assert.ok(api);
  assert.deepEqual(Array.from(api.plan('dictation').primary),['parakeet-tdt-0.6b-v3-int8']);
  assert.ok(Array.from(api.plan('live-captions').fallbacks).includes('omnilingual-asr-300m-int8'));
  assert.ok(Array.from(api.plan('media-transcription').uses).includes('creation provenance'));
  assert.deepEqual(Array.from(api.plan('memory-retrieval').primary),['all-minilm-l6-v2-q8']);
  assert.deepEqual(Array.from(api.plan('translation').primary),['gemma4-e2b-it-q2f16-mobile']);
  assert.deepEqual(Array.from(api.plan('deep-reasoning').primary),['gemma4-e4b-it-q2f16-mobile']);
  assert.ok(Array.from(api.plan('read-aloud').fallbacks).includes('piper-vits-voice-pack'));
});

test('all five guide wake addresses resolve to their existing isolated guide systems',()=>{
  const ctx=runBrowserScript('public/app/guide-voice-runtime-v1.js');
  const voice=ctx.CivweaveGuideVoiceV1;
  assert.equal(voice.resolveAddress('Hey Weaveling, help me plan this').system,'civweave');
  assert.equal(voice.resolveAddress('Hey Moss, quiz me').system,'living-school');
  assert.equal(voice.resolveAddress('Hey Kamiya, what is next?').system,'cerbanimo');
  assert.equal(voice.resolveAddress('Hey Rook, what should I charge?').system,'fellowfare');
  assert.equal(voice.resolveAddress('Hey Merlin, review this proposal').system,'anarchadia');
});


test('spoken guide addressing switches the canonical chat context before submission',async()=>{
  const calls=[];
  const surface={
    switchGuide:(system,options)=>{calls.push(['switch',system,options]);return true},
    submitVoiceText:async(text,system)=>{calls.push(['submit',system,text]);return true},
    activeWindow:()=> 'civweave'
  };
  const ctx=runBrowserScript('public/app/guide-voice-runtime-v1.js',{CivweaveGuideChatSurfaceV350:surface});
  const ok=await ctx.CivweaveGuideVoiceV1.routeTranscript('Hey Rook, what should I charge?',{final:true,allowBare:true,submit:true});
  assert.equal(ok,true);
  assert.equal(calls[0][0],'switch');
  assert.equal(calls[0][1],'fellowfare');
  assert.deepEqual(calls[1],['submit','fellowfare','what should I charge?']);
});

test('offline browser speech fallback requires explicit local-only recognition support',()=>{
  const source=fs.readFileSync('public/app/guide-voice-runtime-v1.js','utf8');
  assert.match(source,/processLocally/);
  assert.match(source,/ON_DEVICE_SPEECH_UNSUPPORTED/);
  assert.match(source,/will not send an offline voice session to a network speech service/);
});

test('guide chat owns wake-address submission and voice input without adding another chat owner',()=>{
  const source=fs.readFileSync('public/app/guide-chat-surface-v350.js','utf8');
  assert.match(source,/data-voice/);
  assert.match(source,/submitVoiceText/);
  assert.match(source,/resolveGuideAddress/);
  assert.match(source,/guide-voice-runtime-v1\.js/);
  assert.match(source,/specialized-model-capabilities-v1\.js/);
  assert.match(source,/surface.*single-current-chat-surface|presentation:'single-current-chat-surface'/s);
});