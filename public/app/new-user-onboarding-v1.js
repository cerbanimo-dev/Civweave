(()=>{
'use strict';

const VERSION='1.0.0-new-user-onboarding-v1';
const STORAGE_KEY='civweave.onboarding.hero-tour.v1';
const ROOT_ID='cw-new-user-onboarding-v1';
if(globalThis.CivweaveNewUserOnboardingV1?.version===VERSION)return;

const SPRITES=Object.freeze({
  civweave:{sheet:'/Civweave-weaveling-sprites.png',guide:'Weaveling',realm:'Civweave Commons'},
  'living-school':{sheet:'/Living-School-moss-sprites.png',guide:'Moss',realm:'Living School'},
  cerbanimo:{sheet:'/Cerbanimo-kamiya-sprites.png',guide:'Kamiya',realm:'Cerbanimo'},
  fellowfare:{sheet:'/FellowFare-rook-sprites.png',guide:'Rook',realm:'FellowFare'},
  anarchadia:{sheet:'/Anarchadia-merlin-sprites.png',guide:'Merlin',realm:'Anarchadia'}
});

const EXPRESSIONS=Object.freeze({
  neutral:0,happy:1,excited:2,laughing:3,curious:4,thinking:5,confused:6,surprised:7,worried:8,sad:9,crying:10,shy:11,determined:12,proud:13,mischievous:14,sleepy:15,cheering:16,waving:17,pointing:18,special:19
});

const STEPS=Object.freeze([
  Object.freeze({
    system:'civweave',expression:'waving',kicker:'Welcome, Hero',title:'A wish becomes a Quest.',role:'Weaveling · Civweave Commons',
    paragraphs:[
      'Tell me what you want to make possible. I help turn that intention into a Quest: an editable route through learning, useful work, resources, and agreements.',
      'You can always work solo. Civweave simply makes it easier to find a Party when the road is better shared, and a Guild when you want a dependable community around the work.'
    ],
    connection:'Your Quest stays connected across every realm. Learning needs can go to Moss, work to Kamiya, resources to Rook, and consent or civic questions to Merlin without becoming five unrelated projects.',
    handoff:'Moss is first. She can show you how a Hero gets ready for the work a Quest requires.',next:'Meet Moss'
  }),
  Object.freeze({
    system:'living-school',expression:'special',kicker:'Living School',title:'Learn what the Quest requires.',role:'Moss · Learning guide',
    paragraphs:[
      'I build learning around what you are actually trying to do. Explanations, practice, projects, feedback, and demonstrated competence all serve the Quest instead of becoming homework for its own sake.',
      'When you prove a skill here, that evidence can travel with you. A learning path can become readiness for real work rather than ending at a certificate-shaped wall.'
    ],
    connection:'Living School feeds capability into Cerbanimo, while FellowFare can help source learning materials and Anarchadia can preserve community rules around access, validation, and recognition.',
    handoff:'Kamiya takes what you can do and helps turn it into accountable, useful work.',next:'Meet Kamiya'
  }),
  Object.freeze({
    system:'cerbanimo',expression:'special',kicker:'Cerbanimo',title:'Turn capability into useful work.',role:'Kamiya · Fox engineer and Questwright',
    paragraphs:[
      'I help break a Quest into deliverables, match the work to skills, document contribution, and keep validation and credit attached to what was actually done.',
      'A Hero may work alone, but a Party can combine different strengths around the same Quest. The goal is cooperation without making everyone endure a tiny bureaucracy just to build something together.'
    ],
    connection:'Cerbanimo can pull proven skills from Living School, ask FellowFare for materials or services, and send role, consent, or governance questions to Anarchadia while the same Quest remains the thread connecting them.',
    handoff:'Rook keeps the practical exchange layer legible, because noble intentions remain stubbornly dependent on tools, materials, time, and other humans.',next:'Meet Rook'
  }),
  Object.freeze({
    system:'fellowfare',expression:'special',kicker:'FellowFare',title:'Find what the Party needs.',role:'Rook · Exchange guide',
    paragraphs:[
      'I help Heroes find needs, offers, goods, services, gifts, and fair exchanges across the reachable network. A Quest can ask for resources without turning every relationship into a storefront.',
      'What you find here can attach back to the work: a tool, a service, a supplier, a gift, or another Hero who has exactly the strange little capability your Party was missing.'
    ],
    connection:'FellowFare receives practical needs from Quests and sends fulfilled resources back into them. The exchange remains connected to Cerbanimo work, Living School capability, and the rules communities choose in Anarchadia.',
    handoff:'Merlin guards the civic layer, where cooperation gets boundaries, consent, review, and rules that can outlive one charismatic person.',next:'Meet Merlin'
  }),
  Object.freeze({
    system:'anarchadia',expression:'special',kicker:'Anarchadia',title:'Keep cooperation answerable to people.',role:'Merlin · Civic and governance guide',
    paragraphs:[
      'I help with Passports, intentions, consent, roles, proposals, review, tribunals, and the rules a community chooses for itself. The point is not more procedure. The point is making power visible and revisable.',
      'Guild Quartermasters keep local infrastructure dependable and look for Heroes to join their Guild. They are caretakers of the hearth, not rulers of the Heroes gathered around it.'
    ],
    connection:'Anarchadia supplies the civic memory beneath the other realms: who agreed to what, what can change, how disputes are reviewed, and how a Guild remains governed by its people instead of by whoever happens to run the server.',
    handoff:'That is the circuit. Find a Guild, gather a Party when it helps, begin a Quest, and move left to right only as far as the work actually needs.',next:'Begin your Quest'
  })
]);

let root=null;
let index=0;
let previousFocus=null;
let inertState=[];

const clean=value=>String(value??'').trim();
const safeParse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
function readRecord(){try{return safeParse(localStorage.getItem(STORAGE_KEY),null)}catch{return null}}
function writeRecord(status){try{localStorage.setItem(STORAGE_KEY,JSON.stringify({schema:'civweave.hero-onboarding.v1',version:VERSION,status,at:new Date().toISOString()}))}catch{}}
function clearRecord(){try{localStorage.removeItem(STORAGE_KEY)}catch{}}
function hasRows(key){try{const value=safeParse(localStorage.getItem(key),null);return Array.isArray(value)?value.length>0:Boolean(value&&typeof value==='object'&&Object.keys(value).length)}catch{return false}}
function hasMeaningfulPriorActivity(){
  if(hasRows('civweave.intentions.v127')||hasRows('civweave.cerbanimo.quest-queue.v1'))return true;
  try{const campus=safeParse(localStorage.getItem('civweave.working-campus.v1'),{});return Boolean(clean(campus?.wish)||campus?.plan)}catch{return false}
}
function forcedByUrl(){const value=new URLSearchParams(location.search).get('onboarding');return value==='1'||value==='tour'||value==='replay'}
function shouldAutoOpen(){
  if(forcedByUrl())return true;
  const record=readRecord();
  if(record?.status==='completed'||record?.status==='skipped')return false;
  return !hasMeaningfulPriorActivity();
}
function spritePosition(expression){const i=expression==='special'?19:(EXPRESSIONS[expression]??0);return{x:`${(i%5)*25}%`,y:`${Math.floor(i/5)*33.333333}%`}}
function escapeHtml(value){return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;')}
function focusables(){return root?[...root.querySelectorAll('button,[href],[tabindex]:not([tabindex="-1"])')].filter(node=>!node.disabled&&!node.hidden):[]}
function setPageInert(value){
  const targets=[document.querySelector('main.app'),document.querySelector('nav.bottom')].filter(Boolean);
  if(value){inertState=targets.map(node=>({node,inert:Boolean(node.inert)}));for(const {node} of inertState)node.inert=true}
  else{for(const {node,inert} of inertState)node.inert=inert;inertState=[]}
}
function highlight(system){
  document.querySelectorAll('[data-cw-onboarding-highlight]').forEach(node=>node.removeAttribute('data-cw-onboarding-highlight'));
  const target=system==='civweave'?document.querySelector('aside.guide'):document.querySelector(`.realm-node[data-realm="${system}"]`);
  target?.setAttribute('data-cw-onboarding-highlight','true');
}
function railMarkup(){return STEPS.map((step,i)=>`<button class="cw-onboarding-stop" type="button" data-cw-onboarding-step="${i}"><b>${escapeHtml(SPRITES[step.system].guide)}</b><span>${escapeHtml(SPRITES[step.system].realm)}</span></button>`).join('')}
function createRoot(){
  if(root?.isConnected)return root;
  root=document.createElement('section');
  root.id=ROOT_ID;
  root.className='cw-onboarding';
  root.hidden=true;
  root.setAttribute('role','dialog');
  root.setAttribute('aria-modal','true');
  root.setAttribute('aria-labelledby','cw-onboarding-title');
  root.innerHTML=`<div class="cw-onboarding-card"><header class="cw-onboarding-top"><small>Optional Civweave orientation</small><button class="cw-onboarding-skip" type="button" data-cw-onboarding-skip>Skip tour</button></header><nav class="cw-onboarding-rail" aria-label="Guide handoff order">${railMarkup()}</nav><div class="cw-onboarding-stage"><div class="cw-onboarding-character"><div class="cw-onboarding-avatar" role="img"></div></div><div class="cw-onboarding-copy"><p class="cw-onboarding-kicker"></p><h2 id="cw-onboarding-title"></h2><p class="cw-onboarding-role"></p><div data-cw-onboarding-paragraphs></div><div class="cw-onboarding-connection"></div><div class="cw-onboarding-handoff"></div><p class="cw-onboarding-note">This tour explains the story-world language. The underlying technical systems remain local-first software, and none of these steps commits you to a Quest, Party, or Guild.</p><div class="cw-onboarding-actions"><div class="cw-onboarding-action-group"><button class="cw-onboarding-back" type="button" data-cw-onboarding-back>Back</button><button class="cw-onboarding-next" type="button" data-cw-onboarding-next></button></div><span class="cw-onboarding-progress" aria-live="polite"></span></div></div></div></div>`;
  document.body.append(root);
  root.addEventListener('click',event=>{
    const stepButton=event.target.closest?.('[data-cw-onboarding-step]');
    if(stepButton){show(Number(stepButton.dataset.cwOnboardingStep)||0);return}
    if(event.target.closest?.('[data-cw-onboarding-skip]')){close('skipped');return}
    if(event.target.closest?.('[data-cw-onboarding-back]')){show(Math.max(0,index-1));return}
    if(event.target.closest?.('[data-cw-onboarding-next]')){if(index>=STEPS.length-1)close('completed');else show(index+1)}
  });
  root.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();close('skipped');return}
    if(event.key!=='Tab')return;
    const nodes=focusables();if(!nodes.length)return;
    const first=nodes[0],last=nodes[nodes.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  });
  return root;
}
function renderRail(){
  root.querySelectorAll('[data-cw-onboarding-step]').forEach((button,i)=>{
    button.dataset.state=i<index?'done':i===index?'current':'upcoming';
    if(i===index)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');
  });
  root.querySelector('[data-cw-onboarding-step][aria-current="step"]')?.scrollIntoView?.({block:'nearest',inline:'center',behavior:'smooth'});
}
function show(nextIndex){
  if(!root?.isConnected)createRoot();
  index=Math.max(0,Math.min(STEPS.length-1,Number(nextIndex)||0));
  const step=STEPS[index],sprite=SPRITES[step.system],position=spritePosition(step.expression);
  const avatar=root.querySelector('.cw-onboarding-avatar');
  avatar.style.setProperty('--cw-onboarding-sheet',`url("${sprite.sheet}")`);
  avatar.style.setProperty('--cw-onboarding-x',position.x);
  avatar.style.setProperty('--cw-onboarding-y',position.y);
  avatar.setAttribute('aria-label',`${sprite.guide}, ${step.expression==='special'?'realm guide':step.expression}`);
  avatar.style.animation='none';void avatar.offsetWidth;avatar.style.animation='';
  root.querySelector('.cw-onboarding-kicker').textContent=step.kicker;
  root.querySelector('#cw-onboarding-title').textContent=step.title;
  root.querySelector('.cw-onboarding-role').textContent=step.role;
  root.querySelector('[data-cw-onboarding-paragraphs]').innerHTML=step.paragraphs.map(text=>`<p>${escapeHtml(text)}</p>`).join('');
  root.querySelector('.cw-onboarding-connection').textContent=step.connection;
  root.querySelector('.cw-onboarding-handoff').textContent=step.handoff;
  const back=root.querySelector('[data-cw-onboarding-back]');back.hidden=index===0;
  root.querySelector('[data-cw-onboarding-next]').textContent=index===STEPS.length-1?step.next:`${step.next} →`;
  root.querySelector('.cw-onboarding-progress').textContent=`${index+1} of ${STEPS.length} · ${sprite.guide}`;
  renderRail();highlight(step.system);
  try{dispatchEvent(new CustomEvent('civweave:onboarding-step',{detail:{version:VERSION,index,system:step.system,guide:sprite.guide}}))}catch{}
}
function open({step=0,force=false}={}){
  if(!force&&!shouldAutoOpen())return false;
  createRoot();
  if(!root.hidden)return true;
  previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
  root.hidden=false;document.body.classList.add('cw-onboarding-open');setPageInert(true);show(step);
  root.querySelector('[data-cw-onboarding-skip]')?.focus({preventScroll:true});
  try{dispatchEvent(new CustomEvent('civweave:onboarding-opened',{detail:{version:VERSION,forced:Boolean(force||forcedByUrl())}}))}catch{}
  return true;
}
function close(status='completed'){
  if(!root?.isConnected||root.hidden)return false;
  if(status==='completed'||status==='skipped')writeRecord(status);
  root.hidden=true;document.body.classList.remove('cw-onboarding-open');setPageInert(false);highlight('');
  previousFocus?.focus?.({preventScroll:true});previousFocus=null;
  try{dispatchEvent(new CustomEvent(`civweave:onboarding-${status}`,{detail:{version:VERSION,status}}))}catch{}
  return true;
}
function reset({openNow=false}={}){clearRecord();if(openNow)open({force:true});return true}
function status(){return{version:VERSION,record:readRecord(),open:Boolean(root&&!root.hidden),step:index,autoEligible:shouldAutoOpen()}}
function bindReplay(){
  const button=document.querySelector('[data-cw-onboarding-replay]');
  if(!button||button.dataset.cwOnboardingReplayBound==='true')return false;
  button.dataset.cwOnboardingReplayBound='true';
  button.addEventListener('click',()=>open({force:true}));
  return true;
}
function boot(){createRoot();bindReplay();if(shouldAutoOpen())requestAnimationFrame(()=>requestAnimationFrame(()=>open({force:true})))}

globalThis.CivweaveNewUserOnboardingV1=Object.freeze({version:VERSION,storageKey:STORAGE_KEY,steps:STEPS,sprites:SPRITES,open,close,reset,status,bindReplay,autoSkipsExistingActivity:true,soloAllowed:true,partyEncouraged:true,guildStewardLore:'Quartermaster',runtimeInjection:false,replayControl:true});
if(document.readyState==='loading')addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
