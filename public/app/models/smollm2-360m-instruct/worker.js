import { pipeline, env } from '/app/vendor/transformers/transformers.min.js';

const MODEL_ID = 'smollm2-360m-instruct';
const MODEL_ROOT = '/app/models/';
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

async function loadGenerator() {
  if (generatorPromise) return generatorPromise;
  generatorPromise = (async () => {
    env.allowRemoteModels = false;
    env.allowLocalModels = true;
    env.localModelPath = MODEL_ROOT;
    if (env.backends?.onnx?.wasm) {
      env.backends.onnx.wasm.wasmPaths = '/app/vendor/transformers/wasm/';
      env.backends.onnx.wasm.numThreads = self.crossOriginIsolated ? Math.max(1, Math.min(4, navigator.hardwareConcurrency || 1)) : 1;
    }
    const device = navigator.gpu ? 'webgpu' : 'wasm';
    const generator = await pipeline('text-generation', MODEL_ID, {
      device,
      dtype: 'q4f16',
      local_files_only: true,
      progress_callback(progress) {
        self.postMessage({ type: 'progress', progress });
      },
    });
    return { generator, device };
  })();
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
