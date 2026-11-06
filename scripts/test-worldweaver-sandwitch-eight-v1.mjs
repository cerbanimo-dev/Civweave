import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SANDWITCH_EIGHT} from '../public/app/shared/worldweaver-sandwitch-eight-v1.mjs';
import {normalizePortableUniverse,exportPortableUniverseHtml} from '../public/app/shared/worldweaver-portable-client-v1.mjs';

test('SandWitch Eight is eight unique, supported cooperative Worldweaver destinations',()=>{
  assert.equal(SANDWITCH_EIGHT.id,'sandwitch-eight');
  assert.equal(SANDWITCH_EIGHT.author,'Cami Ryn Tharp');
  assert.equal(SANDWITCH_EIGHT.fictional,true);
  assert.equal(SANDWITCH_EIGHT.setting.year,2020);
  assert.equal(SANDWITCH_EIGHT.districts.length,8);
  assert.equal(new Set(SANDWITCH_EIGHT.districts.map(x=>x.id)).size,8);
  assert.equal(SANDWITCH_EIGHT.storyPressure.length,8);
  assert.deepEqual(SANDWITCH_EIGHT.center,['Violet','Cami','Jasper']);
  assert.ok(SANDWITCH_EIGHT.principles.some(x=>/consent/i.test(x)));
  const portable=normalizePortableUniverse(SANDWITCH_EIGHT);
  assert.equal(portable.rooms.length,8);
  assert.equal(portable.prompts.length,8);
  assert.ok(portable.rooms.every(x=>x.stations.length===1));
});

test('portable export contains accessible local-first play without simulated live-world authority',()=>{
  const html=exportPortableUniverseHtml(SANDWITCH_EIGHT);
  assert.match(html,/SandWitch Eight/);
  assert.match(html,/id="cw-room-list"/);
  assert.match(html,/id="cw-quest-form"/);
  assert.match(html,/id="cw-export"/);
  assert.match(html,/Offline client/);
  assert.doesNotMatch(html,/https?:\/\/[^"'\s]+\.(?:js|css)/i);
});

test('the current Worldweaver universe gallery lists SandWitch Eight using the shared portable exporter',async()=>{
  const gallery=await readFile(new URL('../public/app/tools/worldweaver-universe-files.html',import.meta.url),'utf8');
  assert.match(gallery,/worldweaver-sandwitch-eight-v1\.mjs/);
  assert.match(gallery,/sandwitch: SANDWITCH_EIGHT/);
  assert.match(gallery,/id="sandwitch"/);
  assert.match(gallery,/exportPortableUniverseHtml/);
});
