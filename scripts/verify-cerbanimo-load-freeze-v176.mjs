import fs from 'node:fs';
import assert from 'node:assert/strict';
import './verify-cerbanimo-universal-nav-stability-v1.mjs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const realmNavigationWorker=read('public/service-worker-five-system-pages-v1.js');
const activeWorker=read('public/service-worker-v203.js');
const directShellRetirement=read('public/service-worker-direct-shell-retirement-v1.js');

assert(realmNavigationWorker.includes("const NETWORK_TIMEOUT_MS=1800"),'Exact realm navigation must retain a short finite network deadline.');
assert(realmNavigationWorker.includes('new AbortController()'),'Exact realm navigation must abort stalled requests.');
assert(realmNavigationWorker.includes("signal:controller.signal"),'Realm HTML requests must use the abort signal.');
assert(realmNavigationWorker.includes("const cachedPromise=cached(pathname)"),'Realm navigation must prepare the last validated page while networking.');
assert(activeWorker.includes('/service-worker-five-system-pages-v1.js?v=five-system-pages-v1-bounded-realm-navigation-r2'),'Installed PWA must retain bounded exact-realm navigation.');
assert(activeWorker.includes('/service-worker-direct-shell-retirement-v1.js?v=direct-shell-retirement-v1'),'Installed PWA must retire the old iframe family shell.');
assert(directShellRetirement.includes("cerbanimo:'/app/realm-console-v140.html'"),'Retired Cerbanimo shell clients must resolve to the direct realm console.');

console.log('Cerbanimo load-freeze regression contract passed: realm navigation is bounded and the core console has one universal navigation owner.');
