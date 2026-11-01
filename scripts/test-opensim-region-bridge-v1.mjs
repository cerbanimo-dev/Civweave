import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createOpenSimRegionBridge} from '../tools/worldweaver/opensim-region-bridge.mjs';

const base={schema:'civweave.opensim-region-geometry.v1',regionId:'local-region',revision:3,size:{x:256,y:256},source:'opensim-region-module',objects:[{id:'building',position:{x:50,y:60,z:4},parts:[{id:'box-1',type:'box',offset:{x:0,y:0,z:0},scale:{x:4,y:5,z:4}}]}]};
test('OpenSim region bridge serves only validated local exporter JSON, not directory paths or admin routes',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'civweave-opensim-'));const path=join(dir,'region.json');
 let server;
 try{
  await writeFile(path,JSON.stringify(base));
  server=createOpenSimRegionBridge({file:path,port:0});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const root='http://127.0.0.1:'+server.address().port;
  const valid=await fetch(root+'/region',{headers:{Origin:'https://civweave.cc'}});
  assert.equal(valid.status,200);
  assert.equal(valid.headers.get('access-control-allow-origin'),'https://civweave.cc');
  assert.equal((await valid.json()).revision,3);
  const forbidden=await fetch(root+'/region',{headers:{Origin:'https://untrusted.example'}});
  assert.equal(forbidden.status,403);
  const denied=await fetch(root+'/../admin',{headers:{Origin:'https://civweave.cc'}});
  assert.equal(denied.status,404);
  await writeFile(path,JSON.stringify({...base,revision:4}));
  const refresh=await fetch(root+'/region',{headers:{Origin:'https://civweave.cc'}});
  assert.equal((await refresh.json()).revision,4);
  await writeFile(path,'not-json');
  assert.equal((await fetch(root+'/region',{headers:{Origin:'https://civweave.cc'}})).status,503);
 }finally{if(server)await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true})}
});
