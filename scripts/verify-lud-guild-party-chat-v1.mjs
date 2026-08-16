import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const [chat,transport,passport,mesh,hostSession,party,campus,manifestText,worker,serverV7,wrangler,standardLoader]=await Promise.all([
  read('public/app/lud-guild-party-chat-v1.js'),
  read('public/app/shared-human-group-transport-v1.js'),
  read('public/app/shared/civweave-passport-identity-v1.js'),
  read('public/app/local-object-mesh-v146.js'),
  read('public/app/host-node-session-v1.js'),
  read('public/app/shared-intention-party-chat-v1.js'),
  read('public/app/lud/campus.html'),
  read('public/app/lud-package-v1.json'),
  read('public/service-worker-lud-package-v1.js'),
  read('cloudflare/node-cloud/src/server-ai-entry-v7.mjs'),
  read('cloudflare/node-cloud/wrangler.jsonc'),
  read('public/app/shared-guide-surface-v236.js')
]);
const manifest=JSON.parse(manifestText);

for(const token of [
  'civweave.lud-chat.envelope.v1',
  'civweave.lud-chat.encrypted-packet.v1',
  'civweave.lud-chat.invite.v1',
  'cyclePassportKey',
  'ensureGuildChannel',
  'ensureGuildKey',
  'ensurePartyChannels',
  "id:`guild:${session.nodeId}`",
  "id:`party:${party.groupId}`",
  "new URL('/api/chat/channel-key',session.origin)",
  "{name:'AES-GCM'",
  'secret:party.key',
  'secret:room.secret',
  'CivweaveHumanGroupTransportV1',
  'civweave:human-group-packet',
  'createInvite',
  'acceptInvite',
  'verifyMessage'
])assert(chat.includes(token),`Lud chat adapter missing ${token}`);
assert(!chat.includes("new URL('/api/chat/envelopes'"),'Lud adapter must delegate Guild relay ownership to the shared human-group transport.');
assert(!chat.includes('setInterval('),'Lud adapter must not own a second transport polling loop.');

for(const token of [
  'CivweaveHumanGroupTransportV1',
  'civweave.human-group.transport-envelope.v1',
  'civweave-human-group-transport-v1',
  'civweave-human-group-channels-v1',
  "const SERVER_PATH='/api/chat/envelopes'",
  'civweave.human-group-transport.outbox.v1',
  'queueServer',
  'flushServer',
  'pollServer',
  'peerChannels',
  'peerVerified',
  'civweave:human-group-packet'
])assert(transport.includes(token),`Shared human-group transport missing ${token}`);
assert((transport.match(/setInterval\(/g)||[]).length===1,'Shared human-group transport must own exactly one polling interval.');

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
assert(!/history:\[[^\]]*privateKey/.test(passport),'Passport public key history must not retain retired private keys.');

for(const token of [
  "url.pathname.startsWith('/api/chat/')",
  "url.pathname==='/api/chat/channel-key'",
  "url.pathname==='/api/chat/envelopes'",
  'authenticatedMember',
  'CivweaveCloudNode extends BaseCloudNode',
  'humanGroupKey',
  'humanGroupEnvelopes',
  'human-group-envelopes',
  'Only the authenticated Guild Hall owns a server-held channel key.',
  'guildId!==nodeId'
])assert(serverV7.includes(token),`Guild relay entry missing ${token}`);
assert(wrangler.includes('"main": "src/server-ai-entry-v7.mjs"'),'Cloudflare Guild Worker is not routed through the human-group relay entry.');

assert(mesh.includes('peerClaimedGroups')&&mesh.includes('peerVerified')&&mesh.includes('sessions};'),'Foreground mesh no longer exposes verified session/group state needed for shared transport routing.');
assert(hostSession.includes('civweave:host-node-logged-in')&&hostSession.includes('sessionFor'),'Guild session hooks required for automatic Guild chat membership are missing.');
assert(party.includes('party.groupId')&&party.includes('party.key')&&party.includes('civweave:party-thread-changed'),'Party runtime no longer exposes the group/key/thread hooks required for automatic Party chat membership.');
assert(manifest.policy.guildPartyChat===true&&manifest.policy.passportPublicAliases===true,'Lud package policy must explicitly admit Guild/Party chat and public aliases.');
for(const asset of ['/app/lud-guild-party-chat-v1.js','/app/shared-human-group-transport-v1.js'])assert(manifest.assets.includes(asset),`${asset} is not packaged for offline Lud Mode.`);
for(const route of ['/api/chat/channel-key','/api/chat/envelopes'])assert(worker.includes(`'${route}'`),`Lud service worker does not admit ${route}.`);
assert(!worker.includes("'/api/envelopes'"),'Lud service worker must not admit the retired generic envelope path for this chat system.');
assert(campus.includes('/app/lud-guild-party-chat-v1.js')&&campus.includes('id="lud-chat-channel"')&&campus.includes('id="lud-cycle-passport-key"'),'Lud campus does not expose the chat and Passport-key controls.');
assert(!standardLoader.includes('/app/lud-guild-party-chat-v1.js'),'Lud presentation adapter must not be injected into the Standard shared guide loader.');

new Function(chat);
new Function(transport);
new Function(passport);

console.log(JSON.stringify({
  ok:true,
  version:'1.3.0',
  membership:['Guild session -> Guild Hall chat','shared Party key -> Party chat','signed Passport invite -> chat-only capability'],
  delivery:['canonical shared human-group transport','verified WebRTC routing','authenticated Cloudflare Guild relay + bounded durable outbox','mesh invitee -> Guild member -> Guild relay'],
  confidentiality:['Guild Hall AES-GCM key from authenticated Guild registry','Party AES-GCM key reused from canonical Party','relay and unrelated mesh peers see opaque packets'],
  identity:'canonical Passport ECDSA chat key -> repeatable public alias',
  rotation:'stable Passport + changed public alias + predecessor-signed hash chain',
  scope:'Lud presentation over shared transport'
},null,2));