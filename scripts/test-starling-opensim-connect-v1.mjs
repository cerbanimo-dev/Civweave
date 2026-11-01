import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {connectOpenSimRegion,parseOpenSimRegion,normalizeOpenSimBridgeUrl} from '../public/app/shared/worldweaver-opensim-source-v1.mjs';

const region={schema:'civweave.opensim-region-geometry.v1',regionId:'test-region',revision:1,size:{x:256,y:256},source:'opensim-region-module',objects:[{id:'cottage',name:'Cottage',position:{x:120,y:120,z:2},parts:[{id:'wall',type:'box',offset:{x:0,y:0,z:0},scale:{x:8,y:8,z:4}}]}]};
test('OpenSim source accepts only explicitly configured loopback URLs',()=>{
 assert.equal(normalizeOpenSimBridgeUrl('http://127.0.0.1:8769/region'),'http://127.0.0.1:8769/region');
 assert.throws(()=>normalizeOpenSimBridgeUrl('https://evil.test/region'),/loopback/);
 assert.throws(()=>normalizeOpenSimBridgeUrl('http://192.168.1.20:8769/region'),/loopback/);
 assert.throws(()=>normalizeOpenSimBridgeUrl('http://localhost:8769/region?token=secret'),/query|credentials/);
});
test('OpenSim export normalizes once for matching 2D/3D geometry',()=>{
 const geometry=parseOpenSimRegion(region);
 assert.equal(geometry.regionId,'test-region');
 assert.ok(geometry.faces.length>0);
 assert.equal(geometry.source,'opensim-region-module');
 assert.throws(()=>parseOpenSimRegion({...region,source:'something-else'}),/authorized|region/);
});
test('OpenSim connector checks response limit and keeps failures explicit',async()=>{
 const result=await connectOpenSimRegion('http://127.0.0.1:8769/region',{
   fetcher:async()=>({ok:true,headers:{get:()=>null},text:async()=>JSON.stringify(region)})
 });
 assert.equal(result.regionId,'test-region');
 await assert.rejects(connectOpenSimRegion('http://127.0.0.1:8769/region',{
   fetcher:async()=>({ok:false,status:401})
 }),/HTTP 401/);
 await assert.rejects(connectOpenSimRegion('http://127.0.0.1:8769/region',{
   fetcher:async()=>({ok:true,headers:{get:()=>String(3000000)},text:async()=>''})
 }),/too large/);
});
test('Collective page offers reachable controls, real OpenSim geometry display, and explicit external-state labels',()=>{
 const src=readFileSync(new URL('../public/app/starling-lounge-v1.mjs',import.meta.url),'utf8');
 for(const token of ['data-sl-action="world-connect"','data-sl-action="opensim-connect"','data-sl-action="opensim-disconnect"','data-sl-opensim-url','connectOpenSimRegion','OpenSimulator · live NPC bridge']){
   assert.ok(src.includes(token),token);
 }
 assert.match(src,/setFleetScope\(guild\?'guild':'local'\)/);
 assert.match(src,/state\.openSimWorldRef===room\?state\.openSimGeometry:null/);
 assert.match(src,/CivweaveSettingsV320/);
 const css=readFileSync(new URL('../public/app/starling-lounge-v1.css',import.meta.url),'utf8');
 assert.ok(css.includes('#cw-starling-lounge[hidden],\n#cw-starling-lounge [hidden]{display:none!important}'));
});

test('Collective controls have one dispatch owner and navigation leaves the fullscreen overlay',()=>{
 const src=readFileSync(new URL('../public/app/starling-lounge-v1.mjs',import.meta.url),'utf8');
 const start=src.indexOf('root.innerHTML=`'),end=src.indexOf('`;',start+16);
 const markup=src.slice(start,end);const actions=[...new Set([...markup.matchAll(/data-sl-action="([^"]+)"/g)].map(match=>match[1]))];
 assert.equal(actions.length>20,true,'Audit the entire displayed action set');
 for(const action of actions)assert.ok(src.includes("if(cmd==='"+action+"'"),'Unwired action '+action);
 const chat=src.indexOf("await loader.openChat('civweave'");assert.ok(chat>0&&src.slice(chat,chat+230).includes('close();'),'Addressed chat must become visible after success');
 assert.ok(src.includes("window.location.assign('/app/civweave-guild-quest-v1.html')"),'Quest button must enter canonical Quest surface');
});

test('Guild entry cache-busts Collective module alongside its stylesheet',()=>{
 const launcher=readFileSync(new URL('../public/app/cerbanimo-intention-landscape-v1.js',import.meta.url),'utf8');
 const lounge=readFileSync(new URL('../public/app/starling-lounge-v1.mjs',import.meta.url),'utf8');
 assert.ok(launcher.includes("starling-lounge-v1.mjs?v=brand-responsive-fleet-r7-live-npc"));
 assert.ok(lounge.includes("starling-lounge-v1.css?v=brand-responsive-fleet-r7-live-npc"));
});

test('OpenSim controls can issue actual human-authorized NPC commands and display results',()=>{
 const src=readFileSync(new URL('../public/app/starling-lounge-v1.mjs',import.meta.url),'utf8');
 const must=['data-sl-action="opensim-move"','data-sl-action="opensim-speak"',
 'data-sl-action="opensim-receipt"','data-sl-opensim-token','data-sl-move-z',
 'getOpenSimLiveStatus','submitOpenSimCommand','getOpenSimActionReceipt',
 "executeOpenSim('move')","executeOpenSim('speak')","openSimRegionId","state.worldLayout"];
 for(const v of must)assert.ok(src.includes(v),'Missing interactive OpenSim control: '+v);
 assert.ok(src.includes("worldTools().prepare"),'Only registered signed pilot may submit a bounded simulator command');
 assert.ok(!src.includes("localStorage.setItem('civweave.opensim"),'Do not persist controller tokens in localStorage');
});

test('Local Fleet can control local-only OpenSim without pretending to sign a Guild pilot',()=>{
 const src=readFileSync(new URL('../public/app/starling-lounge-v1.mjs',import.meta.url),'utf8');
 const markup=src.slice(src.indexOf('root.innerHTML=`'),src.indexOf('`;',src.indexOf('root.innerHTML=`')));
 assert.match(markup,/data-sl-opensim-persona/);
 assert.match(markup,/data-sl-opensim-preview/);
 assert.ok(src.includes('local operator-controlled command')||src.includes('Local operator-controlled command'));
 assert.ok(src.includes('if(fleetIsGuild()){')&&src.includes('const prepared=worldTools().prepare'), 'Signed Guild pilot must be validated before dispatch.');
 assert.match(src,/createOpenSim3DPreview/);
 assert.ok(markup.indexOf('data-sl-opensim-url')>markup.indexOf('data-sl-guild-fleet'));
 assert.ok(markup.indexOf('data-sl-opensim-url')<markup.indexOf('data-sl-panel="conversation"'));
});
