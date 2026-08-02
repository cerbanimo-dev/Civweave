(()=>{
'use strict';
const VERSION='1.0.26';
const BUILD='1.0.26-loop-diagnostics';
const STORE_KEY='commonweave.boot-log.v1';
const SESSION_ID=sessionStorage.getItem('commonweave.boot-session')||crypto.randomUUID();
sessionStorage.setItem('commonweave.boot-session',SESSION_ID);
const startedAt=Date.now();
let events=[];
try{events=JSON.parse(localStorage.getItem(STORE_KEY)||'[]');if(!Array.isArray(events))events=[]}catch{events=[]}
const clean=value=>{
  if(value==null)return value;
  if(typeof value==='string')return value.slice(0,1200);
  if(typeof value==='number'||typeof value==='boolean')return value;
  if(Array.isArray(value))return value.slice(0,30).map(clean);
  if(typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!/key|token|secret|prompt|message|content/i.test(key)).slice(0,40).map(([key,item])=>[key,clean(item)]));
  return String(value).slice(0,1200);
};
function persist(){try{events=events.slice(-240);localStorage.setItem(STORE_KEY,JSON.stringify(events))}catch{}}
async function transmit(entry){try{await fetch('/api/boot-log',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(entry),keepalive:true,cache:'no-store'})}catch{}}
function log(kind,detail={}){
  const entry={schema:'commonweave.boot-log.v1',id:crypto.randomUUID(),time:new Date().toISOString(),elapsedMs:Date.now()-startedAt,sessionId:SESSION_ID,version:VERSION,build:BUILD,kind:String(kind).slice(0,100),url:location.href,visibility:document.visibilityState,detail:clean(detail)};
  events.push(entry);persist();console.info('[CW-BOOT]',entry);transmit(entry);render();return entry;
}
function snapshot(){
  const nav=performance.getEntriesByType?.('navigation')?.[0];
  return {href:location.href,referrer:document.referrer,displayMode:matchMedia('(display-mode: standalone)').matches?'standalone':'browser',navigationType:nav?.type||'unknown',hostBuild:localStorage.getItem('commonweave.host-build'),recoveryCompleted:localStorage.getItem('commonweave.recovery.completed'),recoveryEntry:sessionStorage.getItem('commonweave.recovery.entry'),userAgent:navigator.userAgent.slice(0,300),online:navigator.onLine};
}
async function inspectWorkers(reason='manual'){
  const result={reason,controller:navigator.serviceWorker?.controller?.scriptURL||null,registrations:[],caches:[]};
  try{const registrations=await navigator.serviceWorker?.getRegistrations?.()||[];result.registrations=registrations.map(reg=>({scope:reg.scope,active:reg.active?.scriptURL||null,activeState:reg.active?.state||null,waiting:reg.waiting?.scriptURL||null,waitingState:reg.waiting?.state||null,installing:reg.installing?.scriptURL||null,installingState:reg.installing?.state||null}))}catch(error){result.registrationError=error.message}
  try{result.caches=await caches.keys()}catch(error){result.cacheError=error.message}
  log('worker-snapshot',result);return result;
}
function download(){const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),snapshot:snapshot(),events},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=`commonweave-boot-log-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function copy(){navigator.clipboard?.writeText(JSON.stringify({snapshot:snapshot(),events},null,2)).then(()=>log('diagnostics-copied')).catch(error=>log('diagnostics-copy-failed',{message:error.message}))}
function clear(){events=[];persist();log('diagnostics-cleared')}
let panel;
function ensurePanel(){
  if(panel)return panel;
  panel=document.createElement('dialog');panel.id='cw-boot-diagnostics';panel.innerHTML=`<section><header><div><small>COMMONWEAVE BOOT TRACE</small><h2>v${VERSION} diagnostics</h2></div><button data-close aria-label="Close">×</button></header><p class="cw-diag-summary"></p><pre></pre><menu><button data-refresh>Inspect workers</button><button data-copy>Copy</button><button data-download>Download JSON</button><button data-clear>Clear</button></menu></section>`;
  const style=document.createElement('style');style.textContent=`#cw-boot-diagnostics{width:min(96vw,760px);max-height:90dvh;padding:0;border:1px solid #7ee5ff;border-radius:18px;background:#061923;color:#effffb}#cw-boot-diagnostics::backdrop{background:#000b}#cw-boot-diagnostics section{display:grid;gap:10px;padding:16px}#cw-boot-diagnostics header{display:flex;justify-content:space-between;align-items:start}#cw-boot-diagnostics h2{margin:2px 0;font:500 28px Georgia}#cw-boot-diagnostics small{color:#efd176;font-weight:900}#cw-boot-diagnostics header button{width:38px;height:38px;border-radius:50%;border:0;background:#ffffff16;color:#fff;font-size:23px}#cw-boot-diagnostics pre{max-height:55dvh;overflow:auto;white-space:pre-wrap;word-break:break-word;padding:12px;border-radius:12px;background:#020b10;color:#bfeeff;font:11px/1.45 ui-monospace,monospace}#cw-boot-diagnostics menu{display:flex;flex-wrap:wrap;gap:7px;padding:0;margin:0}#cw-boot-diagnostics menu button{min-height:40px;border:1px solid #efd17677;border-radius:10px;background:#174b58;color:#fff;padding:7px 10px}.cw-boot-log-button{position:fixed;z-index:10000;left:max(8px,env(safe-area-inset-left));bottom:max(8px,env(safe-area-inset-bottom));min-width:58px;height:34px;border:1px solid #7ee5ff;border-radius:999px;background:#061923ed;color:#bfeeff;font:800 10px ui-monospace,monospace;box-shadow:0 8px 24px #0009}.cw-boot-log-button[data-loop="true"]{border-color:#ff5e8a;color:#fff;background:#7a1537;animation:cwDiagPulse .8s infinite alternate}@keyframes cwDiagPulse{to{box-shadow:0 0 22px #ff5e8a}}`;
  document.head.append(style);document.body.append(panel);
  panel.querySelector('[data-close]').onclick=()=>panel.close();panel.querySelector('[data-refresh]').onclick=()=>inspectWorkers('panel');panel.querySelector('[data-copy]').onclick=copy;panel.querySelector('[data-download]').onclick=download;panel.querySelector('[data-clear]').onclick=clear;return panel;
}
function render(){if(!panel?.open)return;panel.querySelector('.cw-diag-summary').textContent=`${events.length} events · session ${SESSION_ID.slice(0,8)} · controller ${navigator.serviceWorker?.controller?.scriptURL||'none'}`;panel.querySelector('pre').textContent=JSON.stringify(events.slice(-80),null,2)}
function mountButton(){if(document.querySelector('.cw-boot-log-button'))return;const button=document.createElement('button');button.className='cw-boot-log-button';button.textContent='BOOT LOG';button.onclick=()=>{ensurePanel().showModal();render();inspectWorkers('panel-open')};document.body.append(button);const recent=events.filter(event=>Date.now()-Date.parse(event.time)<60000&&event.kind==='page-load');button.dataset.loop=String(recent.length>=4)}
function wireWorker(registration){if(!registration)return;registration.addEventListener('updatefound',()=>{const worker=registration.installing;log('worker-updatefound',{scope:registration.scope,scriptURL:worker?.scriptURL,state:worker?.state});worker?.addEventListener('statechange',()=>log('worker-statechange',{scope:registration.scope,scriptURL:worker.scriptURL,state:worker.state}))})}
window.CommonweaveBootLog={log,events:()=>events.slice(),snapshot,inspectWorkers,download,copy,clear,version:VERSION,build:BUILD};
log('page-load',snapshot());
addEventListener('error',event=>log('window-error',{message:event.message,filename:event.filename,line:event.lineno,column:event.colno}));
addEventListener('unhandledrejection',event=>log('unhandled-rejection',{reason:event.reason?.message||String(event.reason)}));
addEventListener('beforeunload',()=>log('beforeunload',{ageMs:Date.now()-startedAt}));
addEventListener('pagehide',event=>log('pagehide',{persisted:event.persisted,ageMs:Date.now()-startedAt}));
addEventListener('pageshow',event=>log('pageshow',{persisted:event.persisted}));
addEventListener('online',()=>log('network-online'));addEventListener('offline',()=>log('network-offline'));
document.addEventListener('visibilitychange',()=>log('visibility-change',{state:document.visibilityState}));
if('serviceWorker'in navigator){navigator.serviceWorker.addEventListener('controllerchange',()=>{log('worker-controllerchange',{controller:navigator.serviceWorker.controller?.scriptURL||null});inspectWorkers('controllerchange')});navigator.serviceWorker.addEventListener('message',event=>log('worker-message',event.data||{}));navigator.serviceWorker.getRegistrations().then(registrations=>registrations.forEach(wireWorker)).catch(error=>log('worker-list-failed',{message:error.message}))}
Promise.allSettled([fetch('/api/health?boot='+Date.now(),{cache:'no-store'}).then(response=>response.json()),fetch('version.json?boot='+Date.now(),{cache:'no-store'}).then(response=>response.json())]).then(results=>log('version-probe',{health:results[0].status==='fulfilled'?results[0].value:{error:String(results[0].reason)},manifest:results[1].status==='fulfilled'?results[1].value:{error:String(results[1].reason)}}));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{mountButton();inspectWorkers('dom-ready')},{once:true});else{mountButton();inspectWorkers('immediate')}
})();
