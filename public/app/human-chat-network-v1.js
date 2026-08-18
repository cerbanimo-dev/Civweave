(()=>{
'use strict';

const VERSION='1.0.0-human-chat-network-v1';
const ROOT_ID='cw-persistent-guide-chat-v215';
const AI_LAUNCHER_ID='cwp215-launcher';
const STYLE_ID='cw-human-chat-network-v1-style';
const SURFACE_ID='cw-human-chat-network-v1';
const CONTACTS_KEY='civweave.human-contacts.v1';
const GROUPS_KEY='civweave.human-groups.v1';
const UI_KEY='civweave.human-chat-ui.v1';
const ATTENTION_KEY='civweave.human-message-attention.v1';
const INTENTIONS_KEY='civweave.intentions.v127';
const PARTY_KEY='civweave.shared-intention-parties.v1';
const PROTOCOL_PREFIX='cwchat1:';
const MESSAGE_SCHEMA='civweave.human-chat.message.v1';
const GROUP_SCHEMA='civweave.human-chat.group.v1';
const CONTACT_SCHEMA='civweave.human-chat.contact.v1';
const MAX_MESSAGE_CHARS=6000;
const MAX_GROUP_MEMBERS=32;

if(globalThis.CivweaveHumanChatNetworkV1?.version===VERSION)return;

const clean=(value,max=4000)=>String(value??'').trim().slice(0,max);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const now=()=>new Date().toISOString();
const uid=prefix=>`${prefix}:${crypto.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`}`;
const time=value=>{const parsed=Date.parse(value||0);return Number.isFinite(parsed)?parsed:0};
let root=null;
let active=false;
let pmPromise=null;
let partyPromise=null;
let rendering=false;
let latestRows=[];
let pendingOpen=null;
let refreshTimer=0;
let pmPreviewOriginal=null;

function readObject(key,fallback={}){const value=parse(localStorage.getItem(key),fallback);return value&&typeof value==='object'&&!Array.isArray(value)?value:fallback}
function writeObject(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{}return value}
function contactsStore(){const value=readObject(CONTACTS_KEY,{schema:'civweave.human-contacts.store.v1',contacts:{}});if(!value.contacts||typeof value.contacts!=='object')value.contacts={};return value}
function saveContacts(value){return writeObject(CONTACTS_KEY,{...value,schema:'civweave.human-contacts.store.v1',updatedAt:now()})}
function groupsStore(){const value=readObject(GROUPS_KEY,{schema:'civweave.human-groups.store.v1',groups:{}});if(!value.groups||typeof value.groups!=='object')value.groups={};return value}
function saveGroups(value){return writeObject(GROUPS_KEY,{...value,schema:'civweave.human-groups.store.v1',updatedAt:now()})}
function uiState(){const value=readObject(UI_KEY,{openIds:[],activeId:'',contactsOpen:false,memberEditor:false});if(!Array.isArray(value.openIds))value.openIds=[];return value}
function saveUi(value){return writeObject(UI_KEY,{...value,updatedAt:now()})}
function attentionState(){const value=readObject(ATTENTION_KEY,{party:{},pm:{}});value.party=value.party&&typeof value.party==='object'?value.party:{};value.pm=value.pm&&typeof value.pm==='object'?value.pm:{};return value}
function saveAttention(value){return writeObject(ATTENTION_KEY,value)}
function normalizeUsername(value){const username=clean(value,32).toLowerCase();if(!/^[a-z0-9](?:[a-z0-9._-]{1,30}[a-z0-9])?$/.test(username)||username.includes('..'))throw new TypeError('Use a 3–32 character Civweave username.');return username}
function directId(a,b){return`direct:${[normalizeUsername(a),normalizeUsername(b)].sort().join(':')}`}
function normalizeMembers(members=[]){return [...new Set((Array.isArray(members)?members:[]).map(value=>{try{return normalizeUsername(value)}catch{return''}}).filter(Boolean))].slice(0,MAX_GROUP_MEMBERS)}

function installPmPreviewAdapter(){
  const current=globalThis.CivweavePrivateMessagingV1;if(!current||current.__humanChatPreviewV1)return current||null;
  const rawConversations=current.rawConversations||current.conversations?.bind(current);if(typeof rawConversations!=='function')return current;
  pmPreviewOriginal=current;
  const conversations=async()=>{const rows=await rawConversations();return(Array.isArray(rows)?rows:[]).map(row=>{const packet=decodeProtocol(row?.body);return packet?{...row,body:packet.text,chatPacket:packet,chatThreadId:packet.threadId,chatThreadKind:packet.threadKind,chatThreadTitle:packet.threadTitle}:row})};
  const wrapped=Object.freeze({...current,conversations,rawConversations,__humanChatPreviewV1:true});globalThis.CivweavePrivateMessagingV1=wrapped;return wrapped
}
function ensurePm(){
  if(globalThis.CivweavePrivateMessagingV1)return Promise.resolve(installPmPreviewAdapter());
  if(pmPromise)return pmPromise;
  pmPromise=new Promise((resolve,reject)=>{
    const path='/app/civweave-private-messaging-v1.js';
    const existing=[...document.scripts].find(script=>{try{return new URL(script.src,location.href).pathname===path}catch{return false}});
    const finish=()=>globalThis.CivweavePrivateMessagingV1?resolve(installPmPreviewAdapter()):reject(new Error('Private messaging loaded without its API.'));
    if(existing){if(globalThis.CivweavePrivateMessagingV1)finish();else{existing.addEventListener('load',finish,{once:true});setTimeout(finish,1600)}return}
    const script=document.createElement('script');script.src=path+'?v=human-chat-network-v1';script.async=false;script.addEventListener('load',finish,{once:true});script.addEventListener('error',()=>reject(new Error('Private messaging could not load.')),{once:true});document.head?.append(script);
  }).catch(error=>{pmPromise=null;throw error});
  return pmPromise;
}
function ensureParty(){
  if(globalThis.CivweaveSharedIntentionPartyChatV1)return Promise.resolve(globalThis.CivweaveSharedIntentionPartyChatV1);
  if(partyPromise)return partyPromise;
  partyPromise=new Promise(resolve=>{
    const done=()=>resolve(globalThis.CivweaveSharedIntentionPartyChatV1||null);
    addEventListener('civweave:shared-intention-party-ready',done,{once:true});
    try{dispatchEvent(new CustomEvent('civweave:party-activate-request',{detail:{source:'human-chat-network'}}))}catch{}
    setTimeout(done,1800);
  }).finally(()=>{partyPromise=null});
  return partyPromise;
}
async function selfIdentity(){try{return await (await ensurePm()).identity?.()||null}catch{return null}}

function encodeProtocol(packet){return PROTOCOL_PREFIX+JSON.stringify(packet)}
function decodeProtocol(body){const text=String(body??'');if(!text.startsWith(PROTOCOL_PREFIX))return null;try{const packet=JSON.parse(text.slice(PROTOCOL_PREFIX.length));return packet?.schema===MESSAGE_SCHEMA&&packet.messageId&&packet.threadId?packet:null}catch{return null}}
function messagePacket({messageId=uid('msg'),threadId,threadKind='direct',threadTitle='',sender,members=[],text,sentAt=now()}){return{schema:MESSAGE_SCHEMA,version:1,messageId,threadId:clean(threadId,180),threadKind:['direct','group','guild'].includes(threadKind)?threadKind:'group',threadTitle:clean(threadTitle,120),sender:normalizeUsername(sender),members:normalizeMembers(members),text:clean(text,MAX_MESSAGE_CHARS),sentAt,meshProfile:'small-encrypted-envelope',bluetoothFriendly:true}}

async function upsertContact(username,extra={}){
  const name=normalizeUsername(username),store=contactsStore(),existing=store.contacts[name]||{};
  store.contacts[name]={schema:CONTACT_SCHEMA,username:name,alias:clean(extra.alias||existing.alias||'',80),fingerprint:clean(extra.fingerprint||existing.fingerprint||'',96),trust:clean(extra.trust||existing.trust||'known',40),guildIds:[...new Set([...(existing.guildIds||[]),...(extra.guildIds||[])].map(value=>clean(value,160)).filter(Boolean))].slice(0,20),addedAt:existing.addedAt||now(),lastSeenAt:extra.lastSeenAt||existing.lastSeenAt||now(),updatedAt:now()};
  saveContacts(store);return store.contacts[name]
}
async function addContact(username,alias=''){
  const pm=await ensurePm(),name=normalizeUsername(username),identity=await pm.identity?.();if(identity?.username===name)throw new Error('That is your own Civweave username.');
  const contact=await pm.lookup(name);const saved=await upsertContact(name,{alias,fingerprint:contact?.fingerprint,trust:contact?.verifiedAt?'directory-verified':'cached'});await render();return saved
}
function removeContact(username){const name=normalizeUsername(username),store=contactsStore();delete store.contacts[name];saveContacts(store);void render();return true}
function listContacts(){return Object.values(contactsStore().contacts||{}).sort((a,b)=>String(a.alias||a.username).localeCompare(String(b.alias||b.username)))}

async function currentGuild(){
  try{
    const claim=globalThis.CivweaveHubMailClaimV1?.identity?.();
    const identity=claim&&typeof claim.then==='function'?await claim:claim;
    if(identity?.nodeId)return{id:`guild:${clean(identity.nodeId,140)}`,nodeId:clean(identity.nodeId,140),title:'Guild chat',host:clean(identity.host,260),userId:clean(identity.userId,180)};
  }catch{}
  try{
    const origin=globalThis.CivweaveHostNodeSessionV1?.selectedOrigin?.();
    const nodeId=clean(globalThis.CivweaveHostNodeSessionExportV1?.selectedNodeId?.()||document.documentElement.dataset.civweaveNodeId,140);
    if(nodeId)return{id:`guild:${nodeId}`,nodeId,title:'Guild chat',host:clean(origin,260),userId:''};
  }catch{}
  return null
}
async function ensureGuildGroup(){
  const guild=await currentGuild();if(!guild)return null;const groups=groupsStore(),existing=groups.groups[guild.id]||{};
  groups.groups[guild.id]={schema:GROUP_SCHEMA,id:guild.id,kind:'guild',title:clean(existing.title||guild.title,120)||'Guild chat',members:normalizeMembers(existing.members||[]),managed:true,source:'current-guild',guild:{nodeId:guild.nodeId,host:guild.host},createdAt:existing.createdAt||now(),updatedAt:now()};saveGroups(groups);return groups.groups[guild.id]
}
function createGroup(title,members=[]){const name=clean(title,120)||'Group chat',id=uid('group'),groups=groupsStore();groups.groups[id]={schema:GROUP_SCHEMA,id,kind:'group',title:name,members:normalizeMembers(members),managed:false,source:'contacts',createdAt:now(),updatedAt:now()};saveGroups(groups);openThread(id);return groups.groups[id]}
function updateGroupMembers(groupId,members=[]){const groups=groupsStore(),group=groups.groups[groupId];if(!group)return null;group.members=normalizeMembers(members);group.updatedAt=now();groups.groups[groupId]=group;saveGroups(groups);void render();return group}
function addMember(groupId,username){const group=groupsStore().groups[groupId];if(!group)return null;return updateGroupMembers(groupId,[...(group.members||[]),normalizeUsername(username)])}
function removeMember(groupId,username){const name=normalizeUsername(username),group=groupsStore().groups[groupId];if(!group)return null;return updateGroupMembers(groupId,(group.members||[]).filter(member=>member!==name))}

function intentionRows(){const rows=parse(localStorage.getItem(INTENTIONS_KEY),[]);return Array.isArray(rows)?rows:[]}
function sharedPartyDescriptors(){const parties=readObject(PARTY_KEY,{}),titles=new Map();for(const row of intentionRows()){const plan=row?.plan&&typeof row.plan==='object'?row.plan:row;if(plan?.id)titles.set(plan.id,clean(plan.title||plan.wish||'Party chat',120)||'Party chat')}return Object.entries(parties).filter(([,party])=>party&&typeof party==='object').map(([planId,party])=>({id:`party:${planId}`,kind:'party',planId,title:titles.get(planId)||'Party chat',updatedAt:party.updatedAt||'',managed:true,source:'party'})).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)))}

async function rawMessages(){try{const pm=await ensurePm();return await (pm.rawConversations?.()||pm.conversations?.())||[]}catch{return[]}}
async function normalizedMessages(){
  const identity=await selfIdentity(),self=identity?.username||'',rows=await rawMessages(),seen=new Set(),out=[];
  for(const row of rows){const decoded=decodeProtocol(row.body);if(decoded){
      const sender=clean(decoded.sender||row.from,32).toLowerCase();if(sender&&sender!==self)await upsertContact(sender,{trust:'conversation',lastSeenAt:row.receivedAt||row.createdAt||now()});
      if(['group','guild'].includes(decoded.threadKind)){const groups=groupsStore(),existing=groups.groups[decoded.threadId]||{};groups.groups[decoded.threadId]={schema:GROUP_SCHEMA,id:decoded.threadId,kind:decoded.threadKind,title:clean(decoded.threadTitle||existing.title||'Group chat',120),members:normalizeMembers([...(existing.members||[]),...(decoded.members||[]),sender,self]),managed:decoded.threadKind==='guild'||existing.managed===true,source:existing.source||'received',createdAt:existing.createdAt||decoded.sentAt||now(),updatedAt:row.receivedAt||row.createdAt||now()};saveGroups(groups)}
      if(seen.has(decoded.messageId))continue;seen.add(decoded.messageId);out.push({id:decoded.messageId,threadId:decoded.threadId,threadKind:decoded.threadKind,title:decoded.threadTitle||'',sender,text:clean(decoded.text,MAX_MESSAGE_CHARS),at:decoded.sentAt||row.createdAt||row.receivedAt,direction:sender===self?'out':'in',raw:row});continue
    }
    const other=row.direction==='in'?clean(row.from,32).toLowerCase():clean(row.to,32).toLowerCase();if(!other)continue;await upsertContact(other,{trust:'conversation',lastSeenAt:row.receivedAt||row.createdAt||now()});const id=directId(self||row.from,other);out.push({id:row.id,threadId:id,threadKind:'direct',title:`@${other}`,sender:clean(row.from,32).toLowerCase(),text:clean(row.body,MAX_MESSAGE_CHARS),at:row.createdAt||row.receivedAt,direction:row.direction,raw:row})
  }
  out.sort((a,b)=>time(a.at)-time(b.at));latestRows=out;return out
}
async function threadDescriptors(){
  const identity=await selfIdentity(),self=identity?.username||'',messages=await normalizedMessages(),map=new Map();
  for(const contact of listContacts()){if(!self)continue;const id=directId(self,contact.username);map.set(id,{id,kind:'direct',title:contact.alias||`@${contact.username}`,username:contact.username,members:[self,contact.username],managed:false,updatedAt:contact.lastSeenAt||contact.updatedAt||''})}
  for(const group of Object.values(groupsStore().groups||{}))map.set(group.id,{...group,id:group.id,kind:group.kind||'group',title:group.title||'Group chat'});
  for(const descriptor of sharedPartyDescriptors())map.set(descriptor.id,descriptor);
  for(const row of messages){const existing=map.get(row.threadId)||{id:row.threadId,kind:row.threadKind,title:row.title||'Chat',members:[]};if(row.threadKind==='direct'){const other=row.direction==='in'?row.sender:(row.raw?.to||'');existing.username=clean(other,32).toLowerCase();existing.title=existing.title||`@${existing.username}`}existing.updatedAt=row.at;map.set(row.threadId,existing)}
  return [...map.values()].sort((a,b)=>{const ak=a.kind==='guild'?3:a.kind==='party'?2:0,bk=b.kind==='guild'?3:b.kind==='party'?2:0;return bk-ak||String(b.updatedAt||'').localeCompare(String(a.updatedAt||''))||String(a.title).localeCompare(String(b.title))})
}
function descriptorById(rows,id){return rows.find(row=>row.id===id)||null}
function openThread(id){const ui=uiState();ui.activeId=id;ui.openIds=[id,...ui.openIds.filter(value=>value!==id)].slice(0,30);ui.contactsOpen=false;ui.memberEditor=false;saveUi(ui);void render();return id}
function closeThread(id){const ui=uiState();ui.openIds=ui.openIds.filter(value=>value!==id);if(ui.activeId===id)ui.activeId=ui.openIds[0]||'';saveUi(ui);void render();return true}
function markThreadRead(id){const state=attentionState(),readAt=now();state.pm={...(state.pm||{}),[id]:{readAt}};for(const row of latestRows)if(row.threadId===id&&row.direction==='in'&&row.sender)state.pm[row.sender]={readAt};saveAttention(state);try{globalThis.CivweaveHumanMessageBubbleV1?.refresh?.()}catch{}return true}

function installStyle(){if(document.getElementById(STYLE_ID))return;const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
#${ROOT_ID}.cwhuman-mode>.cw295-saved-chats,#${ROOT_ID}.cwhuman-mode>[data-log],#${ROOT_ID}.cwhuman-mode>[data-persistent-form]{display:none!important}
#${ROOT_ID}>#${SURFACE_ID}{grid-row:4/-1;min-height:0;min-width:0;display:grid;grid-template-rows:max-content max-content minmax(0,1fr) max-content;background:color-mix(in srgb,var(--guide-accent,#d8dde7) 6%,#080b11);border-top:1px solid #ffffff18;overflow:hidden}
#${SURFACE_ID}[hidden]{display:none!important}
#${SURFACE_ID} .cwhuman-toolbar{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto auto;gap:6px;align-items:center;padding:7px 8px;border-bottom:1px solid #ffffff16;background:#05070ba8}
#${SURFACE_ID} .cwhuman-toolbar strong{font:900 11px/1 system-ui;text-transform:uppercase;letter-spacing:.08em;color:#eef3f9}
#${SURFACE_ID} button,#${SURFACE_ID} input,#${SURFACE_ID} textarea{font:inherit}
#${SURFACE_ID} button{min-height:34px;border:1px solid #ffffff22;border-radius:10px;background:#ffffff0b;color:#e8edf5;padding:6px 9px;touch-action:manipulation}
#${SURFACE_ID} button:hover,#${SURFACE_ID} button:focus-visible{border-color:var(--guide-accent,#d8dde7)}
#${SURFACE_ID} .cwhuman-tabs{display:flex;gap:5px;align-items:center;min-width:0;overflow-x:auto;overflow-y:hidden;overscroll-behavior-x:contain;scroll-snap-type:x proximity;scrollbar-width:thin;padding:6px 8px;border-bottom:1px solid #ffffff16;background:#0003}
#${SURFACE_ID} .cwhuman-tabs button{position:relative;flex:0 0 auto;max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border-radius:999px;scroll-snap-align:start;padding-right:25px}
#${SURFACE_ID} .cwhuman-tabs button[aria-selected="true"]{border-color:var(--guide-accent,#d8dde7);background:color-mix(in srgb,var(--guide-accent,#d8dde7) 18%,#10141c);color:white}
#${SURFACE_ID} .cwhuman-tabs .cwhuman-tab-close{position:absolute;right:5px;top:50%;transform:translateY(-50%);width:18px;height:18px;min-height:18px;padding:0;border:0;background:transparent;color:#b7c0cd}
#${SURFACE_ID} .cwhuman-main{position:relative;min-height:0;overflow:hidden}
#${SURFACE_ID} .cwhuman-transcript{height:100%;overflow:auto;overscroll-behavior:contain;padding:10px;display:flex;flex-direction:column;gap:8px}
#${SURFACE_ID} .cwhuman-empty{margin:auto;max-width:34rem;padding:18px;text-align:center;color:#aeb8c6;font:600 12px/1.5 system-ui}
#${SURFACE_ID} .cwhuman-message{max-width:min(82%,42rem);padding:8px 10px;border:1px solid #ffffff18;border-radius:14px;background:#ffffff09;color:#eef2f8;font:500 13px/1.35 system-ui;white-space:pre-wrap;overflow-wrap:anywhere}
#${SURFACE_ID} .cwhuman-message[data-direction="out"]{align-self:flex-end;background:color-mix(in srgb,var(--guide-accent,#d8dde7) 15%,#0b1017)}
#${SURFACE_ID} .cwhuman-message header{margin-bottom:4px;color:#aeb8c6;font:800 10px/1.2 system-ui}
#${SURFACE_ID} .cwhuman-compose{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;padding:8px;border-top:1px solid #ffffff18;background:#05070bd9}
#${SURFACE_ID} .cwhuman-compose textarea{min-height:44px;max-height:120px;resize:vertical;border:1px solid #ffffff22;border-radius:12px;background:#080b11;color:#eef2f8;padding:9px 10px;outline:none}
#${SURFACE_ID} .cwhuman-compose textarea:focus{border-color:var(--guide-accent,#d8dde7)}
#${SURFACE_ID} .cwhuman-drawer{position:absolute;inset:0;z-index:3;display:grid;grid-template-rows:max-content minmax(0,1fr);background:#080b11f5;backdrop-filter:blur(8px)}
#${SURFACE_ID} .cwhuman-drawer[hidden]{display:none!important}
#${SURFACE_ID} .cwhuman-drawer-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:9px;border-bottom:1px solid #ffffff18}
#${SURFACE_ID} .cwhuman-contact-add{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto;gap:6px;padding:8px;border-bottom:1px solid #ffffff12}
#${SURFACE_ID} .cwhuman-contact-add input,#${SURFACE_ID} .cwhuman-group-title{min-height:34px;border:1px solid #ffffff22;border-radius:9px;background:#ffffff08;color:#eef2f8;padding:6px 8px}
#${SURFACE_ID} .cwhuman-contact-list{overflow:auto;padding:8px;display:flex;flex-direction:column;gap:6px}
#${SURFACE_ID} .cwhuman-contact{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:6px;align-items:center;padding:7px;border:1px solid #ffffff14;border-radius:10px;background:#ffffff06}
#${SURFACE_ID} .cwhuman-contact small{display:block;color:#8f99a8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#${SURFACE_ID} .cwhuman-group-builder{padding:8px;border-bottom:1px solid #ffffff12;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px}
#${SURFACE_ID} .cwhuman-notice{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#9eabbc;font:700 10px/1.2 system-ui}
@media(max-width:620px){#${SURFACE_ID} .cwhuman-toolbar{grid-template-columns:auto minmax(0,1fr) auto auto}#${SURFACE_ID} .cwhuman-toolbar>[data-human-back]{grid-column:1/-1;justify-self:start;min-height:28px}#${SURFACE_ID} .cwhuman-message{max-width:90%}#${SURFACE_ID} .cwhuman-contact-add{grid-template-columns:1fr 1fr}#${SURFACE_ID} .cwhuman-contact-add button{grid-column:1/-1}}
`;document.head?.append(style)}
function ensureSurface(){root=document.getElementById(ROOT_ID);if(!root)return null;installStyle();let surface=document.getElementById(SURFACE_ID);if(surface)return surface;surface=document.createElement('section');surface.id=SURFACE_ID;surface.hidden=true;surface.setAttribute('aria-label','Human chats');root.append(surface);surface.addEventListener('click',onClick);surface.addEventListener('submit',onSubmit);return surface}
function ensureRootOpen(){root=document.getElementById(ROOT_ID);if(root&&!root.hidden)return true;const launcher=document.getElementById(AI_LAUNCHER_ID);try{launcher?.click()}catch{};root=document.getElementById(ROOT_ID);return Boolean(root)}
function hideSurface(){active=false;root=document.getElementById(ROOT_ID);root?.classList.remove('cwhuman-mode');const surface=document.getElementById(SURFACE_ID);if(surface)surface.hidden=true;try{globalThis.CivweaveSavedChatUIV295?.render?.()}catch{}return true}

