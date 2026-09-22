import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const v203=await readFile(new URL('../public/service-worker-v203.js',import.meta.url),'utf8');
const pwaStart=await readFile(new URL('../public/app/pwa-start-v436.html',import.meta.url),'utf8');
const installedEntry=await readFile(new URL('../public/app/installed-entry-v146.js',import.meta.url),'utf8');

const generation='v339-settings-saved-state-first-worker-boundary';

assert.match(pwaStart,/SHELL_WORKER_PATH='\/service-worker-v203\.js'/,'Installed PWA start must refresh the v203 worker path.');
assert.match(pwaStart,/await registration\.update\(\)/,'Installed PWA start must explicitly update the registered worker.');
assert.match(installedEntry,/\/service-worker-v203\.js\?v=/,'Installed direct entry must register the v203 worker, not only the root compatibility worker.');
assert.match(installedEntry,/registration\.update\(\)/,'Installed direct entry must explicitly update the registered worker.');

assert.match(v203,new RegExp(`V203_REGISTERED_SETTINGS_GENERATION='${generation}'`),'The actual registered worker bytes must carry the current saved-state-first Settings recovery generation.');
assert.match(v203,/service-worker-settings-v337-entrypoint\.js\?v=settings-v339-saved-state-first-registered-worker-v1/,'The registered worker must import the cache-distinct saved-state-first Settings bootstrap.');
assert.match(v203,/cwrecovery-v456-settings-v339-saved-state-first/,'The registered worker must use the current one-shot Settings recovery cache generation.');
assert.match(v203,/staging-installed-entry-takeover-v24-settings-v339-saved-state-first/,'The registered worker must expose the current distinct activation marker for installed staging clients.');
assert.match(v203,/if\(await v203StagingSettingsRecoveryPending\(\)\)await self\.skipWaiting\(\)/,'The Settings recovery worker must not remain waiting behind the broken controller.');
assert.match(v203,/await self\.clients\.claim\(\)/,'The Settings recovery worker must claim installed clients after activation.');

console.log(JSON.stringify({ok:true,revision:'settings-registered-worker-boundary-v339-saved-state-first',registeredWorker:'/service-worker-v203.js',generation},null,2));
