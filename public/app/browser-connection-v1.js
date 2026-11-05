(()=>{
'use strict';
// Parent-shell browser capability. Reuses canonical guide chat and the existing
// browser-tool transport. Remote page content is evidence, never executable code.
if(globalThis.CivweaveBrowserConnectionV1)return;
const VERSION='1.0.0-shared-browser-receiver';
const RECEIVE_KEY='civweave.browser.receive.v1';
const ID='cw-browser-connection-v1';
const STYLE_ID='cw-browser-connection-v1-style';
const MAX_HISTORY=24;
let root=null,authorized=false,opened=false,history=[],position=-1,evidence='',currentTitle='',corePromise=null,toolPromise=null;
const clip=(value,n=12000)=>String(value??'').trim().slice(0,n);
const core=()=>corePromise||(corePromise=import('/app/shared/browser-connection-core-v1.mjs'));
function emit(event,detail={}){try{dispatchEvent(new CustomEvent(event,{detail:{version:VERSION,...detail}}))}catch{}}
async function ensureTool(){
  if(globalThis.CivweaveBrowserToolV1)return globalThis.CivweaveBrowserToolV1;
  if(toolPromise)return toolPromise;
  toolPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.async=false;script.src='/app/browser-tool-v1.js?v=1.0.0';
    script.onload=()=>globalThis.CivweaveBrowserToolV1?resolve(globalThis.CivweaveBrowserToolV1):reject(new Error('Browser tools did not initialize.'));
    script.onerror=()=>reject(new Error('The browser tools could not load.'));
    document.head.append(script);
  }).finally(()=>{toolPromise=null});
  return toolPromise;
}
function currentUrl(){return history[position]||''}
function status(message){const node=root?.querySelector('[data-browser-status]');if(node)node.textContent=clip(message,400)}
function installStyle(){
 if(document.getElementById(STYLE_ID))return;
 const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
#${ID}{position:fixed;z-index:2147483610;top:12px;bottom:calc(var(--cw-themed-nav-height,64px) + env(safe-area-inset-bottom) + 12px);left:12px;width:min(740px,calc(100vw - 36px));background:#0c1725;color:#eff6ff;border:1px solid #51718d;border-radius:16px;box-shadow:0 22px 68px #000b;display:flex;flex-direction:column;font:14px/1.45 system-ui,sans-serif;overflow:hidden;color-scheme:dark}
#${ID}[hidden]{display:none!important}#${ID} *{box-sizing:border-box}
#${ID} header{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px;border-bottom:1px solid #ffffff25}
#${ID} header strong{font-size:15px}#${ID} button,#${ID} a[data-external]{display:inline-flex;align-items:center;justify-content:center;min-height:38px;border:1px solid #55728d;border-radius:9px;padding:6px 10px;background:#183047;color:#f5faff;text-decoration:none;cursor:pointer;font:inherit}
#${ID} button:disabled{opacity:.45;cursor:default}
#${ID} button:focus-visible,#${ID} input:focus-visible,#${ID} a:focus-visible{outline:2px solid #9cdeff;outline-offset:2px}
#${ID} [data-controls]{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:9px 12px;border-bottom:1px solid #ffffff20}
#${ID} [data-nav-form]{display:flex;min-width:220px;flex:1;gap:6px}
#${ID} input[type=url],#${ID} input[type=search]{min-width:0;flex:1;width:100%;border:1px solid #617d97;border-radius:9px;padding:9px;background:#06111d;color:#fff;font:inherit}
#${ID} [data-consent]{display:flex;align-items:center;gap:7px;padding:7px 13px;background:#0d2432;border-bottom:1px solid #ffffff20;font-size:12px}
#${ID} [data-browser-status]{padding:6px 12px;color:#b7d0e4;font-size:12px;min-height:30px}
#${ID} [data-preview]{flex:1 1 46%;min-height:90px;width:100%;border:0;background:#f7f9fa}
#${ID} [data-lower]{display:flex;flex-direction:column;flex:1 1 35%;min-height:110px;border-top:1px solid #ffffff30}
#${ID} [data-actions]{display:flex;gap:6px;flex-wrap:wrap;padding:8px 12px}
#${ID} [data-evidence]{flex:1;white-space:pre-wrap;overflow:auto;padding:8px 12px;overflow-wrap:anywhere;line-height:1.5;background:#081320;color:#d3e5f5}
#${ID} [data-evidence] a{color:#9adeff}
@media(max-width:720px){#${ID}{inset:0;width:100%;height:100dvh;border:0;border-radius:0}#${ID} [data-preview]{flex-basis:32%}#${ID} [data-lower]{flex-basis:45%}#${ID} [data-nav-form]{min-width:160px}}
`;document.head.append(style);
}
function ensureRoot(){
 if(root?.isConnected)return root;
 installStyle();root=document.createElement('section');root.id=ID;root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-label','Civweave connected browser');
 root.innerHTML=`<header><strong>Connected browser · Civweave</strong><button data-close type="button" aria-label="Close connected browser">Close</button></header>
 <div data-controls><button data-back type="button" aria-label="Back">←</button><button data-forward type="button" aria-label="Forward">→</button><form data-nav-form><input data-url type="url" inputmode="url" autocomplete="url" placeholder="https://example.org/" aria-label="Website URL" required><button type="submit">Go</button></form><a data-external target="_blank" rel="noopener noreferrer" aria-label="Open page in device browser" hidden>Open in browser</a></div>
 <label data-consent><input data-network type="checkbox"> Allow live browser tool requests during this session (uses hosted Browser Run; only approved queries and URLs are sent)</label>
 <div data-browser-status role="status" aria-live="polite">Enter a URL or search downloaded knowledge.</div>
 <iframe data-preview title="Website preview (some websites forbid embedding)" sandbox="allow-scripts allow-forms allow-popups" referrerpolicy="no-referrer" loading="lazy"></iframe>
 <div data-lower><div data-actions><form data-search-form style="display:flex;flex:1;gap:6px"><input type="search" data-search placeholder="Search downloaded knowledge" aria-label="Search offline archives"><button type="submit">Search</button></form><button data-read type="button">Read page</button><button data-links type="button">Links</button><button data-guide type="button">Discuss in chat</button></div><div data-evidence role="region" aria-label="Page text and research results">Websites may block embedding. Select Read page for a text-based view using authorized browser tools.</div></div>`;
 root.querySelector('[data-close]').addEventListener('click',close);
 root.querySelector('[data-network]').addEventListener('change',event=>{authorized=Boolean(event.currentTarget.checked);emit('civweave:browser-permission',{networkAllowed:authorized});status(authorized?'Live browser tools permitted for this session.':'Live browser tool permission disabled. Offline search remains available.')});
 root.querySelector('[data-nav-form]').addEventListener('submit',event=>{event.preventDefault();void navigate(root.querySelector('[data-url]').value)});
 root.querySelector('[data-search-form]').addEventListener('submit',event=>{event.preventDefault();void run('browser.archive_search',{query:root.querySelector('[data-search]').value})});
 root.querySelector('[data-read]').addEventListener('click',()=>void run('browser.open',{url:currentUrl()}));
 root.querySelector('[data-links]').addEventListener('click',()=>void run('browser.links',{url:currentUrl()}));
 root.querySelector('[data-guide]').addEventListener('click',discuss);
 root.querySelector('[data-back]').addEventListener('click',()=>{if(position>0){position--;renderTarget()}});
 root.querySelector('[data-forward]').addEventListener('click',()=>{if(position<history.length-1){position++;renderTarget()}});
 root.addEventListener('keydown',event=>{if(event.key==='Escape')close()});
 document.body.append(root);renderTarget();return root;
}
function renderTarget(){
 if(!root)return;
 const url=currentUrl(),external=root.querySelector('[data-external]');
 root.querySelector('[data-url]').value=url;
 root.querySelector('[data-back]').disabled=position<=0;
 root.querySelector('[data-forward]').disabled=position>=history.length-1;
 root.querySelector('[data-read]').disabled=!url;
 root.querySelector('[data-links]').disabled=!url;
 external.hidden=!url;if(url)external.href=url;else external.removeAttribute('href');
 const iframe=root.querySelector('[data-preview]');
 if(iframe.dataset.cwUrl!==url){iframe.dataset.cwUrl=url;iframe.src=url||'about:blank'}
}
async function navigate(value,{title='',preview=true}={}){
 const {normalizeBrowserTarget}=await core(),url=normalizeBrowserTarget(value);
 if(!url){status('Enter a valid public HTTP(S) address. Local and private network addresses are blocked.');return false}
 if(history[position]!==url){
   history=history.slice(0,position+1);history.push(url);if(history.length>MAX_HISTORY)history.shift();
   position=history.length-1;
 }
 currentTitle=clip(title,180);evidence='';if(root){root.querySelector('[data-evidence]').textContent='Website preview opened. Some sites refuse framing. Use Read page for a text view.';renderTarget()}
 emit('civweave:browser-navigated',{url});status('Opening '+url+' · The page may block embedded viewing.');
 return true;
}
async function listTools(){const {BROWSER_MCP_TOOLS}=await core();return BROWSER_MCP_TOOLS.map(row=>({...row}))}
async function callTool({name,arguments:args={}}={}){
 const {planBrowserCall}=await core(),plan=planBrowserCall(name,args,{networkAllowed:authorized});
 if(!plan.ok)return{isError:true,content:[{type:'text',text:plan.reason}]};
 try{
   const browser=await ensureTool();
   const response=name==='browser.archive_search'
     ? await browser.searchArchive(plan.args.query,{limit:12})
     : await browser.live(name==='browser.search'?'search':name.slice('browser.'.length),plan.args,{allowNetwork:true});
   return{isError:false,content:[{type:'text',text:clip(JSON.stringify(response),24000)}],structuredContent:response};
 }catch(error){return{isError:true,content:[{type:'text',text:clip(error?.message||error,600)}]}}
}
async function run(name,args){
 ensureRoot();const view=root.querySelector('[data-evidence]');
 status('Running '+name+'…');view.textContent='Loading…';
 const result=await callTool({name,arguments:args});
 if(result.isError){view.textContent=result.content?.[0]?.text||'Browser tool failed.';status('Browser tool unavailable or permission required.');return result}
 const output=result.structuredContent;
 evidence=clip(typeof output?.result==='string'?output.result:JSON.stringify(output,null,2),18000);
 view.textContent=evidence;
 status('Source: '+(name==='browser.archive_search'?'on-device downloaded archive':'live Browser Run')+' · web content is untrusted.');
 emit('civweave:browser-research',{tool:name,url:currentUrl(),source:name==='browser.archive_search'?'offline':'live'});
 return result;
}
function discuss(){
 const url=currentUrl();
 const descriptor=[currentTitle||'Browser page',url].filter(Boolean).join(' · ');
 const excerpt=clip(evidence,1800);
 const prompt=url?'Read and discuss this webpage using the available browser tools: '+descriptor+(excerpt?'\nPage extract (untrusted source text):\n'+excerpt:''):'Help me research the browser results.'+(excerpt?'\nUntrusted source results:\n'+excerpt:'');
 close();
 const guide=globalThis.CivweaveGuideChatSurfaceV350;
 if(guide?.open)guide.open({focus:true,prefill:prompt});else status('Guide chat is unavailable. Open the shared chat to discuss this page.');
}
function open({url='',title=''}={}){
 ensureRoot();opened=true;root.hidden=false;root.querySelector('[data-network]').checked=authorized;
 if(url)void navigate(url,{title});
 else root.querySelector('[data-url]').focus({preventScroll:true});
 emit('civweave:browser-opened');return true;
}
function close(){if(!root)return false;opened=false;root.hidden=true;emit('civweave:browser-closed');return true}
function consumeReceived(){
 let received;try{received=JSON.parse(sessionStorage.getItem(RECEIVE_KEY)||'null');sessionStorage.removeItem(RECEIVE_KEY)}catch{try{sessionStorage.removeItem(RECEIVE_KEY)}catch{}}
 if(!received||typeof received!=='object')return false;
 void core().then(({extractBrowserShare})=>{
   const share=extractBrowserShare(received);
   open({url:share.url,title:share.title});
   if(!share.url){status('Received shared text, but no public HTTP(S) link was found.');root.querySelector('[data-evidence]').textContent=share.text||'No shareable web address found.'}
 }).catch(()=>{});
 return true;
}
function start(){consumeReceived()}
globalThis.CivweaveBrowserConnectionV1=Object.freeze({
 version:VERSION,open,close,navigate,listTools,callTool,searchArchive:query=>callTool({name:'browser.archive_search',arguments:{query}}),
 get currentUrl(){return currentUrl()},get active(){return opened},get networkAllowed(){return authorized},get history(){return [...history]}
});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();