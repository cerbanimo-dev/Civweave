const TOOL_ORDER=Object.freeze(['text','audio','video']);
const TOOL_LABELS=Object.freeze({text:'Open Text Creator',audio:'Open Audio Creator',video:'Open Video Creator'});
const PRODUCE_RE=/\b(create|make|produce|draft|write|compose|edit|revise|rewrite|record|render|export|publish|deliver|assemble|cut|mix|master|narrate|film|shoot|capture|author)\b/i;
const TOOL_PATTERNS=Object.freeze({
  text:/\b(document|report|essay|article|post|letter|email|proposal|plan|brief|copy|script|transcript|outline|story|poem|guide|manual|worksheet|memo|summary|draft|text)\b/i,
  audio:/\b(audio|podcast|voice[- ]?over|narration|recording|song|music|track|sound|speech|mix)\b/i,
  video:/\b(video|film|reel|short|clip|footage|screencast|screen recording|movie)\b/i,
});
const clean=(value,max=2400)=>String(value??'').trim().slice(0,max);

function taskCorpus(task={}){
  const criteria=Array.isArray(task.acceptanceCriteria)?task.acceptanceCriteria:[];
  return [task.title,task.description,...criteria].map(value=>clean(value)).filter(Boolean).join('\n');
}

function explicitKinds(task={}){
  const rows=[];
  if(Array.isArray(task.creatorTools))rows.push(...task.creatorTools);
  if(Array.isArray(task.toolHints))rows.push(...task.toolHints);
  if(task.deliverableType)rows.push(task.deliverableType);
  return new Set(rows.map(value=>clean(value,40).toLowerCase()).filter(value=>TOOL_ORDER.includes(value)));
}

export function toolHref(kind,questId='',taskId=''){
  if(!TOOL_ORDER.includes(kind))throw new TypeError('Unsupported Creator Suite task tool.');
  const params=new URLSearchParams({tool:kind}),quest=clean(questId,180),task=clean(taskId,180);
  if(quest)params.set('quest',quest);
  if(task)params.set('task',task);
  return `/creator-suite/?${params.toString()}`;
}

export function toolsForTask(quest={},task={}){
  if(!task?.id||task.status==='completed')return[];
  const corpus=taskCorpus(task),explicit=explicitKinds(task),hasProduceVerb=PRODUCE_RE.test(corpus),kinds=[];
  for(const kind of TOOL_ORDER){
    if(explicit.has(kind)||(hasProduceVerb&&TOOL_PATTERNS[kind].test(corpus)))kinds.push(kind);
  }
  return kinds.map(kind=>Object.freeze({kind,label:TOOL_LABELS[kind],href:toolHref(kind,quest?.id,task.id)}));
}

function taskFromState(state,card){
  const quest=state?.quests?.find?.(row=>row?.id===card.dataset.questId),task=quest?.tasks?.find?.(row=>row?.id===card.dataset.taskId);
  return{quest,task};
}

function syncCard(card,state){
  const{quest,task}=taskFromState(state,card),tools=toolsForTask(quest,task),footer=card.querySelector('footer');
  if(!footer)return;
  const desired=new Map(tools.map(tool=>[tool.kind,tool]));
  footer.querySelectorAll('[data-cq-task-tool]').forEach(link=>{
    if(!desired.has(link.dataset.cqTaskTool))link.remove();
  });
  for(const tool of tools){
    let link=footer.querySelector(`[data-cq-task-tool="${tool.kind}"]`);
    if(!link){
      link=document.createElement('a');
      link.className='cq144-button';
      link.dataset.cqTaskTool=tool.kind;
      footer.append(link);
    }
    if(link.getAttribute('href')!==tool.href)link.setAttribute('href',tool.href);
    if(link.textContent!==tool.label)link.textContent=tool.label;
    link.setAttribute('aria-label',`${tool.label} for this task`);
  }
}

export function renderTaskToolLinks(){
  if(typeof document==='undefined')return 0;
  const engine=globalThis.CivweaveCerbanimoQuestV144,state=engine?.readState?.();
  if(!state?.quests)return 0;
  const cards=[...document.querySelectorAll('.cq144-task[data-quest-id][data-task-id]')];
  cards.forEach(card=>syncCard(card,state));
  return cards.length;
}

let queued=false,observer=null;
function schedule(){
  if(queued)return;
  queued=true;
  queueMicrotask(()=>{queued=false;renderTaskToolLinks()});
}
function init(){
  if(typeof document==='undefined')return;
  try{addEventListener('cerbanimo:quest-engine-changed',schedule)}catch{}
  const start=()=>{
    if(observer)return;
    const target=document.querySelector('#rc-app')||document.documentElement;
    observer=new MutationObserver(schedule);
    observer.observe(target,{childList:true,subtree:true});
    schedule();
  };
  if(document.readyState==='loading')addEventListener('DOMContentLoaded',start,{once:true});else start();
}

export const CivweaveCerbanimoTaskToolLinksV1=Object.freeze({TOOL_ORDER,TOOL_LABELS,toolsForTask,toolHref,renderTaskToolLinks});
if(typeof globalThis!=='undefined')globalThis.CivweaveCerbanimoTaskToolLinksV1=CivweaveCerbanimoTaskToolLinksV1;
init();
