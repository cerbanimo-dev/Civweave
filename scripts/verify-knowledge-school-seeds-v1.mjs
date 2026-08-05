import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const root = path.join(repo, 'public', 'downloads', 'knowledge-schools');
const catalogPath = path.join(root, 'catalog.json');
const maxCloudflareAssetBytes = 24 * 1024 * 1024;
const read = relative => fs.readFile(path.join(repo, relative), 'utf8');
const assertIncludes = (source, tokens, label) => {
  for (const token of tokens) if (!source.includes(token)) throw new Error(`${label} is missing ${token}`);
};

async function sha256(file) {
  const data = await fs.readFile(file);
  return crypto.createHash('sha256').update(data).digest('hex');
}

const catalog = JSON.parse(await fs.readFile(catalogPath, 'utf8'));
if (catalog.schema !== 'commonweave.knowledge-school-catalog.v1') throw new Error('Unexpected knowledge-school catalog schema.');
if (!Array.isArray(catalog.schools) || catalog.schools.length !== 11) throw new Error(`Expected 11 schools, found ${catalog.schools?.length ?? 0}.`);
const articleCount = catalog.schools.reduce((sum, school) => sum + Number(school.counts?.articles || 0), 0);
if (articleCount !== 1001) throw new Error(`Expected 1001 articles, found ${articleCount}.`);
if (catalog.reconciliation?.crossroads_articles !== 0 || catalog.reconciliation?.crossroads_titles?.length) throw new Error('Knowledge-school catalog still contains unassigned crossroads articles.');

const slugs = new Set();
let compressedBytes = 0;
for (const school of catalog.schools) {
  if (!school.school_slug || slugs.has(school.school_slug)) throw new Error(`Duplicate or missing school slug: ${school.school_slug}`);
  slugs.add(school.school_slug);
  if (!String(school.zip_file).startsWith('schools/') || String(school.zip_file).includes('..')) throw new Error(`Unsafe school ZIP path: ${school.zip_file}`);
  const file = path.join(root, school.zip_file);
  const stat = await fs.stat(file);
  if (!stat.isFile()) throw new Error(`Missing school ZIP: ${school.zip_file}`);
  if (stat.size !== Number(school.zip_bytes)) throw new Error(`Size mismatch for ${school.zip_file}: ${stat.size} != ${school.zip_bytes}`);
  if (stat.size > maxCloudflareAssetBytes) throw new Error(`${school.zip_file} exceeds the 24 MiB Cloudflare release boundary.`);
  const actual = await sha256(file);
  if (actual !== school.zip_sha256) throw new Error(`SHA-256 mismatch for ${school.zip_file}`);
  compressedBytes += stat.size;
}

for (const [name, batch] of Object.entries(catalog.recommended_batches || {})) {
  if (!Array.isArray(batch) || !batch.length) throw new Error(`Empty recommended batch: ${name}`);
  for (const slug of batch) if (!slugs.has(slug)) throw new Error(`Batch ${name} references unknown school ${slug}`);
}
if ((catalog.recommended_batches?.['complete-foundations'] || []).length !== 11) throw new Error('complete-foundations must include all eleven schools.');

for (const relative of [
  'catalog.json',
  'commonweave-school-catalog.sqlite',
  'RECONCILIATION.json',
  'SHA256SUMS',
  'README.md',
  'batch_unpack_schools.py',
]) {
  const stat = await fs.stat(path.join(root, relative));
  if (!stat.isFile()) throw new Error(`Missing knowledge-school support file: ${relative}`);
}

const [index, helper, installer, installRuntime, boundary, updateController, updateWorker, workerWrapper] = await Promise.all([
  read('public/index.html'),
  read('public/app/knowledge-school-seeds-v1.js'),
  read('public/app/knowledge-school-installer-v1.js'),
  read('public/install-v130.js'),
  read('public/app/install-boundary-v146.js'),
  read('public/app/pwa-update-controller-v204.js'),
  read('public/service-worker-update-v204.js'),
  read('public/service-worker-v203.js'),
]);
assertIncludes(index, ['knowledge-school-list', 'knowledge-school-seeds-v1.js', 'knowledge-school-installer-v1.js', 'Download once. Keep it through updates.'], 'installer page');
assertIncludes(helper, [
  "CACHE_NAME='cwknowledge-school-seeds-v2'",
  "LEGACY_CACHE_NAMES=['commonweave-knowledge-schools-v1']",
  'migrateLegacyCaches',
  'cachedCurrent',
  'navigator.storage.persist()',
  'async function save(',
  "phase:'cached'",
], 'knowledge helper');
if (helper.includes('serviceWorker.register')) throw new Error('Optional school staging must not register or replace the core service worker.');
assertIncludes(installer, ['neededSchools', 'Save selected library', 'Download ${needed.length}', "progress.phase==='cached'", 'saved offline'], 'knowledge installer');
assertIncludes(installRuntime, [
  "const LIBRARY_CACHE='cwknowledge-school-seeds-v2'",
  'migrateKnowledgeCache',
  'protectedCache',
  'waitForCurrentWorker',
  "UPDATE_REVISION='visible-update-library-preservation-v206-worker-global-isolation-gateway-assets'",
], 'app installer runtime');
assertIncludes(boundary, ["PWA_UPDATE_SCRIPT='/app/pwa-update-controller-v204.js'", 'addScript(PWA_UPDATE_SCRIPT)', "pwaUpdateRevision:'v204-visible-update-library-preservation'"], 'install boundary');
assertIncludes(updateController, [
  'data-commonweave-update-control',
  "setState('Check updates'",
  "setState('Restart to update'",
  'registration.update()',
  'migrateKnowledgeCache',
  "const LIBRARY_CACHE='cwknowledge-school-seeds-v2'",
], 'installed update controller');
assertIncludes(updateWorker, ["const CACHE='cwupdate-visible-v204'", "'/app/pwa-update-controller-v204.js'", "knowledgeCache:'cwknowledge-school-seeds-v2'"], 'update service-worker lane');
assertIncludes(workerWrapper, ["importScripts('/service-worker-update-v204.js?v=visible-update-library-preservation-v206')", 'update-v204'], 'service-worker wrapper');

for (const source of [helper, installer, installRuntime, boundary, updateController, updateWorker]) new Function(source);

console.log(JSON.stringify({
  schools: catalog.schools.length,
  articles: articleCount,
  compressedBytes,
  compressedMiB: Number((compressedBytes / 1024 / 1024).toFixed(2)),
  largestSchoolMiB: Number((Math.max(...catalog.schools.map(school => school.zip_bytes)) / 1024 / 1024).toFixed(2)),
  crossroads: catalog.reconciliation.crossroads_articles,
  knowledgeCache: 'cwknowledge-school-seeds-v2',
  appUpdateControl: 'visible-v204',
  currentFilesSkipRedownload: true,
}, null, 2));
