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
  assert.match(source,/ort\.env\.wasm\.proxy=false/);
  assert.doesNotMatch(source,/supportsProxyWorker/);
  assert.match(source,/response\.arrayBuffer\(\)/);
  assert.match(source,/graphOptimizationLevel:String\(row\?\.path\|\|''\)\.startsWith\('encoder\.'\)\?'basic':'all'/);
  assert.match(source,/PARAKEET_ONNX_SESSION_CREATE_FAILED/);
  assert.match(source,/encoder\.int8\.onnx/);
  assert.match(source,/decoder\.int8\.onnx/);
  assert.match(source,/joiner\.int8\.onnx/);
  assert.match(source,/tokens\.txt/);
  assert.match(source,/resolveEncoderLayout/);
  assert.match(source,/resolveEncoderOutputs/);
  assert.match(source,/resolveDecoderOutputs/);
  assert.match(source,/PARAKEET_ENCODER_JOINER_SHAPE_MISMATCH/);
  assert.match(source,/PARAKEET_ENCODER_ACOUSTIC_OUTPUT_UNAVAILABLE/);
  assert.match(source,/PARAKEET_DECODER_STATE_OUTPUT_MISMATCH/);
});

test('Parakeet uses joiner metadata to resolve raw NeMo encoder layout',()=>{
  const ctx=runBrowserScript('public/app/local-ai/parakeet-speech-executor-v1.js');
  const resolve=ctx.CivweaveParakeetSpeechExecutorV1.resolveEncoderLayout;
  const bct=resolve({dims:[1,1024,55]},{inputNames:['encoder_outputs'],inputMetadata:[{name:'encoder_outputs',shape:[1,1024,1]}]});
  assert.equal(bct.layout,'BCT');
  assert.equal(bct.channels,1024);
  assert.equal(bct.time,55);
  assert.equal(bct.index(2,7),7*55+2);
  const btc=resolve({dims:[1,55,1024]},{inputNames:['encoder_outputs'],inputMetadata:[{name:'encoder_outputs',shape:[1,1024,1]}]});
  assert.equal(btc.layout,'BTC');
  assert.equal(btc.channels,1024);
  assert.equal(btc.time,55);
  assert.equal(btc.index(2,7),2*1024+7);
  assert.throws(()=>resolve({dims:[1,55,384]},{inputNames:['encoder_outputs'],inputMetadata:[{name:'encoder_outputs',shape:[1,1024,1]}]}),/does not match joiner/);
});

test('Parakeet ignores recurrent-state-shaped encoder outputs and selects acoustic output',()=>{
  const ctx=runBrowserScript('public/app/local-ai/parakeet-speech-executor-v1.js');
  const resolve=ctx.CivweaveParakeetSpeechExecutorV1.resolveEncoderOutputs;
  const recurrent={dims:[2,1,640],type:'float32',data:new Float32Array(1280)};
  const acoustic={dims:[1,1024,55],type:'float32',data:new Float32Array(1024*55)};
  const length={dims:[1],type:'int64',data:new BigInt64Array([55n])};
  const encoder={outputNames:['cache_state','encoded','encoded_length']};
  const joiner={inputNames:['encoder_outputs'],inputMetadata:[{name:'encoder_outputs',shape:[1,1024,1]}]};
  const result=resolve({cache_state:recurrent,encoded:acoustic,encoded_length:length},encoder,joiner);
  assert.equal(result.encodedName,'encoded');
  assert.deepEqual(Array.from(result.encoded.dims),[1,1024,55]);
  assert.equal(result.lengthName,'encoded_length');
  assert.equal(Number(result.encodedLength.data[0]),55);
});

test('Parakeet resolves decoder projection and recurrent states by shape rather than position',()=>{
  const ctx=runBrowserScript('public/app/local-ai/parakeet-speech-executor-v1.js');
  const resolve=ctx.CivweaveParakeetSpeechExecutorV1.resolveDecoderOutputs;
  const stateH={dims:[2,1,640],type:'float32',data:new Float32Array(1280)};
  const projection={dims:[1,640,1],type:'float32',data:new Float32Array(640)};
  const length={dims:[1],type:'int64',data:new BigInt64Array([1n])};
  const stateC={dims:[2,1,640],type:'float32',data:new Float32Array(1280)};
  const decoder={outputNames:['state_h','projection','decoder_length','state_c']};
  const joiner={inputNames:['encoder_outputs','decoder_outputs'],inputMetadata:[
    {name:'encoder_outputs',shape:[1,1024,1]},
    {name:'decoder_outputs',shape:[1,640,1]}
  ]};
  const states=[{dims:[2,1,640]},{dims:[2,1,640]}];
  const result=resolve({state_h:stateH,projection,decoder_length:length,state_c:stateC},decoder,joiner,states);
  assert.equal(result.projectionName,'projection');
  assert.deepEqual(Array.from(result.output.dims),[1,640,1]);
  assert.equal(result.nextStates.length,2);
  assert.deepEqual(Array.from(result.nextStates,state=>Array.from(state.dims)),[[2,1,640],[2,1,640]]);
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
  assert.match(source,/parakeet-speech-executor-v1\.js\?v=1\.0\.5/);
  assert.match(source,/SPEECH_EXECUTOR_VERSION='1\.0\.5-parakeet-speech-executor-v1-no-proxy-worker'/);
  assert.match(source,/ensureSpeechExecutor/);
  assert.match(source,/PARAKEET_EXECUTOR_VERSION_MISMATCH/);
  assert.match(source,/executeSpecializedSpeech/);
  assert.match(source,/CIVWEAVE_SPEECH_EXECUTOR_START_FAILED/);
  assert.match(source,/lastSpecializedError/);
  assert.match(source,/executorError/);
  assert.match(source,/artifact/);
});

test('guide chat owns wake-address submission and version-locks corrected voice runtime',()=>{
  const source=fs.readFileSync('public/app/guide-chat-surface-v350.js','utf8');
  assert.match(source,/data-voice/);
  assert.match(source,/submitVoiceText/);
  assert.match(source,/resolveGuideAddress/);
  assert.match(source,/guide-voice-runtime-v1\.js\?v=1\.1\.6/);
  assert.match(source,/VOICE_RUNTIME_VERSION='1\.1\.6-guide-voice-runtime-v1-parakeet-no-proxy-worker'/);
  assert.match(source,/specialized-model-capabilities-v1\.js/);
  assert.match(source,/surface.*single-current-chat-surface|presentation:'single-current-chat-surface'/s);
});