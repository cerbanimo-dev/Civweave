import {SUMMON_KINDS,normalizeSummonItem,normalizeDropPosition,createWorldweaverSummons} from './worldweaver-summon-v1.mjs';

const labels={experience:'Experiences',object:'Objects',actor:'Actors',npc:'NPCs',person:'People'};
const make=(tag,className,text)=>{const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e};
const safeError=error=>String(error?.message||error||'Action could not be completed').slice(0,240);

/**
 * Embed in the existing Worldweaver scene. No independent accounts, contacts,
 * simulated remote responses, unverified entity placement or new model loop.
 * World and messaging owners inject their authenticated transport explicitly.
 */
export function mountWorldweaverSummonUI({palette,scene,getCatalog,getWorldRef,transport=null}={}){
 if(!palette||!scene||typeof getCatalog!=='function'||typeof getWorldRef!=='function')
  throw new TypeError('Summon UI requires a palette, scene, catalogue and trusted world reference reader.');
 let active=true,loading=false,selected=null,kind='experience',items=[],drag=null,ghost=null;
 let currentTransport=transport,controller=null,unsubscribe=null,revision=0;
 const wrap=make('div','sl-summon-inner');
 wrap.innerHTML='<header class="sl-summon-head"><div><small>WORLDWEAVER · SUMMON</small><h3>Bring into the world</h3></div><button type="button" data-summon-toggle aria-expanded="true" aria-label="Collapse summon shelf">−</button></header><nav class="sl-summon-kinds" aria-label="Summon categories"></nav><div class="sl-summon-items" role="list"></div><p class="sl-summon-help">Select an item or drag it into the world. The server decides what may materialize.</p><button type="button" class="sl-summon-place" disabled>Place selected in center</button><p class="sl-summon-status" role="status" aria-live="polite">Choose an authorized item.</p>';
 palette.replaceChildren(wrap);
 const nav=wrap.querySelector('.sl-summon-kinds'),list=wrap.querySelector('.sl-summon-items');
 const placeButton=wrap.querySelector('.sl-summon-place'),status=wrap.querySelector('.sl-summon-status');
 const callLayer=make('div','sl-summon-call-layer');
 callLayer.setAttribute('aria-live','polite');scene.append(callLayer);
 const setStatus=message=>{status.textContent=message};
 const showCalls=calls=>{
  if(!active)return;
  callLayer.replaceChildren();
  const call=calls.at(-1);
  if(!call)return;
  const card=make('div','sl-summon-call');
  card.dataset.callState=call.status;
  if(['declined','unavailable','cancelled'].includes(call.status))card.classList.add('sl-summon-call-exit');
  const figure=make('div','sl-summon-call-figure');
  if(call.avatarAsset){const img=make('img');img.src=call.avatarAsset;img.alt='';figure.append(img)}
  else figure.textContent='◉';
  const text=make('div','sl-summon-call-copy');
  text.append(make('strong','',call.title));
  const phrase={
   requested:'Placing the call…',ringing:'Their avatar receives the incoming call…',
   accepted:'Their avatar picks up — joining is not complete yet.',
   joined:'Connected — live avatar handoff confirmed.',
   declined:call.response||'Sorry, I cannot join right now.',
   unavailable:'The call could not connect.',
   cancelled:'Call ended.'
  }[call.status]||'Waiting for a verified call update.';
  text.append(make('span','',phrase));card.append(figure,text);callLayer.append(card);
 };
 function installTransport(next){
  unsubscribe?.();controller?.close();
  currentTransport=next||null;
  controller=createWorldweaverSummons({transport:currentTransport});
  unsubscribe=controller.subscribe(showCalls);
 }
 installTransport(currentTransport);
 const setKind=next=>{
  if(!SUMMON_KINDS.includes(next))return;
  kind=next;selected=null;renderItems();renderKinds();
 };
 const renderKinds=()=>{
  nav.replaceChildren();
  for(const k of SUMMON_KINDS){
   const b=make('button','',labels[k]);b.type='button';b.dataset.summonKind=k;
   b.setAttribute('aria-pressed',String(kind===k));nav.append(b);
  }
 };
 const renderItems=()=>{
  list.replaceChildren();
  const matches=items.filter(x=>x.kind===kind);
  if(!matches.length)list.append(make('p','sl-summon-empty',kind==='person'?'No verified contacts connected. Connect the Guild invitation owner first.':'No authorized '+labels[kind].toLowerCase()+' available in this world.'));
  for(const item of matches){
   const b=make('button','sl-summon-item');b.type='button';b.dataset.summonItem=item.kind+':'+item.id;
   b.setAttribute('role','listitem');b.setAttribute('aria-pressed',String(selected?.id===item.id&&selected?.kind===item.kind));
   b.append(make('span','sl-summon-item-title',item.title));
   if(item.description)b.append(make('small','',item.description));
   list.append(b);
  }
  placeButton.disabled=!selected||loading;
  placeButton.textContent=kind==='person'?'Call selected person':'Place selected in world';
 };
 async function refresh(){
  const token=++revision;
  try{
   const raw=await getCatalog();
   if(!active||token!==revision)return;
   items=(Array.isArray(raw)?raw:[]).slice(0,200).flatMap(item=>{try{return [normalizeSummonItem(item)]}catch{return[]}});
   if(selected&&!items.some(x=>x.id===selected.id&&x.kind===selected.kind))selected=null;
   renderKinds();renderItems();
  }catch(error){if(active&&token===revision){items=[];selected=null;renderItems();setStatus('Catalogue unavailable: '+safeError(error))}}
 }
 async function submit(item,position){
  if(loading)return;
  const worldRef=getWorldRef();
  if(!worldRef){setStatus('Connect a signed Worldweaver room before summoning. Nothing was placed or sent.');return}
  loading=true;renderItems();setStatus(item.kind==='person'?'Requesting an authenticated call…':'Requesting permission to place…');
  try{
   const result=await controller.submit({item,worldRef,position});
   if(!active)return;
   if(result.type==='invitation')setStatus('Call acknowledged by the invitation service. Waiting for the recipient.');
   else setStatus(result.status==='placed'?'Placed in world · '+result.instanceId:'World placement queued; not yet confirmed in the scene.');
  }catch(error){if(active)setStatus(safeError(error))}
  finally{loading=false;if(active)renderItems()}
 }
 const scenePosition=event=>normalizeDropPosition(event.clientX,event.clientY,scene.getBoundingClientRect());
 const center=()=>({u:.5,v:.5});
 const clearDrag=()=>{
  if(ghost){ghost.remove();ghost=null}
  drag=null;scene.classList.remove('sl-summon-drop-ready');
 };
 const onMove=event=>{
  if(!drag||event.pointerId!==drag.pointerId)return;
  const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
  if(!drag.moved&&Math.hypot(dx,dy)<8)return;
  drag.moved=true;
  if(!ghost){ghost=make('div','sl-summon-drag-ghost',drag.item.title);document.body.append(ghost)}
  ghost.style.left=event.clientX+'px';ghost.style.top=event.clientY+'px';
  const r=scene.getBoundingClientRect();
  scene.classList.toggle('sl-summon-drop-ready',event.clientX>=r.left&&event.clientX<=r.right&&event.clientY>=r.top&&event.clientY<=r.bottom);
 };
 const onUp=event=>{
  if(!drag||drag.pointerId!==event.pointerId)return;
  const item=drag.item,moved=drag.moved;
  const r=scene.getBoundingClientRect(),inside=event.clientX>=r.left&&event.clientX<=r.right&&event.clientY>=r.top&&event.clientY<=r.bottom;
  const position=inside?scenePosition(event):null;clearDrag();
  if(moved&&position)void submit(item,position);
  else if(moved)setStatus('Drop inside the world viewport to summon.');
 };
 const onCancel=()=>clearDrag();
 const onPointerDown=event=>{
  if(event.button!==0&&event.pointerType==='mouse')return;
  const tile=event.target.closest('[data-summon-item]');
  if(!tile)return;
  const key=tile.dataset.summonItem,match=items.find(x=>x.kind+':'+x.id===key);
  if(!match)return;
  drag={pointerId:event.pointerId,item:match,x:event.clientX,y:event.clientY,moved:false};
 };
 const onClick=event=>{
  const tab=event.target.closest('[data-summon-kind]');
  if(tab){setKind(tab.dataset.summonKind);return}
  const tile=event.target.closest('[data-summon-item]');
  if(tile){selected=items.find(x=>x.kind+':'+x.id===tile.dataset.summonItem)||null;renderItems();return}
  if(event.target.closest('[data-summon-toggle]')){
   const collapsed=palette.classList.toggle('sl-summon-collapsed');
   const button=wrap.querySelector('[data-summon-toggle]');button.setAttribute('aria-expanded',String(!collapsed));button.textContent=collapsed?'+':'−';return;
  }
  if(event.target.closest('.sl-summon-place')&&selected)void submit(selected,center());
 };
 nav.addEventListener('click',onClick);list.addEventListener('click',onClick);
 list.addEventListener('pointerdown',onPointerDown);
 wrap.querySelector('[data-summon-toggle]').addEventListener('click',onClick);
 placeButton.addEventListener('click',onClick);
 window.addEventListener('pointermove',onMove);window.addEventListener('pointerup',onUp);
 window.addEventListener('pointercancel',onCancel);
 void refresh();
 return Object.freeze({
  refresh,
  setTransport(next){if(!active)return;installTransport(next);void refresh()},
  close(){
   if(!active)return;active=false;revision++;clearDrag();unsubscribe?.();controller?.close();
   window.removeEventListener('pointermove',onMove);window.removeEventListener('pointerup',onUp);window.removeEventListener('pointercancel',onCancel);
   callLayer.remove();wrap.remove();
  }
 });
}
