(()=>{
'use strict';

const VERSION='1.1.0-generation-failure-inspector-v1-all-stage-raw';
const ROOT_ID='cw-persistent-guide-chat-v215';
const STYLE_ID='cw-generation-failure-inspector-v1-style';
const MAX_AGE_MS=20*60*1000;
const RECORD_KEY='civweave.local-generation-failure.v1';
const FAILURE=/\b(?:could not|couldn't|failed|failure|invalid|did not satisfy|did not pass|rejected|retry|not generated|not saved|unable to)\b/i;
const INVALID_CODES=new Set(['INVALID_STRUCTURED_OUTPUT','INVALID_JSON','CIVWEAVE_E4B_WEAVE_COMPILE_INVALID']);
let runtimeTarget=null;
let scheduled=false;
let latestRecord=null;
const pipelineState=new Map();
const clean=(value,max=30000)=>String(value??'').trim().slice(0,max);
function visibleOutput(value){
  let text=clean(value,48000);
  text=text.replace(/<(?:think|analysis|reasoning)>[\s\S]*?<\/(?:think|analysis|reasoning)>/gi,'').replace(/<(?:think|analysis|reasoning)>[\s\S]*$/gi,'').trim();
  return clean(text,30000);
}
function emit(phase,detail={}){try{dispatchEvent(new CustomEvent('civweave:generation-failure-inspector',{detail:{version:VERSION,phase,at:new Date().toISOString(),...detail}}))}catch{}}
function record(input={}){
  const outputText=visibleOutput(input.outputText??input.text??'');
  latestRecord={
    id:`reject-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`,
    atMs:Date.now(),outputText,empty:!outputText,
    errors:Array.isArray(input.errors)?input.errors.map(item=>clean(item,1200)).filter(Boolean).slice(0,24):[],
    code:clean(input.code,160),purpose:clean(input.purpose,180),stage:clean(input.stage,120),
    model:clean(input.model||input.executionModel||'',160),
    message:clean(input.message||input.error||'',1200),
    rawDiagnostics:input.rawDiagnostics&&typeof input.rawDiagnostics==='object'?JSON.parse(JSON.stringify(input.rawDiagnostics)):null,
    source:clean(input.source,120)||'structured-validation'
  };
  try{localStorage.setItem(RECORD_KEY,JSON.stringify(latestRecord))}catch{}
  emit('recorded',{id:latestRecord.id,code:latestRecord.code,purpose:latestRecord.purpose,stage:latestRecord.stage,model:latestRecord.model,outputLength:outputText.length,errorCount:latestRecord.errors.length});
  return latestRecord;
}
function captureError(error,request={}){
  const result=error?.result||{},structured=result?.structured||{};
  const outputText=result?.outputText||error?.recoverableText||error?.rejectedText||'';
  const invalid=Boolean(outputText)&&(INVALID_CODES.has(clean(error?.code,160))||result?.status==='invalid-response'||structured?.valid===false||Array.isArray(error?.validationErrors));
  if(!invalid&&!error?.rejectedText&&!error?.executionModel)return null;
  return record({outputText,errors:error?.validationErrors||structured?.errors||[],code:error?.code||result?.error?.code,purpose:request?.purpose,stage:'runtime-validation',model:error?.executionModel,message:error?.message,rawDiagnostics:error?.rawDiagnostics,source:'model-runtime'});
}
function installRuntime(){
  const runtime=globalThis.CivweaveModelRuntime,current=runtime?.generate;
  if(!runtime||typeof current!=='function')return false;
  if(current.__civweaveGenerationFailureInspectorV1===VERSION){runtimeTarget=runtime;return true}
  const prior=current;
  const generate=async request=>{try{return await prior.call(runtime,request)}catch(error){captureError(error,request||{});throw error}};
  for(const key of Object.keys(current))try{generate[key]=current[key]}catch{}
  generate.__civweaveGenerationFailureInspectorV1=VERSION;
  generate.__prior=current;
  try{runtime.generate=generate;if(runtime.generate===generate){runtimeTarget=runtime;return true}}catch{}
  try{globalThis.CivweaveModelRuntime={...runtime,generate};runtimeTarget=globalThis.CivweaveModelRuntime;return runtimeTarget?.generate===generate}catch{return false}
}
function onPipeline(event){
  const detail=event?.detail||{},id=clean(detail.pipelineId,180);if(!id)return;
  const state=pipelineState.get(id)||{text:'',errors:[],purpose:clean(detail.purpose,180),stage:'',model:detail.model||'',message:''};
  if(['draft','compile','repair'].includes(detail.phase)){
    if(detail.token)state.text=clean(state.text+detail.token,48000);
    if(detail.text)state.text=clean(detail.text,48000);
    state.stage=detail.phase;
  }
  if(detail.phase==='validate'&&Array.isArray(detail.errors)&&detail.errors.length)state.errors=detail.errors.map(item=>clean(item,1200)).filter(Boolean).slice(0,24);
  pipelineState.set(id,state);
  if(detail.phase==='pipeline'&&detail.state==='failed'){
    record({outputText:state.text,errors:state.errors,code:detail.code,purpose:detail.purpose||state.purpose,stage:state.stage||'draft',model:detail.model||state.model,message:detail.message,source:'weave-pipeline'});
    pipelineState.delete(id);
  }else if(detail.phase==='pipeline'&&['complete','stopped'].includes(detail.state))pipelineState.delete(id);
}
function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
#${ROOT_ID} .cw-failing-message-inspector{margin-top:8px;padding-top:8px;border-top:1px solid #ffffff18}
#${ROOT_ID} .cw-failing-message-button{border:1px solid color-mix(in srgb,var(--guide-accent,#d8dde7) 52%,transparent);border-radius:999px;background:#ffffff0b;color:#eef6ff;padding:6px 9px;font:800 10px/1 system-ui;cursor:pointer}
#${ROOT_ID} .cw-failing-message-detail{margin-top:7px;padding:8px;border:1px solid #ffffff16;border-radius:10px;background:#0007}
#${ROOT_ID} .cw-failing-message-detail[hidden]{display:none!important}
#${ROOT_ID} .cw-failing-message-errors{margin:0 0 6px;color:#ffc7c7;font:10px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap}
#${ROOT_ID} .cw-failing-message-output{max-height:220px;overflow:auto;margin:0;color:#cfe7ff;font:10px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere}
`;
  document.head?.append(style);
}
function latestAssistant(thread){const rows=Array.isArray(thread?.messages)?thread.messages:[];for(let i=rows.length-1;i>=0;i-=1)if(rows[i]?.role==='assistant')return rows[i];return null}
function recentRecord(){
  if(!latestRecord)try{latestRecord=JSON.parse(localStorage.getItem(RECORD_KEY)||'null')}catch{}
  return latestRecord&&Date.now()-latestRecord.atMs<=MAX_AGE_MS?latestRecord:null;
}
function renderFor(row){
  const rec=recentRecord();if(!rec||row?.pending||!FAILURE.test(clean(row?.text,6000)))return false;
  const root=document.getElementById(ROOT_ID);if(!root)return false;
  const article=[...root.querySelectorAll('article[data-role="assistant"]')].at(-1);if(!article)return false;
  const host=article.children?.[1]||article;
  let panel=host.querySelector?.(':scope > .cw-failing-message-inspector');
  if(panel?.dataset?.failureId===rec.id)return true;
  panel?.remove?.();installStyle();panel=document.createElement('div');panel.className='cw-failing-message-inspector';panel.dataset.failureId=rec.id;
  const button=document.createElement('button');button.type='button';button.className='cw-failing-message-button';button.textContent='Show failing message';
  const detail=document.createElement('div');detail.className='cw-failing-message-detail';detail.hidden=true;
  const diagnostics=document.createElement('pre');diagnostics.className='cw-failing-message-errors';
  diagnostics.textContent=[rec.model?'Executed: '+rec.model:'',rec.stage?'Stage: '+rec.stage:'',rec.code?'Code: '+rec.code:'',rec.message?'Error: '+rec.message:'',...(rec.errors||[]).map(item=>'Validation: '+item),rec.rawDiagnostics?'Runtime diagnostics: '+JSON.stringify(rec.rawDiagnostics):''].filter(Boolean).join('\n');
  if(diagnostics.textContent)detail.append(diagnostics);
  const output=document.createElement('pre');output.className='cw-failing-message-output';
  output.textContent=rec.outputText||'No visible response text was emitted by this model stage (0 output characters). There is no rejected text to display.';
  detail.append(output);
  button.addEventListener('click',()=>{detail.hidden=!detail.hidden;button.textContent=detail.hidden?'Show failing message':'Hide failing message'});
  panel.append(button,detail);host.append(panel);return true;
}
function onThreadChanged(event){
  const row=latestAssistant(event?.detail?.thread);if(!row||row.pending)return;
  let tries=0;const attempt=()=>{tries+=1;if(!renderFor(row)&&tries<10)setTimeout(attempt,30)};setTimeout(attempt,0);
}
function install(){installRuntime();installStyle();return true}
function schedule(reason='event'){if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;install();emit('installed',{reason,runtime:Boolean(runtimeTarget)})})}
addEventListener?.('civweave:weave-pipeline',onPipeline);
addEventListener?.('civweave:weaveling-intake-progress',event=>{
  const d=event?.detail||{};
  if(d.phase!=='failed')return;
  record({outputText:d.outputText||'',model:d.model,stage:'intake',code:d.code,message:d.error,rawDiagnostics:d.rawDiagnostics,source:'e4b-intake'});
});
addEventListener?.('civweave:realm-guide-thread-changed',onThreadChanged);
for(const name of ['civweave:assistant-runtime-ready','civweave:gemma4-litert-first-request-ready','civweave:guide-loader-reset','civweave:guide-chat-ready','pageshow'])addEventListener?.(name,()=>schedule(name));
for(const delay of [0,100,400,1200,3000,7000,15000])setTimeout(()=>schedule(`timer-${delay}`),delay);

globalThis.CivweaveGenerationFailureInspectorV1=Object.freeze({version:VERSION,record,captureError,visibleOutput,installRuntime,install,schedule,latest:()=>latestRecord,showFailingMessage:true,privateReasoningExposed:false});
schedule('startup');
})();
