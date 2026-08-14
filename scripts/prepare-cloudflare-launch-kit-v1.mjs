import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const d1Id = String(process.env.CIVWEAVE_CORE_D1_ID || process.argv.find(arg => arg.startsWith('--d1-id='))?.slice('--d1-id='.length) || '').trim();
if (!/^[0-9a-f-]{20,}$/i.test(d1Id)) {
  console.error('CIVWEAVE_CORE_D1_ID (or --d1-id=<id>) is required. Create/reuse the D1 database named civweave-core, then rerun this preparer.');
  process.exit(2);
}

const outputDir = path.join(root, '.cloudflare-launch');
const coreTemplatePath = path.join(root, 'cloudflare/core/wrangler.template.jsonc');
const coreOutputPath = path.join(outputDir, 'core.wrangler.jsonc');
const sharedTemplatePath = path.join(root, 'cloudflare/shared-domain/wrangler.template.jsonc');
const sharedOutputPath = path.join(outputDir, 'shared-domain.wrangler.jsonc');

async function renderWorkerTemplate(templatePath, outputPath, sourceRoot, { migrations = false } = {}) {
  const template = await readFile(templatePath, 'utf8');
  if (!template.includes('__CIVWEAVE_CORE_D1_ID__')) throw new Error(`${path.relative(root, templatePath)} is missing the D1 placeholder.`);
  const templateEntryMatch = template.match(/"main"\s*:\s*"([^"]+)"/);
  const templateEntry = String(templateEntryMatch?.[1] || '').trim();
  if (!templateEntry) throw new Error(`${path.relative(root, templatePath)} is missing its Worker entrypoint.`);
  const generatedEntry = `../${sourceRoot}/${templateEntry.replace(/^\.\//, '')}`;
  let rendered = template
    .replaceAll('__CIVWEAVE_CORE_D1_ID__', d1Id)
    .replace(`"main": "${templateEntry}"`, `"main": "${generatedEntry}"`);
  if (migrations) rendered = rendered.replace('"migrations_dir": "migrations"', `"migrations_dir": "../${sourceRoot}/migrations"`);
  if (!rendered.includes(`"main": "${generatedEntry}"`)) throw new Error(`Generated Wrangler config did not retarget ${templateEntry}.`);
  if (migrations && !rendered.includes(`"migrations_dir": "../${sourceRoot}/migrations"`)) throw new Error('Generated Wrangler config did not retarget the D1 migrations directory.');
  await writeFile(outputPath, rendered);
  return { outputPath, generatedEntry };
}

await mkdir(outputDir, { recursive: true });
const core = await renderWorkerTemplate(coreTemplatePath, coreOutputPath, 'cloudflare/core', { migrations: true });
const shared = await renderWorkerTemplate(sharedTemplatePath, sharedOutputPath, 'cloudflare/shared-domain');

console.log(JSON.stringify({
  ok: true,
  generated: [path.relative(root, core.outputPath), path.relative(root, shared.outputPath)],
  d1Database: 'civweave-core',
  r2Bucket: 'civweave-distribution',
  coreWorker: 'civweave-core',
  sharedDomainRouter: 'civweave-domain-router',
  sharedDomain: 'civweave.cc',
  nodeFabricWorker: 'civweave-node-cloud',
  moneyEdgeAuthority: 'cloudflare-core',
  computeTopupCerbanimoBps: 500,
  topupSplit: '70-system/25-host/5-cerbanimo',
  membershipSplit: '50-system/25-host/25-cerbanimo',
  fundsModel: 'platform-reserve-separate-transfer',
  liveMoneyEnabled: false,
  workerEntries: {
    core: core.generatedEntry,
    sharedDomain: shared.generatedEntry
  },
  migrationsDir: '../cloudflare/core/migrations',
  next: [
    'npx wrangler d1 migrations apply civweave-core --remote --config .cloudflare-launch/core.wrangler.jsonc',
    'npx wrangler deploy --config .cloudflare-launch/core.wrangler.jsonc',
    'npx wrangler deploy --config .cloudflare-launch/shared-domain.wrangler.jsonc',
    'npx wrangler deploy --config cloudflare/node-cloud/wrangler.jsonc'
  ]
}, null, 2));
