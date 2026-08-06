(()=>{
'use strict';
const VERSION='1.0.27';
const BUILD='1.0.27-clean-slate-shell';
const PATCH='identity-ai-2';
const SETTINGS_KEY='civweave.universal-ai.v127';
const SESSION_KEY='civweave.universal-ai.session-key.v127';
const INTENTIONS_KEY='civweave.intentions.v127';
const CHAT_KEY='civweave.weaveling-chat.v127';
const MODES=['Reflect','Plan','Learn','Build','Acquire','Govern'];
const REALMS={
  'living-school':{name:'Living School',copy:'Learning paths, curriculum, practice, reflection, and credentials.',image:'/app/services/living-school/visual-assets/core/home.webp'},
  cerbanimo:{name:'Cerbanimo',copy:'Skilled work, quests, projects, proof, and completion.',image:'/app/services/cerbanimo/assets/visual/nexus.webp'},
  fellowfare:{name:'FellowFare',copy:'Needs, offers, exchanges, resources, makers, and logistics.',image:'/app/services/fellowfare/assets/mall/main-atrium.webp'},
  anarchadia:{name:'Anarchadia',copy:'Proposals, bugs, assemblies, consent, federation, and governance.',image:'/app/services/anarchadia/assets/screens/home-portrait.webp'}
};
const fallbackValue=fallback=>Array.isArray(fallback)?[]:(fallback&&typeof fallback==='object'?{...fallback}:fallback);
function parse(value,fallback){
  if(value==null||value==='')return fallbackValue(fallback);
  try{
    const parsed=JSON.parse(value);
    if(parsed==null)return fallbackValue(fallback);
    if(Array.isArray(fallback)&&!Array.isArray(parsed))return [];
    if(fallback&&typeof fallback==='object'&&!Array.isArray(fallback)&&(typeof parsed!=='object'||Array.isArray(parsed)))return {...fallback};
    return parsed;
  }catch{return fallbackValue(fallback)}
}
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const report=(kind,detail={})=>{const event={schema:'civweave.boot-log.v1',time:new Date().toISOString(),version:VERSION,build:BUILD,patch:PATCH,kind:`v127:${kind}`,url:location.href,detail};console.info('[CW127]',event);fetch('/api/boot-log',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(event),keepalive:true,cache:'no-store'}).catch(()=>{});return event};
let toastTimer;
function toast(message){const node=document.querySelector('#cw127-toast');if(!node)return;node.textContent=message;node.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.hidden=true,4200)}
function show(node){if(typeof node.showModal==='function'){if(!node.open)node.showModal()}else node.setAttribute('open','')}
function close(node){if(typeof node.close==='function'&&node.open)node.close();else node.removeAttribute('open')}
function dialog(id,html){let node=document.querySelector(`#${id}`);if(!node){node=document.createElement('dialog');node.id=id;node.className='cw127-dialog';node.innerHTML=html;document.body.append(node);node.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>close(node));node.addEventListener('click',event=>{if(event.target===node)close(node)})}return node}
function settings(){
  const defaults={route:'deterministic',model:'Weaveling local planner',endpoint:'',consent:false};
  const saved=parse(localStorage.getItem(SETTINGS_KEY),defaults);
  const node=dialog('cw127-settings',`<form method="dialog"><header><div><small>UNIVERSAL AI SETTINGS</small><h2>Choose the Compass mind</h2></div><button class="cw127-close" data-close value="cancel" aria-label="Close">×</button></header><label>Provider route<select name="route"><option value="deterministic">Private local planner</option><option value="gemini">Gemini</option><option value="ollama">Ollama or local API</option><option value="compatible">OpenAI-compatible endpoint</option></select></label><label>Model<input name="model" maxlength="200" autocomplete="off"></label><label>Endpoint<input name="endpoint" maxlength="2048" placeholder="Optional for local or compatible providers" autocomplete="url"></label><label>Session API key<div class="cw127-secret-row"><input name="apiKey" type="password" maxlength="500" autocomplete="off" placeholder="Kept only until this tab or app session closes"><button type="button" data-toggle-key>Show</button></div></label><label><span><input name="consent" type="checkbox"> Allow remote prompts for the selected provider</span></label><p>Provider, model, and endpoint are saved locally. The API key is held only in session storage and is shared with Weaveling and every realm guide for this session.</p><menu><button type="button" data-save>Save universal settings</button></menu><output role="status"></output></form>`);
  const form=node.querySelector('form');
  form.route.value=saved.route||defaults.route;form.model.value=saved.model||defaults.model;form.endpoint.value=saved.endpoint||'';form.consent.checked=Boolean(saved.consent);form.apiKey.value=sessionStorage.getItem(SESSION_KEY)||'';
  form.querySelector('[data-toggle-key]').onclick=event=>{const visible=form.apiKey.type==='text';form.apiKey.type=visible?'password':'text';event.currentTarget.textContent=visible?'Show':'Hide'};
  form.querySelector('[data-save]').onclick=()=>{const next={route:form.route.value,model:form.model.value.trim()||defaults.model,endpoint:form.endpoint.value.trim(),consent:form.consent.checked};localStorage.setItem(SETTINGS_KEY,JSON.stringify(next));const key=form.apiKey.value.trim();if(key)sessionStorage.setItem(SESSION_KEY,key);else sessionStorage.removeItem(SESSION_KEY);form.querySelector('output').textContent=`Saved ${next.route} settings for the whole campus${key?' with a session key':''}.`;report('settings-saved',{route:next.route,model:next.model,hasEndpoint:Boolean(next.endpoint),hasSessionKey:Boolean(key),consent:next.consent});setTimeout(()=>close(node),650)};
  show(node);report('dialog-opened',{dialog:'settings',route:saved.route||defaults.route});
}
function answerFor(text){
  const lower=text.toLowerCase();let mode='Reflect',realm='Civweave';
  if(/learn|study|course|understand|practice|skill/.test(lower)){mode='Learn';realm='Living School'}
  else if(/build|make|code|design|repair|work|project|ship/.test(lower)){mode='Build';realm='Cerbanimo'}
  else if(/buy|find|material|resource|trade|sell|offer|need|money/.test(lower)){mode='Acquire';realm='FellowFare'}
  else if(/govern|proposal|vote|rule|community|organize|policy|bug/.test(lower)){mode='Govern';realm='Anarchadia'}
  else if(/plan|steps|roadmap|how do i|what next/.test(lower)){mode='Plan'}
  localStorage.setItem('civweave.weaveling-mode',mode);const label=document.querySelector('#cw127-context-label');if(label)label.textContent=mode;
  return `I hear the intention: ${text}\n\nWorking mode: ${mode}. Likely home: ${realm}.\n\nNext concrete step: define the smallest visible result that would prove movement. Then name what is already available and what is missing. I will keep the route editable rather than treating this first reading as certainty.`;
}
function chat(){
  const history=parse(localStorage.getItem(CHAT_KEY),[]);
  const node=dialog('cw127-chat',`<section><header><div><small>WEAVELING’S COMPASS</small><h2>What is your wish?</h2></div><button class="cw127-close" data-close aria-label="Close">×</button></header><div class="cw127-chat-log"></div><form class="cw127-chat-form"><textarea aria-label="Message Weaveling" maxlength="8000" placeholder="Share an intention, problem, or possibility…"></textarea><button>Send</button></form><menu><button type="button" data-settings>Universal AI settings</button><button type="button" data-clear>Clear conversation</button></menu></section>`);
  const log=node.querySelector('.cw127-chat-log');
  const render=()=>{const parsed=parse(localStorage.getItem(CHAT_KEY),[]);const items=Array.isArray(parsed)?parsed:[];log.innerHTML=(items.length?items:[{role:'assistant',text:'I’m here. Tell me what you want to move toward, and we’ll turn it into a route with a concrete next step.'}]).map(item=>`<p class="${item.role==='user'?'user':'assistant'}">${escapeHtml(item.text)}</p>`).join('');log.scrollTop=log.scrollHeight};
  node.querySelector('form').onsubmit=event=>{event.preventDefault();const input=node.querySelector('textarea'),text=input.value.trim();if(!text)return;const parsed=parse(localStorage.getItem(CHAT_KEY),[]);const items=Array.isArray(parsed)?parsed:[];items.push({role:'user',text,time:new Date().toISOString()});items.push({role:'assistant',text:answerFor(text),time:new Date().toISOString()});localStorage.setItem(CHAT_KEY,JSON.stringify(items.slice(-80)));input.value='';render();report('weaveling-message',{characters:text.length,mode:localStorage.getItem('civweave.weaveling-mode')||'Reflect'})};
  node.querySelector('[data-settings]').onclick=settings;node.querySelector('[data-clear]').onclick=()=>{localStorage.removeItem(CHAT_KEY);render();report('chat-cleared')};render();show(node);setTimeout(()=>node.querySelector('textarea')?.focus(),60);report('dialog-opened',{dialog:'chat',history:Array.isArray(history)?history.length:0});
}
function intentions(){
  const node=dialog('cw127-intentions',`<section><header><div><small>ACTIVE INTENTIONS</small><h2>What are we moving toward?</h2></div><button class="cw127-close" data-close aria-label="Close">×</button></header><div data-list></div><form class="cw127-chat-form"><input name="intention" maxlength="300" placeholder="Add a clear intention"><button>Add</button></form><menu><button type="button" data-clear>Clear completed</button></menu></section>`);
  const render=()=>{const items=parse(localStorage.getItem(INTENTIONS_KEY),[]);node.querySelector('[data-list]').innerHTML=items.length?items.map((item,index)=>`<label style="display:grid;grid-template-columns:auto 1fr;align-items:center;gap:9px;padding:9px;border:1px solid #7ee5ff33;border-radius:11px"><input type="checkbox" data-index="${index}" ${item.done?'checked':''}><span>${escapeHtml(item.text)}</span></label>`).join(''):'<p>No active intentions yet. The loom is quiet, not broken.</p>';node.querySelectorAll('[data-index]').forEach(box=>box.onchange=()=>{const current=parse(localStorage.getItem(INTENTIONS_KEY),[]);const item=current[Number(box.dataset.index)];if(item)item.done=box.checked;localStorage.setItem(INTENTIONS_KEY,JSON.stringify(current));render()})};
  node.querySelector('form').onsubmit=event=>{event.preventDefault();const input=event.currentTarget.intention,text=input.value.trim();if(!text)return;const items=parse(localStorage.getItem(INTENTIONS_KEY),[]);items.push({text,done:false,createdAt:new Date().toISOString()});localStorage.setItem(INTENTIONS_KEY,JSON.stringify(items));input.value='';render();const label=document.querySelector('#cw127-context-label');if(label)label.textContent='Plan';report('intention-added',{characters:text.length})};
  node.querySelector('[data-clear]').onclick=()=>{const items=parse(localStorage.getItem(INTENTIONS_KEY),[]).filter(item=>!item.done);localStorage.setItem(INTENTIONS_KEY,JSON.stringify(items));render()};render();show(node);report('dialog-opened',{dialog:'intentions'});
}
function realms(){const cards=Object.entries(REALMS).map(([id,realm])=>`<button class="cw127-card" data-realm="${id}" style="background-image:url('${realm.image}')"><b>${realm.name}</b><span>${realm.copy}</span></button>`).join('');const node=dialog('cw127-realms',`<section><header><div><small>THE FOUR REALMS</small><h2>Choose a direction</h2></div><button class="cw127-close" data-close aria-label="Close">×</button></header><div class="cw127-card-grid">${cards}</div></section>`);show(node);report('dialog-opened',{dialog:'realms'})}
function info(){const node=dialog('cw127-info',`<section><header><div><small>CIVWEAVE v${VERSION}</small><h2>Clean-slate visual shell</h2></div><button class="cw127-close" data-close aria-label="Close">×</button></header><p>This hub does not load the v1.0.21 application, its seed installer, its navigation handlers, or either previous campus service worker.</p><p>Buildings open isolated image-first realm shells. Weaveling, Intentions, Realms, and universal AI settings are handled directly here.</p><p><a href="/diagnostics.html">Open boot diagnostics</a></p></section>`);show(node);report('dialog-opened',{dialog:'info'})}
function version(){const node=dialog('cw127-version-dialog',`<section><header><div><small>RELEASE STATE</small><h2>Civweave v${VERSION}</h2></div><button class="cw127-close" data-close aria-label="Close">×</button></header><p>Build: <code>${BUILD}</code></p><p>Patch: <code>${PATCH}</code></p><p>No service worker is installed for <code>/loom/</code>. This remains deliberate while the legacy cache architecture is retired.</p><menu><a href="/api/health" target="_blank" rel="noopener">Host health</a><a href="/diagnostics.html">Diagnostics</a></menu></section>`);show(node);report('dialog-opened',{dialog:'version'})}
function enterRealm(id){if(!REALMS[id])return;report('realm-enter',{realm:id});location.assign(`/loom/realm/${encodeURIComponent(id)}/`)}
async function retireLegacy(){try{const registrations=await navigator.serviceWorker?.getRegistrations?.()||[];const old=registrations.filter(reg=>{const path=new URL(reg.scope).pathname;return path.startsWith('/app/')||path.startsWith('/campus/')||/\/services\//.test(path)});for(const reg of old){const result=await reg.unregister();report('legacy-worker-unregistered',{scope:reg.scope,result})}const keys=await caches.keys();for(const key of keys){if(key.startsWith('civweave-')||/^(living-school|cerbanimo|fellowfare|anarchadia)-/.test(key)){const result=await caches.delete(key);report('legacy-cache-deleted',{key,result})}}}catch(error){report('legacy-retirement-failed',{message:error.message})}}
document.addEventListener('click',event=>{const control=event.target.closest('[data-action],[data-realm]');if(!control)return;const action=control.dataset.action,realm=control.dataset.realm;report('control-click',{action:action||null,realm:realm||null,tag:control.tagName});try{if(realm){enterRealm(realm);return}const handler={home:()=>toast('You are already at the Civweave Quad.'),chat,settings,intentions,realms,info,version}[action];if(handler)handler();else toast(`The ${action||'unknown'} control has no action yet.`)}catch(error){report('control-error',{action,realm,message:error.message});toast(`That control hit an error: ${error.message}`)}});
addEventListener('error',event=>report('window-error',{message:event.message,filename:event.filename,line:event.lineno,column:event.colno}));addEventListener('unhandledrejection',event=>report('unhandled-rejection',{reason:event.reason?.message||String(event.reason)}));
const mode=localStorage.getItem('civweave.weaveling-mode')||MODES[new Date().getHours()%MODES.length];const modeLabel=document.querySelector('#cw127-context-label');if(modeLabel)modeLabel.textContent=mode;
localStorage.setItem('civweave.host-build',BUILD);document.documentElement.dataset.civweaveBuild=BUILD;document.documentElement.dataset.civweavePatch=PATCH;window.CivweaveUniversalAISettings={open:settings};
report('page-ready',{navigationType:performance.getEntriesByType?.('navigation')?.[0]?.type||'unknown',controller:navigator.serviceWorker?.controller?.scriptURL||null,mode});retireLegacy();
})();
