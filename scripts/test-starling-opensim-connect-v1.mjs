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
 for(const token of ['data-sl-action="world-connect"','data-sl-action="opensim-connect"','data-sl-action="opensim-disconnect"','data-sl-opensim-url','connectOpenSimRegion','OpenSim region export']){
   assert.ok(src.includes(token),token);
 }
 assert.match(src,/setFleetScope\(guild\?'guild':'local'\)/);
 assert.match(src,/state\.openSimGeometry\?\?/);
 assert.match(src,/CivweaveSettingsV320/);
});
