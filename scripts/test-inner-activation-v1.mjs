import test from 'node:test';
import assert from 'node:assert/strict';
import {initialTriggerState,advanceTriggerState,manualFront,normalizeTriggerPolicy} from '../public/app/shared/inner-activation-v1.mjs';
import {authorTemplate,createInnerEnsemble} from '../public/app/shared/inner-ensemble-v1.mjs';

test('all three fictional trigger meters rise and fall with bounded reported deltas',()=>{
 let state=initialTriggerState();
 const enabled=['child','teen','adult'];
 let output=advanceTriggerState(state,{enabled,reactions:{child:{delta:500},teen:-500,adult:20}});
 assert.equal(output.state.activation.child,33);
 assert.equal(output.state.activation.teen,0);
 assert.equal(output.state.activation.adult,18);
 state=output.state;
 for(let i=0;i<2;i++)state=advanceTriggerState(state,{enabled,reactions:{child:35}}).state;
 assert.equal(state.frontAgentId,'child');
 assert.equal(state.temporaryFront,'child');
 assert.equal(state.homeFront,'adult');
 assert.equal(normalizeTriggerPolicy({releaseThreshold:80,threshold:70}).releaseThreshold,54);
});
test('internal control is temporary with hysteresis, max duration and cooldown',()=>{
 let state=initialTriggerState();
 const enabled=['child','teen','adult'];
 for(let i=0;i<3;i++)state=advanceTriggerState(state,{enabled,reactions:{teen:35}}).state;
 assert.equal(state.frontAgentId,'teen');
 state=advanceTriggerState(state,{enabled,reactions:{teen:35}}).state;
 assert.equal(state.frontAgentId,'teen');
 state=advanceTriggerState(state,{enabled,reactions:{teen:35}}).state;
 assert.equal(state.frontAgentId,'teen');
 state=advanceTriggerState(state,{enabled,reactions:{teen:35}}).state;
 assert.equal(state.frontAgentId,'adult','maximum temporary tenure returns to author-selected front');
 assert.equal(state.cooldownRemaining,2);
 state=advanceTriggerState(state,{enabled,reactions:{teen:35}}).state;
 assert.equal(state.frontAgentId,'adult','cooldown prevents immediate oscillation');
 state=manualFront(state,'child');
 assert.equal(state.frontAgentId,'child');
 assert.equal(state.homeFront,'child');
 assert.equal(state.temporaryFront,null);
});
test('a simulated model trigger takes effect at next event, preserving response routing and author override',async()=>{
 const profile=authorTemplate();let number=0,events=[],requests=[];
 const engine=createInnerEnsemble({template:profile,idFactory:()=>String(++number),
 generate:async request=>{
  requests.push(request);
  return {text:JSON.stringify({reply:'One response',action:{kind:'observe',description:'Look'},
   activation:{delta:request.phase==='initial'&&request.agentId==='child'?35:0,reason:'Curiosity'}})};
 },onUpdate:x=>events.push(x)});
 for(let i=0;i<3;i++)await engine.send('A mysterious object appears');
 assert.equal(engine.status().frontAgentId,'child');
 const next=await engine.send('A fourth shared event');
 assert.equal(next.frontAgentId,'child');
 assert.ok(next.upstreamActions.some(x=>x.agentId==='adult'&&x.toAgentId==='child'));
 assert.ok(events.some(x=>x.type==='front-changed'&&x.agentId==='child'));
 engine.setFront('adult');
 assert.equal(engine.status().frontAgentId,'adult');
 const saved=engine.exportState();
 const other=createInnerEnsemble({template:saved.template,idFactory:()=>String(++number),generate:async()=>({text:'Ready'})});
 other.importActivation(saved.activation);
 assert.deepEqual(other.getActivation(),engine.getActivation());
 assert.equal(saved.template.agents.child.permissions.tools,false);
});
