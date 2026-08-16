import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const [chat,loader,mesh,hostSession,party]=await Promise.all([
  read('public/app/lud-guild-party-chat-v1.js'),
  read('public/app/shared-guide-surface-v236.js'),
  read('public/app/local-object-mesh-v146.js'),
  read('public/app/host-node-session-v1.js'),
  read('public/app/shared-intention-party-chat-v1.js')
]);

for(const token of [
  'civweave.lud-chat.envelope.v1',
  'civweave.lud-chat.invite.v1',
  'civweave.passport.key-history.v1',
  'cyclePassportKey',
  'previousEntryHash',
  'entryHash',
  'publicName',
  'ensureGuildChannel',
  'ensurePartyChannels',
  "id:`guild:${session.nodeId}`",
  "id:`party:${party.groupId}`",
  "'civweave:host-node-logged-in'",
  "'civweave:capacity-session-ready'",
  "'civweave:party-thread-changed'",
  "'civweave:tavern-joined'",
  "peerClaimedGroups.includes(envelope.channelId)",
  "consent:'direct'",
  "new URL('/api/envelopes',session.origin)",
  "via:'mesh-guild-member'",
  'createInvite',
  'acceptInvite',
  'verifyMessage',
  'messageId'
])assert(chat.includes(token),`Lud chat runtime missing ${token}`);

assert(loader.includes('/app/lud-guild-party-chat-v1.js'),'Shared guide loader does not load the Lud chat runtime.');
assert(loader.includes("partyIdentity:'passport-key-public-alias-v1'"),'Shared guide metadata does not identify the Passport-key alias model.');
assert(mesh.includes('peerClaimedGroups')&&mesh.includes('peerVerified'),'Foreground mesh no longer exposes verified peer/group claims needed for direct Lud delivery.');
assert(hostSession.includes('civweave:host-node-logged-in')&&hostSession.includes('sessionFor'),'Guild session hooks required for automatic Guild chat membership are missing.');
assert(party.includes('party.groupId')&&party.includes('civweave:party-thread-changed'),'Party runtime no longer exposes the group/thread hooks required for automatic Party chat membership.');
assert(!/privateKey[^\n]{0,200}HISTORY_KEY/.test(chat),'Passport history must not copy retired private keys into the append-only public history.');

new Function(chat);
new Function(loader);

console.log(JSON.stringify({
  ok:true,
  version:'1.0.0',
  membership:['Guild session -> Guild chat','shared Party -> Party chat'],
  delivery:['verified foreground mesh peers','Guild /api/envelopes distribution','mesh invitee -> Guild member -> Guild relay'],
  identity:'ECDSA Passport key -> deterministic public alias',
  rotation:'append-only public key/name hash chain'
},null,2));