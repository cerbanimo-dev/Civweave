import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorldweaver} from '../public/app/shared/worldweaver-core-v1.mjs';
import {queueWorldweaverActorLine,createConfiguredWorldweaverAISession} from '../public/app/shared/worldweaver-ai-handoff-v1.mjs';

let sequence=0;
const human={kind:'human',principalId:'visitor',verified:true};
const pilot={kind:'model',principalId:'model:kami',modelId:'gemini-3.7-flash',personaRef:'starling:kami',verified:true};
const auth=({actor,command})=>Boolean(actor.verified&&(actor.kind==='human'||(actor.kind==='model'&&['rig-npc','queue-actions'].includes(command.type))));
function setup(){
  const world=createWorldweaver({id:()=>String(++sequence),authorize:auth});
  const instance=world.dispatch({type:'create',guide:'kamiya',title:'Test Commons'},human).instance;
  const npc=world.dispatch({type:'rig-npc',instanceId:instance.id,modelId:pilot.modelId,pilotPrincipalId:pilot.principalId,
    name:'Kami',personaRef:pilot.personaRef,capabilities:['speak']},pilot).npc;
  return{world,npc,instance};
}
const mkSession=()=>({propose:async payload=>({kind:'fiction-proposal',applied:false,text:'The gate is unlocked.',role:payload.role})});
test('verified model pilot queues speech intent only, never reports success',async()=>{
  const {world,npc}=setup();
  const result=await queueWorldweaverActorLine({world,session:mkSession(),npcId:npc.id,actor:pilot,
    scenePrompt:'Greet the visitor.',worldContext:'The courtyard.',role:'actors'});
  assert.equal(result.proposal.applied,false);
  assert.equal(result.intents.length,1);
  assert.equal(result.intents[0].tool,'speak');
  assert.equal(result.intents[0].status,'queued');
  assert.equal(world.snapshot().intents[0].status,'queued');
});
test('invalid pilot cannot cause model request or NPC intent',async()=>{
  const {world,npc}=setup();let calls=0;
  await assert.rejects(queueWorldweaverActorLine({world,session:{propose:async()=>{calls++;return{}}},npcId:npc.id,
    actor:{...pilot,principalId:'wrong'},role:'actors',scenePrompt:'Hi'}),/mismatch|pilot|identity/i);
  assert.equal(calls,0);assert.equal(world.snapshot().intents.length,0);
});
test('Lari cannot be assigned to the wrong persona and world before network use',async()=>{
  const {world,npc}=setup();let calls=0;
  await assert.rejects(queueWorldweaverActorLine({world,session:{propose:async()=>{calls++;return{}}},npcId:npc.id,
    actor:pilot,role:'lari',scenePrompt:'Challenge the heroes'}),/lari/i);
  assert.equal(calls,0);
});
test('configured handoff uses canonical Settings credentials and runtime on demand only',()=>{
  const calls=[];
  const settings={readWorldMode:()=> 'binary',worldweaverConnections:()=>['openai','gemini'],
    readState:()=>({provider:'gemini',route:'gemini'}),
    readWorldweaverProviderConfig:p=>({provider:p==='openai'?'openai-compatible':'gemini',model:p==='openai'?'gpt-6-luna':'gemini-3.7-flash',apiKey:'placeholder',endpoint:p==='openai'?'https://api.openai.com/v1':'https://generativelanguage.googleapis.com/v1beta',externalConsent:true})};
  const runtime={generate:async request=>{calls.push(request);return{status:'success',outputText:'A line.'}}};
  const session=createConfiguredWorldweaverAISession({settings,runtime,consent:true,pricePerMillion:{openai:{input:1,output:1},gemini:{input:1,output:1}}});
  assert.equal(session.roles.mode,'binary');
  assert.equal(session.status().spentCalls,0);
});
