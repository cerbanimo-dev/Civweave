import assert from 'node:assert/strict';
import test from 'node:test';
import {authorTemplate,normalizeAuthorTemplate,createInnerEnsemble,INNER_ENSEMBLE_SCHEMA} from '../public/app/shared/inner-ensemble-v1.mjs';
let seq=0;
const idFactory=()=>String(++seq);
const json=(reply,kind='plan',description=reply)=>({text:JSON.stringify({reply,action:{kind,description}})});
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('author self-insert templates are blank and disallow autonomous privileges',()=>{
 const profile=authorTemplate();
 assert.equal(profile.schema,INNER_ENSEMBLE_SCHEMA);
 assert.equal(profile.controls.frontAgentId,'adult');
 assert.deepEqual(Object.keys(profile.agents),['child','teen','adult']);
 assert.deepEqual(Object.values(profile.agents).map(x=>x.model),['qwen3.5:0.8b','qwen3.5:2b','qwen3.5:4b']);
 for(const actor of Object.values(profile.agents)){
  assert.deepEqual(Object.values(actor.personality),['','','','','','']);
  assert.deepEqual(actor.permissions,{speak:true,tools:false,autonomousActions:false,shareWithGuild:false});
  assert.ok(actor.challenges.length>=3);
 }
 const edited=authorTemplate();
 edited.agents.child.permissions.tools=true;
 edited.agents.adult.permissions.autonomousActions=true;
 edited.agents.teen.permissions.shareWithGuild=true;
 assert.equal(normalizeAuthorTemplate(edited).agents.child.permissions.tools,false);
 assert.equal(normalizeAuthorTemplate(edited).agents.adult.permissions.autonomousActions,false);
 assert.equal(normalizeAuthorTemplate(edited).agents.teen.permissions.shareWithGuild,false);
});
test('all three receive a shared event simultaneously, forward executive proposals, and adult integrates in order',async()=>{
 const pending=new Map(),requests=[],events=[];
 const agent=createInnerEnsemble({idFactory,generate:request=>{
  requests.push(request);
  if(request.phase==='integrate')return json('I consider this advice','plan','choose own action');
  return new Promise(resolve=>pending.set(request.agentId,resolve));
 },onUpdate:row=>events.push(row)});
 const running=agent.send('An unfamiliar door opens.');
 await flush();
 assert.deepEqual([...pending.keys()],['child','teen','adult']);
 assert.ok(requests.every(x=>x.signal));
 pending.get('teen')(json('I would ask a question','ask','ask about the door'));
 pending.get('child')(json('I would look around','observe','inspect the door'));
 await flush();
 assert.equal(events.filter(x=>x.type==='upstream-action').length,2);
 assert.equal(events.filter(x=>x.type==='front-integration').length,0);
 pending.get('adult')(json('I will inspect it','plan','inspect door'));
 const result=await running;
 assert.equal(result.frontAgentId,'adult');
 assert.equal(result.upstreamActions.length,2);
 assert.equal(requests.filter(x=>x.phase==='initial').length,3);
 assert.equal(requests.filter(x=>x.phase==='integrate').length,2);
 assert.equal(events.filter(x=>x.type==='front-integration').length,2);
 assert.equal(result.results.adult.type,'front-integration');
 assert.ok(events.filter(x=>x.type==='upstream-action').every(x=>x.toAgentId==='adult'&&x.simulationOnly));
 assert.ok(requests.some(x=>x.agentId==='child'&&x.model==='qwen3.5:0.8b'));
});
test('front control can switch to teen and later receive both inner layer proposals',async()=>{
 const profile=authorTemplate();
 profile.controls.frontAgentId='teen';
 const calls=[];
 const agent=createInnerEnsemble({template:profile,idFactory,generate:async request=>{
  calls.push(request);
  return json(request.agentId+' response');
 }});
 const result=await agent.send('A choice is needed');
 assert.equal(result.frontAgentId,'teen');
 assert.deepEqual(result.upstreamActions.map(x=>x.toAgentId),['teen','teen']);
 assert.ok(calls.filter(x=>x.phase==='integrate').every(x=>x.agentId==='teen'));
 agent.setFront('adult');
 assert.equal(agent.getTemplate().controls.frontAgentId,'adult');
});
test('developmental challenge broadcasts to every enabled layer',async()=>{
 const calls=[];
 const agent=createInnerEnsemble({idFactory,generate:async request=>{calls.push(request);return json('A thought');}});
 const result=await agent.challenge('child',0);
 assert.equal(calls.filter(x=>x.phase==='initial').length,3);
 assert.equal(result.upstreamActions.length,2);
 assert.ok(calls.some(x=>x.messages.at(-1).content.includes('CHILDHOOD EXERCISE')));
});
test('stop signals all in-flight models and prevents new turns until resumed',async()=>{
 const observed=[];
 const agent=createInnerEnsemble({idFactory,generate:request=>new Promise(resolve=>{
  observed.push({signal:request.signal,resolve});
 })});
 const pending=agent.send('One event');
 await flush();
 assert.equal(observed.length,3);
 agent.stop();
 assert.ok(observed.every(x=>x.signal.aborted));
 observed.forEach(x=>x.resolve(json('late')));
 const result=await pending;
 assert.ok(Object.values(result.results).every(row=>row.type==='cancelled'));
 await assert.rejects(()=>agent.send('Next'),/paused/);
 agent.resume();
});
test('author history survives a JSON export/import without network or model warmup',async()=>{
 const origin=createInnerEnsemble({idFactory,generate:async()=>json('Ready')});
 origin.remember('child','I found a painted stone in the fictional park.');
 await origin.send('What do we do next?');
 const saved=origin.exportState();
 const imported=createInnerEnsemble({idFactory,template:saved.template,generate:async()=>json('Ready')});
 imported.importHistory(JSON.parse(JSON.stringify(saved.history)));
 assert.deepEqual(imported.getHistory().map(x=>[x.type,x.eventId,x.agentId,x.text]),
  saved.history.map(x=>[x.type,x.eventId,x.agentId,x.text]));
 assert.ok(imported.getHistory().some(x=>x.type==='experience'&&x.agentId==='child'));
});
