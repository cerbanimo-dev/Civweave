(()=>{
'use strict';

const VERSION='1.0.0-local-specialized-model-capabilities-v1';
if(globalThis.CivweaveLocalSpecializedAI?.version===VERSION)return;

const clean=(value,max=240)=>String(value??'').trim().slice(0,max);
const freeze=value=>Object.freeze(value);
const MODEL=freeze({
  'silero-vad-onnx':freeze({
    id:'silero-vad-onnx',label:'Silero VAD',family:'silero-vad',runtime:'onnx/sherpa-onnx',kind:'audio-perception',estimatedBytes:2_000_000,
    source:'snakers4/silero-vad',license:'MIT',roles:freeze(['voice-activity','turn-detection','barge-in-gating']),languages:'language-agnostic',residency:'voice-session-hot'
  }),
  'parakeet-tdt-0.6b-v3-int8':freeze({
    id:'parakeet-tdt-0.6b-v3-int8',label:'Parakeet TDT 0.6B v3 INT8',family:'parakeet',runtime:'sherpa-onnx',kind:'speech-recognition',estimatedBytes:670_000_000,
    sourceModel:'nvidia/parakeet-tdt-0.6b-v3',license:'CC-BY-4.0',roles:freeze(['speech-transcription','dictation','live-captions','media-transcription','voice-chat']),languages:'25-european',residency:'voice-session-hot'
  }),
  'omnilingual-asr-300m-int8':freeze({
    id:'omnilingual-asr-300m-int8',label:'Omnilingual ASR 300M INT8',family:'omnilingual-asr',runtime:'sherpa-onnx',kind:'speech-recognition',estimatedBytes:365_000_000,
    sourceModel:'facebook/omnilingual-asr omniASR_CTC_300M',license:'upstream-model-license',roles:freeze(['wide-language-transcription','accessibility-captions','archive-transcription','language-fallback']),languages:'1600+',residency:'on-demand'
  }),
  'pocket-tts-100m':freeze({
    id:'pocket-tts-100m',label:'Pocket TTS 100M',family:'pocket-tts',runtime:'pocket-tts/native-or-browser',kind:'speech-synthesis',estimatedBytes:500_000_000,
    sourceModel:'kyutai/pocket-tts',license:'CC-BY-4.0',roles:freeze(['guide-voice','read-aloud','accessibility-speech','long-form-reading']),languages:freeze(['en','fr','de','pt','it','es']),residency:'voice-session-hot'
  }),
  'kokoro-82m-onnx':freeze({
    id:'kokoro-82m-onnx',label:'Kokoro 82M ONNX',family:'kokoro',runtime:'sherpa-onnx',kind:'speech-synthesis',estimatedBytes:350_000_000,
    sourceModel:'hexgrad/Kokoro-82M',license:'Apache-2.0',roles:freeze(['guide-voice','read-aloud','voice-pack']),languages:'pack-dependent',residency:'on-demand'
  }),
  'piper-vits-voice-pack':freeze({
    id:'piper-vits-voice-pack',label:'Piper / VITS voice pack',family:'piper-vits',runtime:'sherpa-onnx',kind:'speech-synthesis',estimatedBytes:80_000_000,
    sourceModel:'rhasspy/piper-voices + sherpa-onnx conversions',license:'voice-pack-specific',roles:freeze(['long-tail-tts','accessibility-speech','language-pack']),languages:'40+ pack-dependent',residency:'on-demand'
  }),
  'all-minilm-l6-v2-q8':freeze({
    id:'all-minilm-l6-v2-q8',label:'MiniLM L6 v2 Q8',family:'minilm',runtime:'onnxruntime-web/wasm',kind:'semantic',estimatedBytes:25_000_000,
    sourceModel:'sentence-transformers/all-MiniLM-L6-v2',license:'Apache-2.0',roles:freeze(['semantic-routing','memory-retrieval','ranking','dedupe','similarity']),languages:'semantic-multilingual-limited',residency:'short-lease'
  }),
  'gemma4-e2b-it-q2f16-mobile':freeze({
    id:'gemma4-e2b-it-q2f16-mobile',label:'Gemma 4 E2B IT mobile ONNX',family:'gemma4',runtime:'civweave-local-generative',kind:'generative',estimatedBytes:2_335_000_000,
    sourceModel:'google/gemma-4-E2B-it-qat-mobile-transformers',license:'Gemma',roles:freeze(['dialogue','translation','summarization','rewrite','classification','tool-intent','light-reasoning','multimodal-when-encoders-installed']),languages:'140+',residency:'primary-hot'
  }),
  'gemma4-e4b-it-q2f16-mobile':freeze({
    id:'gemma4-e4b-it-q2f16-mobile',label:'Gemma 4 E4B IT mobile ONNX',family:'gemma4',runtime:'civweave-local-generative',kind:'generative',estimatedBytes:3_365_000_000,
    sourceModel:'google/gemma-4-E4B-it-qat-mobile-transformers',license:'Gemma',roles:freeze(['deep-reasoning','coding','complex-planning','translation','summarization','hard-classification','multimodal-when-encoders-installed']),languages:'140+',residency:'cold-or-warm-escalation'
  })
});

const TASKS=freeze({
  'voice-chat':freeze({pipeline:['silero-vad-onnx','parakeet-tdt-0.6b-v3-int8','gemma4-e2b-it-q2f16-mobile','pocket-tts-100m'],fallbacks:['omnilingual-asr-300m-int8','kokoro-82m-onnx','piper-vits-voice-pack'],note:'One guide chat runtime; wake address narrows the guide memory scope.'}),
  'speech-transcription':freeze({primary:['parakeet-tdt-0.6b-v3-int8'],fallbacks:['omnilingual-asr-300m-int8'],uses:['voice-chat','dictation','meeting-notes','media-transcription','search-by-voice']}),
  'dictation':freeze({primary:['parakeet-tdt-0.6b-v3-int8'],fallbacks:['omnilingual-asr-300m-int8'],uses:['forms','messages','Quest notes','Learning Journey notes']}),
  'live-captions':freeze({primary:['parakeet-tdt-0.6b-v3-int8'],fallbacks:['omnilingual-asr-300m-int8'],uses:['accessibility','local meetings','audio/video playback']}),
  'media-transcription':freeze({primary:['parakeet-tdt-0.6b-v3-int8'],fallbacks:['omnilingual-asr-300m-int8'],uses:['creation provenance','learning media','meeting records','search indexing']}),
  'wide-language-transcription':freeze({primary:['omnilingual-asr-300m-int8'],fallbacks:['parakeet-tdt-0.6b-v3-int8'],uses:['accessibility','imported recordings','language discovery']}),
  'turn-detection':freeze({primary:['silero-vad-onnx'],uses:['voice-chat','captions','recording segmentation','creation provenance']}),
  'speech-synthesis':freeze({primary:['pocket-tts-100m'],fallbacks:['kokoro-82m-onnx','piper-vits-voice-pack'],uses:['guide replies','read-aloud','accessibility','learning pronunciation']}),
  'read-aloud':freeze({primary:['pocket-tts-100m'],fallbacks:['kokoro-82m-onnx','piper-vits-voice-pack'],uses:['chat','Learning Journeys','Quests','messages','long-form content']}),
  'semantic-routing':freeze({primary:['all-minilm-l6-v2-q8'],uses:['guide routing','capability routing','artifact routing']}),
  'memory-retrieval':freeze({primary:['all-minilm-l6-v2-q8'],uses:['guide memory ranking','local search','related-record retrieval']}),
  'semantic-dedupe':freeze({primary:['all-minilm-l6-v2-q8'],uses:['memory compaction','content similarity','duplicate detection']}),
  'translation':freeze({primary:['gemma4-e2b-it-q2f16-mobile'],fallbacks:['gemma4-e4b-it-q2f16-mobile'],uses:['chat','messages','captions','learning material']}),
  'summarization':freeze({primary:['gemma4-e2b-it-q2f16-mobile'],fallbacks:['gemma4-e4b-it-q2f16-mobile'],uses:['chat history','meetings','documents','Guild activity']}),
  'text-classification':freeze({primary:['gemma4-e2b-it-q2f16-mobile'],fallbacks:['all-minilm-l6-v2-q8'],uses:['intent','moderation-assist','topic labeling','provenance review']}),
  'deep-reasoning':freeze({primary:['gemma4-e4b-it-q2f16-mobile'],fallbacks:['gemma4-e2b-it-q2f16-mobile'],uses:['complex Quests','Endeavors','coding','multi-step planning']}),
  'coding':freeze({primary:['gemma4-e4b-it-q2f16-mobile'],fallbacks:['gemma4-e2b-it-q2f16-mobile'],uses:['local code explanation','bounded implementation assistance']}),
  'ocr':freeze({primary:['gemma4-e2b-it-q2f16-mobile'],fallbacks:['gemma4-e4b-it-q2f16-mobile'],requires:'gemma4-vision-encoder',uses:['screenshots','documents','accessibility']}),
  'image-understanding':freeze({primary:['gemma4-e2b-it-q2f16-mobile'],fallbacks:['gemma4-e4b-it-q2f16-mobile'],requires:'gemma4-vision-encoder',uses:['camera','screenshots','visual learning']}),
  'audio-understanding':freeze({primary:['gemma4-e2b-it-q2f16-mobile'],fallbacks:['gemma4-e4b-it-q2f16-mobile'],requires:'gemma4-audio-encoder',uses:['non-transcription audio analysis','creation review','learning media']})
});

const executors=new Map();
function model(id){return MODEL[clean(id,120)]||null}
function task(name){return TASKS[clean(name,120)]||null}
function plan(name,options={}){
  const spec=task(name);if(!spec)return null;
  const language=clean(options.language||'',40).toLowerCase(),deep=options.deep===true;
  let primary=[...(spec.primary||[])],fallbacks=[...(spec.fallbacks||[])];
  if(deep&&primary.includes('gemma4-e2b-it-q2f16-mobile'))[primary,fallbacks]=[['gemma4-e4b-it-q2f16-mobile'],['gemma4-e2b-it-q2f16-mobile',...fallbacks.filter(id=>id!=='gemma4-e4b-it-q2f16-mobile')]];
  if(name==='speech-synthesis'&&language&&!['en','fr','de','pt','it','es'].some(code=>language===code||language.startsWith(`${code}-`))){primary=['piper-vits-voice-pack'];fallbacks=['kokoro-82m-onnx','pocket-tts-100m']}
  return freeze({schema:'civweave.local-specialized-ai-plan.v1',task:name,primary:freeze(primary),fallbacks:freeze(fallbacks),pipeline:freeze([...(spec.pipeline||[])]),requires:spec.requires||null,uses:freeze([...(spec.uses||[])]),models:freeze([...new Set([...primary,...fallbacks,...(spec.pipeline||[])])].map(model).filter(Boolean))});
}
function registerExecutor(key,executor,metadata={}){const id=clean(key,120);if(!id||typeof executor!=='function')return false;executors.set(id,{executor,metadata:freeze({...metadata})});return true}
function unregisterExecutor(key){return executors.delete(clean(key,120))}
function executorFor(id){return executors.get(id)||null}
async function execute(name,payload={},options={}){
  const route=plan(name,options);if(!route)throw Object.assign(new Error(`Unknown local specialized task: ${name}`),{code:'LOCAL_SPECIALIZED_TASK_UNKNOWN'});
  const ordered=[...route.primary,...route.fallbacks];
  let lastError=null;
  for(const id of ordered){const entry=executorFor(id)||executorFor(MODEL[id]?.family)||executorFor(name);if(!entry)continue;try{return await entry.executor(payload,{task:name,model:MODEL[id],plan:route,options})}catch(error){lastError=error}}
  if(lastError)throw lastError;
  throw Object.assign(new Error(`No installed local executor is registered for ${name}.`),{code:'LOCAL_SPECIALIZED_EXECUTOR_UNAVAILABLE',task:name,plan:route});
}
function status(){return freeze({version:VERSION,models:Object.keys(MODEL),tasks:Object.keys(TASKS),executors:[...executors.keys()]})}

const api=freeze({version:VERSION,models:MODEL,tasks:TASKS,model,task,plan,registerExecutor,unregisterExecutor,execute,status});
globalThis.CivweaveLocalSpecializedAI=api;
try{dispatchEvent(new CustomEvent('civweave:local-specialized-ai-ready',{detail:status()}))}catch{}
})();