import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {
  executeGuildTrainingAction, handleGuildTrainingRequest, handleGuildTrainingInternal,
  guildTrainingInternalToken, GUILD_TRAINING_ROUTE, MAX_GUILD_TRAINING_BYTES,
} from '../cloudflare/mobile-guild-edge/src/guild-training-contributions-v1.mjs';

class MemoryStorage {
  rows = new Map(); pending = Promise.resolve();
  async get(key) { return structuredClone(this.rows.get(key)); }
  async put(key,value) { this.rows.set(key,structuredClone(value)); }
  async delete(key) { this.rows.delete(key); }
  async list({prefix='',startAfter='',limit=Infinity}={}) { return new Map([...this.rows].filter(([key])=>key.startsWith(prefix)&&key>startAfter).sort(([a],[b])=>a.localeCompare(b)).slice(0,limit).map(([key,value])=>[key,structuredClone(value)])); }
  transaction(run) { const operation=this.pending.then(async()=>{const before=structuredClone(this.rows);try{return await run(this)}catch(error){this.rows=before;throw error}});this.pending=operation.catch(()=>{});return operation; }
}
const alice={nodeId:'guild-node-a',guildId:'guild-fictional',userId:'member-alice'};
const bob={nodeId:'guild-node-b',guildId:'guild-fictional',userId:'member-bob'};
const keeper={nodeId:'guild-node-a',guildId:'guild-fictional',userId:'member-keeper'};
const purpose={guildId:alice.guildId,purposeId:'purpose:repair-writing',purposeRevision:3,status:'approved',trainingAllowed:true,decisionRef:'decision:human-vote-3'};
const trusted={resolvePurpose:async()=>purpose,authorizeGuildkeeper:async({member})=>member.userId===keeper.userId,now:'2026-10-30T12:00:00Z'};
const sample=()=>({instruction:'Improve this fictional safety notice.',input:'Please tidy this fictional phrase.',output:'Please keep the fictional walkway clear.',editorPatches:[{before:'tidy',after:'keep clear',rationale:'Use a concrete instruction.'}],toolReceiptRefs:['receipt:edit-1']});
const contribution=(key='retry-1')=>({idempotencyKey:key,purposeId:purpose.purposeId,purposeRevision:3,consent:{training:true,rights:'owned',rightsRef:'declaration:fictional-author',policyRevision:'policy:training-v1',visibleOnly:true,privateDataExcluded:true},sample:sample()});
const run=(storage,member,action,input={},options={})=>executeGuildTrainingAction(storage,member,action,input,options);
const rejects=(promise,status)=>assert.rejects(promise,error=>error.status===status);

test('host custody is explicit, identity is assigned by authenticated member, and training is quarantined by default',async()=>{
  const store=new MemoryStorage(),out=await run(store,alice,'contribute',contribution());
  assert.equal(out.created,true);assert.equal(out.contribution.contributorUserId,alice.userId);assert.equal(out.contribution.guildId,alice.guildId);
  assert.equal(out.contribution.nodeId,alice.nodeId);assert.equal(out.contribution.status,'quarantined');assert.equal(out.custodyAcknowledged,true);
  assert.equal(out.trainingExecuted,false);assert.equal(out.settlementExecuted,false);assert.deepEqual(out.contribution.sample,sample());
  assert.deepEqual((await run(store,bob,'list')).contributions,[]);
  assert.equal((await run(store,alice,'list')).contributions[0].sample,undefined,'lists expose receipts, not training text');
  await rejects(run(store,alice,'contribute',{...contribution('spoof'),contributorUserId:bob.userId}),400);
  await rejects(run(store,{...alice,isAI:true},'contribute',contribution()),403);
});

test('every consent field and exact purpose revision is required; unsupported or private fields fail closed',async()=>{
  for(const change of [value=>delete value.consent,value=>value.consent.training=false,value=>value.consent.visibleOnly=false,value=>value.consent.privateDataExcluded=false,value=>delete value.purposeRevision,value=>value.purposeRevision=0,value=>value.consent.rights='unknown',value=>value.sample.hiddenReasoning='secret',value=>value.sample.messages=[{role:'system',content:'secret'}],value=>value.sample.editorPatches[0].accessToken='secret',value=>value.agreed=true]){
    const input=contribution();change(input);await rejects(run(new MemoryStorage(),alice,'contribute',input),400);
  }
  const huge=contribution();huge.sample.output='x'.repeat(MAX_GUILD_TRAINING_BYTES);await rejects(run(new MemoryStorage(),alice,'contribute',huge),413);
});