function partyMessages(planId){const party=readObject(PARTY_KEY,{})[planId],localId=party?.localParticipantId||'';return(Array.isArray(party?.messages)?party.messages:[]).filter(row=>row?.kind==='human').map(row=>({id:row.id,threadId:`party:${planId}`,threadKind:'party',title:'Party chat',sender:row.role?`@${row.role}`:'Party member',text:clean(row.text,MAX_MESSAGE_CHARS),at:row.at,direction:row.participantId===localId?'out':'in'}))}
function messagesFor(descriptor,messages){if(!descriptor)return[];if(descriptor.kind==='party')return partyMessages(descriptor.planId);return messages.filter(row=>row.threadId===descriptor.id)}
function tabLabel(row){if(row.kind==='guild')return`Guild · ${row.title||'chat'}`;if(row.kind==='party')return`Party · ${row.title||'chat'}`;return row.title||'Chat'}
function openIdsFor(rows){const ui=uiState(),auto=rows.filter(row=>row.kind==='guild'||row.kind==='party').map(row=>row.id),valid=new Set(rows.map(row=>row.id));const ids=[...new Set([...auto,...ui.openIds])].filter(id=>valid.has(id)).slice(0,30);if(ids.join('|')!==ui.openIds.join('|')){ui.openIds=ids;if(ui.activeId&&!valid.has(ui.activeId))ui.activeId='';saveUi(ui)}return ids}
function readCursor(threadId){return time(attentionState().pm?.[threadId]?.readAt)}
function unreadCount(threadId,messages){const cursor=readCursor(threadId);return messages.filter(row=>row.threadId===threadId&&row.direction==='in'&&time(row.at)>cursor).length}
function transcriptMarkup(descriptor,messages){const rows=messagesFor(descriptor,messages);if(!descriptor)return`<div class="cwhuman-empty">Open a contact, group, Guild chat, or Party chat.</div>`;if(!rows.length){const hint=descriptor.kind==='guild'?'This Guild chat is ready. Add contacts who belong in the Guild to start the encrypted conversation.':descriptor.kind==='party'?'No human Party messages yet.':descriptor.kind==='group'?'This group is empty. Add contacts or send the first message.':'No messages yet.';return`<div class="cwhuman-empty"><strong>${esc(tabLabel(descriptor))}</strong><br>${esc(hint)}</div>`}return rows.map(row=>`<article class="cwhuman-message" data-direction="${row.direction==='out'?'out':'in'}"><header>${esc(row.direction==='out'?'You':row.sender||'Human')} · ${esc(new Date(row.at||Date.now()).toLocaleString())}</header>${esc(row.text)}</article>`).join('')}
function contactDrawerMarkup(descriptor){const contacts=listContacts(),isGroup=descriptor&&['group','guild'].includes(descriptor.kind),members=new Set(descriptor?.members||groupsStore().groups[descriptor?.id]?.members||[]);return`<section class="cwhuman-drawer" data-human-drawer hidden><div><div class="cwhuman-drawer-head"><strong>${isGroup?'Contacts · group members':'Contacts'}</strong><button type="button" data-human-close-contacts>Done</button></div>${!isGroup?`<form class="cwhuman-contact-add" data-human-add-contact><input name="username" placeholder="Civweave username" required maxlength="32"><input name="alias" placeholder="Name / alias" maxlength="80"><button>Add contact</button></form><form class="cwhuman-group-builder" data-human-create-group><input class="cwhuman-group-title" name="title" placeholder="New group name" maxlength="120" required><button>Create group</button></form>`:''}</div><div class="cwhuman-contact-list">${contacts.length?contacts.map(contact=>`<div class="cwhuman-contact"><div><strong>${esc(contact.alias||`@${contact.username}`)}</strong><small>@${esc(contact.username)}${contact.fingerprint?` · ${esc(contact.fingerprint.slice(0,12))}…`:''}</small></div>${isGroup?`<button type="button" data-human-toggle-member="${esc(contact.username)}">${members.has(contact.username)?'Remove':'Add'}</button>`:`<button type="button" data-human-direct="${esc(contact.username)}">Message</button>`}<button type="button" data-human-remove-contact="${esc(contact.username)}" aria-label="Remove contact">×</button></div>`).join(''):`<div class="cwhuman-empty">No contacts yet. Add a Civweave username to verify and cache its key for offline-first messaging.</div>`}</div></section>`}
async function render(){
  if(!active)return false;const surface=ensureSurface();if(!surface)return false;await ensureGuildGroup();const [rows,messages]=await Promise.all([threadDescriptors(),normalizedMessages()]),ui=uiState(),ids=openIdsFor(rows);let descriptor=descriptorById(rows,ui.activeId);if(!descriptor&&ids.length){ui.activeId=ids[0];saveUi(ui);descriptor=descriptorById(rows,ui.activeId)}
  const currentMessages=messagesFor(descriptor,messages);if(descriptor)markThreadRead(descriptor.id);
  rendering=true;surface.innerHTML=`<div class="cwhuman-toolbar"><strong>Human chats</strong><span class="cwhuman-notice" data-human-notice>${esc(ui.notice||'Local mesh first · Cloudflare mail relay when online')}</span><button type="button" data-human-contacts>Contacts</button><button type="button" data-human-new-group>New group</button><button type="button" data-human-back>AI chats</button></div><nav class="cwhuman-tabs" aria-label="Open human chats">${ids.map(id=>{const row=descriptorById(rows,id),unread=unreadCount(id,messages);return`<button type="button" data-human-tab="${esc(id)}" aria-selected="${id===ui.activeId}" title="${esc(tabLabel(row))}">${esc(tabLabel(row))}${unread?` · ${unread}`:''}<span class="cwhuman-tab-close" data-human-close-tab="${esc(id)}" aria-hidden="true">×</span></button>`}).join('')}</nav><div class="cwhuman-main"><div class="cwhuman-transcript" data-human-transcript>${transcriptMarkup(descriptor,messages)}</div>${contactDrawerMarkup(descriptor)}</div><form class="cwhuman-compose" data-human-compose><textarea name="message" maxlength="${MAX_MESSAGE_CHARS}" placeholder="${descriptor?`Message ${esc(tabLabel(descriptor))}`:'Open a chat first'}" ${descriptor?'':'disabled'}></textarea><button ${descriptor?'':'disabled'}>Send</button></form>`;surface.hidden=false;root?.classList.add('cwhuman-mode');rendering=false;const transcript=surface.querySelector('[data-human-transcript]');if(transcript)transcript.scrollTop=transcript.scrollHeight;if(ui.contactsOpen)surface.querySelector('[data-human-drawer]')?.removeAttribute('hidden');return{rows,messages,descriptor,currentMessages}
}
function setNotice(text){const ui=uiState();ui.notice=clean(text,180);saveUi(ui);const node=document.querySelector(`#${SURFACE_ID} [data-human-notice]`);if(node)node.textContent=ui.notice;return ui.notice}
async function showSurface(detail={}){pendingOpen=detail||{};ensureRootOpen();const surface=ensureSurface();if(!surface)return false;active=true;surface.hidden=false;root?.classList.add('cwhuman-mode');await ensureGuildGroup();await syncContactsFromMessages();const source=clean(detail?.source,40),threadId=clean(detail?.threadId,180),username=clean(detail?.username||detail?.threadId,32).toLowerCase();if(source==='party'&&threadId)openThread(threadId.startsWith('party:')?threadId:`party:${threadId}`);else if((source==='pm'||source==='chat'||source==='human-chat')&&username&&/^[a-z0-9._-]+$/.test(username)){const identity=await selfIdentity();if(identity?.username)openThread(threadId.startsWith('direct:')||threadId.startsWith('group:')||threadId.startsWith('guild:')?threadId:directId(identity.username,username))}else if(threadId)openThread(threadId);pendingOpen=null;await render();return true}
async function syncContactsFromMessages(){try{await normalizedMessages()}catch{}return listContacts()}

