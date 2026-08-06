import fs from 'node:fs/promises';

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Missing ${label}`);
  return source.replace(before, after);
}

let installer = await fs.readFile('public/install-v130.js', 'utf8');
installer = replaceOnce(
  installer,
  "const WORKER_BUILD = `${VERSION}-lightweight-shell-v216-stable-entry-cache-route`;",
  "const WORKER_BUILD = `${VERSION}-lightweight-shell-v208`;",
  'installer compatibility build'
);
installer = replaceOnce(
  installer,
  "const WORKER_URL = `/service-worker-v203.js?v=${WORKER_BUILD}`;",
  "const WORKER_SCRIPT_REVISION = 'stable-entry-v216';\nconst WORKER_URL = `/service-worker-v203.js?v=${WORKER_BUILD}&revision=${WORKER_SCRIPT_REVISION}`;",
  'installer worker URL'
);
installer = replaceOnce(
  installer,
  "const WATCHDOG_RECOVERY_KEY = 'commonweave.shell.registration-watchdog.v216';",
  "const WATCHDOG_RECOVERY_KEY = 'commonweave.shell.registration-watchdog.v208';",
  'installer watchdog compatibility key'
);
await fs.writeFile('public/install-v130.js', installer);

for (const path of ['public/service-worker-core-v208.js', 'public/service-worker-v203.js']) {
  let source = await fs.readFile(path, 'utf8');
  source = replaceOnce(
    source,
    "const BUILD = 'lightweight-shell-v216-stable-entry-cache-route';",
    "const BUILD = 'lightweight-shell-v208';",
    `${path} compatibility build`
  );
  await fs.writeFile(path, source);
}

console.log('Aligned stable entry worker with the v208 compatibility contract.');
