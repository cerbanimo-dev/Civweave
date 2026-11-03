/**
 * Starling Daily Guild Report: signed, group-replicated activity evidence and
 * a portable Markdown report file. No second Guild task owner or AI inference.
 * All timestamps are UTC. Never treat model-generated text as task proof.
 */
export const STARLING_REPORT_EVENT_KIND='civweave.starling-report-event.v1';
export const STARLING_REPORT_FILE_KIND='civweave.starling-daily-report-file.v1';
export const STARLING_REPORT_SCHEMA='civweave.starling-daily-report.v1';
const TURN='civweave.starling-collective-turn.v1';
const RECEIPT='civweave.starling-collective-work-receipt.v1';
const EVENT_SCHEMA='civweave.starling-report-event.v1';
const FILE_LIMIT=72000;
const validGuild=value=>typeof value==='string'&&/^[A-Za-z0-9:_-]{1,180}$/.test(value);
const validDay=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+'T00:00:00.000Z'))&&new Date(value+'T00:00:00.000Z').toISOString().slice(0,10)===value;
const clean=(value,max=360)=>typeof value==='string'?value.trim().slice(0,max):'';
const slug=value=>value.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,80);
const iso=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
const esc=value=>String(value??'').replace(/\|/g,'\\|').replace(/\r?\n/g,' ').replace(/\s+/g,' ').trim();
const allowedSources=new Set(['cloud-ai','community-local','local-device','trusted-tool']);
const allowedStatus=new Set(['started','completed','failed','blocked','proposed','reviewed']);
const allowedAction=new Set(['inference','tool','quest-review','draft','handoff','planning']);
const dayAt=at=>at.slice(0,10);
const REPORT_KINDS=new Set([TURN,RECEIPT,STARLING_REPORT_EVENT_KIND]);

async function signedGenesis(mesh,guildId){
  if(!validGuild(guildId))throw new TypeError('Valid Guild ID required.');
  const record=await mesh.getObject('guild-genesis:'+guildId);
  if(record?.kind!=='civweave.guild-genesis.v1'||record.payload?.guildId!==guildId
      ||record.payload?.foundingDeviceId!==record.origin?.nodeId
      ||(await mesh.validateObject(record))?.ok!==true)throw new Error('Valid signed Guild founding record required.');
  return record;
}
function scoped(record,guildId){
  return record?.consent==='group'&&Array.isArray(record.audience)
    &&record.audience.includes('guild:'+guildId)&&record.payload?.guildId===guildId;
}
function memberEntry(row,foundingId){
  if(row.origin?.nodeId!==foundingId)return null;
  const p=row.payload||{},at=iso(p.at);if(!at)return null;
  if(row.kind===TURN&&p.schema===TURN&&p.turnId===row.id&&clean(p.text,3500))
    return {id:row.id,at,source:p.source==='local-host'?'community-local':'local-device',
      actor:clean(p.personaId,45)||'Starling',action:'draft',status:'proposed',
      detail:clean(p.brief,150)||clean(p.text,200),ref:row.id,unverified:true};
  if(row.kind===RECEIPT&&p.schema==='civweave.starling-work-receipt.v1'
      &&['started','completed','failed'].includes(p.status)&&clean(p.runId,90))
    return {id:row.id,at,source:'local-device',actor:clean(p.personaId,45)||'Starling worker',
      action:'planning',status:p.status,detail:p.status==='failed'?clean(p.error,200)||'Execution failed':
      (p.offerOnly?'Proposed assistance on a Guild Quest beat':'Scheduled Guild planning attempt'),
      ref:clean(p.turnId,180)||clean(p.beatId,180)||clean(p.runId,90),unverified:true};
  return null;
}
function agentEntry(row){
  const p=row.payload||{},at=iso(p.at);
  if(row.kind!==STARLING_REPORT_EVENT_KIND||p.schema!==EVENT_SCHEMA||p.eventId!==row.id
    ||!at||!allowedSources.has(p.source)||!allowedAction.has(p.action)
    ||!allowedStatus.has(p.status)||!clean(p.summary,360))return null;
  return {id:row.id,at,source:p.source,actor:clean(p.actor,80)||'Collective host',
    action:p.action,status:p.status,detail:clean(p.summary,360),
    ref:clean(p.referenceId,180),unverified:true};
}
function markdown(guildId,day,events){
  const completed=events.filter(e=>e.status==='completed').length;
  const failed=events.filter(e=>['failed','blocked'].includes(e.status)).length;
  const sources=[...new Set(events.map(e=>e.source))].sort();
  const head=['# Starling Collective · Guild Daily Report','',
    'Guild: '+guildId,'Day (UTC): '+day,'Recorded actions: '+events.length,
    'Completed execution reports: '+completed,'Failures / blockers: '+failed,
    'Sources: '+(sources.join(', ')||'None'),'',
    '> Signed device/host provenance is not evidence of task completion or human approval. Model output and host receipts remain unverified until the canonical Quest/Cerbanimo reviewer confirms them.','',
    '| UTC time | Source | Actor | Action | State | Reported activity | Reference |',
    '| --- | --- | --- | --- | --- | --- | --- |'];
  for(const e of events)head.push('| '+[e.at.slice(11,19),e.source,e.actor,e.action,e.status,e.detail,e.ref||'—'].map(esc).join(' | ')+' |');
  if(!events.length)head.push('| — | — | — | — | — | No signed activity received for this day | — |');
  return head.join('\n')+'\n';
}
function report(guildId,day,events,mode='reconstructed'){
  const items=Object.freeze(events.slice().sort((a,b)=>a.at.localeCompare(b.at)||a.id.localeCompare(b.id)).slice(-350).map(x=>Object.freeze(x)));
  const text=markdown(guildId,day,items);
  return Object.freeze({schema:STARLING_REPORT_SCHEMA,guildId,day,
    filename:'starling-'+slug(guildId)+'-'+day+'.md',markdown:text,events:items,
    eventCount:items.length,source:mode,needsReview:items.some(e=>e.status==='failed'||e.status==='blocked')});
}
/**
 * verifyReader MUST be provided by the authenticated Guild membership owner.
 * verifyProducer MUST be a trusted host/device authorization callback; it
 * cannot be derived from an agent's output or an unsigned browser event.
 */
