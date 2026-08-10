// Canonical compatibility target: server/compat/server-local-v131.mjs
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'server', 'compat', 'server-local-v131.mjs');
const runtimePath = path.join(root, '.civweave-server-local.entry.mjs');
let source = await fsp.readFile(sourcePath, 'utf8');
source = source.replace("const sourcePath=path.join(rootDir,'server-v130.mjs');", "const sourcePath=path.join(rootDir,'server','compat','server-v130.mjs');");
await fsp.writeFile(runtimePath, source, 'utf8');
try { await import(`${pathToFileURL(runtimePath).href}?stable=local`); }
finally { setTimeout(() => fsp.unlink(runtimePath).catch(() => {}), 1000).unref?.(); }
