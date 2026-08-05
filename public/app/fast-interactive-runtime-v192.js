(()=>{
'use strict';
const VERSION='1.0.6-fast-interactive-v192';
let timer=0;
function install(){
  const runtime=globalThis.CommonweaveModelRuntime;
  if(!runtime?.generate)return false;
  if(runtime.generate.__commonweaveFastInteractiveV192)return true;
  const original=runtime.generate.bind(runtime);
  const wrapped=async request=>{
    const purpose=String(request?.purpose||'');
    if(!/^commonweave-guide-response-v141/.test(purpose))return original(request);
    const config={...(request.config||{})};
    const provider=String(config.provider||config.route||'').toLowerCase();
    const configured=Number(config.timeoutMs)||Number(config.timeoutSeconds)*1000||0;
    if(provider==='gemini')config.timeoutMs=Math.min(configured||8000,10000);
    else if(provider==='hosted')config.timeoutMs=Math.min(configured||12000,15000);
    const tokenLimit=Number(config.maxTokens||config.max_tokens)||0;
    config.maxTokens=Math.min(tokenLimit||1400,1800);
    config.stream=false;
    const started=performance.now();
    const result=await original({...request,config,responseFormat:'json',maxRepairAttempts:0});
    result.latency={...(result.latency||{}),interactiveMs:Math.round(performance.now()-started),revision:VERSION};
    return result;
  };
  wrapped.__commonweaveFastInteractiveV192=true;
  wrapped.__prior=original;
  runtime.generate=wrapped;
  runtime.fastInteractiveRevision=VERSION;
  return true;
}
function stabilize(){
  if(install())return true;
  if(timer)return false;
  let attempts=0;
  timer=setInterval(()=>{attempts++;if(install()||attempts>=120){clearInterval(timer);timer=0}},25);
  return false;
}
stabilize();
globalThis.CommonweaveFastInteractiveV192=Object.freeze({version:VERSION,install,stabilize});
})();
