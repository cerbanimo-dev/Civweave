import test from 'node:test';
import assert from 'node:assert/strict';
import {readDailyGuildReport,publishDailyGuildReport,appendGuildReportAction,STARLING_REPORT_FILE_KIND,STARLING_REPORT_EVENT_KIND} from '../public/app/shared/starling-daily-report-v1.mjs';
const day='2026-11-03';
function harness(){
  const objects=new Map(),node={id:'device:founder'};
  const genesis={id:'guild-genesis:garden',kind:'civweave.guild-genesis.v1',payload:{guildId:'garden',foundingDeviceId:'device:founder'},origin:{nodeId:'device:founder'},signature:'signed'};
  objects.set(genesis.id,genesis);
  const mesh={
    async deviceId(){return node.id},
    async getObject(id){return objects.get(id)||null},
    async listObjects(){return [...objects.values()]},
    async validateObject(row){return {ok:row?.signature==='signed'}},
    async createObject(row){const record={...row,origin:{nodeId:node.id},signature:'signed'};objects.set(record.id,record);return record}
  };
  const founder=()=>({guildId:'garden',deviceId:'device:founder'});
  const read=()=>readDailyGuildReport({mesh,guildId:'garden',day,verifyReader:()=>true});
  const record=(id,kind,payload,signer='device:founder')=>objects.set(id,{id,kind,consent:'group',audience:['guild:garden'],payload:{guildId:'garden',...payload},origin:{nodeId:signer},signature:'signed'});
  return {objects,node,mesh,founder,read,record};
}
test('reconstructs a compact daily file from signed local model and worker actions',async()=>{
  const h=harness();
  h.record('turn-1','civweave.starling-collective-turn.v1',{schema:'civweave.starling-collective-turn.v1',turnId:'turn-1',at:day+'T10:00:00Z',personaId:'kami',source:'local-model',text:'Draft a garden schedule'});
  h.record('receipt-1','civweave.starling-collective-work-receipt.v1',{schema:'civweave.starling-work-receipt.v1',runId:'r1',status:'completed',at:day+'T10:01:00Z',personaId:'kami'});
  const r=await h.read();
  assert.equal(r.eventCount,2);
  assert.match(r.markdown,/Draft a garden schedule/);
  assert.match(r.markdown,/Completed execution reports: 1/);
  assert.match(r.markdown,/not evidence of task completion/i);
  assert.equal(r.filename,'starling-garden-2026-11-03.md');
});
test('rejects unauthenticated readers and foreign or invalidly signed events',async()=>{
  const h=harness();
  await assert.rejects(()=>readDailyGuildReport({mesh:h.mesh,guildId:'garden',day,verifyReader:()=>false}),/reader/);
  h.record('turn-forged','civweave.starling-collective-turn.v1',{schema:'civweave.starling-collective-turn.v1',turnId:'turn-forged',at:day+'T08:00:00Z',text:'Claimed success'},'device:other');
  h.record('turn-bad','civweave.starling-collective-turn.v1',{schema:'civweave.starling-collective-turn.v1',turnId:'turn-bad',at:day+'T08:00:00Z',text:'Claimed success'});
  h.objects.get('turn-bad').signature='broken';
  assert.equal((await h.read()).eventCount,0);
  await assert.rejects(()=>readDailyGuildReport({mesh:h.mesh,guildId:'garden',day:'2026-02-30',verifyReader:()=>true}),/UTC report day/);
});
test('cloud and community host metadata require independently trusted writer identity',async()=>{
  const h=harness();h.node.id='device:community';
  const input={mesh:h.mesh,guildId:'garden',source:'community-local',action:'inference',status:'completed',actor:'Starling',summary:'Model created a reviewable draft',now:()=>new Date(day+'T12:00:00Z')};
  await assert.rejects(()=>appendGuildReportAction(input),/Unapproved/);
  const event=await appendGuildReportAction({...input,verifyProducer:({deviceId})=>deviceId==='device:community'});
  assert.equal(event.kind,STARLING_REPORT_EVENT_KIND);
  assert.equal((await h.read()).eventCount,0);
  const trusted=await readDailyGuildReport({mesh:h.mesh,guildId:'garden',day,verifyReader:()=>true,verifyProducer:({deviceId})=>deviceId==='device:community'});
  assert.equal(trusted.eventCount,1);assert.match(trusted.markdown,/community-local/);
  h.node.id='device:founder';
  await assert.rejects(()=>appendGuildReportAction({...input,source:'cloud-ai',summary:'x'.repeat(400)}),/oversized/);
});
test('offline reader merges signed full file with disjoint newer local receipts',async()=>{
  const h=harness();
  h.record('turn-early','civweave.starling-collective-turn.v1',{
    schema:'civweave.starling-collective-turn.v1',turnId:'turn-early',
    at:day+'T08:00:00Z',text:'Morning field notes'
  });
  await publishDailyGuildReport({mesh:h.mesh,guildId:'garden',day,founder:h.founder});
  h.objects.delete('turn-early');
  h.record('turn-late','civweave.starling-collective-turn.v1',{
    schema:'civweave.starling-collective-turn.v1',turnId:'turn-late',
    at:day+'T18:00:00Z',text:'Evening field notes'
  });
  const merged=await h.read();
  assert.equal(merged.source,'signed-replicated-file');
  assert.equal(merged.eventCount,2);
  assert.match(merged.markdown,/Morning field notes/);
  assert.match(merged.markdown,/Evening field notes/);
});
test('replayed paired host job status is idempotent and cannot overwrite mismatched provenance',async()=>{
  const h=harness(),args={mesh:h.mesh,guildId:'garden',source:'community-local',
    action:'inference',status:'completed',summary:'Paired host reported completed',
    referenceId:'a'.repeat(32),idempotencyKey:'job1_completed'};
  const a=await appendGuildReportAction(args);
  const b=await appendGuildReportAction(args);
  assert.equal(a.id,b.id);
  assert.equal((await h.read()).eventCount,1);
  await assert.rejects(()=>appendGuildReportAction({...args,status:'failed'}),/collision/);
});
test('founder republishes a versioned file into the Guild mesh and does not duplicate unchanged reports',async()=>{
  const h=harness();
  h.record('turn-a','civweave.starling-collective-turn.v1',{schema:'civweave.starling-collective-turn.v1',turnId:'turn-a',at:day+'T09:00:00Z',text:'Proposed plan'});
  const a=await publishDailyGuildReport({mesh:h.mesh,guildId:'garden',day,founder:h.founder});
  assert.equal(a.changed,true);assert.equal(a.object.kind,STARLING_REPORT_FILE_KIND);assert.equal(a.object.revision,1);assert.equal(a.object.consent,'group');
  assert.equal((await publishDailyGuildReport({mesh:h.mesh,guildId:'garden',day,founder:h.founder})).changed,false);
  h.record('turn-b','civweave.starling-collective-turn.v1',{schema:'civweave.starling-collective-turn.v1',turnId:'turn-b',at:day+'T10:00:00Z',text:'Another plan'});
  const b=await publishDailyGuildReport({mesh:h.mesh,guildId:'garden',day,founder:h.founder});
  assert.equal(b.object.revision,2);assert.equal(b.object.payload.eventCount,2);
  h.node.id='device:other';
  await assert.rejects(()=>publishDailyGuildReport({mesh:h.mesh,guildId:'garden',day,founder:h.founder}),/founding Guildkeeper/);
});
