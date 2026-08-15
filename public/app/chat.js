import { GUIDES } from './routes.js';

const $=selector=>document.querySelector(selector);
const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const now=()=>new Date().toISOString();
const guideId=()=>GUIDES[new URLSearchParams(location.search).get('guide')]?new URLSearchParams(location.search).get('guide'):'weaveling';
const threadKey=id=>`civweave.chat.${id}`;

function rows(id=guideId()){const value=parse(localStorage.getItem(threadKey(id)),[]);return Array.isArray(value)?value.slice(-120):[]}
function write(id,value){localStorage.setItem(threadKey(id),JSON.stringify(value.slice(-120)))}
function append(role,text){const id=guideId(),value=rows(id);value.push({role,text:clean(text),at:now()});write(id,value);render();return value}
function currentGuide(){return GUIDES[guideId()]||GUIDES.weaveling}
function deterministic(text){
  const {name,role}=currentGuide(),value=clean(text).toLowerCase();
  if(name==='Merlin'&&/\b(change|edit|layout|code|custom|move|replace|style)\b/.test(value))return 'I can stage user-authored customization in an isolated candidate. I will not rewrite Civweave production source. A candidate must pass its health check before it becomes active, and the previous customization remains the single rollback point.';
  if(name==='Moss')return 'Turn that into an observable learning goal, practice it against a real task, then keep evidence strong enough that another person can tell what you learned.';
  if(name==='Kamiya')return 'Define the visible result first, then the work units, acceptance criteria, proof, and who owns each commitment. That keeps the quest useful instead of ceremonial.';
  if(name==='Rook')return 'State what is offered or needed, quantity, timing, location constraints, and fair terms. Exchange works better when nobody has to reverse-engineer the deal from vibes.';
  if(/\b(next|continue|plan|wish|want|need|build|make)\b/.test(value))return 'Keep the next move small enough to inspect but large enough to matter. The four realm paths stay separate so learning, labor, exchange, and consent do not get blurred together.';
  return `${name} is your ${role.toLowerCase()}. I have your message and will keep the response tied to the current local context rather than inventing completed work.`;
}
async function answer(text){
  const runtime=globalThis.CivweaveModelRuntime;if(!runtime?.generateInteractive)return deterministic(text);
  const guide=currentGuide(),history=rows().slice(-12).map(row=>({role:row.role==='assistant'?'assistant':'user',content:row.text}));
  const result=await runtime.generateInteractive({purpose:`guide-chat-${guide.system}`,messages:[{role:'system',content:`You are ${guide.name}, ${guide.role}. Be concise, concrete, local-first, and explicit about consent. Do not claim actions happened unless the application actually performed them. Never use runtime production-source rewriting as a bug-fix path.`},...history],deterministic:()=>deterministic(text),fallback:()=>deterministic(text)});
  if(['success','fallback'].includes(result?.status))return clean(result.outputText)||deterministic(text);
  return `${deterministic(text)}\n\nProvider note: ${clean(result?.error?.message||result?.status||'unavailable',500)}`;
}
function render(){
  const id=guideId(),guide=currentGuide();document.documentElement.dataset.civweaveScreen=`chat-${id}`;document.title=`${guide.name} · Civweave`;
  $('#chat-avatar').src=guide.avatar;$('#chat-avatar').alt=guide.name;$('#chat-name').textContent=guide.name;$('#chat-role').textContent=guide.role;$('#chat-system').textContent=guide.system.toUpperCase();
  $('#chat-back').href=guide.system==='civweave'?'/app/campus.html':`/app/${guide.system}.html`;
  document.querySelectorAll('.chat-guides a').forEach(link=>link.setAttribute('aria-current',new URL(link.href).searchParams.get('guide')===id?'page':'false'));
  const log=$('#chat-log');log.replaceChildren();const value=rows(id);
  if(!value.length){const empty=document.createElement('div');empty.className='cw-empty';empty.textContent=`Start a conversation with ${guide.name}. This screen has no overlay manager, viewport repair runtime, or model prewarm hook.`;log.append(empty)}
  else for(const row of value){const node=document.createElement('div');node.className=`chat-message ${row.role==='assistant'?'assistant':'user'}`;node.textContent=row.text;log.append(node)}
  log.scrollTop=log.scrollHeight;
}
$('#chat-form')?.addEventListener('submit',async event=>{event.preventDefault();const input=$('#chat-input'),status=$('#chat-status'),text=clean(input?.value);if(!text)return;if(input)input.value='';append('user',text);if(status)status.textContent='Generating because you pressed Send…';try{append('assistant',await answer(text));if(status)status.textContent='Ready. No generative model starts from opening, focusing, or typing.'}catch(error){append('assistant',`${deterministic(text)}\n\nModel error: ${clean(error?.message||error,500)}`);if(status)status.textContent='Provider failed; local deterministic guidance remained available.'}});
render();
