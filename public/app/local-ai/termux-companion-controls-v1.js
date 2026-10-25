// Termux Companion UI. Merely mounting this panel causes no localhost calls.
const ENDPOINT='http://127.0.0.1:8766';
const SECRET_STORAGE='civweave.termux-companion.session-pairing.v1';
const ALLOWED_MODELS=['qwen35-4b-native','qwen35-2b-native'];
const COMMANDS=[
  'pkg install -y python curl',
  'mkdir -p "$HOME/.civweave-companion"',
  'curl -fL https://civweave-staging.pages.dev/termux/civweave_companion.py -o "$HOME/.civweave-companion/companion.py"',
  'python "$HOME/.civweave-companion/companion.py"'
].join('\n');

export async function callCompanion(path,{token,body,fetcher=fetch}={}){
  if(!/^\/v1\/(?:status|actions\/(?:setup|start|stop|restart|download|verify))$/.test(path))
    throw new Error('Unsupported Companion operation.');
  const key=String(token||'').trim();
  if(!/^[0-9a-f]{64}$/i.test(key))throw new Error('Enter the 64-character Termux pairing token.');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{
    const response=await fetcher(ENDPOINT+path,{
      method:body?'POST':'GET',mode:'cors',credentials:'omit',cache:'no-store',
      headers:{'X-Civweave-Token':key,...(body?{'Content-Type':'application/json'}:{})},
      ...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal
    });
    const payload=await response.json();
    if(!response.ok)throw new Error(String(payload?.error||('HTTP '+response.status)).slice(0,320));
    return payload;
  }catch(error){
    if(controller.signal.aborted)throw new Error('Companion connection timed out. Check Termux and browser loopback permission.');
    throw error;
  }finally{clearTimeout(timer)}
}

