import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const [party,loader,repair]=await Promise.all([
  read('public/app/shared-intention-party-chat-v1.js'),
  read('public/app/shared-guide-surface-v236.js'),
  read('public/service-worker-chat-repair-v245.js')
]);
new Function(party);new Function(loader);new Function(repair);
const checks=[];
const check=(name,condition)=>{assert.ok(condition,name);checks.push(name)};
const roles=['navigator','cartographer','scout','strategist','facilitator','diplomat','steward','researcher','archivist','scribe','teacher','analyst','reviewer','storyteller','builder','tinkerer','designer','engineer','artisan','producer','operator','quartermaster','caretaker','mediator','host','connector','advocate','guardian'];
check('exactly 28 canonical anonymous role handles are defined',roles.length===28&&roles.every(role=>party.includes(`'${role}'`))&&party.includes('maxRoleCount:28'));
check('visible human identity is role-only',party.includes("visibleHumanIdentity:'role-handle-only'")&&party.includes("identityPolicy:'anonymous-role-only'")&&!/displayName|realName|username|emailAddress/i.test(party));
check('role claims are unique per party',party.includes('uniqueRolePerParty:true')&&party.includes('roleOwner(party,role)')&&party.includes('normalizeRoleClaims'));
check('plan-scoped anonymous participant ids are derived without human names',party.includes('participantIdFor(plan)')&&party.includes('deviceSeed()')&&party.includes('plan.party.groupId'));
check('party avatar variant travels with participant and messages',party.includes('avatarVariant')&&party.includes('AVATAR_VARIANTS'));
check('message history freezes role and avatar identity at send time',party.includes('role=ROLE_IDS.has(row.role)?row.role:participant.role')&&party.includes('AVATAR_VARIANTS.includes(row.avatarVariant)?row.avatarVariant'));
check('shared plan tabs coexist with private realm thread',party.includes('data-party-tab="private"')&&party.includes('sharedPlansFor(system)')&&party.includes('touchedSystems(plan)'));
check('prompt AI uses a literal persistent switch',party.includes('Prompt AI: ${promptMode(plan.id)?\'ON\':\'OFF\'}')&&party.includes('data-party-prompt role=\"switch\"')&&party.includes('aria-checked=\"${promptMode(plan.id)}\"')&&party.includes('setPromptMode'));
check('AI off means AI tags cannot invoke a model',party.includes("Prompt AI is OFF. Your message was shared, but the tagged AI were not invoked.")&&party.includes('if(prompt){'));
for(const tag of ['@weaveling','@moss','@kamiya','@rook','@merlin'])check(`AI mention supported: ${tag}`,party.includes(`tag:'${tag}'`));
check('multiple AI tags can produce multiple weigh-ins',party.includes('for(const system of [...new Set(targets)])')&&party.includes('await aiReply(plan,system'));
check('human role mentions are parsed independently of AI tags',party.includes('mentions.roles')&&party.includes('ROLE_IDS')&&party.includes('parseMentions'));
check('incoming party packets never run AI',party.includes('incomingMessagesNeverPromptAI:true')&&party.includes('ingestPacket')&&!/ingestPacket[\s\S]{0,1000}assistant\.respond/.test(party));
check('shared thread search is plan-wide rather than realm-local',party.includes('data-party-search')&&party.includes('searchTerm(plan.id)')&&party.includes('transcriptMarkup(plan,party)'));
check('mesh transport uses existing WebRTC sessions',party.includes('CivweaveLocalMeshV146?.sessions')&&party.includes("type:'civweave-party-v1'"));
check('online transport uses the selected host envelope gateway',party.includes('CivweaveHostNodeSessionV1?.selectedOrigin?.()')&&party.includes("new URL('/api/envelopes',gatewayBase())"));
check('party transport encrypts payloads before mesh or gateway delivery',party.includes("name:'AES-GCM'")&&party.includes('ciphertext')&&party.includes('additionalData:encoder.encode(plan.party.groupId)'));
check('offline messages enter a bounded encrypted outbox before delivery',party.includes("const OUTBOX_KEY='civweave.shared-intention-party-outbox.v1'")&&party.includes('slice(-500)')&&party.includes("durable=payload?.kind==='message'")&&party.includes('queueOutbox(plan,packet)'));
check('party outbox flushes on reconnect, peer-open, and background sync signal',party.includes('flushPartyOutbox({mesh:true})')&&party.includes("addEventListener('online'")&&party.includes("CIVWEAVE_OUTBOX_SYNC_REQUESTED")&&party.includes("civweave-community-outbox"));
check('party invite is a bearer secret, not an identity record',party.includes("const INVITE_PREFIX='cwparty1.'")&&party.includes('exportInvite')&&party.includes('joinInvite'));
check('shared composer capture runs before canonical document submit owner',party.includes("window.addEventListener('submit',onSubmit,true)")&&party.includes('event.stopImmediatePropagation()'));
check('party decorator disconnects its observer while mutating the canonical chat DOM',party.includes('function mutateRoot(work)')&&party.includes('activeObserver.disconnect()')&&party.includes('activeObserver.observe(root,{childList:true,subtree:true})'));
check('shared guide loader mounts party runtime',loader.includes('/app/shared-intention-party-chat-v1.js')&&loader.includes("partyIdentity:'anonymous-role-only'"));
check('offline repair packages party runtime',repair.includes("const PARTY_PATH='/app/shared-intention-party-chat-v1.js'")&&repair.includes("const PARTY_CACHE='civweave-party-v1'")&&repair.includes('cachePartyRuntime'));
console.log(JSON.stringify({ok:true,checks:checks.length,roles:roles.length,visibleIdentity:'anonymous role handle',promptRouting:'switch then @tags',transport:'AES-GCM over WebRTC + host envelopes + durable outbox',offlinePartyRuntime:true,offlineOutbox:true},null,2));
