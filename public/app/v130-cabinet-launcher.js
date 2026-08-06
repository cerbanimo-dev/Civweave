(()=>{
'use strict';
const VERSION='1.0.31';
const BUILD='1.0.31-cabinet-mode-v142';
const SHELLS_URL='/app/shared/cabinet-shells-v129.json';
const DEFAULT_CABINETS={civweave:'/app/assets/cabinets/civweave.webp','living-school':'/app/assets/cabinets/living-school.webp',cerbanimo:'/app/assets/cabinets/cerbanimo.webp',fellowfare:'/app/assets/cabinets/fellowfare.webp',anarchadia:'/app/assets/cabinets/anarchadia.webp'};
const realmId=()=>{const parts=location.pathname.split('/').filter(Boolean),index=parts.indexOf('realm');return index>=0?parts[index+1]||'civweave':'civweave'};
let ledger=null,shells={},launcher=null;
function systemRecord(systemId){return ledger?.index?.systems?.get?.(systemId)||ledger?.systems?.find?.(item=>item.id===systemId)||ledger?.systems?.[0]||null}
function currentRoom(systemId){const system=systemRecord(systemId);if(!system)return null;const query=new URLSearchParams(location.search).get('room'),saved=localStorage.getItem(`civweave.realm-room.${systemId}`);return system.rooms.find(room=>room.id===(query||saved))||system.rooms[0]||null}
function shellFor(systemId){const configured=shells?.[systemId]||{};return{...configured,asset:configured.asset||DEFAULT_CABINETS[systemId]||DEFAULT_CABINETS.civweave}}
function ensureLauncher(){if(launcher)return launcher;launcher=document.createElement('button');launcher.type='button';launcher.className='cw-cabinet-launcher';launcher.innerHTML='<span class="cw-mini-cabinet"><img alt=""><b aria-hidden="true">0</b></span><span class="cw-cabinet-launcher-label">Cabinet mode</span>';launcher.addEventListener('click',openWorkstation);document.body.append(launcher);return launcher}
function context(systemOverride=''){const systemId=systemOverride||realmId(),system=systemRecord(systemId),room=currentRoom(systemId),count=Math.max(1,Array.isArray(room?.capabilityIds)?room.capabilityIds.length:0);return{systemId,system,room,count}}
function refresh(){const node=ensureLauncher(),ctx=context(),img=node.querySelector('img');img.src=shellFor(ctx.systemId).asset;img.alt=`${ctx.system?.name||'Civweave'} cabinet`;node.querySelector('b').textContent=String(ctx.count);node.querySelector('.cw-cabinet-launcher-label').textContent=ctx.room?.label?`${ctx.room.label} cabinet`:'Cabinet mode';node.setAttribute('aria-label',`Open ${ctx.system?.name||'Civweave'} Cabinet Mode.`)}
function cabinetUrl(systemId){const ctx=context(systemId);return CivweaveParity.cabinetUrl({systemId:ctx.systemId,roomId:ctx.room?.id||'',from:'loom'})}
function openSystem(systemId){location.assign(cabinetUrl(systemId))}
function openWorkstation(){openSystem(context().systemId)}
function closePicker(node){if(typeof node?.close==='function'&&node.open)node.close();else node?.removeAttribute('open')}
function openPicker(){
  let node=document.querySelector('#cw142-cabinet-picker');
  if(!node){node=document.createElement('dialog');node.id='cw142-cabinet-picker';node.className='cw127-dialog';document.body.append(node)}
  const ids=['living-school','cerbanimo','fellowfare','anarchadia'];
  node.innerHTML=`<section><header><div><small>CABINET MODE</small><h2>Choose a cabinet</h2><p>The illustrated location scenes are archived from this release. Each realm now opens directly in its calibrated cabinet.</p></div><button class="cw127-close" type="button" data-close aria-label="Close">×</button></header><div class="cw127-card-grid">${ids.map(id=>{const system=systemRecord(id);return `<button class="cw127-card" type="button" data-cabinet-system="${id}" style="background-image:url('${shellFor(id).asset}')"><b>${system?.name||id}</b><span>${system?.guide||'Civweave guide'} · cabinet console</span></button>`}).join('')}</div></section>`;
  node.querySelector('[data-close]')?.addEventListener('click',()=>closePicker(node));
  node.querySelectorAll('[data-cabinet-system]').forEach(button=>button.addEventListener('click',()=>openSystem(button.dataset.cabinetSystem)));
  node.addEventListener('click',event=>{if(event.target===node)closePicker(node)},{once:true});
  if(typeof node.showModal==='function'){if(!node.open)node.showModal()}else node.setAttribute('open','');
}
document.addEventListener('click',event=>{
  const realmControl=event.target.closest?.('[data-realm]');
  if(realmControl?.dataset.realm){event.preventDefault();event.stopImmediatePropagation();openSystem(realmControl.dataset.realm);return}
  const actionControl=event.target.closest?.('[data-action]');
  const action=actionControl?.dataset.action;
  if(action==='lite'||action==='cabinet'){event.preventDefault();event.stopImmediatePropagation();openWorkstation();return}
  if(action==='realms'){event.preventDefault();event.stopImmediatePropagation();openPicker()}
},true);
addEventListener('popstate',()=>setTimeout(refresh,0));
document.addEventListener('click',event=>{if(event.target.closest?.('[data-room],[data-open-room]'))setTimeout(refresh,80)});
new MutationObserver(()=>refresh()).observe(document.documentElement,{attributes:true,attributeFilter:['data-civweave-build']});
(async()=>{
  try{[ledger,shells]=await Promise.all([window.CivweaveParity?.load?.(),fetch(SHELLS_URL,{cache:'force-cache'}).then(response=>response.ok?response.json():{systems:{}}).then(value=>value.systems||{})])}catch{}
  document.documentElement.dataset.civweaveBuild=BUILD;localStorage.setItem('civweave.host-build',BUILD);
  if(location.pathname.includes('/loom/realm/')){location.replace(cabinetUrl(realmId()));return}
  refresh();
})();
})();
