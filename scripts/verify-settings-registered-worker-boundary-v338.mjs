import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const v203=await readFile(new URL('../public/service-worker-v203.js',import.meta.url),'utf8');
const pwaStart=await readFile(new URL('../public/app/pwa-start-v436.html',import.meta.url),'utf8');
const installedEntry=await readFile(new URL('../public/app/installed-entry-v146.js',import.meta.url),'utf8');

const generation='v338-settings-registered-worker-boundary';

assert.match(pwaStart,/SHELL_WORKER_PATH='\/service-worker-v203\.js'/,'Installed PWA start must refresh the v203 worker path.');
assert.match(pwaStart,/await registration\.update\(\)/,'Installed PWA start must explicitly update the registered worker.');
assert.match(installedEntry,/\/service-worker-v203\.js\?v=/,'Installed direct entry must register the v203 worker, not only the root compatibility worker.');
assert.match(installedEntry,/registration\.update\(\)/,'Installed direct entry must explicitly update the registered worker.');

assert.match(v203,new RegExp(`V203_REGISTERED_SETTINGS_GENERATION='${generation}'`),'The actual registered worker bytes must carry the Settings recovery generation.');
assert.match(v203,/service-worker-settings-v337-entrypoint\.js\?v=settings-v337-direct-gateway-bootstrap-v2-registered-worker-boundary/,'The registered worker must import the cache-distinct direct Settings bootstrap.');
assert.match(v203,/cwrecovery-v455-settings-v338-registered-worker/,'The registered worker must use a new one-shot recovery cache generation.');
assert.match(v203,/staging-installed-entry-takeover-v23-settings-v338-registered-worker/,'The registered worker must expose a distinct activation marker for installed staging clients.');
assert.match(v203,/if\(await v203StagingSettingsRecoveryPending\(\)\)await self\.skipWaiting\(\)/,'The Settings recovery worker must not remain waiting behind the broken controller.');
assert.match(v203,/await self\.clients\.claim\(\)/,'The Settings recovery worker must claim installed clients after activation.');

console.log(JSON.stringify({ok:true,revision:'settings-registered-worker-boundary-v338',registeredWorker:'/service-worker-v203.js',generation},null,2));
