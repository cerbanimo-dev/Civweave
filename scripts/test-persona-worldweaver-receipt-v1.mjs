import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorldweaver} from '../public/app/shared/worldweaver-core-v1.mjs';
import {createPersonaWorldReceiptVerifier} from '../public/app/shared/persona-worldweaver-receipt-v1.mjs';

const make=()=>{
 let n=0;
 const world=createWorldweaver({id:()=>String(++n),clock:()=>new Date().toISOString(),
   authorize:({actor})=>actor?.verified===true});
 const owner={kind:'human',principalId:'author',verified:true};
 const instance=world.dispatch({type:'create',guide:'moss',title:'Shared scene'},owner).instance;
 const npc=world.dispatch({type:'rig-npc',instanceId:instance.id,modelId:'qwen3.5:0.8b',
  pilotPrincipalId:'pilot:landry',name:'Landry',personaRef:'source-pack:landry',
  pilotPrompt:'Fictional Landry',capabilities:['speak','move']},owner).npc;
 const pilot={kind:'model',principalId:'pilot:landry',modelId:'qwen3.5:0.8b',
  personaRef:'source-pack:landry',verified:true};
 const actions=[{tool:'speak',args:{text:'I want to go.'}}];
 const queued=world.dispatch({type:'queue-actions',npcId:npc.id,actions},pilot).intents;
 const proposal={type:'npc-proposal',id:'event-1',characterId:'landry',proposedActions:actions};
 const binding={receiptId:'world:receipt-1',campaignId:'campaign:one',proposalId:'event-1',intentIds:queued.map(x=>x.id),
  npcId:npc.id,instanceId:instance.id,personaRef:npc.personaRef,
  packId:'source-pack',modelId:npc.modelId,pilotPrincipalId:npc.pilotPrincipalId};
 const verify=createPersonaWorldReceiptVerifier({world,getBinding:async()=>binding});
 const query={worldReceiptId:binding.receiptId,proposal,campaignId:'campaign:one',
  actor:{kind:'runtime',principalId:'server:worldweaver'}};
 return{world,owner,npc,pilot,queued,binding,proposal,verify,query};
};
test('a queued model action cannot be marked successful before trusted Worldweaver runtime resolution',async()=>{
 const s=make();
 assert.equal(await s.verify(s.query),false);
 s.world.dispatch({type:'report-action',intentId:s.queued[0].id,outcome:'succeeded'},{
  kind:'runtime',principalId:'server:worldweaver',verified:true});
 assert.equal(await s.verify(s.query),true);
});
test('forged receipts, wrong pilot, mismatched arguments and failed actions never verify',async()=>{
 const s=make();
 s.world.dispatch({type:'report-action',intentId:s.queued[0].id,outcome:'failed'},{
  kind:'runtime',principalId:'server:worldweaver',verified:true});
 assert.equal(await s.verify(s.query),false);
 assert.equal(await s.verify({...s.query,worldReceiptId:'world:forged'}),false);
 assert.equal(await s.verify({...s.query,actor:{kind:'model',principalId:'pilot:landry'}}),false);
 const success=make();
 success.world.dispatch({type:'report-action',intentId:success.queued[0].id,outcome:'succeeded'},{
  kind:'runtime',principalId:'server:worldweaver',verified:true});
 assert.equal(await success.verify({...success.query,proposal:{...success.proposal,
  proposedActions:[{tool:'speak',args:{text:'Something else'}}]}}),false);
 const badBinding={...success.binding,pilotPrincipalId:'pilot:impostor'};
 const verify=createPersonaWorldReceiptVerifier({world:success.world,getBinding:async()=>badBinding});
 assert.equal(await verify(success.query),false);
});

test('completed actions cannot be used to confirm a different campaign or event',async()=>{
 const s=make();s.world.dispatch({type:'report-action',intentId:s.queued[0].id,outcome:'succeeded'},
   {kind:'runtime',principalId:'server:worldweaver',verified:true});
 assert.equal(await s.verify({...s.query,campaignId:'campaign:two'}),false);
 assert.equal(await s.verify({...s.query,proposal:{...s.proposal,id:'event-999'}}),false);
});
