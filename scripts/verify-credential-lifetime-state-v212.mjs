import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile('public/app/model-settings-controller-v173.js', 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

class MemoryStorage {
  constructor(seed = {}) { this.values = new Map(Object.entries(seed)); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}
class CustomEvent {
  constructor(type, { detail } = {}) { this.type = type; this.detail = detail; }
}
class HTMLElement {}

function boot(localSeed = {}, sessionSeed = {}) {
  const localStorage = new MemoryStorage(localSeed);
  const sessionStorage = new MemoryStorage(sessionSeed);
  const document = {
    documentElement: { dataset: {} },
    getElementById() { return null; },
    querySelector() { return null; },
    head: { append() {} },
    body: { append() {} },
  };
  const sandbox = {
    console,
    Date,
    JSON,
    localStorage,
    sessionStorage,
    document,
    HTMLElement,
    CustomEvent,
    dispatchEvent() { return true; },
    globalThis: null,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'model-settings-controller-v173.js' });
  return { controller: sandbox.CivweaveModelSettingsControllerV173, localStorage, sessionStorage };
}

const persistent = {
  schema: 'civweave.device-model-secret.v191',
  apiKey: 'AIza-device-test-key-not-real',
  provider: 'gemini',
  savedAt: '2026-08-05T00:00:00.000Z',
};
const retiredProfile = {
  interactive: {
    route: 'bundled',
    provider: 'bundled',
    model: 'Xenova/all-MiniLM-L6-v2',
    endpoint: '/app/models/all-minilm-l6-v2/model-manifest.json',
  },
};

const remembered = boot({
  'civweave-model-persistent-secrets-v191': JSON.stringify(persistent),
  'civweave-model-profiles-v1': JSON.stringify(retiredProfile),
});
const rememberedState = remembered.controller.readState();
assert(rememberedState.remembered === true, 'Remembered credential was not detected.');
assert(rememberedState.credentialMode === 'device', 'Retired MiniLM profile reset remembered lifetime to session.');
assert(remembered.localStorage.getItem('civweave-model-credential-policy-v191') === 'device', 'Restore did not keep the device policy canonical.');

const sessionOnly = boot({
  'civweave-model-profiles-v1': JSON.stringify(retiredProfile),
  'civweave-model-credential-policy-v191': 'session',
});
assert(sessionOnly.controller.readState().credentialMode === 'session', 'Session-only profile should remain session-only without a durable credential.');

console.log(JSON.stringify({
  ok: true,
  revision: 'v212-credential-lifetime-state',
  rememberedRetiredProfile: 'device',
  noRememberedCredential: 'session',
}, null, 2));
