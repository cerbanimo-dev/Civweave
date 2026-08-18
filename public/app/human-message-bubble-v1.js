(()=>{
'use strict';

const VERSION='1.1.0-human-message-standalone-v1';
const BUBBLE_ID='cw-human-message-launcher-v1';
const BADGE_ID='cw-human-message-unread-v1';
const AI_LAUNCHER_ID='cwp215-launcher';
const ROOT_ID='cw-persistent-guide-chat-v215';
const HUMAN_SURFACE_ID='cw-human-chat-network-v1';
const HUMAN_SHELL_ID='cw-human-chat-standalone-v1';
const HUMAN_LOADING_ID='cw-human-chat-standalone-loading-v1';
const STYLE_ID='cw-human-message-bubble-v1-style';
const PARTY_KEY='civweave.shared-intention-parties.v1';
const INTENTIONS_KEY='civweave.intentions.v127';
const ATTENTION_KEY='civweave.human-message-attention.v1';
const AVATAR_VARIANTS=['thread','spark','leaf','stone','ember','tide','sky','ink'];
const ROLE_FAMILY={
  navigator:'direction',cartographer:'direction',scout:'direction',strategist:'direction',facilitator:'direction',diplomat:'direction',steward:'direction',
  researcher:'knowledge',archivist:'knowledge',scribe:'knowledge',teacher:'knowledge',analyst:'knowledge',reviewer:'knowledge',storyteller:'knowledge',
  builder:'making',tinkerer:'making',designer:'making',engineer:'making',artisan:'making',producer:'making',operator:'making',
  quartermaster:'care',caretaker:'care',mediator:'care',host:'care',connector:'care',advocate:'care',guardian:'care'
};
const FAMILY_GLYPH={direction:'◇',knowledge:'⌘',making:'◆',care:'○'};
const PALETTE={thread:['#25283d','#f7f0d5'],spark:['#3c1b4f','#ffd778'],leaf:['#17392e','#b9f2c8'],stone:['#30323a','#e6e8ed'],ember:['#522319','#ffd0ae'],tide:['#14344a','#bdeaff'],sky:['#22386c','#d8e5ff'],ink:['#171725','#eee9ff']};

if(globalThis.CivweaveHumanMessageBubbleV1?.version===VERSION)return;

let refreshTimer=0;
let refreshQueued=false;
let lastSnapshot=null;
let shellActive=false;
let shellObserver=null;
let aiRestoreState={open:false,guide:''};
let openingPromise=null;
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const clean=(value,max=4000)=>String(value??'').trim().slice(0,max);
const timeValue=value=>{const parsed=Date.parse(value||0);return Number.isFinite(parsed)?parsed:0};
const cssEscape=value=>globalThis.CSS?.escape?CSS.escape(String(value)):String(value).replace(/[^a-zA-Z0-9_-]/g,'\\$&');

function attentionState(){const value=parse(localStorage.getItem(ATTENTION_KEY),{});return value&&typeof value==='object'&&!Array.isArray(value)?value:{party:{},pm:{}}}
function saveAttention(value){try{localStorage.setItem(ATTENTION_KEY,JSON.stringify(value))}catch{}return value}
function partyStore(){const value=parse(localStorage.getItem(PARTY_KEY),{});return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}
function intentionRows(){const rows=parse(localStorage.getItem(INTENTIONS_KEY),[]);return Array.isArray(rows)?rows:[]}
function planTitleMap(){const map=new Map();for(const row of intentionRows()){const plan=row?.plan&&typeof row.plan==='object'?row.plan:row;if(plan?.id)map.set(plan.id,clean(plan.title||plan.wish||'Shared intention',160)||'Shared intention')}return map}
function avatarGlyph(role,variant){const family=ROLE_FAMILY[role]||'direction',index=Math.max(0,AVATAR_VARIANTS.indexOf(variant));return`${FAMILY_GLYPH[family]||'◇'}${index+1}`}
function avatarPalette(variant){return PALETTE[AVATAR_VARIANTS.includes(variant)?variant:'thread']||PALETTE.thread}
function partySender(row,party){const participant=party?.participants?.[row?.participantId]||{},role=clean(row?.role||participant.role,80),variant=AVATAR_VARIANTS.includes(row?.avatarVariant)?row.avatarVariant:(AVATAR_VARIANTS.includes(participant.avatarVariant)?participant.avatarVariant:'thread');return{role,variant,label:role?`@${role}`:'Party member',glyph:avatarGlyph(role,variant)}}
function partyReadCursor(state,planId){return timeValue(state.party?.[planId]?.readAt)}
function partyRows(){const state=attentionState(),titles=planTitleMap(),items=[];let unread=0;for(const [planId,party] of Object.entries(partyStore())){if(!party||typeof party!=='object')continue;const localId=party.localParticipantId||'';const cursor=partyReadCursor(state,planId);for(const row of Array.isArray(party.messages)?party.messages:[]){if(row?.kind!=='human'||!row.id||row.participantId===localId)continue;const at=timeValue(row.at);const sender=partySender(row,party);const item={source:'party',threadId:planId,messageId:row.id,at,atIso:row.at||'',title:titles.get(planId)||'Shared intention',sender,text:clean(row.text,280),unread:at>cursor};items.push(item);if(item.unread)unread++}}return{items,unread}}

async function pmRows(){const api=globalThis.CivweavePrivateMessagingV1;if(!api?.conversations)return{items:[],unread:0};let rows=[];try{rows=await api.conversations()}catch{return{items:[],unread:0}}const state=attentionState(),items=[];let unread=0;for(const row of Array.isArray(rows)?rows:[]){if(row?.direction!=='in'||!row.id)continue;const from=clean(row.from,80)||'person',cursor=timeValue(state.pm?.[from]?.readAt),at=timeValue(row.receivedAt||row.createdAt);const avatar=row.avatar&&typeof row.avatar==='object'?row.avatar:(row.envelope?.avatar&&typeof row.envelope.avatar==='object'?row.envelope.avatar:null);const variant=AVATAR_VARIANTS.includes(avatar?.variant)?avatar.variant:null;const glyph=clean(avatar?.glyph,8)||from.slice(0,1).toUpperCase()||'•';const item={source:'pm',threadId:from,messageId:row.id,at,atIso:row.receivedAt||row.createdAt||'',title:`@${from}`,sender:{label:`@${from}`,variant,glyph,avatarUrl:clean(avatar?.url,600)},text:clean(row.body,280),unread:at>cursor};items.push(item);if(item.unread)unread++}return{items,unread}}

function installStyle(){if(document.getElementById(STYLE_ID))return;const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
#${BUBBLE_ID}{position:fixed!important;right:calc(max(12px,env(safe-area-inset-right)) + 60px)!important;bottom:calc(var(--cw-themed-nav-height,64px) + env(safe-area-inset-bottom) + 12px)!important;width:52px!important;height:52px!important;min-width:52px!important;min-height:52px!important;margin:0!important;padding:0!important;display:grid!important;place-items:center!important;box-sizing:border-box!important;border:2px solid var(--cw-human-accent,#d8dde7)!important;border-radius:50%!important;background:var(--cw-human-bg,#25283d)!important;color:var(--cw-human-fg,#f7f0d5)!important;box-shadow:0 6px 18px #0009,0 0 0 1px #ffffff24!important;overflow:visible!important;appearance:none!important;-webkit-appearance:none!important;line-height:1!important;z-index:2147483643!important;pointer-events:auto!important;touch-action:manipulation!important;font:900 15px/1 ui-monospace,SFMono-Regular,Menlo,monospace!important}
#${BUBBLE_ID} .cw-human-face{width:100%;height:100%;display:grid;place-items:center;border-radius:50%;overflow:hidden;background:var(--cw-human-bg,#25283d);color:var(--cw-human-fg,#f7f0d5);text-shadow:0 1px 2px #0008}
#${BUBBLE_ID} .cw-human-face img{display:block;width:100%;height:100%;object-fit:cover;border-radius:50%}
#${BADGE_ID}{position:absolute;top:-5px;right:-5px;min-width:19px;height:19px;padding:0 5px;display:grid;place-items:center;border:2px solid #10131b;border-radius:999px;background:#ff4f79;color:white;box-sizing:border-box;font:900 10px/1 system-ui,sans-serif;box-shadow:0 2px 8px #0009}
#${BADGE_ID}[hidden]{display:none!important}
#${HUMAN_SHELL_ID}{position:fixed!important;right:max(12px,env(safe-area-inset-right))!important;bottom:calc(var(--cw-themed-nav-height,64px) + env(safe-area-inset-bottom) + 12px)!important;width:min(560px,calc(100vw - 24px))!important;height:min(76dvh,760px)!important;min-width:0!important;min-height:0!important;display:grid!important;grid-template-rows:minmax(0,1fr)!important;overflow:hidden!important;border:1px solid color-mix(in srgb,var(--cw-human-accent,#d8dde7) 46%,transparent)!important;border-radius:20px!important;background:#0b1018!important;color:#f8fbff!important;box-shadow:0 24px 80px #000b!important;z-index:2147483645!important;isolation:isolate!important;contain:layout paint style!important;color-scheme:dark!important}
#${HUMAN_SHELL_ID}[hidden]{display:none!important}
#${HUMAN_SHELL_ID}>#${HUMAN_SURFACE_ID}{display:grid!important;grid-template-rows:max-content max-content minmax(0,1fr) max-content!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;overflow:hidden!important;border:0!important;background:color-mix(in srgb,var(--cw-human-accent,#d8dde7) 6%,#080b11)!important}
#${HUMAN_SHELL_ID} #${HUMAN_LOADING_ID}{display:grid;place-items:center;min-height:100%;padding:24px;color:#aeb9c8;font:800 13px/1.4 system-ui,sans-serif;text-align:center}
#${HUMAN_SHELL_ID} .cwhuman-toolbar{padding-top:calc(7px + env(safe-area-inset-top))}
#${HUMAN_SHELL_ID} [data-human-back]{min-width:64px}
@media(max-width:620px){#${BUBBLE_ID}{right:calc(max(10px,env(safe-area-inset-right)) + 56px)!important;bottom:calc(var(--cw-themed-nav-height,58px) + env(safe-area-inset-bottom) + 10px)!important;width:48px!important;height:48px!important;min-width:48px!important;min-height:48px!important}#${HUMAN_SHELL_ID}{left:max(8px,env(safe-area-inset-left))!important;right:max(8px,env(safe-area-inset-right))!important;bottom:calc(var(--cw-themed-nav-height,58px) + env(safe-area-inset-bottom) + 8px)!important;width:auto!important;height:min(78dvh,720px)!important;border-radius:18px!important}}
@media(max-width:390px){#${BUBBLE_ID}{right:calc(max(10px,env(safe-area-inset-right)) + 54px)!important;width:46px!important;height:46px!important;min-width:46px!important;min-height:46px!important}}
`;document.head?.append(style)}

function guideApi(){return globalThis.CivweaveGuideChatSurfaceV350||globalThis.CivweavePersistentGuideChatV215||null}
function readGuideState(){try{return guideApi()?.state?.()||null}catch{return null}}
function ensureShell(){installStyle();let shell=document.getElementById(HUMAN_SHELL_ID);if(shell)return shell;shell=document.createElement('section');shell.id=HUMAN_SHELL_ID;shell.hidden=true;shell.setAttribute('aria-label','Human chats');shell.dataset.chatKind='human';document.body?.append(shell);return shell}
function setShellLoading(text='Opening human chats…'){const shell=ensureShell();if(!shell)return null;let loading=document.getElementById(HUMAN_LOADING_ID);if(!loading){loading=document.createElement('div');loading.id=HUMAN_LOADING_ID;shell.append(loading)}loading.textContent=text;shell.hidden=false;return shell}
function removeShellLoading(){document.getElementById(HUMAN_LOADING_ID)?.remove()}
function captureAiRestore(){if(shellActive)return;const state=readGuideState(),aiRoot=document.getElementById(ROOT_ID);aiRestoreState={open:Boolean(state?.open||aiRoot&&!aiRoot.hidden),guide:clean(state?.activeSystem||state?.activeWindow,80)}}
function closeAiIfHumanOpenedIt(){if(aiRestoreState.open)return;const api=guideApi();try{if(api?.state?.().open)api.close?.();else{const aiRoot=document.getElementById(ROOT_ID);if(aiRoot)aiRoot.hidden=true}}catch{}}
function restoreAiAfterHuman(){const api=guideApi();try{if(aiRestoreState.open&&!api?.state?.().open)api?.open?.({guide:aiRestoreState.guide||undefined,focus:false});else if(!aiRestoreState.open&&api?.state?.().open)api.close?.()}catch{}aiRestoreState={open:false,guide:''}}
function polishStandaloneSurface(){if(!shellActive)return false;const shell=ensureShell(),surface=document.getElementById(HUMAN_SURFACE_ID);if(!shell||!surface)return false;if(surface.parentElement!==shell)shell.append(surface);removeShellLoading();surface.hidden=false;surface.dataset.presentation='standalone-human-chat';shell.hidden=false;const back=surface.querySelector('[data-human-back]');if(back){if(back.textContent!=='Close')back.textContent='Close';back.setAttribute('aria-label','Close human chats');back.title='Close human chats'}document.getElementById(ROOT_ID)?.classList.remove('cwhuman-mode');closeAiIfHumanOpenedIt();if(shellObserver)try{shellObserver.disconnect()}catch{}shellObserver=new MutationObserver(()=>queueMicrotask(polishStandaloneSurface));shellObserver.observe(surface,{childList:true,subtree:true});return true}
function waitForHumanSurface(timeout=2400){const started=Date.now();return new Promise(resolve=>{const tick=()=>{const surface=document.getElementById(HUMAN_SURFACE_ID);if(surface){resolve(surface);return}if(Date.now()-started>=timeout){resolve(null);return}setTimeout(tick,24)};tick()})}
async function adoptHumanSurface(){const surface=await waitForHumanSurface();if(!surface){setShellLoading('Human chat is still loading. Try again in a moment.');return false}return polishStandaloneSurface()}
function closeStandalone({restoreAi=true}={}){if(!shellActive)return false;shellActive=false;try{globalThis.CivweaveHumanChatNetworkV1?.hide?.()}catch{}if(shellObserver)try{shellObserver.disconnect()}catch{}shellObserver=null;const shell=document.getElementById(HUMAN_SHELL_ID);if(shell)shell.hidden=true;document.getElementById(ROOT_ID)?.classList.remove('cwhuman-mode');if(restoreAi)restoreAiAfterHuman();else aiRestoreState={open:false,guide:''};queueMicrotask(()=>document.getElementById(BUBBLE_ID)?.focus?.({preventScroll:true}));return true}
function detailForItem(item){if(!item)return{source:'inbox'};if(item.source==='party')return{source:'party',threadId:item.threadId,messageId:item.messageId};if(item.source==='pm')return{source:'pm',threadId:item.threadId,username:item.threadId,messageId:item.messageId};return{source:'inbox'}}
async function waitForNetwork(timeout=2600){if(globalThis.CivweaveHumanChatNetworkV1?.show)return globalThis.CivweaveHumanChatNetworkV1;return new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;clearTimeout(timer);removeEventListener('civweave:human-chat-network-ready',ready);resolve(globalThis.CivweaveHumanChatNetworkV1||null)},ready=()=>finish(),timer=setTimeout(finish,timeout);addEventListener('civweave:human-chat-network-ready',ready,{once:true})})}
async function showStandalone(detail={}){if(openingPromise)return openingPromise;openingPromise=(async()=>{captureAiRestore();shellActive=true;setShellLoading();const api=await waitForNetwork();if(!api?.show){setShellLoading('Human chat could not start.');shellActive=false;return false}await api.show(detail||{});await adoptHumanSurface();return true})().finally(()=>{openingPromise=null});return openingPromise}

function ensureBubble(){installStyle();let button=document.getElementById(BUBBLE_ID);if(button)return button;button=document.createElement('button');button.id=BUBBLE_ID;button.type='button';button.setAttribute('aria-label','Human messages');button.innerHTML=`<span class="cw-human-face" aria-hidden="true">◇1</span><span id="${BADGE_ID}" hidden>0</span>`;button.addEventListener('click',()=>void openLatest());document.body?.append(button);return button}
function alignWithAi(button){const ai=document.getElementById(AI_LAUNCHER_ID);button.dataset.aiLauncherPresent=ai?'true':'false';if(!ai)return;const aiStyle=getComputedStyle(ai),accent=aiStyle.borderTopColor;if(accent)button.style.setProperty('--cw-human-accent',accent)}
function render(snapshot){lastSnapshot=snapshot;const button=ensureBubble(),badge=document.getElementById(BADGE_ID),latest=snapshot.latest;alignWithAi(button);const face=button.querySelector('.cw-human-face');if(latest){const [bg,fg]=avatarPalette(latest.sender.variant);button.style.setProperty('--cw-human-bg',bg);button.style.setProperty('--cw-human-fg',fg);if(latest.sender.avatarUrl){face.innerHTML=`<img src="${latest.sender.avatarUrl.replace(/["<>]/g,'')}" alt="">`}else face.textContent=latest.sender.glyph||'•';button.title=`${snapshot.unread} unread human message${snapshot.unread===1?'':'s'} · latest ${latest.sender.label}`;button.setAttribute('aria-label',`${snapshot.unread} unread human message${snapshot.unread===1?'':'s'}. Latest from ${latest.sender.label}.`)}else{button.style.setProperty('--cw-human-bg','#25283d');button.style.setProperty('--cw-human-fg','#f7f0d5');face.textContent='◇';button.title='Human messages';button.setAttribute('aria-label','Human messages. No unread messages.')}if(badge){badge.hidden=snapshot.unread<1;badge.textContent=snapshot.unread>99?'99+':String(snapshot.unread);badge.setAttribute('aria-label',`${snapshot.unread} unread`)}button.dataset.unread=String(snapshot.unread);button.dataset.latestSource=latest?.source||'';button.dataset.latestThread=latest?.threadId||'';try{dispatchEvent(new CustomEvent('civweave:human-message-attention',{detail:{unread:snapshot.unread,latest:latest?{source:latest.source,threadId:latest.threadId,messageId:latest.messageId,sender:latest.sender.label,at:latest.atIso}:null}}))}catch{}return snapshot}

async function snapshot(){const party=partyRows(),pm=await pmRows(),items=[...party.items,...pm.items].sort((a,b)=>b.at-a.at),latest=items.find(item=>item.unread)||items[0]||null;return{unread:party.unread+pm.unread,partyUnread:party.unread,pmUnread:pm.unread,latest,items}}
async function refresh(){refreshQueued=false;return render(await snapshot())}
function queueRefresh(){if(refreshQueued)return;refreshQueued=true;queueMicrotask(()=>void refresh())}
function markRead(item){if(!item)return false;const state=attentionState(),readAt=new Date(Math.max(Date.now(),item.at||0)).toISOString();if(item.source==='party')state.party={...(state.party||{}),[item.threadId]:{readAt,messageId:item.messageId}};else if(item.source==='pm')state.pm={...(state.pm||{}),[item.threadId]:{readAt,messageId:item.messageId}};saveAttention(state);queueRefresh();return true}
function markPartyVisibleRead(planId){if(!planId)return false;const pressed=document.querySelector(`[data-party-tab="${cssEscape(planId)}"][aria-pressed="true"]`),root=document.getElementById(ROOT_ID);if(!pressed||root?.hidden)return false;const party=partyStore()[planId],localId=party?.localParticipantId||'';const latest=(Array.isArray(party?.messages)?party.messages:[]).filter(row=>row?.kind==='human'&&row.participantId!==localId).sort((a,b)=>timeValue(b.at)-timeValue(a.at))[0];if(!latest)return false;return markRead({source:'party',threadId:planId,messageId:latest.id,at:timeValue(latest.at)})}

async function openParty(item){const shown=await showStandalone(detailForItem(item));if(shown)markRead(item);return shown}
async function openPm(item){const shown=await showStandalone(detailForItem(item));if(shown)markRead(item);return shown}
async function openLatest(){const current=lastSnapshot||await snapshot(),item=current.latest;if(!item)return showStandalone({source:'inbox'});if(item.source==='party')return openParty(item);return openPm(item)}
async function openBubbleTarget(button){const networkThread=clean(button?.dataset?.humanChatThread,180);if(networkThread)return showStandalone({source:'human-chat',threadId:networkThread});return openLatest()}

function bindStandaloneRouting(){
  if(document.documentElement.dataset.civweaveHumanStandaloneBound==='true')return;
  document.documentElement.dataset.civweaveHumanStandaloneBound='true';
  document.addEventListener('click',event=>{
    const target=event.target instanceof Element?event.target:null;if(!target)return;
    const close=target.closest(`#${HUMAN_SHELL_ID} [data-human-back]`);if(close){event.preventDefault();event.stopImmediatePropagation();closeStandalone();return}
    const ai=target.closest(`#${AI_LAUNCHER_ID}`);if(ai&&shellActive){closeStandalone({restoreAi:false});return}
    const bubble=target.closest(`#${BUBBLE_ID}`);if(!bubble)return;
    event.preventDefault();event.stopImmediatePropagation();void openBubbleTarget(bubble);
  },true);
  addEventListener('civweave:open-human-thread',event=>{captureAiRestore();shellActive=true;setShellLoading();queueMicrotask(()=>void adoptHumanSurface());setTimeout(()=>void adoptHumanSurface(),90)});
  addEventListener('keydown',event=>{if(event.key==='Escape'&&shellActive){event.preventDefault();closeStandalone()}});
}

function start(){ensureBubble();bindStandaloneRouting();['civweave:party-thread-changed','civweave:private-message','civweave:private-messaging-ready','civweave:shared-intention-party-ready','pageshow','online'].forEach(name=>addEventListener(name,queueRefresh));addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')queueRefresh()});document.addEventListener('click',event=>{const tab=event.target instanceof Element?event.target.closest('[data-party-tab]'):null;if(tab&&tab.getAttribute('data-party-tab')!=='private')setTimeout(()=>markPartyVisibleRead(tab.getAttribute('data-party-tab')),0)},true);const observer=new MutationObserver(()=>{const button=ensureBubble();alignWithAi(button);if(shellActive)queueMicrotask(polishStandaloneSurface)});observer.observe(document.documentElement,{childList:true,subtree:true});refreshTimer=setInterval(queueRefresh,5000);addEventListener('pagehide',()=>{clearInterval(refreshTimer);observer.disconnect();if(shellObserver)try{shellObserver.disconnect()}catch{}},{once:true});void refresh();globalThis.CivweaveHumanMessageBubbleV1=Object.freeze({version:VERSION,refresh,snapshot,openLatest,openHuman:showStandalone,closeHuman:closeStandalone,markRead,attentionKey:ATTENTION_KEY,bubbleId:BUBBLE_ID,standaloneShellId:HUMAN_SHELL_ID,humanSurfaceId:HUMAN_SURFACE_ID,aggregates:['party','pm'],readState:'local-only',pmAvatarFallback:'initial-until-encrypted-avatar-snapshot',presentation:'standalone-human-chat-v1',aiSurfaceReused:false});try{dispatchEvent(new CustomEvent('civweave:human-message-bubble-ready',{detail:{version:VERSION,presentation:'standalone-human-chat-v1'}}))}catch{}}

if(document.readyState==='loading')addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
