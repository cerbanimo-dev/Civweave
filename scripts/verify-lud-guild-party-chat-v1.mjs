import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const [chat,passport,mesh,hostSession,party,campus,manifestText,worker,standardLoader]=await Promise.all([
  read('public/app/lud-guild-party-chat-v1.js'),
  read('public/app/shared/civweave-passport-identity-v1.js'),
  read('public/app/local-object-mesh-v146.js'),
  read('public/app/host-node-session-v1.js'),
  read('public/app/shared-intention-party-chat-v1.js'),
  read('public/app/lud/campus.html'),
  read('public/app/lud-package-v1.json'),
  read('public/service-worker-lud-package-v1.js'),
  read('public/app/shared-guide-surface-v236.js')
]);
const manifest=JSON.parse(manifestText);

for(const token of [
  'civweave.lud-chat.envelope.v1',
  'civweave.lud-chat.invite.v1',
  'cyclePassportKey',
  'ensureGuildChannel',
  'ensurePartyChannels',
  "id:`guild:${session.nodeId}`",
  "id:`party:${party.groupId}`",
  "'civweave:host-node-logged-in'",
  "'civweave:capacity-session-ready'",
  "'civweave:party-thread-changed'",
  "'civweave:tavern-joined'",
  "consent:'direct'",
  'dynamicPeerGroups',
  'civweave-lud-chat-groups-v1',
  "new URL('/api/envelopes',session.origin)",
  "via:'mesh-guild-member'",
  'civweave.lud-chat.guild-outbox.v1',
  'flushGuildOutbox',
  'createInvite',
  'acceptInvite',
  'verifyMessage',
  'messageId'
])assert(chat.includes(token),`Lud chat runtime missing ${token}`);

for(const token of [
  'civweave.passport-chat-keychain.v1',
  'civweave.passport-chat-key-history.v1',
  'civweave.passport-chat-key-transition.v1',
  'rotateChatKey',
  'previousEntryHash',
  'transitionSignature',
  'verifyChatHistory',
  'publicNameForKey',
  'do{pair=await generatePair();publicName=await publicNameForKey(pair.publicKey)}while(publicName===prior.publicName)'
])assert(passport.includes(token),`Canonical Passport runtime missing ${token}`);

assert(mesh.includes('peerClaimedGroups')&&mesh.includes('peerVerified')&&mesh.includes('sessions};'),'Foreground mesh no longer exposes verified session/group state needed for direct Lud delivery.');
assert(hostSession.includes('civweave:host-node-logged-in')&&hostSession.includes('sessionFor'),'Guild session hooks required for automatic Guild chat membership are missing.');
assert(party.includes('party.groupId')&&party.includes('civweave:party-thread-changed'),'Party runtime no longer exposes the group/thread hooks required for automatic Party chat membership.');
assert(manifest.policy.guildPartyChat===true&&manifest.policy.passportPublicAliases===true,'Lud package policy must explicitly admit Guild/Party chat and public aliases.');
assert(manifest.assets.includes('/app/lud-guild-party-chat-v1.js'),'Lud chat runtime is not packaged for offline Lud Mode.');
assert(worker.includes("'/api/envelopes'"),'Lud service worker does not admit the Guild relay endpoint.');
assert(campus.includes('/app/lud-guild-party-chat-v1.js')&&campus.includes('id="lud-chat-channel"')&&campus.includes('id="lud-cycle-passport-key"'),'Lud campus does not expose the chat and Passport-key controls.');
assert(!standardLoader.includes('/app/lud-guild-party-chat-v1.js'),'Lud chat must not be injected into the Standard shared guide loader.');
assert(!chat.includes('x-civweave-node-id'),'Lud chat must stay within the live Guild relay CORS header contract.');
assert(/room\?\.access!==['"]member['"]\)return false/.test(chat),'Invited non-Guild participants must not upload directly to a Guild server.');
assert(!/history:\[[^\]]*privateKey/.test(passport),'Passport public key history must not retain retired private keys.');

new Function(chat);
new Function(passport);

console.log(JSON.stringify({
  ok:true,
  version:'1.2.0',
  membership:['Guild session -> Guild Hall chat','shared Party -> Party chat','signed Passport invite -> chat-only membership'],
  delivery:['verified WebRTC peer delivery','durable Guild outbox + /api/envelopes','mesh invitee -> Guild member -> Guild relay'],
  identity:'canonical Passport ECDSA chat key -> repeatable public alias',
  rotation:'stable Passport + changed public alias + predecessor-signed hash chain',
  scope:'Lud package only'
},null,2));