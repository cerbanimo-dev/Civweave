;(() => {
'use strict';

const INSTALLER_STATE_ASSETS = [
  '/app/installer-state-machine-v280.js',
  '/app/offline-campus-status-v210.js',
  '/app/required-campus-autostart-v1.js',
  '/app/campus-background-download-v241.js'
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
  revision: 'installer-state-machines-v280',
  assets: INSTALLER_STATE_ASSETS.slice(),
  shellRequired: true
});
})();
