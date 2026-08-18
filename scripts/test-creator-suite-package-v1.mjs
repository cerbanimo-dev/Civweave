import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = new URL('..', import.meta.url);
const readJson = async relative => JSON.parse(await fs.readFile(new URL(relative, root), 'utf8'));
const exists = async relative => { try { await fs.access(new URL(relative, root)); return true; } catch { return false; } };

const creator = await readJson('./public/creator-suite/package-v1.json');
const core = await readJson('./public/app/offline-package-v208.json');
const webmanifest = await readJson('./public/creator-suite/manifest.webmanifest');

assert.equal(creator.schema, 'civweave.creator-suite-package.v1');
assert.equal(creator.installation, 'optional-separate-download');
assert.equal(creator.scope, '/creator-suite/');
assert.equal(webmanifest.scope, '/creator-suite/');
assert.equal(webmanifest.start_url, '/creator-suite/');
assert.ok(Array.isArray(creator.assets) && creator.assets.length >= 8);
assert.ok(creator.sharedDependencies.includes('/app/content-provenance-v1.js'));

for (const asset of creator.assets) {
  const relative = `./public${asset}`;
  assert.equal(await exists(relative), true, `Creator Suite asset must exist: ${asset}`);
}
for (const dep of creator.sharedDependencies) {
  assert.equal(await exists(`./public${dep}`), true, `Creator Suite shared dependency must exist: ${dep}`);
}

assert.equal(core.seeds.some(value => String(value).startsWith('/creator-suite/')), false);
assert.equal(core.assets.some(value => String(value).startsWith('/creator-suite/')), false);
assert.equal(core.includePrefixes.some(value => String(value).startsWith('/creator-suite/')), false);
assert.equal(core.lazyPacks.some(pack => JSON.stringify(pack).includes('/creator-suite/')), false);

const serviceWorker = await fs.readFile(new URL('./public/creator-suite/service-worker.js', root), 'utf8');
assert.match(serviceWorker, /scope|creator-suite/i);
assert.match(serviceWorker, /content-provenance-v1\.js/);
assert.doesNotMatch(serviceWorker, /working-campus-v156|realm-console-v140|fellowfare-cabinet-v144|anarchadia-console-v139/);

console.log('Creator Suite package isolation contract passed');
