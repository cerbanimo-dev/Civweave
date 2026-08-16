import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

// Deliberately do not run the release sync or service-worker builder before
// verification. This verifier must inspect the committed worker exactly as it
// ships, otherwise a stale generated radio import can repair itself in CI and
// hide the regression from review.
const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const requiredRadioAssets = [
  '/app/install-boundary-v146.js',
  '/app/experience-orchestrator-v232.js',
  '/app/system-radio-agent-v233.js',
  '/app/radio-safe-stations-v1.js',
  '/app/radio-track-suggestions-v240.js',
  '/app/canonical-playlists-v1.js',
  '/app/radio-playlist-governance-v1.js',
  '/app/radio-track-map-v241.json',
  '/app/radio-directory-v240/civweave.txt',
  '/app/radio-directory-v240/living-school.txt',
  '/app/radio-directory-v240/cerbanimo.txt',
  '/app/radio-directory-v240/fellowfare.txt',
  '/app/radio-directory-v240/anarchadia.txt'
];

const [versionText, layer, wrapper, builder, radioAgent, safeStations, trackSuggestions, governance, ...assetContents] = await Promise.all([
  read('VERSION'),
  read('public/service-worker-radio-core-v305.js'),
  read('public/service-worker-v203.js'),
  read('scripts/build-service-worker-v211.mjs'),
  read('public/app/system-radio-agent-v233.js'),
  read('public/app/radio-safe-stations-v1.js'),
  read('public/app/radio-track-suggestions-v240.js'),
  read('public/app/radio-playlist-governance-v1.js'),
  ...requiredRadioAssets.map(path => read(`public${path}`))
]);
const version = versionText.trim();
assert.match(version, /^\d+\.\d+\.\d+$/, 'Radio shell guarantee must follow the current semantic Civweave release boundary.');

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
assert(wrapper.includes(`${radioImport}?v=${version}-radio-core-shell-v305-safe-station-v356`), `Committed worker is stale: radio shell must carry the S.A.F.E. station handoff for release ${version}.`);
assert(builder.includes("importScripts('/service-worker-radio-core-v305.js?v=${version}-radio-core-shell-v305-safe-station-v356');"), 'Worker builder must preserve the S.A.F.E. radio cache-bust token.');
assert(builder.includes("'public/service-worker-radio-core-v305.js'"), 'Worker builder does not require the radio shell source file.');
assert(builder.includes("radioCore:'radio-core-shell-v305'"), 'Worker builder does not report the radio shell revision.');
assert(builder.includes("radioAssetHandoff:'safe-station-v356'"), 'Worker builder must report the active S.A.F.E. radio handoff revision.');
assert(builder.includes('party=lazy-v353'), 'Worker builder must preserve lazy party-chat activation while rotating the radio shell.');
assert(wrapper.includes('party=lazy-v353'), 'Committed worker must preserve lazy party-chat activation while rotating the radio shell.');

assert(radioAgent.includes("REVISION='system-radio-agent-v233-persistent-station-v1'"), 'Installed radio owner must use the persistent station contract.');
assert(radioAgent.includes('autoRecommend:false'), 'Installed radio owner must not auto-display transient recommendation cards.');
assert(radioAgent.includes("const LAUNCHER_ID='cw-radio-station-launcher-v1'"), 'Installed radio owner must expose the universal persistent launcher.');
assert(!radioAgent.includes('MutationObserver'), 'Installed radio owner must remain idle when the user is not interacting with it.');

assert(safeStations.includes("REVISION='radio-safe-stations-v1-general-audience-queue'"), 'Installed shell must carry the independent S.A.F.E. station owner.');
assert(safeStations.includes('externalUncensoredRoutes:0'), 'Installed S.A.F.E. station must expose zero uncensored routes.');
assert(safeStations.includes('independentQueue:true'), 'Installed S.A.F.E. station must own a separate queue.');
assert(!safeStations.includes('open.spotify.com/playlist/'), 'Installed S.A.F.E. station must not embed an uncensored playlist destination.');
assert(!safeStations.includes('MutationObserver'), 'Installed S.A.F.E. station must remain event-driven.');

assert(!governance.includes('MutationObserver'), 'Installed playlist governance must remain event-driven and must not create a DOM mutation loop.');
assert(governance.includes('idleEventDriven:true'), 'Installed playlist governance must declare its event-driven idle contract.');

for (let index = 0; index < requiredRadioAssets.length; index += 1) {
  assert(assetContents[index].length > 0, `${requiredRadioAssets[index]} is empty.`);
}
for (const pathname of requiredRadioAssets.filter(path => path.includes('/radio-directory-v240/'))) {
  assert(trackSuggestions.includes(pathname), `Track picker no longer references ${pathname}.`);
}
assert(trackSuggestions.includes('/app/radio-track-map-v241.json'), 'Track picker no longer references the exact-track map.');
assert(trackSuggestions.includes("REVISION='radio-track-suggestions-v247-persistent-station-v1'"), 'Installed track suggestions must target the persistent station surface.');
assert(trackSuggestions.includes('civweave:radio-station-opened'), 'Installed track suggestions must trigger from the persistent station.');
assert(trackSuggestions.includes('safeAware:true'), 'Installed track suggestions must respect S.A.F.E. station scope.');
assert(trackSuggestions.includes('cleanAware:true'), 'Installed track suggestions must respect clean station scope.');
assert(trackSuggestions.includes('spotifyPlaylistTrackUrl'), 'Original-mode track suggestions must retain playlist-context handoff.');
assert(!trackSuggestions.includes("const CARD_ID='cw-radio-suggestion-v233'"), 'Installed track suggestions must not depend on the retired transient card.');
assert(!trackSuggestions.includes('location.assign'), 'Installed radio core must never navigate the PWA away to Spotify.');

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

shellStore.delete('/app/radio-safe-stations-v1.js');
status = await success.scope.shellStatus();
assert.equal(status.ready, false, 'Device package remained ready after the required S.A.F.E. radio owner disappeared.');
assert.equal(status.radioCoreReady, false);
assert(status.radioMissing.includes('/app/radio-safe-stations-v1.js'));

const failure = makeRuntime({ failPath: '/app/radio-track-map-v241.json' });
await assert.rejects(() => failure.scope.cacheShell(), /Radio core incomplete/);
assert.equal(failure.stores.has('civweave-shell-test-radio-v305-staging'), false, 'Failed radio install left its staging cache behind.');

console.log(JSON.stringify({
  ok: true,
  version,
  revision: 'radio-core-shell-v305',
  radioAssetHandoff: 'safe-station-v356',
  committedWorkerCurrent: true,
  requiredAssetCount: requiredRadioAssets.length,
  freshInstallRequired: true,
  repairRequired: true,
  offlineCampusIndependent: true,
  missingRadioMakesShellUnready: true,
  atomicStaging: true,
  eventDrivenGovernance: true,
  persistentStationLauncher: true,
  independentSafeStation: true,
  tierAwareSuggestions: true
}, null, 2));