import {ACTIONS_KEY,INTENTIONS_KEY,CAMPUS_KEY,VIEWS,normalizeAction,normalizeStore,mergeSavedPlans,projectBoard,selectActions} from './shared/action-board-core-v1.mjs';

const VERSION='1.0.0-action-board-v1';
const ID='cw-action-board-v1';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={inbox:'Inbox',next:'Ready',focus:'Focus',waiting:'Waiting',scheduled:'Scheduled',someday:'Someday',done:'Logbook'};
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
let view='next',time='',energy='',query='',dialog=null,returnFocus=null,warning='';
function readKey(key,fallback){try{return parse(localStorage.getItem(key),fallback)}catch{return fallback}}
function readStore(){return normalizeStore(readKey(ACTIONS_KEY,{}))}
function writeStore(store){
  const normalized=normalizeStore(store);
  try{
    localStorage.setItem(ACTIONS_KEY,JSON.stringify(normalized));
    warning='';
    dispatchEvent(new CustomEvent('civweave:action-board-updated',{detail:{version:VERSION}}));
    render();
    return true;
  }catch(error){
    warning='Unable to save locally ('+(error?.name||'storage error')+'). Free storage or allow site data, then retry.';
    render();return false;
  }
}
function allActions(){
  return projectBoard(readStore(),mergeSavedPlans(readKey(INTENTIONS_KEY,[]),readKey(CAMPUS_KEY,{})));
}
function itemMeta(a){
  const meta=[];
  if(a.source==='quest')meta.push(a.questTitle||'Quest',a.realm||'Unassigned realm');
  else meta.push('Personal action',a.context||'Local only');
  if(a.minutes)meta.push(a.minutes+' min');
  if(a.energy)meta.push(a.energy+' energy');
  if(a.startAt)meta.push('Start: '+a.startAt.slice(0,10));
  if(a.dueAt)meta.push('Due: '+a.dueAt.slice(0,10));
  return meta.filter(Boolean).map(esc).join(' · ');
}
function row(a){
  const focus='<button type="button" data-cw-ab-action="focus" data-key="'+esc(a.key)+'" aria-pressed="'+Boolean(a.focus)+'">'+(a.focus?'Unfocus':'Focus')+'</button>';
  let actions='';
  if(a.source==='quest'){
    actions=focus+'<button type="button" data-cw-ab-action="open-quest" data-key="'+esc(a.key)+'">View Quests</button>';
  }else{
    const options=['inbox','next','waiting','scheduled','someday','done'].map(s=>'<option value="'+s+'"'+(s===a.status?' selected':'')+'>'+labels[s]+'</option>').join('');
    actions='<label class="cw-ab-muted">Move to <select aria-label="Change action state" data-cw-ab-status="'+esc(a.id)+'">'+options+'</select></label>'+focus;
    if(a.status!=='done')actions+='<button type="button" data-cw-ab-action="done" data-key="'+esc(a.key)+'">Mark done</button>';
  }
  return '<article class="cw-ab-item"><h3>'+esc(a.title)+'</h3><small class="cw-ab-source">'+itemMeta(a)+'</small>'+
    (a.reason?'<p class="cw-ab-reason">'+esc(a.reason)+'</p>':'')+
    '<div class="cw-ab-actions">'+actions+'</div></article>';
}
function render(){
  if(!dialog||!dialog.isConnected)return;
  const actions=allActions();
  const counts={};
  for(const s of VIEWS)counts[s]=selectActions(actions,{view:s}).length;
  const tabs=VIEWS.map(v=>'<button type="button" data-cw-ab-view="'+v+'" aria-current="'+(view===v)+'">'+labels[v]+' <span aria-hidden="true">'+counts[v]+'</span></button>').join('');
  const matches=selectActions(actions,{view,minutes:time,energy,query});
  dialog.querySelector('.cw-ab-tabs').innerHTML=tabs;
  const grid=dialog.querySelector('.cw-ab-items');
  grid.innerHTML=matches.length?matches.map(row).join(''):'<p class="cw-ab-empty">No matching actions. Capture something above, or choose another view.</p>';
  dialog.querySelector('.cw-ab-status').textContent=warning;
  const filter=dialog.querySelector('.cw-ab-filter');
  filter.querySelector('[name="time"]').value=time;
  filter.querySelector('[name="energy"]').value=energy;
  filter.querySelector('[name="search"]').value=query;
  filter.querySelector('[name="time"]').disabled=!['next','focus'].includes(view);
  filter.querySelector('[name="energy"]').disabled=!['next','focus'].includes(view);
  dialog.querySelector('.cw-ab-count').textContent=actions.filter(x=>x.status==='next').length+' available action(s) · Personal actions are stored on this device';
}
function create(){
  if(dialog)return dialog;
  dialog=document.createElement('dialog');dialog.id=ID;dialog.setAttribute('aria-labelledby','cw-ab-title');
  dialog.innerHTML='<div class="cw-ab-inner">'+
    '<header class="cw-ab-head"><div><h2 id="cw-ab-title">Ready Now</h2><small class="cw-ab-muted cw-ab-count">Device-local actions</small></div><button type="button" class="cw-ab-close" aria-label="Close Ready Now">×</button></header>'+
    '<div class="cw-ab-body"><form class="cw-ab-capture"><label for="cw-ab-title-input">Capture an idea or action</label>'+
    '<div class="cw-ab-capture-row"><input id="cw-ab-title-input" name="title" maxlength="300" placeholder="Something on your mind…" required><button type="submit" class="cw-ab-primary">Add to Inbox</button></div>'+
    '<details><summary>Optional details</summary><div class="cw-ab-details">'+
    '<label>Minutes <input type="number" name="minutes" min="1" max="10080" inputmode="numeric" placeholder="Estimate"></label>'+
    '<label>Energy <select name="energy"><option value="">Unestimated</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>'+
    '<label>Start date <input type="date" name="startAt"></label><label>Due date <input type="date" name="dueAt"></label>'+
    '<label>Context <input name="context" maxlength="100" placeholder="Place or equipment"></label>'+
    '<label>Notes <input name="notes" maxlength="4000" placeholder="Any useful details"></label></div></details></form>'+
    '<nav class="cw-ab-tabs" aria-label="Action views"></nav>'+
    '<div class="cw-ab-filter"><select name="time" aria-label="Available time"><option value="">Any duration</option><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">60 minutes</option><option value="120">2 hours</option></select>'+
    '<select name="energy" aria-label="Available energy"><option value="">Any energy</option><option value="low">Low energy</option><option value="medium">Medium energy</option><option value="high">High energy</option></select>'+
    '<input name="search" aria-label="Search actions" placeholder="Search actions"></div>'+
    '<section class="cw-ab-items" aria-live="polite"></section><p class="cw-ab-status" role="status"></p>'+
    '<p class="cw-ab-muted">Saved Quest beats are read-only here. To complete them or change their status, use their existing Quest workflow. Unestimated actions are excluded by time and energy filters.</p></div></div>';
  document.body.append(dialog);
  dialog.querySelector('.cw-ab-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{if(returnFocus?.isConnected)try{returnFocus.focus({preventScroll:true})}catch{}returnFocus=null});
  dialog.querySelector('.cw-ab-capture').addEventListener('submit',event=>{
    event.preventDefault();
    const form=event.currentTarget,data=new FormData(form),title=String(data.get('title')||'').trim();
    if(!title)return;
    const now=new Date().toISOString(),store=readStore();
    if(store.actions.length>=1000){warning='Personal action limit reached (1,000). Complete or export existing items before capturing more.';render();return;}
    const id=globalThis.crypto?.randomUUID?.()||'local-'+Date.now()+'-'+Math.random().toString(36).slice(2,9);
    store.actions.unshift(normalizeAction({id,title,notes:data.get('notes'),minutes:data.get('minutes'),energy:data.get('energy'),
      context:data.get('context'),startAt:data.get('startAt'),dueAt:data.get('dueAt'),status:'inbox',createdAt:now,updatedAt:now},now));
    if(writeStore(store)){form.reset();view='inbox';render();form.querySelector('[name="title"]').focus();}
  });
  dialog.querySelector('.cw-ab-tabs').addEventListener('click',event=>{
    const next=event.target.closest('[data-cw-ab-view]')?.dataset.cwAbView;
    if(VIEWS.includes(next)){view=next;render();}
  });
  dialog.querySelector('.cw-ab-items').addEventListener('click',event=>{
    const button=event.target.closest('[data-cw-ab-action]');if(!button)return;
    const action=button.dataset.cwAbAction,key=button.dataset.key,store=readStore();
    if(action==='open-quest'){
      dialog.close();
      if(globalThis.CivweaveWorkingCampusV156?.openQuest)globalThis.CivweaveWorkingCampusV156.openQuest();
      else dispatchEvent(new CustomEvent('civweave:working-campus-view-request',{detail:{view:'quest'}}));
      return;
    }
    if(action==='focus'){
      if(key.startsWith('personal:')){
        const p=store.actions.find(a=>'personal:'+a.id===key);if(p){p.focus=!p.focus;p.updatedAt=new Date().toISOString();}
      }else if(key.startsWith('quest:')){
        const list=store.focusedQuestKeys;
        store.focusedQuestKeys=list.includes(key)?list.filter(x=>x!==key):[...list,key].slice(0,400);
      }
      writeStore(store);return;
    }
    if(action==='done'&&key.startsWith('personal:')){
      const p=store.actions.find(a=>'personal:'+a.id===key);
      if(p){p.status='done';p.completedAt=new Date().toISOString();p.updatedAt=p.completedAt;writeStore(store);}
    }
  });
  dialog.querySelector('.cw-ab-items').addEventListener('change',event=>{
    const id=event.target.dataset.cwAbStatus,next=event.target.value;
    if(!id||!['inbox','next','waiting','scheduled','someday','done'].includes(next))return;
    const store=readStore(),action=store.actions.find(a=>a.id===id);if(!action)return;
    action.status=next;action.updatedAt=new Date().toISOString();
    action.completedAt=next==='done'?action.updatedAt:'';
    writeStore(store);
  });
  dialog.querySelector('.cw-ab-filter').addEventListener('change',event=>{
    const name=event.target.name;
    if(name==='time')time=event.target.value;
    if(name==='energy')energy=event.target.value;
    if(name==='search')query=event.target.value;
    render();
  });
  dialog.querySelector('.cw-ab-filter [name="search"]').addEventListener('input',event=>{
    query=event.target.value;render();
    const el=dialog.querySelector('.cw-ab-filter [name="search"]');el.focus();el.setSelectionRange(query.length,query.length);
  });
  return dialog;
}
function open(launcher){
  const element=create();returnFocus=launcher||document.activeElement;render();
  if(!element.open)element.showModal();return true;
}
function installLauncher(){
  const head=document.querySelector('main.app .work-head');
  if(!head||head.querySelector('[data-cw-action-board-open]'))return Boolean(head);
  const button=document.createElement('button');
  button.type='button';button.className='cw-action-board-launch';button.dataset.cwActionBoardOpen='true';button.textContent='Ready Now';
  button.addEventListener('click',()=>open(button));head.append(button);return true;
}
function installMenuAction(){
  const menu=document.querySelector('#cw-home-menu-v1 .cw-home-menu-actions');
  if(!menu||menu.querySelector('[data-cw-action-board-menu]'))return;
  const button=document.createElement('button');button.className='cw-home-menu-action';button.type='button';
  button.dataset.cwActionBoardMenu='true';button.innerHTML='<span>Ready Now</span><small>Capture actions and see what is possible next.</small>';
  button.addEventListener('click',()=>{
    document.querySelector('#cw-home-menu-v1 .cw-home-menu-close')?.click();open(button);
  });menu.insertBefore(button,menu.firstChild);
}
function boot(){installLauncher();installMenuAction();}
addEventListener('storage',event=>{if([ACTIONS_KEY,INTENTIONS_KEY,CAMPUS_KEY].includes(event.key)&&dialog?.open)render()});
addEventListener('civweave:home-menu-opened',()=>installMenuAction());
addEventListener('civweave:working-campus-surface-repaired',boot);
addEventListener('civweave:working-campus-plan-built',()=>{boot();if(dialog?.open)render()});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
globalThis.CivweaveActionBoardV1=Object.freeze({version:VERSION,open,read:allActions,refresh:()=>{boot();if(dialog?.open)render()}});
