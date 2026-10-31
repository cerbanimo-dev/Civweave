(()=>{
'use strict';
// Provider-neutral agent loop: each reply proposes one tool call. The editor saves
// that call and returns its authoritative revisioned status to the next turn.
let running=false,stopRequested=false,lastResult=null,activeController=null;
const node=id=>document.getElementById(id);
const text=(v,max=2000)=>String(v??'').slice(0,max);
function status(message,bad=false){
  const target=node('cs-agent-status');
  if(target){target.textContent=message;target.className='cs-status'+(bad?' cs-bad':'');}
}
function parse(result){
  if(result?.outputJson&&typeof result.outputJson==='object'&&!Array.isArray(result.outputJson))return result.outputJson;
  let raw=text(result?.outputText||result?.text||result?.output||'',120000).trim();
  raw=raw.replace(/^(?:\x60{3}|~{3})(?:json)?\s*/i,'').replace(/\s*(?:\x60{3}|~{3})$/,'');
  try{return JSON.parse(raw);}catch{}
  const start=raw.indexOf('{'),end=raw.lastIndexOf('}');
  if(start>=0&&end>start)try{return JSON.parse(raw.slice(start,end+1));}catch{}
  throw new Error('The model did not return a valid tool instruction. Saved edits are unchanged.');
}
function smallModel(model){
  const name=text(model,240).toLowerCase();
  return /(?:^|[^0-9])(?:0\.\d+|1(?:\.5)?|2|3|4|5|6|7)b(?:[^a-z]|$)/.test(name)||/\be[24]b\b/.test(name);
}
function config(){
  const runtime=globalThis.CivweaveModelRuntime;
  if(!runtime?.generate)throw new Error('The Civweave model runtime is unavailable. Configure an inference provider in Civweave AI settings.');
  const value=runtime.readSharedConfig?.('agentic')||runtime.readSharedConfig?.('interactive');
  if(!value?.provider||value.provider==='deterministic'||value.provider==='manual')
    throw new Error('Select a local or cloud inference provider in Civweave AI settings first.');
  return{runtime,value};
}
function nativeTermux(config){
  return config.provider==='openai-compatible'&&config.model==='qwen35-4b-native'
    &&String(config.endpoint||'').replace(/\/$/,'')==='http://127.0.0.1:8080/v1';
}
function stepPrompt(objective,toolState,maxEdits,native=false){
  if(native)return [
    'Edit a saved document ONE small block at a time, using JSON tool calls.',
    'Output exactly one complete JSON object, no markdown or analysis.',
    'Edit: {"type":"edit","edits":[{"op":"append","block":{"type":"paragraph","text":"A short finished paragraph."}}]}.',
    'Other valid tool calls: {"type":"inspect","start":0,"limit":5}, or {"type":"done","note":"complete"}.',
    'Block types: heading (level 1-6), paragraph, bullet, numbered, quote, code, divider, table, caption.',
    'You may also use setTitle, replaceBlock, deleteBlock, insertAfter, setGoal, setStatus.',
    'Return one useful block with at most 75 words per call; next call gets the saved revision.',
    'Do not repeat existing content. Do not claim publication or execution.',
    'Document objective: '+text(objective,1000),
    'Current document status and previous tool result: '+text(JSON.stringify(toolState),1600)
  ].join('\n');
  return [
    'You edit a persistent document by calling a tool. DO NOT output the whole document.',
    'Return ONLY a JSON object using ONE shape:',
    '{"type":"edit","edits":[{"op":"setTitle","title":"..."},{"op":"append","block":{"type":"heading","level":1,"text":"..."}}],"note":"optional progress"}',
    '{"type":"inspect","start":0,"limit":20} to read existing blocks by id before revising.',
    '{"type":"done","note":"what is complete"}.',
    'Valid edits: append, insertAfter (afterId plus block), replaceBlock (blockId plus block), deleteBlock (blockId), moveBlock (blockId and afterId), setTitle, setGoal, setStatus (draft/review/ready), replaceAll (blocks array).',
    'Block types: heading (level 1-6), paragraph, bullet, numbered, quote, code, divider, table, caption.',
    'Maximum edits this turn: '+maxEdits+'. Make substantive progress; each edit must stand alone.',
    'Write actual prose inside each block. The host saves and returns the document state next turn.',
    'Do not repeat existing content or request publishing, sharing, or finalizing.',
    'Only choose done when the objective is complete.',
    'Objective: '+objective,
    'Saved document state and previous tool result: '+JSON.stringify(toolState)
  ].join('\n');
}
async function run({objective='',steps=12,tier='auto'}={}){
  if(running)throw new Error('Document agent is already running.');
  const chosen=text(objective||node('cs-agent-objective')?.value||'',3000).trim();
  if(!chosen)throw new Error('Describe what the document should contain.');
  const {runtime,value}=config(),agent=globalThis.CivweaveCreatorTextV1,tools=globalThis.CivweaveCreatorToolsV1;
  const [{runCodeInference,resolveCodeInferenceRoute},loaders]=await Promise.all([
    import('/creator-suite/shared/code-inference-route-v1.mjs'),
    import('/creator-suite/shared/creator-inference-loaders-v1.mjs')
  ]);
  const selectedModel=loaders.currentCreatorLocalSelection();
  const route=resolveCodeInferenceRoute(value,selectedModel);
  const native=nativeTermux(value);
  if(!agent?.getDocumentStatus||!tools?.execute)throw new Error('Structured document editor is not ready.');
  const profile=tier==='auto'?(smallModel(value.model)?'small':'large'):tier;
  if(!['small','large'].includes(profile))throw new Error('Invalid model edit tier.');
  const limit=profile==='small'?3:64,total=Math.max(1,Math.min(40,Math.round(Number(steps)||12)));
  running=true;stopRequested=false;lastResult=null;
  const controller=new AbortController();activeController=controller;
  const button=node('cs-agent-run');if(button)button.disabled=true;
  const editor=node('cs-text-editor'),priorEditable=editor?.getAttribute('contenteditable');
  if(editor)editor.setAttribute('contenteditable','false');
  const activeSessionId=agent.getSession()?.id;
  let toolState={status:agent.getDocumentStatus()},completed=false,calls=0;
  try{
    await agent.flush();
    toolState={status:agent.getDocumentStatus()};
    for(let i=0;i<total&&!stopRequested;i++){
      if(agent.getSession()?.id!==activeSessionId)throw new Error('Active document changed; agent stopped before writing to another document.');
      const readRevision=agent.getDocumentStatus().revision;
      calls=i+1;status('Document AI · '+(i+1)+'/'+total+' · '+profile+' model · up to '+limit+' edits/call');
      const response=await runCodeInference(value,[
        {role:'system',content:'You are a document editing tool planner. Reply only with one complete JSON object.'},
        {role:'user',content:stepPrompt(chosen,toolState,limit,native)}
      ],{
        selection:selectedModel,loadLocal:loaders.loadCreatorLocalRuntime,loadServer:loaders.loadCreatorServerRuntime,
        sharedRuntime:runtime,signal:controller.signal,purpose:'creator-document-agent-v1',mediaType:'text',
        taskTier:'complex',requiresTools:true,maxTokens:native?512:Math.max(1400,Math.min(Number(value.maxTokens)||8192,32768)),
        context:{documentSessionId:agent.getSession()?.id,taskTier:profile},
        onProgress:e=>status('Document AI · '+calls+'/'+total+' · '+route.provider+' · '+text(e?.phase||e?.stage||'working',70)),
        onToken:fragment=>status('Document AI · '+calls+'/'+total+' · receiving text · '+text(typeof fragment==='string'?fragment:fragment?.text||'',100))
      });
      if(stopRequested||controller.signal.aborted)break;
      if(response?.status!=='success'||(response?.fallback?.used&&response?.fallback?.provider==='deterministic'))
        throw new Error('Inference stopped: '+text(response?.error?.message||response?.status||'unknown error',500));
      if(stopRequested)break;
      if(agent.getSession()?.id!==activeSessionId)throw new Error('Active document changed while the model was thinking; no edit was applied.');
      const instruction=parse(response),kind=text(instruction.type,50);
      if(kind==='done'){completed=true;lastResult={status:agent.getDocumentStatus(),done:true,note:text(instruction.note,400)};break;}
      const actual=response.actual||{},provider=text(actual.provider||value.provider,120),model=text(actual.model||value.model,240);
      if(kind==='inspect'){
        toolState=await tools.execute({kind:'text',action:'document.inspect',actorId:'creator-document-agent',
          provider,model,requestId:crypto.randomUUID(),args:{start:instruction.start,limit:instruction.limit}});
      }else if(kind==='edit'){
        if(!Array.isArray(instruction.edits)||!instruction.edits.length||instruction.edits.length>limit)
          throw new Error('Model proposed an invalid batch: expected 1 to '+limit+' edits.');
        toolState=await tools.execute({kind:'text',action:'document.apply',actorId:'creator-document-agent',
          provider,model,requestId:crypto.randomUUID(),args:{expectedRevision:readRevision,edits:instruction.edits,
            taskTier:profile,batchId:crypto.randomUUID()}});
      }else throw new Error('Model must choose edit, inspect, or done.');
      lastResult={status:agent.getDocumentStatus(),done:false,note:text(instruction.note,400)};
      dispatchEvent(new CustomEvent('creator-suite:document-agent-step',{detail:{step:i+1,kind,status:lastResult.status}}));
    }
    const state=agent.getDocumentStatus();
    status(stopRequested?'Stopped after '+calls+' model calls. All accepted edits are saved.':
      completed?'Document complete · revision '+state.revision+' · '+state.wordCount+' words.':
        'Stopped at '+total+' model calls · revision '+state.revision+'. Continue to extend the draft.');
    return{completed,stopped:stopRequested,calls,status:state};
  }catch(error){if(controller.signal.aborted){status('Browser generation cancelled. Saved document edits are preserved; confirm the Termux slot is idle before retrying.');return{stopped:true,calls};}status(error.message||String(error),true);throw error;}
  finally{if(activeController===controller)activeController=null;running=false;if(button)button.disabled=false;if(editor)editor.setAttribute('contenteditable',priorEditable??'true');}
}
async function inspectServer(){
  const module=await import('/creator-suite/shared/native-server-control-v1.mjs');
  const value=config().value;
  const output=node('cs-agent-server-status');
  if(!module.isCreatorNativeTermux(value)){if(output)output.textContent='Current model is not direct Termux Qwen.';return;}
  if(output)output.textContent='Checking llama-server inference slots…';
  const [slots,companion]=await Promise.all([module.inspectNativeSlots(),module.inspectCreatorCompanion()]);
  if(output)output.textContent=slots.detail+'\\n'+companion.detail+
    (slots.state==='busy'?'\\nDo not queue another request. Browser cancellation may not have stopped the old generation.':'');
}
async function restartServer(){
  const module=await import('/creator-suite/shared/native-server-control-v1.mjs');
  if(!module.isCreatorNativeTermux(config().value))throw new Error('Termux native model is not selected.');
  const companion=await module.inspectCreatorCompanion();
  const output=node('cs-agent-server-status');
  if(companion.state!=='managed'){if(output)output.textContent='No restart sent. '+companion.detail;return;}
  if(!window.confirm('Restart the Companion-managed Qwen server? This interrupts ALL active chat, document and code generations. Saved local edits remain.'))return;
  const result=await module.restartCreatorNativeServer();
  if(output)output.textContent=result.detail+'\\nJob '+result.jobId+'. Check slots again after model reload.';
}
function stop(){
  stopRequested=true;
  activeController?.abort(new DOMException('Document generation stopped by user','AbortError'));
  status('Browser generation cancelled; saved edits preserved. Checking whether Termux is still processing…');
  void inspectServer().catch(error=>{const output=node('cs-agent-server-status');if(output)output.textContent=String(error.message||error);});
}
function init(){
  node('cs-agent-run')?.addEventListener('click',()=>{
    run({objective:node('cs-agent-objective')?.value,steps:node('cs-agent-steps')?.value,
      tier:node('cs-agent-tier')?.value}).catch(error=>console.warn('Document AI:',error.message));
  });
  node('cs-agent-stop')?.addEventListener('click',stop);
  node('cs-agent-server-check')?.addEventListener('click',()=>inspectServer().catch(error=>status(error.message,true)));
  node('cs-agent-server-restart')?.addEventListener('click',()=>restartServer().catch(error=>status(error.message,true)));
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
globalThis.CivweaveCreatorDocumentAgentV1=Object.freeze({run,stop,isRunning:()=>running,getLastResult:()=>lastResult,smallModel,stepPrompt,stageContractRevision:'document-agent-v1-creation-contract-v1'});
})();
