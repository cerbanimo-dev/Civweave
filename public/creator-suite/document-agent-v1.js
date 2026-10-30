(()=>{
'use strict';
// Provider-neutral agent loop: each reply proposes one tool call. The editor saves
// that call and returns its authoritative revisioned status to the next turn.
let running=false,stopRequested=false,lastResult=null;
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
function stepPrompt(objective,toolState,maxEdits){
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
  if(!agent?.getDocumentStatus||!tools?.execute)throw new Error('Structured document editor is not ready.');
  const profile=tier==='auto'?(smallModel(value.model)?'small':'large'):tier;
  if(!['small','large'].includes(profile))throw new Error('Invalid model edit tier.');
  const limit=profile==='small'?3:64,total=Math.max(1,Math.min(40,Math.round(Number(steps)||12)));
  running=true;stopRequested=false;lastResult=null;
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
      const response=await runtime.generate({
        purpose:'creator-document-agent-v1',executionProfile:'agentic',taskTier:'complex',requiresTools:true,
        messages:[{role:'system',content:'You are a document-editing tool planner. Reply ONLY with a JSON object. No markdown outside JSON.'},
          {role:'user',content:stepPrompt(chosen,toolState,limit)}],
        config:{...value,stream:false,maxTokens:Math.max(1400,Math.min(Number(value.maxTokens)||8192,32768))},
        context:{creatorSuite:true,mediaType:'text',taskTier:profile,documentSessionId:agent.getSession()?.id}
      });
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
  }catch(error){status(error.message||String(error),true);throw error;}
  finally{running=false;if(button)button.disabled=false;if(editor)editor.setAttribute('contenteditable',priorEditable??'true');}
}
function init(){
  node('cs-agent-run')?.addEventListener('click',()=>{
    run({objective:node('cs-agent-objective')?.value,steps:node('cs-agent-steps')?.value,
      tier:node('cs-agent-tier')?.value}).catch(error=>console.warn('Document AI:',error.message));
  });
  node('cs-agent-stop')?.addEventListener('click',()=>{stopRequested=true;status('Stop requested. The current inference call may finish before the agent stops.');});
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
globalThis.CivweaveCreatorDocumentAgentV1=Object.freeze({run,stop:()=>{stopRequested=true;},isRunning:()=>running,getLastResult:()=>lastResult,smallModel});
})();