test('idempotency binds actor, purpose revision, consent and exact visible content',async()=>{
  const store=new MemoryStorage(),first=await run(store,alice,'contribute',contribution());
  const replay=await run(store,alice,'contribute',contribution());assert.equal(replay.idempotent,true);assert.equal(replay.contribution.id,first.contribution.id);assert.equal(replay.contribution.revision,1);
  for(const change of [value=>value.sample.output+=' revised',value=>value.purposeRevision++,value=>value.consent.policyRevision='policy:changed']){const input=contribution();change(input);await rejects(run(store,alice,'contribute',input),409)}
  const other=await run(store,bob,'contribute',contribution());assert.notEqual(other.contribution.id,first.contribution.id);
});

test('contributor-only withdrawal erases payload and prior consent, survives retries, and never resurrects via delivery retry',async()=>{
  const store=new MemoryStorage(),first=await run(store,alice,'contribute',contribution()),id=first.contribution.id;
  await rejects(run(store,bob,'read',{id}),404);await rejects(run(store,bob,'withdraw',{id,expectedRevision:1}),403);
  await rejects(run(store,alice,'withdraw',{id,expectedRevision:9}),409);
  const gone=await run(store,alice,'withdraw',{id,expectedRevision:1});assert.equal(gone.contribution.status,'withdrawn');assert.equal(gone.contribution.sample,undefined);assert.deepEqual(gone.contribution.consent,{state:'withdrawn'});
  assert.equal((await run(store,alice,'withdraw',{id,expectedRevision:1})).idempotent,true);
  assert.equal((await run(store,alice,'contribute',contribution())).contribution.status,'withdrawn');
  assert.doesNotMatch(JSON.stringify([...store.rows]),/Improve this fictional|keep the fictional|concrete instruction|declaration:fictional-author/);
});

test('release and dataset retrieval require actual keeper authority plus a trusted exact approved purpose',async()=>{
  const store=new MemoryStorage(),created=await run(store,alice,'contribute',contribution()),id=created.contribution.id;
  await rejects(run(store,alice,'release',{id,expectedRevision:1},{...trusted}),403);
  await rejects(run(store,keeper,'release',{id,expectedRevision:1}),403);
  for(const value of [{...purpose,status:'pending'},{...purpose,trainingAllowed:false},{...purpose,purposeRevision:4},{...purpose,guildId:'other-guild'}])await rejects(run(store,keeper,'release',{id,expectedRevision:1},{...trusted,resolvePurpose:async()=>value}),403);
  await rejects(run(store,keeper,'release',{id,expectedRevision:1,agreed:true},trusted),400);
  const released=await run(store,keeper,'release',{id,expectedRevision:1},trusted);assert.equal(released.contribution.status,'released');assert.equal(released.contribution.release.authorizedBy,keeper.userId);assert.equal(released.trainingExecuted,false);
  const dataset=await run(store,keeper,'dataset',{purposeId:purpose.purposeId,purposeRevision:3},trusted);assert.equal(dataset.contributions.length,1);assert.equal(dataset.contributions[0].id,id);assert.equal(dataset.trainingExecuted,false);
  await rejects(run(store,keeper,'dataset',{purposeId:purpose.purposeId,purposeRevision:3},{...trusted,resolvePurpose:async()=>({...purpose,status:'revoked'})}),403);
  await run(store,alice,'withdraw',{id,expectedRevision:2});assert.equal((await run(store,keeper,'dataset',{purposeId:purpose.purposeId,purposeRevision:3},trusted)).contributions.length,0);
});

test('terms remain a nonexecuting proposal and cannot expand training consent or approve a purpose',async()=>{
  const store=new MemoryStorage(),created=await run(store,alice,'contribute',contribution()),id=created.contribution.id;
  const input={id,expectedRevision:1,terms:{mode:'external-shared-payout',reference:'offer:external-1',summary:'Discuss a share with the contributor.'}};
  await rejects(run(store,alice,'propose-terms',input,trusted),403);
  await rejects(run(store,keeper,'propose-terms',input,{...trusted,resolvePurpose:async()=>({...purpose,status:'pending'})}),403);
  const proposed=await run(store,keeper,'propose-terms',input,trusted);assert.equal(proposed.contribution.negotiation.status,'proposed');assert.equal(proposed.contribution.negotiation.execution,'not-started');assert.equal(proposed.contribution.status,'quarantined');assert.equal(proposed.settlementExecuted,false);
  assert.equal((await run(store,keeper,'propose-terms',input,trusted)).idempotent,true);
  await rejects(run(store,keeper,'settle',{id},trusted),405);
  await rejects(run(store,keeper,'propose-terms',{...input,terms:{...input.terms,amount:100}},trusted),400);
});

