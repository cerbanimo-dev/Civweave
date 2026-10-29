// Explicit iPhone/iPad ai.local pairing. No localhost probe, model load,
// download, provider switch or network request occurs when Settings opens.
(()=>{
'use strict';
const VERSION='1.0.0-ios-ai-local-openai-sse';
if(globalThis.CivweaveIOSAiLocalSetupV1?.version===VERSION)return;
const DEFAULT_BASE='http://127.0.0.1:11434';
const APP_URL='https://apps.apple.com/us/app/ai-local/id6741479958';
const DOCS_URL='https://ai-local.brunowernimont.me/docs/';
function normalizeBase(input=DEFAULT_BASE){
  const value=String(input||DEFAULT_BASE).trim();
  let url;
  try{url=new URL(value)}catch{throw new Error('Enter an ai.local address such as '+DEFAULT_BASE)}
  if(url.protocol!=='http:'||url.username||url.password||url.search||url.hash||url.port!=='11434')
    throw new Error('This setup accepts only an HTTP ai.local server on port 11434, without credentials or URL parameters.');
  if(!['/','/v1','/v1/','/v1/chat/completions'].includes(url.pathname))
    throw new Error('Use the ai.local base URL or /v1, not a different API path.');
  const host=url.hostname.toLowerCase();
  const octets=host.split('.').map(Number);
  const privateIpv4=octets.length===4&&octets.every((n,i)=>/^\d{1,3}$/.test(host.split('.')[i])&&n>=0&&n<=255)&&(
    octets[0]===10||(octets[0]===172&&octets[1]>=16&&octets[1]<=31)||
    (octets[0]===192&&octets[1]===168));
  if(!['127.0.0.1','localhost','[::1]'].includes(host)&&!privateIpv4&&!/^[a-z0-9][a-z0-9.-]*\.local$/.test(host))
    throw new Error('For privacy, only this iPhone (127.0.0.1), a private-network IP, or a local Bonjour hostname is accepted.');
  return url.origin;
}
function clean(value,max=260){return String(value??'').slice(0,max)}
function endpoint(base){return normalizeBase(base)+'/v1'}
function networkError(error,base,task){
  const reason=clean(error?.message||error);
  if(error?.name==='AbortError')return new Error(task+' timed out. Keep ai.local open, its server running, and the phone unlocked.');
  return new Error(task+' could not reach '+normalizeBase(base)+': '+reason+'. Check ai.local server status, Safari/WebView CORS permissions, HTTPS-to-local-HTTP restrictions, and iOS local-network permissions. This attempt stayed local and did not change the selected provider.');
}
async function request(url,init={},timeoutMs=15000,fetcher=fetch){
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),timeoutMs);
  try{return await fetcher(url,{...init,signal:ctrl.signal,credentials:'omit',cache:'no-store',mode:'cors'})}
  finally{clearTimeout(timer)}
}
async function discover(base=DEFAULT_BASE,{fetcher=fetch}={}){
  const root=normalizeBase(base);
  let response;
  try{response=await request(root+'/v1/models',{method:'GET',headers:{accept:'application/json'}},15000,fetcher)}
  catch(e){throw networkError(e,root,'Model discovery')}
  if(!response.ok)throw new Error('ai.local /v1/models returned HTTP '+response.status+'. Start its server before retrying.');
  let data;
  try{data=await response.json()}catch{throw new Error('ai.local model discovery returned unreadable JSON.')}
  const models=Array.isArray(data?.data)?data.data.filter(x=>typeof x?.id==='string'&&x.id.trim()).map(x=>({
    id:clean(x.id,200),ownedBy:clean(x.owned_by,120)
  })):[];
  if(!models.length)throw new Error('ai.local is reachable, but reports no installed models. Install one in ai.local first.');
  return{endpoint:root+'/v1',models};
}
async function streamTest(base,model,{fetcher=fetch,onToken}={}){
  const root=normalizeBase(base),id=String(model||'').trim();
  if(!id||id.length>200)throw new Error('Select one model listed by ai.local before testing.');
  let response;
  try{response=await request(root+'/v1/chat/completions',{
    method:'POST',headers:{'content-type':'application/json',accept:'text/event-stream'},
    body:JSON.stringify({model:id,messages:[{role:'user',content:'Reply with exactly READY.'}],temperature:0,stream:true,max_tokens:32})
  },90000,fetcher)}
  catch(e){throw networkError(e,root,'Streaming test')}
  if(!response.ok){
    const details=clean(await response.text().catch(()=>''),300);
    throw new Error('ai.local streaming test returned HTTP '+response.status+': '+details);
  }
  if(!response.body?.getReader)throw new Error('The browser did not expose a readable token stream. No provider settings were changed.');
  const contentType=response.headers?.get?.('content-type')||'';
  if(!/text\/event-stream/i.test(contentType))throw new Error('ai.local did not return text/event-stream; use its /v1/chat/completions endpoint, not /api/chat.');
  const reader=response.body.getReader(),decoder=new TextDecoder();
  let buffer='',answer='',deltas=0,sawDone=false,bytes=0;
  function processFrame(frame){
    const event=frame.split(/\r?\n/).find(line=>line.startsWith('event:'))?.slice(6).trim()||'';
    for(const line of frame.split(/\r?\n/)){
      if(!line.startsWith('data:'))continue;
      const raw=line.slice(5).trim();
      if(raw==='[DONE]'){sawDone=true;continue;}
      let item;try{item=JSON.parse(raw)}catch{throw new Error('ai.local produced malformed SSE JSON.')}
      if(event==='error'||item.error)throw new Error('ai.local returned an SSE error: '+clean(item.error?.message||item.error||raw));
      const piece=item?.choices?.[0]?.delta?.content;
      if(typeof piece==='string'&&piece){answer+=piece;deltas++;onToken?.(piece,answer)}
    }
  }
  try{
    while(true){
      const {value,done}=await reader.read();
      if(done)break;
      bytes+=value.byteLength;if(bytes>512000)throw new Error('ai.local test stream exceeded 512 KB.');
      buffer+=decoder.decode(value,{stream:true});
      // SSE messages are separated by a blank line; chunks may split a JSON event.
      const frames=buffer.split(/\r?\n\r?\n/);buffer=frames.pop()||'';
      for(const frame of frames)processFrame(frame);
    }
    buffer+=decoder.decode();if(buffer.trim())processFrame(buffer);
  }finally{try{reader.releaseLock()}catch{}}
  if(!sawDone||!deltas||!answer.trim())throw new Error('The server did not complete a real streamed answer with [DONE] and visible text. Nothing was activated.');
  return{model:id,endpoint:root+'/v1',deltas,answer:clean(answer.trim(),180),streamed:true};
}
function mount(target,{activate}={}){
  if(!target||target.dataset.iosAiLocalMounted==='1')return;
  target.dataset.iosAiLocalMounted='1';
  target.innerHTML='<p>Use <b>ai.local</b> as an on-device iPhone inference server, without an APK, IPA, or a Civweave native bridge. Run Civweave inside ai.local’s built-in web browser when possible to keep the server in the foreground.</p>'+
    '<p><a href="'+APP_URL+'" target="_blank" rel="noopener noreferrer">Get ai.local on the App Store</a> · <a href="'+DOCS_URL+'" target="_blank" rel="noopener noreferrer">Provider API documentation</a></p>'+
    '<p>In ai.local install a model (Qwen 3.5 4B, if available), then start the local server. The default port is 11434. Use the on-device loopback address first; if it is not reachable, try the exact LAN IP/Bonjour address displayed by ai.local.</p>'+
    '<label>ai.local HTTP base address <input data-ai-local-base type="url" inputmode="url" spellcheck="false" value="'+DEFAULT_BASE+'"></label>'+
    '<div class="cw-clean-grid"><button type="button" data-ai-local-discover>Discover installed models</button></div>'+
    '<label>Installed model <select data-ai-local-model disabled><option value="">Run discovery first</option></select></label>'+
    '<div class="cw-clean-grid"><button type="button" data-ai-local-test disabled>Test real token streaming</button><button type="button" data-ai-local-activate disabled>Use tested ai.local server</button></div>'+
    '<output data-ai-local-status role="status" aria-live="polite">No requests sent. Current AI route is unchanged.</output>'+
    '<p>Use the OpenAI-compatible <code>/v1/chat/completions</code> route. ai.local’s Ollama <code>/api/chat</code> ignores streaming, so it cannot satisfy Civweave’s visible-token requirement. This test does not silently switch to another model.</p>'+
    '<p>iOS may suspend ai.local when another app is foregrounded. Built-in browser compatibility, CORS, and background service behavior must be verified on the actual iPhone. The server is unauthenticated: do not expose it to an untrusted Wi-Fi network.</p>';
  const baseInput=target.querySelector('[data-ai-local-base]'),select=target.querySelector('[data-ai-local-model]'),status=target.querySelector('[data-ai-local-status]'),discoverButton=target.querySelector('[data-ai-local-discover]'),testButton=target.querySelector('[data-ai-local-test]'),activateButton=target.querySelector('[data-ai-local-activate]');
  let discoveredEndpoint='',tested=null,busy=false;
  function invalidate(){tested=null;activateButton.disabled=true;testButton.disabled=true;select.disabled=true;discoveredEndpoint='';}
  baseInput.addEventListener('input',()=>{invalidate();status.textContent='Address changed. Run discovery again.'});
  select.addEventListener('change',()=>{tested=null;activateButton.disabled=true;testButton.disabled=!select.value;status.textContent='Model changed. Run the streaming test before activating.'});
  async function action(kind){
    if(busy)return;busy=true;discoverButton.disabled=testButton.disabled=activateButton.disabled=true;
    try{
      if(kind==='discover'){
        invalidate();status.textContent='Contacting ai.local /v1/models locally…';
        const found=await discover(baseInput.value);
        discoveredEndpoint=found.endpoint;select.replaceChildren();
        for(const item of found.models){const opt=document.createElement('option');opt.value=item.id;opt.textContent=item.id+(item.ownedBy==='apple'?' · Apple Foundation Models (plain text only)':'');select.append(opt)}
        select.disabled=false;status.textContent='Found '+found.models.length+' model(s). Test streaming before selecting.';
      }else if(kind==='test'){
        const current=endpoint(baseInput.value);
        if(!discoveredEndpoint||current!==discoveredEndpoint)throw new Error('Address changed. Discover models again.');
        status.textContent='Checking streamed model tokens…';
        const result=await streamTest(baseInput.value,select.value,{onToken:(_,answer)=>{status.textContent='Receiving live tokens: '+clean(answer,120)}});
        tested=result;status.textContent='Streaming passed: '+result.deltas+' token chunks; '+result.answer+'. Ready to select.';
      }else{
        if(!tested||tested.model!==select.value||tested.endpoint!==endpoint(baseInput.value))throw new Error('Please test the exact model and endpoint first.');
        if(typeof activate!=='function')throw new Error('Civweave settings activation was not attached.');
        await activate({model:tested.model,endpoint:tested.endpoint,localApiFlavor:'ai.local',stream:true});
        status.textContent='Selected '+tested.model+' for Civweave using ai.local /v1 streaming. Keep the server and its built-in browser active.';
      }
    }catch(e){tested=null;status.textContent=clean(e.message||e,1200)}
    finally{busy=false;discoverButton.disabled=false;testButton.disabled=!discoveredEndpoint||!select.value||select.disabled;activateButton.disabled=!tested;}
  }
  discoverButton.addEventListener('click',()=>void action('discover'));
  testButton.addEventListener('click',()=>void action('test'));
  activateButton.addEventListener('click',()=>void action('activate'));
}
globalThis.CivweaveIOSAiLocalSetupV1=Object.freeze({version:VERSION,normalizeBase,endpoint,discover,streamTest,mount});
})();
