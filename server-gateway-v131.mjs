import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(rootDir, 'server-gateway-v131-base.mjs');
const runtimePath = path.join(rootDir, '.civweave-gateway-v132.loader.mjs');
const VERSION = '1.0.48-render-installed-runtime-v132';
const before = "if (gatewayRequest && applicationSurface && !installerSurface && !packageInstall) {";
const after = "if (gatewayRequest && applicationSurface && !installerSurface && !packageInstall && pathname !== '/app' && !pathname.startsWith('/app/')) {";

let source = (await fsp.readFile(sourcePath, 'utf8')).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
if (!source.includes(before)) {
  throw new Error('Civweave gateway v132 could not find the legacy installed-runtime boundary.');
}
source = source.replace(before, after);
await fsp.writeFile(runtimePath, source, 'utf8');
try {
  await import(`${pathToFileURL(runtimePath).href}?build=${encodeURIComponent(VERSION)}`);
} finally {
  setTimeout(() => fsp.unlink(runtimePath).catch(() => {}), 1000).unref?.();
}
