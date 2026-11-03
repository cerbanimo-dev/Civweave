import test from 'node:test';
import assert from 'node:assert/strict';
import {createStarlingReportProducerRegistry,createStarlingReportProducerVerifier,STARLING_REPORT_PRODUCER_GRANT_KIND} from '../public/app/shared/starling-report-producers-v1.mjs';
import {appendGuildReportAction,readDailyGuildReport,publishDailyGuildReport} from '../public/app/shared/starling-daily-report-v1.mjs';

const T=Date.parse('2026-11-03T12:00:00Z');
function harness(){
  let now=T;const records=new Map(),node={id:'device:founder'};
  const mesh={
    async deviceId(){return node.id},
    async getObject(id){return records.get(id)||null},
    async listObjects(){return [...records.values()]},
    async validateObject(row){return {ok:row?.signature==='signed'}},
    async createObject(input){
      const row={...input,origin:{nodeId:node.id},signature:'signed'};
      records.set(row.id,row);return row;
    }
  };
  records.set('guild-genesis:garden',{
    id:'guild-genesis:garden',kind:'civweave.guild-genesis.v1',signature:'signed',
    origin:{nodeId:'device:founder'},payload:{guildId:'garden',foundingDeviceId:'device:founder'}
  });
  const founder=()=>({guildId:'garden',deviceId:'device:founder'});
  const registry=createStarlingReportProducerRegistry({mesh,founder,now:()=>now});
  const verifier=createStarlingReportProducerVerifier({mesh,guildId:'garden',now:()=>now});
  const issue=(deviceId='device:community',source='community-local')=>registry.issue({
    guildId:'garden',deviceId,source,days:7,confirmConsent:()=>true
  });
  return {mesh,records,node,founder,registry,verifier,issue,advance:days=>{now+=days*86400000}};
}
test('grants require founding device and explicit Guildkeeper approval',async()=>{
  const h=harness();
  await assert.rejects(()=>h.registry.issue({guildId:'garden',deviceId:'device:remote',source:'cloud-ai',confirmConsent:()=>false}),/approval/);
  h.node.id='device:attacker';
  await assert.rejects(()=>h.issue(),/Guild founding device/);
  h.node.id='device:founder';
  await h.issue();
  assert.equal(h.records.get('starling-report-producer:garden:device:community').kind,STARLING_REPORT_PRODUCER_GRANT_KIND);
  assert.equal(h.records.get('starling-report-producer:garden:device:community').consent,'group');
});
test('grant authorizes only its exact device Guild and source, expiring after seven days',async()=>{
  const h=harness();await h.issue();
  assert.equal(await h.verifier({guildId:'garden',deviceId:'device:community',source:'community-local'}),true);
  for(const input of [
    {guildId:'wrong',deviceId:'device:community',source:'community-local'},
    {guildId:'garden',deviceId:'device:other',source:'community-local'},
    {guildId:'garden',deviceId:'device:community',source:'cloud-ai'},
    {guildId:'garden',deviceId:'device:founder',source:'community-local'},
  ])assert.equal(await h.verifier(input),false);
  h.advance(8);
  assert.equal(await h.verifier({guildId:'garden',deviceId:'device:community',source:'community-local'}),false);
});
test('revoking a signed grant immediately removes producer authority',async()=>{
  const h=harness();await h.issue();const previous=h.records.get('starling-report-producer:garden:device:community');
  const revoked=await h.registry.revoke({guildId:'garden',deviceId:'device:community'});
  assert.equal(revoked.enabled,false);
  assert.equal(h.records.get(previous.id).revision,2);
  assert.equal(await h.verifier({guildId:'garden',deviceId:'device:community',source:'community-local'}),false);
});
test('tampered and foreign-signed grants fail closed',async()=>{
  const h=harness();await h.issue();const id='starling-report-producer:garden:device:community';
  h.records.get(id).signature='bad';
  assert.equal(await h.verifier({guildId:'garden',deviceId:'device:community',source:'community-local'}),false);
  h.records.get(id).signature='signed';h.records.get(id).origin.nodeId='device:other';
  assert.equal(await h.verifier({guildId:'garden',deviceId:'device:community',source:'community-local'}),false);
  await assert.rejects(()=>h.issue(),/Conflicting/);
});
test('reader cannot list report producers without authenticated Guild access',async()=>{
  const h=harness();await h.issue();
  await assert.rejects(()=>h.registry.list({guildId:'garden',verifyReader:()=>false}),/reader authorization/);
  const active=await h.registry.list({guildId:'garden',verifyReader:()=>true});
  assert.equal(active.length,1);assert.equal(active[0].deviceId,'device:community');
});
test('signed community-host events reach founder report through grant, remain unverified, and are archived in the file',async()=>{
  const h=harness();await h.issue();
  h.node.id='device:community';
  const obj=await appendGuildReportAction({
    mesh:h.mesh,guildId:'garden',source:'community-local',action:'inference',
    status:'completed',summary:'Completed a local review-only draft',
    referenceId:'job-17',verifyProducer:h.verifier,
    now:()=>new Date(T+1000)
  });
  assert.equal(obj.origin.nodeId,'device:community');
  h.node.id='device:founder';
  const data=await readDailyGuildReport({mesh:h.mesh,guildId:'garden',day:'2026-11-03',verifyReader:()=>true,verifyProducer:h.verifier});
  assert.equal(data.eventCount,1);assert.equal(data.events[0].unverified,true);
  const filed=await publishDailyGuildReport({mesh:h.mesh,guildId:'garden',founder:h.founder,day:'2026-11-03',verifyProducer:h.verifier});
  assert.equal(filed.object.payload.eventCount,1);assert.equal(filed.object.payload.events.length,1);
  h.records.delete(obj.id);
  const restored=await readDailyGuildReport({mesh:h.mesh,guildId:'garden',day:'2026-11-03',verifyReader:()=>true,verifyProducer:h.verifier});
  assert.equal(restored.source,'signed-replicated-file');
  assert.equal(restored.events.length,1);
  assert.match(restored.markdown,/Completed a local review-only draft/);
});
