(()=>{
'use strict';
const VERSION='183.0-settings-diagnostics-log-level';
const PLATFORM_KEY='commonweave.platform-settings.v143';
const AI_KEY='commonweave.universal-ai.v127';
const PROFILES_KEY='commonweave-model-profiles-v1';
const DEFAULT_RELEASE_GATEWAY='https://commonweave-host-node.onrender.com';
const LEGACY_LOCAL=new Set(['','bundled','packaged','reflex','minilm','local-reflex','smollm2','browser']);
const SELECTORS=['[data-capability-form="commonweave.model-setup"]','[data-native-form="model"]','form[data-platform-ai-settings]','form[data-cw143-settings]'];
const parse=(value,fallback)=>{try{const out=JSON.parse(value);return out==null?fallback:out}catch{return fallback}};
const clean=(value,max=1000)=>String(value??'').trim().slice(0,max);

function createLogger(){
  const LOGGER_VERSION='1.0.6-settings-log-v183';
  const LEVEL_KEY='commonweave.log-level';
  const BUFFER_KEY='commonweave.log-buffer.v1';
  const LEVELS=Object.freeze({off:0,error:1,warn:2,info:3,debug:4,trace:5});
  const MAX_ENTRIES=240;
  const MAX_TEXT=700;
  const sessionId=globalThis.crypto?.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
  let stallTimer=0,longTaskObserver=null,lastTick=performance.now();
  const validLevel=value=>Object.hasOwn(LEVELS,String(value||'').toLowerCase())?String(value).toLowerCase():'warn';
  const requested=new URLSearchParams(location.search).get('cwlog');
  if(requested&&Object.hasOwn(LEVELS,requested.toLowerCase()))localStorage.setItem(LEVEL_KEY,requested.toLowerCase());
  let activeLevel=validLevel(localStorage.getItem(LEVEL_KEY)||'warn');
  const readBuffer=()=>{const value=parse(localStorage.getItem(BUFFER_KEY),[]);return Array.isArray(value)?value.slice(-MAX_ENTRIES):[]};
  let buffer=readBuffer();
  function sanitize(value,depth=0,seen=new WeakSet()){
    if(value==null||typeof value==='number'||typeof value==='boolean')return value;
    if(typeof value==='string')return value.slice(0,MAX_TEXT);
    if(typeof value==='bigint')return String(value);
    if(typeof value==='function')return`[function ${value.name||'anonymous'}]`;
    if(value instanceof Error)return{name:value.name,message:String(value.message||'').slice(0,MAX_TEXT),stack:String(value.stack||'').split('\n').slice(0,8).join('\n').slice(0,1800)};
    if(typeof Element!=='undefined'&&value instanceof Element)return{tag:value.tagName?.toLowerCase(),id:value.id||'',class:String(value.className||'').slice(0,160),name:value.getAttribute?.('name')||'',role:value.getAttribute?.('role')||''};
    if(depth>=4)return'[depth-limit]';
    if(typeof value!=='object')return String(value).slice(0,MAX_TEXT);
    if(seen.has(value))return'[circular]';
    seen.add(value);
    if(Array.isArray(value))return value.slice(0,30).map(item=>sanitize(item,depth+1,seen));
    const output={};
    for(const [key,item] of Object.entries(value).slice(0,40)){
      output[key]=/(?:api.?key|secret|token|authorization|password|credential)/i.test(key)?'[redacted]':sanitize(item,depth+1,seen);
    }
    return output;
  }
  function persist(){
    try{localStorage.setItem(BUFFER_KEY,JSON.stringify(buffer.slice(-MAX_ENTRIES)))}catch{}
  }
  function enabled(level){return LEVELS[activeLevel]>=LEVELS[validLevel(level)]&&activeLevel!=='off'}
  function write(level,scope,event,detail={}){
    level=validLevel(level);
    if(!enabled(level))return null;
    const entry={
      timestamp:new Date().toISOString(),
      epochMs:Date.now(),
      monotonicMs:Math.round(performance.now()*10)/10,
      sessionId,
      level,
      scope:String(scope||'commonweave').slice(0,80),
      event:String(event||'event').slice(0,120),
      path:location.pathname,
      visibility:document.visibilityState,
      detail:sanitize(detail)
    };
    buffer.push(entry);
    if(buffer.length>MAX_ENTRIES)buffer=buffer.slice(-MAX_ENTRIES);
    persist();
    const method=level==='error'?'error':level==='warn'?'warn':level==='info'?'info':'debug';
    console[method]?.(`[Commonweave:${entry.scope}] ${entry.event}`,entry.detail);
    dispatchEvent(new CustomEvent('commonweave:diagnostic-log',{detail:entry}));
    return entry;
  }
  const error=(scope,event,detail)=>write('error',scope,event,detail);
  const warn=(scope,event,detail)=>write('warn',scope,event,detail);
  const info=(scope,event,detail)=>write('info',scope,event,detail);
  const debug=(scope,event,detail)=>write('debug',scope,event,detail);
  const trace=(scope,event,detail)=>write('trace',scope,event,detail);
  function stopObservers(){
    if(stallTimer){clearInterval(stallTimer);stallTimer=0}
    longTaskObserver?.disconnect?.();
    longTaskObserver=null;
  }
  function startObservers(){
    stopObservers();
    if(LEVELS[activeLevel]<LEVELS.debug)return;
    lastTick=performance.now();
    stallTimer=setInterval(()=>{
      const now=performance.now(),drift=now-lastTick-250;
      lastTick=now;
      if(document.visibilityState==='visible'&&drift>750)warn('performance','event-loop-stall',{driftMs:Math.round(drift),sinceNavigationMs:Math.round(now)});
    },250);
    try{
      if('PerformanceObserver'in globalThis&&PerformanceObserver.supportedEntryTypes?.includes('longtask')){
        longTaskObserver=new PerformanceObserver(list=>{
          for(const entry of list.getEntries())warn('performance','long-task',{durationMs:Math.round(entry.duration),startMs:Math.round(entry.startTime),name:entry.name});
        });
        longTaskObserver.observe({type:'longtask',buffered:true});
      }
    }catch(error){debug('logger','long-task-observer-unavailable',{error})}
  }
  function setLevel(level){
    const next=validLevel(level);
    activeLevel=next;
    localStorage.setItem(LEVEL_KEY,next);
    startObservers();
    if(next!=='off')info('logger','level-changed',{level:next});
    renderDock();
    return next;
  }
  const getLevel=()=>activeLevel;
  const snapshot=()=>buffer.map(entry=>({...entry}));
  const exportText=()=>JSON.stringify({loggerVersion:LOGGER_VERSION,level:activeLevel,exportedAt:new Date().toISOString(),entries:snapshot()},null,2);
  async function copy(){
    const text=exportText();
    await navigator.clipboard.writeText(text);
    info('logger','logs-copied',{characters:text.length,entries:buffer.length});
    return text.length;
  }
  function download(){
    const blob=new Blob([exportText()],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;
    link.download=`commonweave-logs-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
    link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    info('logger','logs-downloaded',{entries:buffer.length});
  }
  function clear(){buffer=[];try{localStorage.removeItem(BUFFER_KEY)}catch{};renderDock();return true}
  function renderDock(){
    const existing=document.getElementById('cw-log-dock');
    if(LEVELS[activeLevel]<LEVELS.debug){existing?.remove();return}
    if(!document.body)return;
    let dock=existing;
    if(!dock){
      dock=document.createElement('aside');
      dock.id='cw-log-dock';
      dock.setAttribute('aria-label','Commonweave diagnostic logs');
      dock.innerHTML='<button type="button" data-cw-log-toggle>Logs</button><section data-cw-log-panel hidden><header><b>Commonweave logs</b><button type="button" data-cw-log-close>×</button></header><p data-cw-log-summary></p><pre data-cw-log-output></pre><footer><button type="button" data-cw-log-copy>Copy</button><button type="button" data-cw-log-download>Download</button><button type="button" data-cw-log-clear>Clear</button><button type="button" data-cw-log-off>Turn off</button></footer></section>';
      const style=document.createElement('style');
      style.textContent='#cw-log-dock{position:fixed;z-index:2147483646;right:10px;bottom:max(10px,env(safe-area-inset-bottom));font:12px/1.35 system-ui;color:#eafffa}#cw-log-dock>button{border:1px solid #75f0d5;border-radius:999px;background:#07182f;color:#eafffa;padding:8px 12px}#cw-log-dock section{position:absolute;right:0;bottom:44px;width:min(92vw,560px);max-height:72vh;overflow:auto;border:1px solid #75f0d566;border-radius:16px;background:#07101df5;box-shadow:0 16px 48px #000c;padding:12px}#cw-log-dock header,#cw-log-dock footer{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap}#cw-log-dock pre{white-space:pre-wrap;word-break:break-word;max-height:48vh;overflow:auto;background:#02060d;padding:10px;border-radius:10px}#cw-log-dock button{cursor:pointer}';
      dock.append(style);
      document.body.append(dock);
      const panel=dock.querySelector('[data-cw-log-panel]');
      const refresh=()=>{dock.querySelector('[data-cw-log-summary]').textContent=`Level ${activeLevel} · ${buffer.length} stored entries`;dock.querySelector('[data-cw-log-output]').textContent=exportText()};
      dock.querySelector('[data-cw-log-toggle]').addEventListener('click',()=>{panel.hidden=!panel.hidden;if(!panel.hidden)refresh()});
      dock.querySelector('[data-cw-log-close]').addEventListener('click',()=>{panel.hidden=true});
      dock.querySelector('[data-cw-log-copy]').addEventListener('click',async event=>{try{await copy();event.currentTarget.textContent='Copied'}catch(error){event.currentTarget.textContent='Copy failed';warn('logger','copy-failed',{error})}});
      dock.querySelector('[data-cw-log-download]').addEventListener('click',()=>download());
      dock.querySelector('[data-cw-log-clear]').addEventListener('click',()=>{clear();refresh()});
      dock.querySelector('[data-cw-log-off]').addEventListener('click',()=>setLevel('off'));
    }
  }
  const api=Object.freeze({version:LOGGER_VERSION,levels:LEVELS,levelKey:LEVEL_KEY,bufferKey:BUFFER_KEY,setLevel,getLevel,enabled,write,error,warn,info,debug,trace,snapshot,exportText,copy,download,clear,renderDock});
  addEventListener('error',event=>error('window','error',{message:event.message,filename:event.filename,lineno:event.lineno,colno:event.colno,error:event.error}));
  addEventListener('unhandledrejection',event=>error('window','unhandled-rejection',{reason:event.reason}));
  document.addEventListener('visibilitychange',()=>{lastTick=performance.now();debug('lifecycle','visibility-change',{visibility:document.visibilityState})});
  startObservers();
  document.readyState==='loading'?addEventListener('DOMContentLoaded',renderDock,{once:true}):renderDock();
  info('logger','ready',{version:LOGGER_VERSION,level:activeLevel,storedEntries:buffer.length});
  return api;
}

const logger=globalThis.CommonweaveLogV183||createLogger();
globalThis.CommonweaveLogV183=logger;
let legacyMigrationComplete=false;
function controller(){return globalThis.CommonweaveModelSettingsControllerV173}
function open(){
  const api=controller();
  logger.debug('settings','controller-lookup',{available:Boolean(api?.open),controllerVersion:api?.version||null,settingsOpenState:document.documentElement.dataset.settingsOpenState||null});
  if(!api?.open){const error=new Error('Commonweave AI settings are not ready.');logger.error('settings','controller-unavailable',{error});throw error}
  const started=performance.now();
  logger.info('settings','open-invoke',{controllerVersion:api.version,activeElement:document.activeElement});
  try{
    const result=api.open(),elapsedMs=Math.round((performance.now()-started)*10)/10;
    logger.info('settings','open-return',{elapsedMs,resultHidden:Boolean(result?.hidden),layerId:result?.id||null});
    requestAnimationFrame(()=>logger.debug('settings','open-first-paint',{elapsedMs:Math.round((performance.now()-started)*10)/10,layerHidden:Boolean(result?.hidden)}));
    setTimeout(()=>logger.trace('settings','open-next-task',{elapsedMs:Math.round((performance.now()-started)*10)/10}),0);
    return result;
  }catch(error){
    logger.error('settings','open-threw',{elapsedMs:Math.round((performance.now()-started)*10)/10,error});
    throw error;
  }
}
function migrateLegacyAI(){
  if(legacyMigrationComplete){logger.trace('settings','delegation-migration-skipped',{reason:'already-complete'});return false}
  legacyMigrationComplete=true;
  const legacy=parse(localStorage.getItem(AI_KEY),{}),raw=String(legacy.provider||legacy.route||'').toLowerCase();
  let changed=false;
  if(!legacy.route||LEGACY_LOCAL.has(raw)){localStorage.setItem(AI_KEY,JSON.stringify({route:'deterministic',provider:'deterministic',model:'commonweave-deterministic-v175',endpoint:'',consent:false,externalConsent:false,agenticEnabled:false}));changed=true}
  const profiles=parse(localStorage.getItem(PROFILES_KEY),{}),interactive=profiles.interactive,profileRaw=String(interactive?.provider||interactive?.route||'').toLowerCase();
  if(!interactive||LEGACY_LOCAL.has(profileRaw)){profiles.interactive={route:'deterministic',provider:'deterministic',model:'commonweave-deterministic-v175',endpoint:'',externalConsent:false};profiles.agentic=null;profiles.agenticEnabled=false;localStorage.setItem(PROFILES_KEY,JSON.stringify(profiles));changed=true}
  logger.debug('settings','delegation-migration-complete',{changed});
  return changed;
}
function savePlatform(form){
  const prior=parse(localStorage.getItem(PLATFORM_KEY),{}),releaseGateway=clean(form.elements.namedItem('releaseGateway')?.value)||prior.releaseGateway||DEFAULT_RELEASE_GATEWAY,sharedNode=clean(form.elements.namedItem('sharedNode')?.value)||prior.sharedNode||location.origin,shareLearningLibrary=Boolean(form.elements.namedItem('shareLearningLibrary')?.checked);
  localStorage.setItem(PLATFORM_KEY,JSON.stringify({releaseGateway,sharedNode,shareLearningLibrary}));
  logger.info('platform-settings','saved',{releaseGateway,sharedNode,shareLearningLibrary});
  const status=form.querySelector('[data-cw143-status]')||form.closest('section')?.querySelector('[data-cw143-status]');if(status)status.textContent='Platform settings saved on this device.';
}
function retitlePlatform(container){
  const kicker=container.querySelector('.cw143-kicker');if(kicker&&/AI CONFIGURATION/i.test(kicker.textContent))kicker.textContent='PLATFORM CONFIGURATION';
  const intro=container.querySelector('header p');if(intro&&/model route/i.test(intro.textContent))intro.textContent='Configure the release gateway, sharing node, and explicit publication boundary for this installed device.';
}
function replacement(form){
  if(!form||form.closest('[data-unified-ai-settings-v175],[data-unified-ai-settings-v182]')||form.dataset.delegatedAiSettings==='true')return;
  form.dataset.delegatedAiSettings='true';
  const container=form.closest('.rc-panel,.native-panel,.card,.cw143-surface,section')||form.parentElement;if(!container)return;
  const platformFields=[...form.elements].filter(field=>/gateway|sharing|node|publish/i.test(`${field.name} ${field.labels?.[0]?.textContent||''}`));
  if(platformFields.length){
    retitlePlatform(container);
    form.querySelectorAll('.cw143-panel,.native-panel,section').forEach(panel=>{if(/^AI route$/i.test(panel.querySelector('h3')?.textContent?.trim()||''))panel.remove()});
    const aiFields=[...form.elements].filter(field=>/provider|route|model|endpoint|apikey|api-key|token|consent|agentic/i.test(field.name||''));
    aiFields.forEach(field=>field.closest('label,section,.field,.form-row,.cw143-panel')?.remove());
    const submit=form.querySelector('button[type="submit"],input[type="submit"]');if(submit)submit.textContent='Save platform settings';
    const hasHandoff=form.querySelector('[data-open-ai-settings],[data-open-unified-ai-settings]');
    if(!hasHandoff)form.insertAdjacentHTML('beforeend','<section class="cw-ai-fallback-contract"><b>AI configuration</b><span>Provider, API key, consent, and agentic settings live in the single Commonweave AI settings surface. Deterministic local mode is the default.</span><button type="button" data-open-unified-ai-settings>Open Commonweave AI settings</button></section>');
    return;
  }
  form.replaceWith(Object.assign(document.createElement('div'),{className:'cw-ai-fallback-contract',innerHTML:'<b>AI configuration moved</b><span>This legacy form is retired. Every guide uses the single Commonweave AI settings surface.</span><button type="button" data-open-unified-ai-settings>Open Commonweave AI settings</button>'}));
}
function patch(root=document){for(const selector of SELECTORS)root.querySelectorAll?.(selector).forEach(replacement);root.querySelectorAll?.('[data-capability="commonweave.model-setup"]').forEach(button=>{button.dataset.opensUnifiedAiSettings='true';button.title='Open Commonweave AI settings'})}
document.addEventListener('submit',event=>{const form=event.target.closest?.('form[data-cw143-settings]');if(!form)return;event.preventDefault();event.stopImmediatePropagation();savePlatform(form)},true);
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-open-ai-settings],[data-open-unified-ai-settings],[data-opens-unified-ai-settings]');if(!button)return;
  const clickStarted=performance.now();
  logger.debug('settings','launcher-click-captured',{button,detail:event.detail,pointerType:event.pointerType||null,isTrusted:event.isTrusted});
  event.preventDefault();
  event.stopImmediatePropagation();
  try{
    const result=open();
    if(result&&typeof result.then==='function')result.catch(error=>logger.error('settings','async-open-rejected',{error}));
    logger.trace('settings','launcher-click-complete',{elapsedMs:Math.round((performance.now()-clickStarted)*10)/10});
  }catch(error){
    logger.error('settings','launcher-click-failed',{elapsedMs:Math.round((performance.now()-clickStarted)*10)/10,error});
  }
},true);
for(const eventName of ['commonweave:settings-first-open-metric','commonweave:model-settings-opened','commonweave:model-settings-closed','commonweave:model-settings-saved'])addEventListener(eventName,event=>logger.debug('settings',eventName.replace('commonweave:',''),event.detail||{}));
const observer=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1){replacement(node.matches?.(SELECTORS.join(','))?node:null);patch(node)}});
observer.observe(document.documentElement,{childList:true,subtree:true});
document.readyState==='loading'?addEventListener('DOMContentLoaded',()=>patch(),{once:true}):patch();
globalThis.CommonweaveSettingsDelegationV175=Object.freeze({version:VERSION,open,patch,migrateLegacyAI,savePlatform,loggerVersion:logger.version,logLevelKey:logger.levelKey});
})();
