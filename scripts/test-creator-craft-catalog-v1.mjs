import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const root=new URL('../public/creator-suite/',import.meta.url);
test('catalog enumerates CAD and business tools without claiming they are connected',()=>{
  const context={globalThis:{}};
  runInNewContext(readFileSync(new URL('shared/craft-catalog-v1.js',root),'utf8'),context);
  const c=context.globalThis.CivweaveCraftCatalogV1;
  assert.equal(c.applications.length,11);
  assert.equal(c.services.length,5);
  assert.equal(new Set(c.list().map(x=>x.id)).size,16);
  for(const id of ['cadcraft','wordcraft','gridcraft','deckcraft','pdfcraft'])assert.ok(c.get(id));
  for(const item of c.list()){
    assert.equal(item.connection,'not-connected');
    assert.match(item.repository,/^https:\/\/github\.com\//);
  }
  assert.equal(c.get('artcraft'),null);
  const borrowed=c.get('cadcraft');
  borrowed.connection='connected';
  assert.equal(c.get('cadcraft').connection,'not-connected');
});
test('catalog route is linked, optional-packaged and offline-cache declared',()=>{
  const read=(path)=>readFileSync(new URL(path,root),'utf8');
  assert.match(read('index.html'),/href="\/creator-suite\/tools\.html"/);
  const manifest=JSON.parse(read('package-v1.json'));
  for(const path of ['/creator-suite/tools.html','/creator-suite/shared/craft-catalog-v1.js','/creator-suite/craft-tools-v1.js'])assert.ok(manifest.assets.includes(path),path);
  const setup=read('setup.html');
  assert.match(setup,/WordCraft official releases/);
  assert.match(setup,/CADCraft official releases/);
  assert.match(setup,/PdfCraft official releases/);
  assert.match(setup,/Phone-to-PC execution requires a separately authenticated HTTPS host-node integration/);
  assert.match(read('tools.html'),/href="\/creator-suite\/setup.html"/);
  assert.ok(manifest.assets.includes('/creator-suite/setup.html'));
    const toolPage=read('tools.html');
  assert.match(toolPage,/id="cadcraft-file"/);
  assert.match(toolPage,/id="cadcraft-run"/);
  assert.match(toolPage,/id="pdfcraft-files"/);
  assert.match(toolPage,/id="wordcraft-token"/);
  const sw=read('service-worker.js');
  assert.ok(sw.includes('/creator-suite/setup.html'));

  for(const path of ['/creator-suite/tools.html','/creator-suite/shared/craft-catalog-v1.js','/creator-suite/craft-tools-v1.js'])assert.ok(sw.includes(path),path);
});
