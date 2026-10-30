import {CivweaveCodeWorkspaceV1 as work,publishReviewed,adoptReviewed} from './shared/code-mesh-workspace-v1.mjs';

const el=id=>document.getElementById('cw-'+id),out=(id,value)=>{el(id).textContent=typeof value==='string'?value:JSON.stringify(value,null,2);};
let workspaceId='',previewId='',inspectedId='',running=false,stopRequested=false;
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
function config(){
  const runtime=globalThis.CivweaveModelRuntime;
  if(!runtime?.generate)throw new Error('Configure a Civweave local or consented cloud model in AI settings.');
  const value=runtime.readSharedConfig?.('agentic')||runtime.readSharedConfig?.('interactive');
  if(!value?.provider||['manual','deterministic'].includes(value.provider))throw new Error('Select an inference provider first.');
  return{runtime,value};
}
function smallModel(name){return /(?:^|[^0-9])(?:0\.\d+|1(?:\.5)?|2|3|4|5|6|7)b(?:[^a-z]|$)/i.test(clean(name,240))||/\be[24]b\b/i.test(clean(name,240));}
function decode(output){
  if(output?.outputJson&&typeof output.outputJson==='object'&&!Array.isArray(output.outputJson))return output.outputJson;
  const raw=clean(output?.outputText||output?.text||'',120000).trim().replace(/^(?:`{3}|~{3})(?:json)?\s*/i,'').replace(/\s*(?:`{3}|~{3})$/,'');
  try{return JSON.parse(raw);}catch{}
  const start=raw.indexOf('{'),end=raw.lastIndexOf('}');
  if(start>=0&&end>start)return JSON.parse(raw.slice(start,end+1));
  throw new Error('Model did not return a valid JSON tool instruction; no edit applied.');
}
function prompt(goal,state,limit){
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
    'Saved workspace and latest tool result: '+clean(JSON.stringify(state),18000)
  ].join('\n');
}
async function runAgent(){
  if(running)throw new Error('Code agent already running.');
  const goal=el('goal').value.trim();if(!goal)throw new Error('Enter a code-building objective.');
  const id=selected(),{runtime,value}=config();
  const requested=el('tier').value,profile=requested==='auto'?(smallModel(value.model)?'small':'large'):requested,limit=profile==='small'?3:64;
  const total=Math.max(1,Math.min(40,Number(el('steps').value)||12)),tools=globalThis.CivweaveCreatorToolsV1;
  running=true;stopRequested=false;el('run').disabled=true;
  let state={status:await work.status(id)},calls=0,completed=false;
  try{
    for(let i=0;i<total&&!stopRequested;i++){
      if(workspaceId!==id)throw new Error('Workspace selection changed during agent run.');
      calls=i+1;
      out('agent-result','Code AI · call '+calls+'/'+total+' · max '+limit+' edits/call');
      const readRevision=(await work.status(id)).revision;
      const response=await runtime.generate({
        purpose:'creator-code-agent-v1',executionProfile:'agentic',taskTier:'complex',requiresTools:true,
        messages:[{role:'system',content:'You are a code editing tool planner. Reply with valid JSON only, not Markdown.'},{role:'user',content:prompt(goal,state,limit)}],
        config:{...value,stream:false,maxTokens:Math.max(1400,Math.min(Number(value.maxTokens)||8192,32768))},
        context:{creatorSuite:true,mediaType:'code',workspaceId:id,taskTier:profile}
      });
      if(response?.status!=='success'||(response?.fallback?.used&&response.fallback.provider==='deterministic'))throw new Error('Inference failed: '+clean(response?.error?.message||response?.status||'unknown',300));
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
  }finally{running=false;el('run').disabled=false;}
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
  bind('create',async()=>{const created=await work.createWorkspace({title:el('new-title').value});await choose(created.id);});
  bind('refresh',()=>choose());
  el('workspaces').addEventListener('change',()=>{workspaceId=el('workspaces').value;previewId='';el('publish').disabled=true;choose(workspaceId).catch(showError);});
  bind('inspect',async()=>{const r=await work.readFile(selected(),el('path').value.trim());el('content').value=r.content;out('checks',r);});
  bind('edit',editManual);bind('validate',async()=>out('checks',await work.validate(selected())));
  bind('run',()=>runAgent());bind('stop',()=>{stopRequested=true;out('agent-result','Stop requested; saved chunks are preserved.');});
  bind('preview',prepare);bind('publish',publish);bind('discover',discover);bind('inspect-public',inspect);bind('adopt',adopt);
  choose().catch(showError);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
