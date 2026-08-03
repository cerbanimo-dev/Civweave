(()=>{
'use strict';
const VERSION='1.0.31';
const BUILD='1.0.31-cabinet-mode-v142';
const SETTINGS_KEY='commonweave.universal-ai.v127';
const CHAT_KEY='commonweave.weaveling-chat.v127';
const MODES=['Reflect','Plan','Learn','Build','Acquire','Govern'];
const REALMS={
  'living-school':{name:'Living School',copy:'Learning paths, curriculum, practice, reflection, and credentials.',image:'/app/assets/cabinets/living-school.webp'},
  cerbanimo:{name:'Cerbanimo',copy:'Skilled work, quests, projects, proof, and completion.',image:'/app/assets/cabinets/cerbanimo.webp'},
  fellowfare:{name:'FellowFare',copy:'Needs, offers, exchanges, resources, makers, and logistics.',image:'/app/assets/cabinets/fellowfare.webp'},
  anarchadia:{name:'Anarchadia',copy:'Proposals, bugs, assemblies, consent, federation, and governance.',image:'/app/assets/cabinets/anarchadia.webp'}
};
const parse=(value,fallback)=>{try{const parsed=JSON.parse(value);return parsed==null?fallback:parsed}catch{return fallback}};
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[char]));
let toastTimer=null;
function report(kind,detail={}){
  const event={schema:'commonweave.boot-log.v1',time:new Date().toISOString(),version:VERSION,build:BUILD,kind:`v142-loom:${kind}`,url:location.href,detail};
  console.info('[CW142-LOOM]',event);
  try{fetch('/api/boot-log',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(event),keepalive:true,cache:'no-store'}).catch(()=>{})}catch{}
  return event;
}
function toast(message){const node=document.querySelector('#cw127-toast');if(!node)return;node.textContent=message;node.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{node.hidden=true},4200)}
function show(node){if(!node)return;if(typeof node.showModal==='function'){if(!node.open)node.showModal()}else node.setAttribute('open','')}
function close(node){if(!node)return;if(typeof node.close==='function'&&node.open)node.close();else node.removeAttribute('open')}
function dialog(id,html){
  let node=document.getElementById(id);
  if(!node){node=document.createElement('dialog');node.id=id;node.className='cw127-dialog';document.body.append(node)}
  delete node.dataset.cw141AssistantAttached;
  node.innerHTML=html;
  node.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>close(node)));
  node.addEventListener('click',event=>{if(event.target===node)close(node)},{once:true});
  return node;
}
function settings(){
  const saved=parse(localStorage.getItem(SETTINGS_KEY),{route:'bundled',model:'Xenova/all-MiniLM-L6-v2',endpoint:'',consent:false});
  const node=dialog('cw127-settings',`<form method="dialog"><header><div><small>UNIVERSAL AI SETTINGS</small><h2>Choose the Compass mind</h2></div><button class="cw127-close" data-close value="cancel" aria-label="Close">×</button></header><label>Route<select name="route"><option value="bundled">Private local reflex</option><option value="gemini">Gemini</option><option value="ollama">Ollama or local API</option><option value="openai-compatible">OpenAI-compatible endpoint</option></select></label><label>Model<input name="model" maxlength="200"></label><label>Endpoint<input name="endpoint" maxlength="2048" placeholder="Optional for local or compatible providers"></label><label><span><input name="consent" type="checkbox"> Allow remote prompts for the selected provider</span></label><p>The setting is shared by Weaveling and every realm guide. Consequential actions still require explicit approval.</p><menu><button type="button" data-save>Save settings</button></menu><output role="status"></output></form>`);
  const form=node.querySelector('form');form.route.value=saved.provider||saved.route||'bundled';form.model.value=saved.model||'';form.endpoint.value=saved.endpoint||'';form.consent.checked=Boolean(saved.externalConsent??saved.consent);
  form.querySelector('[data-save]').addEventListener('click',()=>{const next={provider:form.route.value,route:form.route.value,model:form.model.value.trim()||'Xenova/all-MiniLM-L6-v2',endpoint:form.endpoint.value.trim(),consent:form.consent.checked,externalConsent:form.consent.checked};localStorage.setItem(SETTINGS_KEY,JSON.stringify(next));form.querySelector('output').textContent='Saved for Weaveling and every realm guide.';report('settings-saved',{route:next.route,model:next.model,hasEndpoint:Boolean(next.endpoint),consent:next.consent});setTimeout(()=>close(node),450)});
  show(node);report('dialog-opened',{dialog:'settings'});
}
function chat(){
  const history=parse(localStorage.getItem(CHAT_KEY),[]),node=dialog('cw127-chat',`<section><header><div><small>WEAVELING’S COMPASS</small><h2>What is your wish?</h2></div><button class="cw127-close" data-close aria-label="Close">×</button></header><div class="cw127-chat-log" aria-live="polite"></div><form class="cw127-chat-form"><textarea aria-label="Message Weaveling" maxlength="8000" placeholder="Share an intention, problem, or possibility…"></textarea><button type="submit">Send</button></form><menu><button type="button" data-settings>Universal AI settings</button><button type="button" data-clear>Clear conversation</button></menu></section>`);
  node.querySelector('[data-settings]').addEventListener('click',settings);
  node.querySelector('[data-clear]').addEventListener('click',()=>{localStorage.removeItem(CHAT_KEY);close(node);node.remove();report('chat-cleared');setTimeout(chat,0)});
  if(!globalThis.CommonweaveAssistantV141?.attach?.(node))toast('Weaveling’s orchestration runtime has not loaded.');
  show(node);setTimeout(()=>node.querySelector('textarea')?.focus(),60);report('dialog-opened',{dialog:'chat',history:Array.isArray(history)?history.length:0});
}
function intentions(){
  if(globalThis.CommonweaveIntentionUI?.open){globalThis.CommonweaveIntentionUI.open();return}
  toast('The intention review controls have not loaded yet.');
}
function realms(){
  const cards=Object.entries(REALMS).map(([id,item])=>`<button class="cw127-card" data-realm="${id}" style="background-image:url('${item.image}')"><b>${item.name}</b><span>${item.copy}</span></button>`).join('');
  const node=dialog('cw127-realms',`<section><header><div><small>CABINET MODE</small><h2>Choose a cabinet</h2></div><button class="cw127-close" data-close aria-label="Close">×</button></header><div class="cw127-card-grid">${cards}</div></section>`);show(node);report('dialog-opened',{dialog:'cabinets'});
}
function info(){const node=dialog('cw127-info',`<section><header><div><small>COMMONWEAVE v${VERSION}</small><h2>One intention, four working systems</h2></div><button class="cw127-close" data-close aria-label="Close">×</button></header><p>Weaveling coordinates intentions. Moss turns knowledge gaps into learning. Kamiya turns work into quests. Rook creates needs, offers, and exchange drafts. Merlin turns civic changes into official requests, consent gates, and tested rails.</p><p>Cabinet Mode and Lite share the same parity ledger, consent rules, handoffs, and saved local state.</p><menu><a href="/lite/?system=commonweave">Open Lite mirror</a><a href="/diagnostics.html">Boot diagnostics</a></menu></section>`);show(node);report('dialog-opened',{dialog:'info'})}
function version(){const node=dialog('cw127-version-dialog',`<section><header><div><small>RELEASE STATE</small><h2>Commonweave v${VERSION}</h2></div><button class="cw127-close" data-close aria-label="Close">×</button></header><p>Build: <code>${BUILD}</code></p><p>This release keeps the main Commonweave hub, moves realm work into calibrated cabinets, and excludes the archived room-location image trees from downloadable builds.</p><menu><a href="/api/health" target="_blank" rel="noopener">Host health</a><a href="/diagnostics.html">Diagnostics</a></menu></section>`);show(node);report('dialog-opened',{dialog:'version'})}
function enterRealm(id){if(!REALMS[id])return;report('cabinet-enter',{realm:id});location.assign(CommonweaveParity.cabinetUrl({systemId:id,from:'hub'}))}
async function retireLegacy(){
  try{
    const registrations=await navigator.serviceWorker?.getRegistrations?.()||[];
    const old=registrations.filter(reg=>{const path=new URL(reg.scope).pathname;return path.startsWith('/app/')||path.startsWith('/campus/')||/\/services\//.test(path)});
    for(const reg of old){const result=await reg.unregister();report('legacy-worker-unregistered',{scope:reg.scope,result})}
    const keys=await caches.keys(),stale=keys.filter(key=>key.startsWith('commonweave-pocket-campus-')||/^(living-school|cerbanimo|fellowfare|anarchadia)-/.test(key));
    for(const key of stale){const result=await caches.delete(key);report('legacy-cache-deleted',{key,result})}
  }catch(error){report('legacy-retirement-failed',{message:error.message})}
}
document.addEventListener('click',event=>{
  const control=event.target.closest('[data-action],[data-realm]');if(!control)return;
  const action=control.dataset.action,realm=control.dataset.realm;report('control-click',{action:action||null,realm:realm||null,tag:control.tagName});
  try{
    if(realm){enterRealm(realm);return}
    const openCommonweaveCabinet=()=>location.assign(CommonweaveParity.cabinetUrl({systemId:'commonweave',from:'hub'}));
    const handlers={home:()=>toast('You are already at the Commonweave Quad.'),chat,settings,intentions,realms,info,version,cabinet:openCommonweaveCabinet,lite:openCommonweaveCabinet};
    (handlers[action]||(()=>toast(`The ${action||'unknown'} control has no action yet.`)))();
  }catch(error){report('control-error',{action,realm,message:error.message});toast(`That control hit an error: ${error.message}`)}
});
addEventListener('error',event=>report('window-error',{message:event.message,filename:event.filename,line:event.lineno,column:event.colno}));
addEventListener('unhandledrejection',event=>report('unhandled-rejection',{reason:event.reason?.message||String(event.reason)}));
const mode=localStorage.getItem('commonweave.weaveling-mode')||MODES[new Date().getHours()%MODES.length],label=document.querySelector('#cw127-context-label');if(label)label.textContent=mode;
localStorage.setItem('commonweave.host-build',BUILD);document.documentElement.dataset.commonweaveBuild=BUILD;report('page-ready',{navigationType:performance.getEntriesByType?.('navigation')?.[0]?.type||'unknown',controller:navigator.serviceWorker?.controller?.scriptURL||null,mode});
const requestedPanel=new URLSearchParams(location.search).get('panel');if(requestedPanel==='settings')setTimeout(settings,30);else if(requestedPanel==='compass')setTimeout(chat,30);else if(requestedPanel==='routes')setTimeout(intentions,30);
retireLegacy();
globalThis.CommonweaveLoomV141={chat,settings,intentions,realms,dialog};
})();
