import { pipeline, env } from '/app/vendor/transformers/transformers.min.js';

const MODEL_ID = 'smollm2-360m-instruct';
const MODEL_ROOT = '/app/models/';
const BACKEND_VERSION = 'onnx-r10';
const BACKEND_MJS = new URL(`/app/vendor/transformers/wasm/ort-wasm-simd-threaded.jsep.mjs?v=${BACKEND_VERSION}`, self.location.origin).href;
const BACKEND_WASM = new URL(`/app/vendor/transformers/wasm/ort-wasm-simd-threaded.jsep.wasm?v=${BACKEND_VERSION}`, self.location.origin).href;
let generatorPromise = null;

function serializeError(error) {
  return {
    name: error?.name || 'Error',
    message: String(error?.message || error || 'Unknown SmolLM2 worker error'),
    code: error?.code || null,
    stack: String(error?.stack || '').slice(0, 5000),
  };
}

function cleanGenerated(candidate) {
  const generated = candidate?.generated_text ?? candidate?.text ?? candidate;
  if (Array.isArray(generated)) {
    const last = generated.at(-1);
    return String(last?.content ?? last?.text ?? '');
  }
  return String(generated ?? '');
}

async function verifyBackendResponse(url, kind) {
  const response = await fetch(url, { cache: 'reload' });
  if (!response.ok) throw new Error(`${kind} backend asset returned HTTP ${response.status}: ${url}`);
  const type = String(response.headers.get('content-type') || '').toLowerCase();
  if (kind === 'mjs' && !/(javascript|ecmascript|module)/.test(type)) {
    const preview = (await response.clone().text()).slice(0, 120).replace(/\s+/g, ' ');
    throw new Error(`ONNX Runtime loader was served as ${type || 'an unknown MIME type'} instead of JavaScript. Response begins: ${preview}`);
  }
  if (kind === 'wasm' && !/^application\/wasm(?:;|$)/.test(type)) {
    throw new Error(`ONNX Runtime binary was served as ${type || 'an unknown MIME type'} instead of application/wasm.`);
  }
  return { url, type, bytes: Number(response.headers.get('content-length') || 0) };
}

async function configureRuntime() {
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  env.localModelPath = MODEL_ROOT;
  env.useWasmCache = false;
  env.cacheKey = `commonweave-smollm2-${BACKEND_VERSION}`;
  if (env.backends?.onnx?.wasm) {
    env.backends.onnx.wasm.wasmPaths = { mjs: BACKEND_MJS, wasm: BACKEND_WASM };
    env.backends.onnx.wasm.numThreads = self.crossOriginIsolated ? Math.max(1, Math.min(4, navigator.hardwareConcurrency || 1)) : 1;
    env.backends.onnx.wasm.initTimeout = 120000;
  }
  const backend = await Promise.all([
    verifyBackendResponse(BACKEND_MJS, 'mjs'),
    verifyBackendResponse(BACKEND_WASM, 'wasm'),
  ]);
  self.postMessage({ type: 'progress', progress: { status: 'backend-verified', backend } });
}

async function createGenerator(device) {
  self.postMessage({ type: 'progress', progress: { status: 'backend-start', device, mjs: BACKEND_MJS, wasm: BACKEND_WASM } });
  const generator = await pipeline('text-generation', MODEL_ID, {
    device,
    dtype: 'q4f16',
    local_files_only: true,
    progress_callback(progress) {
      self.postMessage({ type: 'progress', progress: { ...progress, device } });
    },
  });
  return { generator, device };
}

async function loadGenerator() {
  if (generatorPromise) return generatorPromise;
  generatorPromise = (async () => {
    await configureRuntime();
    const attempts = navigator.gpu ? ['webgpu', 'wasm'] : ['wasm'];
    const failures = [];

    for (const device of attempts) {
      try {
        return await createGenerator(device);
      } catch (error) {
        failures.push({ device, error: serializeError(error) });
        self.postMessage({ type: 'progress', progress: { status: 'backend-failed', device, message: String(error?.message || error) } });
      }
    }

    const summary = failures.map(item => `[${item.device}] ${item.error.message}`).join(' | ');
    const error = new Error(`No available SmolLM2 backend completed initialization. ${summary}`);
    error.code = 'SMOLLM2_BACKEND_UNAVAILABLE';
    error.failures = failures;
    throw error;
  })().catch(error => {
    generatorPromise = null;
    throw error;
  });
  return generatorPromise;
}

self.addEventListener('message', async event => {
  const message = event.data || {};
  if (message.type !== 'generate' || !message.id) return;
  try {
    const { generator, device } = await loadGenerator();
    const output = await generator(message.messages || [], {
      max_new_tokens: Math.max(32, Math.min(640, Number(message.maxNewTokens || 320))),
      do_sample: false,
      temperature: 0,
      repetition_penalty: 1.06,
      return_full_text: false,
    });
    const candidate = Array.isArray(output) ? output[0] : output;
    self.postMessage({
      type: 'result',
      id: message.id,
      text: cleanGenerated(candidate),
      device,
    });
  } catch (error) {
    self.postMessage({ type: 'error', id: message.id, error: serializeError(error) });
  }
});
