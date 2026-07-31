(()=>{
  const params=new URLSearchParams(location.search);
  const setup=params.get('setup')==='1';
  const suppliedHost=params.get('host')||'';
  const DEFAULT_HOST='https://commonweave-host-node.onrender.com';
  const RELEASE_KEY='commonweave.host-release-seen.v1';
  const CURRENT_APP_VERSION='rc22.3.10';
  const CURRENT_HOST_BUILD='1.0.10-visual-runtime-recovery';
  const KEY='commonweave.host-node.v1';
  const NODE_KEY='commonweave.host-node-id.v1';
  let deferredInstall=null;
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredInstall=event;updateInstallButton()});
  function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function normalizeHost(value){
    let raw=String(value||'').trim();
    if(!raw)return DEFAULT_HOST;
    if(!/^https?:\/\//i.test(raw))raw=`https://${raw}`;
    try{const url=new URL(raw);if(url.hostname==='commonweave-host-node.onrender.com')url.protocol='https:';return url.origin}catch{return raw.replace(/\/$/,'')}
  }
  function current(){try{const value=JSON.parse(localStorage.getItem(KEY)||'null');if(value?.baseUrl)value.baseUrl=normalizeHost(value.baseUrl);return value}catch{return null}}
  function nodeId(){let id=localStorage.getItem(NODE_KEY);if(!id){id=`pocket:${crypto.randomUUID()}`;localStorage.setItem(NODE_KEY,id)}return id}
  async function connect(baseUrl,token=''){
    const root=normalizeHost(baseUrl);
    if(!/^https?:\/\//i.test(root))throw Error('Use a complete http:// or https:// host node URL.');
    const headers={'content-type':'application/json'};if(token)headers.authorization=`Bearer ${token}`;
    const health=await fetch(`${root}/api/health`,{headers}).then(async r=>{if(!r.ok)throw Error((await r.json().catch(()=>({}))).error||`Host returned ${r.status}`);return r.json()});
    const hostConfig=await fetch(`${root}/api/config`,{headers,cache:'no-store'}).then(async r=>r.ok?r.json():({features:[]})).catch(()=>({features:[]}));
    const vault=(()=>{try{return JSON.parse(localStorage.getItem('commonweave-identity-vault')||'null')}catch{return null}})();
    const registration=await fetch(`${root}/api/nodes/register`,{method:'POST',headers,body:JSON.stringify({nodeId:nodeId(),label:vault?.identity?.displayName||'Pocket Campus',system:'commonweave',capabilities:['offline-pwa','handoffs','presence','relay'],metadata:{userAgent:navigator.userAgent,installed:matchMedia('(display-mode: standalone)').matches}})}).then(async r=>{if(!r.ok)throw Error((await r.json().catch(()=>({}))).error||`Registration returned ${r.status}`);return r.json()});
    const config={schema:'commonweave.host-node.v1',baseUrl:root,apiBase:`${root}/api`,nodeId:registration.node.nodeId,hubName:health.name,token,features:Array.isArray(hostConfig.features)?hostConfig.features:[],hostBuild:health.build||hostConfig.build||'',appVersion:health.appVersion||hostConfig.appVersion||'',connectedAt:new Date().toISOString()};
    localStorage.setItem(KEY,JSON.stringify(config));
    window.dispatchEvent(new CustomEvent('commonweave:host-node-connected',{detail:config}));
    return config;
  }
  function releaseIsCurrent(release){
    return Boolean(release&&release.appVersion===CURRENT_APP_VERSION&&release.hostBuild===CURRENT_HOST_BUILD);
  }
  function rememberRelease(release){try{localStorage.setItem(RELEASE_KEY,JSON.stringify(release))}catch{}}
  function clearReleaseBanner(){document.querySelector('.cw-release-banner')?.remove();document.querySelector('style[data-cw-release-style]')?.remove()}
  function showRelease(release){
    if(!release?.hostBuild)return;
    if(releaseIsCurrent(release)){rememberRelease(release);clearReleaseBanner();return;}
    let seen=null;try{seen=JSON.parse(localStorage.getItem(RELEASE_KEY)||'null')}catch{}
    const changed=seen?.hostBuild!==release.hostBuild||seen?.appVersion!==release.appVersion||seen?.sha256!==release.sha256;
    if(!changed||document.querySelector('.cw-release-banner'))return;
    const bar=document.createElement('aside');bar.className='cw-release-banner';
    bar.innerHTML=`<div><strong>Commonweave update available</strong><span>${esc(release.appVersion||release.hostBuild)} is ready from your host node.</span></div><div><a href="${esc(release.appUrl||'/app/?setup=1')}">Open update</a><a href="${esc(release.downloadUrl||'/downloads/Commonweave-Mobile-Install-Kit.zip')}">Download ZIP</a><button type="button">Later</button></div>`;
    const style=document.createElement('style');style.dataset.cwReleaseStyle='1';style.textContent='.cw-release-banner{position:fixed;z-index:4000;left:50%;bottom:max(86px,calc(env(safe-area-inset-bottom) + 78px));transform:translateX(-50%);width:min(92vw,680px);min-height:110px;display:flex;gap:12px;align-items:center;justify-content:space-between;padding:18px 20px;border:1px solid rgba(126,229,255,.5);border-radius:18px;background-image:linear-gradient(90deg,rgba(2,15,24,.9),rgba(3,29,37,.78)),url("assets/world/dispatch-hall.webp");background-size:cover;background-position:center;color:#f5ffe9;box-shadow:0 0 42px rgba(76,215,255,.22),0 18px 60px #000a;backdrop-filter:blur(8px)}.cw-release-banner div{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.cw-release-banner strong{text-shadow:0 0 10px rgba(111,225,255,.7)}.cw-release-banner span{color:#d7eee7;font-size:.84rem}.cw-release-banner a,.cw-release-banner button{border:1px solid rgba(126,229,255,.42);border-radius:8px;padding:9px 12px;background:rgba(25,110,116,.72);color:#f5ffe9;font-weight:900;text-decoration:none}.cw-release-banner a:nth-child(2){background:rgba(72,52,124,.72)}.cw-release-banner button{background:rgba(17,44,50,.72)}@media(max-width:620px){.cw-release-banner{align-items:flex-start;flex-direction:column;bottom:max(70px,calc(env(safe-area-inset-bottom) + 62px));padding:14px}}';document.head.append(style);
    bar.querySelector('button').onclick=()=>{rememberRelease(release);bar.remove();style.remove()};
    bar.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>rememberRelease(release)));
    document.body.append(bar);
  }
  async function checkRelease(config=current()){
    const root=normalizeHost(config?.baseUrl||DEFAULT_HOST);
    try{const headers={};if(config?.token)headers.authorization=`Bearer ${config.token}`;const release=await fetch(`${root}/api/releases/current`,{headers,cache:'no-store'}).then(r=>{if(!r.ok)throw Error(`Release check returned ${r.status}`);return r.json()});showRelease(release);return release}catch{return null}
  }
  function subscribeReleases(config=current()){
    const root=normalizeHost(config?.baseUrl||DEFAULT_HOST);if(!root||typeof EventSource==='undefined')return;
    try{const source=new EventSource(`${root}/api/events`);source.addEventListener('release',event=>{try{showRelease(JSON.parse(event.data))}catch{}});window.addEventListener('beforeunload',()=>source.close(),{once:true})}catch{}
  }
  async function refreshHostCapabilities(config=current()){
    if(!config?.baseUrl)return config;
    try{
      const headers={};if(config.token)headers.authorization=`Bearer ${config.token}`;
      const remote=await fetch(`${normalizeHost(config.baseUrl)}/api/config`,{headers,cache:'no-store'}).then(r=>r.ok?r.json():null);
      if(remote){
        const next={...config,apiBase:remote.apiBase||config.apiBase||`${normalizeHost(config.baseUrl)}/api`,features:Array.isArray(remote.features)?remote.features:[],hostBuild:remote.build||config.hostBuild||'',appVersion:remote.appVersion||config.appVersion||''};
        localStorage.setItem(KEY,JSON.stringify(next));
        return next;
      }
    }catch{}
    return config;
  }
  async function heartbeat(){
    let config=current();if(!config)return;
    if(!Array.isArray(config.features))config=await refreshHostCapabilities(config);
    if(!config?.features?.includes('heartbeat'))return;
    const headers={'content-type':'application/json'};if(config.token)headers.authorization=`Bearer ${config.token}`;
    try{
      const response=await fetch(`${config.apiBase}/nodes/heartbeat`,{method:'POST',headers,body:JSON.stringify({nodeId:config.nodeId})});
      if(response.status===404){
        const refreshed=await refreshHostCapabilities(config);
        if(!refreshed?.features?.includes('heartbeat'))return;
      }
    }catch{}
  }
  setInterval(heartbeat,60000);setTimeout(heartbeat,2500);setInterval(()=>checkRelease(),10*60*1000);setTimeout(()=>{refreshHostCapabilities();checkRelease();subscribeReleases()},1500);
  window.CommonweaveHostNode={connect,current,nodeId,checkRelease,subscribeReleases,refreshHostCapabilities,defaultHost:DEFAULT_HOST,disconnect(){localStorage.removeItem(KEY)}};
  if(!setup)return;
  const style=document.createElement('style');style.textContent=`
  .cw-node-wizard{position:fixed;z-index:3000;inset:0;background-image:linear-gradient(rgba(1,8,12,.3),rgba(1,8,12,.65)),url("assets/world/town-square-home.webp");background-size:cover;background-position:center;display:grid;place-items:end center;padding:16px 16px max(16px,env(safe-area-inset-bottom));overflow:auto}.cw-node-card{width:min(720px,100%);max-height:72dvh;overflow:auto;border:0;border-radius:0;background:radial-gradient(ellipse at center,rgba(15,91,100,.34),rgba(2,16,26,.88) 65%,transparent 96%);color:#f7f2df;padding:24px 28px;text-shadow:0 1px 2px #001;box-shadow:none}.cw-node-card h1{margin:0 0 8px;font-size:clamp(1.8rem,8vw,3.2rem);text-shadow:0 0 14px rgba(111,225,255,.62)}.cw-node-card p{color:#d8e8e2}.cw-node-step{padding:14px 0;border-top:1px solid rgba(126,229,255,.2)}.cw-node-step:first-of-type{border-top:0}.cw-node-step strong{display:block;margin-bottom:7px}.cw-node-row{display:flex;gap:8px;flex-wrap:wrap}.cw-node-card input{width:100%;min-height:46px;border:0;border-bottom:2px solid rgba(126,229,255,.58);border-radius:0;background:rgba(2,19,29,.55);color:white;padding:10px}.cw-node-card button,.cw-node-card a{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 15px;border:1px solid rgba(126,229,255,.42);border-radius:8px;background:rgba(26,126,128,.62);color:white;font-weight:900;text-decoration:none;box-shadow:0 0 18px rgba(75,220,235,.12)}.cw-node-card .secondary{background:rgba(50,44,94,.62)}.cw-node-status{min-height:24px;font:700 12px ui-monospace,monospace;color:#a8ffe6}.cw-node-close{float:right!important;background:transparent!important;border:0!important}`;document.head.append(style);
  const host=normalizeHost(suppliedHost||current()?.baseUrl||DEFAULT_HOST);
  const overlay=document.createElement('section');overlay.className='cw-node-wizard';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.innerHTML=`<div class="cw-node-card"><button class="cw-node-close" data-close aria-label="Close setup">×</button><span style="font:800 11px ui-monospace,monospace;color:#f4bf68;letter-spacing:.12em">HOST NODE SETUP</span><h1>Install and connect</h1><p>Commonweave remains local-first. This node distributes the PWA and relays approved shared activity; your local records remain on your device unless a workflow explicitly sends them.</p><div class="cw-node-step"><strong>1. Connect this browser to a host node</strong><input id="cw-host-url" value="${esc(host)}" aria-label="Host node URL"><input id="cw-host-token" type="password" placeholder="Optional host token" aria-label="Optional host token" style="margin-top:8px"><div class="cw-node-row" style="margin-top:8px"><button id="cw-connect">Connect node</button><a class="secondary" href="/downloads/Commonweave-Mobile-Install-Kit.zip">Offline ZIP</a></div><div id="cw-node-status" class="cw-node-status"></div></div><div class="cw-node-step"><strong>2. Install the PWA</strong><p id="cw-install-copy">Install Commonweave from this secure origin so it opens full-screen and remains available offline.</p><div class="cw-node-row"><button id="cw-install" disabled>Install Commonweave</button><button class="secondary" id="cw-installed">I already installed it</button></div></div><div class="cw-node-step"><strong>3. Enter the campus</strong><p>The connection survives restarts. You can change or disconnect the host node later from World Settings.</p><button id="cw-enter">Enter Commonweave</button></div></div>`;document.body.append(overlay);
  const status=overlay.querySelector('#cw-node-status');
  function updateInstallButton(){const btn=overlay?.querySelector('#cw-install');if(!btn)return;const installed=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;btn.disabled=!deferredInstall||installed;overlay.querySelector('#cw-install-copy').textContent=installed?'Commonweave is already running as an installed app.':deferredInstall?'Your browser is ready to install Commonweave.':'Use your browser menu and choose “Install app” or “Add to Home Screen” if the button stays unavailable.'}
  updateInstallButton();
  overlay.querySelector('#cw-connect').onclick=async()=>{status.textContent='Connecting…';try{const config=await connect(overlay.querySelector('#cw-host-url').value,overlay.querySelector('#cw-host-token').value);status.textContent=`Connected to ${config.hubName} as ${config.nodeId.slice(0,18)}…`}catch(error){status.textContent=`Connection failed: ${error.message}`}};
  overlay.querySelector('#cw-install').onclick=async()=>{if(!deferredInstall)return;deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;updateInstallButton()};
  function enter(){overlay.remove();const next=new URL(location.href);next.searchParams.delete('setup');next.searchParams.delete('host');history.replaceState(history.state,'',next)}
  overlay.querySelector('#cw-installed').onclick=enter;overlay.querySelector('#cw-enter').onclick=enter;overlay.querySelector('[data-close]').onclick=enter;
})();
