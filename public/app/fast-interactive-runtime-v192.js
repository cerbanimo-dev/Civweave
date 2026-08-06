(()=>{
'use strict';
const VERSION='1.0.7-fast-interactive-v192.1-frozen-runtime-proxy';
const root=globalThis;
const state={installed:false,mode:'waiting',lastError:''};
let timer=0;
const clock=()=>Number(root.performance?.now?.())||Date.now();
function dispatch(name,detail){try{root.dispatchEvent?.(new CustomEvent(name,{detail}))}catch{}}
function optimizedRequest(request={}){
  const purpose=String(request?.purpose||'');
  if(!/^commonweave-guide-response-v141/.test(purpose))return request;
  const config={...(request.config||{})};
  const provider=String(config.provider||config.route||'').toLowerCase();
  const configured=Number(config.timeoutMs)||Number(config.timeoutSeconds)*1000||0;
  if(provider==='gemini')config.timeoutMs=Math.min(configured||8000,10000);
  else if(provider==='hosted')config.timeoutMs=Math.min(configured||12000,15000);
  const tokenLimit=Number(config.maxTokens||config.max_tokens)||0;
  config.maxTokens=Math.min(tokenLimit||1400,1800);
  config.stream=false;
  return{...request,config,responseFormat:'json',maxRepairAttempts:0};
}
function install(){
  const runtime=root.CommonweaveModelRuntime;
  if(!runtime?.generate){state.mode='waiting';return false}
  if(runtime.generate.__commonweaveFastInteractiveV192){state.installed=true;state.mode='proxy';state.lastError='';return true}
  try{
    const original=runtime.generate.bind(runtime);
    const wrapped=async request=>{
      const optimized=optimizedRequest(request);
      if(optimized===request)return original(request);
      const started=clock();
      const result=await original(optimized);
      return{...result,latency:{...(result?.latency||{}),interactiveMs:Math.max(0,Math.round(clock()-started)),revision:VERSION}};
    };
    Object.defineProperties(wrapped,{
      __commonweaveFastInteractiveV192:{value:true},
      __prior:{value:original},
    });
    const proxy=Object.freeze({...runtime,generate:wrapped,fastInteractiveRevision:VERSION});
    root.CommonweaveModelRuntime=proxy;
    state.installed=root.CommonweaveModelRuntime===proxy&&Boolean(root.CommonweaveModelRuntime.generate.__commonweaveFastInteractiveV192);
    state.mode=state.installed?'proxy':'fallback';
    state.lastError=state.installed?'':'The model runtime proxy could not be installed; guide calls will use the original runtime.';
    dispatch('commonweave:fast-interactive-installed',{version:VERSION,installed:state.installed,mode:state.mode});
    return state.installed;
  }catch(error){
    state.installed=false;
    state.mode='fallback';
    state.lastError=String(error?.message||error||'Unknown fast-runtime installation error.');
    dispatch('commonweave:fast-interactive-fallback',{version:VERSION,error:state.lastError});
    return false;
  }
}
function stabilize(){
  if(install())return true;
  if(timer)return false;
  let attempts=0;
  timer=setInterval(()=>{
    attempts+=1;
    if(install()||attempts>=120){clearInterval(timer);timer=0}
  },25);
  return false;
}
function status(){return{version:VERSION,installed:state.installed,mode:state.mode,lastError:state.lastError,runtimeFrozen:Object.isFrozen(root.CommonweaveModelRuntime||{})}}
const api=Object.freeze({version:VERSION,install,stabilize,optimizedRequest,status});
root.CommonweaveFastInteractiveV192=api;
try{stabilize()}catch(error){state.mode='fallback';state.lastError=String(error?.message||error||'Fast runtime could not start.')}
})();
