import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const [runtime,index,worker]=await Promise.all([
  readFile('public/app/living-school-terminal-fallback-v1.js','utf8'),
  readFile('public/app/cabinets/living-school/index.html','utf8'),
  readFile('public/service-worker-living-school-cleanroom-v218.js','utf8'),
]);

assert(runtime.includes("const PRIMARY_MODEL='gemini-3.7-flash'"),'terminal fallback must start from Gemini 3.7 Flash');
assert(runtime.includes("const FALLBACK_MODEL='gemini-3.5-flash'"),'terminal fallback must use Gemini 3.5 Flash');
assert(runtime.includes("const FALLBACK_REASON='primary-3.7-error'"),'terminal fallback must cover any primary 3.7 error');
assert(runtime.includes("function primaryFailed(result){return !result||lower(result?.status||'error')!=='success';}"),'terminal fallback must retry any non-successful 3.7 result');
assert(runtime.includes('primary=errorResult(error'),'terminal fallback must convert thrown 3.7 errors into the bounded fallback path');
assert(runtime.includes('if(explicitAbort(error,request))throw error'),'explicit user cancellation must not be mistaken for a model failure');
assert(runtime.includes('const fallback=await spine.generate(fallbackRequest(request));'),'terminal fallback must make exactly one prepared 3.5 retry');
assert(runtime.includes("spine.register(HANDLER_ID,{handle:handleFallback},1000)"),'fallback handler must bypass lower-priority handlers after middleware preparation');
assert(runtime.includes("spine.register(FINALIZER_ID,{before:finalizeFallbackRequest},-100)"),'fallback finalizer must restore 3.5 after other before middleware runs');
assert(!runtime.includes('gemini-3.1-flash-lite'),'terminal curriculum fallback must never use Flash-Lite');
assert(index.includes('/app/living-school-terminal-fallback-v1.js?v=1.0.0-any-3.7-error'),'Living School must load the terminal fallback runtime');
assert(worker.includes("const TERMINAL_FALLBACK='/app/living-school-terminal-fallback-v1.js'"),'clean-room service worker must track the terminal fallback runtime');
assert(worker.includes('GENERATION_BUDGET,TERMINAL_FALLBACK,ACTIVE_RUN_UI'),'terminal fallback must be in the fresh-runtime set');

console.log(JSON.stringify({ok:true,contract:'living-school-terminal-fallback-v1',primary:'gemini-3.7-flash',fallback:'gemini-3.5-flash',fallbackOn:'any-3.7-error',maxFallbackCalls:1,flashLiteFallback:false},null,2));