export async function readDailyGuildReport({mesh,guildId,day=new Date().toISOString().slice(0,10),verifyReader,verifyProducer}={}){
  if(!mesh?.getObject||!mesh?.listObjects||!mesh?.validateObject)throw new TypeError('Canonical signed object mesh required.');
  if(!validDay(day))throw new TypeError('Valid UTC report day required.');
  const genesis=await signedGenesis(mesh,guildId);
  if(typeof verifyReader!=='function'||await verifyReader(guildId)!==true)throw new Error('Authenticated Guild report reader required.');
  const founderId=genesis.origin.nodeId,rows=await mesh.listObjects(),events=[];
  let snapshot=null;
  for(const row of Array.isArray(rows)?rows:[]){
    if(!scoped(row,guildId))continue;
    if(!REPORT_KINDS.has(row.kind)&&row.kind!==STARLING_REPORT_FILE_KIND)continue;
    if((await mesh.validateObject(row))?.ok!==true)continue;
    if(row.kind===STARLING_REPORT_FILE_KIND){
      const p=row.payload;
      if(row.origin?.nodeId===founderId&&row.id==='starling-daily-report:'+guildId+':'+day
        &&p?.schema===STARLING_REPORT_SCHEMA&&p.day===day
        &&typeof p.markdown==='string'&&p.markdown.length<=FILE_LIMIT
        &&Number.isSafeInteger(p.eventCount)&&p.eventCount>=0) snapshot=row;
      continue;
    }
    let entry;
    if(row.kind===STARLING_REPORT_EVENT_KIND){
      entry=agentEntry(row);
      if(entry&&row.origin?.nodeId!==founderId){
        if(typeof verifyProducer!=='function'||await verifyProducer({
          guildId,deviceId:row.origin.nodeId,source:entry.source,action:entry.action,at:entry.at
        })!==true)entry=null;
      }
    }else entry=memberEntry(row,founderId);
    if(entry&&dayAt(entry.at)===day)events.push(entry);
  }
  const computed=report(guildId,day,events);
  // A signed full file is useful when its individual receipts have not yet
  // reached a Pocket Node. Never trust a snapshot from a different signer.
  if(snapshot?.payload?.eventCount>computed.eventCount)
    return Object.freeze({...computed,markdown:snapshot.payload.markdown,
      eventCount:snapshot.payload.eventCount,source:'signed-replicated-file'});
  return computed;
}
/** Trusted model/tool/host adapters append metadata, never arbitrary prompts. */
export async function appendGuildReportAction({mesh,guildId,source,action,status,actor='',summary='',referenceId='',idempotencyKey='',now=()=>new Date(),verifyProducer}={}){
  if(!mesh?.deviceId||!mesh?.createObject||!mesh?.validateObject)throw new TypeError('Canonical signer required.');
  const genesis=await signedGenesis(mesh,guildId),deviceId=await mesh.deviceId();
  if(deviceId!==genesis.origin.nodeId&&(
    typeof verifyProducer!=='function'||await verifyProducer({guildId,deviceId,source,action})!==true
  ))throw new Error('Unapproved Guild report writer.');
  if(!allowedSources.has(source)||!allowedAction.has(action)||!allowedStatus.has(status)||!clean(summary,361)||summary.length>360)
    throw new TypeError('Unsupported or oversized report action.');
  if(idempotencyKey&&!/^[a-zA-Z0-9_-]{1,80}$/.test(idempotencyKey))throw new TypeError('Safe host event idempotency key required.');
  const at=now().toISOString(),id='starling-report-event:'+guildId+':'+(idempotencyKey?source+':'+idempotencyKey:crypto.randomUUID());
  if(idempotencyKey){
    const prior=await mesh.getObject(id);
    if(prior){
      if(prior.kind!==STARLING_REPORT_EVENT_KIND||prior.origin?.nodeId!==deviceId
         ||prior.payload?.guildId!==guildId||prior.payload?.source!==source
         ||prior.payload?.action!==action||prior.payload?.status!==status
         ||prior.payload?.referenceId!==clean(referenceId,180)
         ||(await mesh.validateObject(prior))?.ok!==true)throw new Error('Signed host event key collision.');
      return prior;
    }
  }
  return mesh.createObject({id,revision:1,kind:STARLING_REPORT_EVENT_KIND,
    purpose:'Auditable Starling host action metadata; not independently verified task completion.',
    consent:'group',audience:['guild:'+guildId],publish:true,priority:45,
    payload:{schema:EVENT_SCHEMA,eventId:id,guildId,source,action,status,
      actor:clean(actor,80),summary:clean(summary,360),referenceId:clean(referenceId,180),at}});
}
/**
 * Founder publishes a complete Markdown file into the existing Guild mesh
 * after activity. Only one file object per Guild/UTC day; revision increments.
 * No new database, push provider or hidden cloud inference is introduced.
 */
