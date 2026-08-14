(()=>{
'use strict';
const VERSION='1.0.0-low-end-device-lab-v1';
const SCHEMA='civweave.low-end-device-evidence.v1';
const KEY='civweave.launch.low-end-device-evidence.v1';
const MODEL_ID='smollm2-135m-instruct-q8-wasm';
const REQUIRED_EVIDENCE=['coldLaunchOnline','coldLaunchOffline','warmMiniLmClassification','smolLm135mGeneration','memoryPressureRecovery','workerShutdown','interruptedModelDownloadRecovery','fullyDisconnectedRelaunch','thermalAndBatteryObservation'];
const REQUIRED_MEASUREMENTS=['startupMs','miniLmColdMs','miniLmWarmMs','smolLm135mFirstTokenMs','smolLm135mTokensPerSecond','peakMemoryMb'];
const $=id=>document.getElementById(id);
const now=()=>new Date().toISOString();
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const round=(value,digits=1)=>Number.isFinite(Number(value))?Number(Number(value).toFixed(digits)):null;
const mb=bytes=>Number.isFinite(Number(bytes))?round(Number(bytes)/1024/1024,1):null;
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const fresh=()=>({schema:SCHEMA,labVersion:VERSION,runId:`cw-low-end-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`,status:'blocked',createdAt:now(),updatedAt:now(),releaseVersion:null,device:{},measurements:{},scenarios:Object.fromEntries(REQUIRED_EVIDENCE.map(id=>[id,{status:'blocked',updatedAt:null,detail:'Not yet recorded.'}])),checkpoints:{},events:[],physical:{},privacy:{locationCollected:false,chatContentCollected:false,credentialsCollected:false,automaticUpload:false},requiredEvidence:REQUIRED_EVIDENCE,requiredMeasurements:REQUIRED_MEASUREMENTS,evidenceHash:null});
let state=parse(localStorage.getItem(KEY),null)||fresh();
let heapPeakBytes=0,heapTimer=0,batteryObject=null;
function save(){state.updatedAt=now();try{localStorage.setItem(KEY,JSON.stringify(state))}catch{}render()}
function event(type,detail={}){state.events.push({at:now(),type,...detail});if(state.events.length>120)state.events=state.events.slice(-120);save()}
function scenario(id,status,detail='',extra={}){state.scenarios[id]={status,updatedAt:now(),detail,...extra};save()}
function metric(id,value){if(value!=null&&Number.isFinite(Number(value)))state.measurements[id]=Number(value);save()}
function statusText(message){if($('lab-status'))$('lab-status').textContent=message}
function progress(message){if($('core-progress'))$('core-progress').textContent=message}
function runtime(){return globalThis.CivweaveLocalModelRuntimeV266}
function manager(){return globalThis.CivweaveLocalModelDownloadV266}
function registry(){return globalThis.CivweaveLocalModelRegistryV266}
function pulse(){return globalThis.CivweaveLocalModelTestPulseV269}
function router(){return globalThis.CivweaveContextRouterV344}
function navigationStartupMs(){const nav=performance.getEntriesByType?.('navigation')?.[0];const value=Number(nav?.domContentLoadedEventEnd||nav?.duration||performance.now());return Math.max(0,Math.round(value))}
function pwaMode(){return navigator.standalone===true||['standalone','fullscreen','minimal-ui','window-controls-overlay'].some(mode=>globalThis.matchMedia?.(`(display-mode:${mode})`)?.matches)}
function heapSample(){const used=Number(performance?.memory?.usedJSHeapSize||0);if(used>heapPeakBytes){heapPeakBytes=used;metric('peakMemoryMb',mb(heapPeakBytes))}return used}
function startHeapSampling(){heapSample();if(heapTimer)return;heapTimer=setInterval(heapSample,500)}
function stopHeapSampling(){if(heapTimer){clearInterval(heapTimer);heapTimer=0}heapSample()}
async function specificMemoryMb(){try{if(typeof performance.measureUserAgentSpecificMemory!=='function')return null;const result=await performance.measureUserAgentSpecificMemory();return mb(result?.bytes)}catch{return null}}
async function batterySnapshot(){try{if(!navigator.getBattery)return null;batteryObject=batteryObject||await navigator.getBattery();return{level:round(Number(batteryObject.level)*100,0),charging:Boolean(batteryObject.charging),chargingTime:Number.isFinite(batteryObject.chargingTime)?batteryObject.chargingTime:null,dischargingTime:Number.isFinite(batteryObject.dischargingTime)?batteryObject.dischargingTime:null}}catch{return null}}
async function webgpuSnapshot(){const result={available:false,shaderF16:false,gpu:''};if(!navigator.gpu?.requestAdapter)return result;try{const adapter=await navigator.gpu.requestAdapter();if(!adapter)return result;result.available=true;result.shaderF16=Boolean(adapter.features?.has?.('shader-f16'));const info=adapter.info||{};result.gpu=[info.vendor,info.architecture,info.device,info.description].filter(Boolean).join(' · ').slice(0,180)}catch{}return result}
async function releaseVersion(){try{const response=await fetch(`/app/manifest.webmanifest?device-lab=${Date.now()}`,{cache:'no-store'});if(!response.ok)return null;const manifest=await response.json();return String(manifest.name||'').match(/\bv(\d+\.\d+\.\d+)\b/i)?.[1]||null}catch{return null}}
async function storageSnapshot(){try{const estimate=await navigator.storage?.estimate?.();return{usageMb:mb(estimate?.usage),quotaMb:mb(estimate?.quota),availableMb:mb(Math.max(0,Number(estimate?.quota||0)-Number(estimate?.usage||0))),persisted:await navigator.storage?.persisted?.().catch?.(()=>null)??null}}catch{return{usageMb:null,quotaMb:null,availableMb:null,persisted:null}}}
async function captureDevice(){
  statusText('Capturing device capabilities…');
  const [gpu,storage,battery,memorySpecific,release]=await Promise.all([webgpuSnapshot(),storageSnapshot(),batterySnapshot(),specificMemoryMb(),releaseVersion()]);
  const nav=performance.getEntriesByType?.('navigation')?.[0];
  state.releaseVersion=release||state.releaseVersion;
  state.device={
    userAgent:navigator.userAgent,
    platform:navigator.userAgentData?.platform||navigator.platform||'',
    mobile:navigator.userAgentData?.mobile??globalThis.matchMedia?.('(pointer:coarse)')?.matches??false,
    deviceMemoryGb:Number(navigator.deviceMemory||0)||null,
    hardwareConcurrency:Number(navigator.hardwareConcurrency||0)||null,
    crossOriginIsolated:Boolean(globalThis.crossOriginIsolated),
    webgpu:gpu,
    screen:{width:screen.width,height:screen.height,pixelRatio:devicePixelRatio||1,colorDepth:screen.colorDepth||null},
    viewport:{width:innerWidth,height:innerHeight},
    pwa:pwaMode(),
    online:navigator.onLine,
    navigationType:nav?.type||null,
    storage,
    batteryApi:battery,
    measuredMemoryMb:memorySpecific,
    performanceMemorySupported:Boolean(performance?.memory?.usedJSHeapSize),
    userAgentSpecificMemorySupported:typeof performance.measureUserAgentSpecificMemory==='function'
  };
  if(memorySpecific!=null)metric('peakMemoryMb',Math.max(Number(state.measurements.peakMemoryMb||0),memorySpecific));
  heapSample();
  const startup=navigationStartupMs();
  if(navigator.onLine){metric('startupMs',startup);scenario('coldLaunchOnline','pass',`Physical online lab launch reached interactive state in ${startup} ms.`,{startupMs:startup,navigationType:nav?.type||null})}
  event('device-snapshot',{releaseVersion:state.releaseVersion,online:navigator.onLine});
  statusText('Device snapshot captured.');
}
async function waitForScripts(timeoutMs=10000){const started=Date.now();while(Date.now()-started<timeoutMs){if(registry()&&manager()&&runtime()&&pulse()&&router())return true;await delay(100)}return false}
async function miniLmCore(){
  progress('Cold-resetting MiniLM and measuring the first real semantic classification…');
  const r=router();if(!r)throw new Error('MiniLM context router is not loaded.');
  const adapter=await import('/app/models/all-minilm-l6-v2/adapter.js');
  const before=await adapter.status().catch(()=>({available:false}));
  if(!before?.available){scenario('warmMiniLmClassification','blocked','MiniLM package is not installed on this device. Install the highly recommended MiniLM package in AI settings first.');throw new Error('MiniLM package is not installed.');}
  await adapter.shutdown('low-end-device-lab-cold-reset').catch(()=>{});
  await delay(80);
  const coldStart=performance.now();
  const warmed=await r.warm();
  const first=await r.emotion('I am carefully comparing these options and thinking through the tradeoffs.',{system:'civweave',userText:'Please compare them.'});
  const coldMs=Math.round(performance.now()-coldStart);
  if(!warmed||first?.source!=='minilm')throw new Error('MiniLM did not produce a real classifier result after the cold reset.');
  metric('miniLmColdMs',coldMs);
  const warmStart=performance.now();
  const second=await r.emotion('This is excellent news and I am excited that the repair worked.',{system:'cerbanimo',userText:'Did it work?'});
  const warmMs=Math.round(performance.now()-warmStart);
  if(second?.source!=='minilm')throw new Error('MiniLM warm classification fell back to deterministic rules.');
  metric('miniLmWarmMs',warmMs);
  scenario('warmMiniLmClassification','pass',`MiniLM warm classification completed in ${warmMs} ms after a ${coldMs} ms cold-reset path.`,{coldMs,warmMs,first:first.primary,second:second.primary});
  progress('Proving MiniLM worker shutdown and recovery…');
  await adapter.shutdown('low-end-device-lab-worker-shutdown');
  const stopped=await adapter.status().catch(()=>({ready:false}));
  const recoveryStart=performance.now();
  const recovered=await r.emotion('I am curious what happens after the worker is released.',{system:'living-school',userText:'What happens next?'});
  const recoveryMs=Math.round(performance.now()-recoveryStart);
  if(recovered?.source!=='minilm')throw new Error('MiniLM did not recover after an explicit worker shutdown.');
  scenario('workerShutdown','pass',`MiniLM worker was explicitly released and semantic classification recovered in ${recoveryMs} ms.`,{reportedReadyAfterShutdown:Boolean(stopped?.ready),recoveryMs});
  return{coldMs,warmMs,recoveryMs};
}
async function modelStatus(){try{return await manager()?.status?.(MODEL_ID)}catch(error){return{available:false,error:String(error?.message||error)}}}
async function pollModelReady(timeoutMs=900000,onTick){const started=Date.now();while(Date.now()-started<timeoutMs){const status=await modelStatus();onTick?.(status);if(status?.available)return status;const s=String(status?.state?.status||'');if(['error','paused'].includes(s))return status;await delay(700)}return modelStatus()}
async function install135(){
  if(!await waitForScripts())throw new Error('Local AI scripts did not become ready.');
  const m=manager(),spec=registry()?.byId?.(MODEL_ID);if(!m||!spec)throw new Error('SmolLM2 135M registry/download manager is unavailable.');
  const current=await m.status(MODEL_ID);if(current.available){progress('SmolLM2 135M is already installed and verified.');return current}
  progress(`Installing ${spec.label}. This is an explicit ~${Math.round(Number(spec.estimatedBytes||0)/1e6)} MB download…`);
  await m.start(MODEL_ID,{preferBackground:false,onProgress:p=>{const pct=Math.max(0,Math.min(100,Number(p?.percent||0)));progress(`135M download ${pct.toFixed(0)}% · ${p?.phase||p?.status||'working'}${p?.artifact?` · ${p.artifact}`:''}`)}});
  const final=await pollModelReady(900000,s=>{const pct=Number(s?.state?.percent||0);progress(`135M package ${pct.toFixed(0)}% · ${s?.state?.status||'verifying'}…`)});
  if(!final?.available)throw new Error(final?.state?.error||'SmolLM2 135M did not finish installing.');
  progress('SmolLM2 135M package is installed and verified.');
  event('smollm135-installed',{bytes:registry()?.byId?.(MODEL_ID)?.estimatedBytes||null});
  return final;
}
async function smolGeneration(){
  const m=manager(),p=pulse();if(!m||!p)throw new Error('Local model test runtime is unavailable.');
  const installed=await m.status(MODEL_ID);if(!installed?.available){scenario('smolLm135mGeneration','blocked','SmolLM2 135M is not installed. Press Install / repair 135M model first.');return null}
  const original=m.selection?.()||{active:false,id:null};
  let firstTokenAt=null,started=performance.now(),stage='starting';startHeapSampling();
  try{
    m.select(MODEL_ID);
    progress('Running direct SmolLM2 135M health generation on this phone…');
    const result=await p.test(MODEL_ID,{onProgress:packet=>{stage=String(packet?.phase||stage);heapSample();progress(`135M · ${stage}${packet?.backend?` · ${packet.backend}`:''}`)},onToken:()=>{if(firstTokenAt==null)firstTokenAt=performance.now();heapSample()}});
    const elapsed=Math.round(performance.now()-started),metrics=result?.metrics||{},ttft=Number(metrics.ttftMs??(firstTokenAt==null?NaN:firstTokenAt-started)),tps=Number(metrics.tokensPerSecond||metrics.benchmarkTokensPerSecond||0),execution=String(result?.executionModel||result?.model||'');
    if(!result?.text||execution!==MODEL_ID||result.fallbackUsed)throw new Error(`135M test did not finish on the intended model (execution=${execution||'unknown'}, fallback=${Boolean(result?.fallbackUsed)}).`);
    if(Number.isFinite(ttft))metric('smolLm135mFirstTokenMs',Math.round(ttft));
    if(Number.isFinite(tps)&&tps>0)metric('smolLm135mTokensPerSecond',round(tps,2));
    if(Number(metrics.coldStartMs)>0)state.measurements.smolLm135mColdStartMs=Math.round(Number(metrics.coldStartMs));
    scenario('smolLm135mGeneration','pass',`Direct 135M generation completed in ${elapsed} ms${Number.isFinite(ttft)?` · TTFT ${Math.round(ttft)} ms`:''}${tps?` · ${tps.toFixed(2)} tok/s`:''}.`,{executionModel:execution,backend:result.backend||null,fallbackUsed:false,elapsedMs:elapsed,metrics});
    return result;
  }finally{
    stopHeapSampling();
    try{if(original?.active&&original.id)m.select(original.id);else m.select(null)}catch{}
  }
}
async function runCore(){
  const button=$('run-core');if(button)button.disabled=true;statusText('Running physical core checks…');startHeapSampling();
  try{
    if(!await waitForScripts())throw new Error('The local AI runtime did not finish loading.');
    await captureDevice();
    await miniLmCore();
    await smolGeneration();
    const specific=await specificMemoryMb();if(specific!=null)metric('peakMemoryMb',Math.max(Number(state.measurements.peakMemoryMb||0),specific));
    progress('Automated core checks finished. Complete the real restart/interruption and thermal checkpoints below.');
    statusText('Core physical checks finished.');
  }catch(error){progress(`Core check stopped: ${error?.message||error}`);statusText('A core physical check needs attention.');event('core-error',{message:String(error?.message||error)})}finally{stopHeapSampling();if(button)button.disabled=false;render()}
}
function armOffline(){state.checkpoints.offlineArmedAt=now();state.checkpoints.offlineRunId=state.runId;scenario('coldLaunchOffline','armed','Turn airplane mode on, fully close Civweave, then reopen this exact lab page.');scenario('fullyDisconnectedRelaunch','armed','Waiting for a real disconnected relaunch of this persisted run.');event('offline-relaunch-armed');statusText('Offline relaunch armed. Turn airplane mode on, fully close Civweave, then reopen this lab.')}
function armMemory(){state.checkpoints.memoryArmedAt=now();state.checkpoints.memoryHiddenAt=null;state.checkpoints.memoryReturnedAt=null;scenario('memoryPressureRecovery','armed','Background Civweave, use other apps to create realistic OS memory pressure, then return here.');$('confirm-memory').disabled=true;event('memory-pressure-armed');statusText('Memory-pressure return armed.')}
function confirmMemory(){if(!state.checkpoints.memoryReturnedAt){statusText('The lab has not observed a background/foreground return yet.');return}scenario('memoryPressureRecovery','pass','User confirmed this same persisted run returned after real OS memory pressure without reinstalling.',{armedAt:state.checkpoints.memoryArmedAt,hiddenAt:state.checkpoints.memoryHiddenAt,returnedAt:state.checkpoints.memoryReturnedAt,attested:true});event('memory-pressure-confirmed');$('confirm-memory').disabled=true}
async function armInterruptedDownload(){
  if(!await waitForScripts())return;
  const m=manager(),current=await m.status(MODEL_ID);
  if(current.available){scenario('interruptedModelDownloadRecovery','blocked','The 135M model is already complete. Run this checkpoint on a fresh device/download, or deliberately remove the model from AI settings first. The lab will not delete a working package automatically.');statusText('Interrupted-download checkpoint needs a fresh/incomplete model download.');return}
  state.checkpoints.downloadInterruption={armedAt:now(),observed:false,resumed:false};scenario('interruptedModelDownloadRecovery','armed','Foreground 135M download started. Wait for visible progress, then fully close Civweave before it finishes and reopen this lab.');
  await m.start(MODEL_ID,{preferBackground:false,onProgress:p=>{const percent=Number(p?.percent||0);state.checkpoints.downloadInterruption.lastPercent=percent;state.checkpoints.downloadInterruption.lastPhase=p?.phase||p?.status||'';save();progress(`Interruption checkpoint: download ${percent.toFixed(0)}%. Fully close Civweave before it reaches 100%.`)}});
  event('download-interruption-armed');
}
async function detectInterruptedDownload(){
  const checkpoint=state.checkpoints.downloadInterruption;if(!checkpoint?.armedAt||checkpoint.resumed)return;
  if(!await waitForScripts(5000))return;
  try{await manager()?.sync?.()}catch{}
  const current=await modelStatus(),status=String(current?.state?.status||'');
  if(current?.available&&!checkpoint.observed){scenario('interruptedModelDownloadRecovery','fail','The download finished before the app was interrupted, so this did not exercise interruption recovery.');return}
  if(['paused','error','downloading','finalizing'].includes(status)&&!current?.available){checkpoint.observed=true;checkpoint.observedAt=now();checkpoint.returnState=status;save();scenario('interruptedModelDownloadRecovery','running',`Interrupted/incomplete model state survived relaunch as “${status}”. Resume it to prove recovery without reinstalling.`);$('resume-download').disabled=false;event('download-interruption-observed',{status})}
}
async function resumeInterruptedDownload(){
  const checkpoint=state.checkpoints.downloadInterruption;if(!checkpoint?.observed){statusText('No interrupted model download has been observed yet.');return}
  $('resume-download').disabled=true;try{const final=await install135();if(!final?.available)throw new Error('Resume did not complete the model package.');checkpoint.resumed=true;checkpoint.resumedAt=now();save();scenario('interruptedModelDownloadRecovery','pass','An actually interrupted 135M download resumed from device state and completed without reinstalling Civweave.',{armedAt:checkpoint.armedAt,observedAt:checkpoint.observedAt,resumedAt:checkpoint.resumedAt,lastPercentBeforeInterruption:checkpoint.lastPercent??null});event('download-interruption-recovered')}catch(error){scenario('interruptedModelDownloadRecovery','fail',String(error?.message||error));$('resume-download').disabled=false}}
async function recordThermal(){
  const start=Number($('battery-start').value),end=Number($('battery-end').value),thermal=$('thermal').value,minutes=Number($('observation-minutes').value),manualPeak=Number($('manual-peak-memory').value),notes=$('physical-notes').value.trim(),battery=await batterySnapshot();
  if(!thermal||!Number.isFinite(minutes)||minutes<=0||(!Number.isFinite(start)&&!Number.isFinite(end)&&!battery)){statusText('Record an observation duration, thermal result, and battery reading (manual or browser-provided).');return}
  const startValue=Number.isFinite(start)?start:(state.physical.batteryStartPercent??battery?.level??null),endValue=Number.isFinite(end)?end:(battery?.level??null);
  if(Number.isFinite(manualPeak)&&manualPeak>0){state.measurements.peakMemoryMb=Math.max(Number(state.measurements.peakMemoryMb||0),manualPeak);state.physical.manualPeakMemoryMb=manualPeak;state.physical.memoryMeasurementSource='manual-os-observation';}
  state.physical={...state.physical,batteryStartPercent:startValue,batteryEndPercent:endValue,batteryApi:battery,thermal,observationMinutes:minutes,notes,batteryDropPercent:Number.isFinite(startValue)&&Number.isFinite(endValue)?round(startValue-endValue,1):null};
  const pass=!['throttled','shutdown'].includes(thermal);
  scenario('thermalAndBatteryObservation',pass?'pass':'fail',pass?`Physical observation completed for ${minutes} minutes with thermal state “${thermal}”.`:`Physical run reported ${thermal}; this device does not satisfy the launch thermal-performance gate.`,{...state.physical});event('thermal-battery-recorded',{thermal,minutes});
}
function measurementComplete(id){return Number.isFinite(Number(state.measurements[id]))}
function evaluate(){const missingScenarios=REQUIRED_EVIDENCE.filter(id=>state.scenarios[id]?.status!=='pass'),missingMeasurements=REQUIRED_MEASUREMENTS.filter(id=>!measurementComplete(id));state.status=missingScenarios.length||missingMeasurements.length?'blocked':'pass';return{missingScenarios,missingMeasurements}}
async function hashedEvidence(){const copy=JSON.parse(JSON.stringify(state));copy.evidenceHash=null;copy.status=evaluate().missingScenarios.length||evaluate().missingMeasurements.length?'blocked':'pass';copy.updatedAt=now();const canonical=JSON.stringify(copy);let hash=null;try{const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical));hash=[...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('')}catch{}return{...copy,evidenceHash:hash?{algorithm:'SHA-256',value:hash}:null}}
async function exportEvidence(){const record=await hashedEvidence(),blob=new Blob([`${JSON.stringify(record,null,2)}\n`],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`civweave-low-end-device-evidence-${record.runId}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);statusText(`Evidence exported · ${record.status}.`)}
async function copyEvidence(){const record=await hashedEvidence(),text=JSON.stringify(record,null,2);try{await navigator.clipboard.writeText(text);statusText('Evidence JSON copied.')}catch{statusText('Clipboard write was unavailable. Use Export evidence JSON instead.')}}
function resetEvidence(){if(!confirm('Reset this physical test run? Downloaded models are not removed.'))return;localStorage.removeItem(KEY);state=fresh();heapPeakBytes=0;save();location.reload()}
function scenarioLabel(id){return({coldLaunchOnline:'Cold launch · online',coldLaunchOffline:'Cold launch · offline',warmMiniLmClassification:'MiniLM cold/warm classification',smolLm135mGeneration:'SmolLM2 135M generation',memoryPressureRecovery:'Memory-pressure recovery',workerShutdown:'Worker shutdown / recovery',interruptedModelDownloadRecovery:'Interrupted model download',fullyDisconnectedRelaunch:'Fully disconnected relaunch',thermalAndBatteryObservation:'Thermal & battery observation'})[id]||id}
function metricLabel(id){return({startupMs:'Online startup',startupOfflineMs:'Offline startup',miniLmColdMs:'MiniLM cold',miniLmWarmMs:'MiniLM warm',smolLm135mFirstTokenMs:'135M first token',smolLm135mTokensPerSecond:'135M decode',smolLm135mColdStartMs:'135M cold load',peakMemoryMb:'Peak / measured memory'})[id]||id}
function metricValue(id,value){if(value==null)return'not measured';if(id.includes('TokensPerSecond'))return`${Number(value).toFixed(2)} tok/s`;if(id.toLowerCase().includes('memory'))return`${Number(value).toFixed(1)} MB`;return`${Math.round(Number(value))} ms`}
function render(){
  evaluate();
  const dg=$('device-grid');if(dg){const d=state.device||{},rows=[['Release',state.releaseVersion||'unknown'],['Run',state.runId],['Online',String(navigator.onLine)],['PWA',String(d.pwa??pwaMode())],['Memory class',d.deviceMemoryGb?`${d.deviceMemoryGb} GB`:'not exposed'],['CPU lanes',d.hardwareConcurrency||navigator.hardwareConcurrency||'?'],['WebGPU',d.webgpu?.available==null?'not probed':d.webgpu.available?'yes':'no'],['Isolation',String(d.crossOriginIsolated??globalThis.crossOriginIsolated)],['Storage free',d.storage?.availableMb!=null?`${d.storage.availableMb} MB`:'not probed'],['Memory API',d.userAgentSpecificMemorySupported?'specific-memory':d.performanceMemorySupported?'JS heap':'manual fallback']];dg.innerHTML=rows.map(([k,v])=>`<div class="metric"><b>${escapeHtml(k)}</b><small>${escapeHtml(v)}</small></div>`).join('')}
  const mg=$('metric-grid');if(mg){const entries=Object.entries(state.measurements||{});mg.innerHTML=(entries.length?entries:[['startupMs',null],['miniLmColdMs',null],['miniLmWarmMs',null],['smolLm135mFirstTokenMs',null],['smolLm135mTokensPerSecond',null],['peakMemoryMb',null]]).map(([id,v])=>`<div class="metric"><b>${escapeHtml(metricLabel(id))}</b><small>${escapeHtml(metricValue(id,v))}</small></div>`).join('')}
  const sg=$('scenario-grid');if(sg)sg.innerHTML=REQUIRED_EVIDENCE.map(id=>{const row=state.scenarios[id]||{};return`<div class="scenario" data-state="${escapeHtml(row.status||'blocked')}"><b>${escapeHtml(scenarioLabel(id))}</b><small>${escapeHtml(row.status||'blocked')} · ${escapeHtml(row.detail||'')}</small></div>`}).join('');
  const evaluation=evaluate(),summary=$('gate-summary');if(summary)summary.textContent=state.status==='pass'?'Physical low-end device matrix is complete on this run. Export the evidence JSON and attach it to the launch evidence record.':`Physical gate still blocked · ${evaluation.missingScenarios.length} scenario(s) and ${evaluation.missingMeasurements.length} measurement(s) remain.`;
  const preview=$('evidence-preview');if(preview)preview.textContent=JSON.stringify({...state,evidenceHash:'computed on export'},null,2);
  if($('confirm-memory'))$('confirm-memory').disabled=!state.checkpoints.memoryReturnedAt||state.scenarios.memoryPressureRecovery?.status==='pass';
  if($('resume-download'))$('resume-download').disabled=!state.checkpoints.downloadInterruption?.observed||state.checkpoints.downloadInterruption?.resumed;
}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
async function handleStartup(){
  startHeapSampling();
  const startup=navigationStartupMs();
  if(!navigator.onLine&&state.checkpoints.offlineArmedAt&&state.checkpoints.offlineRunId===state.runId){state.measurements.startupOfflineMs=startup;scenario('coldLaunchOffline','pass',`Lab relaunched while navigator.onLine=false in ${startup} ms.`,{startupMs:startup,serviceWorkerControlled:Boolean(navigator.serviceWorker?.controller)});scenario('fullyDisconnectedRelaunch','pass','The same persisted physical run relaunched with the device offline and no reinstall.',{runId:state.runId,serviceWorkerControlled:Boolean(navigator.serviceWorker?.controller)});event('offline-relaunch-observed',{startupMs:startup})}
  const battery=await batterySnapshot();if(battery?.level!=null&&state.physical.batteryStartPercent==null){state.physical.batteryStartPercent=battery.level;if($('battery-start'))$('battery-start').value=String(battery.level);save()}
  await captureDevice();
  await detectInterruptedDownload();
  statusText(navigator.onLine?'Physical lab ready.':'Physical lab running offline.');
}
document.addEventListener('visibilitychange',()=>{if(!state.checkpoints.memoryArmedAt||state.scenarios.memoryPressureRecovery?.status==='pass')return;if(document.visibilityState==='hidden'){state.checkpoints.memoryHiddenAt=now();event('memory-pressure-backgrounded')}else if(state.checkpoints.memoryHiddenAt){state.checkpoints.memoryReturnedAt=now();event('memory-pressure-returned');scenario('memoryPressureRecovery','running','This same run returned from background. Confirm only if you actually created realistic device memory pressure while Civweave was away.');$('confirm-memory').disabled=false}});
addEventListener('pagehide',()=>{stopHeapSampling();heapSample()});
$('capture-device')?.addEventListener('click',()=>void captureDevice());
$('run-core')?.addEventListener('click',()=>void runCore());
$('prepare-135')?.addEventListener('click',()=>void install135().catch(error=>{progress(`135M install/repair stopped: ${error?.message||error}`);event('smollm135-install-error',{message:String(error?.message||error)})}));
$('arm-offline')?.addEventListener('click',armOffline);
$('arm-memory')?.addEventListener('click',armMemory);
$('confirm-memory')?.addEventListener('click',confirmMemory);
$('arm-download')?.addEventListener('click',()=>void armInterruptedDownload().catch(error=>scenario('interruptedModelDownloadRecovery','fail',String(error?.message||error))));
$('resume-download')?.addEventListener('click',()=>void resumeInterruptedDownload());
$('record-thermal')?.addEventListener('click',()=>void recordThermal());
$('export-evidence')?.addEventListener('click',()=>void exportEvidence());
$('copy-evidence')?.addEventListener('click',()=>void copyEvidence());
$('reset-evidence')?.addEventListener('click',resetEvidence);
render();
void handleStartup().catch(error=>{statusText(`Lab startup warning: ${error?.message||error}`);event('startup-warning',{message:String(error?.message||error)})});
globalThis.CivweaveLowEndDeviceLabV1=Object.freeze({version:VERSION,schema:SCHEMA,modelId:MODEL_ID,requiredEvidence:REQUIRED_EVIDENCE,requiredMeasurements:REQUIRED_MEASUREMENTS,evidence:()=>JSON.parse(JSON.stringify(state)),evaluate,runCore,captureDevice,install135,exportEvidence,physicalEvidenceRequired:true,syntheticEvidenceAccepted:false});
})();