async function sendDirect(descriptor,text){const pm=await ensurePm(),identity=await pm.identity?.();if(!identity?.username)throw new Error('Choose a private-messaging username in your Guild settings first.');const username=normalizeUsername(descriptor.username),packet=messagePacket({threadId:directId(identity.username,username),threadKind:'direct',threadTitle:`@${username}`,sender:identity.username,members:[identity.username,username],text});const result=await pm.send(username,encodeProtocol(packet));return{sent:1,meshed:result?.meshed?1:0,relayed:result?.relayed?1:0,packet}}
async function sendGroup(descriptor,text){const pm=await ensurePm(),identity=await pm.identity?.();if(!identity?.username)throw new Error('Choose a private-messaging username in your Guild settings first.');const group=groupsStore().groups[descriptor.id]||descriptor,members=normalizeMembers(group.members||[]).filter(member=>member!==identity.username);if(!members.length)throw new Error('Add at least one contact to this chat first.');const packet=messagePacket({threadId:descriptor.id,threadKind:descriptor.kind==='guild'?'guild':'group',threadTitle:descriptor.title||'Group chat',sender:identity.username,members:[identity.username,...members],text});let sent=0,meshed=0,relayed=0,failed=0;for(const member of members){try{const result=await pm.send(member,encodeProtocol(packet));sent++;if(result?.meshed)meshed++;if(result?.relayed)relayed++}catch{failed++}}if(!sent)throw new Error('The message could not reach any group member yet.');return{sent,meshed,relayed,failed,packet}}
async function sendParty(descriptor,text){const api=await ensureParty();if(!api?.submitParty)throw new Error('Party messaging is unavailable.');const planId=descriptor.planId||descriptor.id.replace(/^party:/,'');const planRows=intentionRows().map(row=>row?.plan&&typeof row.plan==='object'?row.plan:row),plan=planRows.find(row=>row?.id===planId);if(!plan)throw new Error('This Party no longer has a local Quest plan.');await api.submitParty(plan,text);return{sent:1,meshed:1,relayed:navigator.onLine?1:0,party:true}}
async function sendMessage(descriptor,text){const value=clean(text,MAX_MESSAGE_CHARS);if(!descriptor||!value)return null;if(descriptor.kind==='party')return sendParty(descriptor,value);if(descriptor.kind==='direct')return sendDirect(descriptor,value);return sendGroup(descriptor,value)}

