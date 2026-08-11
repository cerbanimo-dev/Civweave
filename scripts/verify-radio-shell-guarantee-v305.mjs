import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const requiredRadioAssets = [
  '/app/install-boundary-v146.js',
  '/app/experience-orchestrator-v232.js',
  '/app/system-radio-agent-v233.js',
  '/app/radio-track-suggestions-v240.js',
  '/app/radio-track-map-v241.json',
  '/app/radio-directory-v240/civweave.txt',
  '/app/radio-directory-v240/living-school.txt',
  '/app/radio-directory-v240/cerbanimo.txt',
  '/app/radio-directory-v240/fellowfare.txt',
  '/app/radio-directory-v240/anarchadia.txt'
];

const [versionText, layer, wrapper, builder, trackSuggestions, ...assetContents] = await Promise.all([
  read('VERSION'),
  read('public/service-worker-radio-core-v305.js'),
  read('public/service-worker-v203.js'),
  read('scripts/build-service-worker-v211.mjs'),
  read('public/app/radio-track-suggestions-v240.js'),
  ...requiredRadioAssets.map(path => read(`public${path}`))
]);
const version = versionText.trim();
assert.equal(version, '1.0.105', 'Radio shell guarantee must ship on the Civweave 1.0.105 release boundary.');

new Function(layer);
for (const pathname of requiredRadioAssets) {
  assert(layer.includes(`'${pathname}'`), `Radio shell layer is missing ${pathname}.`);
}
assert(layer.includes("const V305_REVISION = 'radio-core-shell-v305'"), 'Radio shell revision drifted.');
assert(layer.includes('const V305_BASE_CACHE_SHELL = cacheShell;'), 'Radio shell no longer extends the verified shell cache transaction.');
assert(layer.includes('cacheShell = async function cacheShellWithRadioCoreV305()'), 'Radio shell no longer owns required install/repair completion.');
assert(layer.includes('const base = await V305_BASE_CACHE_SHELL();'), 'Radio shell bypasses the existing verified shell transaction.');
assert(layer.includes('const radio = await v305CacheRadioCore();'), 'Radio shell transaction no longer requires radio assets.');
assert(layer.includes("radioCore: 'required-cached'"), 'Radio diagnostics no longer distinguish required caching from SHA verification.');
assert(layer.includes('ready: Boolean(packet.ready) && radio.ready'), 'Device package readiness no longer fails closed when radio core is missing.');
assert(layer.includes('await caches.delete(V305_STAGING_CACHE);'), 'Radio shell no longer stages atomically.');
assert(!layer.includes('DOWNLOAD_OFFLINE_PACKAGE'), 'Radio shell must not depend on the optional offline-campus download.');
assert(!layer.includes('offline-campus.explicit-opt-in'), 'Radio shell must not depend on campus opt-in state.');

const radioImport = '/service-worker-radio-core-v305.js';
for (const source of [wrapper, builder]) {
  assert(source.includes(`${radioImport}?v=`), 'Worker composition is missing the required radio shell layer.');
  assert(source.indexOf('/service-worker-shell-integrity-v281.js') < source.indexOf(radioImport), 'Radio shell must wrap the integrity-owned cacheShell implementation.');
  assert(source.indexOf(radioImport) < source.indexOf('/service-worker-shell-repair-v293.js'), 'Installed shell repair must observe the radio-wrapped cacheShell implementation.');
}
assert(wrapper.includes(`${radioImport}?v=${version}-radio-core-shell-v305`), 'Checked-in worker does not pin the radio shell to the current release.');
assert(builder.includes("'public/service-worker-radio-core-v305.js'"), 'Worker builder does not require the radio shell source file.');
assert(builder.includes("radioCore:'radio-core-shell-v305'"), 'Worker builder does not report the radio shell revision.');

for (let index = 0; index < requiredRadioAssets.length; index += 1) {
  assert(assetContents[index].length > 0, `${requiredRadioAssets[index]} is empty.`);
}
for (const pathname of requiredRadioAssets.filter(path => path.includes('/radio-directory-v240/'))) {
  assert(trackSuggestions.includes(pathname), `Track picker no longer references ${pathname}.`);
}
assert(trackSuggestions.includes('/app/radio-track-map-v241.json'), 'Track picker no longer references the exact-track map.');

function makeRuntime({ failPath = '' } = {}) {
  const stores = new Map();
  const cacheFor = name => {
    if (!stores.has(name)) stores.set(name, new Map());
    const entries = stores.get(name);
    return {
      async put(key, response) { entries.set(String(key), response.clone()); },
      async match(key) { return entries.get(String(key))?.clone() || null; },
      async keys() { return [...entries.keys()]; }
    };
  };
  const scope = vm.createContext({
    console,
    self: {},
    Promise,
    Object,
    String,
    Boolean,
    Array,
    Error,
    Response,
    SHELL_CACHE: 'civweave-shell-test',
    FETCH_TIMEOUT_MS: 1000,
    cacheKey: pathname => pathname,
    responseLooksValid: response => Boolean(response?.ok),
    fetchFresh: async pathname => {
      if (pathname === failPath) throw new Error(`synthetic failure for ${pathname}`);
      return new Response(`asset:${pathname}`, { status: 200, headers: { 'content-type': pathname.endsWith('.json') ? 'application/json' : 'text/plain' } });
    },
    caches: {
      async open(name) { return cacheFor(name); },
      async delete(name) { return stores.delete(name); }
    },
    cacheShell: async () => ({ integrity: 'verified' }),
    shellStatus: async () => ({ ready: true })
  });
  vm.runInContext(layer, scope, { filename: 'service-worker-radio-core-v305.js' });
  return { scope, stores };
}

const success = makeRuntime();
const installResult = await success.scope.cacheShell();
assert.equal(installResult.radioCore, 'required-cached');
assert.equal(installResult.radioRequiredAssetCount, requiredRadioAssets.length);
const shellStore = success.stores.get('civweave-shell-test');
for (const pathname of requiredRadioAssets) assert(shellStore?.has(pathname), `Successful shell install did not cache ${pathname}.`);
let status = await success.scope.shellStatus();
assert.equal(status.ready, true);
assert.equal(status.radioCoreReady, true);
assert.equal(status.radioMissing.length, 0);

shellStore.delete('/app/system-radio-agent-v233.js');
status = await success.scope.shellStatus();
assert.equal(status.ready, false, 'Device package remained ready after required radio runtime disappeared.');
assert.equal(status.radioCoreReady, false);
assert(status.radioMissing.includes('/app/system-radio-agent-v233.js'));

const failure = makeRuntime({ failPath: '/app/radio-track-map-v241.json' });
await assert.rejects(() => failure.scope.cacheShell(), /Radio core incomplete/);
assert.equal(failure.stores.has('civweave-shell-test-radio-v305-staging'), false, 'Failed radio install left its staging cache behind.');

console.log(JSON.stringify({
  ok: true,
  version,
  revision: 'radio-core-shell-v305',
  requiredAssetCount: requiredRadioAssets.length,
  freshInstallRequired: true,
  repairRequired: true,
  offlineCampusIndependent: true,
  missingRadioMakesShellUnready: true,
  atomicStaging: true
}, null, 2));
