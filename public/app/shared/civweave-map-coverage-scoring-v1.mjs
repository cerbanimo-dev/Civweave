const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));
const finite=value=>Number.isFinite(Number(value))?Number(value):null;

export function normalizeBbox(value){
  if(!Array.isArray(value)||value.length!==4)return null;
  const box=value.map(finite);
  if(box.some(v=>v==null)||box[0]>box[2]||box[1]>box[3]||box[0]<-180||box[2]>180||box[1]<-90||box[3]>90)return null;
  return box;
}

export function bboxArea(value){
  const box=normalizeBbox(value);if(!box)return 0;
  return Math.max(0,box[2]-box[0])*Math.max(0,box[3]-box[1]);
}

export function intersectionBbox(a,b){
  const left=normalizeBbox(a),right=normalizeBbox(b);if(!left||!right)return null;
  const box=[Math.max(left[0],right[0]),Math.max(left[1],right[1]),Math.min(left[2],right[2]),Math.min(left[3],right[3])];
  return box[0]<box[2]&&box[1]<box[3]?box:null;
}

export function coverageRatio(needBbox,packBbox){
  const area=bboxArea(needBbox);if(!area)return 0;
  return clamp(bboxArea(intersectionBbox(needBbox,packBbox))/area);
}

export function zoomCoverage(need={},pack={}){
  const wantedMin=finite(need.minZoom)??0,wantedMax=finite(need.maxZoom)??wantedMin;
  const packMin=finite(pack.minZoom)??0,packMax=finite(pack.maxZoom)??24;
  if(packMax<wantedMin||packMin>wantedMax)return 0;
  const span=Math.max(1,wantedMax-wantedMin+1);
  const overlap=Math.max(0,Math.min(wantedMax,packMax)-Math.max(wantedMin,packMin)+1);
  return clamp(overlap/span);
}

function freshnessScore(pack){
  const timestamp=Date.parse(pack.generatedAt||pack.receivedAt||0);if(!Number.isFinite(timestamp)||timestamp<=0)return 4;
  const ageDays=Math.max(0,(Date.now()-timestamp)/86400000);
  return clamp(1-ageDays/120)*15;
}

function trustScore(pack,telemetry){
  if(telemetry.trusted===true)return 10;
  if(pack.originFingerprint)return 7;
  if(pack.originNodeId)return 5;
  return 2;
}

function sizeScore(pack,maxBytes){
  const bytes=Math.max(0,finite(pack.bytes)||0);if(!bytes)return 2;
  if(maxBytes>0)return clamp(1-bytes/maxBytes)*10;
  return clamp(1-bytes/(256*1024*1024))*8;
}

function latencyScore(telemetry){
  const latency=finite(telemetry.latencyMs);if(latency==null||latency<0)return 2.5;
  return clamp(1-latency/3000)*5;
}

export function scorePack(need={},pack={},telemetry={}){
  const formats=new Set((need.formats||['pmtiles']).map(value=>String(value).toLowerCase()));
  const format=String(pack.format||'').toLowerCase();
  const coverage=coverageRatio(need.bbox,pack.bbox);
  const zoom=zoomCoverage(need,pack);
  const bytes=Math.max(0,finite(pack.bytes)||0);
  const maxBytes=Math.max(0,finite(need.maxBytes)||0);
  const hashOk=/^[a-f0-9]{64}$/i.test(String(pack.sha256||''));
  const reasons=[];
  if(!formats.has(format))reasons.push('format');
  if(coverage<0.6)reasons.push('coverage');
  if(zoom<1)reasons.push('zoom');
  if(!hashOk)reasons.push('hash');
  if(maxBytes>0&&(!bytes||bytes>maxBytes))reasons.push('budget');
  const eligible=reasons.length===0;
  const score=coverage*45+zoom*15+freshnessScore(pack)+trustScore(pack,telemetry)+sizeScore(pack,maxBytes)+latencyScore(telemetry);
  return {pack,eligible,score:Math.round(score*100)/100,coverage,zoom,reasons};
}

export function rankPacks(need,packs=[],telemetryByPack={}){
  return (Array.isArray(packs)?packs:[]).map(pack=>scorePack(need,pack,telemetryByPack[pack.packId]||telemetryByPack[pack.originNodeId]||{})).sort((a,b)=>Number(b.eligible)-Number(a.eligible)||b.score-a.score||String(a.pack?.packId||'').localeCompare(String(b.pack?.packId||'')));
}

export function cachedPackSatisfies(need,pack){
  return Boolean(pack?.cachedAt)&&coverageRatio(need?.bbox,pack?.bbox)>=0.95&&zoomCoverage(need,pack)>=1;
}