async function onSubmit(event){if(rendering)return;const form=event.target;if(!(form instanceof HTMLFormElement))return;if(form.matches('[data-human-add-contact]')){event.preventDefault();const data=new FormData(form);setNotice('Verifying contact key…');try{await addContact(data.get('username'),data.get('alias'));setNotice('Contact cached for offline-first messaging.')}catch(error){setNotice(error?.message||'Contact could not be added.')}return}if(form.matches('[data-human-create-group]')){event.preventDefault();const data=new FormData(form),group=createGroup(data.get('title'),[]);setNotice(`Created ${group.title}. Add contacts from Contacts.`);await render();return}if(!form.matches('[data-human-compose]'))return;event.preventDefault();const textarea=form.querySelector('textarea'),text=clean(textarea?.value,MAX_MESSAGE_CHARS);if(!text)return;const rows=await threadDescriptors(),descriptor=descriptorById(rows,uiState().activeId);if(!descriptor)return;if(textarea){textarea.value='';textarea.disabled=true}setNotice('Sending over local mesh; online relay will catch up if available…');try{const result=await sendMessage(descriptor,text);setNotice(result?.failed?`Sent to ${result.sent}; ${result.failed} member${result.failed===1?'':'s'} still pending.`:`Sent · ${result?.meshed||0} local-mesh path${result?.meshed===1?'':'s'} · ${result?.relayed||0} relay path${result?.relayed===1?'':'s'}`)}catch(error){setNotice(error?.message||'Message could not be sent.')}finally{if(textarea)textarea.disabled=false;await render()}}
async function onClick(event){const target=event.target instanceof Element?event.target:null;if(!target)return;const closeTab=target.closest('[data-human-close-tab]');if(closeTab){event.preventDefault();event.stopPropagation();closeThread(closeTab.getAttribute('data-human-close-tab'));return}const tab=target.closest('[data-human-tab]');if(tab){openThread(tab.getAttribute('data-human-tab'));return}if(target.closest('[data-human-back]')){hideSurface();return}if(target.closest('[data-human-contacts]')){const ui=uiState();ui.contactsOpen=!ui.contactsOpen;ui.memberEditor=false;saveUi(ui);await render();return}if(target.closest('[data-human-new-group]')){const ui=uiState();ui.contactsOpen=true;ui.memberEditor=false;saveUi(ui);await render();document.querySelector(`#${SURFACE_ID} [name="title"]`)?.focus();return}if(target.closest('[data-human-close-contacts]')){const ui=uiState();ui.contactsOpen=false;saveUi(ui);await render();return}const direct=target.closest('[data-human-direct]');if(direct){const identity=await selfIdentity();if(!identity?.username){setNotice('Choose a private-messaging username in Guild settings first.');return}openThread(directId(identity.username,direct.getAttribute('data-human-direct')));return}const remove=target.closest('[data-human-remove-contact]');if(remove){removeContact(remove.getAttribute('data-human-remove-contact'));return}const toggle=target.closest('[data-human-toggle-member]');if(toggle){const rows=await threadDescriptors(),descriptor=descriptorById(rows,uiState().activeId);if(!descriptor||!['group','guild'].includes(descriptor.kind))return;const username=toggle.getAttribute('data-human-toggle-member'),group=groupsStore().groups[descriptor.id],members=new Set(group?.members||[]);if(members.has(username))removeMember(descriptor.id,username);else addMember(descriptor.id,username);await render();return}}

