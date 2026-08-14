;(() => {
'use strict';

const INSTALLER_STATE_ASSETS = [
  '/app/installer-state-machine-v281.js',
  '/app/installer-storage-guard-v281.js',
  '/app/offline-campus-status-v210.js'
];
try {
  for (const asset of INSTALLER_STATE_ASSETS) {
    if (Array.isArray(REQUIRED_SHELL_ASSETS) && !REQUIRED_SHELL_ASSETS.includes(asset)) {
      REQUIRED_SHELL_ASSETS.push(asset);
    }
    if (Array.isArray(SHELL_ASSETS) && !SHELL_ASSETS.includes(asset)) {
      SHELL_ASSETS.push(asset);
    }
  }
} catch {}

self.CivweaveInstallerStateWorkerV280 = Object.freeze({
  revision: 'installer-state-authority-v281-manual-first',
  assets: INSTALLER_STATE_ASSETS.slice(),
  shellRequired: true,
  campusAutostartRequired: false,
  storagePreflightTiming: 'on-explicit-campus-request'
});
})();