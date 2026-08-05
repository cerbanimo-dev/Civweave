import { readFile, writeFile } from 'node:fs/promises';

async function replaceOnce(path, before, after, label) {
  let source = await readFile(path, 'utf8');
  if (source.includes(after)) return false;
  if (!source.includes(before)) throw new Error(`Could not find ${label} in ${path}`);
  source = source.replace(before, after);
  await writeFile(path, source, 'utf8');
  return true;
}

const gatewayChanged = await replaceOnce(
  'server-gateway-v131.mjs',
  "    || pathname === '/app/knowledge-school-installer-v1.css'\n    || pathname === '/app/pwa-update-controller-v204.js';",
  "    || pathname === '/app/knowledge-school-installer-v1.css'\n    || pathname === '/app/offline-package-v208.json'\n    || pathname === '/app/offline-campus-status-v210.js'\n    || pathname === '/app/pwa-update-controller-v204.js';",
  'installer-surface allow-list boundary'
);

const verifierChanged = await replaceOnce(
  'scripts/verify-knowledge-school-seeds-v1.mjs',
  "assertMatches(installRuntime, /const\\s+UPDATE_REVISION\\s*=\\s*['\"]visible-update-library-preservation-v207-registration-watchdog['\"]/, 'app installer update revision');\n",
  '',
  'retired installer update-revision assertion'
);

console.log(JSON.stringify({
  revision: 'offline-installer-gateway-v211',
  gatewayChanged,
  verifierChanged,
  installerAssets: [
    '/app/offline-package-v208.json',
    '/app/offline-campus-status-v210.js'
  ]
}, null, 2));
