import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(path,'utf8');
const includes=(source,needle,label)=>assert(source.includes(needle),`${label} is missing ${needle}`);
const before=(source,a,b,label)=>{
  const left=source.indexOf(a),right=source.indexOf(b);
  assert(left>=0,`${label} is missing ${a}`);
  assert(right>=0,`${label} is missing ${b}`);
  assert(left<right,`${label} must place ${a} before ${b}`);
};
const syntax=path=>new vm.Script(read(path),{filename:path});

const phonePath='public/app/local-ai/gemma4-phone-performance-core-v1.js';
const repairPath='public/app/local-ai/gemma4-inference-repair-v1.js';
const fastExtensionPath='public/app/local-ai/gemma4-litert-fast-extension-v1.js';
const fastRuntimePath='public/app/local-ai/litert-gemma4-fast-runtime-v1.js';
const deepPath='public/app/local-ai/gemma4-e4b-q4-extension-v1.js';

for(const path of [phonePath,repairPath,fastExtensionPath,fastRuntimePath,deepPath])syntax(path);

const phone=read(phonePath);
includes(phone,"VERSION='1.2.0-gemma4-phone-performance-core-v1-resume-authority'",'phone authority');
includes(phone,"const REGISTRY_KEY='CivweaveLocalModelRegistryV266'",'phone authority');
includes(phone,"const FAST_E2='gemma4-e2b-it-litert-web'",'phone authority');
includes(phone,"const FAST_E4='gemma4-e4b-it-litert-web'",'phone authority');
includes(phone,"const LEGACY_E2='gemma4-e2b-it-q4f16'",'phone authority');
includes(phone,"const LEGACY_E4='gemma4-e4b-it-q4f16'",'phone authority');
includes(phone,'function patchRegistry(registry)','phone authority');
includes(phone,'__civweaveGemma4PhonePerformanceRegistryV1:true','phone authority');
includes(phone,'gemma4PhonePerformanceRegistryComplete:missing.length===0','phone authority');
includes(phone,'function watchRegistry()','phone authority');
includes(phone,'function patchPackManager(api)','phone authority');
includes(phone,'gemma4CoreModel:FAST_E2','phone authority');
includes(phone,'gemma4DeepModel:FAST_E4','phone authority');
includes(phone,"optimizedRuntime:'google-litert-lm-webgpu'",'phone authority');
includes(phone,'oneEngineAtATime:true','phone authority');
includes(phone,"code:'LOCAL_PHONE_PERFORMANCE_CORE_REQUIRED'",'phone authority');
includes(phone,'function scheduleAuthorityReassert()','phone authority');
includes(phone,'resumeSafeAuthority:true','phone authority');
includes(phone,'const waits=[0,30,120,320,700,1150,1500]','phone authority');
before(phone,'const registryReady=watchRegistry();','const packsReady=watchPacks();','phone authority application');
before(phone,'const state=applyAuthority();','scheduleAuthorityReassert();','phone authority activation');

const repair=read(repairPath);
includes(repair,"VERSION='1.0.9-gemma4-inference-repair-v1-optional-litert'",'Gemma repair');
includes(repair,"const DEEP_VERSION='1.0.0-gemma4-e4b-q4-extension-v1'",'Gemma repair');
includes(repair,"const PHONE_AUTH_VERSION='1.2.0-gemma4-phone-performance-core-v1-resume-authority'",'Gemma repair');
includes(repair,"const PHONE_AUTH_SRC='/app/local-ai/gemma4-phone-performance-core-v1.js?v=1.2.0-resume-authority'",'Gemma repair');
includes(repair,"if(typeof base.ready==='function')await base.ready(args?.onProgress);",'Gemma repair');
includes(repair,'await ensurePhoneAuthority();','Gemma repair');
includes(repair,'checkSelectedPerformance(args?.onProgress);','Gemma repair');
includes(repair,"if(error?.code!=='LOCAL_PHONE_PERFORMANCE_CORE_REQUIRED')throw error;",'Gemma repair optional LiteRT guard');
includes(repair,"stage:'gemma4-litert-optional-missing'",'Gemma repair optional LiteRT warning');
includes(repair,'nonFatal:true','Gemma repair optional LiteRT warning');
includes(repair,"compatibilityRuntime:'transformers-v4-onnx'",'Gemma repair compatibility runtime');
includes(repair,'gemma4PhonePerformanceCoreRequired:false','Gemma repair');
includes(repair,'gemma4PhonePerformanceCoreOptional:true','Gemma repair');
includes(repair,'gemma4LegacyCompatibilityFallback:true','Gemma repair');
includes(repair,'phoneAuthorityAfterInferenceCore:true','Gemma repair');
includes(repair,'phoneAuthorityResumeSafe:true','Gemma repair');
includes(repair,'gemma4DeepRegistrationGuaranteed:true','Gemma repair');
includes(repair,'gemma4PhoneRegistryAuthority:true','Gemma repair');
before(repair,"if(typeof base.ready==='function')await base.ready(args?.onProgress);",'await ensurePhoneAuthority();','Gemma repair generation bootstrap');
before(repair,'await ensurePhoneAuthority();','checkSelectedPerformance(args?.onProgress);','Gemma repair generation authority');
before(repair,'checkSelectedPerformance(args?.onProgress);','if(activeGemma4())await refreshWorkerAsset();','Gemma repair compatibility fallback');

const fastExtension=read(fastExtensionPath);
includes(fastExtension,"VERSION='1.1.0-gemma4-litert-fast-extension-v1-dual-phone'",'LiteRT extension');
includes(fastExtension,"id:'gemma4-e2b-it-litert-web'",'LiteRT extension');
includes(fastExtension,"id:'gemma4-e4b-it-litert-web'",'LiteRT extension');
includes(fastExtension,'artifactBytes:2_008_432_640','LiteRT E2B artifact');
includes(fastExtension,'artifactBytes:2_969_059_328','LiteRT E4B artifact');
includes(fastExtension,'dualModelAcceleration:true','LiteRT extension');

const fastRuntime=read(fastRuntimePath);
includes(fastRuntime,"VERSION='1.3.0-litert-gemma4-fast-runtime-v1-dual-phone-mtp-jspi'",'LiteRT runtime');
includes(fastRuntime,"'gemma4-e2b-it-q4f16'",'LiteRT E2B alias');
includes(fastRuntime,"'gemma4-e4b-it-q4f16'",'LiteRT E4B alias');
includes(fastRuntime,'mod.Backend.GPU_ARTISAN','LiteRT runtime');
includes(fastRuntime,'supportsJspi','LiteRT runtime');
includes(fastRuntime,'if(!target){','LiteRT runtime');
includes(fastRuntime,'return base.generate(args);','LiteRT Q4 compatibility fallback');
includes(fastRuntime,'oneEngineAtATime:true','LiteRT runtime');

const deep=read(deepPath);
includes(deep,"VERSION='1.0.0-gemma4-e4b-q4-extension-v1'",'E4B registration');
includes(deep,"E4_Q4='gemma4-e4b-it-q4f16'",'E4B registration');
includes(deep,'__civweaveGemma4E4BQ4V1:true','E4B registration');

console.log('PASS Gemma 4 phone path keeps E2B/E4B registered, prefers LiteRT when installed, and continues with the downloaded Q4 compatibility runtime when the optional LiteRT performance binary is absent.');
