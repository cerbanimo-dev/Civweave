// Shared, deterministic Guild onboarding rewards; no authority is held in the UI.
export const INITIAL_GUILD_SLOTS=5;
export const MAX_GUILD_SLOTS=10;
export const GUILD_MILESTONES=Object.freeze([
  'Physical server connected to Guild Cloud',
  'Nearby server confirmed through a resident community check-in',
  'Server identity and secure heartbeat verified',
  'Mesh synchronization and recovery verified',
  'Final server health and configuration verified'
]);
export function normalizedStage(value){
  return Math.max(0,Math.min(GUILD_MILESTONES.length,Number.isFinite(Number(value))?Math.floor(Number(value)):0));
}
export function capacityForStage(stage){return INITIAL_GUILD_SLOTS+normalizedStage(stage)}
export function progressForStage(stage){return normalizedStage(stage)*20}
export function nearPinnedLocation(pin,position,{now=Date.now(),maxRadiusMeters=500,maxAccuracyMeters=250}={}){
  const lat=Number(position?.latitude),lon=Number(position?.longitude);
  const pLat=Number(pin?.latitude),pLon=Number(pin?.longitude),accuracy=Number(position?.accuracyMeters);
  const capturedAt=Date.parse(String(position?.capturedAt||''));
  if(![lat,lon,pLat,pLon,accuracy].every(Number.isFinite)||Math.abs(lat)>90||Math.abs(pLat)>90||Math.abs(lon)>180||Math.abs(pLon)>180)
    return {ok:false,reason:'invalid-coordinates'};
  if(accuracy<=0||accuracy>maxAccuracyMeters)return {ok:false,reason:'insufficient-accuracy'};
  if(!Number.isFinite(capturedAt)||Math.abs(now-capturedAt)>10*60*1000)return {ok:false,reason:'stale-location'};
  const radians=n=>n*Math.PI/180,dLat=radians(lat-pLat),dLon=radians(lon-pLon);
  const a=Math.sin(dLat/2)**2+Math.cos(radians(pLat))*Math.cos(radians(lat))*Math.sin(dLon/2)**2;
  const distanceMeters=6371000*2*Math.asin(Math.min(1,Math.sqrt(a)));
  return {ok:distanceMeters+accuracy<=maxRadiusMeters,reason:distanceMeters+accuracy<=maxRadiusMeters?'nearby':'outside-guild-radius',distanceMeters:Math.round(distanceMeters),radiusMeters:maxRadiusMeters};
}