async function latestUnreadGroup(){const cursorState=attentionState(),rows=await rawMessages();let latest=null;for(const row of rows){if(row?.direction!=='in')continue;const packet=decodeProtocol(row.body);if(!packet||!['group','guild'].includes(packet.threadKind))continue;const cursor=time(cursorState.pm?.[packet.threadId]?.readAt),at=time(row.receivedAt||row.createdAt||packet.sentAt);if(at<=cursor)continue;if(!latest||at>latest.at)latest={packet,row,at}}return latest}
async function refreshBubbleBridge(){const latest=await latestUnreadGroup();if(!latest)return false;const button=document.getElementById('cw-human-message-launcher-v1');if(!button)return false;button.dataset.humanChatThread=latest.packet.threadId;button.title=`Human messages · latest ${latest.packet.threadTitle||'group chat'} from @${latest.packet.sender}`;button.setAttribute('aria-label',`Unread human group message in ${latest.packet.threadTitle||'group chat'} from ${latest.packet.sender}.`);return true}
function bind(){if(document.documentElement.dataset.civweaveHumanChatNetworkBound==='true')return;document.documentElement.dataset.civweaveHumanChatNetworkBound='true';addEventListener('civweave:open-human-thread',event=>void showSurface(event?.detail||{}));addEventListener('civweave:private-message',()=>{installPmPreviewAdapter();if(active)void render();try{globalThis.CivweaveHumanMessageBubbleV1?.refresh?.()}catch{};queueMicrotask(()=>void refreshBubbleBridge())});addEventListener('civweave:party-thread-changed',()=>{if(active)void render()});addEventListener('civweave:intentions-changed',()=>{if(active)void render()});addEventListener('civweave:host-node-selected',()=>{if(active)void render()});addEventListener('civweave:private-messaging-ready',()=>{installPmPreviewAdapter();queueMicrotask(()=>void refreshBubbleBridge())});addEventListener('civweave:human-message-attention',()=>queueMicrotask(()=>void refreshBubbleBridge()));document.addEventListener('click',event=>{const target=event.target instanceof Element?event.target.closest('#cw-human-message-launcher-v1'):null;if(!target)return;const threadId=clean(target.dataset.humanChatThread,180);if(!threadId)return;event.preventDefault();event.stopImmediatePropagation();void showSurface({source:'human-chat',threadId})},true);addEventListener('online',()=>{if(active)void render()});addEventListener('pageshow',()=>{if(active)void render()});refreshTimer=setInterval(()=>{if(active)void render()},8000);addEventListener('pagehide',()=>clearInterval(refreshTimer),{once:true})}
function boot(){installPmPreviewAdapter();bind();queueMicrotask(()=>void refreshBubbleBridge());document.documentElement.dataset.civweaveHumanChatNetwork='v1';try{dispatchEvent(new CustomEvent('civweave:human-chat-network-ready',{detail:{version:VERSION,transport:'pm-e2ee-mesh-mail-relay',bluetoothFriendly:true}}))}catch{}}

const api=Object.freeze({version:VERSION,protocolPrefix:PROTOCOL_PREFIX,messageSchema:MESSAGE_SCHEMA,contactSchema:CONTACT_SCHEMA,groupSchema:GROUP_SCHEMA,maxMessageChars:MAX_MESSAGE_CHARS,maxGroupMembers:MAX_GROUP_MEMBERS,show:showSurface,hide:hideSurface,render,contacts:listContacts,addContact,removeContact,createGroup,addMember,removeMember,openThread,closeThread,threads:threadDescriptors,messages:normalizedMessages,send:sendMessage,encodeProtocol,decodeProtocol,transport:'end-to-end-encrypted-private-message-fanout-over-local-mesh-plus-cloudflare-mail-relay',bluetoothMeshFriendly:true,actualBrowserBleTransport:false,autoThreads:['guild','party'],scrollableTabs:true});
globalThis.CivweaveHumanChatNetworkV1=api;
if(document.readyState==='loading')addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
