import test from 'node:test';
import assert from 'node:assert/strict';
import {getOpenSimLiveStatus,submitOpenSimCommand,getOpenSimActionReceipt} from '../public/app/shared/worldweaver-opensim-source-v1.mjs';
const url='http://127.0.0.1:8769/region';
const token='b'.repeat(64);
const fake=(expected,response,status=200)=>async(path,options)=>{
 assert.equal(path,expected);assert.equal(options?.credentials,'omit');
 return {ok:status>=200&&status<300,status,json:async()=>response};
};
test('browser OpenSim connector has explicit signed-control status and confidential browser token',async()=>{
 const result=await getOpenSimLiveStatus(url,{fetcher:fake('http://127.0.0.1:8769/status',
 {schema:'civweave.opensim-live-status.v1',controllerConnected:true,regionId:'test-region',commandsEnabled:true})});
 assert.equal(result.controllerConnected,true);
 const action=await submitOpenSimCommand(url,{token,regionId:'test-region',personaId:'kami',tool:'move',args:{x:22,y:40,z:20},requestId:'request-1'},{
  fetcher:async(path,opts)=>{
   assert.equal(path,'http://127.0.0.1:8769/command');assert.equal(opts.headers.Authorization,'Bearer '+token);
   assert.equal(opts.credentials,'omit');return {ok:true,status:202,json:async()=>({requestId:'request-1',state:'queued'})};
  }
 });
 assert.equal(action.state,'queued');
 const receipt=await getOpenSimActionReceipt(url,'request-1',token,{
  fetcher:fake('http://127.0.0.1:8769/command/request-1',{requestId:'request-1',state:'completed'})});
 assert.equal(receipt.state,'completed');
});
test('browser OpenSim action connector rejects malformed actions before network',async()=>{
 let called=false;
 await assert.rejects(submitOpenSimCommand(url,{token,regionId:'test-region',personaId:'kami',tool:'move',args:{x:999,y:40,z:0},requestId:'nope'},{
  fetcher:async()=>{called=true}
 }),/coordinates/);
 assert.equal(called,false);
 await assert.rejects(getOpenSimActionReceipt(url,'../hack',token),/identifier/);
});