export function mountTermuxCompanionControls(element,{store=sessionStorage}={}){
  if(!element||element.dataset.cwCompanionMounted==='1')return;
  element.dataset.cwCompanionMounted='1';
  element.innerHTML=[
    '<div class="cw-clean-note">',
    '<p><b>Termux Companion · same-phone AI server management</b></p>',
    '<p>Install Termux once, then run the command below. The Companion only accepts approved local operations; it cannot execute arbitrary shell commands sent by the browser.</p>',
    '<p><a href="/termux/civweave_companion.py" target="_blank" rel="noopener">Review the Companion source</a></p>',
    '<pre data-cw-command style="white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;padding:10px;background:#0004;border-radius:8px"></pre>',
    '<button type="button" data-cw-copy>Copy one-time Termux setup</button>',
    '<p>Termux prints a private pairing token. Civweave stores it only in this browser session.</p>',
    '<label>Pairing token <input type="password" data-cw-token autocomplete="off" spellcheck="false" placeholder="Token from Termux"></label>',
    '<button type="button" data-cw-pair>Pair / refresh status</button>',
    '<p>Model <select data-cw-model><option value="qwen35-4b-native">Qwen3.5-4B Q4_K_M</option><option value="qwen35-2b-native">Qwen3.5-2B Q4_K_M</option></select></p>',
    '<p>Context <select data-cw-context><option value="4096">4K · recovery</option><option value="8192">8K</option><option value="16384">16K</option><option value="32768" selected>32K · recommended</option><option value="65536">64K · experimental</option><option value="2048">2K · legacy</option><option value="1024">1K · legacy</option></select></p>',
    '<p>32K reserves space for research passages and generated lessons; it uses more memory and may load or generate more slowly. Try 16K if Android kills the server. 64K is optional and should be tested carefully.</p>',
    '<div class="cw-clean-grid">',
    '<button type="button" data-cw-action="setup" disabled>Install/update llama.cpp</button>',
    '<button type="button" data-cw-action="verify" disabled>Verify selected model</button>',
    '<button type="button" data-cw-action="download" disabled>Download selected model</button>',
    '<button type="button" data-cw-action="start" disabled>Start AI server</button>',
    '<button type="button" data-cw-action="restart" disabled>Restart AI server</button>',
    '<button type="button" data-cw-action="stop" disabled>Stop AI server</button>',
    '</div>',
    '<output role="status" aria-live="polite" data-cw-result>Not paired. No operations started.</output>',
    '<progress data-cw-progress max="100" hidden></progress>',
    '<p>Existing model discovery checks ~/models, Android Downloads, and ~/llama.cpp/models. The original GGUF is reused without copying or redownloading. If you updated the Companion code, restart its Python process in Termux before refreshing status.</p>',
    '<p>To adopt an already-running manual server, stop that Termux session with Ctrl+C once; only Companion-started processes can be stopped or restarted here.</p>',
    '<p>For reboot recovery, install Termux:Boot separately and create its startup script. Android may still suspend background processes.</p>',
    '</div>'
  ].join('');
  const find=s=>element.querySelector(s);
  const secretInput=find('[data-cw-token]'),result=find('[data-cw-result]'),
    progress=find('[data-cw-progress]'),model=find('[data-cw-model]'),
    context=find('[data-cw-context]');
  const buttons=[...element.querySelectorAll('[data-cw-action]')];
  let token=store?.getItem(SECRET_STORAGE)||'',busy=false,poll=null,jobRunning=false;
  secretInput.value=token;
  find('[data-cw-command]').textContent=COMMANDS;
  const say=message=>{result.textContent=String(message||'').slice(0,600)};
  const controls=enabled=>buttons.forEach(button=>button.disabled=!enabled);
  function showState(snapshot){
    const job=snapshot.job||{},state=job.state||'idle';
    jobRunning=state==='running';
    progress.hidden=state!=='running';
    if(state==='running'&&typeof job.progress==='number')progress.value=job.progress;
    else progress.removeAttribute('value');
    const server=snapshot.managed_running?'Companion server running':snapshot.unmanaged_running?'Manual server occupies port 8080':snapshot.server_reachable?'AI server loading':'AI server stopped';
    const models=Object.entries(snapshot.models||{}).map(([name,info])=>
      name+': '+(info.present?((info.verified?'verified':'present, unverified')+(info.location?' · '+info.location:'')):'not found in supported folders')).join(' · ');
    say(server+(snapshot.managed_running?' · context '+Number(snapshot.context||0).toLocaleString()+' tokens':'')+' · llama.cpp '+(snapshot.llama_installed?'installed':'not installed')+
      ' · '+models+(job.action?' · '+job.action+': '+state+' — '+(job.message||''):''));
    controls(state!=='running'&&!busy);
    if(state==='running')watch();else stopWatching();
  }
  async function refresh(){
    if(!token)return;
    const snapshot=await callCompanion('/v1/status',{token});
    showState(snapshot);
  }
  function stopWatching(){if(poll){clearInterval(poll);poll=null}}
  function watch(){if(!poll)poll=setInterval(()=>{
    if(!busy&&token)void refresh().catch(error=>{stopWatching();say(error.message)});
  },2500)}
  find('[data-cw-copy]').addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText(COMMANDS);say('Setup copied. Run it inside Termux.')}
    catch{say('Select and copy the displayed commands manually.')}
  });
  find('[data-cw-pair]').addEventListener('click',async()=>{
    if(busy)return;
    busy=true;controls(false);say('Checking Termux Companion…');
    try{
      const entered=secretInput.value.trim();
      const snapshot=await callCompanion('/v1/status',{token:entered});
      token=entered;store?.setItem(SECRET_STORAGE,token);
      showState(snapshot);
    }catch(error){token='';store?.removeItem(SECRET_STORAGE);say('Pairing failed: '+error.message)}
    finally{busy=false;controls(Boolean(token)&&!jobRunning)}
  });
  buttons.forEach(button=>button.addEventListener('click',async()=>{
    if(busy||!token)return;
    const action=button.dataset.cwAction,selected=model.value;
    if(!ALLOWED_MODELS.includes(selected))return;
    if(action==='download'&&!confirm('Download the selected GGUF to Termux? This can use several GB of storage and network data.'))return;
    if(['stop','restart'].includes(action)&&!confirm('Interrupt current AI generations to '+action+' the server?'))return;
    busy=true;controls(false);
    try{
      await callCompanion('/v1/actions/'+action,{token,
        body:{model:selected,context:Number(context.value)}});
      say(action+' accepted; checking progress.');
      await refresh();
      watch();
    }catch(error){say(action+' failed: '+error.message)}
    finally{busy=false}
  }));
  // No unsolicited network request, install, model download or AI startup.
}
