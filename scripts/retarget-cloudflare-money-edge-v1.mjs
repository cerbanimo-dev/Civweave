import { readFile, writeFile } from 'node:fs/promises';

const OLD_ORIGIN = 'https://api.commonweave.earth';
const NEW_ORIGIN = 'https://core.civweave.com';
const files = [
  'cloudflare/core/wrangler.template.jsonc',
  'cloudflare/core/src/index.mjs',
  'config/launch-topology-v1.json',
  'config/host-node-transports-v1.json',
  'config/node-money-edge.example.json',
  'lib/node-ai-bootstrap-v1.mjs',
  '.env.ai-wallet.example',
  'scripts/verify-cloudflare-launch-kit-v1.mjs',
  'docs/finance/node-money-edge-launch-v1.md',
  'docs/operations/launch-kit-cloudflare-node-fabric-v1.md'
];

let replacements = 0;
for (const file of files) {
  const before = await readFile(file, 'utf8');
  const count = before.split(OLD_ORIGIN).length - 1;
  if (count === 0) {
    if (!before.includes(NEW_ORIGIN)) throw new Error(`${file}: neither old nor new canonical origin is present`);
    continue;
  }
  const after = before.replaceAll(OLD_ORIGIN, NEW_ORIGIN);
  await writeFile(file, after);
  replacements += count;
  console.log(`${file}: ${count} replacement${count === 1 ? '' : 's'}`);
}

for (const file of files) {
  const text = await readFile(file, 'utf8');
  if (text.includes(OLD_ORIGIN)) throw new Error(`${file}: stale money-edge origin remains`);
  if (!text.includes(NEW_ORIGIN)) throw new Error(`${file}: canonical money-edge origin missing`);
}

console.log(JSON.stringify({ ok: true, oldOrigin: OLD_ORIGIN, canonicalMoneyEdge: NEW_ORIGIN, replacements, files: files.length }, null, 2));
