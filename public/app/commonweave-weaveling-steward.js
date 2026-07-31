(()=>{
'use strict';
const VERSION='1.1.0';
const KEY='commonweave.weaveling.steward.v2';
const uid=(p='w')=>`${p}-${crypto.randomUUID?.()||Date.now()+'-'+Math.random().toString(16).slice(2)}`;
const now=()=>new Date().toISOString();
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const clone=v=>JSON.parse(JSON.stringify(v));
const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch{return null}};
const write=s=>{s.updatedAt=now();localStorage.setItem(KEY,JSON.stringify(s));return s};
const bus=new EventTarget();
const vague=/^(so )?what (do|should) i do( now)?\??$|^help( me)?\??$|^guide me( please)?\??$|^how do i start( my quest)?\??$/i;
const question=/^(who|what|when|where|why|how|can|could|should|is|are|do|does|tell me|explain)\b/i;
const skillCatalog=[
 ['concept-design','Concept design','Turning the wish into a coherent experience, rule set, or service.'],
 ['research','Research','Finding reliable knowledge, examples, constraints, and references.'],
 ['planning','Planning','Breaking a large outcome into ordered, testable work.'],
 ['technical-build','Technical building','Using the tools, code, craft, or production methods required.'],
 ['visual-communication','Visual communication','Explaining the intention through images, interfaces, writing, or demonstrations.'],
 ['collaboration','Collaboration','Coordinating people, feedback, roles, and shared decisions.'],
 ['testing','Testing and verification','Checking whether the result works, is safe, and meets the intended outcome.'],
 ['distribution','Release and stewardship','Publishing, maintaining, teaching, delivering, or sustaining the result.']
];
function inferSkills(intent){const q=clean(intent).toLowerCase();const wanted=new Set(['research','planning','testing']);
 if(/game|app|site|software|code|program|digital|platform/.test(q))['concept-design','technical-build','visual-communication','distribution'].forEach(x=>wanted.add(x));
 if(/art|film|story|music|design|comic|animation|visual/.test(q))['concept-design','visual-communication','distribution'].forEach(x=>wanted.add(x));
 if(/community|team|friends|collective|people|mutual|event/.test(q))['collaboration','distribution'].forEach(x=>wanted.add(x));
 if(/build|make|repair|garden|food|cabin|physical/.test(q))['technical-build','collaboration','testing'].forEach(x=>wanted.add(x));
 return skillCatalog.filter(([id])=>wanted.has(id)).map(([id,name,description])=>({id,name,description,level:null,required:3,approach:'assess'}));
}
function newSession(wish){const active=window.CommonweaveIntentionOrchestrator?.active?.();const useActive=vague.test(clean(wish))&&active;const intent=useActive?active.intent||active.title:clean(wish);return write({id:uid('weaveling'),stage:'confirm',wish:clean(wish),intent,title:active?.title||intent.slice(0,140),activeIntentionId:useActive?active.id:null,success:active?.success||'',constraints:{deadline:'',budget:'',mustKeep:''},skills:inferSkills(intent),knowledge:[],materials:[],tasks:[],tour:[],messages:[],createdAt:now(),updatedAt:now()})}
function session(){return read()}
function reset(){localStorage.removeItem(KEY);bus.dispatchEvent(new CustomEvent('changed',{detail:null}))}
function set(patch){const s=read()||newSession('');Object.assign(s,patch);write(s);bus.dispatchEvent(new CustomEvent('changed',{detail:clone(s)}));return clone(s)}
function answerSkill(id,level){const s=read();if(!s)return null;const skill=s.skills.find(x=>x.id===id);if(skill)skill.level=Math.max(0,Math.min(4,Number(level)));write(s);return clone(s)}
function allSkillsAnswered(s=read()){return !!s?.skills?.length&&s.skills.every(x=>Number.isFinite(x.level))}
function inferNeeds(s){const gaps=s.skills.filter(x=>x.level<x.required);const knowledge=gaps.map(x=>({id:uid('know'),title:`Learn or verify ${x.name}`,detail:x.description,skillId:x.id,system:'living'}));
 const q=s.intent.toLowerCase();const materials=[];
 if(/game|app|software|website|code/.test(q))materials.push({id:uid('mat'),title:'Development environment and source repository',detail:'A working toolchain, versioned source, test device, and backup.',system:'fellowfare'});
 if(/film|video|youtube|animation/.test(q))materials.push({id:uid('mat'),title:'Media production tools and rights-cleared assets',detail:'Capture, editing, storage, audio, captions, and permission records.',system:'fellowfare'});
 if(/build|cabin|garden|repair|physical/.test(q))materials.push({id:uid('mat'),title:'Physical materials, tools, workspace, and safety equipment',detail:'Confirm quantities, availability, transport, safe use, and storage.',system:'fellowfare'});
 if(!materials.length)materials.push({id:uid('mat'),title:'Tools, references, and working space',detail:'Confirm what is already available and what must be borrowed, bought, made, or requested.',system:'fellowfare'});
 const tasks=[
 {id:uid('task'),title:'Define the smallest complete outcome',detail:'Write a testable statement of what exists when this intention succeeds.',system:'commonweave',status:'planned'},
 ...knowledge.map(k=>({id:uid('task'),title:k.title,detail:`Complete a focused learning and practice loop for ${k.title.replace(/^Learn or verify /,'')}.`,system:'living',status:'planned'})),
 {id:uid('task'),title:'Confirm materials, people, and access',detail:'Secure every required tool, asset, collaborator, permission, and workspace.',system:'fellowfare',status:'planned'},
 {id:uid('task'),title:'Build the first demonstrable version',detail:'Create the smallest version that proves the central idea works.',system:'cerbanimo',status:'planned'},
 {id:uid('task'),title:'Test with evidence and revise',detail:'Run the success checks, preserve proof, gather feedback, and repair failures.',system:'cerbanimo',status:'planned'},
 {id:uid('task'),title:'Review collective effects and decisions',detail:'When others are affected, make consent, governance, ownership, and maintenance decisions explicit.',system:'anarchadia',status:'planned'},
 {id:uid('task'),title:'Release, reflect, and choose the next thread',detail:'Publish or deliver the result, record what changed, and decide what continues.',system:'commonweave',status:'planned'}
 ];
 const tour=[
 {system:'commonweave',label:'Commonweave',purpose:'Clarify the intention, success conditions, constraints, capabilities, and route.'},
 ...(knowledge.length?[{system:'living',label:'Living School',purpose:'Close knowledge and skill gaps through focused learning and practica.'}]:[]),
 {system:'fellowfare',label:'FellowFare',purpose:'Find materials, people, tools, services, and mutual-aid support.'},
 {system:'cerbanimo',label:'Cerbanimo',purpose:'Turn the approved route into an executable project, tasks, evidence, and reviews.'},
 {system:'anarchadia',label:'Anarchadia',purpose:'Handle shared consequences, consent, governance, and durable collective decisions.'},
 {system:'commonweave',label:'Commonweave',purpose:'Monitor progress, preserve the chronicle, and transport the next active context.'}
 ];
 return {...s,knowledge,materials,tasks,tour,stage:'plan'}
}
async function enrichPlan(base){const runtime=window.CommonweaveModelRuntime;if(!runtime?.generateInteractive)return base;try{const result=await runtime.generateInteractive({purpose:'weaveling-intention-tour-plan',responseFormat:'json',schema:{type:'object',properties:{title:{type:'string'},success:{type:'string'},knowledge:{type:'array',items:{type:'object',properties:{title:{type:'string'},detail:{type:'string'}},required:['title','detail']}},materials:{type:'array',items:{type:'object',properties:{title:{type:'string'},detail:{type:'string'}},required:['title','detail']}},tasks:{type:'array',items:{type:'object',properties:{title:{type:'string'},detail:{type:'string'},system:{type:'string',enum:['commonweave','living','fellowfare','cerbanimo','anarchadia']}},required:['title','detail','system']}}},required:['title','success','knowledge','materials','tasks']},system:'You are Weaveling, Commonweave’s humble intention steward. Produce a concise, complete, realistic, editable plan. Preserve user agency. Never imply that anything has been created or approved. Separate knowledge gaps, material/resource needs, and executable tasks. Route each task to the best Commonweave realm.',prompt:JSON.stringify({intent:base.intent,success:base.success,constraints:base.constraints,skills:base.skills,deterministicDraft:{knowledge:base.knowledge,materials:base.materials,tasks:base.tasks}}),deterministic:()=>({title:base.title,success:base.success||`A demonstrable outcome exists for: ${base.intent}`,knowledge:base.knowledge,materials:base.materials,tasks:base.tasks})});const x=result.outputJson||{};return {...base,title:clean(x.title||base.title),success:clean(x.success||base.success),knowledge:(x.knowledge||base.knowledge).slice(0,16).map(v=>({...v,id:uid('know'),system:'living'})),materials:(x.materials||base.materials).slice(0,16).map(v=>({...v,id:uid('mat'),system:'fellowfare'})),tasks:(x.tasks||base.tasks).slice(0,30).map(v=>({...v,id:uid('task'),status:'planned'}))}}catch{return base}}
async function buildPlan(){let s=read();if(!s)return null;s=inferNeeds(s);s=await enrichPlan(s);write(s);bus.dispatchEvent(new CustomEvent('changed',{detail:clone(s)}));return clone(s)}
function updateField(path,value){const s=read();if(!s)return null;const keys=path.split('.');let o=s;while(keys.length>1){const k=keys.shift();o[k]=o[k]||{};o=o[k]}o[keys[0]]=clean(value);write(s);return clone(s)}
function updateTask(id,patch){const s=read();const t=s?.tasks?.find(x=>x.id===id);if(t)Object.assign(t,patch);write(s);return clone(s)}
function addTask(system='cerbanimo'){const s=read();s.tasks.push({id:uid('task'),title:'New step',detail:'Describe the result and evidence required.',system,status:'planned'});write(s);return clone(s)}
function removeTask(id){const s=read();s.tasks=s.tasks.filter(x=>x.id!==id);write(s);return clone(s)}
function approve(){const s=read();if(!s||s.stage!=='plan')return null;const intention=window.CommonweaveIntentionOrchestrator?.create?.({title:s.title,intent:s.intent,success:s.success,source:'weaveling',systems:[...new Set(s.tasks.map(x=>x.system))],constraints:s.constraints,steps:s.tasks.map((t,i)=>({id:t.id,title:t.title,system:t.system,status:'planned',priority:i+1,definitionOfDone:t.detail,notes:t.detail}))});s.stage='monitor';s.intentionId=intention?.id||s.activeIntentionId;s.approvedAt=now();write(s);window.CommonweaveActionableQuad?.addMessage?.('assistant',`I am watching “${s.title}”. I will keep the next step visible and carry its approved context between realms.`,{intentionId:s.intentionId,weaveling:true});return {session:clone(s),intention}}
function status(){const s=read();const intention=(s?.intentionId&&window.CommonweaveIntentionOrchestrator?.list?.().find(x=>x.id===s.intentionId))||window.CommonweaveIntentionOrchestrator?.active?.();const explained=intention?window.CommonweaveIntentionOrchestrator?.explain?.(intention):null;return {session:clone(s),intention:clone(intention),explained}}
function nextRealm(){const st=status(),next=st.explained?.next;return next?.system||st.session?.tour?.find(x=>x.system!=='commonweave')?.system||'commonweave'}
function transport(system){const s=read(),st=status();const target=system||nextRealm();const payload={schema:'commonweave.weaveling-handoff.v1',source:'commonweave',target,intentionId:st.intention?.id||s?.intentionId||null,title:st.intention?.title||s?.title||'Active intention',intent:st.intention?.intent||s?.intent||'',success:st.intention?.success||s?.success||'',skills:s?.skills||[],knowledge:s?.knowledge||[],materials:s?.materials||[],tasks:s?.tasks||[],next:st.explained?.next||null,approved:true,createdAt:now()};localStorage.setItem(`commonweave.approved-handoffs.${target}.v1`,JSON.stringify([payload,...(()=>{try{return JSON.parse(localStorage.getItem(`commonweave.approved-handoffs.${target}.v1`)||'[]')}catch{return[]}})()].slice(0,100)));window.CommonweaveActionableQuad?.setRoute?.('square',target,`Continue “${payload.title}” in ${target}`);return payload}
async function directAnswer(query){const runtime=window.CommonweaveModelRuntime;if(!runtime?.generateInteractive)return {answer:'I can help turn this into an intention, or we can continue the active intention. Tell me which outcome you are trying to reach.'};try{const r=await runtime.generateInteractive({purpose:'weaveling-direct-answer',prompt:query,system:'You are Weaveling, a flexible Commonweave guide. Answer the user’s direct question clearly and briefly. When their query is actually about beginning or continuing an intention, orient them to the next concrete step rather than inventing a new intention.',deterministic:()=>({answer:'Start by naming the concrete outcome you want to exist. I will then map the skills, knowledge, materials, tasks, and realm-by-realm route.'})});return {answer:r.outputText||r.outputJson?.answer||'I can help you map the next step.'}}catch{return {answer:'Start by naming the concrete outcome you want to exist. I will then map the skills, knowledge, materials, tasks, and realm-by-realm route.'}}}
function interpret(input){const s=read(),q=clean(input);if(vague.test(q)&&s)return {kind:'resume',session:clone(s)};if(vague.test(q)&&window.CommonweaveIntentionOrchestrator?.active?.())return {kind:'active',session:newSession(q)};if(question.test(q)&&q.length<180&&!/i want|i wish|my goal|build|make|create|start/.test(q.toLowerCase()))return {kind:'answer'};return {kind:'intake',session:newSession(q)}}
window.CommonweaveWeavelingSteward={VERSION,bus,session,reset,set,interpret,answerSkill,allSkillsAnswered,buildPlan,updateField,updateTask,addTask,removeTask,approve,status,nextRealm,transport,directAnswer};
})();
