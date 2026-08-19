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

test('Parakeet speech executor registers the installed INT8 model and preserves the NeMo TDT contract',()=>{
  const registrations=[];
  const ctx=runBrowserScript('public/app/local-ai/parakeet-speech-executor-v1.js',{
    CivweaveLocalSpecializedAI:{registerExecutor:(key,executor,metadata)=>registrations.push({key,executor,metadata})}
  });
  const api=ctx.CivweaveParakeetSpeechExecutorV1;
  assert.ok(api);
  assert.equal(api.modelId,'parakeet-tdt-0.6b-v3-int8');
  assert.equal(registrations.length,1);
  assert.equal(registrations[0].key,'parakeet-tdt-0.6b-v3-int8');
  assert.equal(registrations[0].metadata.runtime,'onnxruntime-web');
  assert.equal(registrations[0].metadata.decoder,'nemo-tdt-greedy');
  const source=fs.readFileSync('public/app/local-ai/parakeet-speech-executor-v1.js','utf8');
  assert.match(source,/MEL_BINS=128/);
  assert.match(source,/SAMPLE_RATE=16000/);
  assert.match(source,/MAX_TOKENS_PER_FRAME=5/);
  assert.match(source,/specializedStatus\(MODEL_ID\)/);
  assert.match(source,/outputSize<=vocabSize/);
  assert.match(source,/duration logits/);
  assert.match(source,/supportsProxyWorker/);
  assert.match(source,/response\.arrayBuffer\(\)/);
  assert.match(source,/graphOptimizationLevel:String\(row\?\.path\|\|''\)\.startsWith\('encoder\.'\)\?'basic':'all'/);
  assert.match(source,/PARAKEET_ONNX_SESSION_CREATE_FAILED/);
  assert.match(source,/encoder\.int8\.onnx/);
  assert.match(source,/decoder\.int8\.onnx/);
  assert.match(source,/joiner\.int8\.onnx/);
  assert.match(source,/tokens\.txt/);
  assert.match(source,/const time=encoded\.dims\[1\],channels=encoded\.dims\[2\]/);
  assert.match(source,/encoded\.data\[t\*channels\+c\]/);
  assert.doesNotMatch(source,/encoded\.data\[c\*time\+t\]/);
});

test('Parakeet activates microphone audio before the cold ONNX model load',()=>{
  const source=fs.readFileSync('public/app/local-ai/parakeet-speech-executor-v1.js','utf8');
  const start=source.indexOf('async function startMicrophone');
  const body=source.slice(start,source.indexOf('\nasync function executor',start));
  const mic=body.indexOf('navigator.mediaDevices.getUserMedia');
  const context=body.indexOf('context=new AudioCtx()');
  const runtime=body.indexOf('const runtime=await loadRuntime()');
  assert.ok(mic>=0&&context>=0&&runtime>=0);
  assert.ok(mic<runtime,'microphone permission/capture should be acquired before the long model load');
  assert.ok(context<runtime,'AudioContext should be created/resumed while user activation is still fresh');
  assert.match(body,/track\.stop\(\)/);
  assert.match(body,/context\?\.close\?\.\(\)/);
  assert.match(body,/flush\(\{allowStopped:true,reason:'manual-stop'\}\)/);
  assert.match(body,/transcript-ready/);
  assert.match(body,/transcript-empty/);
});

test('guide voice lazily loads the corrected Parakeet executor before specialized speech',()=>{
  const source=fs.readFileSync('public/app/guide-voice-runtime-v1.js','utf8');
  assert.match(source,/parakeet-speech-executor-v1\.js\?v=1\.0\.2/);
  assert.match(source,/SPEECH_EXECUTOR_VERSION='1\.0\.2-parakeet-speech-executor-v1-transcription-layout'/);
  assert.match(source,/ensureSpeechExecutor/);
  assert.match(source,/PARAKEET_EXECUTOR_VERSION_MISMATCH/);
  assert.match(source,/executeSpecializedSpeech/);
  assert.match(source,/CIVWEAVE_SPEECH_EXECUTOR_START_FAILED/);
  assert.match(source,/lastSpecializedError/);
  assert.match(source,/executorError/);
  assert.match(source,/artifact/);
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