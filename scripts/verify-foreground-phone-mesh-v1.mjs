import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const [mesh,architecture]=await Promise.all([
  read('public/app/local-object-mesh-v146.js'),
  read('docs/contracts/install-only-local-mesh-architecture.md')
]);

for(const token of [
  "const PROTOCOL='civweave.foreground-phone-mesh.v1'",
  'const DB_VERSION=3',
  "db.createObjectStore('incoming'",
  "db.createObjectStore('acks'",
  "db.createObjectStore('transit'",
  "db.createObjectStore('priorities'",
  "db.createObjectStore('conflicts'",
  "const CONFLICT_SCHEMA='civweave.community-conflict.v1'",
  "conflictPolicy:'same-revision-hash-tiebreak-preserve-both'",
  "type:'manifest'",
  "type:'want'",
  "type:'chunk'",
  'serializedHash',
  'bufferedAmountLowThreshold',
  'resumableChunks:true',
  'priorities:true',
  'storeForwardPublic:true',
  'directRelay:false',
  'sleepingPhones:false',
  'nativeCompanion:false',
  'wifiDirect:false',
  'object is outside this device audience',
  'origin identity mismatch',
  'peerIdForCredential(object.origin.credential)!==object.origin.nodeId',
  'credential:owner.publicKey',
  'nonce:session.localNonce',
  'identityProofValue',
  "type:'identity-proof'",
  'verify(session.peerCredential',
  'peer proof rejected',
  'peer identity mismatch',
  "emit('peer-incompatible'",
  'verifiedGroupDelivery:false',
  'session.peerGroups=[]',
  'hopLimit:Number(object.hopLimit)||0',
  "if(session.peerProtocol!==PROTOCOL)return;const object=await getObject(message.objectId)",
  "['direct','group'].includes(object.consent)&&!session.peerVerified",
  "session.peerProtocol=declaredProtocol||'legacy'",
  "type:'objects',items"
])assert(mesh.includes(token),`Foreground mesh missing ${token}.`);

assert(!mesh.includes('hopLimit:object.hopLimit-1'),'Foreground mesh mutates signed hopLimit.');
assert(!mesh.includes('object.hopLimit--'),'Foreground mesh mutates signed hopLimit.');
assert(mesh.includes("const mayRelay=object=>object.consent==='public'||object.consent==='federated'"),'Relay policy must be public/federated only.');
assert(mesh.includes('if(!object||!mayRelay(object))continue'),'Gateway upload must exclude direct/group objects.');
assert(mesh.includes('if(!mayRelay(object)||!intendedFor(object'),'Gateway download must exclude direct/group objects.');
assert(mesh.includes("return{relation:'conflict',winner:incomingHash<localHash?'incoming':'local'}"),'Same-revision forks must use a deterministic signed-hash tie-break.');
assert(mesh.includes("resolution:'deterministic-revision-hash-tiebreak'"),'Fork evidence must record its convergence rule.');

for(const phrase of [
  'no Android core, native companion, Wi-Fi Direct dependency, or always-on daemon in v1',
  'Sleeping-phone/background delivery is a later transport problem',
  'Signed object fields are immutable in transit',
  'An object claiming an origin node ID that does not match its signing credential is rejected',
  'Direct payloads are endpoint-only and are sent only after the peer node ID is derived from its public credential and the peer proves possession of the corresponding private key by signing a fresh session challenge',
  'Group payloads are not automatically transferred in v1',
  'Direct/group payloads are not gateway-relayed by the foreground mesh',
  'Sleeping phones later'
])assert(architecture.includes(phrase),`Architecture contract missing ${phrase}.`);

console.log(JSON.stringify({
  ok:true,
  protocol:'civweave.foreground-phone-mesh.v1',
  databaseVersion:3,
  conflictPolicy:'same-revision-hash-tiebreak-preserve-both',
  foregroundOnly:true,
  nativeCompanion:false,
  wifiDirect:false,
  sleepingPhones:false
},null,2));