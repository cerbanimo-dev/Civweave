import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(path,'utf8');
const includes=(source,needle,label)=>assert(source.includes(needle),`${label} is missing ${needle}`);
const excludes=(source,needle,label)=>assert(!source.includes(needle),`${label} must not contain ${needle}`);
const before=(source,a,b,label)=>{
  const left=source.indexOf(a),right=source.indexOf(b);
  assert(left>=0,`${label} is missing ${a}`);
  assert(right>=0,`${label} is missing ${b}`);
  assert(left<right,`${label} must place ${a} before ${b}`);
};
const syntax=path=>new vm.Script(read(path),{filename:path});

const phonePath='public/app/local-ai/gemma4-phone-performance-core-v1.js';
const repairPath='public/app/local-ai/gemma4-inference-repair-v1.js';
const retirementPath='public/app/local-ai/gemma4-q2-retirement-v1.js';
const fastExtensionPath='public/app/local-ai/gemma4-litert-fast-extension-v1.js';
const fastRuntimePath='public/app/local-ai/litert-gemma4-fast-runtime-v1.js';
const deepPath='public/app/local-ai/gemma4-e4b-q4-extension-v1.js';
const actionsPath='public/app/local-ai/gemma4-dual-actions-v2.js';
const supportWorkerPath='public/app/local-ai/premier-phone-support-worker-v1.js';

for(const path of [phonePath,repairPath,retirementPath,fastExtensionPath,fastRuntimePath,deepPath,actionsPath,supportWorkerPath])syntax(path);

const phone=read(phonePath);
includes(phone,"VERSION='1.3.0-gemma4-phone-performance-core-v1-runtime-only-support-status'",'phone authority');
includes(phone,"const FAST_E2='gemma4-e2b-it-litert-web'",'phone authority');
includes(phone,"const FAST_E4='gemma4-e4b-it-litert-web'",'phone authority');
includes(phone,"const LEGACY_E2='gemma4-e2b-it-q4f16'",'phone compatibility');
includes(phone,"const LEGACY_E4='gemma4-e4b-it-q4f16'",'phone compatibility');
includes(phone,"const Q2_E2='gemma4-e2b-it-q2f16-mobile'",'phone retirement');
includes(phone,"const Q2_E4='gemma4-e4b-it-q2f16-mobile'",'phone retirement');
includes(phone,'function patchRegistry(registry)','phone authority');
includes(phone,'__civweaveGemma4PhonePerformanceRegistryV1:true','phone authority');
includes(phone,'function patchPackManager(api)','phone authority');
includes(phone,'baseComponentStatus=base.componentStatus?.bind(base)','support status delegation');
includes(phone,'__civweaveGemma4PhonePerformanceCoreVersion:VERSION','versioned pack wrapper');
includes(phone,'base.__civweaveGemma4PhonePerformanceCoreVersion===VERSION','versioned pack wrapper');
includes(phone,"status:'support-required'",'support readiness');
includes(phone,"phase:'phone-support-required'",'support readiness');
includes(phone,"code:'LOCAL_PHONE_SUPPORT_REQUIRED'",'support readiness');
includes(phone,'gemma4CoreModel:FAST_E2','phone authority');
includes(phone,'gemma4DeepModel:FAST_E4','phone authority');
includes(phone,"optimizedRuntime:'google-litert-lm-webgpu'",'phone authority');
includes(phone,'oneEngineAtATime:true','phone authority');
includes(phone,'function scheduleAuthorityReassert()','phone authority');
includes(phone,'resumeSafeAuthority:true','phone authority');
includes(phone,'runtimeOnly:true','phone presentation boundary');
includes(phone,'presentationOwnership:false','phone presentation boundary');
includes(phone,'function decorateSettings(){return true}','phone presentation boundary');
excludes(phone,"document.addEventListener('click'",'phone runtime authority must not own Settings click handlers');
includes(phone,'const RETIRED_PHONE_CORE=new Set([LEGACY_E2,LEGACY_E4,Q2_E2,Q2_E4,FAST_E2,FAST_E4])','phone pack current-model filtering');
before(phone,'const registryReady=watchRegistry();','const packsReady=watchPacks();','phone authority application');
before(phone,'const state=applyAuthority();','scheduleAuthorityReassert();','phone authority activation');

