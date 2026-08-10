;(() => {
'use strict';

const INSTALLER_STATE_ASSETS = [
  '/app/installer-state-machine-v280.js',
  '/app/offline-campus-status-v210.js',
  '/app/required-campus-autostart-v1.js',
  '/app/campus-background-download-v241.js',
  '/app/shared/civweave-contribution-security-v1.js',
  '/app/shared/civweave-validator-committee-v2.js',
  '/app/shared/civweave-validator-review-gate-v1.js',
  '/app/shared/civweave-contribution-ship-guard-v1.js',
  '/app/shared/civweave-contribution-gateway-v1.js',
  '/app/shared/civweave-canonical-reward-mesh-bridge-v1.js',
  '/app/contribution-security-settings-entry-v1.js',
  '/app/contribution-security-v1.html',
  '/app/contribution-security-v1.js'
];
try {
  for (const asset of INSTALLER_STATE_ASSETS) {
    if (Array.isArray(REQUIRED_SHELL_ASSETS) && !REQUIRED_SHELL_ASSETS.includes(asset)) REQUIRED_SHELL_ASSETS.push(asset);
    if (Array.isArray(SHELL_ASSETS) && !SHELL_ASSETS.includes(asset)) SHELL_ASSETS.push(asset);
  }
} catch {}

self.CivweaveInstallerStateWorkerV280 = Object.freeze({
  revision: 'installer-state-machines-v280-security-r6-contribution-gateway',
  assets: INSTALLER_STATE_ASSETS.slice(),
  shellRequired: true,
  contributionSecurityRequired: true,
  validatorCommitteeV2Required: true,
  validatorReviewGateRequired: true,
  walletContainmentRequired: true,
  contributionGatewayRequired: true,
  canonicalRewardMeshBridgeRequired: true,
  contributionSecuritySettingsRequired: true
});
})();