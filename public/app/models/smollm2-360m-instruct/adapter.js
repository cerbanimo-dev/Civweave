const MODEL_ID = 'HuggingFaceTB/SmolLM2-360M-Instruct';
const LOCAL_ID = 'smollm2-360m-instruct';
const MODEL_ROOT = '/app/models/smollm2-360m-instruct';
const WORKER_URL = `${MODEL_ROOT}/worker.js`;
const VENDOR_MODULE = '/app/vendor/transformers/transformers.min.js';
const REQUIRED = [
  { url: `${MODEL_ROOT}/config.json`, minBytes: 200 },
  { url: `${MODEL_ROOT}/tokenizer.json`, minBytes: 100000 },
  { url: `${MODEL_ROOT}/tokenizer_config.json`, minBytes: 200 },
  { url: `${MODEL_ROOT}/onnx/model_q4f16.onnx`, minBytes: 250000000 },
  { url: VENDOR_MODULE, minBytes: 100000 },
];

let worker = null;
let sequence = 0;
const pending = new Map();
const progressListeners = new Set();

function packageError(message, cause) {
  const error = new Error(message);
  error.code = 'SMOLLM2_PACKAGE_MISSING';
  if (cause) error.cause = cause;
  return error;
}

function getWorker() {
  if (worker) return worker;
  try {
    worker = new Worker(WORKER_URL, { type: 'module', name: 'commonweave-smollm2' });
  } catch (error) {
    throw packageError(`SmolLM2 could not start its module worker at ${WORKER_URL}.`, error);
  }
  worker.addEventListener('message', event => {
    const message = event.data || {};
    if (message.type === 'progress') {
      for (const listener of progressListeners) {
        try { listener(message.progress); } catch {}
      }
      return;
    }
    if (!message.id || !pending.has(message.id)) return;
    const task = pending.get(message.id);
    pending.delete(message.id);
    clearTimeout(task.timer);
    if (message.type === 'result') {
      task.resolve({ text: String(message.text || ''), device: message.device || 'unknown' });
      return;
    }
    const error = new Error(message.error?.message || 'SmolLM2 generation failed.');
    error.code = message.error?.code || 'SMOLLM2_GENERATION_FAILED';
    error.stack = message.error?.stack || error.stack;
    task.reject(error);
  });
  worker.addEventListener('error', event => {
    const error = packageError(event.message || 'SmolLM2 worker crashed.');
    for (const task of pending.values()) {
      clearTimeout(task.timer);
      task.reject(error);
    }
    pending.clear();
    worker?.terminate();
    worker = null;
  });
  return worker;
}

async function inspect(spec) {
  const { url, minBytes } = spec;
  try {
    const cached = 'caches' in globalThis ? await caches.match(url) : null;
    if (cached) {
      const length = Number(cached.headers.get('content-length') || 0);
      return { url, ok: cached.ok && length >= minBytes, status: cached.status, length, minBytes, source: 'cache' };
    }
    const response = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    const length = Number(response.headers.get('content-length') || 0);
    return { url, ok: response.ok && length >= minBytes, status: response.status, length, minBytes, source: 'network' };
  } catch (error) {
    return { url, ok: false, status: 0, length: 0, minBytes, source: 'error', error: error.message };
  }
}

export async function status() {
  const files = await Promise.all(REQUIRED.map(inspect));
  const missing = files.filter(file => !file.ok);
  return {
    available: missing.length === 0,
    id: MODEL_ID,
    localId: LOCAL_ID,
    source: 'transformers-js-worker',
    files,
    missing,
    remoteDownloadsAllowed: false,
  };
}

export function onProgress(listener) {
  progressListeners.add(listener);
  return () => progressListeners.delete(listener);
}

export async function generate({ messages, maxNewTokens = 320, timeoutMs = 180000 } = {}) {
  const active = getWorker();
  const id = `smol-${Date.now().toString(36)}-${(++sequence).toString(36)}`;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      const error = new Error(`SmolLM2 did not answer within ${Math.round(timeoutMs / 1000)} seconds.`);
      error.code = 'SMOLLM2_TIMEOUT';
      reject(error);
    }, Math.max(10000, Number(timeoutMs || 180000)));
    pending.set(id, { resolve, reject, timer });
    active.postMessage({ type: 'generate', id, messages: Array.isArray(messages) ? messages : [], maxNewTokens });
  });
}

export async function benchmark(cases, options = {}) {
  const startedAt = performance.now();
  const results = [];
  for (const item of Array.isArray(cases) ? cases : []) {
    const caseStarted = performance.now();
    try {
      const generated = await generate({
        messages: item.messages,
        maxNewTokens: item.maxNewTokens || options.maxNewTokens || 220,
        timeoutMs: options.timeoutMs || 180000,
      });
      results.push({
        id: item.id,
        ok: true,
        text: generated.text,
        device: generated.device,
        elapsedMs: Math.round(performance.now() - caseStarted),
      });
    } catch (error) {
      results.push({ id: item.id, ok: false, error: error.message, code: error.code || null, elapsedMs: Math.round(performance.now() - caseStarted) });
    }
  }
  return {
    id: MODEL_ID,
    total: results.length,
    passed: results.filter(result => result.ok).length,
    elapsedMs: Math.round(performance.now() - startedAt),
    results,
  };
}
