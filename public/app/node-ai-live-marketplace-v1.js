(()=>{
'use strict';
const VERSION='1.0.86-node-live-money-v1';
const ROOT_ID='nodeLiveCredits';
const SESSION_KEY='civweave.node-ai-marketplace.sessions.v1';
const clean=(value,max=4000)=>String(value??'').trim().slice(0,max);
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const money=value=>Number.isSafeInteger(Number(value))?`$${(Number(value)/100).toFixed(2)}`:'—';
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
let root=null,busy=false,discoveryHandler=null;
function sessions(){try{return parse(sessionStorage.getItem(SESSION_KEY),{})||{}}catch{return{}}}
function market(){return globalThis.CivweaveNodeAIMarketplaceV1||null}
function endpoint(row){const value=clean(row?.endpoints?.baseUrls?.[0]);if(!value)return null;try{return new URL(value,location.href).origin}catch{return null}}
function grouped(){const rows=market()?.candidates?.()||[],map=new Map();for(const row of rows){if(!row?.nodeId||map.has(row.nodeId))continue;map.set(row.nodeId,{nodeId:row.nodeId,displayName:row.displayName||row.nodeId,baseUrl:endpoint(row)})}return[...map.values()]}
async function fetchJson(url,options={}){const response=await fetch(url,{cache:'no-store',...options});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(clean(body?.error,1200)||`${new URL(url,location.href).pathname} returned ${response.status}.`);return body}
async function liveState(node){if(!node.baseUrl)return{...node,live:false,reason:'No HTTP origin advertised.'};try{const result=await fetchJson(new URL('/api/ai/node/live/status',node.baseUrl));return{...node,live:Boolean(result?.live?.enabled),status:result?.live||{}}}catch(error){return{...node,live:false,reason:error.message}}}
function installStyle(){
  if(document.getElementById('cw-live-node-money-style'))return;
  const style=document.createElement('style');
  style.id='cw-live-node-money-style';
  style.textContent=`#${ROOT_ID}{display:grid;gap:7px}.cw-live-money{padding:9px;border:1px solid #ffffff18;border-radius:10px;background:#ffffff06}.cw-live-money strong{display:block;font-size:11px}.cw-live-money small{display:block;margin:3px 0 7px;color:var(--muted,#91a9aa);font-size:9px;line-height:1.45}.cw-live-money-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px}.cw-live-money input{min-width:0;width:100%;padding:7px;border:1px solid #ffffff1f;border-radius:8px;background:#02080d;color:var(--text,#eaf7f3);font:inherit;font-size:10px}.cw-live-money button{border:1px solid #73e6e066;border-radius:8px;background:#73e6e012;color:var(--text,#eaf7f3);padding:7px 8px;font:inherit;font-size:9px;cursor:pointer}.cw-live-money button:disabled{opacity:.45}.cw-live-money-status{font-size:9px;color:#9bdd91;margin-top:6px}`;
  document.head.append(style);
}
async function checkout(nodeId,amountCents){
  const node=grouped().find(item=>item.nodeId===nodeId),saved=sessions()[nodeId];
  if(!node?.baseUrl)throw new Error('This node does not advertise a live payment origin.');
  if(!saved?.token)throw new Error('Pair with this node before adding live credit.');
  const body=await fetchJson(new URL('/api/ai/node/live/topups',saved.baseUrl||node.baseUrl),{
    method:'POST',
    headers:{authorization:`Bearer ${saved.token}`,'content-type':'application/json'},
    body:JSON.stringify({
      grossCents:amountCents,
      idempotencyKey:`finder-live:${crypto.randomUUID?.()||Date.now()}`,
      successUrl:`${location.origin}${location.pathname}?nodeTopup=success`,
      cancelUrl:`${location.origin}${location.pathname}?nodeTopup=cancelled`
    })
  });
  const url=clean(body?.checkout?.checkoutUrl);
  if(!url)throw new Error('The node did not return a checkout URL.');
  location.assign(url);
  return body;
}
async function render(){
  if(!root||busy)return;
  busy=true;
  installStyle();
  root.innerHTML='<div class="note">Checking paired nodes for live payment readiness…</div>';
  try{
    const nodes=grouped(),saved=sessions();
    if(!nodes.length){root.innerHTML='<div class="note">Discover a Node AI service first. Live credit is offered only by nodes that explicitly enable it.</div>';return}
    const states=await Promise.all(nodes.map(liveState));
    const available=states.filter(node=>node.live&&saved[node.nodeId]?.token);
    if(!available.length){
      const liveUnpaired=states.filter(node=>node.live).length;
      root.innerHTML=`<div class="note">${liveUnpaired?'Live-payment nodes are visible, but pair with one before paying it.':'No discovered node currently advertises live payments. Sandbox trial credit remains separate.'}</div>`;
      return;
    }
    root.innerHTML=available.map(node=>`<div class="cw-live-money" data-live-node="${esc(node.nodeId)}"><strong>${esc(node.displayName)}</strong><small>Pay this node for prepaid service credit. The node operator receives the charge through their connected payout account; Civweave applies the node’s declared platform fee.</small><div class="cw-live-money-row"><input data-live-amount type="number" min="1" max="1000" step="1" value="5" aria-label="Live credit amount in dollars"><button data-live-pay type="button">Add ${money(500)} live credit</button></div><div class="cw-live-money-status">Live payments enabled · operator payouts ${esc(node.status?.operatorPayouts||'connected account')}</div></div>`).join('');
  }finally{busy=false}
}
function bind(){
  if(!root)return;
  root.addEventListener('input',event=>{
    const input=event.target.closest?.('[data-live-amount]');
    if(!input)return;
    const card=input.closest('[data-live-node]'),button=card?.querySelector('[data-live-pay]'),dollars=Math.max(1,Math.min(1000,Number(input.value)||0));
    if(button)button.textContent=`Add ${money(Math.round(dollars*100))} live credit`;
  });
  root.addEventListener('click',async event=>{
    const button=event.target.closest?.('[data-live-pay]');
    if(!button)return;
    const card=button.closest('[data-live-node]'),nodeId=clean(card?.dataset.liveNode,180),input=card?.querySelector('[data-live-amount]'),amount=Math.round(Math.max(1,Math.min(1000,Number(input?.value)||0))*100),status=card?.querySelector('.cw-live-money-status');
    button.disabled=true;
    try{if(status)status.textContent='Opening secure checkout…';await checkout(nodeId,amount)}
    catch(error){if(status)status.textContent=error.message;button.disabled=false}
  });
}
function start(){root=document.getElementById(ROOT_ID);if(!root)return false;bind();render().catch(()=>{});discoveryHandler=()=>render().catch(()=>{});addEventListener('civweave:node-ai-discovery-changed',discoveryHandler);return true}
function stop(){if(discoveryHandler)removeEventListener('civweave:node-ai-discovery-changed',discoveryHandler);discoveryHandler=null;root=null}
globalThis.CivweaveNodeAILiveMarketplaceV1=Object.freeze({version:VERSION,start,stop,render,checkout});
if(document.readyState==='loading')addEventListener('DOMContentLoaded',start,{once:true});else queueMicrotask(start);
})();
