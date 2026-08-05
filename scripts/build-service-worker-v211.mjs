import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const corePath = path.join(root, 'public/service-worker-core-v208.js');
const overridePath = path.join(root, 'scripts/service-worker-offline-v211-override.js');
const outputPath = path.join(root, 'public/service-worker-v203.js');

const [core, override] = await Promise.all([
  readFile(corePath, 'utf8'),
  readFile(overridePath, 'utf8')
]);

const banner = '// GENERATED: lightweight-shell-v208 core + offline-campus-seed-provenance-v211\n';
const output = `${banner}${core.trimEnd()}\n${override.trim()}\n`;
await writeFile(outputPath, output, 'utf8');
console.log(JSON.stringify({
  output: 'public/service-worker-v203.js',
  coreBytes: Buffer.byteLength(core),
  overrideBytes: Buffer.byteLength(override),
  outputBytes: Buffer.byteLength(output)
}, null, 2));
