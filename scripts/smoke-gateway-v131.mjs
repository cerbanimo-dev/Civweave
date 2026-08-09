import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(scriptsDir, 'smoke-gateway-v131-base.mjs');
const VERSION = 'render-installed-runtime-v132';
const source = (await fsp.readFile(sourcePath, 'utf8')).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');

for (const token of [
  "new URL('/app/index.html',location.origin)",
  "source','host-bootstrap'",
  'This hosted page is only the installer, updater, and recovery dock.',
  'pages are package-only at runtime',
  'will not silently substitute the live website',
  "for(const route of ['/loom/','/lite/','/app/realm-console-v140.html','/app/fullscreen-family-v104.html','/app/cabinet-mode-v142.html'])",
  "response.status===410"
]) {
  if (!source.includes(token)) throw new Error(`Civweave gateway smoke v132 lost offline-runtime assertion: ${token}`);
}
for (const forbidden of [
  'Open online campus',
  'Open Civweave online',
  'launch=online',
  "expected a public installed-runtime asset",
  "for(const route of ['/app/','/app/index.html','/app/working-campus-v156.html'"
]) {
  if (source.includes(forbidden)) throw new Error(`Civweave gateway smoke v132 refused retired live-runtime assertion: ${forbidden}`);
}

await import(`${pathToFileURL(sourcePath).href}?build=${encodeURIComponent(VERSION)}`);
