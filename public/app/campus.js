import { SCREENS } from './routes.js';

const STATE_KEY='civweave.campus';
const THREAD_KEY='civweave.chat.weaveling';
const INTENTIONS_KEY='civweave.intentions';
const $=selector=>document.querySelector(selector);
const now=()=>new Date().toISOString();
const clean=(value,max=8000)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};

function readState(){const saved=parse(localStorage.getItem(STATE_KEY),{});return{mode:saved.mode==='roam'?'roam':'guided',wish:clean(saved.wish,4000),plan:saved.plan&&typeof saved.plan==='object'?saved.plan:null,progress:saved.progress&&typeof saved.progress==='object'?saved.progress:{},library:Array.isArray(saved.library)?saved.library:[],updatedAt:saved.updatedAt||''}}
function writeState(state){state.updatedAt=now();localStorage.setItem(STATE_KEY,JSON.stringify(state));return state}
function readThread(){const rows=parse(localStorage.getItem(THREAD_KEY),[]);return Array.isArray(rows)?rows.slice(-80):[]}
function writeThread(rows){localStorage.setItem(THREAD_KEY,JSON.stringify(rows.slice(-80)))}
function addMessage(role,text){const rows=readThread();rows.push({role,text:clean(text,12000),at:now()});writeThread(rows);renderThread();return rows}

function deterministicReply(text){
  const value=clean(text).toLowerCase();
  if(/\b(wish|want|need|build|make|learn|start|create|help)\b/.test(value))return 'I can turn that into a reviewable weave. I will keep learning, work, exchange, and governance separate so you can change one path without pretending the others are settled.';
  if(/\b(progress|next|continue)\b/.test(value))return 'The next useful move is the smallest step that produces inspectable evidence. Open the Weave view to choose a path, or a realm to do the work where it belongs.';
  if(/\b(model|ai|settings)\b/.test(value))return 'AI configuration lives on the Settings screen. Opening Settings does not start a generative model. Generation begins only after an explicit request.';
  return 'I have that. Keep the intention concrete enough that we can tell what changed in the world when it succeeds.';
}

async function replyTo(text){
  const runtime=globalThis.CivweaveModelRuntime;
  if(!runtime?.generateInteractive)return deterministicReply(text);
  const history=readThread().slice(-10).map(row=>({role:row.role==='assistant'?'assistant':'user',content:row.text}));
  const result=await runtime.generateInteractive({
    purpose:'civweave-chat',
    messages:[{role:'system',content:'You are Weaveling, Civweave’s concise central planning guide. Preserve uncertainty, explicit consent, and clear separation between learning, work, exchange, and governance. Do not invent completed actions.'},...history],
    deterministic:()=>deterministicReply(text),
    fallback:()=>deterministicReply(text)
  });
  if(['success','fallback'].includes(result?.status))return clean(result.outputText,12000)||deterministicReply(text);
  return `${deterministicReply(text)}\n\nModel note: ${clean(result?.error?.message||result?.status||'provider unavailable',500)}`;
}

function buildPlan(wish){
  const title=clean(wish,120).replace(/[.!?]+$/,'')||'Current intention';
  return{title,wish:clean(wish,4000),createdAt:now(),paths:[
    {id:'learning',realm:'living-school',title:'Learn what the intention requires',purpose:'Identify the capability gap, practice it, and keep evidence of what changed.',href:SCREENS.livingSchool.href},
    {id:'work',realm:'cerbanimo',title:'Turn the route into skilled work',purpose:'Define a visible result, checkpoints, proof, and ownership before committing labor.',href:SCREENS.cerbanimo.href},
    {id:'exchange',realm:'fellowfare',title:'Gather resources and exchange fairly',purpose:'Identify materials, services, people, timing, and fair terms needed to move.',href:SCREENS.fellowfare.href},
    {id:'governance',realm:'anarchadia',title:'Keep consent and review explicit',purpose:'Record boundaries, approvals, dissent, and the right to revise or stop.',href:SCREENS.anarchadia.href}
  ]};
}
function saveIntention(plan){const rows=parse(localStorage.getItem(INTENTIONS_KEY),[]);const list=Array.isArray(rows)?rows:[];list.unshift({id:`intent-${Date.now().toString(36)}`,state:'review',text:plan.title,plan,createdAt:plan.createdAt});localStorage.setItem(INTENTIONS_KEY,JSON.stringify(list.slice(0,100)))}

