import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const [bubble,loader,repair,party,network]=await Promise.all([
  read('public/app/human-message-bubble-v1.js'),
  read('public/app/shared-guide-surface-v236.js'),
  read('public/service-worker-chat-repair-v245.js'),
  read('public/app/shared-intention-party-chat-v1.js'),
  read('public/app/human-chat-network-v1.js')
]);
new Function(bubble);new Function(loader);new Function(repair);new Function(network);
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
check('human chat has its own standalone shell',bubble.includes("const HUMAN_SHELL_ID='cw-human-chat-standalone-v1'")&&bubble.includes("presentation:'standalone-human-chat-v1'")&&bubble.includes('aiSurfaceReused:false'));
check('human launcher capture routes into the human network instead of clicking the AI launcher',bubble.includes("target.closest(`#${BUBBLE_ID}`)")&&bubble.includes('await api.show(detail||{})')&&!bubble.includes('ai.click()'));
check('standalone human chat detaches its surface from Weaveling chrome',bubble.includes("if(surface.parentElement!==shell)shell.append(surface)")&&bubble.includes("document.getElementById(ROOT_ID)?.classList.remove('cwhuman-mode')")&&bubble.includes('closeAiIfHumanOpenedIt()'));
check('human close control belongs to the standalone shell',bubble.includes("back.textContent!=='Close'")&&bubble.includes("target.closest(`#${HUMAN_SHELL_ID} [data-human-back]`)")&&bubble.includes('closeStandalone()'));
check('human network still exposes the canonical human surface API',network.includes("const SURFACE_ID='cw-human-chat-network-v1'")&&network.includes('show:showSurface')&&network.includes('hide:hideSurface'));
check('shared guide loader requests the standalone human bubble revision',loader.includes('/app/human-message-bubble-v1.js?v=1.1.0-human-message-standalone-v1')&&loader.includes("humanChatPresentation:'standalone-human-chat-v1'")&&loader.includes('humanChatSharesGuideSurface:false'));
check('offline chat repair packages the human messaging launcher',repair.includes("const HUMAN_BUBBLE_PATH='/app/human-message-bubble-v1.js'")&&repair.includes('cacheHumanMessageRuntime')&&repair.includes('packageHumanMessage'));
console.log(JSON.stringify({ok:true,checks:checks.length,bubble:'human',presentation:'standalone-human-chat-v1',sharesGuideSurface:false,unreadSources:['shared-party','private-messages'],readState:'local-only',offlinePackaged:true},null,2));
