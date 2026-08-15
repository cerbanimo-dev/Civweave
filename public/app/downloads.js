const MODEL_CACHE='civweave-minilm';
const MODEL_FILES=[
  '/app/models/all-minilm-l6-v2/config.json',
  '/app/models/all-minilm-l6-v2/tokenizer_config.json',
  '/app/models/all-minilm-l6-v2/vocab.txt',
  '/app/models/all-minilm-l6-v2/reflex-index.json',
  '/app/models/all-minilm-l6-v2/onnx/model_quantized.onnx',
  '/app/vendor/onnxruntime/ort.wasm.min.mjs',
  '/app/vendor/onnxruntime/ort-wasm-simd-threaded.mjs',
  '/app/vendor/onnxruntime/ort-wasm-simd-threaded.wasm'
];
let installPrompt=null;
const $=selector=>document.querySelector(selector);
function message(selector,text){const node=$(selector);if(node)node.textContent=text}
async function modelStatus(){const cache=await caches.open(MODEL_CACHE),keys=await cache.keys(),present=new Set(keys.map(request=>new URL(request.url).pathname));const count=MODEL_FILES.filter(file=>present.has(file)).length;$('#minilm-progress').value=Math.round(count/MODEL_FILES.length*100);message('#minilm-status',count===MODEL_FILES.length?'MiniLM is installed.':`${count} of ${MODEL_FILES.length} package files are installed.`);return count===MODEL_FILES.length}
async function installModel(){const cache=await caches.open(MODEL_CACHE);let done=0;for(const file of MODEL_FILES){message('#minilm-status',`Downloading ${file.split('/').pop()}…`);const response=await fetch(file,{cache:'no-store'});if(!response.ok)throw new Error(`${file} returned ${response.status}`);await cache.put(file,response.clone());done+=1;$('#minilm-progress').value=Math.round(done/MODEL_FILES.length*100)}message('#minilm-status','MiniLM is installed. It remains separate from generative model startup.')}
async function refreshShell(){if(!('serviceWorker'in navigator))throw new Error('Service workers are unavailable in this browser.');const registration=await navigator.serviceWorker.register('/service-worker.js');await registration.update();message('#shell-status','Current shell refreshed. No historical source was installed.')}
addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;message('#shell-status','Civweave can be installed on this device.')});
addEventListener('appinstalled',()=>{installPrompt=null;message('#shell-status','Civweave is installed.')});
$('#install-app')?.addEventListener('click',async()=>{if(installPrompt){await installPrompt.prompt();const choice=await installPrompt.userChoice;message('#shell-status',`Install ${choice.outcome}.`);installPrompt=null;return}message('#shell-status','Use your browser’s Install app / Add to Home screen command if the install prompt is not currently available.')});
$('#refresh-shell')?.addEventListener('click',()=>refreshShell().catch(error=>message('#shell-status',error.message)));
$('#install-minilm')?.addEventListener('click',()=>installModel().catch(error=>message('#minilm-status',`MiniLM download failed: ${error.message}`)));
$('#remove-minilm')?.addEventListener('click',async()=>{await caches.delete(MODEL_CACHE);await modelStatus()});
$('#clear-runtime-cache')?.addEventListener('click',async()=>{const keys=await caches.keys();const targets=keys.filter(key=>key.startsWith('civweave-runtime'));await Promise.all(targets.map(key=>caches.delete(key)));message('#cache-status',`Cleared ${targets.length} current runtime cache${targets.length===1?'':'s'}. User state and MiniLM were left alone.`)});
if('serviceWorker'in navigator)navigator.serviceWorker.register('/service-worker.js').then(()=>message('#shell-status','Current app shell is available.')).catch(error=>message('#shell-status',error.message));
modelStatus().catch(error=>message('#minilm-status',error.message));
