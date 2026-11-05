import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const runtime=readFileSync(new URL('../public/app/civweave-guild-map-runtime-v2.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/app/commons-between.html',import.meta.url),'utf8');
const entry=readFileSync(new URL('../public/app/commons-between-entry-v1.mjs',import.meta.url),'utf8');

test('Guild Map exposes Commons Between entry for the selected Guild',()=>{
  assert.match(runtime,/Enter The Commons Between/);
  assert.match(runtime,/commons-between\.html\?guild=/);
  assert.match(runtime,/encodeURIComponent\(nodeId\)/);
});

test('Commons entry surface uses the canonical universe blueprint',()=>{
  assert.match(html,/The Commons Between/);
  assert.match(html,/commons-between-entry-v1\.mjs/);
  assert.match(entry,/COMMONS_BETWEEN/);
  assert.match(entry,/worldweaver-universe-v1\.mjs/);
  assert.match(entry,/civweave\.commons-between\.last-room\.v1/);
  assert.match(html,/DreamGrid \/ OpenSimulator provider: not connected/);
});
