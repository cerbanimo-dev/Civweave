// Canonical compatibility target: server/compat/server-gateway-v131.mjs
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'server', 'compat', 'server-gateway-v131.mjs');
const runtimePath = path.join(root, '.civweave-server-gateway.entry.mjs');
let source = await fsp.readFile(sourcePath, 'utf8');
source = source.replace("const sourcePath = path.join(rootDir, 'server-gateway-v131-base.mjs');", "const sourcePath = path.join(rootDir, 'server', 'compat', 'server-gateway-v131-base.mjs');");
await fsp.writeFile(runtimePath, source, 'utf8');
try { await import(`${pathToFileURL(runtimePath).href}?stable=gateway`); }
finally { setTimeout(() => fsp.unlink(runtimePath).catch(() => {}), 1000).unref?.(); }
