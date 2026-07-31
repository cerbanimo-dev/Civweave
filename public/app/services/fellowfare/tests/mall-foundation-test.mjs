import fs from 'node:fs';
import assert from 'node:assert/strict';
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const report=JSON.parse(fs.readFileSync(new URL('../MALL-ASSET-REPORT.json',import.meta.url),'utf8'));
assert.match(app,/const FELLOWFARE_MALL_SCENES = \{/);
assert.match(app,/function renderMall\(/);
assert.match(index,/data-route="mall"/);
assert.equal(report.scenes.length,31);
for(const scene of report.scenes){
  const variants=[`${scene.id}:{`,`'${scene.id}':{`,`"${scene.id}":{`];
  assert.ok(variants.some((value)=>app.includes(value)),`Missing mall scene ${scene.id}`);
}
console.log('FellowFare mall foundation tests passed.');