test('delivery and withdrawals are transactional, retention and pagination remain bounded',async()=>{
  const store=new MemoryStorage();
  const pair=await Promise.all([run(store,alice,'contribute',contribution()),run(store,alice,'contribute',contribution())]);assert.equal(pair.filter(row=>row.created).length,1);
  for(let n=2;n<5;n++)await run(store,alice,'contribute',contribution('retry-'+n));
  const page=await run(store,alice,'list',{limit:2});assert.equal(page.contributions.length,2);assert.ok(page.nextCursor);const next=await run(store,alice,'list',{limit:2,cursor:page.nextCursor});assert.equal(next.contributions.length,2);assert.notEqual(next.contributions[0].id,page.contributions[0].id);
  await rejects(run(store,alice,'list',{cursor:'forged/cursor'}),400);
  await store.put(`guild-training:${alice.guildId}:count:${alice.userId}`,250);await rejects(run(store,alice,'contribute',contribution('full')),409);
  assert.equal((await run(store,alice,'list')).contributions.length,4,'retention failure preserves existing receipts');
  const failStore=new MemoryStorage();failStore.put=async function(key,value){this.rows.set(key,value);throw new Error('disk failed')};await assert.rejects(run(failStore,alice,'contribute',contribution()),/disk failed/);assert.equal(failStore.rows.size,0);
});

test('HTTP adapters reuse authenticated identities and refuse unsigned internal delivery, oversized streams, and wrong Guild scope',async()=>{
  const store=new MemoryStorage(),env={NODE_FABRIC_SESSION_SECRET:'fictional-long-internal-training-secret'};
  const node={state:{storage:store},env};let delivered;
  const stubFactory=()=>({stub:{fetch:async(url,init)=>{delivered=JSON.parse(init.body);return handleGuildTrainingInternal(new Request(url,init),node)}}});
  const request=body=>new Request(`https://guild.example.test${GUILD_TRAINING_ROUTE}/contribute?nodeId=${alice.nodeId}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const accepted=await handleGuildTrainingRequest(request(contribution()),env,async()=>alice,stubFactory);assert.equal(accepted.status,201);assert.equal(delivered.member.userId,alice.userId);
  const unauth=await handleGuildTrainingRequest(request(contribution()),env,async()=>{throw Object.assign(new Error('login required'),{status:401})},stubFactory);assert.equal(unauth.status,401);
  const unsigned=await handleGuildTrainingInternal(new Request('https://internal/internal/guild-training',{method:'POST',body:JSON.stringify({member:alice,action:'contribute',input:contribution()})}),node);assert.equal(unsigned.status,403);
  const wrong=await handleGuildTrainingInternal(new Request('https://internal/internal/guild-training',{method:'POST',headers:{'content-type':'application/json','x-civweave-node-id':'other','x-civweave-internal-guild-training':await guildTrainingInternalToken(env)},body:JSON.stringify({member:alice,action:'contribute',input:contribution()})}),node);assert.equal(wrong.status,403);
  const oversized=await handleGuildTrainingRequest(request({...contribution(),sample:{...sample(),output:'x'.repeat(MAX_GUILD_TRAINING_BYTES)}}),env,async()=>alice,stubFactory);assert.equal(oversized.status,413);
});

test('browser client uses the selected host session only, sends an explicit exact contribution, and validates host ACK scope',async()=>{
  const source=await readFile(new URL('../public/app/guild-training-client-v1.js',import.meta.url),'utf8');
  const store=new MemoryStorage(),calls=[];let badScope=false;
  const context={URL,AbortController,TextEncoder,crypto,setTimeout,clearTimeout,console,navigator:{onLine:true},location:{origin:'https://app.example.test'},CivweaveHostNodeSessionV1:{sessionFor:id=>id===alice.nodeId?{...alice,origin:'https://host.example.test',token:'fictional-session',expiresAt:'2099-01-01T00:00:00Z'}:null},fetch:async(url,init)=>{calls.push({url:String(url),init});const action=new URL(url).pathname.endsWith('/contribute')?'contribute':'list',result=await run(store,alice,action,init.body?JSON.parse(init.body):{});if(badScope)result.guildId='wrong-guild';return Response.json(result)}};
  context.parent=context;vm.runInNewContext(source,context);const api=context.CivweaveGuildTrainingV1;assert.ok(api);
  assert.equal(calls.length,0,'loading client never collects or sends a sample');
  await api.list({id:alice.nodeId,guildId:alice.guildId});const ack=await api.contribute({id:alice.nodeId,guildId:alice.guildId},contribution());assert.equal(ack.contribution.status,'quarantined');assert.match(calls[1].url,/host\.example\.test\/api\/node\/training\/contribute/);assert.equal(calls[1].init.headers.authorization,'Bearer fictional-session');
  await assert.rejects(api.contribute('unknown-guild',contribution()),/Log in/);
  badScope=true;await assert.rejects(api.list({id:alice.nodeId,guildId:alice.guildId}),/Guild|scope|invalid/i);
});
