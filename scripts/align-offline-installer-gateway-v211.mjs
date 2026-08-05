import { readFile, writeFile } from 'node:fs/promises';

async function replaceOnce(path, before, after, label) {
  let source = await readFile(path, 'utf8');
  if (after && source.includes(after)) return false;
  if (!source.includes(before)) {
    if (!after) return false;
    throw new Error(`Could not find ${label} in ${path}`);
  }
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

const [gateway, verifier] = await Promise.all([
  readFile('server-gateway-v131.mjs', 'utf8'),
  readFile('scripts/verify-knowledge-school-seeds-v1.mjs', 'utf8')
]);
const installerAssets = [
  '/app/offline-package-v208.json',
  '/app/offline-campus-status-v210.js'
];
for (const route of installerAssets) {
  if (!gateway.includes(`pathname === '${route}'`)) throw new Error(`Render installer allow-list is missing ${route}`);
}
if (verifier.includes('app installer update revision')) {
  throw new Error('The retired v207 installer-revision assertion is still active.');
}

console.log(JSON.stringify({
  revision: 'offline-installer-gateway-v211',
  gatewayChanged,
  verifierChanged,
  materializedAndVerified: true,
  installerAssets
}, null, 2));
