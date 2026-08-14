(()=>{
'use strict';
const VERSION='1.0.134-server-ai-settings-v306-lazy-local-model-tab';
const ROUTE='server-auto';
const SETTINGS_KEY='civweave.universal-ai.v127';
const PROFILES_KEY='civweave-model-profiles-v1';
const LEGACY_SHARED_KEY='civweave-shared-model';
const MARKET_SESSION_KEY='civweave.node-ai-marketplace.sessions.v1';
const CAPACITY_SESSION_KEY='civweave.host-capacity.sessions.v1';
const MARKET_PREF_KEY='civweave.node-ai-marketplace.preferences.v1';
const PANEL_ID='cw-server-ai-v301';
const COMMERCE_ID='cw-server-commerce-v301';
const STYLE_ID='cw-server-ai-settings-v301-style';
if(globalThis.CivweaveServerAISettingsV301?.version===VERSION)return;
const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const money=cents=>`$${(Number(cents||0)/100).toFixed(2)}`;
function objectFrom(storage,key){try{const value=parse(storage.getItem(key),{});return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}catch{return{}}}
function savedRoute(){const profiles=objectFrom(localStorage,PROFILES_KEY),saved=objectFrom(localStorage,SETTINGS_KEY),legacy=objectFrom(localStorage,LEGACY_SHARED_KEY),interactive=profiles.interactive||saved,legacyModel=legacy.model||legacy.config||legacy;return clean(interactive?.provider||interactive?.route||saved.provider||saved.route||legacyModel?.provider||legacyModel?.route,80).toLowerCase()}
function serverInteractive(){return{route:ROUTE,provider:ROUTE,model:'civweave-server-auto-v1',endpoint:'',externalConsent:true,serverOrder:['device-local','server-local','cloudflare-workers-ai']}}
function persistServerRoute({source=VERSION,defaultApplied=false}={}){
  const interactive=serverInteractive(),saved={...interactive,consent:true,agenticEnabled:false,version:'1.0.134',settingsController:VERSION,defaultApplied};
  try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(saved));localStorage.setItem(PROFILES_KEY,JSON.stringify({interactive,agentic:null,agenticEnabled:false,version:'1.0.134',settingsController:VERSION,defaultApplied}))}catch{}
  try{globalThis.CivweaveModelRuntime?.saveSharedConfig?.(interactive,{profile:'interactive'})}catch{}
  try{dispatchEvent(new CustomEvent('civweave:model-config-changed',{detail:{profile:'interactive',config:interactive,source,defaultApplied,at:new Date().toISOString()}}));if(!defaultApplied)dispatchEvent(new CustomEvent('civweave:server-ai-selected',{detail:{order:interactive.serverOrder,at:new Date().toISOString()}}))}catch{}
  return interactive;
}
function ensureDefaultRoute(){const existing=savedRoute();if(existing)return{applied:false,route:existing};return{applied:true,route:ROUTE,config:persistServerRoute({source:`${VERSION}:first-run-default`,defaultApplied:true})}}
function capacitySession(){
  const rows=Object.values(objectFrom(sessionStorage,CAPACITY_SESSION_KEY)).filter(item=>item?.nodeId&&item?.token&&item?.origin&&(!item.expiresAt||Date.parse(item.expiresAt)>Date.now()));
  const preferred=clean(objectFrom(localStorage,MARKET_PREF_KEY).preferredNodeId,180);
  return rows.find(item=>item.nodeId===preferred)||rows[0]||null;
}
function marketplaceSession(){
  const all=objectFrom(sessionStorage,MARKET_SESSION_KEY),preferred=clean(objectFrom(localStorage,MARKET_PREF_KEY).preferredNodeId,180);
  if(preferred&&all[preferred]?.token)return{nodeId:preferred,...all[preferred]};
  const entry=Object.entries(all).find(([,item])=>item?.token&&item?.baseUrl);return entry?{nodeId:entry[0],...entry[1]}:null;
}
function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`#${PANEL_ID},#${COMMERCE_ID}{display:grid;gap:12px;padding:16px;border:1px solid rgba(126,239,213,.24);border-radius:15px;background:#0a1730}#${PANEL_ID}[hidden],#${COMMERCE_ID}[hidden]{display:none!important}.cw-settings-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.cw-settings-tabs button{min-width:0;padding-inline:8px;background:#0b1329;color:#cbd4ee}.cw-settings-tabs button[aria-selected="true"]{border-color:#7eeed5;background:#26365f;color:#fff;box-shadow:inset 0 -3px #7eeed5}.cw-settings-tab-panel{display:grid;gap:17px}.cw-settings-tab-panel[hidden]{display:none!important}.cw-server-order{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.cw-server-hop{padding:10px;border:1px solid #ffffff18;border-radius:11px;background:#071226}.cw-server-hop b{display:block}.cw-server-hop small{display:block;margin-top:4px;color:#b8c7df;letter-spacing:0!important;font-weight:500}.cw-server-model-map{display:grid;gap:6px;margin:0}.cw-server-model-map div{display:grid;grid-template-columns:minmax(120px,.8fr) minmax(0,1.4fr);gap:10px;padding:8px 10px;border:1px solid #ffffff12;border-radius:9px}.cw-server-model-map dt{font-weight:800;color:#fff}.cw-server-model-map dd{margin:0;color:#b8c7df}.cw-server-commerce-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.cw-server-commerce-grid>div{display:grid;gap:8px;padding:12px;border:1px solid #ffffff16;border-radius:12px}.cw-server-commerce-grid label{display:grid;gap:6px}.cw-server-commerce-status{min-height:1.4em;color:#9ff2dc}@media(max-width:640px){.cw-server-order,.cw-server-commerce-grid{grid-template-columns:1fr}.cw-server-model-map div{grid-template-columns:1fr}}`;document.head.append(style);
}
function selectTab(form,name){for(const button of form.querySelectorAll('[data-settings-tab]'))button.setAttribute('aria-selected',String(button.dataset.settingsTab===name));for(const panel of form.querySelectorAll('[data-settings-tab-panel]'))panel.hidden=panel.dataset.settingsTabPanel!==name;try{dispatchEvent(new CustomEvent('civweave:settings-tab-selected',{detail:{name,form}}))}catch{}}
function installTabbedLayout(form){if(form.dataset.settingsTabs==='1')return form;const tabs=document.createElement('nav');tabs.className='cw-settings-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Settings sections');tabs.innerHTML='<button type="button" role="tab" aria-selected="true" data-settings-tab="general">AI & safety</button><button type="button" role="tab" aria-selected="false" data-settings-tab="local-models">Local models</button><button type="button" role="tab" aria-selected="false" data-settings-tab="membership">Membership</button>';const general=document.createElement('div'),local=document.createElement('div'),membership=document.createElement('div');for(const [panel,name] of [[general,'general'],[local,'local-models'],[membership,'membership']]){panel.className='cw-settings-tab-panel';panel.dataset.settingsTabPanel=name;panel.hidden=name!=='general'}const children=[...form.children];form.append(tabs,general,local,membership);for(const child of children)general.append(child);const existingLocal=general.querySelector('#cw-local-ai-v266'),existingCommerce=general.querySelector(`#${COMMERCE_ID}`);if(existingLocal)local.append(existingLocal);if(existingCommerce)membership.append(existingCommerce);tabs.addEventListener('click',event=>{const button=event.target.closest('[data-settings-tab]');if(button)selectTab(form,button.dataset.settingsTab)});form.dataset.settingsTabs='1';return form}
function saveServerRoute(form){
  const interactive=persistServerRoute();
  const status=form.querySelector('[data-status]');if(status)status.textContent='Server-side AI saved. Civweave will try this device, then a paired self-hosted server, then connect to Cloudflare community capacity on the first request.';
  return interactive;
}
function setServerVisibility(form,enabled){
  const panel=form.querySelector(`#${PANEL_ID}`);if(panel)panel.hidden=!enabled;
  if(enabled){for(const section of form.querySelectorAll('[data-panel="deterministic"],[data-panel="remote"]'))section.hidden=true}
}
function serverPanel(){
  const section=document.createElement('section');section.id=PANEL_ID;section.className='cw-clean-panel';section.hidden=true;section.innerHTML=`<div><h3>Server-side AI</h3><p>One setting, three rungs. Civweave uses the cheapest and most private available route first and only climbs when the earlier rung cannot finish the call.</p></div><div class="cw-server-order"><div class="cw-server-hop"><b>1 · This device</b><small>Your selected downloaded local model gets first attempt.</small></div><div class="cw-server-hop"><b>2 · Your host</b><small>A paired server-local/self-hosted model is next.</small></div><div class="cw-server-hop"><b>3 · Cloudflare</b><small>Capacity-backed Workers AI is the final online fallback.</small></div></div><div><h4>Cloudflare task map</h4><dl class="cw-server-model-map"><div><dt>Local</dt><dd>Rules / deterministic · routing, health, validation · no AI inference</dd></div><div><dt>Quick</dt><dd>GLM 4.7 Flash · chat, extraction, and simple requests · $0.06 in / $0.40 out per 1M tokens</dd></div><div><dt>Smart</dt><dd>Gemma 4 26B A4B · default reasoning, tools, vision, and plans · $0.10 in / $0.30 out per 1M tokens</dd></div><div><dt>Deep</dt><dd>GPT-OSS 120B · difficult architecture and reasoning · $0.35 in / $0.75 out per 1M tokens</dd></div><div><dt>Code</dt><dd><b>Standard · free server:</b> Gemma first, then validation; Qwen2.5-Coder only for a failed or clearly patch/debug-heavy pass; 120B only for a difficult architectural blockage.<br><b>⚡ Advanced · $5+ paid server:</b> Kimi K2.7 Code for larger builds, deeper debugging, repeated tools, and long-running implementation. Every Kimi request has a warning and one-time approval gate.</dd></div></dl></div><div class="cw-clean-note">Free and paid both call this lane Code. Workers Paid keeps the 10,000 free neurons/day, permits metered overage, and unlocks the Advanced Coding Agent on a host configured for paid inference. Selecting server AI authorizes prompt failover; lifetime compute credits are not spent automatically.</div>`;return section;
}
function commercePanel(){
  const section=document.createElement('section');section.id=COMMERCE_ID;section.className='cw-clean-panel';section.innerHTML=`<div><h3>Membership & compute</h3><p>Add backed compute credit or start a monthly membership without entering a Stripe key in Civweave.</p></div><div class="cw-server-commerce-grid"><div><b>Compute top-up</b><span>Prepay extra compute for the active host.</span><label>Amount<select data-compute-amount><option value="500">${money(500)}</option><option value="1000">${money(1000)}</option><option value="2000">${money(2000)}</option><option value="5000">${money(5000)}</option></select></label><button type="button" data-compute-buy>Add compute</button></div><div><b>Monthly membership</b><span>Memberships add non-expiring lifetime compute credits each paid month.</span><label>Tier<select data-membership-tier><option value="member">Member · $5/mo · 100k credits</option><option value="maker">Maker · $10/mo · 250k credits</option><option value="builder">Builder · $20/mo · 600k credits</option><option value="steward">Steward · $40/mo · 1.5m credits</option></select></label><button type="button" data-membership-buy>Subscribe</button></div></div><output class="cw-server-commerce-status" data-commerce-status role="status"></output>`;return section;
}
function checkoutUrl(body){return clean(body?.checkout?.checkoutUrl||body?.checkout?.url||body?.topup?.checkoutUrl||body?.membership?.checkoutUrl||body?.membership?.checkout_url,4000)}
async function postJson(url,token,body){const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(clean(payload.error||payload.message||`Checkout returned HTTP ${response.status}.`,1200));return payload}
async function buyCompute(amountCents){
  const capacity=capacitySession();
  if(capacity){const payload=await postJson(new URL('/api/commerce/topup',capacity.origin),capacity.token,{grossCents:amountCents});const url=checkoutUrl(payload);if(!url)throw new Error('The Cloudflare host did not return a top-up checkout URL.');location.assign(url);return payload}
  const paired=marketplaceSession();
  if(paired){const payload=await postJson(new URL('/api/ai/node/live/topups',paired.baseUrl),paired.token,{grossCents:amountCents,idempotencyKey:`settings-topup:${crypto.randomUUID?.()||Date.now()}`});const url=checkoutUrl(payload);if(!url)throw new Error('The paired host did not return a top-up checkout URL.');location.assign(url);return payload}
  throw new Error('Join a Cloudflare host or pair with a live-payment host before adding compute.');
}
async function buyMembership(tierId){
  const capacity=capacitySession();if(!capacity)throw new Error('Membership checkout requires an active Cloudflare host-capacity session. Join a host first.');
  const payload=await postJson(new URL('/api/commerce/membership',capacity.origin),capacity.token,{tierId});const url=checkoutUrl(payload);if(!url)throw new Error('The host did not return a membership checkout URL.');location.assign(url);return payload;
}
function bindCommerce(form){
  const panel=form.querySelector(`#${COMMERCE_ID}`);if(!panel||panel.dataset.bound==='1')return;panel.dataset.bound='1';
  panel.addEventListener('click',async event=>{
    const topup=event.target.closest('[data-compute-buy]'),membership=event.target.closest('[data-membership-buy]');if(!topup&&!membership)return;
    const button=topup||membership,status=panel.querySelector('[data-commerce-status]');button.disabled=true;if(status)status.textContent='Opening secure checkout…';
    try{if(topup)await buyCompute(Number(panel.querySelector('[data-compute-amount]')?.value)||500);else await buyMembership(clean(panel.querySelector('[data-membership-tier]')?.value,80)||'member')}catch(error){if(status)status.textContent=clean(error?.message||error,1200);button.disabled=false}
  });
  const capacity=capacitySession(),paired=marketplaceSession(),status=panel.querySelector('[data-commerce-status]');if(status)status.textContent=capacity?`Connected to ${capacity.nodeId} for memberships and compute.`:paired?`Paired with ${paired.nodeId}; compute top-ups are available. Memberships need a Cloudflare host session.`:'Join or pair with a host to enable checkout.';
}
function enhance(form=document.querySelector('#cw-ai-settings-cleanroom-v188 form,[data-cw-cleanroom-form]')){
  if(!form)return false;installStyle();const shell=form.closest('.cw-clean-shell'),heading=shell?.querySelector('h2'),description=shell?.querySelector('header p'),dialog=form.closest('[role="dialog"]');if(heading)heading.textContent='Settings';if(description)description.textContent='Choose AI, safety, local models, membership, and compute. Opening this menu does not start a model.';dialog?.setAttribute('aria-label','Civweave settings');installTabbedLayout(form);const select=form.elements.namedItem('route');if(!select)return false;
  if(!select.querySelector(`option[value="${ROUTE}"]`)){const option=document.createElement('option');option.value=ROUTE;option.textContent='Server-side AI · local → host → Cloudflare';select.append(option)}
  if(!form.querySelector(`#${PANEL_ID}`)){const panel=serverPanel(),anchor=form.querySelector('[data-panel="deterministic"]')||form.firstElementChild;if(anchor)anchor.before(panel);else form.prepend(panel)}
  if(!form.querySelector(`#${COMMERCE_ID}`)){const panel=commercePanel();form.querySelector('[data-settings-tab-panel="membership"]')?.append(panel)}
  bindCommerce(form);
  if(form.dataset.serverAiBound!=='1'){
    form.dataset.serverAiBound='1';
    form.addEventListener('change',event=>{if(event.target!==select)return;if(select.value===ROUTE){event.stopImmediatePropagation();setServerVisibility(form,true)}else queueMicrotask(()=>setServerVisibility(form,false))},true);
    form.addEventListener('submit',event=>{if(select.value!==ROUTE)return;event.preventDefault();event.stopImmediatePropagation();saveServerRoute(form);setServerVisibility(form,true)},true);
  }
  if(savedRoute()===ROUTE){select.value=ROUTE;setServerVisibility(form,true)}
  return true;
}
async function openCommerce(){
  try{await globalThis.CivweaveModelSettingsControllerV173?.open?.()}catch{}
  let ticks=0;const timer=setInterval(()=>{const form=document.querySelector('#cw-ai-settings-cleanroom-v188 form,[data-cw-cleanroom-form]');if(form&&enhance(form)){clearInterval(timer);selectTab(form,'membership');return}if(++ticks>60)clearInterval(timer)},50);
}
function installEntry(){
  document.querySelectorAll('[data-civweave-commerce-entry]').forEach(button=>button.remove());
  document.querySelectorAll('[data-open-unified-ai-settings]').forEach(button=>{const label=button.querySelector('span:last-child');if(label)label.textContent='Settings';else if(button.textContent.trim()==='AI settings')button.textContent='Settings'});
}
function boot(){ensureDefaultRoute();enhance();installEntry()}
addEventListener('civweave:model-settings-opened',()=>queueMicrotask(()=>enhance()));addEventListener('pageshow',boot);document.readyState==='loading'?addEventListener('DOMContentLoaded',boot,{once:true}):queueMicrotask(boot);
globalThis.CivweaveServerAISettingsV301=Object.freeze({version:VERSION,route:ROUTE,enhance,openCommerce,buyCompute,buyMembership,capacitySession,marketplaceSession,savedRoute,ensureDefaultRoute,serverInteractive});
})();
