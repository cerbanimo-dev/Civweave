import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = (await fsp.readFile(path.join(root, 'VERSION'), 'utf8')).trim();
const release = path.join(root, 'releases', version, 'server');
const runtimePath = path.join(root, '.civweave-canonical-gateway.entry.mjs');
let source = await fsp.readFile(path.join(release, 'server-gateway-v131.mjs'), 'utf8');
const wrapperSource = "const sourcePath = path.join(rootDir, 'server-gateway-v131-base.mjs');";
if (!source.includes(wrapperSource)) throw new Error('Canonical gateway runtime no longer exposes its base-wrapper boundary.');
source = source.replace(wrapperSource, `const sourcePath = path.join(rootDir, 'releases', '${version}', 'server', 'server-gateway-v131-base.mjs');`);
const readNeedle = "let source = (await fsp.readFile(sourcePath, 'utf8')).replace(/^\\uFEFF/, '').replace(/\\r\\n?/g, '\\n');";
if (!source.includes(readNeedle)) throw new Error('Canonical gateway runtime no longer exposes its source materialization hook.');
source = source.replace(readNeedle, `${readNeedle}\nsource = source.replace("const sourcePath = path.join(rootDir, 'server.mjs');", "const sourcePath = path.join(rootDir, 'releases', '${version}', 'server', 'server.mjs');");`);
await fsp.writeFile(runtimePath, source, 'utf8');
try {
  await import(`${pathToFileURL(runtimePath).href}?canonical=${encodeURIComponent(version)}-gateway`);
} finally {
  setTimeout(() => fsp.unlink(runtimePath).catch(() => {}), 1000).unref?.();
}
