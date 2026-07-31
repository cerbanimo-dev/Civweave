(()=>{
  const params=new URLSearchParams(location.search);
  const setup=params.get('setup')==='1';
  const suppliedHost=params.get('host')||'';
  const KEY='commonweave.host-node.v1';
  const NODE_KEY='commonweave.host-node-id.v1';
  let deferredInstall=null;
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredInstall=event;updateInstallButton()});
  function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function current(){try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch{return null}}
  function nodeId(){let id=localStorage.getItem(NODE_KEY);if(!id){id=`pocket:${crypto.randomUUID()}`;localStorage.setItem(NODE_KEY,id)}return id}
  async function connect(baseUrl,token=''){
    const root=String(baseUrl||'').trim().replace(/\/$/,'');
    if(!/^https?:\/\//i.test(root))throw Error('Use a complete http:// or https:// host node URL.');
    const headers={'content-type':'application/json'};if(token)headers.authorization=`Bearer ${token}`;
    const health=await fetch(`${root}/api/health`,{headers}).then(async r=>{if(!r.ok)throw Error((await r.json().catch(()=>({}))).error||`Host returned ${r.status}`);return r.json()});
    const vault=(()=>{try{return JSON.parse(localStorage.getItem('commonweave-identity-vault')||'null')}catch{return null}})();
    const registration=await fetch(`${root}/api/nodes/register`,{method:'POST',headers,body:JSON.stringify({nodeId:nodeId(),label:vault?.identity?.displayName||'Pocket Campus',system:'commonweave',capabilities:['offline-pwa','handoffs','presence','relay'],metadata:{userAgent:navigator.userAgent,installed:matchMedia('(display-mode: standalone)').matches}})}).then(async r=>{if(!r.ok)throw Error((await r.json().catch(()=>({}))).error||`Registration returned ${r.status}`);return r.json()});
    const config={schema:'commonweave.host-node.v1',baseUrl:root,apiBase:`${root}/api`,nodeId:registration.node.nodeId,hubName:health.name,token,connectedAt:new Date().toISOString()};
    localStorage.setItem(KEY,JSON.stringify(config));
    window.dispatchEvent(new CustomEvent('commonweave:host-node-connected',{detail:config}));
    return config;
  }
  async function heartbeat(){const config=current();if(!config)return;const headers={'content-type':'application/json'};if(config.token)headers.authorization=`Bearer ${config.token}`;fetch(`${config.apiBase}/nodes/heartbeat`,{method:'POST',headers,body:JSON.stringify({nodeId:config.nodeId})}).catch(()=>{})}
  setInterval(heartbeat,60000);heartbeat();
  window.CommonweaveHostNode={connect,current,nodeId,disconnect(){localStorage.removeItem(KEY)}};
  if(!setup)return;
  const style=document.createElement('style');style.textContent=`
  .cw-node-wizard{position:fixed;z-index:3000;inset:0;background:#02090de8;display:grid;place-items:center;padding:16px;overflow:auto}.cw-node-card{width:min(620px,100%);border:1px solid #ffffff2b;border-radius:24px;background:#0b1e28;color:#f7f2df;padding:22px;box-shadow:0 30px 90px #000}.cw-node-card h1{margin:0 0 8px;font-size:clamp(1.8rem,8vw,3.2rem)}.cw-node-card p{color:#c9d7d4}.cw-node-step{padding:14px 0;border-top:1px solid #ffffff1c}.cw-node-step:first-of-type{border-top:0}.cw-node-step strong{display:block;margin-bottom:7px}.cw-node-row{display:flex;gap:8px;flex-wrap:wrap}.cw-node-card input{width:100%;min-height:46px;border:1px solid #ffffff35;border-radius:10px;background:#06131b;color:white;padding:10px}.cw-node-card button,.cw-node-card a{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 15px;border:0;border-radius:11px;background:#2a8c83;color:white;font-weight:900;text-decoration:none}.cw-node-card .secondary{background:#243946}.cw-node-status{min-height:24px;font:700 12px ui-monospace,monospace;color:#8ff1d6}.cw-node-close{float:right!important;background:transparent!important;border:1px solid #ffffff2b!important}`;document.head.append(style);
  const host=suppliedHost||current()?.baseUrl||location.origin;
  const overlay=document.createElement('section');overlay.className='cw-node-wizard';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.innerHTML=`<div class="cw-node-card"><button class="cw-node-close" data-close aria-label="Close setup">×</button><span style="font:800 11px ui-monospace,monospace;color:#f4bf68;letter-spacing:.12em">HOST NODE SETUP</span><h1>Install and connect</h1><p>Commonweave remains local-first. This node distributes the PWA and relays approved shared activity; your local records remain on your device unless a workflow explicitly sends them.</p><div class="cw-node-step"><strong>1. Connect this browser to a host node</strong><input id="cw-host-url" value="${esc(host)}" aria-label="Host node URL"><input id="cw-host-token" type="password" placeholder="Optional host token" aria-label="Optional host token" style="margin-top:8px"><div class="cw-node-row" style="margin-top:8px"><button id="cw-connect">Connect node</button><a class="secondary" href="/downloads/Commonweave-Mobile-Install-Kit.zip">Offline ZIP</a></div><div id="cw-node-status" class="cw-node-status"></div></div><div class="cw-node-step"><strong>2. Install the PWA</strong><p id="cw-install-copy">Install Commonweave from this secure origin so it opens full-screen and remains available offline.</p><div class="cw-node-row"><button id="cw-install" disabled>Install Commonweave</button><button class="secondary" id="cw-installed">I already installed it</button></div></div><div class="cw-node-step"><strong>3. Enter the campus</strong><p>The connection survives restarts. You can change or disconnect the host node later from World Settings.</p><button id="cw-enter">Enter Commonweave</button></div></div>`;document.body.append(overlay);
  const status=overlay.querySelector('#cw-node-status');
  function updateInstallButton(){const btn=overlay?.querySelector('#cw-install');if(!btn)return;const installed=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;btn.disabled=!deferredInstall||installed;overlay.querySelector('#cw-install-copy').textContent=installed?'Commonweave is already running as an installed app.':deferredInstall?'Your browser is ready to install Commonweave.':'Use your browser menu and choose “Install app” or “Add to Home Screen” if the button stays unavailable.'}
  updateInstallButton();
  overlay.querySelector('#cw-connect').onclick=async()=>{status.textContent='Connecting…';try{const config=await connect(overlay.querySelector('#cw-host-url').value,overlay.querySelector('#cw-host-token').value);status.textContent=`Connected to ${config.hubName} as ${config.nodeId.slice(0,18)}…`}catch(error){status.textContent=`Connection failed: ${error.message}`}};
  overlay.querySelector('#cw-install').onclick=async()=>{if(!deferredInstall)return;deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;updateInstallButton()};
  function enter(){overlay.remove();const next=new URL(location.href);next.searchParams.delete('setup');next.searchParams.delete('host');history.replaceState(history.state,'',next)}
  overlay.querySelector('#cw-installed').onclick=enter;overlay.querySelector('#cw-enter').onclick=enter;overlay.querySelector('[data-close]').onclick=enter;
})();
