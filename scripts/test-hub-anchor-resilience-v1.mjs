import test from 'node:test';
import assert from 'node:assert/strict';
import {ANCHOR_POLICY,anchorHealth,resilienceSummary,stipendPlan,externalSettlementPolicy} from '../cloudflare/node-cloud/src/anchor-registry.mjs';

const now=Date.parse('2026-08-12T08:00:00Z');
const checkpoint={checkpointId:'cp-1',createdAt:new Date(now-60000).toISOString(),recoveryCoverageBps:10000};
const healthy=(id,recipient,pairedOffset=0,key=id)=>({anchorId:id,recipientId:recipient,keyFingerprint:`sha256:${key}`,state:'active',pairedAt:new Date(now-7*86400000+pairedOffset).toISOString(),lastProofAt:new Date(now-60000).toISOString(),lastCheckpointId:'cp-1',recoveryCoverageBps:10000,proofCount:3});

test('classifies cloud-only, anchored, and redundant recovery',()=>{
  assert.equal(resilienceSummary([],checkpoint,now).resilienceClass,'cloud-only');
  assert.equal(resilienceSummary([healthy('a','u')],checkpoint,now).resilienceClass,'locally-anchored');
  assert.equal(resilienceSummary([healthy('a','u'),healthy('b','u')],checkpoint,now).resilienceClass,'redundantly-anchored');
});

test('weekly stipend is capped and diminishes 3/2/1 Buttons',()=>{
  const plan=stipendPlan([healthy('a','u1'),healthy('b','u2',1),healthy('c','u3',2),healthy('d','u4',3)],checkpoint,now);
  assert.deepEqual(plan.map(item=>item.buttons),[3,2,1]);
  assert.equal(plan.reduce((sum,item)=>sum+item.buttons,0),6);
});

test('duplicate signing keys cannot farm redundant stipends',()=>{
  const plan=stipendPlan([healthy('a','u1',0,'same'),healthy('b','u1',1,'same'),healthy('c','u1',2,'other')],checkpoint,now);
  assert.deepEqual(plan.map(item=>item.buttons),[3,2]);
});

test('stale proof blocks stipend eligibility',()=>{
  const anchor=healthy('a','u1');
  anchor.lastProofAt=new Date(now-ANCHOR_POLICY.proofFreshMs-1).toISOString();
  assert.equal(anchorHealth(anchor,checkpoint,now).healthy,false);
  assert.equal(stipendPlan([anchor],checkpoint,now).length,0);
});

test('incomplete recovery permits work recording but freezes irreversible settlement',()=>{
  const partition=externalSettlementPolicy({cloudReachable:false,reconciled:false,recoveryCoverageBps:9800});
  assert.equal(partition.recoveryMode,true);
  assert.equal(partition.externalSettlementAllowed,false);
  assert.equal(partition.contributionRecordingAllowed,true);
  assert.equal(externalSettlementPolicy({cloudReachable:true,reconciled:true,recoveryCoverageBps:10000}).externalSettlementAllowed,true);
});
