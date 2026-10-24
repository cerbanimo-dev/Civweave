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
  const sw=read('service-worker.js');
  for(const path of ['/creator-suite/tools.html','/creator-suite/shared/craft-catalog-v1.js','/creator-suite/craft-tools-v1.js'])assert.ok(sw.includes(path),path);
});
