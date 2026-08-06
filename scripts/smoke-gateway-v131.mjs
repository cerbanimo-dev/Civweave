import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(scriptsDir, 'smoke-gateway-v131-base.mjs');
const runtimePath = path.join(scriptsDir, '.smoke-gateway-v132.runtime.mjs');
const VERSION = 'render-installed-runtime-v132';
const before = "  for(const route of ['/loom/','/lite/','/app/realm-console-v140.html','/app/fullscreen-family-v104.html','/app/cabinet-mode-v142.html']){const response=await fetch(origin+route,{cache:'no-store'}),body=await response.json();assert(response.status===410,`${route} returned ${response.status}, expected 410`);assert(body.localInstallRequired===true,`${route} does not explain installation`)}";
const after = "  for(const route of ['/loom/','/lite/']){const response=await fetch(origin+route,{cache:'no-store'}),body=await response.json();assert(response.status===410,`${route} returned ${response.status}, expected 410`);assert(body.localInstallRequired===true,`${route} does not explain installation`)}\n  for(const route of ['/app/','/app/index.html','/app/working-campus-v156.html','/app/realm-console-v140.html','/app/fullscreen-family-v104.html','/app/cabinet-mode-v142.html']){const response=await fetch(origin+route,{cache:'no-store'});assert(response.ok,`${route} returned ${response.status}, expected a public installed-runtime asset`);const type=String(response.headers.get('content-type')||'');assert(/text\\/html/i.test(type),`${route} returned unexpected content type ${type}`)}";

let source = (await fsp.readFile(sourcePath, 'utf8')).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
if (!source.includes(before)) {
  throw new Error('Commonweave gateway smoke v132 could not find the legacy 410 assertion.');
}
source = source.replace(before, after);
await fsp.writeFile(runtimePath, source, 'utf8');
try {
  await import(`${pathToFileURL(runtimePath).href}?build=${encodeURIComponent(VERSION)}`);
} finally {
  await fsp.unlink(runtimePath).catch(() => {});
}
