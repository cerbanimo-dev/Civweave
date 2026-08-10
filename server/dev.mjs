import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = (await fsp.readFile(path.join(root, 'VERSION'), 'utf8')).trim();
const release = path.join(root, 'releases', version, 'server');
const runtimePath = path.join(root, '.civweave-canonical-dev.entry.mjs');
let source = await fsp.readFile(path.join(release, 'server-v130.mjs'), 'utf8');
const sourceNeedle = "const sourcePath = path.join(rootDir, 'server.mjs');";
if (!source.includes(sourceNeedle)) throw new Error('Canonical dev runtime no longer exposes its base source boundary.');
source = source.replace(sourceNeedle, `const sourcePath = path.join(rootDir, 'releases', '${version}', 'server', 'server.mjs');`);
await fsp.writeFile(runtimePath, source, 'utf8');
try {
  await import(`${pathToFileURL(runtimePath).href}?canonical=${encodeURIComponent(version)}-dev`);
} finally {
  setTimeout(() => fsp.unlink(runtimePath).catch(() => {}), 1000).unref?.();
}
