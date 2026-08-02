(()=>{
'use strict';
const VERSION='1.0.30';
const BUILD='1.0.30-anarchadia-citizen-console';
const CABINETS={
  commonweave:'/app/assets/cabinets/commonweave.webp',
  'living-school':'/app/assets/cabinets/living-school.webp',
  cerbanimo:'/app/assets/cabinets/cerbanimo.webp',
  fellowfare:'/app/assets/cabinets/fellowfare.webp',
  anarchadia:'/app/assets/cabinets/anarchadia.webp'
};
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const realmId=()=>{const parts=location.pathname.split('/').filter(Boolean);const index=parts.indexOf('realm');return index>=0?parts[index+1]||'':'commonweave'};
const currentRoom=(ledger,systemId)=>{
  const system=ledger?.index?.systems?.get?.(systemId)||ledger?.systems?.find?.(item=>item.id===systemId);
  if(!system)return systemId==='commonweave'?'quad':'';
  if(systemId==='commonweave'&&!location.pathname.includes('/realm/'))return 'quad';
  const query=new URLSearchParams(location.search).get('room');
  const saved=localStorage.getItem(`commonweave.realm-room.${systemId}`);
  return system.rooms.find(room=>room.id===(query||saved))?.id||system.rooms[0]?.id||'';
};
const roomRecord=(ledger,systemId,roomId)=>{
  const system=ledger?.index?.systems?.get?.(systemId)||ledger?.systems?.find?.(item=>item.id===systemId);
  return system?.rooms?.find?.(room=>room.id===roomId)||system?.rooms?.[0]||null;
};
const workstationUrl=(systemId,roomId)=>{
  if(systemId==='anarchadia')return '/app/anarchadia-console-v139.html?embed=1';
  const q=new URLSearchParams({system:systemId,embed:'1'});if(roomId)q.set('room',roomId);return `/lite/?${q}`;
};
let ledger=null;
let launcher=null;
let dialog=null;
function pageCount(systemId,room){
  if(systemId==='anarchadia')return 4;
  const roomCount=Array.isArray(room?.capabilityIds)?room.capabilityIds.length:0;
  if(systemId==='commonweave'&&!location.pathname.includes('/realm/')){
    const realmLinks=document.querySelectorAll('[data-realm]').length;
    return Math.max(1,roomCount+realmLinks);
  }
  return roomCount;
}
function ensureLauncher(){
  if(launcher)return launcher;
  launcher=document.createElement('button');
  launcher.type='button';
  launcher.className='cw-cabinet-launcher';
  launcher.innerHTML='<span class="cw-mini-cabinet"><img alt=""><b aria-hidden="true">0</b></span><span class="cw-cabinet-launcher-label">Workstation</span>';
  launcher.addEventListener('click',openWorkstation);
  document.body.append(launcher);
  return launcher;
}
function ensureDialog(){
  if(dialog)return dialog;
  dialog=document.createElement('dialog');
  dialog.className='cw-cabinet-workstation-dialog';
  dialog.innerHTML='<section><header><div><small>LOCAL CABINET WORKSTATION</small><h2>Loading…</h2></div><button type="button" data-close aria-label="Close workstation">×</button></header><iframe title="Commonweave cabinet workstation"></iframe></section>';
  dialog.querySelector('[data-close]').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});
  dialog.addEventListener('close',()=>launcher?.focus());
  document.body.append(dialog);
  return dialog;
}
function context(){
  const systemId=realmId()||'commonweave';
  const roomId=currentRoom(ledger,systemId);
  const room=roomRecord(ledger,systemId,roomId);
  const system=ledger?.index?.systems?.get?.(systemId)||ledger?.systems?.find?.(item=>item.id===systemId);
  return {systemId,roomId,room,system,count:pageCount(systemId,room)};
}
function refresh(){
  const node=ensureLauncher();
  const ctx=context();
  const img=node.querySelector('img');
  img.src=CABINETS[ctx.systemId]||CABINETS.commonweave;
  img.alt=`${ctx.system?.name||'Commonweave'} cabinet`;
  node.querySelector('b').textContent=String(ctx.count);
  node.querySelector('.cw-cabinet-launcher-label').textContent=ctx.systemId==='anarchadia'?'Citizen Console':ctx.room?.label?`${ctx.room.label} workstation`:'Workstation';
  node.setAttribute('aria-label',ctx.systemId==='anarchadia'?'Open the Anarchadia Citizen Console. Four functional cabinet modules are available.':`Open ${ctx.system?.name||'Commonweave'} workstation. ${ctx.count} cabinet interaction${ctx.count===1?'':'s'} mapped to this page.`);
  node.dataset.system=ctx.systemId;
  node.dataset.room=ctx.roomId;
}
function openWorkstation(){
  const ctx=context();
  const node=ensureDialog();
  node.querySelector('h2').textContent=ctx.systemId==='anarchadia'?'Anarchadia · Citizen Console':`${ctx.system?.name||'Commonweave'} · ${ctx.room?.label||'Workstation'}`;
  const frame=node.querySelector('iframe');
  const next=workstationUrl(ctx.systemId,ctx.roomId);
  if(frame.getAttribute('src')!==next)frame.src=next;
  if(typeof node.showModal==='function')node.showModal();else node.setAttribute('open','');
  report('workstation-opened',{system:ctx.systemId,room:ctx.roomId,count:ctx.count,url:next});
}
function releaseDialog(){
  const node=document.createElement('dialog');
  node.className='cw127-dialog';
  node.innerHTML=`<section><header><div><small>LOCAL-FIRST RELEASE</small><h2>Commonweave v${VERSION}</h2></div><button class="cw127-close" data-close aria-label="Close">×</button></header><p>Build: <code>${BUILD}</code></p><p>The website is the installer, updater, and optional hub gateway. The installed Commonweave PWA is the offline-first local campus.</p><menu><button type="button" data-open-cabinet>Open this page’s workstation</button><a href="/" target="_blank" rel="noopener">Installer and hub gateway</a></menu></section>`;
  document.body.append(node);
  node.querySelector('[data-close]').onclick=()=>node.close();
  node.querySelector('[data-open-cabinet]').onclick=()=>{node.close();openWorkstation()};
  node.addEventListener('close',()=>node.remove(),{once:true});
  node.showModal?.();
}
function report(kind,detail={}){
  fetch('/api/boot-log',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({schema:'commonweave.boot-log.v1',time:new Date().toISOString(),version:VERSION,build:BUILD,kind:`v130-cabinet:${kind}`,detail}),keepalive:true,cache:'no-store'}).catch(()=>{});
}
document.addEventListener('click',event=>{
  const control=event.target.closest?.('[data-action]');
  if(!control)return;
  if(control.dataset.action==='lite'){
    event.preventDefault();event.stopImmediatePropagation();openWorkstation();
  }else if(control.dataset.action==='version'){
    event.preventDefault();event.stopImmediatePropagation();releaseDialog();
  }
},true);
addEventListener('popstate',()=>setTimeout(refresh,0));
document.addEventListener('click',event=>{if(event.target.closest?.('[data-room],[data-open-room]'))setTimeout(refresh,80)});
new MutationObserver(()=>refresh()).observe(document.documentElement,{attributes:true,attributeFilter:['data-commonweave-build']});
(async()=>{
  try{
    ledger=await window.CommonweaveParity?.load?.();
  }catch(error){
    report('ledger-load-failed',{message:error.message});
  }
  document.documentElement.dataset.commonweaveBuild=BUILD;
  localStorage.setItem('commonweave.host-build',BUILD);
  refresh();
  const ctx=context();report('launcher-ready',{system:ctx.systemId,room:ctx.roomId,count:ctx.count});
})();
})();