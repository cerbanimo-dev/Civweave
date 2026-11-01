// Pure guild radio clock and bundle selection contract. The guild publishes
// this schedule; clients only resolve the current timestamp, never re-shuffle.
export const GUILD_RADIO_SCHEMA='civweave.guild-radio-schedule.v1';
const DAY_MS=86400000;
const stamp=ms=>new Date(ms).toISOString();
const hash=value=>{let n=2166136261;for(const char of String(value)){n=Math.imul(n^char.charCodeAt(0),16777619)}return n>>>0};
const prng=seed=>{let x=seed||0x9e3779b9;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296}};
const shuffle=(items,rng)=>{const out=[...items];for(let i=out.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[out[i],out[j]]=[out[j],out[i]]}return out};

export function buildGuildRadioSchedule({guildId,bundles,tracks,nowMs=Date.now()}={}){
 if(!/^[a-z0-9][a-z0-9-]{0,119}$/.test(String(guildId||'')))throw new TypeError('A normalized guild ID is required.');
 if(!Array.isArray(bundles)||!Array.isArray(tracks))throw new TypeError('A curated bundle corpus and exact track durations are required.');
 const available=new Map(tracks.filter(t=>typeof t?.id==='string'&&Number.isFinite(t.durationSeconds)&&t.durationSeconds>=30&&t.durationSeconds<=1800).map(t=>[t.id,t]));
 const valid=bundles.filter(b=>typeof b?.id==='string'&&Array.isArray(b.tracks)&&b.tracks.length>=1&&b.tracks.length<=12&&b.tracks.every(id=>available.has(id))&&typeof b.brief==='string'&&typeof b.discussion==='string');
 if(!valid.length)throw new TypeError('No playable, timed radio bundles are available.');
 const anchor=Math.floor(nowMs/DAY_MS)*DAY_MS,day=new Date(anchor).toISOString().slice(0,10);
 const random=prng(hash(guildId+'|'+day+'|guild-radio-v1'));
 let cursor=anchor,lastBundle='',sequence=0;const chunks=[];
 while(cursor<anchor+DAY_MS&&sequence<400){
  const choices=valid.length>1?valid.filter(b=>b.id!==lastBundle):valid;
  const bundle=choices[Math.floor(random()*choices.length)];
  const order=shuffle(bundle.tracks,random);
  const start=cursor,entries=[];
  for(const id of order){
   const durationSeconds=available.get(id).durationSeconds;
   const end=cursor+Math.round(durationSeconds*1000);
   entries.push({id,startAt:stamp(cursor),endAt:stamp(end),durationSeconds});
   cursor=end;
  }
  const id=day+'-'+String(sequence).padStart(3,'0');
  chunks.push({id,bundleId:bundle.id,title:bundle.title||bundle.id,startAt:stamp(start),endAt:stamp(cursor),brief:bundle.brief.slice(0,1200),discussion:bundle.discussion.slice(0,12000),tracks:entries});
  lastBundle=bundle.id;sequence++;
 }
 return {schema:GUILD_RADIO_SCHEMA,guildId,epoch:day,issuedAt:stamp(nowMs),expiresAt:stamp(anchor+DAY_MS),chunks};
}

export function guildRadioWindow(packet,nowMs=Date.now(),forwardMs=45*60000){
 const now=Number(nowMs)||Date.now(),limit=now+Math.min(2*3600000,Math.max(600000,forwardMs));
 const chunks=(packet?.chunks||[]).filter(chunk=>Date.parse(chunk.endAt)>now-600000&&Date.parse(chunk.startAt)<limit);
 return {...packet,chunks};
}

export function locateGuildRadioTrack(packet,nowMs=Date.now()){
 const moment=Number(nowMs);
 if(!Number.isFinite(moment))return null;
 for(const chunk of packet?.chunks||[]){
  const start=Date.parse(chunk.startAt),end=Date.parse(chunk.endAt);
  if(moment<start||moment>=end)continue;
  for(const track of chunk.tracks||[]){
   const begin=Date.parse(track.startAt),finish=Date.parse(track.endAt);
   if(moment>=begin&&moment<finish)return {chunk,track,offsetSeconds:(moment-begin)/1000,remainingSeconds:(finish-moment)/1000};
  }
 }
 return null;
}

export function validateGuildRadioSchedule(packet,{guildId,trackIds}={}){
 if(packet?.schema!==GUILD_RADIO_SCHEMA||packet.guildId!==guildId||!Array.isArray(packet.chunks)||packet.chunks.length<1||packet.chunks.length>400)return false;
 if(!Number.isFinite(Date.parse(packet.issuedAt))||!Number.isFinite(Date.parse(packet.expiresAt)))return false;
 const known=trackIds?new Set(trackIds):null;let previousChunkEnd=null;
 for(const chunk of packet.chunks){
  if(!chunk||typeof chunk.id!=='string'||typeof chunk.bundleId!=='string'||!Array.isArray(chunk.tracks)||chunk.tracks.length<1||chunk.tracks.length>12)return false;
  if(typeof chunk.brief!=='string'||typeof chunk.discussion!=='string'||chunk.brief.length>1200||chunk.discussion.length>12000)return false;
  const start=Date.parse(chunk.startAt),end=Date.parse(chunk.endAt);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||previousChunkEnd!==null&&previousChunkEnd!==start)return false;
  let last=start;
  for(const track of chunk.tracks){
   if(!track||typeof track.id!=='string'||known&&!known.has(track.id))return false;
   const from=Date.parse(track.startAt),to=Date.parse(track.endAt),duration=Number(track.durationSeconds);
   if(!Number.isFinite(from)||!Number.isFinite(to)||from!==last||to<=from||duration<30||duration>1800||Math.abs((to-from)/1000-duration)>0.01)return false;
   last=to;
  }
  if(last!==end)return false;previousChunkEnd=end;
 }
 return true;
}
