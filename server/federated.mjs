import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'server', 'compat', 'server-federated-v152.mjs');
const runtimePath = path.join(root, '.civweave-server-federated.entry.mjs');
let source = await fsp.readFile(sourcePath, 'utf8');
source = source.replace("const APP_ENTRY = process.env.CIVWEAVE_APP_ENTRY || 'server-gateway-v131.mjs';", "const APP_ENTRY = process.env.CIVWEAVE_APP_ENTRY || 'server/gateway.mjs';");
await fsp.writeFile(runtimePath, source, 'utf8');
try { await import(`${pathToFileURL(runtimePath).href}?stable=federated`); }
finally { setTimeout(() => fsp.unlink(runtimePath).catch(() => {}), 1000).unref?.(); }
