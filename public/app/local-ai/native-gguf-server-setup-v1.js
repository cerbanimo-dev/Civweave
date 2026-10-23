// Explicit Android-native server install guide. No model loads, native execution,
// downloads or localhost requests occur merely by opening Civweave Settings.
export const SERVER_URL='http://127.0.0.1:8080/v1';
export const SERVER_MODEL='qwen35-4b-native';
export const COMMANDS=Object.freeze([
  'pkg update -y && pkg install -y llama-cpp',
  'termux-setup-storage\nls -lh "$HOME/storage/downloads/Qwen3.5-4B-Q4_K_M.gguf"',
  'llama-server \\\n  -m "$HOME/storage/downloads/Qwen3.5-4B-Q4_K_M.gguf" \\\n  --alias qwen35-4b-native \\\n  --host 127.0.0.1 --port 8080 \\\n  --ctx-size 2048 --threads 4 --parallel 1 \\\n  --jinja \\\n  --reasoning off'
]);
const setupHtml=[
 '<div class="cw-clean-note"><b>Android Termux · native llama.cpp</b>',
 '<p>This option uses the ORIGINAL Qwen 3.5 4B Q4_K_M model in Android Downloads, without requantization or another 2.7 GB model download. Termux runs the server; Civweave cannot install or start native Android processes.</p>',
 '<p><b>1 · Install Termux</b> — use one official source, and do not mix incompatible F-Droid/GitHub Termux or plugin APK signatures.</p>',
 '<p><a href="https://f-droid.org/packages/com.termux/" target="_blank" rel="noopener noreferrer">Download Termux from F-Droid</a> · <a href="https://github.com/termux/termux-app/releases" target="_blank" rel="noopener noreferrer">Termux official GitHub releases</a></p>',
 '<p><b>2 · Install llama.cpp</b> in Termux, using the Termux package repository:</p><div data-server-command="0"></div>',
 '<p><b>3 · Allow Downloads access</b> and verify your exact GGUF is present. Approve the Android storage permission:</p><div data-server-command="1"></div>',
 '<p><b>4 · Run the local server</b> in Termux. It listens only on this phone and limits memory with 2,048 context tokens / one parallel slot. Older Termux llama.cpp builds do not support the --cors-origins argument; verify browser connectivity with the tests below:</p><div data-server-command="2"></div>',
 '<p>If your file has another name, edit the quoted <code>-m</code> path. Keep Termux running, and set reasonable battery permissions for longer sessions. Ctrl+C in Termux stops the server.</p>',
 '<p><b>5 · Verify and select</b> — test the model-list endpoint, then produce a few actual tokens before selecting this route for all five Civweave systems. No localhost requests happen automatically when Settings opens.</p>',
 '<div class="cw-clean-grid"><button type="button" data-server-check>Check localhost server</button><button type="button" data-server-test disabled>Generate 24-token test</button><button type="button" data-server-activate disabled>Use tested server for five systems</button></div>',
 '<output data-server-status role="status" aria-live="polite">Not checked. The current model selection is unchanged.</output>',
 '<p><b>If setup fails:</b> Update Termux packages. For a missing <code>llama-server</code> binary see the <a href="https://github.com/ggml-org/llama.cpp/blob/master/docs/android.md" target="_blank" rel="noopener noreferrer">official Android build instructions</a>. A PWA can be blocked by Android/browser localhost permissions or CORS even when Termux works. If localhost calls are blocked, inspect your installed llama-server version and test its browser response before updating or introducing a local-only proxy. The test reports failures without changing your route.</p>',
 '<p>For desktop and mini-PC installs, consult the <a href="https://github.com/ggml-org/llama.cpp/tree/master/tools/server" target="_blank" rel="noopener noreferrer">official llama-server documentation</a>; configure LAN or remote endpoints separately under AI route with appropriate authentication.</p></div>'
].join('');
export function validateServerAddress(value){
  const url=new URL(String(value||''));
  if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.port!=='8080'||url.pathname!=='/v1')
    throw new Error('This Android setup only tests the phone-local http://127.0.0.1:8080/v1 endpoint.');
  return url.href.replace(/\/$/,'');
}
async function request(path,{body,fetcher=fetch}={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),body?90000:15000);
  try{
    const response=await fetcher(validateServerAddress(SERVER_URL)+path,{
      method:body?'POST':'GET',
      headers:{Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},
      ...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal,cache:'no-store',credentials:'omit'
    });
    const raw=await response.text();
    if(!response.ok)throw new Error('Native server returned HTTP '+response.status+': '+raw.slice(0,130));
    try{return JSON.parse(raw)}catch{throw new Error('The endpoint did not return JSON; check Termux llama-server.')}
  }catch(error){
    if(controller.signal.aborted)throw new Error('Native server test timed out. Confirm Termux is still running and this browser can reach localhost.');
    throw error;
  }finally{clearTimeout(timer)}
}
export async function checkServer({fetcher=fetch}={}){
  const result=await request('/models',{fetcher}),models=Array.isArray(result?.data)?result.data:[];
  if(!models.length)throw new Error('The server returned no loaded models.');
  const ids=models.map(item=>String(item?.id||'').slice(0,120));
  if(!ids.includes(SERVER_MODEL))
    throw new Error('Unexpected loaded model. Add --alias '+SERVER_MODEL+' to the Termux command. Server reports: '+ids.slice(0,3).join(', '));
  return{models:ids};
}
export async function generateServerTest({fetcher=fetch}={}){
  const result=await request('/chat/completions',{fetcher,body:{
    model:SERVER_MODEL,stream:false,max_tokens:24,temperature:0,
    messages:[{role:'user',content:'Reply with exactly READY.'}]
  }});
  const content=result?.choices?.[0]?.message?.content;
  if(typeof content!=='string'||!content.trim())
    throw new Error('The server returned no visible generated text.');
  return{answer:content.trim().slice(0,160),model:SERVER_MODEL};
}
export function mountNativeServerSetup(target,{activate,copyText}={}){
  if(!target||target.dataset.nativeServerMounted==='1')return;
  target.dataset.nativeServerMounted='1';
  target.innerHTML=setupHtml;
  COMMANDS.forEach((cmd,i)=>{
    const slot=target.querySelector('[data-server-command="'+i+'"]');if(!slot)return;
    const pre=document.createElement('pre');pre.textContent=cmd;
    pre.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;line-height:1.5;margin:8px 0;padding:10px;background:#0005;border-radius:8px';
    const copy=document.createElement('button');copy.type='button';copy.textContent='Copy command';
    copy.addEventListener('click',async()=>{
      try{await(copyText?copyText(cmd):navigator.clipboard.writeText(cmd));copy.textContent='Copied'}
      catch{copy.textContent='Select command above to copy'}
    });
    slot.append(pre,copy);
  });
  const status=target.querySelector('[data-server-status]');
  const check=target.querySelector('[data-server-check]');
  const test=target.querySelector('[data-server-test]');
  const select=target.querySelector('[data-server-activate]');
  let stage='idle',busy=false;
  async function action(name){
    if(busy)return;busy=true;check.disabled=test.disabled=select.disabled=true;
    try{
      if(name==='check'){
        status.textContent='Checking llama-server on 127.0.0.1:8080…';
        const result=await checkServer();
        stage='checked';status.textContent='Found '+result.models.join(', ')+'. Next, generate a short test.';
      }else if(name==='test'){
        status.textContent='Requesting a short native GGUF completion…';
        const result=await generateServerTest();
        stage='tested';status.textContent='Native inference test passed: '+result.answer+'. You can now select this local server.';
      }else if(name==='activate'){
        if(stage!=='tested')throw new Error('Run the local token test before selecting the server.');
        if(typeof activate!=='function')throw new Error('The Civweave settings activation handler was not attached.');
        await activate({model:SERVER_MODEL,endpoint:SERVER_URL});
        stage='active';status.textContent='Native server selected for all five systems. The saved browser GGUF model is untouched. Keep Termux running.';
      }
    }catch(error){
      stage='idle';
      status.textContent='Not connected: '+String(error?.message||error).slice(0,430)+'. Check Termux, model file, CORS and browser localhost permissions. The current route was not changed.';
    }finally{
      busy=false;check.disabled=false;
      test.disabled=!['checked','tested','active'].includes(stage);
      select.disabled=!['tested','active'].includes(stage);
    }
  }
  check.addEventListener('click',()=>void action('check'));
  test.addEventListener('click',()=>void action('test'));
  select.addEventListener('click',()=>void action('activate'));
}
