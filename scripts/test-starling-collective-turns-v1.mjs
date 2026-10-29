import test from 'node:test';
import assert from 'node:assert/strict';
import {createCollectiveTurnService} from '../public/app/shared/starling-collective-turns-v1.mjs';

const founding={guildId:'garden',deviceId:'device:founder',foundingIntention:{text:'Build a community garden and teach practical gardening skills.',status:'provisional'}};
function makeHarness({endpoint='http://127.0.0.1:11434',actor='device:founder',result='Develop a sourced soil survey and ask Guild members to review it.',fail=false}={}){
 const rows=[],calls=[];
 const mesh={
  async deviceId(){return actor},
  async getObject(id){return id==='guild-genesis:garden'?{id,kind:'civweave.guild-genesis.v1',origin:{nodeId:'device:founder'},payload:{guildId:'garden',foundingDeviceId:'device:founder',foundingIntention:founding.foundingIntention},revisionHash:'genesis',signature:'valid'}:rows.find(row=>row.id===id)||null},
  async listObjects(){return rows},
  async validateObject(object){return {ok:Boolean(object.signature==='valid')}},
  async createObject(input){const row={...input,origin:{nodeId:actor},revisionHash:'hash-'+rows.length,signature:'valid',createdAt:new Date().toISOString()};rows.push(row);return row}
 };
 const model={
  readSharedConfig(){return{provider:'ollama',model:'qwen3.5:4b',endpoint}},
  normalizeConfig(x){return x},
  endpointLeavesDevice(config){return !/127\.0\.0\.1|localhost/.test(config.endpoint)},
  async generate(request){calls.push(request);if(fail)return {status:'provider-error',error:{message:'runtime failed'}};return{status:'success',outputText:result,actual:{provider:'ollama',model:'qwen3.5:4b'}}}
 };
 return {service:createCollectiveTurnService({mesh,model,founder:()=>founding}),rows,calls,mesh,model};
}
test('read does not warm or call any model and requires Guild permission',async()=>{
 const {service,calls}=makeHarness();
 await assert.rejects(()=>service.readTurns({guildId:'garden'}),/Guild read authorization/);
 assert.deepEqual(await service.readTurns({guildId:'garden',verifyReader:()=>true}),[]);
 assert.equal(calls.length,0);
});
test('explicit one local turn uses founding Intention and appends signed group mesh record',async()=>{
 const {service,rows,calls}=makeHarness();
 const result=await service.runOneTurn({guildId:'garden',personaId:'kami'});
 assert.equal(result.payload.guildId,'garden');assert.equal(result.payload.personaId,'kami');
 assert.equal(result.kind,'civweave.starling-collective-turn.v1');
 assert.deepEqual(result.audience,['guild:garden']);assert.equal(result.consent,'group');
 assert.match(calls[0].messages[0].content,/community garden/);
 assert.equal(calls[0].config.provider,'ollama');
 assert.equal(rows.length,1);
 const read=await service.readTurns({guildId:'garden',verifyReader:()=>true});
 assert.equal(read.length,1);assert.equal(read[0].text,'Develop a sourced soil survey and ask Guild members to review it.');
 assert.equal(read[0].provenance,'founding-device-signed-self-report');
});
test('rejects external endpoint and clouds without generating or persisting',async()=>{
 const {service,calls,rows}=makeHarness({endpoint:'https://remote.example/v1'});
 await assert.rejects(()=>service.runOneTurn({guildId:'garden',personaId:'kami'}),/local inference/);
 assert.equal(calls.length,0);assert.equal(rows.length,0);
});
test('only Guild founder may create a signed local Collective turn',async()=>{
 const {service,calls}=makeHarness({actor:'device:someone-else'});
 await assert.rejects(()=>service.runOneTurn({guildId:'garden',personaId:'jae'}),/founding device/);
 assert.equal(calls.length,0);
});
test('failed generation never commits a fabricated turn',async()=>{
 const {service,rows}=makeHarness({fail:true});
 await assert.rejects(()=>service.runOneTurn({guildId:'garden',personaId:'jae'}),/runtime failed/);
 assert.equal(rows.length,0);
});
test('unrecognized personas, wrong Guild, and absent founding Intentions fail closed',async()=>{
 const {service}=makeHarness();
 await assert.rejects(()=>service.runOneTurn({guildId:'garden',personaId:'unknown'}),/persona/);
 await assert.rejects(()=>service.runOneTurn({guildId:'different',personaId:'kami'}),/founding/);
});
test('read ignores forged, foreign, unsigned and non-founder turns',async()=>{
 const {service,rows}=makeHarness();
 await service.runOneTurn({guildId:'garden',personaId:'rosa'});
 rows.push({...rows[0],id:'foreign',payload:{...rows[0].payload,guildId:'outside'}});
 rows.push({...rows[0],id:'other-author',origin:{nodeId:'device:other'}});
 rows.push({...rows[0],id:'unsigned',signature:'bad'});
 const result=await service.readTurns({guildId:'garden',verifyReader:()=>true});
 assert.equal(result.length,1);
});
test('generation is one-at-a-time, rejecting overlap',async()=>{
 const {service,model}=makeHarness();
 let release;
 model.generate=()=>new Promise(resolve=>{release=()=>resolve({status:'success',outputText:'Take one practical action today.',actual:{provider:'ollama',model:'qwen'}})});
 const first=service.runOneTurn({guildId:'garden',personaId:'kami'});
 await new Promise(resolve=>setImmediate(resolve));
 await assert.rejects(()=>service.runOneTurn({guildId:'garden',personaId:'jae'}),/already running/);
 release();await first;
});
test('Guild reader sees only valid genesis-and-founder-authorized records',async()=>{
 const {service,mesh}=makeHarness();
 mesh.getObject=async()=>({...await Promise.resolve({kind:'civweave.guild-genesis.v1',id:'guild-genesis:garden',payload:{guildId:'garden',foundingDeviceId:'device:founder'},origin:{nodeId:'device:other'},signature:'valid'})});
 await assert.rejects(()=>service.readTurns({guildId:'garden',verifyReader:()=>true}),/founding record/);
});

