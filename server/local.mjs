import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = (await fsp.readFile(path.join(root, 'VERSION'), 'utf8')).trim();
const release = path.join(root, 'releases', version, 'server');
const runtimePath = path.join(root, '.civweave-canonical-local.entry.mjs');
let source = await fsp.readFile(path.join(release, 'server-local-v131.mjs'), 'utf8');
const wrapperSource = "const sourcePath=path.join(rootDir,'server-v130.mjs');";
if (!source.includes(wrapperSource)) throw new Error('Canonical local runtime no longer exposes its v130 source boundary.');
source = source.replace(wrapperSource, `const sourcePath=path.join(rootDir,'releases','${version}','server','server-v130.mjs');`);
const readNeedle = "let source=(await fsp.readFile(sourcePath,'utf8')).replace(/^\\uFEFF/,'').replace(/\\r\\n?/g,'\\n');";
if (!source.includes(readNeedle)) throw new Error('Canonical local runtime no longer exposes its source materialization hook.');
source = source.replace(readNeedle, `${readNeedle}\nsource=source.replace("const sourcePath = path.join(rootDir, 'server.mjs');", "const sourcePath = path.join(rootDir, 'releases', '${version}', 'server', 'server.mjs');");`);
await fsp.writeFile(runtimePath, source, 'utf8');
try {
  await import(`${pathToFileURL(runtimePath).href}?canonical=${encodeURIComponent(version)}-local`);
} finally {
  setTimeout(() => fsp.unlink(runtimePath).catch(() => {}), 1000).unref?.();
}
