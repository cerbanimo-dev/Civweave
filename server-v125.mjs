import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(root, 'server.mjs');
const runtimePath = path.join(root, '.civweave-server-v125.runtime.mjs');
const CURRENT_VERSION = '1.0.25';
const CURRENT_BUILD = '1.0.25-freeze-recovery';

async function patchTextFile(relativePath, replacements) {
  const target = path.join(root, relativePath);
  try {
    let text = await fsp.readFile(target, 'utf8');
    const before = text;
    for (const [from, to] of replacements) text = text.replaceAll(from, to);
    if (text !== before) await fsp.writeFile(target, text, 'utf8');
  } catch (error) {
    // Container builds patch these files before the unprivileged runtime starts.
    // Local/node deployments can patch them here. Either way, never stop the host.
    console.warn(`Static version alignment skipped for ${relativePath}:`, error.message);
  }
}

await patchTextFile(path.join('public', 'app', 'index.html'), [
  ['1.0.21-ai-uplift', CURRENT_BUILD],
  ['rc22.3.20-ai-checkpoint', CURRENT_VERSION],
  ['HOST v1.0.21', `HOST v${CURRENT_VERSION}`]
]);
await patchTextFile(path.join('public', 'app', 'seed.json'), [
  ['rc22.3.20-ai-uplift-v1.0.21', CURRENT_BUILD]
]);
await patchTextFile(path.join('public', 'index.html'), [
  ['AI UPLIFT · HOST v1.0.21', `RECOVERY · HOST v${CURRENT_VERSION}`],
  ['HOST v1.0.21', `HOST v${CURRENT_VERSION}`]
]);

let source = await fsp.readFile(sourcePath, 'utf8');
const replacements = [
  ["const BUILD_VERSION = '1.0.21-ai-uplift';", `const BUILD_VERSION = '${CURRENT_BUILD}';`],
  ["const APP_VERSION = 'rc22.3.20-ai-checkpoint';", `const APP_VERSION = '${CURRENT_VERSION}';`]
];
for (const [before, after] of replacements) {
  if (!source.includes(before)) throw new Error(`Civweave host wrapper could not find expected version marker: ${before}`);
  source = source.replace(before, after);
}
await fsp.writeFile(runtimePath, source, 'utf8');
try {
  await import(`${pathToFileURL(runtimePath).href}?build=${CURRENT_VERSION}`);
} finally {
  setTimeout(() => fsp.unlink(runtimePath).catch(() => {}), 1000).unref?.();
}
