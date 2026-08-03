(()=>{
'use strict';
const VERSION='1.0.31';
const BUILD='1.0.31-canonical-visual-cabinet-v141';
const SHELLS_URL='/app/shared/cabinet-shells-v129.json';
const DEFAULT_CABINETS={commonweave:'/app/assets/cabinets/commonweave.webp','living-school':'/app/assets/cabinets/living-school.webp',cerbanimo:'/app/assets/cabinets/cerbanimo.webp',fellowfare:'/app/assets/cabinets/fellowfare.webp',anarchadia:'/app/assets/cabinets/anarchadia.webp'};
const realmId=()=>{const parts=location.pathname.split('/').filter(Boolean),index=parts.indexOf('realm');return index>=0?parts[index+1]||'commonweave':'commonweave'};
let ledger=null,shells={},launcher=null;
function systemRecord(systemId){return ledger?.index?.systems?.get?.(systemId)||ledger?.systems?.find?.(item=>item.id===systemId)||ledger?.systems?.[0]||null}
function currentRoom(systemId){const system=systemRecord(systemId);if(!system)return null;const query=new URLSearchParams(location.search).get('room'),saved=localStorage.getItem(`commonweave.realm-room.${systemId}`);return system.rooms.find(room=>room.id===(query||saved))||system.rooms[0]||null}
function shellFor(systemId){const configured=shells?.[systemId]||{};return{...configured,asset:configured.asset||DEFAULT_CABINETS[systemId]||DEFAULT_CABINETS.commonweave}}
function ensureLauncher(){if(launcher)return launcher;launcher=document.createElement('button');launcher.type='button';launcher.className='cw-cabinet-launcher';launcher.innerHTML='<span class="cw-mini-cabinet"><img alt=""><b aria-hidden="true">0</b></span><span class="cw-cabinet-launcher-label">Visual cabinet</span>';launcher.addEventListener('click',openWorkstation);document.body.append(launcher);return launcher}
function context(systemOverride=''){const systemId=systemOverride||realmId(),system=systemRecord(systemId),room=currentRoom(systemId),count=Math.max(1,Array.isArray(room?.capabilityIds)?room.capabilityIds.length:0);return{systemId,system,room,count}}
function refresh(){const node=ensureLauncher(),ctx=context(),img=node.querySelector('img');img.src=shellFor(ctx.systemId).asset;img.alt=`${ctx.system?.name||'Commonweave'} cabinet`;node.querySelector('b').textContent=String(ctx.count);node.querySelector('.cw-cabinet-launcher-label').textContent=ctx.room?.label?`${ctx.room.label} visual`:'Visual cabinet';node.setAttribute('aria-label',`Open the canonical ${ctx.system?.name||'Commonweave'} visual cabinet.`)}
function openSystem(systemId){const ctx=context(systemId);location.assign(CommonweaveParity.visualUrl({systemId:ctx.systemId,roomId:ctx.room?.id||'',from:'loom'}))}
function openWorkstation(){openSystem(context().systemId)}
document.addEventListener('click',event=>{
  const realmControl=event.target.closest?.('[data-realm]');
  if(realmControl?.dataset.realm){event.preventDefault();event.stopImmediatePropagation();openSystem(realmControl.dataset.realm);return}
  const actionControl=event.target.closest?.('[data-action]');
  if(actionControl?.dataset.action==='lite'){event.preventDefault();event.stopImmediatePropagation();openWorkstation()}
},true);
addEventListener('popstate',()=>setTimeout(refresh,0));
document.addEventListener('click',event=>{if(event.target.closest?.('[data-room],[data-open-room]'))setTimeout(refresh,80)});
new MutationObserver(()=>refresh()).observe(document.documentElement,{attributes:true,attributeFilter:['data-commonweave-build']});
(async()=>{try{[ledger,shells]=await Promise.all([window.CommonweaveParity?.load?.(),fetch(SHELLS_URL,{cache:'force-cache'}).then(response=>response.ok?response.json():{systems:{}}).then(value=>value.systems||{})])}catch{}document.documentElement.dataset.commonweaveBuild=BUILD;localStorage.setItem('commonweave.host-build',BUILD);refresh()})();
})();
