(()=>{
'use strict';
const VERSION='1.0.130-local-ai-hardware-tier-ui-v279-settings-safe';
const PANEL='cw-local-ai-v266',HEALTH='civweave.local-ai.health.v286',NOTE='cw-local-ai-device-fit-v314';
if(globalThis.CivweaveLocalModelHardwareTierUIV278?.version===VERSION&&globalThis.CivweaveLocalModelHardwareTierUIV278?.deviceFitRecommendations===true)return;
const registry=()=>globalThis.CivweaveLocalModelRegistryV266;
const readHealth=()=>{try{return JSON.parse(localStorage.getItem(HEALTH)||'{}')||{}}catch{return{}}};
const mobile=()=>Boolean(globalThis.matchMedia?.('(max-width:760px)')?.matches||(globalThis.matchMedia?.('(pointer:coarse)')?.matches&&Math.min(Number(innerWidth)||9999,Number(innerHeight)||9999)<1000));
let probePromise=null,observer=null,decorating=false;

function linkFor(model){
  const href=registry()?.sourceUrl?.(model);if(!href)return null;
  const a=document.createElement('a');a.href=href;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Source package';a.dataset.civweaveModelSource=model.id;a.style.cssText='display:inline-block;margin-top:5px;font-size:.78rem;color:#9ff2dc;text-decoration:underline';return a;
}
async function probe(){
  if(probePromise)return probePromise;
  probePromise=(async()=>{
    const info={mobile:mobile(),memoryGB:Math.max(0,Number(navigator.deviceMemory||0)),cores:Math.max(1,Number(navigator.hardwareConcurrency||1)),isolated:Boolean(globalThis.crossOriginIsolated),webgpu:false,shaderF16:false,gpu:''};
    if(!navigator.gpu?.requestAdapter)return info;
    try{
      const adapter=await Promise.race([navigator.gpu.requestAdapter(),new Promise(resolve=>setTimeout(()=>resolve(null),1500))]);
      if(!adapter)return info;
      info.webgpu=true;info.shaderF16=Boolean(adapter.features?.has?.('shader-f16'));
      const a=adapter.info||{};info.gpu=[a.vendor,a.architecture,a.device,a.description].filter(Boolean).join(' · ').slice(0,180);
    }catch{}
    return info;
  })();
  return probePromise;
}
function measuredFit(model,health){
  if(!health)return null;
  if(health.ok!==true)return{rank:0,state:'avoid',label:'Not recommended here',detail:`Last test failed${health.stage?` at ${health.stage}`:''}.`};
  if(health.fallbackUsed)return{rank:0,state:'avoid',label:'Fallback only',detail:'The selected model only completed by switching to another backend/model.'};
  const m=health.metrics||{},cold=Math.max(0,Number(m.coldStartMs||0)),ttft=Math.max(0,Number(m.ttftMs??m.benchmarkTtftMs??0)),tps=Math.max(0,Number(m.tokensPerSecond||m.benchmarkTokensPerSecond||0));
  if(tps>=4&&(!ttft||ttft<=15000)&&(!cold||cold<=90000))return{rank:5,state:'smooth',label:'Verified smooth',detail:`Measured ${tps.toFixed(1)} tok/s${ttft?` · TTFT ${(ttft/1000).toFixed(1)}s`:''}${cold?` · cold ${(cold/1000).toFixed(0)}s`:''}.`};
  if(tps>=2&&(!ttft||ttft<=30000)&&(!cold||cold<=180000))return{rank:4,state:'usable',label:'Verified usable',detail:`Measured ${tps.toFixed(1)} tok/s${ttft?` · TTFT ${(ttft/1000).toFixed(1)}s`:''}${cold?` · cold ${(cold/1000).toFixed(0)}s`:''}.`};
  return{rank:1,state:'slow',label:'Works, but slow',detail:`Last test was outside Civweave's smooth-chat target${tps?` · ${tps.toFixed(1)} tok/s`:''}${cold?` · cold ${(cold/1000).toFixed(0)}s`:''}.`};
}
function unmeasuredFit(model,device){
  if(!device.webgpu)return{rank:0,state:'avoid',label:'No WebGPU fit',detail:'Civweave will not recommend a browser model until a usable WebGPU adapter is available.'};
  if(model.requiresShaderF16&&!device.shaderF16)return{rank:0,state:'avoid',label:'GPU feature missing',detail:'This model requires shader-f16, which the active adapter does not expose.'};
  if(model.id==='qwen3-0.6b-q4f16')return{rank:3,state:'recommended',label:'Best first try',detail:'Smallest stable WebGPU chat model. Start here, then let the measured health test promote larger models.'};
  if(model.id==='gemma3-1b-it-q4f16')return{rank:2,state:'candidate',label:'Good next step',detail:device.mobile?'Try after the small tier passes cleanly.':'Try after Qwen 0.6B, or use it directly if its health check is already fast.'};
  if(model.id==='qwen3-1.7b-q4f16')return{rank:1,state:'candidate',label:'Benchmark first',detail:'Only promote this tier after a smaller model proves the device can sustain smooth WebGPU inference.'};
  if(model.id==='smollm3-3b-q4f16')return{rank:1,state:'candidate',label:'Benchmark first',detail:'A 2+ GB browser model should earn its recommendation from measured cold-start and decode speed, not RAM alone.'};
  return{rank:1,state:'candidate',label:'Advanced tier',detail:'Not recommended automatically until this device has a passing speed measurement.'};
}
function fit(model,device,healthMap){return measuredFit(model,healthMap?.[model.id])||unmeasuredFit(model,device)}
function badge(row,model,value,isRecommended){
  let node=row.querySelector('[data-civweave-device-fit]');
  if(!node){node=document.createElement('div');node.dataset.civweaveDeviceFit='1';node.style.cssText='margin-top:7px;padding:7px 9px;border-radius:9px;background:#ffffff0d;border:1px solid #ffffff20;font-size:.78rem;line-height:1.35';row.querySelector('div')?.append(node)}
  const text=`${isRecommended?'★ Recommended on this device · ':''}${value.label} · ${value.detail}`;
  if(node.textContent!==text)node.textContent=text;
  node.dataset.fitState=value.state;
}
function summary(panel,device,recommended,verifiedCount){
  let node=panel.querySelector(`#${NOTE}`);
  if(!node){node=document.createElement('div');node.id=NOTE;node.style.cssText='padding:11px 12px;border:1px solid #8af5d244;border-radius:12px;background:#071b20;color:#e7fff8;line-height:1.45';panel.firstElementChild?.after(node)}
  if(!node)return;
  const deviceBits=[device.webgpu?'WebGPU ready':'WebGPU unavailable',device.cores?`${device.cores} CPU lanes`:'',device.memoryGB?`${device.memoryGB} GB browser memory class`:'',device.isolated?'threaded WASM eligible':'single-thread WASM only'].filter(Boolean).join(' · ');
  const recommendation=recommended?`Recommended now: ${recommended.label}.`:'No local model is currently recommended for smooth interactive chat.';
  const copy=`Civweave now favors measured smoothness over the biggest model. ${recommendation} ${verifiedCount?`${verifiedCount} model${verifiedCount===1?' has':'s have'} device-specific health data.`:'Run Test model once and recommendations will adapt to this device.'} Target: cold load ≤90s, TTFT ≤15s, decode ≥4 tok/s. ${deviceBits}.`;
  if(node.textContent!==copy)node.textContent=copy;
}
function localTabVisible(panel){const tab=panel?.closest?.('[data-settings-tab-panel="local-models"]');return !tab||!tab.hidden}
async function decorate(){
  if(decorating)return false;decorating=true;
  try{
    const panel=document.getElementById(PANEL),r=registry();if(!panel||!r||!localTabVisible(panel))return false;
    const device=await probe(),healthMap=readHealth(),models=r.installable(),values=models.map(model=>({model,value:fit(model,device,healthMap)}));
    const verified=values.filter(row=>healthMap?.[row.model.id]).length;
    const smooth=values.filter(row=>['smooth','usable'].includes(row.value.state)).sort((a,b)=>b.value.rank-a.value.rank||Number(b.model.estimatedBytes||0)-Number(a.model.estimatedBytes||0));
    const recommended=(smooth[0]||values.find(row=>row.model.id==='qwen3-0.6b-q4f16'&&row.value.rank>0)||values.filter(row=>row.value.rank>0).sort((a,b)=>b.value.rank-a.value.rank)[0])?.model||null;
    for(const {model,value} of values){
      const row=panel.querySelector(`[data-model-id="${CSS.escape(model.id)}"]`);if(!row)continue;
      const p=row.querySelector('p');if(p&&model.hardwareTier&&!p.dataset.hardwareTier){p.append(document.createTextNode(` · ${model.hardwareTier}`));p.dataset.hardwareTier='1'}
      badge(row,model,value,recommended?.id===model.id);
      if(!row.querySelector(`[data-civweave-model-source="${model.id}"]`)){const a=linkFor(model);if(a)row.querySelector('div')?.append(a)}
    }
    summary(panel,device,recommended,verified);return true;
  }finally{decorating=false}
}
function watch(){
  const panel=document.getElementById(PANEL);if(!panel)return;
  if(localTabVisible(panel))void decorate();
  if(observer)return;
  observer=new MutationObserver(()=>queueMicrotask(()=>{if(localTabVisible(panel))void decorate()}));
  observer.observe(panel,{childList:true,subtree:true});
}
addEventListener('civweave:settings-tab-selected',event=>{if(event?.detail?.name==='local-models')queueMicrotask(watch)});
for(const name of ['civweave:local-model-download-progress','civweave:local-model-downloaded','civweave:local-model-health','civweave:local-model-selection'])addEventListener(name,()=>queueMicrotask(watch));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>queueMicrotask(watch),{once:true});else queueMicrotask(watch);
globalThis.CivweaveLocalModelHardwareTierUIV278=Object.freeze({version:VERSION,decorate,watch,probe,fit,healthKey:HEALTH,deviceFitRecommendations:true,measuredSmoothness:true,settingsSafeActivation:true,mutationStableSummary:true,smoothTarget:Object.freeze({coldStartMs:90000,ttftMs:15000,tokensPerSecond:4})});
})();