test('a user-supplied brief survives signed replay and is not treated as a model completion',async()=>{
 const {service,calls}=makeHarness();
 await service.runOneTurn({guildId:'garden',personaId:'sana',taskPrompt:'Find an accessible way for neighbors to participate.'});
 assert.match(calls[0].messages.at(-1).content,/accessible way/);
 const replay=await service.readTurns({guildId:'garden',verifyReader:()=>true});
 assert.equal(replay[0].brief,'Find an accessible way for neighbors to participate.');
 assert.equal(replay[0].completionVerified,false);
});
test('local client refuses to store a turn without source-bound Guild sign-off',async()=>{
 const {service,mesh}=makeHarness();
 mesh.validateObject=async()=>({ok:false});
 await assert.rejects(()=>service.runOneTurn({guildId:'garden',personaId:'kami'}),/founding record/);
});

test('a bounded Collective round executes three independent personas serially',async()=>{
 const {service,calls,rows}=makeHarness();
 const observed=[];
 const result=await service.runRound({guildId:'garden',personas:['kami','farah','rosa'],taskPrompt:'Design a seed-sharing event.',onTurn:row=>observed.push(row.payload.personaId)});
 assert.deepEqual(observed,['kami','farah','rosa']);
 assert.equal(result.completed,3);
 assert.equal(rows.length,3);assert.equal(calls.length,3);
 assert.equal(calls[1].messages.some(x=>x.content.includes('kami:')),true);
 assert.equal(service.isBusy(),false);
});
test('a failed round retains signed previous turns and releases the scheduler lock',async()=>{
 const {service,model,rows}=makeHarness();
 let count=0;
 model.generate=async()=>{count++;return count===2?{status:'provider-error',error:{message:'worker failed'}}:{status:'success',outputText:'Concrete next step',actual:{provider:'ollama'}}};
 await assert.rejects(()=>service.runRound({guildId:'garden',personas:['kami','sana','kit']}),/worker failed/);
 assert.equal(rows.length,1);
 assert.equal(service.isBusy(),false);
});
test('round rejects duplicate personas and cannot be overlapped by another turn',async()=>{
 const {service,model}=makeHarness();
 await assert.rejects(()=>service.runRound({guildId:'garden',personas:['kami','kami']}),/distinct/);
 let release,count=0;
 model.generate=()=>{count++;if(count>1)return Promise.resolve({status:'success',outputText:'Propose next step',actual:{provider:'ollama'}});return new Promise(resolve=>{release=()=>resolve({status:'success',outputText:'Propose next step',actual:{provider:'ollama'}})})};
 const round=service.runRound({guildId:'garden',personas:['kami','jae']});
 await new Promise(resolve=>setImmediate(resolve));
 await assert.rejects(()=>service.runOneTurn({guildId:'garden',personaId:'rosa'}),/already running/);
 release();
 await round;
});

test('explicit host draft import is signed into the existing Guild mesh exactly once',async()=>{
 const {service,rows}=makeHarness();
 const draft={schema:'civweave.starling-host-job.v1',jobId:'a'.repeat(32),guildId:'garden',personaId:'kami',backend:'termux',state:'completed',text:'Review a seed library design.',reviewRequired:true,claimVerified:false};
 const first=await service.importHostDraft({guildId:'garden',job:draft});
 const again=await service.importHostDraft({guildId:'garden',job:draft});
 assert.equal(first.id,again.id);assert.equal(rows.length,1);
 const transcript=await service.readTurns({guildId:'garden',verifyReader:()=>true});
 assert.equal(transcript[0].hostBackend,'termux');
 assert.equal(transcript[0].completionVerified,false);
 assert.equal(transcript[0].provenance,'founding-device-signed-host-draft');
});
test('unreviewed, foreign-Guild or incomplete host results cannot create signed turns',async()=>{
 const {service,rows}=makeHarness();
 const draft={schema:'civweave.starling-host-job.v1',jobId:'a'.repeat(32),guildId:'garden',personaId:'kami',backend:'android',state:'completed',text:'Draft',reviewRequired:true,claimVerified:false};
 for(const invalid of [{...draft,state:'running'}, {...draft,guildId:'other'}, {...draft,claimVerified:true}, {...draft,backend:'cloud'}, {...draft,reviewRequired:false}]){
   await assert.rejects(()=>service.importHostDraft({guildId:'garden',job:invalid}));
 }
 assert.equal(rows.length,0);
});

test('project mode uses a bounded JSON schema; task-draft mode requests a real deliverable',async()=>{
 const {service,calls}=makeHarness();
 await service.runOneTurn({guildId:'garden',personaId:'rosa',workMode:'project',taskPrompt:'Make a one-project content plan.'});
 await service.runOneTurn({guildId:'garden',personaId:'sana',workMode:'task-draft',taskPrompt:'Draft the requested article text now.'});
 assert.equal(calls[0].responseFormat,'json');
 assert.equal(calls[0].schema.required.includes('tasks'),true);
 assert.equal(calls[0].maxTokens,900);
 assert.match(calls[0].messages[0].content,/valid JSON object/i);
 assert.equal(calls[1].maxTokens,1100);
 assert.match(calls[1].messages[0].content,/Actually produce/);
});
