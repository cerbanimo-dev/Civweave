import {CivweaveCodeWorkspaceV1 as work,publishReviewed,adoptReviewed} from './shared/code-mesh-workspace-v1.mjs';
import {resolveCodeInferenceRoute,runCodeInference} from './shared/code-inference-route-v1.mjs';

const el=id=>document.getElementById('cw-'+id),out=(id,value)=>{el(id).textContent=typeof value==='string'?value:JSON.stringify(value,null,2);};
let workspaceId='',previewId='',inspectedId='',running=false,stopRequested=false,localRuntimeFlight=null,serverRuntimeFlight=null,generationController=null;
const clean=(v,n=5000)=>String(v??'').slice(0,n);
function showError(error){out('checks',error.message||String(error));}
function option(value,label){const e=document.createElement('option');e.value=value;e.textContent=label;return e;}
async function choose(prefer=workspaceId){
  const entries=await work.listWorkspaces(),select=el('workspaces');select.replaceChildren();
  for(const record of entries)select.append(option(record.id,(record.title||'(unreadable)')+' · '+record.id.slice(0,8)));
  workspaceId=entries.some(x=>x.id===prefer)?prefer:entries.find(x=>!x.unreadable)?.id||'';
  select.value=workspaceId;
  if(workspaceId){const value=await work.status(workspaceId);out('status',value);el('public-title').value||=value.title;el('publish-paths').value=value.filePaths.join('\n');}
  else out('status','Create a new encrypted code workspace to begin.');
  return workspaceId;
}
function selected(){if(!workspaceId)throw new Error('Create or select a workspace first.');return workspaceId;}
async function editManual(){
  const id=selected(),s=await work.status(id),op=el('operation').value,path=el('path').value.trim();
  const entry={op,path,content:el('content').value};
  if(op==='replace_range'){entry.startLine=Number(el('start').value);entry.endLine=Number(el('end').value);}
  const next=await work.submitEdits({workspaceId:id,expectedRevision:s.revision,edits:[entry],tier:'small',message:'Manual code edit',actor:'human'});
  out('checks',next.validation);await choose(id);
}
function registerTools(){
  const tools=globalThis.CivweaveCreatorToolsV1;
  if(!tools?.registerEditor)throw new Error('Creator Suite tool dispatch is unavailable.');
  tools.registerEditor('code',{
    actions:[
      {name:'code.status',description:'Read authoritative local code workspace revision and file list'},
      {name:'code.read',description:'Read a bounded line range of one file'},
      {name:'code.edit',description:'Atomically apply 1–3 small or up to 64 large code edits and save a Git-format checkpoint'},
      {name:'code.validate',description:'Run available non-executing static checks with diagnostics'}
    ],
    execute:async(action,args,actor)=>{
      const id=selected();
      if(action==='code.status')return work.status(id);
      if(action==='code.read')return work.readFile(id,args.path,{startLine:args.startLine,endLine:args.endLine});
      if(action==='code.validate')return work.validate(id,{paths:args.paths??null});
      if(action==='code.edit')return work.submitEdits({workspaceId:id,expectedRevision:args.expectedRevision,edits:args.edits,tier:args.tier||'small',message:args.message||'AI edit batch',actor:'ai'});
      throw new Error('Unsupported code tool.');
    }
  });
}
function currentSelection(){
  try{const live=globalThis.CivweaveLocalModelDownloadV266?.selection?.();if(live?.active&&live.id)return live;}catch{}
  try{const saved=JSON.parse(localStorage.getItem('civweave.local-ai.selection.v266')||'null');return saved?.active&&saved.id?saved:null;}catch{return null;}
}
function config(){
  const runtime=globalThis.CivweaveModelRuntime;
  if(!runtime?.generate)throw new Error('Shared Civweave model runtime is unavailable. Reopen the Code Workshop from the installed app.');
  const value=runtime.readSharedConfig?.('agentic')||runtime.readSharedConfig?.('interactive');
  if(!value?.provider)throw new Error('No AI provider is configured in this app origin. Choose a model in Civweave Settings, then reopen Code Workshop.');
  const selection=currentSelection(),route=resolveCodeInferenceRoute(value,selection);
  if(['manual','deterministic'].includes(route.provider))throw new Error('AI Settings currently selects '+route.provider+'. Select an inference model to use in the Code Workshop.');
  if(route.kind==='shared'&&['gemini','hosted'].includes(route.provider)&&!value.externalConsent)
    throw new Error('Cloud consent or credentials are unavailable in this Code Workshop tab. Reopen it from Civweave or explicitly configure a permitted provider for this session.');
  return{runtime,value,route,selection};
}
function loadLocalRuntime(){
  if(globalThis.CivweaveLocalChatRuntimeV295?.generate)return Promise.resolve(globalThis.CivweaveLocalChatRuntimeV295);
  if(localRuntimeFlight)return localRuntimeFlight;
  localRuntimeFlight=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src='/app/local-chat-runtime-v295.js?v=1.0.120-local-chat-runtime-v305-moss-core-readiness';
    script.onload=()=>{const owner=globalThis.CivweaveLocalChatRuntimeV295;if(owner?.generate)resolve(owner);else reject(new Error('The installed local-chat inference owner did not initialize.'));};
    script.onerror=()=>reject(new Error('Could not load Civweave local model inference. Check that the installed app package is up to date.'));
    document.head.append(script);
  }).catch(error=>{localRuntimeFlight=null;throw error});
  return localRuntimeFlight;
}
function loadServerRuntime(){
  if(globalThis.CivweaveServerAIRouterV301?.handle)return Promise.resolve(globalThis.CivweaveServerAIRouterV301);
  if(serverRuntimeFlight)return serverRuntimeFlight;
  const load=src=>new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=src;script.onload=resolve;script.onerror=()=>reject(new Error('Unable to load canonical Guild/Cloudflare AI routing: '+src));
    document.head.append(script);
  });
  serverRuntimeFlight=(async()=>{
    // These modules are the existing Civweave host-session and mesh clients,
    // not a second hosted inference or permission implementation.
    if(!globalThis.CivweaveHostNodeSessionV1)await load('/app/host-node-session-v1.js');
    if(!globalThis.CivweaveNodeAIMeshV1)await load('/app/node-ai-mesh-v1.js');
    await load('/app/server-ai-router-v301.js');
    const router=globalThis.CivweaveServerAIRouterV301;
    if(!router?.handle)throw new Error('Guild/Cloudflare inference router is unavailable in this app context.');
    return router;
  })().catch(e=>{serverRuntimeFlight=null;throw e});
  return serverRuntimeFlight;
}
function modelStatus(){
  const display=el('model-status');if(!display)return;
  try{const {value,route}=config();display.textContent=route.kind==='downloaded-local'
    ?'Selected device model: '+route.model+' · on-device inference'
    :'Selected provider: '+route.provider+' · '+(value.model||'default')+(nativeTermux(value)?' · Termux streaming code chunks':'');}
  catch(error){display.textContent='Model unavailable: '+error.message;}
}
function nativeTermux(config){return config?.provider==='openai-compatible'&&config.model==='qwen35-4b-native'&&String(config.endpoint||'').replace(/\/$/,'')==='http://127.0.0.1:8080/v1';}
function smallModel(name){return /(?:^|[^0-9])(?:0\.\d+|1(?:\.5)?|2|3|4|5|6|7)b(?:[^a-z]|$)/i.test(clean(name,240))||/\be[24]b\b/i.test(clean(name,240));}
function decode(output){
  if(output?.outputJson&&typeof output.outputJson==='object'&&!Array.isArray(output.outputJson))return output.outputJson;
  const raw=clean(output?.outputText||output?.text||'',120000).trim().replace(/^(?:`{3}|~{3})(?:json)?\s*/i,'').replace(/\s*(?:`{3}|~{3})$/,'');
  try{return JSON.parse(raw);}catch{}
  const start=raw.indexOf('{'),end=raw.lastIndexOf('}');
  if(start>=0&&end>start)return JSON.parse(raw.slice(start,end+1));
  throw new Error('Model did not return a valid JSON tool instruction; no edit applied.');
}
function prompt(goal,state,limit,profile='large',native=false){
  if(native)return [
    'You are an AI code editing an encrypted workspace by short, saved tool calls.',
    'Output only ONE complete JSON object. Do not show reasoning, markdown, or preambles.',
    'To save code: {"type":"edit","edits":[{"op":"create","path":"src/app.js","content":"const x = 1;"}],"message":"add code"}.',
    'Or {"type":"read","path":"src/app.js","startLine":1,"endLine":30}.',
    'Or {"type":"validate"}. Or {"type":"done","note":"what is finished"}.',
    'For edits use create, replace, append, replace_range, delete. For replace_range include startLine/endLine.',
    'IMPORTANT: Return one small change under 15 lines and 300 output tokens, even for a large project.',
    'Every valid edit is saved automatically; continue with the NEXT edit on your next call.',
    'Use append for an existing file, not create. Do not output the entire project. Do not publish.',
    'Goal: '+clean(goal,650),
    'Current saved state: '+clean(JSON.stringify(state),1400)
  ].join('\\n');
  return [
    'You are a code-authoring agent operating an offline saved workspace through tools.',
    'Return ONLY one JSON object for exactly one operation per response.',
    '{"type":"edit","edits":[{"op":"create","path":"src/index.js","content":"..."}],"message":"what changed"}',
    '{"type":"read","path":"src/index.js","startLine":1,"endLine":80}',
    '{"type":"validate"}',
    '{"type":"done","note":"what is complete and what still needs tests"}',
    'Valid edits: create, replace, append, replace_range(startLine,endLine,content), delete. Include complete source content only for that bounded edit, not the whole workspace.',
    'Maximum edits this turn: '+limit+'. Use small coherent changes, not giant token streams.',
    'A successful edit is saved and committed; the next step receives authoritative revision/diagnostics.',
    'Tests and JavaScript syntax are NOT automatically executed. Do not claim they passed without a validator receipt.',
    'Never publish, install, execute or adopt code; only the user can approve those actions.',
    'Read file content before changing unfamiliar files. Avoid duplicate edits. When complete, return done.',
    'Goal: '+goal,
    'Saved workspace and latest tool result: '+clean(JSON.stringify(state),profile==='small'?2400:9000)
  ].join('\n');
}
async function runAgent(){
  if(running)throw new Error('Code agent already running.');
  const goal=el('goal').value.trim();if(!goal)throw new Error('Enter a code-building objective.');
  const id=selected(),{runtime,value,route,selection}=config();
  const requested=el('tier').value,profile=requested==='auto'?(smallModel(value.model)?'small':'large'):requested,limit=profile==='small'?3:64;
  const total=Math.max(1,Math.min(40,Number(el('steps').value)||12)),tools=globalThis.CivweaveCreatorToolsV1;
  out('agent-result','Using '+route.provider+' · '+route.model+' · '+total+' model calls maximum.');
  running=true;stopRequested=false;el('run').disabled=true;
  const controller=new AbortController();generationController=controller;
  let state={status:await work.status(id)},calls=0,completed=false;
  try{
    for(let i=0;i<total&&!stopRequested;i++){
      if(workspaceId!==id)throw new Error('Workspace selection changed during agent run.');
      calls=i+1;
      out('agent-result','Code AI · call '+calls+'/'+total+' · max '+limit+' edits/call');
      const readRevision=(await work.status(id)).revision;
      let visible='',phase='starting';
      const response=await runCodeInference(value,[
        {role:'system',content:'You are a code editing tool planner. Reply with valid JSON only, not Markdown.'},
        {role:'user',content:prompt(goal,state,limit,profile,nativeTermux(value))}
      ],{
        selection,loadLocal:loadLocalRuntime,loadServer:loadServerRuntime,sharedRuntime:runtime,context:{workspaceId:id,taskTier:profile},signal:controller.signal,
        maxTokens:profile==='small'?2048:4096,
        onProgress:progress=>{phase=clean(progress?.phase||progress?.stage||'working',100);out('agent-result','Code AI · '+route.model+' · call '+calls+'/'+total+' · '+phase+(visible?'\n'+visible.slice(-900):''));},
        onToken:token=>{const chunk=typeof token==='string'?token:clean(token?.text||token?.content||'',12000);visible+=chunk;if(visible.length>120000)visible=visible.slice(-120000);out('agent-result','Code AI · '+route.model+' · call '+calls+'/'+total+' · '+phase+'\n'+visible.slice(-1200));}
      });
      if(stopRequested||controller.signal.aborted)break;
      if(response?.status!=='success'||response?.fallback?.used)throw new Error('Inference failed ('+clean(response?.error?.code||response?.status||'unknown',100)+'): '+clean(response?.error?.message||response?.status||'unknown',500));
      if(stopRequested)break;
      if(workspaceId!==id)throw new Error('Project changed while AI was thinking.');
      const instruction=decode(response);
      if(instruction.type==='done'){completed=true;state={done:true,note:clean(instruction.note,600),status:await work.status(id)};break;}
      let action,args;
      if(instruction.type==='edit'){
        if(!Array.isArray(instruction.edits)||instruction.edits.length<1||instruction.edits.length>limit)throw new Error('Invalid model edit batch size.');
        action='code.edit';args={expectedRevision:readRevision,edits:instruction.edits,tier:profile,message:clean(instruction.message||'AI edit batch',180)};
      }else if(instruction.type==='read'){action='code.read';args={path:instruction.path,startLine:instruction.startLine,endLine:instruction.endLine};}
      else if(instruction.type==='validate'){action='code.validate';args={};}
      else throw new Error('Model must choose edit, read, validate or done.');
      state=await tools.execute({kind:'code',action,actorId:'creator-code-agent',provider:clean(response.actual?.provider||value.provider,100),model:clean(response.actual?.model||value.model,150),requestId:crypto.randomUUID(),args});
      out('agent-result',{call:calls,action,result:state});
      await choose(id);
    }
    out('agent-result',{completed,stopped:stopRequested,calls,state:await work.status(id),note:'Static validation only; source has not been executed or published.'});
  }finally{if(generationController===controller)generationController=null;running=false;el('run').disabled=false;}
}
function parsePaths(){return el('publish-paths').value.split(/[\n,]/).map(x=>x.trim()).filter(Boolean);}
async function prepare(){
  const review=await work.previewPublication(selected(),{paths:parsePaths(),title:el('public-title').value,description:el('public-description').value,license:el('license').value});
  previewId=review.previewId;el('publish').disabled=false;out('preview-result',review);
}
async function publish(event){
  if(!previewId)throw new Error('Review the selected files before publishing.');
  const review=previewId;previewId='';el('publish').disabled=true;
  if(!window.confirm('Publish the reviewed files and license to the public mesh? Other peers may preserve them indefinitely.'))return;
  out('preview-result',await publishReviewed(review,event));
}
async function discover(){
  const rows=await work.discoverPublic({query:el('search').value}),select=el('capsules');select.replaceChildren();
  for(const row of rows)select.append(option(row.objectId,(row.title||'(untitled)')+' · '+row.license+' · '+row.objectId.slice(-8)));
  inspectedId='';out('discovery-result',rows.length?rows:'No public code capsules found in this device’s existing mesh store.');
}
async function inspect(){
  inspectedId=el('capsules').value;if(!inspectedId)throw new Error('Select a capsule.');
  const p=await work.inspectPublic(inspectedId);
  out('discovery-result',{...p,files:Object.fromEntries(Object.entries(p.files).map(([k,v])=>[k,v.slice(0,16000)]))});
}
async function adopt(event){
  if(!inspectedId||inspectedId!==el('capsules').value)throw new Error('Inspect this capsule before adopting.');
  if(!window.confirm('Clone the inspected source into your private encrypted workspace? This will not execute code.'))return;
  const result=await adoptReviewed(inspectedId,event);out('discovery-result',result);await choose(result.workspaceId);
}
function bind(id,handler){el(id)?.addEventListener('click',event=>Promise.resolve().then(()=>handler(event)).catch(error=>{out(['preview','publish'].includes(id)?'preview-result':id==='adopt'||id==='discover'||id==='inspect-public'?'discovery-result':id==='run'?'agent-result':'checks',error.message||String(error));}));}
function init(){
  registerTools();
  modelStatus();
  addEventListener('storage',modelStatus);
  addEventListener('civweave:model-config-changed',modelStatus);
  bind('create',async()=>{const created=await work.createWorkspace({title:el('new-title').value});await choose(created.id);});
  bind('refresh',()=>choose());
  el('workspaces').addEventListener('change',()=>{workspaceId=el('workspaces').value;previewId='';el('publish').disabled=true;choose(workspaceId).catch(showError);});
  bind('inspect',async()=>{const r=await work.readFile(selected(),el('path').value.trim());el('content').value=r.content;out('checks',r);});
  bind('edit',editManual);bind('validate',async()=>out('checks',await work.validate(selected())));
  bind('run',()=>runAgent());bind('stop',()=>{stopRequested=true;generationController?.abort(new DOMException('Code generation stopped by user','AbortError'));out('agent-result','Stop requested; already saved code edits are preserved.');});
  bind('preview',prepare);bind('publish',publish);bind('discover',discover);bind('inspect-public',inspect);bind('adopt',adopt);
  choose().catch(showError);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
