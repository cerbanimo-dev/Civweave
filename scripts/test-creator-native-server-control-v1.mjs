import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectNativeSlots,requireNativeIdle,summarizeNativeSlots,inspectCreatorCompanion,restartCreatorNativeServer,isCreatorNativeTermux} from '../public/creator-suite/shared/native-server-control-v1.mjs';

const native={provider:'openai-compatible',model:'qwen35-4b-native',endpoint:'http://127.0.0.1:8080/v1'};
const json=(body,status=200)=>({ok:status===200,status,json:async()=>body});
test('native detection is exact, never applied to other hosted providers',()=>{
 assert.equal(isCreatorNativeTermux(native),true);
 assert.equal(isCreatorNativeTermux({...native,endpoint:'https://guild.example/v1'}),false);
 assert.equal(isCreatorNativeTermux({...native,provider:'ollama'}),false);
});
test('observe active slot and prevent duplicate queued inference',async()=>{
 let calls=0;
 const fetcher=async(url,request)=>{calls++;assert.equal(url,'http://127.0.0.1:8080/slots');assert.equal(request.method,'GET');return json([{id:0,id_task:82,is_processing:true}]);};
 const current=await inspectNativeSlots({fetcher});
 assert.equal(current.state,'busy');assert.equal(current.busyCount,1);assert.equal(current.slots[0].taskId,82);
 await assert.rejects(requireNativeIdle({fetcher}),/task 82/i);
 assert.equal(calls,2);
});
test('idle slots allow request and unsupported slots are not called idle',async()=>{
 assert.equal((await requireNativeIdle({fetcher:async()=>json([{id:0,id_task:-1,is_processing:false}])})).state,'idle');
 assert.equal((await inspectNativeSlots({fetcher:async()=>json({detail:'not supported'})})).state,'unsupported');
 assert.equal((await inspectNativeSlots({fetcher:async()=>json({},404)})).state,'unavailable');
});
const token='a'.repeat(64);
const storage=t=>({getItem:()=>t});
test('unpaired or unmanaged Companion cannot restart a server',async()=>{
 let called=0;
 await assert.rejects(restartCreatorNativeServer({storage:storage(''),fetcher:async()=>{called++;}}),/Pair Termux Companion/);
 assert.equal(called,0);
 const mock=async(_url,req)=>{called++;assert.equal(req.method,'GET');return json({managed_running:false,unmanaged_running:true});};
 await assert.rejects(restartCreatorNativeServer({storage:storage(token),fetcher:mock}),/does not own/);
 assert.equal(called,1);
});
test('paired Companion restart is explicit, scoped, and uses approved existing model/context',async()=>{
 let posted=false;
 const fetcher=async(url,req)=>{
  assert.equal(req.headers['X-Civweave-Token'],token);
  if(url.endsWith('/v1/status')){
   assert.equal(req.method,'GET');
   return json({managed_running:true,selected_model:'qwen35-4b-native',context:4096,job:{state:'idle'}});
  }
  assert.equal(url,'http://127.0.0.1:8766/v1/actions/restart');
  assert.equal(req.method,'POST');
  assert.deepEqual(JSON.parse(req.body),{model:'qwen35-4b-native',context:4096});
  posted=true;return json({accepted:true,job_id:'a1'});
 };
 const result=await restartCreatorNativeServer({storage:storage(token),fetcher});
 assert.equal(result.accepted,true);assert.equal(posted,true);
});
test('slot monitor never implicitly invokes Companion',async()=>{
 const statuses=[{id:0,is_processing:false}];
 const state=summarizeNativeSlots(statuses);
 assert.equal(state.state,'idle');
 assert.equal((await inspectCreatorCompanion({storage:storage(''),fetcher:async()=>{throw Error('must not query')}})).state,'unpaired');
});
