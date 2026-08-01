(()=>{
  'use strict';
  const params=new URLSearchParams(location.search);
  const setup=params.get('setup')==='1';
  const suppliedHost=params.get('host')||'';
  const DEFAULT_HOST='https://commonweave-host-node.onrender.com';
  const KEY='commonweave.host-node.v1';
  const NODE_KEY='commonweave.host-node-id.v1';
  const RELEASE_KEY='commonweave.host-release.v2';
  const MODEL_CONFIRMED='commonweave.model-preference-confirmed.v1';
  let deferredInstall=null;
  let releaseState=null;

  const safeJson=(raw,fallback=null)=>{try{return JSON.parse(raw)}catch{return fallback}};
  const normalizeHost=value=>{let raw=String(value||'').trim();if(!raw)return DEFAULT_HOST;if(!/^https?:\/\//i.test(raw))raw=`https://${raw}`;try{return new URL(raw).origin}catch{return DEFAULT_HOST}};
  const current=()=>{const value=safeJson(localStorage.getItem(KEY),null);if(value?.baseUrl)value.baseUrl=normalizeHost(value.baseUrl);return value};
  const nodeId=()=>{let id=localStorage.getItem(NODE_KEY);if(!id){id=`pocket:${crypto.randomUUID()}`;localStorage.setItem(NODE_KEY,id)}return id};
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredInstall=event});

  async function connect(baseUrl,token=''){
    const root=normalizeHost(baseUrl),headers={'content-type':'application/json'};if(token)headers.authorization=`Bearer ${token}`;
    const health=await fetch(`${root}/api/health`,{headers,cache:'no-store'}).then(async r=>{if(!r.ok)throw Error(`Host returned ${r.status}`);return r.json()});
    const configResponse=await fetch(`${root}/api/config`,{headers,cache:'no-store'}).then(r=>r.ok?r.json():({features:[]})).catch(()=>({features:[]}));
    const registration=await fetch(`${root}/api/nodes/register`,{method:'POST',headers,body:JSON.stringify({nodeId:nodeId(),label:'Pocket Campus',system:'commonweave',capabilities:['offline-pwa','handoffs','presence','relay']})}).then(async r=>{if(!r.ok)throw Error(`Registration returned ${r.status}`);return r.json()});
    const config={schema:'commonweave.host-node.v1',baseUrl:root,apiBase:`${root}/api`,nodeId:registration.node.nodeId,hubName:health.name,token,features:Array.isArray(configResponse.features)?configResponse.features:[],connectedAt:new Date().toISOString()};
    localStorage.setItem(KEY,JSON.stringify(config));
    dispatchEvent(new CustomEvent('commonweave:host-node-connected',{detail:config}));
    return config;
  }

  async function checkRelease(config=current(),{announce=false}={}){
    const root=normalizeHost(config?.baseUrl||DEFAULT_HOST),headers={};if(config?.token)headers.authorization=`Bearer ${config.token}`;
    try{
      const release=await fetch(`${root}/api/releases/current`,{headers,cache:'no-store'}).then(r=>{if(!r.ok)throw Error(`Release check returned ${r.status}`);return r.json()});
      releaseState={...release,checkedAt:new Date().toISOString()};localStorage.setItem(RELEASE_KEY,JSON.stringify(releaseState));
      dispatchEvent(new CustomEvent('commonweave:update-check-complete',{detail:releaseState}));
      if(announce)showUpdateStatus(releaseState);
      return releaseState;
    }catch(error){releaseState={error:String(error.message||error),checkedAt:new Date().toISOString()};if(announce)showUpdateStatus(releaseState);return null}
  }

  async function checkServiceWorker({announce=false}={}){
    let status={state:'unsupported'};
    if('serviceWorker' in navigator){
      try{const registration=await navigator.serviceWorker.getRegistration('./');await registration?.update();status={state:registration?.waiting?'ready':registration?.installing?'installing':'current',registration};if(registration?.waiting)registration.waiting.postMessage({type:'SKIP_WAITING'})}catch(error){status={state:'error',error:String(error.message||error)}}
    }
    if(announce)showUpdateStatus(status);
    return status;
  }

  async function runUnifiedUpdateCheck(){
    setUpdatePlaqueState('checking');
    const [host,worker]=await Promise.all([checkRelease(current()),checkServiceWorker()]);
    const state=worker.state==='ready'||worker.state==='installing'?'ready':host?.available===true||host?.updateAvailable===true?'ready':worker.state==='error'?'error':'current';
    setUpdatePlaqueState(state);showUpdateStatus({state,host,worker});
  }

  function setUpdatePlaqueState(state){const plaque=document.querySelector('.cw-version-plaque');if(!plaque)return;plaque.dataset.updateState=state;plaque.setAttribute('aria-label',state==='checking'?'Checking Commonweave updates':state==='ready'?'Commonweave update ready':'Check Commonweave for updates')}
  function showUpdateStatus(value){
    let toast=document.querySelector('.cw-unified-update-toast');if(!toast){toast=document.createElement('div');toast.className='cw-unified-update-toast';toast.setAttribute('role','status');document.body.append(toast)}
    const state=value?.state||value?.worker?.state||'current';toast.textContent=state==='checking'?'Checking the Commonweave loom…':state==='ready'?'A Commonweave update is ready. Reload once to apply it.':state==='error'||value?.error?'Update check could not reach the host. Your offline copy is still available.':'Commonweave is current. Your local campus copy remains ready offline.';
    toast.hidden=false;clearTimeout(showUpdateStatus.timer);showUpdateStatus.timer=setTimeout(()=>toast.hidden=true,4200);
  }

  function openModelSettings(){
    const dialog=document.querySelector('#model-config');
    if(dialog?.showModal&&!dialog.open){dialog.showModal();const status=dialog.querySelector('#config-status');if(status)status.textContent='Choose the campus model route, then save. This one preference serves every realm.';return true}
    document.querySelector('#configure,#model-settings,[data-action="model-settings"]')?.click();return Boolean(dialog)
  }
  function modelConfirmed(){return localStorage.getItem(MODEL_CONFIRMED)==='1'}
  function markModelConfirmed(){localStorage.setItem(MODEL_CONFIRMED,'1');document.querySelector('.cw-first-run-coach')?.remove()}
  function openCompass(){const launcher=document.querySelector('.cw-merlin-launcher');if(launcher){launcher.click();return true}return false}
  function openWeavelingChat(){
    if(!modelConfirmed()){openModelSettings();showFirstRunCoach();return}
    const home=document.querySelector('.cw-home-scene');if(home)home.dataset.weavelingState='visible';
    const hologram=home?.querySelector('.cw-home-weaveling');if(hologram?.dataset.src&&!hologram.src)hologram.src=hologram.dataset.src;
    if(!openCompass())setTimeout(openCompass,120);
  }

  function showFirstRunCoach(){
    if(document.querySelector('.cw-first-run-coach'))return;
    const coach=document.createElement('aside');coach.className='cw-first-run-coach';coach.innerHTML='<strong>First, choose the mind behind the Compass.</strong><span>Pick a local, browser, Gemini, or manual model route, then press “Save both contexts.” The Quad will open Weaveling after that.</span>';
    document.body.append(coach);
  }

  function addHomeControls(){
    const scene=document.querySelector('.cw-home-scene');if(!scene||scene.dataset.cwHomeUplift)return false;scene.dataset.cwHomeUplift='1';
    const cluster=document.createElement('div');cluster.className='cw-home-control-cluster';cluster.innerHTML=`<button type="button" data-cw-home-info aria-label="Campus information"><span>i</span></button><button type="button" data-cw-home-settings aria-label="Commonweave settings"><img src="ui-icons/settings.svg" alt=""></button><button type="button" data-cw-home-compass aria-label="Open Weaveling's Compass"><img src="assets/ai/weaveling-compass.png" alt=""></button>`;scene.append(cluster);
    cluster.querySelector('[data-cw-home-settings]').onclick=openModelSettings;
    cluster.querySelector('[data-cw-home-compass]').onclick=openCompass;
    cluster.querySelector('[data-cw-home-info]').onclick=()=>{const info=document.querySelector('.cw-square-hud');if(info)info.classList.toggle('cw-info-revealed');else showUpdateStatus({state:'current'})};
    const quad=scene.querySelector('[data-action="summon-weaveling"],.cw-quad');if(quad){quad.onclick=event=>{event.preventDefault();event.stopImmediatePropagation();openWeavelingChat()}}
    const hit=scene.querySelector('[data-action="weaveling-chat"],.cw-weaveling-hit');if(hit){hit.onclick=event=>{event.preventDefault();event.stopImmediatePropagation();openWeavelingChat()}}
    const plaque=document.querySelector('.cw-version-plaque');if(plaque){plaque.tabIndex=0;plaque.setAttribute('role','button');plaque.onclick=runUnifiedUpdateCheck;plaque.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();runUnifiedUpdateCheck()}}}
    if(!modelConfirmed())showFirstRunCoach();
    return true;
  }

  function installCampusUplift(){
    const style=document.createElement('style');style.dataset.cwCampusUplift='1';style.textContent=`
      .cw-release-banner{display:none!important}.cw-version-plaque{cursor:pointer;touch-action:manipulation}.cw-version-plaque[data-update-state="checking"]{filter:saturate(.5);animation:cwPulse 1s infinite}.cw-version-plaque[data-update-state="ready"]{box-shadow:0 0 0 2px #7ee5ff,0 0 24px #7ee5ff}
      .cw-home-control-cluster{position:absolute;z-index:18;top:max(10px,env(safe-area-inset-top));right:10px;display:flex;align-items:flex-start;gap:7px}.cw-home-control-cluster button{width:48px;height:48px;display:grid;place-items:center;padding:4px;border:1px solid rgba(241,216,119,.58);border-radius:50%;background:rgba(3,15,25,.78);box-shadow:0 8px 22px #0008;backdrop-filter:blur(7px)}.cw-home-control-cluster img{width:100%;height:100%;object-fit:contain}.cw-home-control-cluster [data-cw-home-info] span{display:grid;place-items:center;width:30px;height:30px;border:2px solid #f4df95;border-radius:50%;color:#fff7d0;font:900 20px Georgia,serif}.cw-home-control-cluster [data-cw-home-compass]{width:62px;height:62px;margin-top:-5px}
      .cw-square-hud{opacity:0;pointer-events:none;transition:opacity .18s}.cw-square-hud.cw-info-revealed{opacity:1;pointer-events:auto}.cw-home-weaveling{object-position:center bottom!important;transform:scale(.86);transform-origin:50% 91%;clip-path:polygon(0 0,100% 0,100% 61%,88% 63%,82% 72%,77% 89%,0 100%)}
      .cw-first-run-coach{position:fixed;z-index:5000;top:82px;right:12px;width:min(330px,calc(100vw - 24px));padding:13px 15px;border:1px solid #7ee5ff88;border-radius:15px;background:#071923ee;color:#effffb;box-shadow:0 18px 50px #000b}.cw-first-run-coach strong,.cw-first-run-coach span{display:block}.cw-first-run-coach span{margin-top:5px;color:#cce5e2;font-size:12px;line-height:1.4}
      .cw-unified-update-toast{position:fixed;z-index:6000;left:50%;bottom:max(72px,calc(env(safe-area-inset-bottom) + 64px));transform:translateX(-50%);width:min(92vw,520px);padding:12px 15px;border:1px solid #7ee5ff77;border-radius:13px;background:#06151eee;color:#effffb;text-align:center;box-shadow:0 14px 42px #000a}.cw-unified-update-toast[hidden]{display:none}
      @keyframes cwPulse{50%{opacity:.55}}@media(max-width:560px){.cw-home-control-cluster{gap:4px}.cw-home-control-cluster button{width:42px;height:42px}.cw-home-control-cluster [data-cw-home-compass]{width:54px;height:54px}}
    `;document.head.append(style);
    document.querySelector('#config-save')?.addEventListener('click',markModelConfirmed);
    const observer=new MutationObserver(()=>addHomeControls());observer.observe(document.documentElement,{subtree:true,childList:true});addHomeControls();
    setTimeout(()=>checkRelease(),5000);setInterval(()=>checkRelease(),30*60*1000);
  }

  async function heartbeat(){const config=current();if(!config?.features?.includes('heartbeat'))return;const headers={'content-type':'application/json'};if(config.token)headers.authorization=`Bearer ${config.token}`;try{await fetch(`${config.apiBase}/nodes/heartbeat`,{method:'POST',headers,body:JSON.stringify({nodeId:config.nodeId})})}catch{}}
  setTimeout(heartbeat,2500);setInterval(heartbeat,60000);
  window.CommonweaveHostNode={connect,current,nodeId,checkRelease,runUnifiedUpdateCheck,defaultHost:DEFAULT_HOST,disconnect(){localStorage.removeItem(KEY)}};
  installCampusUplift();

  if(!setup)return;
  const overlay=document.createElement('section');overlay.className='cw-node-wizard';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.innerHTML=`<div class="cw-node-card"><button data-close aria-label="Close setup">×</button><h1>Connect Commonweave</h1><p>The campus stays local-first. A host node supplies optional sync and Commonweave-wide updates.</p><label>Host node URL<input id="cw-host-url" value="${normalizeHost(suppliedHost||current()?.baseUrl||DEFAULT_HOST)}"></label><label>Optional token<input id="cw-host-token" type="password"></label><div><button id="cw-connect">Connect node</button><button id="cw-install">Install Commonweave</button><button id="cw-enter">Enter campus</button></div><p id="cw-node-status" role="status"></p></div>`;document.body.append(overlay);
  const setupStyle=document.createElement('style');setupStyle.textContent='.cw-node-wizard{position:fixed;z-index:7000;inset:0;display:grid;place-items:center;padding:18px;background:#061019dd url("assets/world/town-square-home.webp") center/cover}.cw-node-card{width:min(620px,100%);display:grid;gap:12px;padding:24px;border:1px solid #7ee5ff77;border-radius:20px;background:#06151eee;color:white}.cw-node-card input{width:100%;min-height:44px;margin-top:5px}.cw-node-card button{min-height:44px;padding:0 14px}.cw-node-card [data-close]{justify-self:end;width:40px}';document.head.append(setupStyle);
  const status=overlay.querySelector('#cw-node-status');
  overlay.querySelector('#cw-connect').onclick=async()=>{status.textContent='Connecting…';try{const config=await connect(overlay.querySelector('#cw-host-url').value,overlay.querySelector('#cw-host-token').value);status.textContent=`Connected to ${config.hubName||'host node'}.`}catch(error){status.textContent=`Connection failed: ${error.message}`}};
  overlay.querySelector('#cw-install').onclick=async()=>{if(deferredInstall){await deferredInstall.prompt();deferredInstall=null}else status.textContent='Use the browser menu and choose Install app or Add to Home Screen.'};
  const enter=()=>{overlay.remove();const next=new URL(location.href);next.searchParams.delete('setup');next.searchParams.delete('host');history.replaceState(history.state,'',next)};
  overlay.querySelector('#cw-enter').onclick=enter;overlay.querySelector('[data-close]').onclick=enter;
})();
