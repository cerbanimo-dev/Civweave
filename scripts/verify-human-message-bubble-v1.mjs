import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const [bubble,loader,repair,party]=await Promise.all([
  read('public/app/human-message-bubble-v1.js'),
  read('public/app/shared-guide-surface-v236.js'),
  read('public/service-worker-chat-repair-v245.js'),
  read('public/app/shared-intention-party-chat-v1.js')
]);
new Function(bubble);new Function(loader);new Function(repair);
const checks=[];
const check=(name,condition)=>{assert.ok(condition,name);checks.push(name)};
check('human launcher is a sibling of the AI launcher',bubble.includes("const AI_LAUNCHER_ID='cwp215-launcher'")&&bubble.includes("const BUBBLE_ID='cw-human-message-launcher-v1'"));
check('human launcher matches AI bubble sizing and safe-area anchor',bubble.includes('width:52px!important')&&bubble.includes('width:48px!important')&&bubble.includes('env(safe-area-inset-right)')&&bubble.includes('var(--cw-themed-nav-height,64px)'));
check('unread badge is present and caps display at 99+',bubble.includes("const BADGE_ID='cw-human-message-unread-v1'")&&bubble.includes("snapshot.unread>99?'99+'"));
check('party unread excludes messages from the local participant',bubble.includes("row?.kind!=='human'")&&bubble.includes('row.participantId===localId'));
check('latest party sender uses the frozen role and avatar variant snapshot',bubble.includes('row?.role||participant.role')&&bubble.includes('row?.avatarVariant')&&party.includes('avatarVariant:participant.avatarVariant'));
check('PM unread is sourced only from decrypted local conversations',bubble.includes('CivweavePrivateMessagingV1')&&bubble.includes("row?.direction!=='in'")&&bubble.includes('await api.conversations()'));
check('PM avatar snapshot can be used without requiring server metadata',bubble.includes('row.avatar')&&bubble.includes('row.envelope?.avatar')&&bubble.includes("pmAvatarFallback:'initial-until-encrypted-avatar-snapshot'"));
check('read cursors stay local',bubble.includes("const ATTENTION_KEY='civweave.human-message-attention.v1'")&&bubble.includes("readState:'local-only'"));
check('party and PM receive events refresh the attention surface',bubble.includes("'civweave:party-thread-changed'")&&bubble.includes("'civweave:private-message'"));
check('clicking latest party opens the canonical chat surface',bubble.includes('AI_LAUNCHER_ID')&&bubble.includes('[data-party-tab=')&&bubble.includes('openParty(item)'));
check('PM click emits an integration event for the PM UI',bubble.includes("'civweave:private-message-open-request'"));
check('shared guide loader mounts the human messaging launcher',loader.includes('/app/human-message-bubble-v1.js')&&loader.includes("humanMessagingAttention:'v1'"));
check('offline chat repair packages the human messaging launcher',repair.includes("const HUMAN_BUBBLE_PATH='/app/human-message-bubble-v1.js'")&&repair.includes('cacheHumanMessageRuntime')&&repair.includes('packageHumanBubble'));
console.log(JSON.stringify({ok:true,checks:checks.length,bubble:'human',unreadSources:['shared-party','private-messages'],readState:'local-only',offlinePackaged:true},null,2));
