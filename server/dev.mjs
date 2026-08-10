import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'server', 'compat', 'server-v130.mjs');
const runtimePath = path.join(root, '.civweave-server-dev.entry.mjs');
const source = await fsp.readFile(sourcePath, 'utf8');
await fsp.writeFile(runtimePath, source, 'utf8');
try { await import(`${pathToFileURL(runtimePath).href}?stable=dev`); }
finally { setTimeout(() => fsp.unlink(runtimePath).catch(() => {}), 1000).unref?.(); }
