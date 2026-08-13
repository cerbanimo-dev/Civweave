(() => {
'use strict';

const REVISION='host-node-paid-join-v1';
const CREDENTIAL_KEY='civweave.host-node.credentials.v1';
const SELECTION_KEY='civweave.host-node.selection.v1';
const HOST_ENDPOINT_KEY='federation-finder.physical-node-endpoint';
const clean=(value,max=4000)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};

function randomToken(bytes=32){const data=crypto.getRandomValues(new Uint8Array(bytes));let binary='';for(const byte of data)binary+=String.fromCharCode(byte);return btoa(binary).replaceAll('+','-').replaceAll('/','_').replace(/=+$/g,'');}
function selected(){
  try{
    const params=new URLSearchParams(location.search),saved=parse(localStorage.getItem(SELECTION_KEY),{}),raw=params.get('host')||saved?.origin||localStorage.getItem(HOST_ENDPOINT_KEY)||'';
    const origin=new URL(raw).origin,nodeId=clean(params.get('node')||saved?.nodeId,180);
    return{origin,nodeId};
  }catch{return{origin:'',nodeId:''};}
}
function ensureIdentity(origin,nodeId){
  const all=parse(localStorage.getItem(CREDENTIAL_KEY),{}),key=nodeId?`${origin}#${nodeId}`:origin,prior=all[key]||all[origin];
  if(prior?.userId&&prior?.credential)return prior;
  const identity={schema:'civweave.host-node-device-login.v1',userId:`cwres:${randomToken(18)}`,credential:randomToken(32),createdAt:new Date().toISOString()};
  all[key]=identity;localStorage.setItem(CREDENTIAL_KEY,JSON.stringify(all));return identity;
}
function slots(id){const text=document.getElementById(id)?.textContent||'';const n=Number(text.replace(/[^0-9.-]/g,''));return Number.isFinite(n)&&n>=0?Math.floor(n):null;}
function activeSession(nodeId,origin){return Boolean(globalThis.CivweaveHostNodeSessionV1?.sessionFor?.(nodeId||origin));}
function installStyles(){
  if(document.getElementById('cw-paid-join-style'))return;
  const style=document.createElement('style');style.id='cw-paid-join-style';style.textContent=`
    .cw-paid-join{display:none;gap:10px;align-items:end;flex-wrap:wrap;margin-top:12px;padding:13px;border:1px solid #f3d77d55;border-radius:15px;background:#160f08aa;color:#fff}
    .cw-paid-join[data-visible="true"]{display:flex}.cw-paid-join label{display:grid;gap:5px;color:#d9cdaa;font:800 .7rem/1.2 system-ui;letter-spacing:.05em;text-transform:uppercase}
    .cw-paid-join select{min-height:42px;padding:8px 32px 8px 10px;border:1px solid #ffffff2a;border-radius:11px;background:#09141f;color:#fff;font:800 .82rem system-ui}
    .cw-paid-join button{min-height:42px;padding:9px 14px;border-radius:11px;border:1px solid #f3d77d77;background:linear-gradient(135deg,#f3d77d,#b99cff);color:#16131a;font:900 .82rem/1 system-ui;cursor:pointer}
    .cw-paid-join button:disabled{opacity:.6;cursor:wait}.cw-paid-join p{flex:1 1 100%;margin:0;color:#d8cdbd;font-size:.75rem;line-height:1.4}
  `;document.head.append(style);
}
function ensureUi(){
  const actions=document.querySelector('.cw-host-node-actions');if(!actions)return null;installStyles();
  let box=document.getElementById('cw-paid-join');
  if(!box){box=document.createElement('section');box.id='cw-paid-join';box.className='cw-paid-join';box.dataset.visible='false';box.innerHTML=`
    <label>Membership<select id="cw-paid-tier"><option value="member">Member · $5/month</option><option value="maker">Maker · $10/month</option><option value="builder">Builder · $20/month</option><option value="steward">Steward · $40/month</option></select></label>
    <button id="cw-paid-join-button" type="button">Join this Hub</button>
    <p id="cw-paid-join-note">This Hub has paid-expansion room but no free community seats. Checkout does not consume a free seat.</p>`;actions.insertAdjacentElement('afterend',box);box.querySelector('#cw-paid-join-button')?.addEventListener('click',()=>void beginCheckout());}
  return box;
}
function apply(){
  const box=ensureUi();if(!box)return false;
  const free=slots('cw-host-free-slots'),paid=slots('cw-host-paid-slots'),{origin,nodeId}=selected();
  if(free==null||paid==null)return false;
  const show=Boolean(origin.startsWith('https://')&&nodeId&&free<1&&paid>0&&!activeSession(nodeId,origin));box.dataset.visible=String(show);
  const join=document.getElementById('cw-host-node-join');if(show&&join){join.dataset.mode='search';join.textContent='Find a free Hub';}
  return true;
}
async function beginCheckout(){
  const{origin,nodeId}=selected(),button=document.getElementById('cw-paid-join-button'),note=document.getElementById('cw-paid-join-note');
  if(!origin.startsWith('https://')||!nodeId){if(note)note.textContent='Choose a Cloudflare Hub before starting membership checkout.';return;}
  const identity=ensureIdentity(origin,nodeId),tierId=document.getElementById('cw-paid-tier')?.value||'member';if(button){button.disabled=true;button.textContent='Opening checkout…';}
  try{
    const endpoint=new URL('/api/commerce/membership/prejoin',origin);endpoint.searchParams.set('nodeId',nodeId);
    const response=await fetch(endpoint,{method:'POST',cache:'no-store',headers:{accept:'application/json','content-type':'application/json','x-civweave-node-id':nodeId},body:JSON.stringify({userId:identity.userId,credential:identity.credential,tierId})}),packet=await response.json().catch(()=>({}));
    if(!response.ok)throw Object.assign(new Error(packet.error||`Hub returned HTTP ${response.status}.`),{status:response.status});
    const checkoutUrl=packet?.checkout?.checkoutUrl||packet?.membership?.checkoutUrl;if(!checkoutUrl)throw new Error('The Hub did not return a membership checkout URL.');location.assign(checkoutUrl);
  }catch(error){if(note)note.textContent=Number(error?.status)===409?'That paid-expansion capacity just filled. Find another Hub or a free community slot.':`Could not start membership checkout: ${error?.message||error}`;if(button){button.disabled=false;button.textContent='Join this Hub';}}
}
async function finishReturn(){
  const params=new URLSearchParams(location.search),result=params.get('membership');if(!result)return;
  const{origin,nodeId}=selected(),help=document.getElementById('cw-host-node-help');
  if(result==='cancelled'){if(help)help.textContent='Membership checkout was canceled. No paid seat was activated.';apply();return;}
  if(!origin||!nodeId||!globalThis.CivweaveHostNodeSessionV1?.join)return;
  if(help)help.textContent='Membership confirmed. Finishing your Hub login…';let lastError=null;
  for(let attempt=0;attempt<8;attempt+=1){try{await globalThis.CivweaveHostNodeSessionV1.join(origin,{nodeId,createCredential:false});if(help)help.textContent='Membership active. You are logged in to this Hub.';document.getElementById('cw-host-node-refresh')?.click();apply();return;}catch(error){lastError=error;await new Promise(resolve=>setTimeout(resolve,800+attempt*350));}}
  if(help)help.textContent=`Membership checkout completed, but the Hub is still confirming admission: ${lastError?.message||lastError}. Your device login is saved; use Log back in to retry.`;
}
const observer=new MutationObserver(()=>apply());observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});addEventListener('pagehide',()=>observer.disconnect(),{once:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{apply();void finishReturn();},{once:true});else{apply();void finishReturn();}
globalThis.CivweaveHostNodePaidJoinV1=Object.freeze({revision:REVISION,apply,beginCheckout,finishReturn});
})();
