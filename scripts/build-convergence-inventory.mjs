import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const POLICY_PATH = path.join(ROOT, 'config', 'convergence-policy.json');
const OUTPUT_PATH = path.join(ROOT, 'artifacts', 'convergence', 'runtime-inventory.json');
const SUMMARY_PATH = path.join(ROOT, 'artifacts', 'convergence', 'runtime-inventory.md');

const SCAN_ROOTS = ['public', 'scripts', 'lib'];
const RUNTIME_EXTENSIONS = new Set([
  '.html', '.js', '.mjs', '.cjs', '.css', '.json', '.webmanifest', '.yaml', '.yml', '.toml'
]);
const SKIP_DIRECTORIES = new Set(['.git', 'node_modules', 'artifacts', 'dist', 'build', 'coverage']);
const ROOT_RUNTIME_PATTERN = /^(?:package\.json|server(?:-[a-z0-9_.-]+)?\.mjs|render\.ya?ml|wrangler\.toml)$/i;
const REFERENCE_PATTERNS = [
  /(?:src|href)\s*=\s*["']([^"'#?]+)(?:[?#][^"']*)?["']/g,
  /(?:import\s+(?:[^"']+?\s+from\s+)?|export\s+[^"']+?\s+from\s+)["']([^"']+)["']/g,
  /import\s*\(\s*["']([^"']+)["']\s*\)/g,
  /(?:fetch|register|Worker|SharedWorker)\s*\(\s*["']([^"']+)["']/g,
  /new\s+URL\s*\(\s*["']([^"']+)["']/g,
  /["'](\/app\/[^"'#?]+|\/extensions\/[^"'#?]+|\/service-worker(?:-[^"'#?]+)?\.js)["']/g,
  /(?:^|[\s"'`])((?:public|scripts|lib)\/[a-z0-9_@./-]+\.(?:html?|css|js|mjs|cjs|json|webmanifest|ya?ml|toml))/gim,
  /(?:^|[\s"'`])((?:server(?:-[a-z0-9_.-]+)?\.mjs))/gim
];

function toPosix(value) {
  return value.split(path.sep).join('/');
}

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function walk(relativeDirectory, output) {
  const absoluteDirectory = path.join(ROOT, relativeDirectory);
  if (!(await pathExists(absoluteDirectory))) return;

  const entries = await fs.readdir(absoluteDirectory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.well-known') continue;
    if (entry.isDirectory() && SKIP_DIRECTORIES.has(entry.name)) continue;

    const relativePath = toPosix(path.join(relativeDirectory, entry.name));
    if (entry.isDirectory()) {
      await walk(relativePath, output);
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (!RUNTIME_EXTENSIONS.has(extension)) continue;
    output.add(relativePath);
  }
}

async function collectRootRuntimeFiles(output) {
  const entries = await fs.readdir(ROOT, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !ROOT_RUNTIME_PATTERN.test(entry.name)) continue;
    output.add(entry.name);
  }
}

function resolveReference(fromFile, rawReference) {
  const reference = String(rawReference || '').trim();
  if (!reference || reference.startsWith('data:') || reference.startsWith('blob:')) return null;
  if (/^(?:https?:)?\/\//i.test(reference)) return null;

  const clean = reference.split('#')[0].split('?')[0];
  if (!clean) return null;

  if (clean.startsWith('/app/')) return `public${clean}`;
  if (clean.startsWith('/extensions/')) return `public${clean}`;
  if (clean.startsWith('/service-worker')) return `public${clean}`;
  if (clean.startsWith('/')) return `public${clean}`;
  if (/^(?:public|scripts|lib)\//.test(clean) || /^server(?:-[a-z0-9_.-]+)?\.mjs$/i.test(clean)) return clean;

  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), clean));
  return resolved.startsWith('../') ? null : resolved;
}

function extractReferences(filePath, source) {
  const references = new Set();
  for (const pattern of REFERENCE_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) {
      const resolved = resolveReference(filePath, match[1]);
      if (resolved) references.add(resolved);
    }
  }
  return [...references].sort();
}

function classify(filePath, reachable) {
  const lower = filePath.toLowerCase();
  if (lower.includes('/migrations/') || lower.includes('migration')) return 'migration';
  if (lower.includes('/compat/') || lower.includes('legacy') || lower.includes('tombstone') || lower.includes('alias')) return 'compatibility';
  if (lower.includes('generated') || lower.includes('/dist/') || lower.includes('/build/')) return 'generated';
  if (/(?:^|\/)(?:archive|archived|backup|backups|old|historical)(?:\/|$)/.test(lower) || /(?:backup|\.bak|_old)/.test(lower)) return 'archive';
  if (reachable.has(filePath)) return 'canonical';
  return 'orphan';
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = item[key];
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

const policy = JSON.parse(await fs.readFile(POLICY_PATH, 'utf8'));
const files = new Set();
for (const scanRoot of SCAN_ROOTS) await walk(scanRoot, files);
await collectRootRuntimeFiles(files);

for (const rootFile of ['package.json', ...policy.runtimeRoots]) {
  if (await pathExists(path.join(ROOT, rootFile))) files.add(rootFile);
}

const sortedFiles = [...files].sort();
const nodes = new Map();
for (const filePath of sortedFiles) {
  let source = '';
  try {
    source = await fs.readFile(path.join(ROOT, filePath), 'utf8');
  } catch {
    continue;
  }
  nodes.set(filePath, {
    path: filePath,
    bytes: Buffer.byteLength(source),
    references: extractReferences(filePath, source)
  });
}

const reachable = new Set();
const queue = ['package.json', ...policy.runtimeRoots].filter((filePath) => nodes.has(filePath));
while (queue.length) {
  const current = queue.shift();
  if (reachable.has(current)) continue;
  reachable.add(current);
  const node = nodes.get(current);
  if (!node) continue;
  for (const reference of node.references) {
    if (nodes.has(reference) && !reachable.has(reference)) queue.push(reference);
  }
}

const inventory = [...nodes.values()].map((node) => ({
  ...node,
  classification: classify(node.path, reachable),
  versionSuffixed: /-v\d+(?:\.[a-z0-9]+)?$/i.test(path.posix.basename(node.path, path.posix.extname(node.path)))
}));

const report = {
  schema: 'commonweave.runtime-inventory.v1',
  generatedAt: new Date().toISOString(),
  policyPhase: policy.phase,
  runtimeRoots: policy.runtimeRoots,
  totals: {
    files: inventory.length,
    reachable: reachable.size,
    bytes: inventory.reduce((sum, item) => sum + item.bytes, 0),
    byClassification: countBy(inventory, 'classification'),
    versionSuffixed: inventory.filter((item) => item.versionSuffixed).length
  },
  files: inventory
};

await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

const counts = report.totals.byClassification;
const summary = [
  '# Commonweave runtime inventory',
  '',
  `Generated: ${report.generatedAt}`,
  `Policy phase: ${report.policyPhase}`,
  '',
  '| Classification | Files |',
  '|---|---:|',
  ...['canonical', 'compatibility', 'migration', 'generated', 'archive', 'orphan'].map((name) => `| ${name} | ${counts[name] || 0} |`),
  '',
  `Reachable runtime files: ${report.totals.reachable}`,
  `Version-suffixed runtime files: ${report.totals.versionSuffixed}`,
  '',
  'The JSON artifact contains the complete file graph and is the deletion queue input.',
  'Orphan classification is a review queue, not automatic deletion permission.'
].join('\n');
await fs.writeFile(SUMMARY_PATH, `${summary}\n`, 'utf8');

console.log(`Convergence inventory: ${report.totals.files} files, ${report.totals.reachable} reachable, ${counts.orphan || 0} orphan candidates.`);
console.log(`Wrote ${path.relative(ROOT, OUTPUT_PATH)} and ${path.relative(ROOT, SUMMARY_PATH)}.`);
