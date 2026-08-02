import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const [loom,realm,lite,settings,assistant,adapter,hologram,worker,liteOverride]=await Promise.all([
  read('public/app/loom-v128.html'),
  read('public/app/realm-v128.html'),
  read('public/app/lite-v129.html'),
  read('public/app/model-settings-v133.js'),
  read('public/app/assistant-runtime-v133.js'),
  read('public/app/models/functiongemma-270m-it/adapter.js'),
  read('public/app/weaveling-hologram-v133.css'),
  read('public/service-worker.js'),
  read('public/app/lite-model-settings-v133.js')
]);
const manifest=JSON.parse(await read('public/app/models/functiongemma-270m-it/model-manifest.json'));

for(const [name,html] of [['loom',loom],['realm',realm]]){
  for(const required of ['commonweave-model-runtime.js','model-settings-v133.js','assistant-runtime-v133.js'])assert(html.includes(required),`${name} is missing ${required}`);
  assert(!html.includes('visual-model-settings-v132.js'),`${name} still loads the superseded Visual model modal`);
  assert(html.indexOf('commonweave-model-runtime.js')<html.indexOf('model-settings-v133.js'),`${name} settings load before the model runtime`);
  assert(html.indexOf('model-settings-v133.js')<html.indexOf('assistant-runtime-v133.js'),`${name} assistant loads before settings migration`);
}
assert(loom.includes('weaveling-hologram-v133.css'),'the Quad does not load hologram styling');
for(const required of ['model-settings-v133.css','model-settings-v133.js','lite-model-settings-v133.js'])assert(lite.includes(required),`Lite is missing ${required}`);
assert(lite.indexOf('model-settings-v131.js')<lite.indexOf('lite-model-settings-v133.js'),'Lite v133 override loads before the older renderer exists');
assert(liteOverride.includes("commonweave.model-setup"),'Lite model setup is not overridden');

assert(settings.includes('<option value="bundled">Bundled FunctionGemma 270M</option>'),'bundled FunctionGemma route is missing');
assert(!settings.includes('<option value="deterministic"'),'deterministic route is still user-selectable');
for(const required of ['Gemini API key','https://generativelanguage.googleapis.com/v1beta','antigravity','sessionStorage','saveSessionSecret','detectCapabilities'])assert(settings.includes(required),`settings are missing ${required}`);
assert(settings.includes("provider:'bundled'"),'bundled route is not persisted as a provider');

assert(manifest.id==='google/functiongemma-270m-it','unexpected bundled model id');
assert(Number(manifest.parameterCount)>0&&Number(manifest.parameterCount)<=500_000_000,'bundled model exceeds the 500M parameter ceiling');
assert(manifest.remoteDownloadsAllowed===false,'bundled model permits remote downloads');
for(const required of ['allowRemoteModels=false','localModelPath=MODEL_ROOT','MICRO_MODEL_PACKAGE_MISSING','webgpu','wasm'])assert(adapter.includes(required),`local model adapter is missing ${required}`);

for(const required of ['commonweave.structured-context.v1','routingQuestion','routingAnswer','responseContract','CommonweaveModelRuntime','modelRuntime.generate','RESPONSE_SCHEMA','outputJson','fallback-to-micro'])assert(assistant.includes(required),`assistant runtime is missing ${required}`);
assert(!assistant.includes('request.deterministic'),'assistant runtime still invokes the deterministic provider');
assert(assistant.includes("event.stopImmediatePropagation()"),'assistant does not replace the legacy deterministic submit handler');
assert(assistant.includes("selectedConfig().provider!=='bundled'"),'selected provider does not fall back to the bundled model');

for(const required of ['.cw127-weaveling::before','.cw127-weaveling::after','clip-path:polygon','mix-blend-mode:screen','cw133BeamPulse'])assert(hologram.includes(required),`hologram styling is missing ${required}`);
assert(hologram.includes('bottom:17%'),'Weaveling is not raised into the Quad projection zone');

assert(worker.includes("CACHE_REVISION='micro-ai-r5'"),'service worker cache was not rotated for micro AI');
for(const required of ['assistant-runtime-v133.js','model-settings-v133.js','weaveling-hologram-v133.css','functiongemma-270m-it/model-manifest.json','functiongemma-270m-it/adapter.js'])assert(worker.includes(required),`service worker does not precache ${required}`);
assert(worker.includes("const MODEL_PREFIX='/app/models/'"),'service worker has no model asset policy');

console.log(JSON.stringify({
  ok:true,
  bundledModel:manifest.id,
  parameters:manifest.parameterCount,
  deterministicRouteVisible:false,
  selectedProviderGeneration:true,
  structuredContext:'commonweave.structured-context.v1',
  hologram:'projector-beam',
  cacheRevision:'micro-ai-r5'
},null,2));
