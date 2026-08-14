import fs from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=await fs.readFile(path.join(ROOT,'public/app/canonical-playlists-v1.js'),'utf8');
const store=new Map();
class LocalStorage{getItem(k){return store.has(k)?store.get(k):null}setItem(k,v){store.set(k,String(v))}removeItem(k){store.delete(k)}}
class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail}}
const context={console,crypto:webcrypto,structuredClone,localStorage:new LocalStorage(),CustomEvent,dispatchEvent(){return true},BroadcastChannel:undefined,fetch:async()=>{throw new Error('network disabled in verifier')}};
context.globalThis=context;vm.createContext(context);vm.runInContext(source,context,{filename:'canonical-playlists-v1.js'});
const api=context.CivweaveCanonicalPlaylistsV1;
if(!api)throw new Error('Canonical playlist API did not boot.');
let blocked=false;try{api.createProposal({playlistId:'civweave',title:'No Anchor',artist:'Test Artist'},{electorate:['p1']})}catch{blocked=true}
if(!blocked)throw new Error('Ordinary nominations must require a Spotify anchor.');
const proposal=api.createProposal({playlistId:'civweave',title:'A Track',artist:'Artist',spotify:'https://open.spotify.com/track/1234567890123456789012'},{electorate:['p1','p2','p3','p4']});
if(proposal.status!=='voting')throw new Error('Expected a frozen electorate voting proposal.');
api.castVote(proposal.id,'p1','approve');const result=api.castVote(proposal.id,'p2','approve');
if(result.proposal.status!=='approved'||api.pendingSync().length!==1)throw new Error('Quorum approval must enqueue one idempotent sync event.');
const native=api.nominateCerbanimoTrack({playlistId:'cerbanimo',title:'Born Here',artist:'Local Artist',creatorRightsGrant:true,sourceId:'artifact-1',artifactHash:'sha256:abc'},{electorate:['p1','p2']});
if(!native.track.spotifyPending)throw new Error('Trusted Cerbanimo creator lane should allow pre-Spotify nomination.');
const good={license:{spdx:'CC-BY',label:'CC BY',evidence:'explicit source license'},source_url:'https://example.test/source',files:[{url:'https://example.test/audio.ogg'}]};
if(!api.validateOpenCandidate(good).ok)throw new Error('Rights-cleared open track should pass.');
const bad={...good,license:{spdx:'CC-BY-NC',label:'CC BY-NC',evidence:'explicit but noncommercial'}};
if(api.validateOpenCandidate(bad).ok)throw new Error('Noncommercial open track must be filtered out entirely.');
console.log('canonical playlists v1: ok');
