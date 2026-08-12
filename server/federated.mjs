import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = (await fsp.readFile(path.join(root, 'VERSION'), 'utf8')).trim();
const release = path.join(root, 'releases', version, 'server');
const runtimePath = path.join(root, '.civweave-canonical-federated.entry.mjs');
process.env.DATA_DIR ||= path.join(root, 'data');
process.env.CIVWEAVE_APP_ENTRY ||= path.join(root, 'server', 'gateway.mjs');
const source = await fsp.readFile(path.join(release, 'server-federated-v152.mjs'), 'utf8');
await fsp.writeFile(runtimePath, source, 'utf8');
try {
  await import(`${pathToFileURL(runtimePath).href}?canonical=${encodeURIComponent(version)}-federated`);
} finally {
  setTimeout(() => fsp.unlink(runtimePath).catch(() => {}), 1000).unref?.();
}
