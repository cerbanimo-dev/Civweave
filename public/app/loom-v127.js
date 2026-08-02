(()=>{
'use strict';
const VERSION='1.0.27';
const BUILD='1.0.27-clean-slate-shell';
const SETTINGS_KEY='commonweave.universal-ai.v127';
const INTENTIONS_KEY='commonweave.intentions.v127';
const CHAT_KEY='commonweave.weaveling-chat.v127';
const MODES=['Reflect','Plan','Learn','Build','Acquire','Govern'];
const REALMS={
  'living-school':{name:'Living School',copy:'Learning paths, curriculum, practice, reflection, and credentials.',image:'/app/services/living-school/visual-assets/core/home.webp'},
  cerbanimo:{name:'Cerbanimo',copy:'Skilled work, quests, projects, proof, and completion.',image:'/app/services/cerbanimo/assets/visual/nexus.webp'},
  fellowfare:{name:'FellowFare',copy:'Needs, offers, exchanges, resources, makers, and logistics.',image:'/app/services/fellowfare/assets/mall/main-atrium.webp'},
  anarchadia:{name:'Anarchadia',copy:'Proposals, bugs, assemblies, consent, federation, and governance.',image:'/app/services/anarchadia/assets/screens/home-portrait.webp'}
};
const parse=(value,fallback)=>{try{return JSON.parse(value)}catch{return fallback}};
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const report=(kind,detail={})=>{const event={schema:'commonweave.boot-log.v1',time:new Date().toISOString(),version:VERSION,build:BUILD,kind:`v127:${kind}`,url:location.href,detail};console.info('[CW127]',event);fetch('/api/boot-log',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(event),keepalive:true,cache:'no-store'}).catch(()=>{});return event};
let toastTimer;
function toast(message){const node=document.querySelector('#cw127-toast');node.textContent=message;node.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.hidden=true,4200)}
function show(dialog){if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','')}
function close(dialog){if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open')}
function dialog(id,html){let node=document.querySelector(`#${id}`);if(node)return node;node=document.createElement('dialog');node.id=id;node.className='cw127-dialog';node.innerHTML=html;document.body.append(node);node.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>close(node));node.addEventListener('click',event=>{if(event.target===node)close(node)});return node}
function settings(){
  const saved=parse(localStorage.getItem(SETTINGS_KEY),{route:'deterministic',model:'Weaveling local planner',endpoint:'',consent:false});
  const node=dialog('cw127-settings',`<form method="dialog"><header><div><small>UNIVERSAL AI SETTINGS</small><h2>Choose the Compass mind</h2></div><button class="cw127-close" data-close value="cancel" aria-label="Close">×</button></header><label>Route<select name="route"><option value="deterministic">Private local planner</option><option value="gemini">Gemini</option><option value="ollama">Ollama or local API</option><option value="compatible">OpenAI-compatible endpoint</option></select></label><label>Model<input name="model" maxlength="200"></label><label>Endpoint<input name="endpoint" maxlength="2048" placeholder="Optional for local or compatible providers"></label><label><span><input name="consent" type="checkbox"> Allow remote prompts for the selected provider</span></label><p>The clean-slate shell stores the preference locally. It never stores an API key in persistent storage.</p><menu><button type="button" data-save>Save settings</button></menu><output role="status"></output></form>`);
  const form=node.querySelector('form');form.route.value=saved.route||'deterministic';form.model.value=saved.model||'';form.endpoint.value=saved.endpoint||'';form.consent.checked=Boolean(saved.consent);
  form.querySelector('[data-save]').onclick=()=>{const next={route:form.route.value,model:form.model.value.trim()||'Weaveling local planner',endpoint:form.endpoint.value.trim(),consent:form.consent.checked};localStorage.setItem(SETTINGS_KEY,JSON.stringify(next));form.querySelector('output').textContent='Saved for Weaveling and every realm guide.';report('settings-saved',{route:next.route,model:next.model,hasEndpoint:Boolean(next.endpoint),consent:next.consent});setTimeout(()=>close(node),450)};
  show(node);report('dialog-opened',{dialog:'settings'});
}
function answerFor(text){
  const lower=text.toLowerCase();
  let mode='Reflect',realm='Commonweave';
  if(/learn|study|course|understand|practice|skill/.test(lower)){mode='Learn';realm='Living School'}
  else if(/build|make|code|design|repair|work|project|ship/.test(lower)){mode='Build';realm='Cerbanimo'}
  else if(/buy|find|material|resource|trade|sell|offer|need|money/.test(lower)){mode='Acquire';realm='FellowFare'}
  else if(/govern|proposal|vote|rule|community|organize|policy|bug/.test(lower)){mode='Govern';realm='Anarchadia'}
  else if(/plan|steps|roadmap|how do i|what next/.test(lower)){mode='Plan'}
  localStorage.setItem('commonweave.weaveling-mode',mode);document.querySelector('#cw127-context-label').textContent=mode;
  return `I hear the intention: ${text}\n\nWorking mode: ${mode}. Likely home: ${realm}.\n\nNext concrete step: define the smallest visible result that would prove movement. Then name what is already available and what is missing. I will keep the route editable rather than treating this first reading as certainty.`;
}
function chat(){
  const history=parse(localStorage.getItem(CHAT_KEY),[]);
  const node=dialog('cw127-chat',`<section><header><div><small>WEAVELING’S COMPASS</small><h2>What is your wish?</h2></div><button class="cw127-close" data-close aria-label="Close">×</button></header><div class="cw127-chat-log"></div><form class="cw127-chat-form"><textarea aria-label="Message Weaveling" maxlength="8000" placeholder="Share an intention, problem, or possibility…"></textarea><button>Send</button></form><menu><button type="button" data-settings>Universal AI settings</button><button type="button" data-clear>Clear conversation</button></menu></section>`);
  const log=node.querySelector('.cw127-chat-log');
  const render=()=>{const items=parse(localStorage.getItem(CHAT_KEY),[]);log.innerHTML=(items.length?items:[{role:'assistant',text:'I’m here. Tell me what you want to move toward, and we’ll turn it into a route with a concrete next step.'}]).map(item=>`<p class="${item.role==='user'?'user':'assistant'}">${escapeHtml(item.text)}</p>`).join('');log.scrollTop=log.scrollHeight};
  node.querySelector('form').onsubmit=event=>{event.preventDefault();const input=node.querySelector('textarea'),text=input.value.trim();if(!text)return;const items=parse(localStorage.getItem(CHAT_KEY),[]);items.push({role:'user',text,time:new Date().toISOString()});const answer=answerFor(text);items.push({role:'assistant',text:answer,time:new Date().toISOString()});localStorage.setItem(CHAT_KEY,JSON.stringify(items.slice(-80)));input.value='';render();report('weaveling-message',{characters:text.length,mode:localStorage.getItem('commonweave.weaveling-mode')||'Reflect'})};
  node.querySelector('[data-settings]').onclick=settings;node.querySelector('[data-clear]').onclick=()=>{localStorage.removeItem(CHAT_KEY);render();report('chat-cleared')};render();show(node);setTimeout(()=>node.querySelector('textarea')?.focus(),60);report('dialog-opened',{dialog:'chat',history:history.length});
}
function intentions(){
  const node=dialog('cw127-intentions',`<section><header><div><small>ACTIVE INTENTIONS</small><h2>What are we moving toward?</h2></div><button class="cw127-close" data-close aria-label="Close">×</button></header><div data-list></div><form class="cw127-chat-form"><input name="intention" maxlength="300" placeholder="Add a clear intention"><button>Add</button></form><menu><button type="button" data-clear>Clear completed</button></menu></section>`);
  const render=()=>{const items=parse(localStorage.getItem(INTENTIONS_KEY),[]);node.querySelector('[data-list]').innerHTML=items.length?items.map((item,index)=>`<label style="display:grid;grid-template-columns:auto 1fr;align-items:center;gap:9px;padding:9px;border:1px solid #7ee5ff33;border-radius:11px"><input type="checkbox" data-index="${index}" ${item.done?'checked':''}><span>${escapeHtml(item.text)}</span></label>`).join(''):'<p>No active intentions yet. The loom is quiet, not broken.</p>';node.querySelectorAll('[data-index]').forEach(box=>box.onchange=()=>{const current=parse(localStorage.getItem(INTENTIONS_KEY),[]);current[Number(box.dataset.index)].done=box.checked;localStorage.setItem(INTENTIONS_KEY,JSON.stringify(current));render()})};
  node.querySelector('form').onsubmit=event=>{event.preventDefault();const input=event.currentTarget.intention,text=input.value.trim();if(!text)return;const items=parse(localStorage.getItem(INTENTIONS_KEY),[]);items.push({text,done:false,createdAt:new Date().toISOString()});localStorage.setItem(INTENTIONS_KEY,JSON.stringify(items));input.value='';render();document.querySelector('#cw127-context-label').textContent='Plan';report('intention-added',{characters:text.length})};
  node.querySelector('[data-clear]').onclick=()=>{const items=parse(localStorage.getItem(INTENTIONS_KEY),[]).filter(item=>!item.done);localStorage.setItem(INTENTIONS_KEY,JSON.stringify(items));render()};render();show(node);report('dialog-opened',{dialog:'intentions'});
}
function realms(){
  const cards=Object.entries(REALMS).map(([id,realm])=>`<button class="cw127-card" data-realm="${id}" style="background-image:url('${realm.image}')"><b>${realm.name}</b><span>${realm.copy}</span></button>`).join('');
  const node=dialog('cw127-realms',`<section><header><div><small>THE FOUR REALMS</small><h2>Choose a direction</h2></div><button class="cw127-close" data-close aria-label="Close">×</button></header><div class="cw127-card-grid">${cards}</div></section>`);show(node);report('dialog-opened',{dialog:'realms'});
}
function info(){const node=dialog('cw127-info',`<section><header><div><small>COMMONWEAVE v${VERSION}</small><h2>Clean-slate visual shell</h2></div><button class="cw127-close" data-close aria-label="Close">×</button></header><p>This hub does not load the v1.0.21 application, its seed installer, its navigation handlers, or either previous campus service worker.</p><p>Buildings open isolated image-first realm shells. Weaveling, Intentions, Realms, and universal AI settings are handled directly here.</p><p><a href="/diagnostics.html">Open boot diagnostics</a></p></section>`);show(node);report('dialog-opened',{dialog:'info'})}
function version(){const node=dialog('cw127-version-dialog',`<section><header><div><small>RELEASE STATE</small><h2>Commonweave v${VERSION}</h2></div><button class="cw127-close" data-close aria-label="Close">×</button></header><p>Build: <code>${BUILD}</code></p><p>No service worker is installed for <code>/loom/</code>. This is deliberate while the legacy cache architecture is being retired.</p><menu><a href="/api/health" target="_blank" rel="noopener">Host health</a><a href="/diagnostics.html">Diagnostics</a></menu></section>`);show(node);report('dialog-opened',{dialog:'version'})}
function enterRealm(id){const realm=REALMS[id];if(!realm)return;report('realm-enter',{realm:id});location.assign(`/loom/realm/${encodeURIComponent(id)}/`)}
async function retireLegacy(){
  try{const registrations=await navigator.serviceWorker?.getRegistrations?.()||[];const old=registrations.filter(reg=>{const path=new URL(reg.scope).pathname;return path.startsWith('/app/')||path.startsWith('/campus/')||/\/services\//.test(path)});for(const reg of old){const result=await reg.unregister();report('legacy-worker-unregistered',{scope:reg.scope,result})}const keys=await caches.keys();for(const key of keys){if(key.startsWith('commonweave-')||/^(living-school|cerbanimo|fellowfare|anarchadia)-/.test(key)){const result=await caches.delete(key);report('legacy-cache-deleted',{key,result})}}}catch(error){report('legacy-retirement-failed',{message:error.message})}
}
document.addEventListener('click',event=>{
  const control=event.target.closest('[data-action],[data-realm]');if(!control)return;
  const action=control.dataset.action,realm=control.dataset.realm;report('control-click',{action:action||null,realm:realm||null,tag:control.tagName});
  try{if(realm){enterRealm(realm);return}({home:()=>toast('You are already at the Commonweave Quad.'),chat,settings,intentions,realms,info,version}[action]||(()=>toast(`The ${action||'unknown'} control has no action yet.`)))()}catch(error){report('control-error',{action,realm,message:error.message});toast(`That control hit an error: ${error.message}`)}
});
addEventListener('error',event=>report('window-error',{message:event.message,filename:event.filename,line:event.lineno,column:event.colno}));addEventListener('unhandledrejection',event=>report('unhandled-rejection',{reason:event.reason?.message||String(event.reason)}));
const mode=localStorage.getItem('commonweave.weaveling-mode')||MODES[new Date().getHours()%MODES.length];document.querySelector('#cw127-context-label').textContent=mode;
localStorage.setItem('commonweave.host-build',BUILD);document.documentElement.dataset.commonweaveBuild=BUILD;
report('page-ready',{navigationType:performance.getEntriesByType?.('navigation')?.[0]?.type||'unknown',controller:navigator.serviceWorker?.controller?.scriptURL||null,mode});
retireLegacy();
})();
