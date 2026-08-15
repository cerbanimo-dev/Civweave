const DEFAULT_ENDPOINT = 'http://127.0.0.1:9222';

function normalizeEndpoint(endpoint = DEFAULT_ENDPOINT) {
  const url = new URL(endpoint);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`Unsupported CDP endpoint protocol: ${url.protocol}`);
  }
  return url.toString().replace(/\/$/, '');
}

export async function listTargets(endpoint = DEFAULT_ENDPOINT, fetchImpl = fetch) {
  const base = normalizeEndpoint(endpoint);
  const response = await fetchImpl(`${base}/json/list`, { signal: AbortSignal.timeout(3000) });
  if (!response.ok) throw new Error(`CDP target listing failed: HTTP ${response.status}`);
  const targets = await response.json();
  if (!Array.isArray(targets)) throw new Error('CDP target listing returned a non-array response');
  return targets
    .filter((target) => target && target.webSocketDebuggerUrl)
    .map((target) => ({
      id: target.id,
      type: target.type,
      title: target.title,
      url: target.url,
      webSocketDebuggerUrl: target.webSocketDebuggerUrl,
    }));
}

export async function resolveTarget({ endpoint = DEFAULT_ENDPOINT, targetId, urlIncludes, fetchImpl = fetch, waitForTargetMs = 2000 } = {}) {
  const deadline = Date.now() + Math.max(0, Math.min(waitForTargetMs, 10_000));
  let targets = [];
  do {
    targets = await listTargets(endpoint, fetchImpl);
    let target;
    if (targetId) target = targets.find((candidate) => candidate.id === targetId);
    else if (urlIncludes) target = targets.find((candidate) => candidate.url?.includes(urlIncludes));
    else target = targets.find((candidate) => candidate.type === 'page') ?? targets[0];
    if (target) return target;
    if (Date.now() >= deadline) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  } while (true);
  const available = targets.map((candidate) => `${candidate.id}:${candidate.url || '(loading)'}`).join(', ');
  throw new Error(`No debuggable browser target matched the request${available ? `; available targets: ${available}` : ''}`);
}

export class CdpClient {
  constructor(wsUrl, { WebSocketImpl = globalThis.WebSocket } = {}) {
    if (!WebSocketImpl) throw new Error('WebSocket is unavailable in this Node runtime');
    this.ws = new WebSocketImpl(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.openPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out connecting to CDP WebSocket')), 3000);
      this.ws.addEventListener('open', () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
      this.ws.addEventListener('error', () => {
        clearTimeout(timer);
        reject(new Error('Failed to connect to CDP WebSocket'));
      }, { once: true });
    });
    this.ws.addEventListener('message', (event) => this.#handleMessage(event.data));
    this.ws.addEventListener('close', () => {
      for (const { reject } of this.pending.values()) reject(new Error('CDP WebSocket closed'));
      this.pending.clear();
    });
  }

  async ready() {
    await this.openPromise;
    return this;
  }

  async call(method, params = {}, { timeoutMs = 5000 } = {}) {
    await this.ready();
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    const boundedTimeout = Math.max(100, Math.min(Number(timeoutMs) || 5000, 30000));
    const result = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP call timed out after ${boundedTimeout}ms: ${method}`));
      }, boundedTimeout);
      this.pending.set(id, {
        resolve: (value) => { clearTimeout(timer); resolve(value); },
        reject: (error) => { clearTimeout(timer); reject(error); },
      });
    });
    this.ws.send(payload);
    return await result;
  }

  on(method, handler) {
    const handlers = this.listeners.get(method) ?? new Set();
    handlers.add(handler);
    this.listeners.set(method, handlers);
    return () => handlers.delete(handler);
  }

  async close() {
    try { this.ws.close(); } catch {}
  }

  #handleMessage(raw) {
    let message;
    try { message = JSON.parse(typeof raw === 'string' ? raw : String(raw)); }
    catch { return; }
    if (message.id) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message || `CDP error ${message.error.code}`));
      else pending.resolve(message.result ?? {});
      return;
    }
    if (message.method) {
      for (const handler of this.listeners.get(message.method) ?? []) {
        try { handler(message.params ?? {}); } catch {}
      }
    }
  }
}

export async function connectToTarget(options = {}) {
  const target = await resolveTarget(options);
  const client = await new CdpClient(target.webSocketDebuggerUrl, options).ready();
  return { client, target };
}
