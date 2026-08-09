import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [manager,settings,broker,spine,registry,runtime,bridge,bootstrap,localWorker,backgroundWorker,sw,cloudflare,campus,pulse]=await Promise.all([
  read('public/app/local-ai/download-manager-v267.js'),
  read('public/app/local-ai/settings-panel-v267.js'),
  read('public/app/ai-capability-broker-v268.js'),
  read('public/app/fast-interactive-runtime-v192.js'),
  read('public/app/local-ai/model-registry-v266.js'),
  read('public/app/local-ai/runtime-v266.js'),
  read('public/app/local-ai/runtime-bridge-v266.js'),
  read('public/app/local-ai/bootstrap-v266.js'),
  read('public/app/local-ai/worker-v266.js'),
  read('public/service-worker-local-model-download-v267.js'),
  read('public/service-worker-v203.js'),
  read('scripts/build-cloudflare-pages.mjs'),
  read('public/app/working-campus-v156.part5.txt'),
  read('public/app/local-ai/test-pulse-v269.js')
]);

for(const source of [manager,settings,broker,spine,registry,runtime,bridge,bootstrap,localWorker,backgroundWorker,sw,pulse])new Function(source);
new Function(campus.replace(/\}\)\(\);\s*$/,''));

const checks=[];
const check=(name,value)=>{assert.ok(value,name);checks.push(name)};
check('download manager exposes byte progress',manager.includes('bytesDownloaded')&&manager.includes('percent')&&manager.includes('ReadableStream'));
check('download manager uses Background Fetch when available',manager.includes('backgroundFetch.fetch')&&manager.includes("mode:'background-fetch'"));
check('download manager keeps foreground fallback resumable by completed cached files',manager.includes("status:'paused'")&&manager.includes('Tap Resume'));
check('download manager validates cached JSON metadata',manager.includes('validateArtifactResponse')&&manager.includes("reason:'invalid-json'")&&manager.includes("reason:'html'"));
check('download manager evicts corrupt artifacts without deleting good weights',manager.includes('await c.delete(u)')&&manager.includes('corrupt:true'));
check('download manager exposes targeted repair',manager.includes('async function repair(')&&manager.includes('repair,remove,cancel'));
check('download manager sizes storage need from missing artifacts',manager.includes('missingBytes=current.missing.reduce'));
check('settings shows percent progress bar',settings.includes('cw-model-progress')&&settings.includes('${p}%'));
check('settings leaves a persistent download dock outside modal',settings.includes('cw-local-ai-download-dock-v267')&&settings.includes('renderDock'));
check('background service worker rejects HTML and invalid JSON before cache copy',backgroundWorker.includes('returned HTML instead of model data')&&backgroundWorker.includes('invalid JSON model metadata')&&backgroundWorker.indexOf('validateRecord(record,response)')<backgroundWorker.indexOf('cache.put(record.request,response)'));
check('root service worker imports local model background worker',sw.includes('/service-worker-local-model-download-v267.js'));
check('local inference worker preserves pinned cache adapter without synthetic 404 cache hits',localWorker.includes('hf.env.customCache=cacheAdapter(cache,spec)')&&!localWorker.includes("status:404,statusText:'Downloaded model cache miss'")&&localWorker.includes('Downloaded model cache miss: ${path}'));
check('local inference worker provides valid placeholders only for optional metadata',localWorker.includes("const body=/\\.json$/i.test(path)?'{}':''")&&localWorker.includes("'x-civweave-model-cache':'optional-placeholder'"));
check('local inference worker constructs TextStreamer',localWorker.includes('new hfRuntime.TextStreamer')&&localWorker.includes('callback_function'));
check('local inference worker emits incremental token messages',localWorker.includes("post(id,'token'")&&localWorker.includes('streamed:Boolean(streamer)'));
check('local runtime preserves cache-resolved worker and carries token callbacks',runtime.includes("worker-v266.js?v=1.0.68-v274")&&runtime.includes("message.type==='token'")&&runtime.includes('task.onToken?.(message.token)')&&runtime.includes('stream:Boolean(stream)'));
check('local runtime passes artifact requiredness into the cache-only worker',runtime.includes('const artifacts=(spec.artifacts||[]).map')&&runtime.includes('required:item.required!==false'));
check('local bridge emits shared partial model events',bridge.includes("emit('partial'")&&bridge.includes("'civweave:model-event'")&&bridge.includes('accumulatedText'));
check('local bridge reports actual streaming use',bridge.includes("code:'LOCAL_STREAMING'")&&bridge.includes('used:Boolean(run.streamed)'));
check('raw pulse repairs corrupt metadata before inference',pulse.includes('integrityReady')&&pulse.includes('M().repair')&&pulse.includes('invalid cached model metadata'));
check('raw pulse streams visible direct model output',pulse.includes('onToken:token=>')&&pulse.includes('stream:true')&&pulse.includes('streaming directly from the local worker'));
check('raw pulse distinguishes model load failure from inference failure',pulse.includes("stage==='load failed'")&&pulse.includes('Inference never started'));
check('Cloudflare build stages Transformers runtime before copy',cloudflare.includes('stage-transformers-assets.mjs')&&cloudflare.includes('Required local-AI runtime asset was not staged'));
check('Cloudflare build requires local inference entry and WebGPU wasm',cloudflare.includes('transformers.min.js')&&cloudflare.includes('ort-wasm-simd-threaded.jsep.wasm'));
check('capability broker separates semantic-local from deterministic',broker.includes("return'semantic-local'")&&broker.includes("authority:'deterministic-contracts'"));
check('capability broker exposes legacy tool-overclaim normalization',broker.includes('function normalizeRequest(')&&broker.includes('legacy realm marked agentic reasoning as tool use without tool evidence'));
check('runtime spine applies capability normalization before middleware',spine.includes("id:'capability-normalizer'")&&spine.includes('normalizeRequest')&&spine.includes('__civweaveRuntimeSpineV271:true'));
check('registry declares per-model capabilities',registry.includes('capabilities:caps')&&registry.includes('agenticReasoning:true')&&registry.includes('externalResearch:false'));
check('small local model remains interactive but not agentic',registry.includes("id:'qwen3-0.6b-q4f16'")&&registry.includes('agenticReasoning:false'));
check('local bridge registers v271 runtime spine handler',bridge.includes("MIDDLEWARE_ID='downloaded-local-v271'")&&bridge.includes('runtimeSpine.register(MIDDLEWARE_ID,middleware(),100)'));
check('local bridge escalates unsupported capabilities through the spine base path',bridge.includes('if(!decision.useLocal)')&&bridge.includes('return null'));
check('bootstrap preserves cache-resolved inference and adds streaming repair',bootstrap.includes('cacheResolvedInference:true')&&bootstrap.includes('localStreaming:true')&&bootstrap.includes('integrityRepair:true')&&bootstrap.includes('agenticToolSemantics:true'));
check('Working Campus waits for local bootstrap before selected local chat',campus.includes('if(localSelection.active){await ensureDownloadedLocalAISettings()')&&campus.includes('CivweaveLocalModelBridgeV266?.patch?.()'));
check('Working Campus refuses silent local-contract substitution',campus.includes("result?.provider==='local-contract'")&&campus.includes('did not substitute deterministic chat'));

