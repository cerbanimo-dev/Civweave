// Canonical directory peer-report relay. Only copies a verified Guild DO's
// automatically executed vote receipt to registered neighbouring Guild inboxes.
const bad=(message,status=409)=>Object.assign(new Error(message),{status});
const clean=(v,n=220)=>String(v??'').trim().slice(0,n);
const clampLat=v=>Number.isFinite(Number(v))&&Math.abs(Number(v))<=90?Number(v):null;
const clampLon=v=>Number.isFinite(Number(v))&&Math.abs(Number(v))<=180?Number(v):null;
export function distanceKm(a,b){
  const aLat=clampLat(a?.latitude),aLon=clampLon(a?.longitude),bLat=clampLat(b?.latitude),bLon=clampLon(b?.longitude);
  if([aLat,aLon,bLat,bLon].some(v=>v===null))return Infinity;
  const r=Math.PI/180,dLat=(bLat-aLat)*r,dLon=(bLon-aLon)*r;
  const x=Math.sin(dLat/2)**2+Math.cos(aLat*r)*Math.cos(bLat*r)*Math.sin(dLon/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}
const parse=(v,f=null)=>{try{return JSON.parse(v)}catch{return f}};
const header={'cache-control':'no-store','content-type':'application/json; charset=utf-8','access-control-allow-origin':'*','access-control-allow-methods':'GET, POST, OPTIONS','access-control-allow-headers':'content-type'};
const json=(v,status=200)=>Response.json(v,{status,headers:header});
function originOf(value){
  const url=new URL(clean(value,2000));
  if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||
    /^(localhost|127\.|10\.|192\.168\.|172\.)/i.test(url.hostname)||!url.hostname.includes('.'))throw bad('Invalid public Guild origin.',400);
  return url.origin;
}
export async function deliverVerifiedGuildReport(env,{guildId,origin,ballotId},fetchImpl=globalThis.fetch){
  if(!env?.DB?.prepare)throw bad('Directory storage is unavailable.',503);
  if(!/^[A-Za-z0-9:_-]{1,120}$/.test(String(guildId||''))||
     !/^guild-vote:[0-9a-f-]{30,40}$/i.test(String(ballotId||'')))throw bad('Guild report metadata is invalid.',400);
  const sourceOrigin=originOf(origin);
  const source=await env.DB.prepare("SELECT node_id,public_origin,location_json FROM nodes WHERE node_id=? AND status='active' LIMIT 1").bind(guildId).first();
  if(!source||originOf(source.public_origin)!==sourceOrigin)throw bad('Reporting Guild is not an independently registered, active source.',403);
  const receiptUrl=new URL('/api/guild/governance/receipt',sourceOrigin);receiptUrl.searchParams.set('ballotId',ballotId);
  const response=await fetchImpl(receiptUrl,{headers:{accept:'application/json'},cache:'no-store',redirect:'error'});
  if(!response.ok)throw bad('Guild governance ballot receipt cannot be verified.',409);
  const payload=await response.json();
  const receipt=payload?.receipt;
  if(payload?.ok!==true||receipt?.schema!=='civweave.guild-peer-report.v1'||receipt.ballotId!==ballotId||
    receipt.guildId!==guildId||receipt.origin!==sourceOrigin||receipt.classification!=='community-approved-unverified-allegation'||
    !/^[a-f0-9]{64}$/.test(receipt.subjectPseudonym)||!['harassment','threats','fraud','impersonation','safety','repeated-disruption','other'].includes(receipt.reasonCode)||
    receipt.radiusKm!==25)throw bad('Reported receipt does not describe an approved, privacy-limited Guild vote.',403);
  const existing=await env.DB.prepare("SELECT COUNT(*) AS n FROM guild_peer_report_inbox WHERE source_guild_id=? AND report_id=?").bind(guildId,ballotId).first();
  if(Number(existing?.n||0)>0)return {ok:true,idempotent:true,reportId:ballotId,deliveredToNearbyGuilds:Number(existing.n)};
  const created=Date.parse(receipt.createdAt);
  if(!Number.isFinite(created)||Math.abs(Date.now()-created)>7*86400000)throw bad('Approved report has expired before relay.',410);
  // Fresh directory location is the only source of proximity. Do not accept
  // self-asserted positions in a broadcast request.
  const geo=parse(source.location_json);
  if(!geo||distanceKm(geo,geo)!==0)throw bad('Reporting Guild has no valid directory location.',409);
  const result=await env.DB.prepare("SELECT node_id,location_json FROM nodes WHERE status='active' AND node_id<>? ORDER BY updated_at DESC LIMIT 500").bind(guildId).all();
  const recipients=(result.results||[]).filter(row=>distanceKm(geo,parse(row.location_json))<=25).slice(0,80);
  const at=new Date().toISOString(),expiresAt=new Date(Date.now()+30*86400000).toISOString();
  if(recipients.length){
    const writes=recipients.map(row=>env.DB.prepare(
      "INSERT OR IGNORE INTO guild_peer_report_inbox(report_id,source_guild_id,recipient_guild_id,receipt_json,received_at,expires_at) VALUES(?,?,?,?,?,?)"
    ).bind(ballotId,guildId,row.node_id,JSON.stringify(receipt),at,expiresAt));
    await env.DB.batch(writes);
  }
  // A verified dispatch with zero nearby registered Guilds succeeds but is
  // explicitly labelled 0 recipients. No one is automatically banned.
  return {ok:true,reportId:ballotId,deliveredToNearbyGuilds:recipients.length,receiptType:receipt.classification};
}
export async function receivedGuildReports(env,guildId){
  if(!env?.DB?.prepare)throw bad('Directory storage is unavailable.',503);
  const rows=await env.DB.prepare("SELECT source_guild_id,receipt_json,received_at FROM guild_peer_report_inbox WHERE recipient_guild_id=? AND expires_at>? ORDER BY received_at DESC LIMIT 80")
    .bind(clean(guildId,120),new Date().toISOString()).all();
  return {ok:true,schema:'civweave.guild-peer-report-inbox.v1',guildId,reports:(rows.results||[]).map(row=>({
    sourceGuildId:row.source_guild_id,receivedAt:row.received_at,receipt:parse(row.receipt_json)
  })).filter(row=>row.receipt)};
}
export async function handleGuildPeerDirectoryRoute(request,env){
  const url=new URL(request.url);
  if(!['/api/guild-directory/report','/api/guild-directory/reports'].includes(url.pathname))return null;
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:header});
  try{
    if(url.pathname==='/api/guild-directory/report'&&request.method==='POST'){
      const body=await request.text();if(body.length>4096)return json({ok:false,error:'Request too large.'},413);
      return json(await deliverVerifiedGuildReport(env,JSON.parse(body)),201);
    }
    if(url.pathname==='/api/guild-directory/reports'&&request.method==='GET'){
      const guildId=clean(url.searchParams.get('guildId'),120);
      if(!/^[A-Za-z0-9:_-]{1,120}$/.test(guildId))return json({ok:false,error:'Guild ID required.'},400);
      return json(await receivedGuildReports(env,guildId));
    }
    return json({ok:false,error:'Method not allowed.'},405);
  }catch(error){return json({ok:false,error:String(error?.message||error)},Number.isSafeInteger(error?.status)?error.status:503)}
}
