;(()=>{
'use strict';

const V225_REVISION = 'shell-self-repair-v225-install-only-pwa-v1';
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

async function repairableCacheShell() {
  try {
    const result = await v225OriginalCacheShell();
    v225LastFailures = [];
    return {
      repaired: true,
      requiredFailures: [],
      optionalFailures: Array.isArray(result?.optionalFailures) ? result.optionalFailures : [],
      result,
      revision: V225_REVISION
    };
  } catch (error) {
    v225LastFailures = v225FailureList(error);
    return {
      repaired: false,
      requiredFailures: v225LastFailures,
      optionalFailures: [],
      result: null,
      revision: V225_REVISION
    };
  }
}

async function v225RepairShell() {
  if (v225RepairPromise) return v225RepairPromise;
  v225RepairPromise = (async () => {
    const repair = await repairableCacheShell();
    const status = await v225OriginalShellStatus();
    return {
      ...status,
      failures: v225LastFailures,
      repairable: true,
      repaired: Boolean(status.ready),
      repairAttempt: repair,
      repairRevision: V225_REVISION
    };
  })();
  try {
    return await v225RepairPromise;
  } finally {
    v225RepairPromise = null;
  }
}

// Keep the install transaction strict. The core install listener resolves the
// current global cacheShell binding at runtime, so replacing cacheShell here used
// to swallow integrity failures and allowed an empty shell to activate. Repairs
// are deliberately separate from installation now.
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

// v293 is the canonical installed-shell repair responder. Keep this listener only
// as a compatibility fallback so two modules cannot race to answer one reply port.
if (!self.CivweaveInstalledShellRepairV293) {
  self.addEventListener('message', event => {
    if (event.data?.type !== 'REPAIR_DEVICE_PACKAGE') return;
    event.waitUntil(v225RepairShell().then(packet => post(event, {
      ...packet,
      type: 'CIVWEAVE_DEVICE_PACKAGE_REPAIR'
    })));
  });
}

self.CivweaveShellRepairV225 = Object.freeze({
  revision: V225_REVISION,
  optionalAssets: [...V225_OPTIONAL_ASSETS],
  repair: v225RepairShell,
  policy: 'reject-incomplete-install-repair-active-shell-no-browser-runtime'
});

})();