import test from 'node:test';
import assert from 'node:assert/strict';
import {createOpenSimRegionBridge} from '../tools/worldweaver/opensim-region-bridge.mjs';

const browserToken='b'.repeat(64),controllerToken='c'.repeat(64);
const origin='https://civweave-staging.pages.dev';
async function withBridge(fn){
 const server=createOpenSimRegionBridge({file:null,port:0,regionId:'test-region',browserToken,controllerToken});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 try{return await fn(base)}finally{await new Promise(resolve=>server.close(resolve))}
}
async function request(base,path,{method='GET',payload,token=null,controller=false}={}){
 return fetch(base+path,{method,headers:{Origin:origin,...(payload?{'Content-Type':'application/json'}:{}),
  ...(token?{Authorization:'Bearer '+token}:{}),...(controller?{'X-Civweave-Controller':controllerToken}:{})},
  ...(payload?{body:JSON.stringify(payload)}:{})});
}
test('OpenSim action bridge fails closed until an actual controller checks in',async()=>withBridge(async base=>{
 const status=await request(base,'/status');assert.equal(status.status,200);
 assert.equal((await status.json()).controllerConnected,false);
 const action={requestId:'demo-a',regionId:'test-region',personaId:'kami',tool:'move',args:{x:45,y:60,z:22}};
 assert.equal((await request(base,'/command',{method:'POST',payload:action,token:browserToken})).status,503);
 assert.equal((await request(base,'/next')).status,401);
 assert.equal((await request(base,'/next',{controller:true})).status,200);
 assert.equal((await (await request(base,'/status')).json()).controllerConnected,true);
 assert.equal((await request(base,'/command',{method:'POST',payload:action,token:'wrong'})).status,401);
 const accepted=await request(base,'/command',{method:'POST',payload:action,token:browserToken});
 assert.equal(accepted.status,202);
 const packet=await accepted.json();assert.equal(packet.state,'queued');
 const next=await (await request(base,'/next',{controller:true})).json();
 assert.equal(next.command.requestId,'demo-a');
 const result=await request(base,'/result',{method:'POST',controller:true,payload:{requestId:'demo-a',outcome:'completed',position:{x:45,y:60,z:22},summary:'NPC reached target'}});
 assert.equal(result.status,200);
 const receipt=await (await request(base,'/command/demo-a',{token:browserToken})).json();
 assert.equal(receipt.state,'completed');assert.deepEqual(receipt.position,{x:45,y:60,z:22});
 assert.equal((await request(base,'/next',{controller:true}).then(r=>r.json())).command,null);
}));
test('OpenSim action bridge rejects unexpected commands, remote origins, and spoofed receipts',async()=>withBridge(async base=>{
 assert.equal((await request(base,'/next',{controller:true})).status,200);
 const action={requestId:'demo-b',regionId:'test-region',personaId:'aphra',tool:'speak',args:{text:'Hello there'}};
 for(const a of [{...action,tool:'admin'}, {...action,regionId:'other'}, {...action,args:{text:'x'.repeat(9999)}}, {...action,requestId:'../hack'}]){
  assert.equal((await request(base,'/command',{method:'POST',token:browserToken,payload:a})).status,400);
 }
 assert.equal((await request(base,'/result',{method:'POST',payload:{requestId:'demo-b',outcome:'completed'}})).status,401);
 assert.equal((await fetch(base+'/command',{method:'POST',headers:{Origin:'https://evil.invalid','Authorization':'Bearer '+browserToken,'Content-Type':'application/json'},body:JSON.stringify(action)})).status,403);
 const post=await request(base,'/command',{method:'POST',payload:action,token:browserToken});assert.equal(post.status,202);
 assert.equal((await request(base,'/result',{method:'POST',controller:true,payload:{requestId:'demo-b',outcome:'completed'}})).status,409);
 const delivered=await request(base,'/next',{controller:true});assert.equal((await delivered.json()).command.tool,'speak');
 assert.equal((await request(base,'/result',{method:'POST',controller:true,payload:{requestId:'demo-b',outcome:'failed',summary:'appearance unavailable'}})).status,200);
 assert.equal((await (await request(base,'/command/demo-b',{token:browserToken})).json()).state,'failed');
}));
