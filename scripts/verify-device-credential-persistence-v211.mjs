import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const [source, loom, lite] = await Promise.all([
  readFile('public/app/device-credential-persistence-v211.js', 'utf8'),
  readFile('public/app/loom-v128.html', 'utf8'),
  readFile('public/app/lite-v129.html', 'utf8'),
]);
const assert = (condition, message) => { if (!condition) throw new Error(message); };
for (const html of [loom, lite]) assert(html.includes('/app/device-credential-persistence-v211.js'), 'Live entry is missing the device credential bridge.');
for (const token of ['Remember on this device', 'commonweave-model-persistent-secrets-v191', 'commonweave:model-settings-saved', "document.addEventListener('click',openSettings,true)"]) {
  assert(source.includes(token), `Credential bridge is missing ${token}.`);
}

class MemoryStorage {
  constructor(seed = {}) { this.values = new Map(Object.entries(seed)); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  snapshot() { return Object.fromEntries(this.values); }
}
class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } }
class Element { closest() { return null; } }
function boot(localSeed = {}, sessionSeed = {}) {
  const localStorage = new MemoryStorage(localSeed);
  const sessionStorage = new MemoryStorage(sessionSeed);
  const listeners = new Map();
  const addEventListener = (type, listener) => { const list = listeners.get(type) || []; list.push(listener); listeners.set(type, list); };
  const dispatchEvent = event => { for (const listener of listeners.get(event.type) || []) listener(event); return true; };
  const document = { addEventListener() {}, querySelectorAll() { return []; }, createElement() { throw new Error('No UI should be created in the persistence VM test.'); } };
  const sandbox = {
    console, Date, JSON, URL, location: { href: 'https://commonweave.test/loom/' },
    localStorage, sessionStorage, CustomEvent, Element, document,
    addEventListener, dispatchEvent, queueMicrotask: callback => callback(),
    CommonweaveModelRuntime: { saveSessionSecret() { return true; } },
    globalThis: null,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'device-credential-persistence-v211.js' });
  return { sandbox, localStorage, sessionStorage };
}

const sessionPacket = { apiKey: 'AIza-test-not-real', provider: 'gemini', remoteConsent: true, savedAt: '2026-08-05T00:00:00.000Z' };
const first = boot({
  'commonweave.universal-ai.v127': JSON.stringify({ provider: 'gemini', route: 'gemini', model: 'gemini-test', endpoint: 'https://generativelanguage.googleapis.com/v1beta', consent: true }),
}, { 'commonweave-model-session': JSON.stringify(sessionPacket) });
assert(first.sandbox.CommonweaveDeviceCredentialPersistenceV211.persistFromSession('device'), 'Device persistence did not save the active session key.');
const durable = first.localStorage.getItem('commonweave-model-persistent-secrets-v191');
assert(durable && JSON.parse(durable).apiKey === sessionPacket.apiKey, 'Durable credential record was not written.');

const second = boot(first.localStorage.snapshot(), {});
const restored = JSON.parse(second.sessionStorage.getItem('commonweave-model-session') || '{}');
assert(restored.apiKey === sessionPacket.apiKey, 'Remembered key was not restored after a new browser session.');
assert(restored.remoteConsent === true, 'Remembered remote consent was not restored with the key.');
assert(second.sandbox.CommonweaveDeviceCredentialPersistenceV211.status().mode === 'device', 'Restored credential did not remain in device mode.');

second.sandbox.CommonweaveDeviceCredentialPersistenceV211.forget();
assert(!second.localStorage.getItem('commonweave-model-persistent-secrets-v191'), 'Forget did not clear the durable key.');
assert(!second.sessionStorage.getItem('commonweave-model-session'), 'Forget did not clear the session key.');

console.log(JSON.stringify({ ok: true, revision: 'v211-live-device-credential-persistence', save: true, restoreAfterClose: true, consent: true, forget: true, liveEntries: ['loom', 'lite'] }, null, 2));
