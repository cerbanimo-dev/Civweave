import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(new URL('../', import.meta.url).pathname);
const d1Id = String(process.env.CIVWEAVE_CORE_D1_ID || process.argv.find(arg => arg.startsWith('--d1-id='))?.slice('--d1-id='.length) || '').trim();
if (!/^[0-9a-f-]{20,}$/i.test(d1Id)) {
  console.error('CIVWEAVE_CORE_D1_ID (or --d1-id=<id>) is required. Create/reuse the D1 database named civweave-core, then rerun this preparer.');
  process.exit(2);
}

const templatePath = path.join(root, 'cloudflare/core/wrangler.template.jsonc');
const outputDir = path.join(root, '.cloudflare-launch');
const outputPath = path.join(outputDir, 'core.wrangler.jsonc');
const template = await readFile(templatePath, 'utf8');
if (!template.includes('__CIVWEAVE_CORE_D1_ID__')) throw new Error('Core Wrangler template is missing the D1 placeholder.');
let rendered = template.replaceAll('__CIVWEAVE_CORE_D1_ID__', d1Id);
rendered = rendered
  .replace('"main": "src/index.mjs"', '"main": "../cloudflare/core/src/index.mjs"')
  .replace('"migrations_dir": "migrations"', '"migrations_dir": "../cloudflare/core/migrations"');
if (!rendered.includes('"main": "../cloudflare/core/src/index.mjs"')) throw new Error('Generated Wrangler config did not retarget the core Worker entrypoint.');
if (!rendered.includes('"migrations_dir": "../cloudflare/core/migrations"')) throw new Error('Generated Wrangler config did not retarget the D1 migrations directory.');
await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, rendered);

console.log(JSON.stringify({
  ok: true,
  generated: path.relative(root, outputPath),
  d1Database: 'civweave-core',
  r2Bucket: 'civweave-distribution',
  coreWorker: 'civweave-core',
  nodeFabricWorker: 'civweave-node-cloud',
  moneyEdgeAuthority: 'cloudflare-core',
  platformFeeBps: 1500,
  liveMoneyEnabled: false,
  workerEntry: '../cloudflare/core/src/index.mjs',
  migrationsDir: '../cloudflare/core/migrations',
  next: [
    'npx wrangler d1 migrations apply civweave-core --remote --config .cloudflare-launch/core.wrangler.jsonc',
    'npx wrangler deploy --config .cloudflare-launch/core.wrangler.jsonc',
    'npx wrangler deploy --config cloudflare/node-cloud/wrangler.jsonc'
  ]
}, null, 2));
