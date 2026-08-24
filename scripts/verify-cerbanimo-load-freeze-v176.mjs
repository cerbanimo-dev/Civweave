import fs from 'node:fs';
import assert from 'node:assert/strict';
import './verify-cerbanimo-universal-nav-stability-v1.mjs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const realmNavigationWorker=read('public/service-worker-five-system-pages-v1.js');
const activeWorker=read('public/service-worker-v203.js');
const directShellRetirement=read('public/service-worker-direct-shell-retirement-v1.js');

assert(realmNavigationWorker.includes("const VERSION='five-system-pages-v1-bounded-realm-navigation-r4-cache-distinct-shared-nav'"),'Exact realm navigation must use the cache-distinct shared-navbar revision.');
assert(realmNavigationWorker.includes("const CACHE='cw-five-system-pages-v2'"),'Current realm HTML must not share the stale v1 page cache.');
assert(realmNavigationWorker.includes("const NETWORK_TIMEOUT_MS=4000"),'Exact realm navigation must retain a finite mobile-tolerant network deadline.');
assert(realmNavigationWorker.includes('new AbortController()'),'Exact realm navigation must abort stalled requests.');
assert(realmNavigationWorker.includes("signal:controller.signal"),'Realm HTML requests must use the abort signal.');
assert(realmNavigationWorker.includes("const cachedPromise=cached(pathname)"),'Realm navigation must prepare the last validated current-cache page while networking.');
assert(realmNavigationWorker.includes("name.startsWith('cw-five-system-pages-')&&name!==CACHE"),'Activating the new realm-page worker must purge older realm caches.');
assert(activeWorker.includes('/service-worker-five-system-pages-v1.js?v=five-system-pages-v1-bounded-realm-navigation-r4-cache-distinct-shared-nav'),'Installed staging PWA must activate the current cache-distinct realm navigation worker.');
assert(activeWorker.includes('staging-installed-entry-takeover-v17-fresh-realm-cache'),'Staging must rotate onto the worker that purges the stale realm cache.');
assert(activeWorker.includes('/service-worker-direct-shell-retirement-v1.js?v=direct-shell-retirement-v1'),'Installed PWA must retire the old iframe family shell.');
assert(directShellRetirement.includes("cerbanimo:'/app/realm-console-v140.html'"),'Retired Cerbanimo shell clients must resolve to the direct realm console.');

console.log('Cerbanimo load-freeze regression contract passed: Cerbanimo uses one shared navigation owner, shared navbar dependencies are cache-first, and the installed staging worker purges stale realm HTML instead of reviving the old page.');
