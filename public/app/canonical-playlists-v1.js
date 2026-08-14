(()=>{
'use strict';
if(globalThis.CivweaveCanonicalPlaylistsV1)return;

const VERSION='1.0.0';
const SCHEMA='civweave.canonical-playlists.v1';
const PROPOSAL_SCHEMA='civweave.canonical-playlist-proposal.v1';
const TRACK_SCHEMA='civweave.canonical-track.v1';
const STORE_KEY='civweave.canonical-playlists.v1';
const CHANNEL='civweave.canonical-playlists.v1';
const OPEN_MUSIC_BATCH='/downloads/hub-media/open-music/daily-batch.json';
const OPEN_MUSIC_MANIFEST='/downloads/hub-media/open-music/lazy-manifest.json';
const ALLOWED_OPEN_LICENSES=new Set(['PUBLIC-DOMAIN','CC0','CC-BY','CC-BY-SA']);
const PROVIDERS=['spotify','appleMusic','youtubeMusic','youtube','bandcamp','soundcloud','tidal','deezer'];
const PLAYLISTS=Object.freeze({
  anarchadia:Object.freeze({id:'anarchadia',label:'Anarchadia',spotifyPlaylistId:'2AsCLZiAPlUYHOcogllTia'}),
  cerbanimo:Object.freeze({id:'cerbanimo',label:'Cerbanimo',spotifyPlaylistId:'1CB3LLMSnuDwD013B1ZY3M'}),
  'living-school':Object.freeze({id:'living-school',label:'Living School',spotifyPlaylistId:'2MwmQdjHyRBIu8Wy9iXWUm'}),
  fellowfare:Object.freeze({id:'fellowfare',label:'FellowFare',spotifyPlaylistId:'1q6YDYRU6hekl2MkHkI2X3'}),
  civweave:Object.freeze({id:'civweave',label:'Civweave',spotifyPlaylistId:'2BLWIhSfHdbcfG5rP8IqoX'})
});
const clean=(value,max=4000)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
const copy=value=>globalThis.structuredClone?structuredClone(value):JSON.parse(JSON.stringify(value));
const uid=prefix=>`${prefix}:${globalThis.crypto?.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
const now=()=>new Date().toISOString();
const clamp01=value=>Math.max(0,Math.min(1,Number(value)||0));
const integer=(value,max=86400)=>{const n=Math.round(Number(value)||0);return Math.max(0,Math.min(max,n))};
function parse(raw,fallback){try{return JSON.parse(raw)??fallback}catch{return fallback}}
function spotifyTrackId(value){
  const raw=clean(value,1000);if(!raw)return'';
  const uri=raw.match(/^spotify:track:([A-Za-z0-9]{22})$/i);if(uri)return uri[1];
  const url=raw.match(/open\.spotify\.com\/track\/([A-Za-z0-9]{22})/i);if(url)return url[1];
  return /^[A-Za-z0-9]{22}$/.test(raw)?raw:'';
}
function spotifyTrackUrl(value){const id=spotifyTrackId(value);return id?`https://open.spotify.com/track/${id}`:''}
function normalizedProviderLinks(input={}){
  const links={};
  for(const provider of PROVIDERS){
    const raw=clean(input?.[provider]||input?.[`${provider}Url`]||'',1800);
    if(raw)links[provider]=raw;
  }
  const spotify=spotifyTrackUrl(links.spotify||input.spotify||input.spotifyUrl||input.spotifyTrackId);
  if(spotify)links.spotify=spotify;
  return links;
}
function trustedCerbanimoSource(source={}){
  return clean(source.system,80).toLowerCase()==='cerbanimo' && Boolean(source.firstPartyProvenance) && Boolean(source.creatorRightsGrant);
}
function normalizeLicense(input={}){
  const id=clean(input.spdx||input.id||input.license,80).toUpperCase();
  return {id,label:clean(input.label||id,160),url:clean(input.url||input.licenseUrl,1200),evidence:clean(input.evidence,1600),redistributionAllowed:ALLOWED_OPEN_LICENSES.has(id)};
}
function normalizeTrack(input={},source={}){
  const links=normalizedProviderLinks(input.providerLinks||input.links||input);
  const spotifyId=spotifyTrackId(links.spotify||input.spotifyTrackId||input.spotifyUrl);
  const firstParty=trustedCerbanimoSource(source);
  if(!spotifyId&&!firstParty)throw new TypeError('A Spotify track link is required for playlist nominations outside the trusted Cerbanimo creator lane.');
  const title=clean(input.title,240),artist=clean(input.artist||input.primaryArtist,240);
  if(!title||!artist)throw new TypeError('Track title and primary artist are required.');
  const isrc=clean(input.isrc,32).toUpperCase().replace(/[^A-Z0-9]/g,'');
  const durationSeconds=integer(input.durationSeconds||input.duration_seconds,7200);
  const identityKey=isrc?`isrc:${isrc}`:(spotifyId?`spotify:${spotifyId}`:`cerbanimo:${clean(source.artifactHash||source.sourceId||`${artist}:${title}`,320).toLowerCase()}`);
  return {
    schema:TRACK_SCHEMA,
    identityKey,
    title,
    artist,
    album:clean(input.album,240),
    isrc,
    durationSeconds,
    explicit:Boolean(input.explicit),
    spotifyTrackId:spotifyId,
    spotifyPending:!spotifyId&&firstParty,
    providerLinks:links,
    providerMappings:Array.isArray(input.providerMappings)?input.providerMappings.map(row=>({provider:clean(row.provider,80),url:clean(row.url,1800),providerId:clean(row.providerId,300),confidence:clamp01(row.confidence),provenance:clean(row.provenance,120)})).filter(row=>row.provider&&row.url):[],
    createdAt:now()
  };
}
function blankState(){return{schema:SCHEMA,version:1,tracks:{},proposals:[],approvedEvents:[],syncReceipts:[],openMusicCandidates:[],updatedAt:now()}}
function readState(){
  const raw=parse(globalThis.localStorage?.getItem?.(STORE_KEY)||'',null);
  if(!raw||raw.schema!==SCHEMA)return blankState();
  return {...blankState(),...raw,tracks:raw.tracks&&typeof raw.tracks==='object'?raw.tracks:{},proposals:Array.isArray(raw.proposals)?raw.proposals:[],approvedEvents:Array.isArray(raw.approvedEvents)?raw.approvedEvents:[],syncReceipts:Array.isArray(raw.syncReceipts)?raw.syncReceipts:[],openMusicCandidates:Array.isArray(raw.openMusicCandidates)?raw.openMusicCandidates:[]};
}
let state=readState();
let channel=null;try{channel=typeof BroadcastChannel==='function'?new BroadcastChannel(CHANNEL):null}catch{}
function announce(type,detail){const safe=copy(detail);try{globalThis.dispatchEvent?.(new CustomEvent(type,{detail:safe}))}catch{}try{channel?.postMessage?.({type,detail:safe,at:now()})}catch{}}
function writeState(reason='update'){
  state.updatedAt=now();
  state.proposals=state.proposals.slice(-1500);state.approvedEvents=state.approvedEvents.slice(-1500);state.syncReceipts=state.syncReceipts.slice(-3000);state.openMusicCandidates=state.openMusicCandidates.slice(-2000);
  try{globalThis.localStorage?.setItem?.(STORE_KEY,JSON.stringify(state))}catch{}
  announce('civweave:canonical-playlists:changed',{reason,state:copy(state)});return state;
}
function activeElectorate(input=[]){
  const direct=Array.isArray(input)?input:[];
  const inferred=direct.length?direct:(globalThis.CivweaveActiveMeshElectorate?.members?.()||[]);
  return [...new Set(inferred.map(row=>clean(typeof row==='string'?row:row?.actorId||row?.id,220)).filter(Boolean))].slice(0,10000);
}
function playlist(value){const id=clean(value,80).toLowerCase().replace('_','-');const found=PLAYLISTS[id];if(!found)throw new RangeError(`Unknown canonical playlist: ${value}`);return found}
function registerTrack(track){state.tracks[track.identityKey]={...(state.tracks[track.identityKey]||{}),...track,providerLinks:{...(state.tracks[track.identityKey]?.providerLinks||{}),...(track.providerLinks||{})}};return state.tracks[track.identityKey]}
function proposalPayload(input={},options={}){
  const target=playlist(input.playlistId||input.playlist);
  const source=input.source&&typeof input.source==='object'?copy(input.source):{};
  const track=normalizeTrack(input.track||input,source);
  const action=clean(input.action||'add',20).toLowerCase();if(!['add','remove'].includes(action))throw new TypeError('Playlist proposal action must be add or remove.');
  const electorate=activeElectorate(options.electorate||input.electorate||[]);
  const quorum=clamp01(options.quorum??input.quorum??0.5),threshold=clamp01(options.threshold??input.threshold??0.5);
  const trusted=trustedCerbanimoSource(source);
  return {
    schema:PROPOSAL_SCHEMA,id:uid('playlistProposal'),action,playlistId:target.id,playlistLabel:target.label,spotifyPlaylistId:target.spotifyPlaylistId,
    track:copy(track),source:{system:clean(source.system||'user',80),sourceId:clean(source.sourceId||source.artifactId,240),artifactHash:clean(source.artifactHash,220),firstPartyProvenance:Boolean(source.firstPartyProvenance),creatorRightsGrant:Boolean(source.creatorRightsGrant),qualityGate:trusted?'cerbanimo-first-party':'spotify-catalog-anchor'},
    rationale:clean(input.rationale,1200),
    governance:{system:'anarchadia',scope:'mesh-wide',electorateMode:'recently-active-eligible',electorateSnapshot:electorate,quorum,threshold},
    votes:[],status:electorate.length?'voting':'awaiting-electorate',createdAt:now(),updatedAt:now(),approvedAt:null,rejectedAt:null
  };
}
function createProposal(input={},options={}){
  const proposal=proposalPayload(input,options);registerTrack(proposal.track);
  const duplicate=state.proposals.find(row=>['voting','awaiting-electorate','approved'].includes(row.status)&&row.action===proposal.action&&row.playlistId===proposal.playlistId&&row.track?.identityKey===proposal.track.identityKey);
  if(duplicate)return copy(duplicate);
  state.proposals.push(proposal);writeState('proposal-created');
  announce('civweave:anarchadia-playlist-proposal',{proposal:copy(proposal)});
  return copy(proposal);
}
function setElectorate(proposalId,members=[]){
  const proposal=state.proposals.find(row=>row.id===proposalId);if(!proposal)throw new Error('Playlist proposal not found.');if(proposal.votes.length)throw new Error('Electorate snapshot cannot change after voting begins.');
  proposal.governance.electorateSnapshot=activeElectorate(members);proposal.status=proposal.governance.electorateSnapshot.length?'voting':'awaiting-electorate';proposal.updatedAt=now();writeState('electorate-snapshotted');return copy(proposal);
}
function tallyProposal(proposal){
  const electorate=new Set(proposal.governance?.electorateSnapshot||[]),valid=(proposal.votes||[]).filter(v=>electorate.has(v.actorId));
  const totals={approve:0,reject:0,abstain:0};for(const vote of valid)if(totals[vote.choice]!==undefined)totals[vote.choice]++;
  const eligible=electorate.size,cast=valid.length,decisive=totals.approve+totals.reject,participation=eligible?cast/eligible:0,approval=decisive?totals.approve/decisive:0;
  return {eligible,cast,decisive,participation,approval,totals,quorumMet:eligible>0&&participation>=Number(proposal.governance?.quorum||0),thresholdMet:decisive>0&&approval>=Number(proposal.governance?.threshold||0)};
}
function enqueueApproved(proposal){
  const key=`${proposal.action}:${proposal.playlistId}:${proposal.track.identityKey}:${proposal.id}`;
  if(state.approvedEvents.some(row=>row.key===key))return;
  state.approvedEvents.push({schema:'civweave.canonical-playlist-approved-event.v1',id:uid('playlistApproval'),key,proposalId:proposal.id,action:proposal.action,playlistId:proposal.playlistId,spotifyPlaylistId:proposal.spotifyPlaylistId,trackIdentityKey:proposal.track.identityKey,track:copy(state.tracks[proposal.track.identityKey]||proposal.track),approvedAt:proposal.approvedAt||now(),syncState:'pending',syncAttempts:0,lastError:''});
  announce('civweave:canonical-playlists:approved',{proposal:copy(proposal),event:copy(state.approvedEvents.at(-1))});
}
function castVote(proposalId,actorId,choice){
  const proposal=state.proposals.find(row=>row.id===proposalId);if(!proposal)throw new Error('Playlist proposal not found.');if(!['voting','awaiting-electorate'].includes(proposal.status))throw new Error('Playlist proposal is not open for voting.');
  const actor=clean(actorId,220),decision=clean(choice,20).toLowerCase();if(!['approve','reject','abstain'].includes(decision))throw new TypeError('Vote must be approve, reject, or abstain.');
  if(!(proposal.governance.electorateSnapshot||[]).includes(actor))throw new Error('Actor is not in the frozen active electorate snapshot.');
  proposal.votes=(proposal.votes||[]).filter(row=>row.actorId!==actor);proposal.votes.push({actorId:actor,choice:decision,castAt:now()});proposal.updatedAt=now();
  const tally=tallyProposal(proposal);
  if(tally.quorumMet&&tally.decisive>0){if(tally.thresholdMet){proposal.status='approved';proposal.approvedAt=now();enqueueApproved(proposal)}else{proposal.status='rejected';proposal.rejectedAt=now()}}
  writeState('vote-cast');return{proposal:copy(proposal),tally};
}
function pendingSync(){return copy(state.approvedEvents.filter(row=>row.syncState!=='synced'))}
function markSynced(eventId,receipt={}){const event=state.approvedEvents.find(row=>row.id===eventId);if(!event)throw new Error('Approved playlist event not found.');event.syncState='synced';event.syncedAt=now();event.lastError='';state.syncReceipts.push({schema:'civweave.canonical-playlist-sync-receipt.v1',eventId,at:event.syncedAt,...copy(receipt)});writeState('sync-receipt');return copy(event)}
function markSyncFailure(eventId,error=''){const event=state.approvedEvents.find(row=>row.id===eventId);if(!event)throw new Error('Approved playlist event not found.');event.syncAttempts=Number(event.syncAttempts||0)+1;event.syncState='retry';event.lastError=clean(error,1000);event.lastAttemptAt=now();writeState('sync-failed');return copy(event)}
function attachProviderMapping(identityKey,mapping={}){
  const track=state.tracks[identityKey];if(!track)throw new Error('Canonical track not found.');const provider=clean(mapping.provider,80),url=clean(mapping.url,1800);if(!provider||!url)throw new TypeError('Provider mapping requires provider and URL.');
  const row={provider,url,providerId:clean(mapping.providerId,300),confidence:clamp01(mapping.confidence??1),provenance:clean(mapping.provenance||'daily-enrichment',120),matchedAt:now()};
  track.providerMappings=(track.providerMappings||[]).filter(item=>item.provider!==provider);track.providerMappings.push(row);track.providerLinks={...(track.providerLinks||{}),[provider]:url};if(provider==='spotify'){track.spotifyTrackId=spotifyTrackId(url);track.spotifyPending=!track.spotifyTrackId}writeState('provider-mapping');return copy(track);
}
function nominateCerbanimoTrack(input={},options={}){
  const source={...(input.source||{}),system:'cerbanimo',firstPartyProvenance:true,creatorRightsGrant:Boolean(input.source?.creatorRightsGrant??input.creatorRightsGrant),artifactHash:input.source?.artifactHash||input.artifactHash,sourceId:input.source?.sourceId||input.sourceId};
  if(!source.creatorRightsGrant)throw new Error('Cerbanimo creator must explicitly grant the rights needed for the nominated distribution.');
  return createProposal({...input,source},{...options});
}
function validateOpenCandidate(candidate){
  const license=normalizeLicense(candidate.license||{});if(!license.redistributionAllowed)return{ok:false,reason:'license-not-allowed'};
  const files=Array.isArray(candidate.files)?candidate.files.filter(row=>clean(row?.url,1800)):[];if(!files.length)return{ok:false,reason:'no-download'};
  if(!clean(candidate.source_url||candidate.sourceUrl,1800)||!clean(license.evidence,1600))return{ok:false,reason:'missing-rights-evidence'};
  return{ok:true,license,files};
}
function ingestOpenMusicBatch(batch={}){
  if(batch?.schema!=='civweave.open-music-daily-batch.v1'||!Array.isArray(batch.candidates))throw new TypeError('Invalid Civweave open-music daily batch.');let accepted=0,rejected=0;
  for(const candidate of batch.candidates){const check=validateOpenCandidate(candidate);if(!check.ok){rejected++;continue}const key=clean(candidate.candidate_id||candidate.identity_key||`${candidate.provider}:${candidate.provider_id}`,300);if(!key){rejected++;continue}const row={...copy(candidate),candidate_id:key,license:check.license,files:check.files,ingestedAt:now()};const index=state.openMusicCandidates.findIndex(item=>item.candidate_id===key);if(index>=0)state.openMusicCandidates[index]=row;else state.openMusicCandidates.push(row);accepted++}
  writeState('open-music-batch-ingested');return{accepted,rejected};
}
async function loadOpenMusicBatch(){const response=await fetch(OPEN_MUSIC_BATCH,{cache:'no-store'});if(!response.ok)throw new Error(`Open music batch returned ${response.status}.`);const batch=await response.json();return{batch,result:ingestOpenMusicBatch(batch)}}
async function loadLazyManifest(){const response=await fetch(OPEN_MUSIC_MANIFEST,{cache:'force-cache'});if(!response.ok)throw new Error(`Open music manifest returned ${response.status}.`);const manifest=await response.json();if(manifest?.schema!=='civweave.open-music-lazy-manifest.v1')throw new Error('Open music manifest schema is invalid.');return manifest}
function exportQueue(){return{schema:'civweave.canonical-playlist-sync-queue.v1',exportedAt:now(),events:pendingSync()}}
function read(){return copy(state)}
const api=Object.freeze({version:VERSION,schema:SCHEMA,storeKey:STORE_KEY,playlists:PLAYLISTS,providerKeys:Object.freeze(PROVIDERS.slice()),allowedOpenLicenses:Object.freeze([...ALLOWED_OPEN_LICENSES]),spotifyTrackId,spotifyTrackUrl,normalizeTrack,normalizeLicense,validateOpenCandidate,createProposal,nominateCerbanimoTrack,setElectorate,castVote,tallyProposal,pendingSync,markSynced,markSyncFailure,attachProviderMapping,ingestOpenMusicBatch,loadOpenMusicBatch,loadLazyManifest,exportQueue,read});
globalThis.CivweaveCanonicalPlaylistsV1=api;
announce('civweave:canonical-playlists:ready',{version:VERSION,playlists:Object.keys(PLAYLISTS),spotifyRequiredForStandardNominations:true,cerbanimoTrustedCreatorLane:true,governance:'anarchadia-mesh-wide'});
})();
