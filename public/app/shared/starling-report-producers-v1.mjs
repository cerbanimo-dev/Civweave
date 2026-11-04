/**
 * Guildkeeper-owned authorization for signed Starling report *metadata*.
 * A grant never authorizes inference, task claims, spending, model tool use,
 * Guild membership, or other activity beyond a narrowly scoped report source.
 */
export const STARLING_REPORT_PRODUCER_GRANT_KIND='civweave.starling-report-producer-grant.v1';
export const STARLING_REPORT_PRODUCER_GRANT_SCHEMA='civweave.starling-report-producer-grant.v1';
const safeGuild=value=>typeof value==='string'&&/^[A-Za-z0-9:_-]{1,180}$/.test(value);
const safeDevice=value=>typeof value==='string'&&/^[A-Za-z0-9:_-]{6,220}$/.test(value);
const sources=new Set(['cloud-ai','community-local','trusted-tool']);
const MAX_DURATION_DAYS=30;
const key=(guildId,deviceId)=>'starling-report-producer:'+guildId+':'+deviceId;
const isFiniteIso=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const validGrant=(row,guildId,foundingId)=>{
  const p=row?.payload;
  return row?.kind===STARLING_REPORT_PRODUCER_GRANT_KIND
    &&row?.consent==='group'
    &&Array.isArray(row?.audience)&&row.audience.includes('guild:'+guildId)
    &&row.origin?.nodeId===foundingId
    &&p?.schema===STARLING_REPORT_PRODUCER_GRANT_SCHEMA
    &&p.guildId===guildId&&safeDevice(p.deviceId)
    &&row.id===key(guildId,p.deviceId)
    &&typeof p.enabled==='boolean'
    &&sources.has(p.source)
    &&isFiniteIso(p.issuedAt)&&isFiniteIso(p.expiresAt)
    &&Date.parse(p.expiresAt)>Date.parse(p.issuedAt)
    &&Date.parse(p.expiresAt)-Date.parse(p.issuedAt)<=MAX_DURATION_DAYS*86400000
    &&Number.isSafeInteger(row.revision)&&row.revision>=1;
};
async function genesis(mesh,guildId){
  if(!safeGuild(guildId))throw new TypeError('Valid Guild ID required.');
  if(!mesh?.getObject||!mesh?.validateObject)throw new TypeError('Canonical signed Guild mesh required.');
  const row=await mesh.getObject('guild-genesis:'+guildId);
  if(row?.kind!=='civweave.guild-genesis.v1'||row.payload?.guildId!==guildId
    ||row.payload?.foundingDeviceId!==row.origin?.nodeId
    ||(await mesh.validateObject(row))?.ok!==true)throw new Error('Signed Guild genesis required.');
  return row;
}
async function readGrant(mesh,guildId,deviceId,foundingId){
  if(!safeDevice(deviceId))return null;
  const row=await mesh.getObject(key(guildId,deviceId));
  if(!row)return null;
  if(!validGrant(row,guildId,foundingId)||(await mesh.validateObject(row))?.ok!==true)return null;
  return row;
}
function requireOwner(owner,guildId,foundingId,self){
  if(owner?.guildId!==guildId||owner.deviceId!==self||self!==foundingId)
    throw new Error('Only the Guild founding device may issue or revoke report producer grants.');
}
/** Do not pass this verifier to general model/tool authorization owners. */
export function createStarlingReportProducerVerifier({mesh,guildId,now=()=>Date.now()}={}){
  if(!safeGuild(guildId))throw new TypeError('Valid Guild required.');
  return async ({guildId:requested,deviceId,source,at}={})=>{
    if(requested!==guildId||!safeDevice(deviceId)||!sources.has(source))return false;
    const founding=await genesis(mesh,guildId);
    // Founding-device reports are already verified by the report reader itself.
    // Cloud/community producer claims must use an independently authorized ID.
    if(deviceId===founding.origin.nodeId)return false;
    const row=await readGrant(mesh,guildId,deviceId,founding.origin.nodeId);
    if(!row?.payload?.enabled||row.payload.source!==source)return false;
    if(Date.parse(row.payload.expiresAt)<=now())return false;
    // Prevent a newly enrolled device from backdating a pre-grant report.
    // Allow two minutes of clock drift in globally signed event timestamps.
    if(at&&(!isFiniteIso(at)||Date.parse(at)<Date.parse(row.payload.issuedAt)-120000
      ||Date.parse(at)>Date.parse(row.payload.expiresAt)+120000))return false;
    return true;
  };
}
export function createStarlingReportProducerRegistry({mesh,founder,now=()=>Date.now()}={}){
  if(!mesh?.deviceId||!mesh?.createObject||typeof founder!=='function')
    throw new TypeError('Canonical Guild mesh and founding-device owner required.');
  async function issue({guildId,deviceId,source,days=7,confirmConsent}={}){
    const founding=await genesis(mesh,guildId),self=await mesh.deviceId();
    requireOwner(founder(),guildId,founding.origin.nodeId,self);
    if(!safeDevice(deviceId)||deviceId===self||!sources.has(source)
      ||!Number.isInteger(days)||days<1||days>MAX_DURATION_DAYS)throw new TypeError('Valid independent host, source, and duration required.');
    if(typeof confirmConsent!=='function'||confirmConsent({guildId,deviceId,source,days})!==true)
      throw new Error('Explicit Guildkeeper approval is required to trust a report producer.');
    const previous=await mesh.getObject(key(guildId,deviceId));
    if(previous&&(!validGrant(previous,guildId,self)||(await mesh.validateObject(previous))?.ok!==true))
      throw new Error('Conflicting report producer grant cannot be overwritten.');
    const issuedAt=new Date(now()).toISOString(),expiresAt=new Date(now()+days*86400000).toISOString();
    const row=await mesh.createObject({
      id:key(guildId,deviceId),revision:(previous?.revision||0)+1,kind:STARLING_REPORT_PRODUCER_GRANT_KIND,
      purpose:'Guildkeeper authorized this signed device to publish bounded Starling report metadata only.',
      consent:'group',audience:['guild:'+guildId],publish:true,priority:90,
      payload:{schema:STARLING_REPORT_PRODUCER_GRANT_SCHEMA,guildId,deviceId,source,enabled:true,issuedAt,expiresAt}
    });
    return row.payload;
  }
  async function revoke({guildId,deviceId}={}){
    const founding=await genesis(mesh,guildId),self=await mesh.deviceId();
    requireOwner(founder(),guildId,founding.origin.nodeId,self);
    const prior=await readGrant(mesh,guildId,deviceId,self);
    if(!prior)throw new Error('No valid trusted report producer grant exists.');
    if(!prior.payload.enabled)return prior.payload;
    const revokedAt=new Date(now()).toISOString();
    const row=await mesh.createObject({
      id:key(guildId,deviceId),revision:prior.revision+1,kind:STARLING_REPORT_PRODUCER_GRANT_KIND,
      purpose:'Guildkeeper revoked report-only signing permissions for this host.',
      consent:'group',audience:['guild:'+guildId],publish:true,priority:95,
      payload:{...prior.payload,enabled:false,revokedAt}
    });
    return row.payload;
  }
  async function list({guildId,verifyReader}={}){
    const founding=await genesis(mesh,guildId);
    if(typeof verifyReader!=='function'||await verifyReader(guildId)!==true)
      throw new Error('Guild reader authorization required to inspect report hosts.');
    const records=await mesh.listObjects(),grants=[];
    for(const row of records){
      if(!validGrant(row,guildId,founding.origin.nodeId))continue;
      if((await mesh.validateObject(row))?.ok===true)
        grants.push(Object.freeze({...row.payload,revision:row.revision,expired:Date.parse(row.payload.expiresAt)<=now()}));
    }
    return Object.freeze(grants.sort((a,b)=>a.deviceId.localeCompare(b.deviceId)));
  }
  return Object.freeze({issue,revoke,list});
}
