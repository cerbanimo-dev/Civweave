import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root=process.cwd();
const read=file=>fs.readFile(path.join(root,file),'utf8');
const assert=(value,message)=>{if(!value)throw new Error(message)};

const [routes,core,shell,shellAssets,worker]=await Promise.all([
  read('public/app/system-routes-v227.js'),
  read('public/service-worker-core-v208.js'),
  read('public/app/persistent-family-shell-v1.html'),
  read('public/service-worker-shell-assets-v1.js'),
  read('public/service-worker-v203.js')
]);

const shellPath=routes.match(/const SHELL_PATH='([^']+)'/)?.[1]||'';
assert(shellPath==='/app/persistent-family-shell-v1.html',`Unexpected persistent shell path: ${shellPath||'(missing)'}`);
assert(shell.includes('<iframe id="cw-family-stage"'),'Persistent shell must keep the realm stage iframe.');
assert(shell.includes("const SHELL_REVISION='persistent-family-shell-v1'"),'Persistent shell revision marker is missing.');
assert(shellAssets.includes(`'${shellPath}'`),'Persistent shell must be a required shell asset.');

const compatBlock=core.match(/const COMPAT_ENTRY_PATHS = new Set\(\[([\s\S]*?)\]\);/)?.[1]||'';
assert(compatBlock,'Could not locate COMPAT_ENTRY_PATHS in service-worker-core-v208.js.');
assert(!compatBlock.includes(shellPath),`Persistent shell ${shellPath} must not be intercepted by stableAppEntry().`);
assert(core.includes("event.respondWith(stableAppEntry(request))"),'Expected legacy compatibility entry handling is missing.');
assert(worker.includes('persistent-shell-route-safe-v1'),'Generated service worker must carry the route-safety update marker.');

console.log('Persistent shell route safety verification passed: installed launch cannot be rewritten to the installer compatibility entry.');
