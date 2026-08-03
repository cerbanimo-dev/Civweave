(()=>{
'use strict';
const VERSION='1.0.31';
const SHELLS_URL='/app/shared/cabinet-shells-v129.json';
const DEFAULT_SYSTEM='commonweave';
const params=new URLSearchParams(location.search);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let ledger=null,shells={};
const $=selector=>document.querySelector(selector);
function systemFor(id){return ledger?.index?.systems?.get?.(id)||ledger?.systems?.find?.(item=>item.id===id)||ledger?.systems?.[0]||null}
function roomFor(system,id){return system?.rooms?.find?.(room=>room.id===id)||system?.rooms?.[0]||null}
function selected(){const system=systemFor(params.get('system')||DEFAULT_SYSTEM),room=roomFor(system,params.get('room')||'');return{system,room}}
function shellFor(systemId){const configured=shells?.[systemId]||{};return{...configured,asset:configured.asset||`/app/assets/cabinets/${encodeURIComponent(systemId)}.webp`,screen:configured.screen||{x:11.2,y:22.4,width:77.6,height:60.1,radius:4.8,clip:'inset(0 round 4.8%)'},controls:configured.controls||[]}}
function consoleUrl(system,room){const query=new URLSearchParams({embed:'1'});if(system?.id)query.set('system',system.id);if(room?.id)query.set('room',room.id);if(params.get('capability'))query.set('capability',params.get('capability'));return system?.id==='anarchadia'?`/app/anarchadia-console-v139.html?${query}`:`/app/realm-console-v140.html?${query}`}
function syncAddress(system,room,{replace=true}={}){const query=new URLSearchParams({system:system.id});if(room?.id)query.set('room',room.id);if(params.get('capability'))query.set('capability',params.get('capability'));query.set('from',params.get('from')||'cabinet');history[replace?'replaceState':'pushState']({system:system.id,room:room?.id||''},'',`/app/cabinet-mode-v142.html?${query}`);for(const key of [...params.keys()])params.delete(key);for(const [key,value] of query)params.set(key,value)}
function render(systemId=params.get('system')||DEFAULT_SYSTEM,roomId=params.get('room')||''){
  const system=systemFor(systemId);if(!system)throw new Error(`Unknown Commonweave system: ${systemId}`);
  const room=roomFor(system,roomId),shell=shellFor(system.id),screen=shell.screen||{},frame=$('#cv141-shell'),art=$('#cv141-art'),iframe=$('#cv141-screen');
  frame.style.setProperty('--screen-x',`${screen.x??11.2}%`);frame.style.setProperty('--screen-y',`${screen.y??22.4}%`);frame.style.setProperty('--screen-w',`${screen.width??77.6}%`);frame.style.setProperty('--screen-h',`${screen.height??60.1}%`);frame.style.setProperty('--screen-radius',`${screen.radius??4.8}%`);frame.style.setProperty('--screen-clip',screen.clip||`inset(0 round ${screen.radius??4.8}%)`);frame.style.setProperty('--screen-content-top',`${screen.contentTop??0}%`);
  art.src=shell.asset;art.alt=`${system.name} physical cabinet`;
  const next=consoleUrl(system,room);if(iframe.getAttribute('src')!==next)iframe.src=next;iframe.title=`${system.name} · ${room?.label||'Cabinet console'}`;
  $('#cv141-title').textContent=`${system.name} · ${room?.label||'Cabinet console'}`;
  $('#cv141-controls').innerHTML=(shell.controls||[]).map(control=>`<button type="button" data-system="${esc(control.system)}" class="${control.system===system.id?'is-active':''}" style="--x:${Number(control.x)}%;--y:${Number(control.y)}%;--size:${Number(control.size)}%" aria-label="Open ${esc(systemFor(control.system)?.name||control.system)} cabinet" ${control.system===system.id?'aria-current="page"':''}></button>`).join('');
  syncAddress(system,room);
}
function leave(){const from=params.get('from');if(from==='lite'){const {system,room}=selected();location.assign(CommonweaveParity.liteUrl({systemId:system.id,roomId:room?.id||''}));return}if(history.length>1){history.back();return}location.assign('/loom/')}
document.addEventListener('click',event=>{const button=event.target.closest('[data-system]');if(!button)return;params.delete('capability');const system=systemFor(button.dataset.system),room=system?.rooms?.[0];if(system)render(system.id,room?.id||'')});
$('#cv141-back').addEventListener('click',leave);
addEventListener('popstate',()=>{const query=new URLSearchParams(location.search);for(const key of [...params.keys()])params.delete(key);for(const [key,value] of query)params.set(key,value);render(params.get('system')||DEFAULT_SYSTEM,params.get('room')||'')});
(async()=>{try{[ledger,shells]=await Promise.all([CommonweaveParity.load(),fetch(SHELLS_URL,{cache:'force-cache'}).then(response=>response.ok?response.json():{systems:{}}).then(value=>value.systems||{})]);const {system,room}=selected();render(system.id,room?.id||'')}catch(error){const node=$('#cv141-error');node.hidden=false;node.textContent=`Cabinet mode could not open: ${error.message}`}})();
})();
