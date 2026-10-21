import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const pkg = JSON.parse(await read('package.json'));
const retiredMutators = /(?:sync-release-version-assets|build-service-worker-v211|sync-release-coherence-v220|generate-prelive-metadata-v281|sync-canonical-release-hashes)\.mjs/;

test('the normal verification command validates checked-in source without release generation', () => {
  assert.doesNotMatch(pkg.scripts.check, retiredMutators);
  assert.match(pkg.scripts.check, /test-verification-workflow-v1\.mjs/);
  for (const check of ['check:release-discipline', 'check:syntax', 'test:node-ai-marketplace', 'test:node-ai-http', 'test:node-ai-routing', 'test:node-ai-network-replay']) {
    assert.ok(pkg.scripts.check.includes(check), `Normal verification lost ${check}.`);
  }
});

test('runtime verification never imports a release mutator', async () => {
  const entries = new Set(), seenScripts = new Set(), seenModules = new Set();
  function collect(name) {
    if (seenScripts.has(name)) return;
    seenScripts.add(name);
    for (const hook of [`pre${name}`, name, `post${name}`]) {
      for (const command of String(pkg.scripts[hook] || '').split('&&')) {
        const nested = command.match(/\bnpm run ([\w:-]+)/)?.[1];
        if (nested) collect(nested);
        if (/^\s*node\s/.test(command) && !command.includes('--check')) {
          for (const file of command.trim().split(/\s+/).filter(token => /\.[cm]?js$/.test(token))) entries.add(new URL(file, root));
        }
      }
    }
  }
  async function inspect(url) {
    if (seenModules.has(url.href)) return;
    seenModules.add(url.href);
    assert.doesNotMatch(url.pathname, retiredMutators, `${url.pathname} must not run during source verification.`);
    const source = await readFile(url, 'utf8');
    const imports = /(?:\bimport\s*\(\s*|\b(?:import|export)\s+(?:[^'";]*?\s+from\s+)?)['"]([^'"]+)['"]/g;
    for (const [, specifier] of source.matchAll(imports)) if (specifier.startsWith('.')) await inspect(new URL(specifier, url));
  }
  collect('check');
  for (const url of entries) await inspect(url);
  assert.ok(seenModules.size > 20, 'The contract must inspect the executable verification dependency graph.');
});

test('syntax verification discovers current source instead of pinning deleted revisions', async () => {
  assert.equal(pkg.scripts['check:syntax'], 'node scripts/check-source-syntax.mjs');
  const { syntaxTargets } = await import('./check-source-syntax.mjs');
  assert.deepEqual(syntaxTargets([
    'public/app/settings-gateway-v317.js', 'functions/api/health.js',
    'public/app/vendor/transformers/transformers.min.js', 'releases/1.0.79/server/local.mjs',
    'scripts/example.mjs', 'public/app/example.css', 'cloudflare/core/src/index.mjs',
  ]), ['cloudflare/core/src/index.mjs', 'functions/api/health.js', 'public/app/settings-gateway-v317.js', 'scripts/example.mjs']);
});

test('installer packaging preserves the checked-in route graph', async () => {
  const builder = await read('scripts/build-install-artifacts.sh');
  assert.doesNotMatch(builder, /sync-release-version-assets\.mjs|sync-release-coherence-v220\.mjs/,
    'Installed packaging must not restore the retired single-shell release topology.');
  for (const script of ['materialize-parity-ledger.mjs', 'build-civweave-map-v1.mjs', 'smoke-installer-resume-state-v280.mjs', 'smoke-installer-hardening-v281.mjs', 'build-mobile-install-kit.mjs']) {
    assert.ok(builder.includes(script), `Installer packaging lost ${script}.`);
  }
  assert.doesNotMatch(await read('scripts/generate-asset-lockboard-catalog-v239.mjs'), /finalize-pwa-start-v436/,
    'Catalog generation must not rewrite the canonical manifest or installer.');
  assert.equal(await read('scripts/finalize-pwa-start-v436.mjs').then(() => true, () => false), false,
    'The obsolete manifest finalizer must not remain an alternative build owner.');
});
