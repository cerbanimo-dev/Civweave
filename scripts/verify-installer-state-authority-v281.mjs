import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const index = await fs.readFile(new URL('../public/app/index.html', import.meta.url), 'utf8');
const controller = await fs.readFile(new URL('../public/app/installer-state-machine-v281.js', import.meta.url), 'utf8');

assert.match(index, /\/app\/installer-state-machine-v281\.js\?v=installer-state-authority-v281-lazy/,
  'installer must lazy-load the v281 single-owner controller by a new pathname');
assert.doesNotMatch(index, /installer-state-machine-v280\.js/,
  'installer must not load the retired v280 controller');
assert.match(index, /globalThis\.CivweaveInstallerStateV281/,
  'lazy loader must gate on the v281 controller singleton');

for (const forbidden of [
  "$('#package-state')",
  "$('#package-assets')",
  "$('#local-mode')",
  "$('#install-help')",
  "$('#install-app')",
  "$('#check-update')",
  'function detectShellPhase',
  'function renderShell',
  'function renderHelp',
  'function renderInstallButton',
  'MutationObserver',
  'setInterval('
]) {
  assert.equal(controller.includes(forbidden), false,
    `v281 must not regain shell/install UI ownership: ${forbidden}`);
}

assert.match(controller, /globalThis\.CivweaveInstallerStateV281=api/,
  'v281 must expose one controller singleton');
assert.match(controller, /globalThis\.CivweaveInstallerStateV280=api/,
  'v281 must set the compatibility sentinel so a retired v280 loader cannot start later');
assert.match(controller, /addEventListener\('civweave:offline-campus-status'/,
  'offline progress should update from events rather than polling DOM copy');
assert.match(controller, /addEventListener\?\.\('controllerchange'/,
  'service-worker controller changes should trigger explicit reconciliation');

console.log('installer state authority v281: ok');
