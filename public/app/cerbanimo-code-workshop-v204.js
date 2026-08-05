(()=>{
'use strict';
if(globalThis.__cerbanimoCodeWorkshopV204)return;
globalThis.__cerbanimoCodeWorkshopV204=true;

const VERSION='1.0.0-code-workshop-v204';
const STORE_KEY='cerbanimo.code-workshop.v204';
const TOKEN_KEY='cerbanimo.github-token.session.v1';
const MODEL_SRC='/app/shared/commonweave-model-runtime.js?v=code-workshop-r1';
const QUEST_KEY='cerbanimo.quest-engine.v144';
const MAX_TREE_FILES=6000;
const MAX_CONTEXT_FILES=14;
const MAX_CONTEXT_CHARS=260000;
const MAX_FILE_CHARS=90000;
const PROTECTED_DEFAULT=['.github/','infra/','infrastructure/','src/auth/','src/billing/','migrations/'];
const TEXT_EXTENSIONS=new Set([
  'js','jsx','mjs','cjs','ts','tsx','json','md','html','css','scss','sass','less','py','rb','go','rs','java','kt','kts',
  'swift','c','h','cpp','hpp','cs','php','sh','bash','zsh','fish','yml','yaml','toml','ini','env','sql','graphql','gql',
  'vue','svelte','astro','txt','xml','gradle','properties','dockerfile'
]);
const root=globalThis;
const hasDOM=typeof document!=='undefined';
const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const now=()=>new Date().toISOString();
const uid=prefix=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`;
const clone=value=>typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value));
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const array=value=>Array.isArray(value)?value:[];

function emptyState(){
  return{
    schema:'cerbanimo.code-workshop.v204',
    version:1,
    repository:'',
    baseBranch:'',
    connection:null,
    survey:null,
    proposal:null,
    pullRequest:null,
    protectedPaths:[...PROTECTED_DEFAULT],
    selectedQuestId:'',
    selectedTaskId:'',
    status:'Connect a GitHub repository to begin.',
    busy:'',
    receipts:[],
    updatedAt:now()
  };
}
function normalizeState(input){
  const base=emptyState(),value=input&&typeof input==='object'?input:{};
  return{
    ...base,...value,
    repository:clean(value.repository,240),
    baseBranch:clean(value.baseBranch,180),
    connection:value.connection&&typeof value.connection==='object'?value.connection:null,
    survey:value.survey&&typeof value.survey==='object'?value.survey:null,
    proposal:value.proposal&&typeof value.proposal==='object'?value.proposal:null,
    pullRequest:value.pullRequest&&typeof value.pullRequest==='object'?value.pullRequest:null,
    protectedPaths:array(value.protectedPaths).map(item=>clean(item,240)).filter(Boolean).slice(0,80),
    selectedQuestId:clean(value.selectedQuestId,160),
    selectedTaskId:clean(value.selectedTaskId,160),
    status:clean(value.status,1200)||base.status,
    busy:clean(value.busy,80),
    receipts:array(value.receipts).slice(0,120),
    updatedAt:value.updatedAt||now()
  };
}
function readState(){return normalizeState(parse(localStorage.getItem(STORE_KEY),emptyState()))}
function writeState(next){
  const state=normalizeState(next);
  state.updatedAt=now();
  localStorage.setItem(STORE_KEY,JSON.stringify(state));
  try{root.dispatchEvent(new CustomEvent('cerbanimo:code-workshop-changed',{detail:{state:clone(state)}}))}catch{}
  render();
  return state;
}
function mutate(fn){
  const state=readState();
  fn(state);
  return writeState(state);
}
function receipt(kind,detail={}){
  mutate(state=>{
    state.receipts.unshift({id:uid('receipt'),kind,detail,at:now()});
    state.receipts=state.receipts.slice(0,120);
  });
}
function setStatus(message,busy=''){
  mutate(state=>{state.status=clean(message,1200);state.busy=busy});
}
function token(){return sessionStorage.getItem(TOKEN_KEY)||''}
function setToken(value){
  const next=clean(value,1000);
  if(next)sessionStorage.setItem(TOKEN_KEY,next);
  else sessionStorage.removeItem(TOKEN_KEY);
}
function splitRepo(value){
  const raw=clean(value,500).replace(/^https?:\/\/github\.com\//i,'').replace(/\.git$/i,'').replace(/^\/+|\/+$/g,'');
  const [owner,repo,...rest]=raw.split('/');
  if(!owner||!repo||rest.length)throw new Error('Use owner/repository, for example cerbanimo-dev/Commonweave.');
  return{owner,repo,fullName:`${owner}/${repo}`};
}
function branchPath(value){return clean(value,240).split('/').map(encodeURIComponent).join('/')}
function slug(value){
  return clean(value,120).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,48)||'quest';
}
function decodeContent(value){
  const source=String(value||'').replace(/\s+/g,'');
  const bytes=Uint8Array.from(atob(source),char=>char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
function extension(path){
  const name=path.split('/').pop()||'';
  if(/^dockerfile(?:\..+)?$/i.test(name))return'dockerfile';
  return(name.includes('.')?name.split('.').pop():'').toLowerCase();
}
function isTextPath(path){
  const lower=path.toLowerCase();
  if(/(^|\/)(node_modules|dist|build|coverage|vendor|target|\.git)(\/|$)/.test(lower))return false;
  if(/\.(png|jpe?g|gif|webp|avif|ico|pdf|zip|gz|tgz|woff2?|ttf|otf|mp3|mp4|webm|mov|onnx|wasm|bin|exe|dll|so|dylib)$/i.test(lower))return false;
  return TEXT_EXTENSIONS.has(extension(path))||/^(readme|license|makefile|dockerfile)(\.|$)/i.test(path.split('/').pop()||'');
}
function questApi(){return root.CommonweaveCerbanimoQuestV144||null}
function questState(){
  const api=questApi();
  if(api?.readState)return api.readState();
  return parse(localStorage.getItem(QUEST_KEY),{quests:[]});
}
function selectedWork(state=readState()){
  const quests=array(questState()?.quests);
  const quest=quests.find(item=>item.id===state.selectedQuestId)||quests.find(item=>item.status!=='completed'&&item.status!=='archived')||quests[0]||null;
  const task=quest?.tasks?.find(item=>item.id===state.selectedTaskId)||quest?.tasks?.find(item=>!['completed'].includes(item.status))||quest?.tasks?.[0]||null;
  return{quests,quest,task};
}
function githubHeaders(extra={}){
  const auth=token();
  if(!auth)throw new Error('Enter a GitHub token for this session.');
  return{
    'accept':'application/vnd.github+json',
    'authorization':`Bearer ${auth}`,
    'x-github-api-version':'2022-11-28',
    ...extra
  };
}
async function github(path,{method='GET',body,accept}={}){
  const response=await fetch(`https://api.github.com${path}`,{
    method,
    headers:githubHeaders({
      ...(accept?{'accept':accept}:{}),
      ...(body?{'content-type':'application/json'}:{})
    }),
    body:body?JSON.stringify(body):undefined,
    cache:'no-store'
  });
  const text=await response.text();
  let payload={};
  try{payload=text?JSON.parse(text):{}}catch{payload={message:text}}
  if(!response.ok){
    const error=new Error(clean(payload?.message||`GitHub returned HTTP ${response.status}.`,1600));
    error.status=response.status;
    error.payload=payload;
    throw error;
  }
  return payload;
}
async function loadFile(owner,repo,path,ref){
  const payload=await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(ref)}`);
  if(payload.type!=='file'||payload.encoding!=='base64')throw new Error(`GitHub did not return ${path} as a text file.`);
  const content=decodeContent(payload.content);
  if(content.length>MAX_FILE_CHARS)return{path,content:content.slice(0,MAX_FILE_CHARS),truncated:true,sha:payload.sha,size:payload.size};
  return{path,content,truncated:false,sha:payload.sha,size:payload.size};
}
function keywordSet(value){
  return new Set(clean(value,12000).toLowerCase().split(/[^a-z0-9_.-]+/).filter(word=>word.length>2&&!['the','and','for','with','from','that','this','into','user','add','make','create','build','code','task','quest'].includes(word)));
}
function scorePath(path,keywords){
  const lower=path.toLowerCase();
  let score=0;
  for(const word of keywords)if(lower.includes(word))score+=word.length>6?8:4;
  if(/(^|\/)(src|app|lib|server|client|packages)\//.test(lower))score+=2;
  if(/(^|\/)(readme|package\.json|vite\.config|tsconfig|pyproject|cargo\.toml|go\.mod|build\.gradle)/.test(lower))score+=5;
  if(/\.(test|spec)\./.test(lower))score+=1;
  return score;
}
function surveySummary(survey){
  if(!survey)return'No project survey yet.';
  const languages=Object.entries(survey.extensions||{}).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([key,count])=>`${key||'other'} ${count}`).join(' · ');
  return`${survey.fileCount} text-capable files mapped on ${survey.branch}. ${languages||'No language mix detected.'}`;
}
async function connectRepository(){
  const form=document.querySelector('#ccw204-repo-form');
  const data=new FormData(form);
  const repo=splitRepo(data.get('repository'));
  setToken(data.get('token')||token());
  setStatus(`Connecting to ${repo.fullName}…`,'connect');
  try{
    const info=await github(`/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}`);
    mutate(state=>{
      state.repository=repo.fullName;
      state.baseBranch=clean(data.get('branch'),180)||info.default_branch||'main';
      state.connection={
        fullName:repo.fullName,
        owner:repo.owner,
        repo:repo.repo,
        private:Boolean(info.private),
        defaultBranch:info.default_branch||'main',
        permissions:info.permissions||{},
        connectedAt:now()
      };
      state.survey=null;
      state.proposal=null;
      state.pullRequest=null;
      state.status=`Connected to ${repo.fullName}. Run the project survey next.`;
      state.busy='';
    });
    receipt('repository-connected',{repository:repo.fullName,private:Boolean(info.private)});
  }catch(error){setStatus(error.message,'');}
}
async function runSurvey(){
  const state=readState();
  if(!state.connection)return setStatus('Connect a repository first.');
  const {owner,repo}=state.connection;
  const branch=state.baseBranch||state.connection.defaultBranch;
  setStatus(`Mapping ${state.repository} on ${branch}…`,'survey');
  try{
    const tree=await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${branchPath(branch)}?recursive=1`);
    const blobs=array(tree.tree).filter(item=>item.type==='blob'&&isTextPath(item.path)).slice(0,MAX_TREE_FILES);
    const extensions={};
    for(const item of blobs){const ext=extension(item.path)||'other';extensions[ext]=(extensions[ext]||0)+1}
    const priority=[
      'README.md','readme.md','package.json','pnpm-workspace.yaml','vite.config.js','vite.config.ts','tsconfig.json',
      'pyproject.toml','requirements.txt','Cargo.toml','go.mod','build.gradle','settings.gradle','Dockerfile'
    ];
    const selected=[];
    for(const name of priority){
      const match=blobs.find(item=>item.path===name||item.path.endsWith(`/${name}`));
      if(match&&!selected.some(item=>item.path===match.path)&&Number(match.size||0)<=MAX_FILE_CHARS)selected.push(match);
      if(selected.length>=8)break;
    }
    const keyFiles=[];
    for(const item of selected){
      try{keyFiles.push(await loadFile(owner,repo,item.path,branch))}catch{}
    }
    const survey={
      schema:'cerbanimo.project-survey.v1',
      repository:state.repository,
      branch,
      commitSha:tree.sha||'',
      truncated:Boolean(tree.truncated),
      fileCount:blobs.length,
      files:blobs.map(item=>({path:item.path,size:item.size||0,sha:item.sha})),
      extensions,
      keyFiles,
      surveyedAt:now()
    };
    mutate(next=>{
      next.survey=survey;
      next.proposal=null;
      next.pullRequest=null;
      next.status=`Survey complete. ${surveySummary(survey)}`;
      next.busy='';
    });
    receipt('project-surveyed',{repository:state.repository,branch,fileCount:survey.fileCount});
  }catch(error){setStatus(error.message,'');}
}
function ensureModelRuntime(){
  if(root.CommonweaveModelRuntime)return Promise.resolve(root.CommonweaveModelRuntime);
  return new Promise((resolve,reject)=>{
    const existing=document.querySelector('script[data-ccw-model-runtime]');
    const timeout=setTimeout(()=>reject(new Error('The shared model runtime did not load.')),15000);
    const ready=()=>{if(root.CommonweaveModelRuntime){clearTimeout(timeout);resolve(root.CommonweaveModelRuntime)}};
    addEventListener('commonweave:model-runtime-ready',ready,{once:true});
    if(existing)return;
    const script=document.createElement('script');
    script.src=MODEL_SRC;
    script.dataset.ccwModelRuntime='';
    script.onload=ready;
    script.onerror=()=>{clearTimeout(timeout);reject(new Error('The shared model runtime could not be loaded.'))};
    document.head.append(script);
  });
}
async function contextFilesForWork(state,quest,task){
  const survey=state.survey;
  const query=[quest?.title,quest?.objective,quest?.description,task?.title,task?.description,array(task?.acceptanceCriteria).join(' ')].filter(Boolean).join(' ');
  const keywords=keywordSet(query);
  const ranked=array(survey?.files)
    .filter(item=>Number(item.size||0)>0&&Number(item.size||0)<=MAX_FILE_CHARS)
    .map(item=>({...item,score:scorePath(item.path,keywords)}))
    .sort((a,b)=>b.score-a.score||a.path.localeCompare(b.path));
  const chosen=[];
  const add=item=>{if(item&&!chosen.some(row=>row.path===item.path))chosen.push(item)};
  array(survey?.keyFiles).forEach(item=>add({path:item.path,size:item.size||item.content?.length||0}));
  ranked.slice(0,MAX_CONTEXT_FILES).forEach(add);
  const output=[];
  let chars=0;
  for(const item of chosen.slice(0,MAX_CONTEXT_FILES)){
    try{
      const file=array(survey?.keyFiles).find(row=>row.path===item.path)||await loadFile(state.connection.owner,state.connection.repo,item.path,state.baseBranch);
      if(chars+file.content.length>MAX_CONTEXT_CHARS)continue;
      chars+=file.content.length;
      output.push(file);
    }catch{}
  }
  return output;
}
function proposalSchema(){
  return{
    type:'object',
    required:['summary','files','verification','risks'],
    properties:{
      summary:{type:'string'},
      files:{
        type:'array',
        maxItems:20,
        items:{
          type:'object',
          required:['path','action','rationale'],
          properties:{
            path:{type:'string'},
            action:{type:'string',enum:['upsert','delete']},
            content:{type:'string'},
            rationale:{type:'string'}
          }
        }
      },
      verification:{type:'array',items:{type:'string'}},
      risks:{type:'array',items:{type:'string'}},
      assumptions:{type:'array',items:{type:'string'}}
    }
  };
}
function normalizeProposal(value,state){
  const protectedPaths=state.protectedPaths.map(item=>item.toLowerCase());
  const files=array(value?.files).map(item=>{
    const path=clean(item?.path,500).replace(/^\/+/,'');
    const action=item?.action==='delete'?'delete':'upsert';
    const invalid=!path||path.includes('..')||path.endsWith('/');
    const protectedMatch=protectedPaths.find(prefix=>path.toLowerCase().startsWith(prefix));
    return{
      path,
      action,
      content:action==='upsert'?String(item?.content??''):'',
      rationale:clean(item?.rationale,1600),
      invalid,
      protected:Boolean(protectedMatch),
      protectedMatch:protectedMatch||''
    };
  }).filter(item=>item.path);
  return{
    schema:'cerbanimo.code-change-proposal.v1',
    summary:clean(value?.summary,5000),
    files,
    verification:array(value?.verification).map(item=>clean(item,800)).filter(Boolean).slice(0,30),
    risks:array(value?.risks).map(item=>clean(item,1200)).filter(Boolean).slice(0,30),
    assumptions:array(value?.assumptions).map(item=>clean(item,1200)).filter(Boolean).slice(0,30),
    generatedAt:now()
  };
}
async function generateProposal(){
  const state=readState();
  const {quest,task}=selectedWork(state);
  if(!state.survey)return setStatus('Run the project survey first.');
  if(!quest)return setStatus('Create or select a Cerbanimo quest first.');
  if(!task)return setStatus('Add or select a quest work unit first.');
  setStatus('Preparing repository context for Antigravity…','generate');
  try{
    const runtime=await ensureModelRuntime();
    const config=runtime.readSharedConfig?.('agentic');
    if(!config)throw new Error('Configure an Agentic model in Commonweave AI settings first.');
    const contextFiles=await contextFilesForWork(state,quest,task);
    const treePreview=array(state.survey.files).slice(0,700).map(item=>item.path).join('\n');
    const fileContext=contextFiles.map(file=>`\n--- FILE: ${file.path}${file.truncated?' (truncated)':''} ---\n${file.content}`).join('\n');
    const prompt=`You are the implementation worker for a Cerbanimo software quest.

Repository: ${state.repository}
Base branch: ${state.baseBranch}
Quest: ${quest.title}
Quest objective: ${quest.objective||quest.description||''}
Current work unit: ${task.title}
Task description: ${task.description||''}
Acceptance criteria:
${array(task.acceptanceCriteria).map(item=>`- ${item}`).join('\n')||'- Produce the smallest working, reviewable implementation.'}

Repository tree excerpt:
${treePreview}

Relevant file contents:
${fileContext}

Return a conservative, reviewable change proposal. Include complete contents for every upserted text file. Do not alter generated assets, binaries, lockfiles, authentication, billing, infrastructure, migrations, or GitHub workflows unless those paths are explicitly part of the task context. Prefer the smallest coherent implementation. Do not claim tests were run. Put commands that should be run in verification.`;
    setStatus('Antigravity is drafting the code change…','generate');
    const result=await runtime.generateAgentic({
      purpose:'cerbanimo-code-quest',
      system:'Act as a careful repository worker. Return only the requested JSON change contract. Never fabricate file contents that contradict the supplied repository context.',
      prompt,
      responseFormat:'json',
      schema:proposalSchema(),
      maxRepairAttempts:1,
      onEvent:event=>{
        if(event.phase==='background')setStatus(`Antigravity ${event.status||'is working'}…`,'generate');
        if(event.phase==='repairing')setStatus('Antigravity is repairing the structured proposal…','generate');
      }
    });
    if(!['success','fallback'].includes(result.status))throw new Error(result?.error?.message||`Model request ended with ${result.status}.`);
    const proposal=normalizeProposal(result.outputJson||runtime.parseJsonLoose(result.outputText),state);
    if(!proposal.files.length)throw new Error('Antigravity returned no file changes.');
    mutate(next=>{
      next.proposal=proposal;
      next.pullRequest=null;
      const blocked=proposal.files.filter(item=>item.invalid||item.protected).length;
      next.status=blocked?`Proposal ready, but ${blocked} file change${blocked===1?' is':'s are'} blocked by path policy.`:`Proposal ready with ${proposal.files.length} file change${proposal.files.length===1?'':'s'}. Review before staging.`;
      next.busy='';
    });
    receipt('proposal-generated',{questId:quest.id,taskId:task.id,fileCount:proposal.files.length,provider:result.actual?.provider,model:result.actual?.model});
  }catch(error){setStatus(error.message,'');}
}
function pullBody(state,quest,task,proposal){
  const verification=proposal.verification.map(item=>`- [ ] ${item}`).join('\n')||'- [ ] Review the generated changes';
  const risks=proposal.risks.map(item=>`- ${item}`).join('\n')||'- No additional risks were recorded by the agent.';
  return`## Cerbanimo quest

**Quest:** ${quest.title}
**Work unit:** ${task.title}

${proposal.summary}

## Proposed verification

${verification}

## Risks and assumptions

${risks}

${proposal.assumptions.length?`### Assumptions\n\n${proposal.assumptions.map(item=>`- ${item}`).join('\n')}\n`:''}
## Provenance

Generated through Cerbanimo Code Workshop ${VERSION}. The pull request is intentionally a draft and requires human review.`;
}
async function stagePullRequest(){
  const state=readState();
  const {quest,task}=selectedWork(state);
  const proposal=state.proposal;
  if(!proposal||!quest||!task)return setStatus('Generate and review a proposal first.');
  const blocked=proposal.files.filter(item=>item.invalid||item.protected);
  if(blocked.length)return setStatus(`Cannot stage while ${blocked.length} path-policy block${blocked.length===1?' remains':'s remain'}.`);
  setStatus('Creating an isolated GitHub branch…','stage');
  try{
    const {owner,repo}=state.connection;
    const baseBranch=state.baseBranch||state.connection.defaultBranch;
    const ref=await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/heads/${branchPath(baseBranch)}`);
    const baseSha=ref.object?.sha;
    if(!baseSha)throw new Error('GitHub returned no base commit SHA.');
    const baseCommit=await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/commits/${encodeURIComponent(baseSha)}`);
    const treeEntries=[];
    for(const file of proposal.files){
      if(file.action==='delete'){
        treeEntries.push({path:file.path,mode:'100644',type:'blob',sha:null});
      }else{
        const blob=await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/blobs`,{method:'POST',body:{content:file.content,encoding:'utf-8'}});
        treeEntries.push({path:file.path,mode:'100644',type:'blob',sha:blob.sha});
      }
    }
    const tree=await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees`,{
      method:'POST',
      body:{base_tree:baseCommit.tree?.sha,tree:treeEntries}
    });
    const commitMessage=`Cerbanimo quest: ${task.title}`.slice(0,240);
    const commit=await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/commits`,{
      method:'POST',
      body:{message:commitMessage,tree:tree.sha,parents:[baseSha]}
    });
    const branch=`agent/cerbanimo-${slug(task.title)}-${Date.now().toString(36)}`;
    await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs`,{
      method:'POST',
      body:{ref:`refs/heads/${branch}`,sha:commit.sha}
    });
    const pr=await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`,{
      method:'POST',
      body:{
        title:`Cerbanimo: ${task.title}`.slice(0,240),
        head:branch,
        base:baseBranch,
        body:pullBody(state,quest,task,proposal),
        draft:true
      }
    });
    mutate(next=>{
      next.pullRequest={
        number:pr.number,
        url:pr.html_url,
        branch,
        commitSha:commit.sha,
        createdAt:now(),
        draft:Boolean(pr.draft)
      };
      next.status=`Draft PR #${pr.number} staged on ${branch}.`;
      next.busy='';
    });
    const api=questApi();
    if(api){
      const current=api.readState();
      const liveQuest=current.quests.find(item=>item.id===quest.id);
      const liveTask=liveQuest?.tasks.find(item=>item.id===task.id);
      if(liveTask?.status==='ready')api.applyTaskTransition(quest.id,task.id,'in-progress');
      api.addProof(quest.id,task.id,{kind:'url',label:`Draft PR #${pr.number}`,value:pr.html_url});
      api.addProof(quest.id,task.id,{kind:'artifact',label:'Git commit',value:commit.sha});
    }
    receipt('draft-pr-created',{questId:quest.id,taskId:task.id,number:pr.number,url:pr.html_url,branch,commitSha:commit.sha});
  }catch(error){setStatus(error.message,'');}
}
function clearSession(){
  setToken('');
  mutate(state=>{
    state.connection=null;
    state.survey=null;
    state.proposal=null;
    state.pullRequest=null;
    state.status='GitHub session cleared. Connect a repository to continue.';
    state.busy='';
  });
}
function updateSelections(event){
  const state=readState();
  if(event.target.matches('[data-ccw-quest-select]')){
    state.selectedQuestId=event.target.value;
    const quest=array(questState()?.quests).find(item=>item.id===state.selectedQuestId);
    state.selectedTaskId=quest?.tasks?.find(item=>item.status!=='completed')?.id||quest?.tasks?.[0]?.id||'';
    state.proposal=null;state.pullRequest=null;
    writeState(state);
  }
  if(event.target.matches('[data-ccw-task-select]')){
    state.selectedTaskId=event.target.value;
    state.proposal=null;state.pullRequest=null;
    writeState(state);
  }
  if(event.target.matches('[data-ccw-protected]')){
    state.protectedPaths=String(event.target.value||'').split(/\r?\n/).map(item=>clean(item,240)).filter(Boolean);
    if(state.proposal)state.proposal=normalizeProposal(state.proposal,state);
    writeState(state);
  }
}
function filePreview(file){
  const classes=[file.invalid?'is-invalid':'',file.protected?'is-protected':''].filter(Boolean).join(' ');
  const note=file.invalid?'Invalid path':file.protected?`Protected by ${file.protectedMatch}`:file.action;
  return`<details class="ccw204-file ${classes}"><summary><span>${esc(file.path)}</span><b>${esc(note)}</b></summary><p>${esc(file.rationale||'No rationale supplied.')}</p>${file.action==='upsert'?`<pre>${esc(file.content.slice(0,14000))}${file.content.length>14000?'\n… preview truncated':''}</pre>`:'<div class="ccw204-delete">This file will be deleted.</div>'}</details>`;
}
function receiptsMarkup(state){
  return state.receipts.slice(0,8).map(row=>`<div><b>${esc(row.kind.replaceAll('-',' '))}</b><span>${new Date(row.at).toLocaleString()}</span></div>`).join('')||'<p>No workshop receipts yet.</p>';
}
function overlayMarkup(state){
  const {quests,quest,task}=selectedWork(state);
  const connected=Boolean(state.connection);
  const proposal=state.proposal;
  const blocked=array(proposal?.files).filter(item=>item.invalid||item.protected).length;
  return`<section class="ccw204-overlay" id="ccw204-overlay" hidden aria-label="Cerbanimo Code Workshop">
    <header class="ccw204-header">
      <div><small>MOBILE CODEBASE WORKSHOP · ${esc(VERSION)}</small><h1>Kamiya's Code Forge</h1><p>Survey a repository, turn a Cerbanimo work unit into a reviewable code change, and stage a draft pull request.</p></div>
      <button type="button" data-ccw-close aria-label="Close code workshop">×</button>
    </header>
    <div class="ccw204-status ${state.busy?'is-busy':''}" role="status"><span></span><b>${esc(state.status)}</b></div>
    <div class="ccw204-grid">
      <section class="ccw204-card">
        <small>PASS 1 · CONNECT</small><h2>Repository workshop</h2>
        <form id="ccw204-repo-form">
          <label>GitHub repository<input name="repository" value="${esc(state.repository)}" placeholder="owner/repository" required></label>
          <label>Base branch<input name="branch" value="${esc(state.baseBranch||state.connection?.defaultBranch||'main')}" placeholder="main"></label>
          <label>GitHub token for this session<input name="token" type="password" autocomplete="off" placeholder="${token()?'Token loaded for this session':'Fine-grained token'}"></label>
          <div class="ccw204-actions"><button class="is-primary" type="submit" ${state.busy?'disabled':''}>${connected?'Reconnect':'Connect repository'}</button><button type="button" data-ccw-clear-session>Clear session</button></div>
        </form>
        ${connected?`<div class="ccw204-result"><b>${esc(state.connection.fullName)}</b><span>${state.connection.private?'Private':'Public'} · ${esc(state.baseBranch||state.connection.defaultBranch)}</span></div>`:''}
      </section>
      <section class="ccw204-card">
        <small>PASS 1 · MAP</small><h2>Project survey</h2>
        <p>${esc(surveySummary(state.survey))}</p>
        <div class="ccw204-actions"><button type="button" class="is-primary" data-ccw-survey ${!connected||state.busy?'disabled':''}>Survey repository</button></div>
        ${state.survey?`<div class="ccw204-pills">${Object.entries(state.survey.extensions||{}).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([key,count])=>`<span>${esc(key)} · ${count}</span>`).join('')}</div>`:''}
      </section>
      <section class="ccw204-card ccw204-wide">
        <small>PASS 2 · QUEST → CODE</small><h2>Choose the work unit</h2>
        <div class="ccw204-selects">
          <label>Quest<select data-ccw-quest-select>${quests.map(item=>`<option value="${esc(item.id)}" ${item.id===quest?.id?'selected':''}>${esc(item.title)}</option>`).join('')}</select></label>
          <label>Work unit<select data-ccw-task-select>${array(quest?.tasks).map(item=>`<option value="${esc(item.id)}" ${item.id===task?.id?'selected':''}>${esc(item.title)} · ${esc(item.status)}</option>`).join('')}</select></label>
        </div>
        <div class="ccw204-work"><b>${esc(task?.title||'No work unit selected')}</b><p>${esc(task?.description||quest?.objective||'Create a quest and work unit in Cerbanimo first.')}</p></div>
        <div class="ccw204-actions"><button type="button" class="is-primary" data-ccw-generate ${!state.survey||!task||state.busy?'disabled':''}>Draft changes with Antigravity</button></div>
      </section>
      <section class="ccw204-card ccw204-wide">
        <small>PASS 2 · REVIEW</small><h2>Change proposal</h2>
        ${proposal?`<p>${esc(proposal.summary)}</p><div class="ccw204-files">${proposal.files.map(filePreview).join('')}</div>
          <div class="ccw204-review-grid"><div><h3>Verification</h3><ul>${proposal.verification.map(item=>`<li>${esc(item)}</li>`).join('')||'<li>Review the generated diff.</li>'}</ul></div><div><h3>Risks</h3><ul>${proposal.risks.map(item=>`<li>${esc(item)}</li>`).join('')||'<li>No risks recorded.</li>'}</ul></div></div>`:'<p>No proposal yet. Antigravity will return complete text-file changes for human review.</p>'}
      </section>
      <section class="ccw204-card">
        <small>PASS 3 · POLICY</small><h2>Protected paths</h2>
        <p>One prefix per line. A proposal touching these paths cannot be staged.</p>
        <textarea data-ccw-protected rows="7">${esc(state.protectedPaths.join('\n'))}</textarea>
      </section>
      <section class="ccw204-card">
        <small>PASS 3 · DELIVER</small><h2>Draft pull request</h2>
        <p>${blocked?`${blocked} proposed change${blocked===1?' is':'s are'} blocked.`:'The approved proposal will become one commit on an isolated branch.'}</p>
        <div class="ccw204-actions"><button type="button" class="is-primary" data-ccw-stage ${!proposal||blocked||state.busy?'disabled':''}>Stage draft PR</button></div>
        ${state.pullRequest?`<a class="ccw204-pr" href="${esc(state.pullRequest.url)}" target="_blank" rel="noreferrer"><b>Draft PR #${state.pullRequest.number}</b><span>${esc(state.pullRequest.branch)}</span></a>`:''}
      </section>
      <section class="ccw204-card ccw204-wide">
        <small>EVIDENCE LEDGER</small><h2>Workshop receipts</h2><div class="ccw204-receipts">${receiptsMarkup(state)}</div>
      </section>
    </div>
  </section>`;
}
function ensureOverlay(){
  if(document.querySelector('#ccw204-overlay'))return;
  document.body.insertAdjacentHTML('beforeend',overlayMarkup(readState()));
  bindOverlay();
}
function render(){
  if(!hasDOM)return;
  const old=document.querySelector('#ccw204-overlay');
  if(!old)return;
  const wasOpen=!old.hidden;
  old.outerHTML=overlayMarkup(readState());
  const next=document.querySelector('#ccw204-overlay');
  next.hidden=!wasOpen;
  bindOverlay();
  mountLauncher();
}
function openWorkshop(){
  ensureOverlay();
  const overlay=document.querySelector('#ccw204-overlay');
  overlay.hidden=false;
  document.documentElement.classList.add('ccw204-open');
  overlay.querySelector('input,select,button')?.focus();
}
function closeWorkshop(){
  const overlay=document.querySelector('#ccw204-overlay');
  if(overlay)overlay.hidden=true;
  document.documentElement.classList.remove('ccw204-open');
  document.querySelector('[data-ccw-launch]')?.focus();
}
function bindOverlay(){
  const overlay=document.querySelector('#ccw204-overlay');
  if(!overlay||overlay.dataset.bound)return;
  overlay.dataset.bound='true';
  overlay.querySelector('#ccw204-repo-form')?.addEventListener('submit',event=>{event.preventDefault();connectRepository()});
  overlay.addEventListener('click',event=>{
    if(event.target.closest('[data-ccw-close]'))return closeWorkshop();
    if(event.target.closest('[data-ccw-clear-session]'))return clearSession();
    if(event.target.closest('[data-ccw-survey]'))return runSurvey();
    if(event.target.closest('[data-ccw-generate]'))return generateProposal();
    if(event.target.closest('[data-ccw-stage]'))return stagePullRequest();
  });
  overlay.addEventListener('change',updateSelections);
}
function mountLauncher(){
  if(!hasDOM||new URLSearchParams(location.search).get('system')!=='cerbanimo')return;
  let button=document.querySelector('[data-ccw-launch]');
  if(!button){
    button=document.createElement('button');
    button.type='button';
    button.className='cq144-button is-primary ccw204-launch';
    button.dataset.ccwLaunch='';
    button.innerHTML='<span>⌘</span> Code Workshop';
    button.addEventListener('click',openWorkshop);
  }
  const toolbar=document.querySelector('#cq144-root .cq144-toolbar > div:last-child');
  const empty=document.querySelector('#cq144-root .cq144-empty');
  if(toolbar&&!toolbar.contains(button))toolbar.append(button);
  else if(empty&&!empty.contains(button))empty.append(button);
  else if(!button.isConnected)document.body.append(button);
}
function observe(){
  ensureOverlay();
  mountLauncher();
  const observer=new MutationObserver(()=>mountLauncher());
  observer.observe(document.querySelector('#rc-app')||document.body,{childList:true,subtree:true});
  addEventListener('cerbanimo:quest-engine-changed',()=>{mountLauncher();render()});
  addEventListener('keydown',event=>{if(event.key==='Escape'&&!document.querySelector('#ccw204-overlay')?.hidden)closeWorkshop()});
}
root.CerbanimoCodeWorkshopV204={
  VERSION,STORE_KEY,readState,writeState,splitRepo,connectRepository,runSurvey,generateProposal,stagePullRequest,openWorkshop,closeWorkshop
};
if(hasDOM){
  if(document.readyState==='loading')addEventListener('DOMContentLoaded',observe,{once:true});
  else observe();
}
})();