const repair=read(repairPath);
includes(repair,"VERSION='1.0.11-gemma4-inference-repair-v1-current-phone-authority'",'Gemma repair');
includes(repair,"const PHONE_AUTH_VERSION='1.3.0-gemma4-phone-performance-core-v1-runtime-only-support-status'",'Gemma repair');
includes(repair,"const PHONE_AUTH_SRC='/app/local-ai/gemma4-phone-performance-core-v1.js?v=1.3.0-runtime-only-support-status'",'Gemma repair');
includes(repair,"const Q2_RETIRE_VERSION='1.0.0-gemma4-q2-retirement-v1'",'Gemma repair');
includes(repair,"if(typeof base.ready==='function')await base.ready(args?.onProgress);",'Gemma repair');
includes(repair,'await ensurePhoneAuthority();','Gemma repair');
includes(repair,'void ensureQ2Retirement().catch(()=>null);','Gemma repair nonblocking Q2 migration');
includes(repair,'checkSelectedPerformance(args?.onProgress);','Gemma repair');
includes(repair,"if(error?.code!=='LOCAL_PHONE_PERFORMANCE_CORE_REQUIRED')throw error;",'Gemma repair optional LiteRT guard');
includes(repair,"compatibilityRuntime:'transformers-v4-onnx'",'Gemma repair compatibility runtime');
includes(repair,'phoneAuthorityRuntimeOnly:true','Gemma repair current authority');
before(repair,"if(typeof base.ready==='function')await base.ready(args?.onProgress);",'await ensurePhoneAuthority();','Gemma repair generation bootstrap');

const retirement=read(retirementPath);
includes(retirement,"VERSION='1.0.0-gemma4-q2-retirement-v1'",'Q2 retirement');
includes(retirement,'async function deleteObsoleteModels()','Q2 retirement cleanup');
includes(retirement,'async function installCurrentModels()','Q2 retirement migration');
includes(retirement,'q2Retired:true','Q2 retirement contract');
includes(retirement,'explicitDelete:true','Q2 retirement contract');

const fastExtension=read(fastExtensionPath);
includes(fastExtension,"VERSION='1.1.1-gemma4-litert-fast-extension-v1-browser-handoff-guard'",'LiteRT extension');
includes(fastExtension,"id:'gemma4-e2b-it-litert-web'",'LiteRT extension');
includes(fastExtension,"id:'gemma4-e4b-it-litert-web'",'LiteRT extension');
includes(fastExtension,'browserManagedDownloadsOnly:true','LiteRT browser-only download contract');
includes(fastExtension,'legacyDirectDownloadDisabled:true','LiteRT retired direct-download contract');
excludes(fastExtension,'downloadManager.start(','LiteRT must not use the retired multi-gigabyte direct downloader');

const fastRuntime=read(fastRuntimePath);
includes(fastRuntime,"VERSION='1.3.0-litert-gemma4-fast-runtime-v1-dual-phone-mtp-jspi'",'LiteRT runtime');
includes(fastRuntime,'oneEngineAtATime:true','LiteRT runtime');

const deep=read(deepPath);
includes(deep,"VERSION='1.0.0-gemma4-e4b-q4-extension-v1'",'retired E4B compatibility registration');
includes(deep,'sourceRetired:true','retired E4B presentation');
includes(deep,'presentationOwnership:false','retired E4B presentation');
excludes(deep,'Complete Q4F16 core','retired E4B source must not render stale controls');

const actions=read(actionsPath);
includes(actions,'Download missing support files internally (','current phone actions');
includes(actions,'downloadSupportFiles','current phone actions');
includes(actions,'supportDownloadsWorkerOnly:true','current phone actions');
includes(actions,'supportFilesInternal:true','current phone actions');
includes(actions,'supportAutoDetect:true','current phone actions');
includes(actions,'browserReceiptGemmaOnly:true','current phone actions');
includes(actions,'repairPremierReceipt','current phone actions');
includes(actions,'finished downloading but was not detected in Civweave internal storage','current phone actions');
includes(actions,'singlePresentationOwner:true','current phone actions');
excludes(actions,'Complete Q4F16 core','current phone actions');

const supportWorker=read(supportWorkerPath);
includes(supportWorker,"VERSION='1.0.0-premier-phone-support-worker-v1'",'support worker');
includes(supportWorker,'mainThreadLargeCachePut:false','support worker');
includes(supportWorker,'sequentialArtifacts:true','support worker');

console.log('PASS Gemma 4 Premier Phone uses E2B/E4B LiteRT as the browser-managed current runtime, stores Qwen/speech/TTS support files internally with immediate autodetection, keeps legacy Q4/Q2 presentation retired, and preserves runtime-only authority separation.');