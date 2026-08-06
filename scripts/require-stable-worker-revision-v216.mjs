import fs from 'node:fs/promises';

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Missing ${label}`);
  return source.replace(before, after);
}

let installer = await fs.readFile('public/install-v130.js', 'utf8');
installer = replaceOnce(
  installer,
  "    return url.pathname === '/service-worker-v203.js' && url.searchParams.get('v') === WORKER_BUILD;",
  "    return url.pathname === '/service-worker-v203.js' &&\n      url.searchParams.get('v') === WORKER_BUILD &&\n      url.searchParams.get('revision') === WORKER_SCRIPT_REVISION;",
  'worker revision match'
);
await fs.writeFile('public/install-v130.js', installer);

let watchdog = await fs.readFile('scripts/smoke-service-worker-registration-watchdog-v207.mjs', 'utf8');
watchdog = replaceOnce(
  watchdog,
  "    scriptURL:'https://example.test/service-worker-v203.js?v=1.0.6-lightweight-shell-v208',",
  "    scriptURL:'https://example.test/service-worker-v203.js?v=1.0.6-lightweight-shell-v208&revision=stable-entry-v216',",
  'watchdog current worker fixture'
);
watchdog = replaceOnce(
  watchdog,
  "has(installerSource,/const\\s+ACTIVATION_TIMEOUT_MS\\s*=\\s*45000/,'Installer activation deadline is missing.');",
  "has(installerSource,/const\\s+ACTIVATION_TIMEOUT_MS\\s*=\\s*45000/,'Installer activation deadline is missing.');\nhas(installerSource,/const\\s+WORKER_SCRIPT_REVISION\\s*=\\s*['\"]stable-entry-v216['\"]/,'Stable entry worker revision is missing.');\nassert(installerSource.includes(\"url.searchParams.get('revision') === WORKER_SCRIPT_REVISION\"),'Installer accepts a stale worker without the stable-entry revision.');",
  'watchdog revision assertions'
);
await fs.writeFile('scripts/smoke-service-worker-registration-watchdog-v207.mjs', watchdog);

console.log('Required the stable-entry worker revision and aligned its watchdog fixture.');
