import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const [chat,loader,shell]=await Promise.all([
  read('public/app/human-chat-network-v1.js'),
  read('public/app/shared-guide-surface-v236.js'),
  read('public/service-worker-shell-assets-v1.js')
]);
new Function(chat);new Function(loader);new Function(shell);
const checks=[];
const check=(name,condition)=>{assert.ok(condition,name);checks.push(name)};
check('contacts store exists',chat.includes("CONTACTS_KEY='civweave.human-contacts.v1'"));
check('group store exists',chat.includes("GROUPS_KEY='civweave.human-groups.v1'"));
check('direct chat uses existing PM send',chat.includes('pm.send(username,encodeProtocol(packet))'));
check('group chat fans encrypted messages out through PM per member',chat.includes('for(const member of members)')&&chat.includes('pm.send(member,encodeProtocol(packet))'));
check('messages carry small-envelope Bluetooth-friendly profile',chat.includes("meshProfile:'small-encrypted-envelope'")&&chat.includes('bluetoothFriendly:true')&&chat.includes('MAX_MESSAGE_CHARS=6000'));
check('browser BLE is not falsely claimed as implemented',chat.includes('actualBrowserBleTransport:false'));
check('Guild thread is generated automatically',chat.includes('ensureGuildGroup')&&chat.includes("kind:'guild'")&&chat.includes("autoThreads:['guild','party']"));
check('Party threads are discovered automatically',chat.includes('sharedPartyDescriptors')&&chat.includes('party:${planId}'));
check('Party sending delegates to canonical party runtime',chat.includes('api.submitParty(plan,text)'));
check('contacts can grow group membership',chat.includes('addMember(groupId,username)')&&chat.includes('removeMember(groupId,username)')&&chat.includes('data-human-toggle-member'));
check('human tabs explicitly scroll horizontally',chat.includes('overflow-x:auto')&&chat.includes('overscroll-behavior-x:contain')&&chat.includes('scrollableTabs:true'));
check('human bubble opens protocol groups correctly',chat.includes('latestUnreadGroup')&&chat.includes("event.stopImmediatePropagation();void showSurface({source:'human-chat',threadId})"));
check('PM previews hide protocol wrapper text',chat.includes('installPmPreviewAdapter')&&chat.includes('body:packet.text'));
check('loader mounts human chat beside human attention bubble',loader.includes('/app/human-chat-network-v1.js')&&loader.includes('humanChatContacts:true')&&loader.includes('humanChatGroups:true'));
check('offline shell caches human chat transport stack',shell.includes('/app/human-chat-network-v1.js')&&shell.includes('/app/civweave-private-messaging-v1.js')&&shell.includes('/app/local-object-mesh-v146.js')&&shell.includes('/app/shared-intention-party-chat-v1.js'));
console.log(JSON.stringify({ok:true,checks:checks.length,transport:'E2EE PM fan-out over local object mesh + Cloudflare mail relay',autoThreads:['guild','party'],browserBle:false},null,2));
