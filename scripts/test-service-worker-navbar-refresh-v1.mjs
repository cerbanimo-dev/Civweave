import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

const [rootWorker,wrapper,navbarWorker]=await Promise.all([
  read('public/service-worker.js'),
  read('public/service-worker-v203.js'),
  read('public/service-worker-canonical-navbar-v1.js')
]);

const ROOT_REV='root-worker-bridge-v22-canonical-navbar-refresh';
const NAV_REV='canonical-navbar-cache-first-v11-current-rail';
const NAV_CACHE='cw-nav-canonical-v11-current-rail';

assert.ok(rootWorker.includes(`const CIVWEAVE_ROOT_WORKER_BRIDGE='${ROOT_REV}';`),'Root service worker bridge revision must advance so installed clients detect a new worker generation.');
assert.ok(rootWorker.includes(`importScripts('/service-worker-v203.js?v=${ROOT_REV}');`),'Root bridge must request the current v203 wrapper with the same generation token.');
assert.ok(wrapper.includes(`importScripts('/service-worker-canonical-navbar-v1.js?v=${NAV_REV}');`),'v203 must request a fresh canonical-navbar worker generation.');
assert.ok(navbarWorker.includes(`const VERSION='${NAV_REV}';`),'Canonical navbar worker version must match the v203 import revision.');
assert.ok(navbarWorker.includes(`const CACHE='${NAV_CACHE}';`),'Canonical navbar assets must use a fresh cache namespace instead of reusing the stale rail cache.');
assert.ok(navbarWorker.includes("self.addEventListener('install',event=>event.waitUntil(warm()"),'Fresh navbar generation must warm current protected assets during install.');

console.log(JSON.stringify({ok:true,rootRevision:ROOT_REV,navbarRevision:NAV_REV,navbarCache:NAV_CACHE},null,2));
