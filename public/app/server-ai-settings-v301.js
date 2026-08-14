(()=>{
'use strict';
const VERSION='1.0.117-server-ai-settings-v305-community-dividend';
const ROUTE='server-auto';
const SETTINGS_KEY='civweave.universal-ai.v127';
const PROFILES_KEY='civweave-model-profiles-v1';
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
function savedRoute(){const profiles=objectFrom(localStorage,PROFILES_KEY),saved=objectFrom(localStorage,SETTINGS_KEY),interactive=profiles.interactive||saved;return clean(interactive?.provider||interactive?.route,80).toLowerCase()}
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
  const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`#${PANEL_ID},#${COMMERCE_ID}{display:grid;gap:12px;padding:16px;border:1px solid rgba(126,239,213,.24);border-radius:15px;background:#0a1730}#${PANEL_ID}[hidden],#${COMMERCE_ID}[hidden]{display:none!important}.cw-settings-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.cw-settings-tabs button{min-width:0;padding-inline:8px;background:#0b1329;color:#cbd4ee}.cw-settings-tabs button[aria-selected="true"]{border-color:#7eeed5;background:#26365f;color:#fff;box-shadow:inset 0 -3px #7eeed5}.cw-settings-tab-panel{display:grid;gap:17px}.cw-settings-tab-panel[hidden]{display:none!important}.cw-server-order{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.cw-server-hop{padding:10px;border:1px solid #ffffff18;border-radius:11px;background:#071226}.cw-server-hop b{display:block}.cw-server-hop small{display:block;margin-top:4px;color:#b8c7df;letter-spacing:0!important;font-weight:500}.cw-server-commerce-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.cw-server-commerce-grid>div{display:grid;gap:8px;padding:12px;border:1px solid #ffffff16;border-radius:12px}.cw-server-commerce-grid label{display:grid;gap:6px}.cw-community-share-row{display:grid!important;grid-template-columns:auto 1fr!important;align-items:center;gap:8px!important}.cw-community-share-row input{width:auto}.cw-community-share-note{display:block;color:#b8c7df;font-size:.78rem;line-height:1.35}.cw-community-dividend-note{padding:10px 11px;border:1px solid #7eeed533;border-radius:10px;background:#7eeed50d;color:#d8fff5;font-size:.82rem;line-height:1.4}.cw-server-commerce-status{min-height:1.4em;color:#9ff2dc}@media(max-width:640px){.cw-server-order,.cw-server-commerce-grid{grid-template-columns:1fr}}`;document.head.append(style);
}
function selectTab(form,name){for(const button of form.querySelectorAll('[data-settings-tab]'))button.setAttribute('aria-selected',String(button.dataset.settingsTab===name));for(const panel of form.querySelectorAll('[data-settings-tab-panel]'))panel.hidden=panel.dataset.settingsTabPanel!==name}
function installTabbedLayout(form){if(form.dataset.settingsTabs==='1')return form;const tabs=document.createElement('nav');tabs.className='cw-settings-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Settings sections');tabs.innerHTML='<button type="button" role="tab" aria-selected="true" data-settings-tab="general">AI & safety</button><button type="button" role="tab" aria-selected="false" data-settings-tab="local-models">Local models</button><button type="button" role="tab" aria-selected="false" data-settings-tab="membership">Membership</button>';const general=document.createElement('div'),local=document.createElement('div'),membership=document.createElement('div');for(const [panel,name] of [[general,'general'],[local,'local-models'],[membership,'membership']]){panel.className='cw-settings-tab-panel';panel.dataset.settingsTabPanel=name;panel.hidden=name!=='general'}const children=[...form.children];form.append(tabs,general,local,membership);for(const child of children)general.append(child);const existingLocal=general.querySelector('#cw-local-ai-v266'),existingCommerce=general.querySelector(`#${COMMERCE_ID}`);if(existingLocal)local.append(existingLocal);if(existingCommerce)membership.append(existingCommerce);tabs.addEventListener('click',event=>{const button=event.target.closest('[data-settings-tab]');if(button)selectTab(form,button.dataset.settingsTab)});form.dataset.settingsTabs='1';return form}
function saveServerRoute(form){
  const interactive={route:ROUTE,provider:ROUTE,model:'civweave-server-auto-v1',endpoint:'',externalConsent:true,serverOrder:['device-local','server-local','cloudflare-workers-ai']};
  const saved={...interactive,consent:true,agenticEnabled:false,version:'1.0.117',settingsController:VERSION};
  try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(saved));localStorage.setItem(PROFILES_KEY,JSON.stringify({interactive,agentic:null,agenticEnabled:false,version:'1.0.117',settingsController:VERSION}))}catch{}
  try{globalThis.CivweaveModelRuntime?.saveSharedConfig?.(interactive,{profile:'interactive'})}catch{}
  const status=form.querySelector('[data-status]');if(status)status.textContent='Server-side AI saved. Civweave will try this device, then a paired self-hosted server, then Cloudflare capacity.';
  try{dispatchEvent(new CustomEvent('civweave:model-config-changed',{detail:{profile:'interactive',config:interactive,source:VERSION,at:new Date().toISOString()}}));dispatchEvent(new CustomEvent('civweave:server-ai-selected',{detail:{order:interactive.serverOrder,at:new Date().toISOString()}}))}catch{}
  return interactive;
}
function setServerVisibility(form,enabled){
  const panel=form.querySelector(`#${PANEL_ID}`);if(panel)panel.hidden=!enabled;
  if(enabled){for(const section of form.querySelectorAll('[data-panel="deterministic"],[data-panel="remote"]'))section.hidden=true}
}
function serverPanel(){
  const section=document.createElement('section');section.id=PANEL_ID;section.className='cw-clean-panel';section.hidden=true;section.innerHTML=`<div><h3>Server-side AI</h3><p>One setting, three rungs. Civweave uses the cheapest and most private available route first and only climbs when the earlier rung cannot finish the call.</p></div><div class="cw-server-order"><div class="cw-server-hop"><b>1 · This device</b><small>Your selected downloaded local model gets first attempt.</small></div><div class="cw-server-hop"><b>2 · Your host</b><small>A paired server-local/self-hosted model is next.</small></div><div class="cw-server-hop"><b>3 · Cloudflare</b><small>Capacity-backed Workers AI is the final online fallback.</small></div></div><div class="cw-clean-note">Selecting this route authorizes prompt failover to your paired host and Cloudflare when device-local inference cannot complete. Lifetime compute credits are not spent automatically.</div>`;return section;
}
function commercePanel(){
  const section=document.createElement('section');section.id=COMMERCE_ID;section.className='cw-clean-panel';section.innerHTML=`<div><h3>Membership & compute</h3><p>Membership and top-up compute strengthen the active Cloudflare community while preserving each member's personal credits.</p></div><div class="cw-community-dividend-note">Every $5/month of active membership contributes +2 potential free seats and a +200 daily-neuron target for every member. Free seats cap at 16, total residents cap at 28, and neuron bonuses are automatically capped by the funds actually available.</div><div class="cw-server-commerce-grid"><div><b>Compute top-up</b><span>Prepay extra compute for the active host. Cloudflare top-ups always share at least 1% with everyone.</span><label>Amount<select data-compute-amount><option value="500">${money(500)}</option><option value="1000">${money(1000)}</option><option value="2000">${money(2000)}</option><option value="5000">${money(5000)}</option></select></label><label>Community share<select data-community-share-bps><option value="100">1% shared</option><option value="200">2% shared</option><option value="300">3% shared</option><option value="400">4% shared</option><option value="500">5% shared</option></select></label><label class="cw-community-share-row"><input type="checkbox" data-node-equal-topup><span>Top up the node equally</span></label><small class="cw-community-share-note" data-community-share-note>1% of this top-up's service value is ring-fenced for the shared compute pool. Your remaining system-backed compute stays personal.</small><button type="button" data-compute-buy>Add compute</button></div><div><b>Monthly membership</b><span>Paid members keep the same community allowance as everyone else, add personal lifetime credits, and raise the whole node's target allowance.</span><label>Tier<select data-membership-tier><option value="member">Member · $5/mo · +200/day for everyone · 100k personal</option><option value="maker">Maker · $10/mo · +400/day for everyone · 250k personal</option><option value="builder">Builder · $20/mo · +800/day for everyone · 600k personal</option><option value="steward">Steward · $40/mo · +1,600/day for everyone · 1.5m personal</option></select></label><small class="cw-community-share-note">Seat boosts scale at +2 potential free seats per $5 of membership until the 16-free-seat instance cap is reached.</small><button type="button" data-membership-buy>Subscribe</button></div></div><output class="cw-server-commerce-status" data-commerce-status role="status"></output>`;return section;
}
function checkoutUrl(body){return clean(body?.checkout?.checkoutUrl||body?.checkout?.url||body?.topup?.checkoutUrl||body?.membership?.checkoutUrl||body?.membership?.checkout_url,4000)}
async function postJson(url,token,body){const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(clean(payload.error||payload.message||`Checkout returned HTTP ${response.status}.`,1200));return payload}
async function buyCompute(amountCents,{shareBps=100,shareMode='personal'}={}){
  const capacity=capacitySession();
  if(capacity){const payload=await postJson(new URL('/api/commerce/topup',capacity.origin),capacity.token,{grossCents:amountCents,shareBps,shareMode});const url=checkoutUrl(payload);if(!url)throw new Error('The Cloudflare host did not return a top-up checkout URL.');location.assign(url);return payload}
  const paired=marketplaceSession();
  if(paired){const payload=await postJson(new URL('/api/ai/node/live/topups',paired.baseUrl),paired.token,{grossCents:amountCents,idempotencyKey:`settings-topup:${crypto.randomUUID?.()||Date.now()}`});const url=checkoutUrl(payload);if(!url)throw new Error('The paired host did not return a top-up checkout URL.');location.assign(url);return payload}
  throw new Error('Join a Cloudflare host or pair with a live-payment host before adding compute.');
}
async function buyMembership(tierId){
  const capacity=capacitySession();if(!capacity)throw new Error('Membership checkout requires an active Cloudflare host-capacity session. Join a host first.');
  const payload=await postJson(new URL('/api/commerce/membership',capacity.origin),capacity.token,{tierId});const url=checkoutUrl(payload);if(!url)throw new Error('The host did not return a membership checkout URL.');location.assign(url);return payload;
}
function syncSharingControls(panel,capacity){
  const share=panel.querySelector('[data-community-share-bps]'),equal=panel.querySelector('[data-node-equal-topup]'),note=panel.querySelector('[data-community-share-note]');
  if(!share||!equal)return;
  const cloudflare=Boolean(capacity);share.disabled=!cloudflare||equal.checked;equal.disabled=!cloudflare;
  if(!note)return;
  if(!cloudflare){note.textContent='Community sharing applies to Cloudflare capacity top-ups. Pair-only host top-ups keep their host-defined accounting.';return}
  if(equal.checked){note.textContent='The full system-backed compute portion of this top-up will be ring-fenced for the node and divided through the shared daily pool.';return}
  note.textContent=`${Math.max(1,Math.min(5,Number(share.value||100)/100))}% of this top-up's service value is ring-fenced for the shared compute pool. Your remaining system-backed compute stays personal.`;
}
function bindCommerce(form){
  const panel=form.querySelector(`#${COMMERCE_ID}`);if(!panel||panel.dataset.bound==='1')return;panel.dataset.bound='1';
  const capacity=capacitySession();syncSharingControls(panel,capacity);
  panel.addEventListener('change',event=>{if(event.target.matches('[data-community-share-bps],[data-node-equal-topup]'))syncSharingControls(panel,capacitySession())});
  panel.addEventListener('click',async event=>{
    const topup=event.target.closest('[data-compute-buy]'),membership=event.target.closest('[data-membership-buy]');if(!topup&&!membership)return;
    const button=topup||membership,status=panel.querySelector('[data-commerce-status]');button.disabled=true;if(status)status.textContent='Opening secure checkout…';
    try{
      if(topup){
        const equal=Boolean(panel.querySelector('[data-node-equal-topup]')?.checked),shareBps=Math.max(100,Math.min(500,Number(panel.querySelector('[data-community-share-bps]')?.value)||100));
        await buyCompute(Number(panel.querySelector('[data-compute-amount]')?.value)||500,{shareBps,shareMode:equal?'node-equal':'personal'});
      }else await buyMembership(clean(panel.querySelector('[data-membership-tier]')?.value,80)||'member');
    }catch(error){if(status)status.textContent=clean(error?.message||error,1200);button.disabled=false}
  });
  const paired=marketplaceSession(),status=panel.querySelector('[data-commerce-status]');if(status)status.textContent=capacity?`Connected to ${capacity.nodeId}. Membership dividends and shared top-ups strengthen this community.`:paired?`Paired with ${paired.nodeId}; host-defined compute top-ups are available. Community dividends need a Cloudflare host session.`:'Join or pair with a host to enable checkout.';
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
function boot(){enhance();installEntry()}
addEventListener('civweave:model-settings-opened',()=>queueMicrotask(()=>enhance()));addEventListener('pageshow',boot);document.readyState==='loading'?addEventListener('DOMContentLoaded',boot,{once:true}):queueMicrotask(boot);
globalThis.CivweaveServerAISettingsV301=Object.freeze({version:VERSION,route:ROUTE,enhance,openCommerce,buyCompute,buyMembership,capacitySession,marketplaceSession});
})();
