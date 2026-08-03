(()=>{
'use strict';
const VERSION='1.0.31';
const BUILD='1.0.31-guide-orchestration-v141';
const SETTINGS_KEY='commonweave.universal-ai.v127';
const GUIDE_ART={
  'living-school':{image:'/app/assets/ai/moss.png',artifact:'/app/assets/ai/moss-acorn.png',role:'learning guide'},
  cerbanimo:{image:'/app/assets/ai/kamiya.png',artifact:'/app/assets/ai/kamiya-gift.png',role:'questwright and skilled-work guide'},
  fellowfare:{image:'/app/assets/ai/rook.png',artifact:'/app/assets/ai/rook-coin-button.png',role:'quartermaster and exchange guide'},
  anarchadia:{image:'/app/assets/ai/merlin.png',artifact:'/app/assets/ai/merlin-hat.png',role:'civic and automation guide'}
};
const pathParts=location.pathname.split('/').filter(Boolean);
const realmId=pathParts[pathParts.indexOf('realm')+1]||'living-school';
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const parse=(value,fallback)=>{try{const parsed=JSON.parse(value);return parsed==null?fallback:parsed}catch{return fallback}};
let ledger=null,realm=null,rooms=[],currentRoom=null,toastTimer=null;

function report(kind,detail={}){
  const event={schema:'commonweave.boot-log.v1',time:new Date().toISOString(),version:VERSION,build:BUILD,kind:`v141-realm:${kind}`,url:location.href,detail:{realm:realmId,...detail}};
  console.info('[CW141-REALM]',event);
  try{fetch('/api/boot-log',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(event),keepalive:true,cache:'no-store'}).catch(()=>{})}catch{}
  return event;
}
function toast(message){
  const node=document.querySelector('#cw127-toast');
  if(!node)return;
  node.textContent=message;node.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{node.hidden=true},4200);
}
function show(node){if(!node)return;if(typeof node.showModal==='function'){if(!node.open)node.showModal()}else node.setAttribute('open','')}
function close(node){if(!node)return;if(typeof node.close==='function'&&node.open)node.close();else node.removeAttribute('open')}
function dialog(id,html,className=''){
  let node=document.getElementById(id);
  if(!node){node=document.createElement('dialog');node.id=id;document.body.append(node)}
  node.className=`cw127-dialog ${className}`.trim();
  delete node.dataset.cw141AssistantAttached;
  node.innerHTML=html;
  node.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>close(node)));
  node.addEventListener('click',event=>{if(event.target===node)close(node)},{once:true});
  return node;
}
function roomById(id){return rooms.find(room=>room.id===id)||rooms[0]||null}
function capabilityById(id){const capability=ledger?.index?.capabilities?.get?.(id);return capability?.system===realm?.id?capability:null}
function roomUrl(roomId,capabilityId=''){const query=new URLSearchParams();query.set('room',roomId);if(capabilityId)query.set('capability',capabilityId);return `${location.pathname}?${query}`}
function setRoom(roomId,{replace=false,openCapabilityId=''}={}){
  currentRoom=roomById(roomId);if(!currentRoom)return;
  localStorage.setItem(`commonweave.realm-room.${realm.id}`,currentRoom.id);
  const image=document.querySelector('#cw127-realm-scene');if(image){image.src=currentRoom.visualAsset;image.alt=`${realm.name}: ${currentRoom.label}`}
  const status=document.querySelector('#cw127-realm-status');if(status)status.textContent=`${realm.name} · ${currentRoom.label} · ${currentRoom.capabilityIds.length} mapped capabilities`;
  history[replace?'replaceState':'pushState']({room:currentRoom.id,capability:openCapabilityId},'',roomUrl(currentRoom.id,openCapabilityId));
  renderNav();report('room-opened',{room:currentRoom.id,capabilities:currentRoom.capabilityIds.length});
  if(openCapabilityId){const capability=capabilityById(openCapabilityId);if(capability?.room===currentRoom.id)setTimeout(()=>openCapability(capability.id),30)}
}
function renderNav(){
  if(!currentRoom||!rooms.length)return;
  const index=rooms.findIndex(room=>room.id===currentRoom.id),prev=rooms[(index-1+rooms.length)%rooms.length],next=rooms[(index+1)%rooms.length],guide=GUIDE_ART[realm.id];
  const nav=document.querySelector('#cw127-realm-nav');if(!nav)return;
  nav.innerHTML=`<button data-room="${esc(prev.id)}" aria-label="Previous room: ${esc(prev.label)}"><img src="${esc(prev.visualAsset)}" alt=""><span>← ${esc(prev.label)}</span></button><button data-action="rooms" aria-label="Browse all rooms"><img src="/app/assets/generated/commonweave-navigation-icons/commonweave-realms.png" alt=""><span>Rooms</span></button><button data-action="room" aria-label="Open ${esc(currentRoom.label)} capabilities"><img src="${esc(currentRoom.visualAsset)}" alt=""><span>${esc(currentRoom.label)}</span></button><button data-action="guide" aria-label="Talk with ${esc(realm.guide)}"><img src="${esc(guide.artifact)}" alt=""><span>${esc(realm.guide)}</span></button><button data-room="${esc(next.id)}" aria-label="Next room: ${esc(next.label)}"><img src="${esc(next.visualAsset)}" alt=""><span>${esc(next.label)} →</span></button>`;
}
function roomsDialog(){
  const node=dialog('cw128-rooms',`<section><header><div><small>${esc(realm.name.toUpperCase())}</small><h2>Choose a room</h2><p>Every room carries the same canonical IDs into Visual and Lite.</p></div><button class="cw127-close" data-close aria-label="Close">×</button></header><div class="cw127-card-grid">${rooms.map(room=>`<button class="cw127-card" data-open-room="${esc(room.id)}" style="background-image:url('${esc(room.visualAsset)}')"><b>${esc(room.label)}</b><span>${esc(room.purpose)}</span></button>`).join('')}</div></section>`);
  node.querySelectorAll('[data-open-room]').forEach(button=>button.addEventListener('click',()=>{close(node);setRoom(button.dataset.openRoom)}));show(node);
}
function roomDialog(){
  const caps=(currentRoom?.capabilityIds||[]).map(capabilityById).filter(Boolean);
  const node=dialog('cw128-room',`<section><header><div><small>${esc(realm.name.toUpperCase())} · ${esc(currentRoom.label.toUpperCase())}</small><h2>${esc(currentRoom.label)}</h2><p>${esc(currentRoom.purpose)}</p></div><button class="cw127-close" data-close aria-label="Close">×</button></header><div class="cw128-room-grid">${caps.map(capability=>`<article class="cw128-capability cw128-consent-${esc(capability.consent)}"><span class="cw128-chip">${esc(capability.consent)} consent</span><h3>${esc(capability.label)}</h3><p>${esc(capability.summary)}</p><footer><button data-capability="${esc(capability.id)}">Inspect</button>${capability.lite?.sourceRoute?`<button data-source="${esc(capability.id)}">Open tool</button>`:''}</footer></article>`).join('')||'<p>No capabilities are mapped to this room yet.</p>'}</div><menu><a href="${esc(CommonweaveParity.liteUrl({systemId:realm.id,roomId:currentRoom.id}))}">Open same room in Lite</a></menu></section>`);
  node.querySelectorAll('[data-capability]').forEach(button=>button.addEventListener('click',()=>openCapability(button.dataset.capability)));
  node.querySelectorAll('[data-source]').forEach(button=>button.addEventListener('click',()=>openSource(button.dataset.source)));
  show(node);report('dialog-opened',{dialog:'room',room:currentRoom.id});
}
function openCapability(id){
  const capability=capabilityById(id);if(!capability)return toast('Capability mapping is unavailable.');
  if(capability.room!==currentRoom.id){setRoom(capability.room,{openCapabilityId:id});return}
  const node=dialog('cw128-capability',`<section><header><div><small>${esc(currentRoom.label.toUpperCase())} · ${esc(String(capability.consent||'').toUpperCase())} CONSENT</small><h2>${esc(capability.label)}</h2><p>${esc(capability.summary)}</p></div><button class="cw127-close" data-close aria-label="Close">×</button></header><div class="cw128-room-grid"><article class="cw128-capability"><h3>Parity record</h3><p><b>Canonical ID:</b> ${esc(capability.id)}</p><p><b>Operation:</b> ${esc(capability.operation)}</p><p><b>Source:</b> ${esc(capability.sourceStatus)}</p><p><b>Handoffs:</b> ${esc((capability.handoffs||[]).join(', ')||'none')}</p><p><b>Rewards:</b> ${esc((capability.rewards||[]).join(', ')||'none')}</p></article><article class="cw128-capability"><h3>Source references</h3><p>${(capability.sourceRefs||[]).map(esc).join('<br>')}</p></article></div><menu>${capability.lite?.sourceRoute?`<button type="button" data-source="${esc(capability.id)}">Open working surface</button>`:''}<a href="${esc(CommonweaveParity.liteUrl({systemId:realm.id,roomId:currentRoom.id,capabilityId:capability.id}))}">Open in Lite</a></menu></section>`);
  node.querySelector('[data-source]')?.addEventListener('click',()=>openSource(capability.id));show(node);history.replaceState({room:currentRoom.id,capability:id},'',roomUrl(currentRoom.id,id));report('capability-opened',{capability:id,consent:capability.consent});
}
function openSource(id){
  const capability=capabilityById(id),url=capability?.lite?.sourceRoute;if(!url)return toast('No working source surface is connected yet.');
  const node=dialog('cw128-source',`<section><header><div><small>IN-WORLD WORKING SURFACE</small><h2>${esc(capability.label)}</h2></div><button class="cw127-close" data-close aria-label="Close">×</button></header><p>The canonical functional surface is embedded while its controls migrate onto room objects.</p><iframe title="${esc(capability.label)} working source" src="${esc(url)}"></iframe><menu><a href="${esc(url)}" target="_blank" rel="noopener">Open separately</a><button type="button" data-close>Close</button></menu></section>`,'cw128-source-dialog');show(node);report('source-opened',{capability:id,url});
}
function settings(){
  const saved=parse(localStorage.getItem(SETTINGS_KEY),{route:'bundled',model:'Xenova/all-MiniLM-L6-v2',endpoint:'',consent:false});
  const node=dialog('cw128-settings',`<form method="dialog"><header><div><small>UNIVERSAL AI SETTINGS</small><h2>One selected mind across the campus</h2></div><button class="cw127-close" data-close value="cancel" aria-label="Close">×</button></header><label>Route<select name="route"><option value="bundled">Private local reflex</option><option value="gemini">Gemini</option><option value="ollama">Ollama or local API</option><option value="openai-compatible">OpenAI-compatible endpoint</option></select></label><label>Model<input name="model" maxlength="200"></label><label>Endpoint<input name="endpoint" maxlength="2048"></label><label><span><input name="consent" type="checkbox"> Allow remote prompts</span></label><menu><button type="button" data-save>Save</button></menu><output role="status"></output></form>`);
  const form=node.querySelector('form');form.route.value=saved.provider||saved.route||'bundled';form.model.value=saved.model||'';form.endpoint.value=saved.endpoint||'';form.consent.checked=Boolean(saved.externalConsent??saved.consent);
  form.querySelector('[data-save]').addEventListener('click',()=>{const next={provider:form.route.value,route:form.route.value,model:form.model.value.trim()||'Xenova/all-MiniLM-L6-v2',endpoint:form.endpoint.value.trim(),consent:form.consent.checked,externalConsent:form.consent.checked};localStorage.setItem(SETTINGS_KEY,JSON.stringify(next));form.querySelector('output').textContent='Saved for Weaveling and all four guides.';report('settings-saved',{route:next.route,model:next.model,hasEndpoint:Boolean(next.endpoint),consent:next.consent});setTimeout(()=>close(node),500)});show(node);
}
function guide(){
  const art=GUIDE_ART[realm.id];
  const node=dialog('cw128-guide',`<section><header><div><small>${esc(realm.name.toUpperCase())}</small><h2>Talk with ${esc(realm.guide)}</h2><p>${esc(currentRoom.label)} is context, not the guide’s identity.</p></div><button class="cw127-close" data-close aria-label="Close">×</button></header><div class="cw127-chat-log" aria-live="polite"></div><form class="cw127-chat-form"><textarea maxlength="8000" placeholder="What needs attention in ${esc(realm.name)}?"></textarea><button type="submit">Send</button></form><menu><button type="button" data-room-map>Room capabilities</button><button type="button" data-settings>Universal AI settings</button></menu></section>`);
  node.querySelector('[data-settings]').addEventListener('click',settings);node.querySelector('[data-room-map]').addEventListener('click',roomDialog);
  if(!globalThis.CommonweaveAssistantV141?.attach?.(node))toast(`${realm.guide}'s orchestration runtime has not loaded.`);
  show(node);setTimeout(()=>node.querySelector('textarea')?.focus(),50);report('dialog-opened',{dialog:'guide',guide:realm.guide,room:currentRoom.id,role:art.role});
}
function info(){
  const validation=CommonweaveParity.validate(ledger),node=dialog('cw128-info',`<section><header><div><small>PARITY LEDGER</small><h2>One campus, two renderers</h2></div><button class="cw127-close" data-close aria-label="Close">×</button></header><p>${esc(ledger.purpose)}</p><div class="cw128-room-grid"><article class="cw128-capability"><h3>${validation.counts.rooms} rooms</h3><p>Visual and Lite use the same room IDs.</p></article><article class="cw128-capability"><h3>${validation.counts.capabilities} capabilities</h3><p>Each carries consent, source, handoffs, rewards, and renderer mappings.</p></article></div><menu><a href="${esc(CommonweaveParity.liteUrl({systemId:realm.id,roomId:currentRoom.id}))}">Open Lite mirror</a></menu></section>`);show(node);
}
function version(){const node=dialog('cw128-version',`<section><header><div><small>${esc(realm.name.toUpperCase())}</small><h2>v${VERSION}</h2></div><button class="cw127-close" data-close aria-label="Close">×</button></header><p>Build: <code>${BUILD}</code></p><p>Ledger: <code>${esc(ledger.schema)}</code></p><p>Room: <strong>${esc(currentRoom.label)}</strong></p></section>`);show(node)}
function mountRealm(){
  const guide=GUIDE_ART[realm.id];document.title=`${realm.name} · Commonweave`;document.documentElement.style.setProperty('--realm-accent',realm.accent);
  const logo=document.querySelector('#cw127-realm-logo');if(logo){logo.src=realm.logo;logo.alt=`${realm.name} logo`}
  const guideButton=document.querySelector('#cw127-realm-guide');if(guideButton){guideButton.querySelector('img').src=guide.image;guideButton.querySelector('img').alt=realm.guide}
  const query=new URLSearchParams(location.search),saved=localStorage.getItem(`commonweave.realm-room.${realm.id}`);setRoom(query.get('room')||saved||rooms[0].id,{replace:true,openCapabilityId:query.get('capability')||''});
  localStorage.setItem('commonweave.host-build',BUILD);document.documentElement.dataset.commonweaveBuild=BUILD;report('page-ready',{room:currentRoom.id,capabilities:ledger.capabilities.filter(item=>item.system===realm.id).length});
}
document.addEventListener('click',event=>{
  const control=event.target.closest('[data-action],[data-room]');if(!control)return;const action=control.dataset.action;
  try{
    if(control.dataset.room){setRoom(control.dataset.room);return}
    if(action==='back'){location.assign('/loom/');return}
    if(action==='room'){roomDialog();return}
    if(action==='rooms'){roomsDialog();return}
    if(action==='guide'){guide();return}
    if(action==='settings'){settings();return}
    if(action==='info'){info();return}
    if(action==='version'){version();return}
    if(action==='lite'){location.assign(CommonweaveParity.liteUrl({systemId:realm.id,roomId:currentRoom.id}));return}
  }catch(error){report('control-error',{action,message:error.message});toast(`That control hit an error: ${error.message}`)}
});
addEventListener('popstate',event=>{const query=new URLSearchParams(location.search);setRoom(event.state?.room||query.get('room')||rooms[0].id,{replace:true,openCapabilityId:event.state?.capability||query.get('capability')||''})});
addEventListener('error',event=>report('window-error',{message:event.message,filename:event.filename,line:event.lineno,column:event.colno}));
addEventListener('unhandledrejection',event=>report('unhandled-rejection',{reason:event.reason?.message||String(event.reason)}));
CommonweaveParity.load().then(value=>{ledger=value;realm=ledger.index.systems.get(realmId);if(!realm||realm.id==='commonweave')throw new Error(`Unknown realm ${realmId}`);rooms=realm.rooms;mountRealm()}).catch(error=>{const status=document.querySelector('#cw127-realm-status');if(status)status.textContent=`Parity ledger error: ${error.message}`;report('mount-error',{message:error.message})});
globalThis.CommonweaveRealmV141={guide,dialog,roomDialog,openCapability,openSource,setRoom};
})();