export async function publishDailyGuildReport({mesh,guildId,founder,day=new Date().toISOString().slice(0,10)}={}){
  const genesis=await signedGenesis(mesh,guildId),self=await mesh.deviceId(),owner=typeof founder==='function'?founder():null;
  if(self!==genesis.origin.nodeId||owner?.guildId!==guildId||owner?.deviceId!==self)
    throw new Error('Only the founding Guildkeeper device can publish the v1 report file.');
  const data=await readDailyGuildReport({mesh,guildId,day,verifyReader:()=>true});
  if(data.markdown.length>FILE_LIMIT)throw new Error('Daily report exceeds bounded signed-file size.');
  const objectId='starling-daily-report:'+guildId+':'+day,old=await mesh.getObject(objectId);
  if(old&&(old.kind!==STARLING_REPORT_FILE_KIND||old.origin?.nodeId!==self
    ||(await mesh.validateObject(old))?.ok!==true))throw new Error('Report file revision authority conflict.');
  if(old?.payload?.markdown===data.markdown)return Object.freeze({changed:false,object:old});
  const object=await mesh.createObject({id:objectId,revision:(old?.revision||0)+1,
    kind:STARLING_REPORT_FILE_KIND,purpose:'Daily Starling Guild report Markdown file for synchronized Guildkeeper Pocket Nodes.',
    consent:'group',audience:['guild:'+guildId],publish:true,priority:70,
    payload:{schema:STARLING_REPORT_SCHEMA,guildId,day,filename:data.filename,
      markdown:data.markdown,eventCount:data.eventCount,updatedAt:new Date().toISOString()}});
  return Object.freeze({changed:true,object});
}