const listeners=new Map();
const context={console,globalThis:null,localStorage:{getItem:()=>null,setItem:()=>{}},addEventListener:(name,fn)=>{const rows=listeners.get(name)||[];rows.push(fn);listeners.set(name,rows)},dispatchEvent:()=>true,CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail;}}};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(broker,context,{filename:'ai-capability-broker-v268.js'});
const capability=context.CivweaveAICapabilityBrokerV268;
const localReasoning=capability.normalizeRequest({purpose:'threat-model',executionProfile:'agentic',background:true,requiresTools:true,config:{service:'anarchadia'},messages:[{role:'user',content:'Review this local charter diff for abuse paths.'}]});
assert.equal(localReasoning.requiresTools,false);
assert.equal(capability.requirements(localReasoning).profile,'agentic');
assert.equal(capability.requirements(localReasoning).requiresTools,false);
const live=capability.normalizeRequest({purpose:'research',executionProfile:'agentic',background:true,requiresTools:true,config:{service:'fellowfare'},messages:[{role:'user',content:'Search the web for live external sources about current local prices.'}]});
assert.equal(live.requiresTools,true);
const explicit=capability.normalizeRequest({purpose:'market-scan',executionProfile:'agentic',requiresTools:true,capabilityRequirements:{profile:'agentic',requiresTools:true},config:{service:'fellowfare'}});
assert.equal(explicit.requiresTools,true);
checks.push('agentic/tool normalization executable cases');

console.log(JSON.stringify({ok:true,revision:'local-model-streaming-v274-cache-only',checks:checks.length,features:{cacheResolvedInference:true,synthetic404RegressionBlocked:true,optionalMetadataSafe:true,integrityValidation:true,targetedRepair:true,loaderDiagnostics:true,localStreaming:true,capabilityRouting:true,runtimeSpine:true,localAgenticReasoning:true,agenticToolSeparation:true,toolEscalation:true}},null,2));
