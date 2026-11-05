#!/usr/bin/env node
/**
 * Digital Y stage-gate checks for the offline-friendly local browser microspace.
 * Run: node scripts/test-watertown-y-walkthrough-v1.mjs
 * Does not call external services or impersonate a live YMCA or Guild.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {Script} from 'node:vm';
import {
 validateYScene,collides,raycast,lineOfSight,movePlayer,nearestInteraction,
 findAccessiblePath,zoneAt
} from '../public/app/tools/watertown-y-walkable-core-v1.mjs';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(join(root,p),'utf8');
const scene=validateYScene(JSON.parse(read('public/app/tools/watertown-y-walkable-scene-v1.json')));
const html=read('public/app/tools/watertown-y-walkthrough-v1.html');
const js=read('public/app/tools/watertown-y-walkthrough-v1.mjs');
const existing=read('public/app/tools/watertown-y-schedule-data-v2.json');
const schedule=JSON.parse(existing);
assert.equal(scene.schema,'civweave.digital-y.walkable-scene.v1');
assert.equal(scene.walls.length,16);
assert.equal(scene.zones.length,6);
assert.equal(scene.objects.length,9);
assert.equal(scene.objects.filter(x=>x.kind==='schedule').length,4);
assert.equal(schedule.sourceMonth,'2026-11');
assert.equal(schedule.schema,'civweave.ymca-schedule.v2');
assert.equal(collides(scene,scene.world.spawn.x,scene.world.spawn.y),false);
assert.equal(zoneAt(scene,scene.world.spawn).name,'Welcome Lobby');
assert.ok(raycast(scene,scene.world.spawn.x,scene.world.spawn.y,-Math.PI/2));
const ids=new Set(scene.objects.map(x=>x.id));
assert.deepEqual(scene.quest.steps.filter(x=>!ids.has(x)),[]);
const expectedScheduleKeys=new Set(['all','cardio','spin','yoga']);
assert.deepEqual(new Set(scene.objects.filter(x=>x.kind==='schedule').map(x=>x.studio)),expectedScheduleKeys);
for(const o of scene.objects){
 const route=findAccessiblePath(scene,scene.world.spawn,o);
 assert.ok(route&&route.length, 'No accessible path to '+o.id);
 for(const cell of route)assert.ok(!collides(scene,cell.x,cell.y),'Route intersects wall to '+o.id);
 for(let i=1;i<route.length;i++){
  const a=route[i-1],b=route[i];
  assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<=.51,'Route jumped a cell to '+o.id);
  assert.ok(!collides(scene,(a.x+b.x)/2,(a.y+b.y)/2),'Route skipped through wall to '+o.id);
 }
 assert.equal(nearestInteraction(scene,route.at(-1))?.id,o.id,'Destination cannot be interacted with '+o.id);
 assert.ok(lineOfSight(scene,route.at(-1),o),'Wall blocking a destination '+o.id);
}
const blocking=movePlayer(scene,{x:9.5,y:3,angle:0},4,0,0,1);
assert.ok(blocking.x<9.75,'Movement crossed solid cardio corridor wall');
assert.match(html,/id="view"/);assert.match(html,/id="map"/);
assert.match(html,/id="destinationList"/);assert.match(html,/id="scheduleHost"/);
assert.match(html,/id="plan"/);assert.match(html,/id="exportPlan"/);
assert.match(html,/id="narration"/);
assert.match(html,/id="nextObjective"/);
assert.match(html,/id="nextStop"/);
assert.match(html,/id="routeSummary"/);
assert.match(html,/data-move="strafeLeft"/);
assert.match(html,/data-move="strafeRight"/);
assert.match(html,/id="testReport"/);
assert.match(html,/id="copyReport"/);
assert.match(html,/id="refreshReport"/);
assert.match(js,/createWorldweaver/);assert.match(js,/renderWorldScreen/);
assert.match(js,/projectWorld2D\(snapshot/);assert.match(js,/layout\.positions\[screenIds\.get/);
assert.match(js,/type:'cast-screen'/);
assert.match(js,/nearestInteraction\(scene,player/);
assert.match(js,/findAccessiblePath\(scene,player/);
assert.match(js,/if\(location\.protocol==='https:'\)/);
assert.match(js,/URL\.createObjectURL/);
assert.match(js,/No AI model is running this conversation/);
assert.match(html,/Unofficial imaginative prototype/);
assert.match(js,/sourceMonth/);
assert.match(js,/QUEST_STORAGE_KEY/);
assert.match(js,/function nextStep\(/);
assert.match(js,/nextStep\(\)/);
assert.match(js,/data\.sourceMonth/);
assert.match(js,/routeLine/);
assert.match(js,/recommended on phones/);
assert.match(js,/buttonState\.strafeRight/);
assert.match(js,/if\(!ctx\)return;/);
assert.match(js,/function refreshReport\(/);
assert.match(js,/userEnteredPlanExcluded:true/);
assert.match(js,/Choose one of the three intention buttons/);
assert.doesNotMatch(js,/obj\.kind==='quest'\)\{\s*visited\.add\('quest'\)/,
 'Reading the quest board must not complete the intention step without choosing an intention.');
new Script('(async function(){'+js.replace(/^import[\s\S]*?;\r?\n/gm,'')+'})', {filename:'walkthrough-v1.mjs'});
console.log('PASS: 6 rooms, 16 walls, 9 reachable stations, 4 Worldweaver schedule screens, collision and quest contract.');
