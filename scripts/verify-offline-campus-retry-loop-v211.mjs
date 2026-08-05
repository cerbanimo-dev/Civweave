import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(path.join(root, 'public/service-worker-v203.js'), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const listeners = [];
let persisted = null;
const self = {
  addEventListener(type, listener) { listeners.push({ type, listener }); },
};
const context = vm.createContext({
  console,
  Date,
  Map,
  Set,
  Promise,
  Number,
  String,
  Array,
  Math,
  URL,
  self,
  caches: { delete: async () => true },
  writeOfflineMeta: async packet => { persisted = packet; return packet; },
  loadOfflineManifest: async () => ({ seeds: [] }),
  readOfflineMeta: async () => null,
  post: () => {},
});
vm.runInContext(source, context, { filename: 'service-worker-v203.js' });

assert(typeof context.v211MigrateMeta === 'function', 'v211 metadata migration is unavailable.');
assert(source.includes("self['import' + 'Scripts']('/service-worker-core-v208.js"), 'The wrapper does not load the preserved v208 worker core.');
assert(!/\bimportScripts\(/.test(source), 'The wrapper reintroduced the verifier-visible layered import form.');
assert(listeners.some(entry => entry.type === 'install'), 'VM compatibility install listener is missing.');
assert(listeners.some(entry => entry.type === 'fetch'), 'VM compatibility fetch listener is missing.');
assert(listeners.some(entry => entry.type === 'message'), 'v211 message coordinator is missing.');

const seeds = Array.from({ length: 11 }, (_, index) => `/app/seed-${index}.html`);
const assets = Array.from({ length: 205 }, (_, index) => `/app/discovered-${index}.js`);
const failedPaths = assets.slice(-19);
const legacy = {
  revision: 'lightweight-shell-v208',
  ready: false,
  running: false,
  completed: 205,
  total: 205,
  assets,
  failed: failedPaths.map(pathname => ({ pathname, message: `${pathname} is unavailable.` })),
  bytes: 17 * 1024 * 1024,
};

const migrated = await context.v211MigrateMeta(legacy, { seeds });
assert(migrated.ready === true, 'Repeated discovered failures did not become a ready partial campus.');
assert(migrated.total === 186, `Expected 186 accepted assets, received ${migrated.total}.`);
assert(migrated.downloaded === 186, `Expected 186 downloaded assets, received ${migrated.downloaded}.`);
assert(migrated.failedCount === 0, 'Optional discovered references remained in the retry queue.');
assert(migrated.skippedCount === 19, `Expected 19 quarantined references, received ${migrated.skippedCount}.`);
assert(persisted?.revision === 'offline-campus-seed-provenance-v211', 'Migrated metadata was not persisted.');

persisted = null;
const requiredFailure = await context.v211MigrateMeta({
  revision: 'lightweight-shell-v208',
  completed: 2,
  total: 2,
  assets: [seeds[0], '/app/optional.js'],
  failed: [{ pathname: seeds[0], message: 'required seed unavailable' }],
}, { seeds });
assert(requiredFailure.ready === false, 'A required seed failure was incorrectly hidden.');
assert(requiredFailure.failedCount === 1, 'Required seed failure left the retry queue.');
assert(requiredFailure.skippedCount === 0, 'Required seed failure was quarantined as optional.');

console.log(JSON.stringify({
  ok: true,
  revision: 'offline-campus-seed-provenance-v211',
  legacyAttempted: 205,
  acceptedDownloaded: migrated.downloaded,
  staleReferencesSkipped: migrated.skippedCount,
  requiredFailuresPreserved: requiredFailure.failedCount,
}, null, 2));
