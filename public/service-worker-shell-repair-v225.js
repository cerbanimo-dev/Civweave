;(() => {
'use strict';

const V225_REVISION = 'shell-self-repair-v225-cache-distinct-installer-v2';
const V225_OPTIONAL_ASSETS = ['/app/installer-repair-only-v2.js'];
const v225OriginalCacheShell = cacheShell;
const v225OriginalShellStatus = shellStatus;
let v225LastFailures = [];
let v225RepairPromise = null;

for (const pathname of V225_OPTIONAL_ASSETS) {
  if (!OPTIONAL_SHELL_ASSETS.includes(pathname)) OPTIONAL_SHELL_ASSETS.push(pathname);
  if (!SHELL_ASSETS.includes(pathname)) SHELL_ASSETS.push(pathname);
}

function v225FailureList(error) {
  const failures = Array.isArray(error?.failures) ? error.failures : [];
  return failures.map(entry => ({
    pathname: String(entry?.pathname || ''),
    message: String(entry?.message || error?.message || 'Shell asset unavailable.')
  }));
}

cacheShell = async function repairableCacheShell(options = {}) {
  try {
    const result = await v225OriginalCacheShell();
    v225LastFailures = [];
    return result;
  } catch (error) {
    v225LastFailures = v225FailureList(error);
    if (options.strict === true) throw error;
    return {
      requiredFailures: v225LastFailures,
      optionalFailures: [],
      repaired: false,
      revision: V225_REVISION
    };
  }
};

async function v225RepairShell() {
  if (v225RepairPromise) return v225RepairPromise;
  v225RepairPromise = (async () => {
    await cacheShell({ strict: false });
    const status = await v225OriginalShellStatus();
    return {
      ...status,
      failures: v225LastFailures,
      repairable: true,
      repairRevision: V225_REVISION
    };
  })();
  try {
    return await v225RepairPromise;
  } finally {
    v225RepairPromise = null;
  }
}

shellStatus = async function selfRepairingShellStatus() {
  let status = await v225OriginalShellStatus();
  if (!status.ready) status = await v225RepairShell();
  return {
    ...status,
    failures: v225LastFailures,
    repairable: true,
    repairRevision: V225_REVISION
  };
};

self.addEventListener('message', event => {
  if (event.data?.type !== 'REPAIR_DEVICE_PACKAGE') return;
  event.waitUntil(v225RepairShell().then(packet => post(event, packet)));
});

self.CivweaveShellRepairV225 = Object.freeze({
  revision: V225_REVISION,
  optionalAssets: [...V225_OPTIONAL_ASSETS],
  repair: v225RepairShell,
  policy: 'activate-incomplete-retry-required-shell-and-report-paths-no-browser-runtime-cache-distinct-v2'
});

})();
