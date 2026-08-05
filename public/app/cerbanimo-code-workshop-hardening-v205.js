(()=>{
'use strict';
if(globalThis.__cerbanimoCodeWorkshopHardeningV205)return;
globalThis.__cerbanimoCodeWorkshopHardeningV205=true;

const VERSION='1.0.0-code-workshop-hardening-v205';
const STORE_KEY='cerbanimo.code-workshop.v204';
const TOKEN_KEY='cerbanimo.github-token.session.v1';
const QUEST_KEY='cerbanimo.quest-engine.v144';
const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const array=value=>Array.isArray(value)?value:[];
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const now=()=>new Date().toISOString();
const slug=value=>clean(value,120).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,48)||'quest';
const branchPath=value=>clean(value,240).split('/').map(encodeURIComponent).join('/');

function api(){return globalThis.CerbanimoCodeWorkshopV204||null}
function readState(){return api()?.readState?.()||parse(localStorage.getItem(STORE_KEY),{})}
function writeState(state){
  if(api()?.writeState)return api().writeState(state);
  localStorage.setItem(STORE_KEY,JSON.stringify({...state,updatedAt:now()}));
  return state;
}
function token(){return sessionStorage.getItem(TOKEN_KEY)||''}
function questApi(){return globalThis.CommonweaveCerbanimoQuestV144||null}
function questState(){return questApi()?.readState?.()||parse(localStorage.getItem(QUEST_KEY),{quests:[]})}
function selectedWork(state){
  const quests=array(questState()?.quests);
  const quest=quests.find(item=>item.id===state.selectedQuestId)||quests.find(item=>item.status!=='completed'&&item.status!=='archived')||quests[0]||null;
  const task=quest?.tasks?.find(item=>item.id===state.selectedTaskId)||quest?.tasks?.find(item=>item.status!=='completed')||quest?.tasks?.[0]||null;
  return{quest,task};
}
function includedFiles(proposal){return array(proposal?.files).filter(file=>!file.excluded)}
function blockedFiles(proposal){return includedFiles(proposal).filter(file=>file.invalid||file.protected||file.missingDelete)}
function normalizeProposalSafety(state){
  if(!state.proposal)return false;
  const known=new Set(array(state.survey?.files).map(item=>clean(item?.path,500)).filter(Boolean));
  let changed=false;
  for(const file of array(state.proposal.files)){
    const missingDelete=file.action==='delete'&&!known.has(clean(file.path,500));
    if(Boolean(file.missingDelete)!==missingDelete){file.missingDelete=missingDelete;changed=true}
    if(typeof file.excluded!=='boolean'){file.excluded=false;changed=true}
  }
  return changed;
}
function setStatus(message,busy=''){
  const state=readState();
  state.status=clean(message,1200);
  state.busy=busy;
  writeState(state);
}
function githubHeaders(extra={}){
  const auth=token();
  if(!auth)throw new Error('Enter a GitHub token for this session.');
  return{
    accept:'application/vnd.github+json',
    authorization:`Bearer ${auth}`,
    'x-github-api-version':'2022-11-28',
    ...extra
  };
}
async function github(path,{method='GET',body}={}){
  const response=await fetch(`https://api.github.com${path}`,{
    method,
    headers:githubHeaders(body?{'content-type':'application/json'}:{}),
    body:body?JSON.stringify(body):undefined,
    cache:'no-store'
  });
  const text=await response.text();
  let payload={};
  try{payload=text?JSON.parse(text):{}}catch{payload={message:text}}
  if(!response.ok){
    const permission=response.status===401||response.status===403;
    const message=permission
      ?'GitHub denied this write. Reconnect with Contents and Pull requests write access for the selected repository.'
      :clean(payload?.message||`GitHub returned HTTP ${response.status}.`,1600);
    const error=new Error(message);
    error.status=response.status;
    error.payload=payload;
    throw error;
  }
  return payload;
}
function pullBody(quest,task,proposal,files){
  const verification=array(proposal.verification).map(item=>`- [ ] ${item}`).join('\n')||'- [ ] Review the generated changes';
  const risks=array(proposal.risks).map(item=>`- ${item}`).join('\n')||'- No additional risks were recorded by the agent.';
  const assumptions=array(proposal.assumptions).length?`### Assumptions\n\n${proposal.assumptions.map(item=>`- ${item}`).join('\n')}\n\n`:'';
  const changed=files.map(file=>`- ${file.action}: \`${file.path}\``).join('\n');
  return`## Cerbanimo quest\n\n**Quest:** ${quest.title}\n**Work unit:** ${task.title}\n\n${proposal.summary}\n\n## Included files\n\n${changed}\n\n## Proposed verification\n\n${verification}\n\n## Risks and assumptions\n\n${risks}\n\n${assumptions}## Provenance\n\nGenerated through Cerbanimo Code Workshop ${VERSION}. This pull request is intentionally a draft and requires human review.`;
}
async function hardenedStage(){
  const state=readState();
  const {quest,task}=selectedWork(state);
  const proposal=state.proposal;
  if(!state.connection||!proposal||!quest||!task)return setStatus('Generate and review a proposal first.');
  normalizeProposalSafety(state);
  const files=includedFiles(proposal);
  const blocked=blockedFiles(proposal);
  if(!files.length)return setStatus('Include at least one proposed file before staging.');
  if(blocked.length)return setStatus(`Cannot stage while ${blocked.length} included file${blocked.length===1?' is':'s are'} blocked by policy.`);
  setStatus('Creating an isolated GitHub branch…','stage');
  try{
    const {owner,repo}=state.connection;
    const baseBranch=state.baseBranch||state.connection.defaultBranch||'main';
    const repository=await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
    if(repository.permissions?.push===false)throw new Error('This GitHub token has read-only repository access.');
    const ref=await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/heads/${branchPath(baseBranch)}`);
    const baseSha=ref.object?.sha;
    if(!baseSha)throw new Error('GitHub returned no base commit SHA.');
    const baseCommit=await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/commits/${encodeURIComponent(baseSha)}`);
    if(!baseCommit.tree?.sha)throw new Error('GitHub returned no base tree SHA.');
    const treeEntries=[];
    for(const file of files){
      if(file.action==='delete'){
        treeEntries.push({path:file.path,mode:'100644',type:'blob',sha:null});
      }else{
        const blob=await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/blobs`,{
          method:'POST',body:{content:String(file.content??''),encoding:'utf-8'}
        });
        treeEntries.push({path:file.path,mode:'100644',type:'blob',sha:blob.sha});
      }
    }
    const tree=await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees`,{
      method:'POST',body:{base_tree:baseCommit.tree.sha,tree:treeEntries}
    });
    const commit=await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/commits`,{
      method:'POST',body:{message:`Cerbanimo quest: ${task.title}`.slice(0,240),tree:tree.sha,parents:[baseSha]}
    });
    const branch=`agent/cerbanimo-${slug(task.title)}-${Date.now().toString(36)}`;
    await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs`,{
      method:'POST',body:{ref:`refs/heads/${branch}`,sha:commit.sha}
    });
    const pr=await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`,{
      method:'POST',body:{
        title:`Cerbanimo: ${task.title}`.slice(0,240),
        head:branch,
        base:baseBranch,
        body:pullBody(quest,task,proposal,files),
        draft:true
      }
    });
    const next=readState();
    next.pullRequest={number:pr.number,url:pr.html_url,branch,commitSha:commit.sha,createdAt:now(),draft:true};
    next.status=`Draft PR #${pr.number} staged with ${files.length} included file change${files.length===1?'':'s'}.`;
    next.busy='';
    next.receipts=array(next.receipts);
    next.receipts.unshift({id:`receipt-${Date.now().toString(36)}`,kind:'draft-pr-created-v205',at:now(),detail:{questId:quest.id,taskId:task.id,number:pr.number,url:pr.html_url,branch,commitSha:commit.sha,fileCount:files.length}});
    writeState(next);
    const quests=questApi();
    if(quests){
      const live=quests.readState();
      const liveTask=live.quests.find(item=>item.id===quest.id)?.tasks.find(item=>item.id===task.id);
      if(liveTask?.status==='ready')quests.applyTaskTransition(quest.id,task.id,'in-progress');
      quests.addProof(quest.id,task.id,{kind:'url',label:`Draft PR #${pr.number}`,value:pr.html_url});
      quests.addProof(quest.id,task.id,{kind:'artifact',label:'Git commit',value:commit.sha});
    }
  }catch(error){setStatus(error.message,'')}
}
function toggleFile(index){
  const state=readState();
  const file=state.proposal?.files?.[index];
  if(!file)return;
  file.excluded=!file.excluded;
  state.status=file.excluded?`${file.path} excluded from delivery.`:`${file.path} restored to the delivery set.`;
  writeState(state);
}
function decorate(){
  const overlay=document.querySelector('#ccw204-overlay');
  if(!overlay||overlay.hidden)return;
  const state=readState();
  if(normalizeProposalSafety(state)){writeState(state);return}
  const files=array(state.proposal?.files);
  overlay.querySelectorAll('.ccw204-file').forEach((node,index)=>{
    const file=files[index];
    if(!file)return;
    node.classList.toggle('is-excluded',Boolean(file.excluded));
    node.classList.toggle('is-invalid',Boolean(file.invalid||file.missingDelete));
    let controls=node.querySelector('.ccw205-file-controls');
    if(!controls){
      controls=document.createElement('div');
      controls.className='ccw205-file-controls';
      node.querySelector('summary')?.insertAdjacentElement('afterend',controls);
    }
    controls.innerHTML=`<button type="button" data-ccw205-toggle="${index}">${file.excluded?'Include in PR':'Exclude from PR'}</button>`;
    const note=node.querySelector('summary b');
    if(note){
      if(file.excluded)note.textContent='excluded';
      else if(file.missingDelete)note.textContent='delete target not found';
    }
  });
  const stage=document.querySelector('#ccw204-overlay [data-ccw-stage]');
  const included=includedFiles(state.proposal).length;
  const blocked=blockedFiles(state.proposal).length;
  if(stage)stage.disabled=!state.proposal||!included||Boolean(blocked)||Boolean(state.busy);
  const delivery=stage?.closest('.ccw204-card')?.querySelector('p');
  if(delivery&&state.proposal){
    delivery.textContent=blocked
      ?`${blocked} included change${blocked===1?' is':'s are'} blocked.`
      :`${included} included file change${included===1?'':'s'} will become one commit on an isolated branch.`;
  }
}
function captureClick(event){
  const toggle=event.target.closest?.('[data-ccw205-toggle]');
  if(toggle){
    event.preventDefault();
    event.stopImmediatePropagation();
    return toggleFile(Number(toggle.dataset.ccw205Toggle));
  }
  if(event.target.closest?.('[data-ccw-stage]')){
    event.preventDefault();
    event.stopImmediatePropagation();
    return hardenedStage();
  }
}
function observe(){
  document.addEventListener('click',captureClick,true);
  const observer=new MutationObserver(()=>queueMicrotask(decorate));
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  addEventListener('cerbanimo:code-workshop-changed',()=>queueMicrotask(decorate));
  decorate();
}
globalThis.CerbanimoCodeWorkshopHardeningV205={VERSION,includedFiles,blockedFiles,normalizeProposalSafety,hardenedStage,decorate};
if(document.readyState==='loading')addEventListener('DOMContentLoaded',observe,{once:true});
else observe();
})();