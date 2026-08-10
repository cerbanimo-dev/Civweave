import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const version=(await fsp.readFile(path.join(root,'VERSION'),'utf8')).trim();
const release=path.join(root,'releases',version,'server');
await import(pathToFileURL(path.join(release,'server-local-v131.mjs')).href+'?canonical='+encodeURIComponent(version));
