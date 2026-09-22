import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,'..');
const read=path=>readFileSync(resolve(root,path),'utf8');

const packs=read('public/app/local-ai/model-packs-v1.js');
const settings=read('public/app/settings-local-route-v323.js');
const browserPack=read('public/app/local-ai/browser-pack-download-v1.js');
const browserPackPwa=read('public/app/local-ai/browser-pack-pwa-import-v1.js');
const relocation=read('public/app/working-campus-home-relocation-v441.js');
const shellAssets=read('public/service-worker-shell-assets-v1.js');
const specialized=read('public/app/local-ai/specialized-model-capabilities-v1.js');
const voice=read('public/app/guide-voice-runtime-v1.js');

test('AI downloads expose exactly the three intended named pack tiers',()=>{
  for(const label of ['Minimum Spec Pack','Premier Phone Pack','Server Quality Pack'])assert.match(packs,new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.doesNotMatch(packs,/Nothing Phone/i);
  assert.match(settings,/Minimum Spec Pack/);
  assert.match(settings,/Premier Phone Pack/);
  assert.match(settings,/Server Quality Pack/);
});

test('minimum pack remains useful on constrained devices',()=>{
  const block=packs.match(/'minimum-spec'[\s\S]*?(?=\n  'premier-phone')/)?.[0]||'';
  for(const id of ['qwen3-0.6b-q8-wasm','smollm2-135m-instruct-q8-wasm','silero-vad-onnx','parakeet-tdt-0.6b-v3-int8','supertonic-3-tts-int8'])assert.match(block,new RegExp(id));
});

test('Premier Phone pack carries the full 12 GB phone ladder',()=>{
  const block=packs.match(/'premier-phone'[\s\S]*?(?=\n  'server-quality')/)?.[0]||'';
  for(const id of ['gemma4-e2b-it-q2f16-mobile','gemma4-e4b-it-q2f16-mobile','qwen3-0.6b-q8-wasm','silero-vad-onnx','parakeet-tdt-0.6b-v3-int8','omnilingual-asr-300m-int8','supertonic-3-tts-int8'])assert.match(block,new RegExp(id));
});

test('server quality pack uses current executable high quality tiers and server speech',()=>{
  const block=packs.match(/'server-quality'[\s\S]*?\n\}\);/)?.[0]||'';
  for(const id of ['gemma4-e2b-it-q2f16-mobile','gemma4-e4b-it-q2f16-mobile','qwen3-4b-q4f16','qwen3-0.6b-q8-wasm','silero-vad-onnx','parakeet-tdt-0.6b-v3-fp32','omnilingual-asr-1b-int8','supertonic-3-tts-int8'])assert.match(block,new RegExp(id));
  assert.doesNotMatch(block,/gemma-4-12b/i);
});

test('large packs stay browser-managed inside the PWA',()=>{
  assert.match(packs,/BROWSER_MANAGED_PACK_IDS=freeze\(\['premier-phone','server-quality'\]\)/);
  assert.match(packs,/CIVWEAVE_AI_PACK_BROWSER_DOWNLOAD_REQUIRED/);
  assert.match(settings,/browserPackDownload/);
  assert.match(settings,/browser\.queue\(packId/);
  assert.match(settings,/Browser downloads queued/);
});

test('browser-managed packs recover the final file and report streaming import progress',()=>{
  assert.match(browserPack,/const RECEIPT_VERSION=3/);
  assert.match(browserPack,/function unimportedRecords\(/);
  assert.match(browserPack,/function candidateScore\(/);
  assert.match(browserPack,/const size=Number\(file\.size\|\|0\),min=Number\(record\.minBytes\|\|0\),exact=Number\(record\.sizeBytes\|\|record\.exactBytes\|\|0\)/);
  assert.match(browserPack,/function putFile\(record,file,onProgress\)/);
  assert.match(browserPack,/file\.stream\(\)\.getReader\(\)/);
  assert.match(browserPack,/phase:'copying-large'/);
  assert.match(browserPack,/streamingImportProgress:true/);
  assert.match(browserPack,/relaxedMinimumOnlyMatching:true/);
  assert.match(browserPack,/partial:true/);
  assert.match(browserPack,/status:'ready'/);

  assert.match(browserPackPwa,/Import downloaded files/);
  assert.match(browserPackPwa,/Download missing again/);
  assert.match(browserPackPwa,/Still missing browser-managed model:/);
  assert.match(browserPackPwa,/cw-browser-pack-progress-track/);
  assert.match(browserPackPwa,/Gemma import progress/);
  assert.match(browserPackPwa,/current\.importFiles\(packId,files/);
  assert.match(browserPackPwa,/current\.prepare\(packId/);
  assert.match(browserPackPwa,/async function settleCurrentPremierOwner\(/);
  assert.match(browserPackPwa,/owner\.synchronizeImportedModels/);
  assert.match(browserPackPwa,/owner\.refreshSupportStatus/);
  assert.match(browserPackPwa,/owner\.pendingSummary\?\.\(\)/);
  assert.match(browserPackPwa,/summary\?\.complete/);
  assert.match(browserPackPwa,/progressUi:true/);
  assert.match(browserPackPwa,/missingFileRecovery:true/);
  assert.match(browserPackPwa,/incrementalPremierImport:true/);
  assert.match(browserPackPwa,/ownerSettlementOnEveryImport:true/);
  assert.match(browserPackPwa,/ownerRequiresCompletedGemmaReceipt:true/);
  assert.match(relocation,/browser-pack-pwa-import-v1\.js\?v=1\.3\.2-premier-incremental-handoff/);
  assert.match(relocation,/startsWith\?\.\('1\.3\.2-'\)/);
  assert.match(shellAssets,/browser-pack-pwa-import-v1\.js/);
  assert.match(shellAssets,/browser-pack-download-v1\.js/);
});

test('Local models view has pack actions without eagerly loading pack runtime',()=>{
  for(const attr of ['data-local-pack-download','data-local-pack-use','data-local-pack-remove','data-local-pack-cancel'])assert.match(settings,new RegExp(attr));
  assert.match(settings,/model-packs-v1\.js/);
  assert.match(settings,/actionModulesOnDemand:true/);
  assert.match(settings,/packRuntimeDependencyOnView:false/);
});

test('fresh speech models remain reusable outside voice chat',()=>{
  assert.match(specialized,/supertonic-3-tts-int8/);
  assert.match(specialized,/'speech-synthesis':freeze\(\{primary:\['supertonic-3-tts-int8'\]/);
  for(const task of ['dictation','live-captions','media-transcription','read-aloud','translation','summarization','memory-retrieval','deep-reasoning','coding'])assert.match(specialized,new RegExp(`'${task}'`));
});

test('guide voice distinguishes installed ASR weights from a failed local speech session',()=>{
  assert.match(voice,/installedSpeechModelStatus/);
  assert.match(voice,/CIVWEAVE_SPEECH_EXECUTOR_START_FAILED/);
  assert.match(voice,/speech model is installed, but (?:its local speech session could not start|no compatible local speech-recognition session could start)/i);
  assert.match(voice,/No offline speech-recognition model or browser language pack is installed/);
});