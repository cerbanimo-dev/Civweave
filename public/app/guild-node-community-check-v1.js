(()=>{
'use strict';
// Opt-in, resident-authenticated community check-in; no background location tracking.
const VERSION='civweave.guild-node-community-check.v1',ID='cw-community-node-check-v1',LAUNCH='cw-community-check-launcher-v1',STYLE='cw-community-check-style-v1';
let root=null,busy=false;
const clean=(v,max=400)=>String(v??'').slice(0,max);
function installStyle(){
  if(document.getElementById(STYLE))return;
  const style=document.createElement('style');style.id=STYLE;
  style.textContent=`
#${ID}[hidden]{display:none!important}#${ID}{position:fixed;inset:0;z-index:2147483647;padding:16px;background:#020913dc;display:grid;place-items:center;color:#f4fffc;font:15px/1.5 system-ui,sans-serif}
#${ID} .cw-proof-panel{width:min(540px,100%);max-height:calc(100dvh - 24px);overflow:auto;border-radius:20px;border:1px solid #7ce3c88c;padding:20px;background:linear-gradient(145deg,#0b2a32,#121b36);box-shadow:0 25px 80px #000a}
#${ID} .cw-proof-top{display:flex;justify-content:space-between;gap:10px;align-items:center}#${ID} h2{font-size:1.2rem;margin:0}
#${ID} p{margin:10px 0}#${ID} .cw-proof-muted{color:#c3dcda;font-size:.9rem}#${ID} .cw-proof-code{font:750 1.35rem ui-monospace,monospace;letter-spacing:.2em;width:100%;padding:12px;border-radius:12px;background:#061820;border:1px solid #8ae9c780;color:#fff;text-transform:uppercase}
#${ID} button,#${LAUNCH}{min-height:44px;border-radius:12px;border:1px solid #86dfc0a8;padding:8px 13px;background:#164438;color:#fff;cursor:pointer;font:700 .9rem system-ui}
#${ID} button:disabled{opacity:.5;cursor:not-allowed}#${ID} .cw-proof-result{min-height:1.8em;white-space:pre-line}
#${LAUNCH}{display:block;width:100%;margin-top:12px}
`;document.head.append(style);
}
function currentSession(){
  const api=globalThis.CivweaveHostNodeSessionV1;
  if(!api?.sessionFor)return null;
  const selected=api.selectedOrigin?.()||'';
  const session=selected?api.sessionFor(selected):api.sessionFor();
  return session?.token&&session?.origin&&(!selected||session.origin===selected)?session:null;
}
function ensure(){
  if(root?.isConnected)return root;installStyle();
  root=document.createElement('section');root.id=ID;root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Guild physical node verification');
  root.innerHTML=`<div class="cw-proof-panel"><div class="cw-proof-top"><h2>Community node check</h2><button type="button" data-close aria-label="Close verification">Close</button></div>
    <p>Earn 1 Guild verification token for checking a physical server at its Guild Map location.</p>
    <p class="cw-proof-muted">Visit the public Guild location, read the rotating eight-character code on the physical server screen, then tap Verify. Your browser asks permission for a one-time location reading. Coordinates are evaluated by the Guild Cloud but are not stored in its reward ledger.</p>
    <p class="cw-proof-muted" data-account></p><p class="cw-proof-muted" data-node></p>
    <label for="cw-proof-code">Code on physical server</label><input id="cw-proof-code" class="cw-proof-code" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="8" pattern="[A-Za-z2-7]{8}" placeholder="ABCDEFGH">
    <p class="cw-proof-result" role="status" aria-live="polite"></p>
    <button type="button" data-verify>Verify nearby server</button>
    <p class="cw-proof-muted">One reward per member per day; up to 20 Guild-wide daily. Invalid codes or unclear location readings do not earn tokens. A valid code observed away from the claimed pin can flag the location for review; one person's report never removes a server.</p></div>`;
  root.addEventListener('click',event=>{if(event.target===root||event.target.closest?.('[data-close]'))close();if(event.target.closest?.('[data-verify]'))void verify()});
  root.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
  document.body.append(root);return root;
}
function message(value){const e=root?.querySelector('.cw-proof-result');if(e)e.textContent=clean(value,600)}
async function apiRequest(session,method='GET',data=null){
  const url=new URL('/api/guild/physical/check-in',session.origin);
  if(session.nodeId)url.searchParams.set('nodeId',session.nodeId);
  const r=await fetch(url,{method,cache:'no-store',headers:{authorization:'Bearer '+session.token,accept:'application/json',...(data?{'content-type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{})});
  const payload=await r.json().catch(()=>({}));if(!r.ok||payload.ok===false)throw Error(payload.error||'Guild verification unavailable (HTTP '+r.status+')');
  return payload;
}
function show(packet){
  const account=root?.querySelector('[data-account]');if(account)account.textContent='Your verification tokens: '+(packet?.account?.verificationTokens??packet?.verificationTokens??0)+' (Guild recognition credits; not cash or AI neurons)';
  const node=root?.querySelector('[data-node]');const on=packet?.onboarding;if(node)node.textContent=on?.nodeId?'Node '+on.nodeId+' · '+(on.nodeState||'unpaired'):'This Guild has no paired physical server.';
}
async function open(){
  ensure().hidden=false;message('Checking your Guild session…');
  const session=currentSession();
  if(!session){message('Join and log in to your Guild first, then return to verify the nearby physical server.');return false}
  try{show(await apiRequest(session));message('Ready for a local verification code.')}catch(e){message(e.message)}
  root.querySelector('.cw-proof-code')?.focus({preventScroll:true});return true;
}
function close(){if(root)root.hidden=true}
function readPosition(){return new Promise((resolve,reject)=>{
  if(!globalThis.isSecureContext||!navigator.geolocation)return reject(Error('Location check needs a secure browser and location permission.'));
  navigator.geolocation.getCurrentPosition(p=>resolve({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracyMeters:p.coords.accuracy,capturedAt:new Date(p.timestamp).toISOString()}),error=>reject(Error(error.message)),{enableHighAccuracy:false,maximumAge:0,timeout:20000});
})}
async function verify(){
  if(busy)return;busy=true;const button=root.querySelector('[data-verify]');button.disabled=true;
  try{
    const session=currentSession();if(!session)throw Error('Please log in to your selected Guild first.');
    const code=clean(root.querySelector('.cw-proof-code').value,8).trim().toUpperCase();if(!/^[A-Z2-7]{8}$/.test(code))throw Error('Enter the rotating eight-character server code.');
    message('Checking your one-time location reading and the server code…');
    const position=await readPosition();
    const result=await apiRequest(session,'POST',{code,position});
    show(result);
    message(result.verification==='nearby'?'Local server verified. You earned '+result.awardedTokens+' Guild verification token'+(result.awardedTokens===1?'':'s')+'.'+(result.awardedTokens===0?' Daily reward limit has been reached.':''):'The location did not match the Guild Map pin. This is now an evidence-based location report; repeated independent reports may flag this physical server as down.');
  }catch(e){message('Unable to verify: '+clean(e.message))}
  finally{busy=false;button.disabled=false}
}
function installLauncher(){
  const lobby=document.getElementById('cw-host-node-lobby');if(!lobby||lobby.querySelector('#'+LAUNCH))return;
  const button=document.createElement('button');button.id=LAUNCH;button.type='button';button.textContent='Verify physical Guild server · earn tokens';button.addEventListener('click',()=>void open());
  (lobby.querySelector('#cw-host-node-help')||lobby.querySelector('.cw-host-node-actions')||lobby).after(button);
}
addEventListener('civweave:nearby-guilds-opened',installLauncher);
addEventListener('civweave:host-node-logged-in',installLauncher);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installLauncher,{once:true});else installLauncher();
globalThis.CivweaveGuildNodeCommunityCheckV1=Object.freeze({version:VERSION,open,close});
})();
