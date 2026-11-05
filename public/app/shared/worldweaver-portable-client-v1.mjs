/** Shared portable universe export. Offline drafts do not alter canonical Civweave or Guild records. */
export const PORTABLE_CLIENT_SCHEMA='civweave.portable-universe.v1';
const cut=(x,n=180)=>String(x??'').slice(0,n);
const validId=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,96}$/.test(x);
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function normalizePortableUniverse(value){
  if(!value||typeof value!=='object')throw new TypeError('Universe blueprint required');
  if(!validId(value.id))throw new TypeError('Universe ID invalid');
  const input=Array.isArray(value.rooms)?value.rooms:value.districts;
  if(!Array.isArray(input)||input.length<1||input.length>64)throw new TypeError('Universe requires 1–64 rooms');
  const ids=new Set();
  const rooms=input.map((r,i)=>{
    if(!r||!validId(r.id)||ids.has(r.id))throw new TypeError('Room ID invalid or duplicate');
    ids.add(r.id);
    const specs=Array.isArray(r.stations)?r.stations:r.stationTitle?[{title:r.stationTitle,stationType:r.stationType,instructions:r.instructions}]:[];
    return {id:r.id,title:cut(r.title||'Room '+i,120),description:cut(r.description,900),
      guide:cut(r.guide||'weaveling',50),stations:specs.slice(0,20).map(s=>({
        title:cut(s.title,120),kind:cut(s.stationType,50),instructions:cut(s.instructions,600)
      }))};
  });
  const prompts=Array.isArray(value.storyPressure)?value.storyPressure.slice(0,24).map(x=>cut(x,600)):
    value.pve?.goal?[cut(value.pve.goal,600)]:[];
  return {schema:PORTABLE_CLIENT_SCHEMA,id:value.id,title:cut(value.title||value.id,160),
    premise:cut(value.premise||value.tagline,1000),rooms,prompts};
}
/* Bundled verbatim into the HTML. No network, iframe, eval, external script, or parallel chat owner. */
function portableClient(){
  'use strict';
  const world=JSON.parse(document.getElementById('cw-universe-data').textContent);
  const key='civweave.portable.world.'+world.id+'.v1';
  const state={roomId:world.rooms[0].id,quests:[],journal:[]};
  let stored=true;
  try{
    const old=JSON.parse(localStorage.getItem(key)||'null');
    if(old&&typeof old==='object'){
      if(world.rooms.some(r=>r.id===old.roomId))state.roomId=old.roomId;
      if(Array.isArray(old.quests))state.quests=old.quests.filter(q=>q&&typeof q.title==='string'&&typeof q.done==='boolean').slice(0,150).map(q=>({title:q.title.slice(0,160),done:q.done}));
      if(Array.isArray(old.journal))state.journal=old.journal.filter(n=>typeof n==='string').slice(0,150).map(n=>n.slice(0,2000));
    }
  }catch(_){stored=false;}
  const $=id=>document.getElementById(id);
  const make=(tag,cls,text)=>{
    const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;
  };
  function save(){
    try{localStorage.setItem(key,JSON.stringify(state));stored=true;}catch(_){stored=false;}
    $('cw-storage').textContent=stored?'Saved on this device':'Session only: export drafts to keep changes';
  }
  function rooms(){
    const list=$('cw-room-list');list.replaceChildren();
    world.rooms.forEach(r=>{
      const b=make('button','room'+(r.id===state.roomId?' active':''),r.title);
      b.type='button';b.dataset.room=r.id;b.setAttribute('aria-pressed',String(r.id===state.roomId));
      b.addEventListener('click',()=>{state.roomId=r.id;save();rooms();current();});list.append(b);
    });
  }
  function current(){
    const room=world.rooms.find(r=>r.id===state.roomId)||world.rooms[0];
    $('cw-current-room').textContent=room.title;$('cw-room-description').textContent=room.description;
    $('cw-guide').textContent='Guide: '+room.guide;
    const list=$('cw-stations');list.replaceChildren();
    room.stations.forEach(s=>{
      const item=make('article','station');
      item.append(make('strong','',s.title),make('small','',s.kind),make('p','',s.instructions));list.append(item);
    });
  }
  function quests(){
    const list=$('cw-quest-list');list.replaceChildren();
    state.quests.forEach((q,i)=>{
      const row=make('div','quest'),check=make('input'),remove=make('button','small-button','Remove');
      check.type='checkbox';check.checked=q.done;check.setAttribute('aria-label','Complete '+q.title);
      check.addEventListener('change',()=>{state.quests[i].done=check.checked;save();quests();});
      remove.type='button';remove.addEventListener('click',()=>{state.quests.splice(i,1);save();quests();});
      row.append(check,make('span','',q.title),remove);list.append(row);
    });
    if(!state.quests.length)list.append(make('p','muted','No Quest drafts yet.'));
    $('cw-quest-count').textContent=state.quests.filter(q=>q.done).length+' of '+state.quests.length+' local steps complete';
  }
  function journal(){
    const list=$('cw-journal-list');list.replaceChildren();
    state.journal.forEach((n,i)=>{
      const row=make('article','note'),remove=make('button','small-button','Remove note');
      remove.type='button';remove.addEventListener('click',()=>{state.journal.splice(i,1);save();journal();});
      row.append(make('p','',n),remove);list.append(row);
    });
    if(!state.journal.length)list.append(make('p','muted','No journal entries yet.'));
  }
  function tab(name){
    document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===name)));
    ['map','quests','journal','guide'].forEach(k=>{$('cw-panel-'+k).hidden=k!==name;});
  }
  document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>tab(b.dataset.tab)));
  $('cw-quest-form').addEventListener('submit',event=>{
    event.preventDefault();const f=$('cw-quest-title'),title=f.value.trim().slice(0,160);
    if(!title||state.quests.length>=150)return;
    state.quests.push({title,done:false});f.value='';save();quests();
  });
  $('cw-journal-form').addEventListener('submit',event=>{
    event.preventDefault();const f=$('cw-journal-text'),note=f.value.trim().slice(0,2000);
    if(!note||state.journal.length>=150)return;
    state.journal.push(note);f.value='';save();journal();
  });
  const prompts=$('cw-story-prompts');
  world.prompts.forEach(x=>prompts.append(make('li','',x)));
  if(!world.prompts.length)prompts.append(make('li','','Create a cooperative story challenge.'));
  $('cw-export').addEventListener('click',()=>{
    const data={schema:'civweave.portable-local-drafts.v1',universeId:world.id,roomId:state.roomId,quests:state.quests,journal:state.journal};
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    const link=make('a');link.href=url;link.download=world.id+'-local-drafts.json';
    document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  $('cw-import').addEventListener('change',async event=>{
    const f=event.target.files?.[0];event.target.value='';if(!f)return;
    try{
      if(f.size>512000)throw Error('size');
      const d=JSON.parse(await f.text());
      if(d.schema!=='civweave.portable-local-drafts.v1'||d.universeId!==world.id||
        !Array.isArray(d.quests)||d.quests.length>150||!Array.isArray(d.journal)||d.journal.length>150||
        d.quests.some(q=>!q||typeof q.title!=='string'||typeof q.done!=='boolean')||
        d.journal.some(n=>typeof n!=='string'))throw Error('format');
      state.quests=d.quests.map(q=>({title:q.title.slice(0,160),done:q.done}));
      state.journal=d.journal.map(n=>n.slice(0,2000));
      if(world.rooms.some(r=>r.id===d.roomId))state.roomId=d.roomId;
      save();rooms();current();quests();journal();$('cw-import-status').textContent='Local drafts imported.';
    }catch(_){$('cw-import-status').textContent='Import rejected; current drafts unchanged.';}
  });
  $('cw-world-title').textContent=world.title;$('cw-premise').textContent=world.premise;
  $('cw-client-status').textContent='Offline-capable · personal draft mode · no Guild or world server writes';
  rooms();current();quests();journal();save();tab('map');
}
const CSS=[
':root{color-scheme:dark;font-family:system-ui,sans-serif;background:#081510;color:#edfff1}',
'*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(ellipse at top,#18392d,#081510 72%)}',
'header,main,footer{max-width:1100px;margin:auto;padding:20px}header{padding-top:36px}',
'h1{font-size:clamp(2rem,5vw,3.6rem);margin:.2em 0}h2{font-size:1.3rem}p{line-height:1.5}',
'.eyebrow{color:#a6efbb;text-transform:uppercase;letter-spacing:.12em;font-size:.8rem}.muted,small{color:#c0d7c8}',
'nav{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #51705c}',
'button,.import-button{font:inherit;cursor:pointer;color:#fff;background:#16442d;border:1px solid #6aa280;border-radius:10px;padding:10px 14px}',
'button:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid #c1ffcf;outline-offset:2px}',
'nav button[aria-selected=true],.room.active{background:#49a472;color:#03140a}',
'.panel{border:1px solid #4b7355;border-radius:18px;padding:16px;background:#11271b}',
'.layout{display:grid;grid-template-columns:260px 1fr;gap:16px}.room-list{display:flex;flex-direction:column;gap:8px}.room{text-align:left}',
'.station,.note,.quest{border-top:1px solid #42664c;padding:12px 0}.station strong,.station small{display:block}',
'.quest{display:flex;align-items:center;gap:12px}.quest span{flex:1;overflow-wrap:anywhere}.quest input{width:20px;height:20px}',
'.small-button{font-size:.8rem;padding:6px 9px}input[type=text],textarea{font:inherit;width:100%;padding:12px;border:1px solid #6a9274;background:#07170f;color:#fff;border-radius:9px}',
'textarea{min-height:140px}form{display:grid;gap:10px;margin:16px 0}.actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
'.import-button input{display:none}a{color:#b0ffca}li{margin:.6em 0;line-height:1.45}[hidden]{display:none!important}',
'footer{font-size:.8rem;color:#c0d7c8}@media(max-width:650px){.layout{grid-template-columns:1fr}.room-list{flex-direction:row;overflow-x:auto}.room{flex:none}header,main,footer{padding:16px}}'
].join('\n');
export function exportPortableUniverseHtml(universe){
  const w=normalizePortableUniverse(universe);
  const json=JSON.stringify(w).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
  return [
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
  '<title>'+esc(w.title)+' · Civweave Portable</title><style>'+CSS+'</style></head><body>',
  '<header><div class="eyebrow">Civweave / Worldweaver / portable universe</div><h1 id="cw-world-title"></h1><p id="cw-premise"></p>',
  '<p id="cw-client-status" class="muted" role="status"></p></header><main>',
  '<nav aria-label="Civweave client"><button type="button" id="cw-tab-map" data-tab="map">Guild Map</button>',
  '<button type="button" data-tab="quests">Quests</button><button id="cw-tab-journal" type="button" data-tab="journal">Journal</button>',
  '<button type="button" data-tab="guide">Guide &amp; PvE</button></nav>',
  '<section id="cw-panel-map"><div class="layout"><aside class="panel"><h2>Places</h2><div id="cw-room-list" class="room-list"></div></aside>',
  '<div class="panel"><div id="cw-guide" class="eyebrow"></div><h2 id="cw-current-room"></h2><p id="cw-room-description"></p><div id="cw-stations"></div></div></div></section>',
  '<section id="cw-panel-quests" class="panel" hidden><h2>Local Quest drafts</h2><p class="muted">Personal rehearsal only. These steps do not change any canonical Quest or Guild ledger.</p>',
  '<form id="cw-quest-form"><label for="cw-quest-title">Next step</label><input id="cw-quest-title" type="text" maxlength="160" required>',
  '<button type="submit">Add step</button></form><p id="cw-quest-count" aria-live="polite"></p><div id="cw-quest-list"></div></section>',
  '<section id="cw-panel-journal" class="panel" hidden><h2>Private local journal</h2><form id="cw-journal-form">',
  '<label for="cw-journal-text">Observation or idea</label><textarea id="cw-journal-text" maxlength="2000" required></textarea>',
  '<button type="submit">Save note</button></form><div id="cw-journal-list"></div></section>',
  '<section id="cw-panel-guide" class="panel" hidden><h2>PvE story prompts</h2><p>Human-led improvisation. AI actors are not running inside this portable file.</p>',
  '<ul id="cw-story-prompts"></ul><h2>Carry your drafts</h2><p id="cw-storage" class="muted"></p><div class="actions">',
  '<button id="cw-export" type="button">Export drafts JSON</button>',
  '<label class="import-button">Import drafts JSON<input id="cw-import" type="file" accept=".json,application/json"></label>',
  '<span id="cw-import-status" role="status"></span></div>',
  '<p><a href="https://civweave.cc" target="_blank" rel="noopener noreferrer">Open full Civweave</a> for verified Guilds, chat, live Quests and shared worlds.</p>',
  '</section></main><footer>Offline client. No credentials, network calls, model inference or binding external actions.</footer>',
  '<script id="cw-universe-data" type="application/json">'+json+'</script>',
  '<script>('+portableClient.toString()+')();</script></body></html>'
  ].join('\n');
}
