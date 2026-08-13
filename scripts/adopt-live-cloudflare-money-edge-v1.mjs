import { readFile, writeFile } from 'node:fs/promises';

const LEGACY_ORIGINS = Object.freeze([
  'https://api.commonweave.earth',
  'https://civweave-core.glaedn.workers.dev'
]);
const NEW_ORIGIN = 'https://civweave-core.cerbanimo.workers.dev';
const files = [
  'cloudflare/core/src/index.mjs',
  'cloudflare/core/src/live-entry.mjs',
  'config/launch-topology-v1.json',
  'config/host-node-transports-v1.json',
  'config/node-money-edge.example.json',
  'lib/node-ai-bootstrap-v1.mjs',
  '.env.ai-wallet.example',
  'scripts/verify-cloudflare-launch-kit-v1.mjs',
  'scripts/verify-stripe-live-readiness-preflight.mjs',
  'docs/finance/live-money-human-gate.md',
  'docs/finance/node-money-edge-launch-v1.md',
  'docs/operations/launch-kit-cloudflare-node-fabric-v1.md'
];

let replacements = 0;
const byOrigin = Object.fromEntries(LEGACY_ORIGINS.map(origin => [origin, 0]));
for (const file of files) {
  let text = await readFile(file, 'utf8');
  for (const origin of LEGACY_ORIGINS) {
    const count = text.split(origin).length - 1;
    if (count > 0) {
      text = text.replaceAll(origin, NEW_ORIGIN);
      replacements += count;
      byOrigin[origin] += count;
    }
  }
  await writeFile(file, text);
}

for (const file of files) {
  const text = await readFile(file, 'utf8');
  for (const origin of LEGACY_ORIGINS) {
    if (text.includes(origin)) throw new Error(`${file}: stale money-edge origin remains: ${origin}`);
  }
  if (!text.includes(NEW_ORIGIN)) throw new Error(`${file}: canonical Cerbanimo money-edge origin is missing`);
}

console.log(JSON.stringify({
  ok: true,
  legacyOrigins: LEGACY_ORIGINS,
  canonicalMoneyEdge: NEW_ORIGIN,
  replacements,
  replacementsByOrigin: byOrigin,
  files: files.length
}, null, 2));