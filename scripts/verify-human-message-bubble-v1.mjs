import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const [bubble,loader,repair,party,network,standalone,context]=await Promise.all([
  read('public/app/human-message-bubble-v1.js'),
  read('public/app/shared-guide-surface-v236.js'),
  read('public/service-worker-chat-repair-v245.js'),
  read('public/app/shared-intention-party-chat-v1.js'),
  read('public/app/human-chat-network-v1.js'),
  read('public/app/human-chat-standalone-v2.js'),
  read('public/app/human-chat-guild-context-v1.js')
]);
new Function(bubble);new Function(loader);new Function(repair);new Function(network);new Function(standalone);new Function(context);
const checks=[];
const check=(name,condition)=>{assert.ok(condition,name);checks.push(name)};
check('human launcher remains independent of the five AI guide avatars',bubble.includes("const AI_LAUNCHER_ID='cwp215-launcher'")&&bubble.includes("const BUBBLE_ID='cw-human-message-launcher-v1'"));
check('human launcher matches AI bubble sizing and safe-area anchor',bubble.includes('width:52px!important')&&bubble.includes('width:48px!important')&&bubble.includes('env(safe-area-inset-right)')&&bubble.includes('var(--cw-themed-nav-height,64px)'));
check('unread badge is present and caps display at 99+',bubble.includes("const BADGE_ID='cw-human-message-unread-v1'")&&bubble.includes("snapshot.unread>99?'99+'"));
check('party unread excludes messages from the local participant',bubble.includes("row?.kind!=='human'")&&bubble.includes('row.participantId===localId'));
check('latest party sender uses the frozen role and avatar variant snapshot',bubble.includes('row?.role||participant.role')&&bubble.includes('row?.avatarVariant')&&party.includes('avatarVariant:participant.avatarVariant'));
check('PM unread is sourced only from decrypted local conversations',bubble.includes('CivweavePrivateMessagingV1')&&bubble.includes("row?.direction!=='in'")&&bubble.includes('await api.conversations()'));
check('read cursors stay local',bubble.includes("const ATTENTION_KEY='civweave.human-message-attention.v1'")&&bubble.includes("readState:'local-only'"));
check('standalone v2 owns the visible human shell',standalone.includes("const SHELL_ID='cw-human-chat-standalone-v1'")&&standalone.includes("const SURFACE_ID='cw-human-chat-standalone-surface-v2'")&&standalone.includes("presentation:'standalone-v2'")&&standalone.includes('sharesGuideSurface:false'));
check('standalone v2 intercepts the human bubble before legacy document routing',standalone.includes("window.addEventListener('click'")&&standalone.includes("target.closest(`#${BUBBLE_ID}`)")&&standalone.includes('event.stopImmediatePropagation()'));
check('standalone v2 never opens or mounts the AI guide chat',standalone.includes('usesNetworkShow:false')&&!standalone.includes('network()?.show?.(')&&!standalone.includes('cwp215-launcher')&&!standalone.includes('guideApi()'));
check('standalone v2 uses the human network only as data and transport',standalone.includes('api.threads?.()')&&standalone.includes('api.messages?.()')&&standalone.includes('state.api.send?.(descriptor,text)'));
check('legacy network remains a transport/data API while its old presentation is quiesced',network.includes("const SURFACE_ID='cw-human-chat-network-v1'")&&network.includes('show:showSurface')&&network.includes('hide:hideSurface')&&standalone.includes('network()?.hide?.()'));
check('guild context boots standalone v2 before human interaction',context.includes("const VERSION='1.0.2-human-chat-standalone-v2'")&&context.includes("load('/app/human-chat-standalone-v2.js'")&&context.includes('void bootStandalone();'));
check('shared loader cache-busts the standalone v2 context',loader.includes('/app/human-chat-guild-context-v1.js?v=1.0.2-human-chat-standalone-v2')&&loader.includes("humanChatPresentation:'standalone-v2'")&&loader.includes('humanChatSharesGuideSurface:false'));
check('offline chat repair still packages the human attention launcher',repair.includes("const HUMAN_BUBBLE_PATH='/app/human-message-bubble-v1.js'")&&repair.includes('cacheHumanMessageRuntime')&&repair.includes('packageHumanMessage'));
console.log(JSON.stringify({ok:true,checks:checks.length,bubble:'human',presentation:'standalone-v2',sharesGuideSurface:false,usesNetworkShow:false,unreadSources:['shared-party','private-messages'],readState:'local-only'},null,2));