import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(root, 'server.mjs');
const runtimePath = path.join(root, '.commonweave-server-v125.runtime.mjs');
let source = await fsp.readFile(sourcePath, 'utf8');
const replacements = [
  ["const BUILD_VERSION = '1.0.21-ai-uplift';", "const BUILD_VERSION = '1.0.25-freeze-recovery';"],
  ["const APP_VERSION = 'rc22.3.20-ai-checkpoint';", "const APP_VERSION = '1.0.25';"]
];
for (const [before, after] of replacements) {
  if (!source.includes(before)) throw new Error(`Commonweave host wrapper could not find expected version marker: ${before}`);
  source = source.replace(before, after);
}
await fsp.writeFile(runtimePath, source, 'utf8');
try {
  await import(`${pathToFileURL(runtimePath).href}?build=1.0.25`);
} finally {
  setTimeout(() => fsp.unlink(runtimePath).catch(() => {}), 1000).unref?.();
}