function renderThread(){const log=$('#campus-chat-log');if(!log)return;const rows=readThread();log.replaceChildren();if(!rows.length){const empty=document.createElement('div');empty.className='cw-empty';empty.textContent='Tell Weaveling what you want to make true. The chat is ordinary document content, not a second runtime layered over the page.';log.append(empty)}else for(const row of rows){const item=document.createElement('div');item.className=`campus-message ${row.role==='assistant'?'assistant':'user'}`;item.textContent=row.text;log.append(item)}log.scrollTop=log.scrollHeight}
function activeView(){const id=location.hash.replace(/^#/,'');return['weave','progress','library','home'].includes(id)?id:'weave'}
function renderWorkspace(){
  const state=readState(),view=activeView(),root=$('#workspace'),title=$('#view-title'),kicker=$('#view-kicker'),label=$('#state-label');if(!root)return;
  document.documentElement.dataset.civweaveScreen=view==='home'?'home':view;
  document.querySelectorAll('[data-view]').forEach(link=>link.setAttribute('aria-current',link.dataset.view===view?'page':'false'));
  root.replaceChildren();
  if(view==='home'){
    kicker.textContent='CAMPUS';title.textContent='Four realms, one intention';label.textContent=state.mode==='roam'?'Free roam':'Guided rails';
    root.innerHTML='<div class="workspace-grid"><article class="workspace-item"><small class="cw-kicker">LOCAL FIRST</small><h3>The browser is the application</h3><p>No historical source is selected at runtime. Git is the archive; this tree is the program.</p></article><article class="workspace-item"><small class="cw-kicker">MODEL BOUNDARY</small><h3>Submit-only generation</h3><p>MiniLM may stay available for semantic work. Generative inference begins only after an explicit request.</p></article></div>';
    return;
  }
  if(view==='weave'){
    kicker.textContent='YOUR WEAVE';title.textContent=state.plan?.title||'Current intention';label.textContent=state.plan?'Reviewable plan':'Local draft';
    if(!state.plan){root.innerHTML='<div class="cw-empty">No active weave yet. Message Weaveling with a wish and the first reviewable route will appear here.</div>';return}
    const grid=document.createElement('div');grid.className='workspace-grid';for(const path of state.plan.paths||[]){const article=document.createElement('article');article.className='workspace-item';article.innerHTML=`<small class="cw-kicker">${path.realm}</small><h3>${path.title}</h3><p>${path.purpose}</p><div class="workspace-actions"><a class="cw-button primary" href="${path.href}">Open realm</a></div>`;grid.append(article)}root.append(grid);return;
  }
  if(view==='progress'){
    kicker.textContent='PROGRESS';title.textContent='Evidence, not vibes';label.textContent='Local state';
    const paths=state.plan?.paths||[];if(!paths.length){root.innerHTML='<div class="cw-empty">Progress appears after a weave exists.</div>';return}
    const grid=document.createElement('div');grid.className='workspace-grid';for(const path of paths){const pct=Math.max(0,Math.min(100,Number(state.progress?.[path.id]||0)));const article=document.createElement('article');article.className='workspace-item';article.innerHTML=`<small class="cw-kicker">${path.realm}</small><h3>${path.title}</h3><p>${pct}% recorded progress</p><div class="progress-bar"><span style="width:${pct}%"></span></div>`;grid.append(article)}root.append(grid);return;
  }
  kicker.textContent='LIBRARY';title.textContent='Saved local work';label.textContent=`${state.library.length} saved`;
  if(!state.library.length){root.innerHTML='<div class="cw-empty">Nothing saved here yet. Realm work can add references and artifacts without turning this screen into another file warehouse.</div>';return}
  const grid=document.createElement('div');grid.className='workspace-grid';for(const item of state.library){const article=document.createElement('article');article.className='workspace-item';article.innerHTML=`<small class="cw-kicker">${clean(item.kind||'item',80)}</small><h3>${clean(item.title||'Saved item',180)}</h3><p>${clean(item.note||'',600)}</p>`;grid.append(article)}root.append(grid);
}
function syncMode(){const state=readState();document.querySelectorAll('[data-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mode===state.mode)))}
function syncLogo(){const image=$('#campus-logo');if(!image)return;const hour=new Date().getHours();image.src=hour>=6&&hour<18?'/app/logos/civweave-day-logo.jpg':'/app/logos/civweave-night-logo.jpg'}

$('#campus-chat-form')?.addEventListener('submit',async event=>{
  event.preventDefault();const input=$('#campus-chat-input'),status=$('#campus-chat-status'),text=clean(input?.value);if(!text)return;if(input)input.value='';addMessage('user',text);
  const state=readState();if(!state.plan&&text.length>2){state.wish=text;state.plan=buildPlan(text);writeState(state);saveIntention(state.plan);renderWorkspace()}
  if(status)status.textContent='Generating only because you pressed Send…';
  try{addMessage('assistant',await replyTo(text));if(status)status.textContent='Ready. No background generative work is running.'}catch(error){addMessage('assistant',`${deterministicReply(text)}\n\nModel error: ${clean(error?.message||error,500)}`);if(status)status.textContent='The provider failed; the local deterministic path stayed available.'}
});
document.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>{const state=readState();state.mode=button.dataset.mode==='roam'?'roam':'guided';writeState(state);syncMode();renderWorkspace()}));
addEventListener('hashchange',renderWorkspace);
addEventListener('pageshow',()=>{renderThread();renderWorkspace();syncMode();syncLogo()});
renderThread();renderWorkspace();syncMode();syncLogo();
if('serviceWorker'in navigator)navigator.serviceWorker.register('/service-worker.js').catch(error=>console.warn('[Civweave service worker]',error));
