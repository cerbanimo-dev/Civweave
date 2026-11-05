#!/usr/bin/env node
/* Worldweaver Watertown Y schedule fixture invariants: no network required. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const data=JSON.parse(read('public/app/tools/watertown-y-schedule-data-v2.json'));
const html=read('public/app/tools/watertown-y-schedule-v2.html');
const world=read('public/app/tools/watertown-y-world-lab-v1.mjs');
const lab=read('public/app/tools/watertown-y-world-lab.html');
assert.equal(data.schema,'civweave.ymca-schedule.v2');
assert.equal(data.sourceMonth,'2026-11');
assert.equal(data.timezone,'America/New_York');
assert.match(data.sourceUrl,/^https:\/\/watertownymca\.storage\.googleapis\.com\/.*2026NOV\.pdf$/);
const match=html.match(/<script id="data" type="application\/json">([\s\S]*?)<\/script>/);
assert.ok(match,'Stand-alone schedule must embed offline-capable data');
assert.deepEqual(JSON.parse(match[1]),data,'Embedded snapshot should exactly match the editable JSON fixture');
const expected={cardio:83,spin:94,yoga:82};
const days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const minute=s=>Number(s.slice(0,2))*60+Number(s.slice(3));
let total=0;
for(const [name,expectedCount] of Object.entries(expected)){
 const studio=data.studios[name];assert.ok(studio);
 assert.deepEqual(Object.keys(studio.days),days);
 let count=0;
 for(const entries of Object.values(studio.days)){
  for(const entry of entries){
   count++;assert.match(entry.start,/^\d{2}:\d{2}$/);assert.match(entry.end,/^\d{2}:\d{2}$/);
   assert.ok(minute(entry.end)>minute(entry.start),name+' invalid time '+entry.start+' '+entry.end);
   assert.ok(entry.name&&entry.name.length<130);
   assert.ok(entry.extra!==undefined);
  }
 }
 assert.equal(count,expectedCount,'Class count '+name);
 total+=count;
}
assert.equal(total,259);
assert.match(html,/data-mode="tv"/);assert.match(html,/data-mode="week"/);
assert.match(html,/data-studio="cardio"/);assert.match(html,/data-studio="spin"/);assert.match(html,/data-studio="yoga"/);
assert.match(html,/Archived schedule/);assert.match(html,/No live availability/);
assert.match(html,/catch\{\/\* Opaque-origin/);
const main=html.match(/<script>\s*([\s\S]*?)<\/script>/);
assert.ok(main);new vm.Script(main[1],{filename:'watertown-y-schedule-v2.inline.js'});
assert.match(world,/createWorldweaver/);assert.match(world,/renderWorldScreen/);
assert.match(world,/type:'cast-screen'/);assert.match(world,/authorize:\(\{actor\}\)/);
assert.match(world,/auditBigfixers/);assert.match(lab,/Fruit-fly bigfixers/);
for(const site of ['entrance','cardio','spin','yoga'])assert.match(lab,new RegExp('data-site="'+site+'"'));
console.log('Watertown Y schedule board checks passed: 259 entries, 3 studios, 4 Worldweaver screens.');
